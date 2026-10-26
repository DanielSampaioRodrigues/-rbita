// A classe Leitor abre um EPUB ou PDF num elemento da página e controla
// páginas, fonte, cores e posição. Depende do navegador (DOM/canvas).
//
// epub.js tem tipos incompletos, então o livro/rendition são tratados de forma
// solta (comentado onde isso acontece). PDF.js tem tipos próprios.

import ePub from "epubjs";
import * as pdfjs from "pdfjs-dist";
// O worker do PDF.js é resolvido como URL pelo empacotador (Vite) do app.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { temaEpub, coresDeLeitura, zoomPdf } from "./estilo";
import type { ConfigLeitura, Formato, ItemSumario, Localizacao } from "./tipos";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Título e autor do livro, lidos dos metadados do arquivo. Campos vazios quando não houver. */
export async function lerMetadados(bytes: ArrayBuffer, formato: Formato): Promise<{ titulo: string; autor: string }> {
  try {
    if (formato === "epub") {
      const livro: any = ePub(bytes);
      const meta = await livro.loaded.metadata;
      const r = { titulo: (meta?.title ?? "").trim(), autor: (meta?.creator ?? "").trim() };
      livro.destroy?.();
      return r;
    }
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
    const m: any = await pdf.getMetadata();
    const info = m?.info ?? {};
    const r = { titulo: String(info.Title ?? "").trim(), autor: String(info.Author ?? "").trim() };
    await pdf.destroy();
    return r;
  } catch {
    // Sem metadados legíveis: devolve vazio, a pessoa preenche à mão.
    return { titulo: "", autor: "" };
  }
}

type AoMudar = (loc: Localizacao) => void;

export class Leitor {
  private container: HTMLElement;
  private formato: Formato = "epub";
  private config!: ConfigLeitura;
  private aoMudar: AoMudar = () => {};

  // EPUB (epub.js, tipos soltos).
  private book: any = null;
  private rendition: any = null;

  // PDF (PDF.js).
  private pdf: pdfjs.PDFDocumentProxy | null = null;
  private paginaAtual = 1;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /** Abre o livro. `bytes` é o conteúdo do arquivo. */
  async abrir(bytes: ArrayBuffer, formato: Formato, config: ConfigLeitura, inicial?: Localizacao): Promise<void> {
    this.formato = formato;
    this.config = config;
    this.container.replaceChildren();
    if (formato === "epub") {
      await this.abrirEpub(bytes, inicial);
    } else {
      await this.abrirPdf(bytes, inicial);
    }
  }

  private async abrirEpub(bytes: ArrayBuffer, inicial?: Localizacao): Promise<void> {
    this.book = ePub(bytes);
    this.rendition = this.book.renderTo(this.container, {
      width: "100%",
      height: "100%",
      flow: this.config.modo === "rolagem" ? "scrolled-doc" : "paginated",
      spread: "none",
    });
    this.rendition.themes.default(temaEpub(this.config));
    this.rendition.on("relocated", (loc: any) => {
      this.aoMudar({ epubCfi: loc?.start?.cfi });
    });
    await this.rendition.display(inicial?.epubCfi || undefined);
  }

  private async abrirPdf(bytes: ArrayBuffer, inicial?: Localizacao): Promise<void> {
    this.pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
    const cores = coresDeLeitura(this.config.corFundo);
    this.container.style.background = cores.fundo;
    this.container.style.overflow = "auto";
    await this.renderPdfTodo();
    const inicio = inicial?.pdfPagina ?? 1;
    this.irParaPaginaPdf(inicio);
  }

  private async renderPdfTodo(): Promise<void> {
    if (!this.pdf) return;
    this.container.replaceChildren();
    const escala = zoomPdf(this.config);
    for (let n = 1; n <= this.pdf.numPages; n++) {
      const pagina = await this.pdf.getPage(n);
      const viewport = pagina.getViewport({ scale: escala * 1.5 });
      const canvas = document.createElement("canvas");
      canvas.className = "leitor-pdf-pagina";
      canvas.dataset.pagina = String(n);
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.display = "block";
      canvas.style.margin = "0 auto 0.75rem";
      canvas.style.maxWidth = "100%";
      const ctx = canvas.getContext("2d");
      if (ctx) await pagina.render({ canvasContext: ctx, viewport }).promise;
      this.container.appendChild(canvas);
    }
    // Observa qual página está visível, para guardar "onde parei".
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            this.paginaAtual = Number((e.target as HTMLElement).dataset.pagina) || 1;
            this.aoMudar({ pdfPagina: this.paginaAtual });
          }
        }
      },
      { root: this.container, threshold: 0.5 },
    );
    this.container.querySelectorAll(".leitor-pdf-pagina").forEach((c) => obs.observe(c));
  }

  private irParaPaginaPdf(n: number): void {
    const alvo = this.container.querySelector<HTMLElement>(`.leitor-pdf-pagina[data-pagina="${n}"]`);
    alvo?.scrollIntoView();
    this.paginaAtual = n;
  }

  async proxima(): Promise<void> {
    if (this.formato === "epub") await this.rendition?.next();
    else this.irParaPaginaPdf(Math.min((this.pdf?.numPages ?? 1), this.paginaAtual + 1));
  }

  async anterior(): Promise<void> {
    if (this.formato === "epub") await this.rendition?.prev();
    else this.irParaPaginaPdf(Math.max(1, this.paginaAtual - 1));
  }

  /** Aplica fonte, cor e tamanho sem recarregar o livro. */
  async aplicarConfig(config: ConfigLeitura): Promise<void> {
    const trocouModo = this.config?.modo !== config.modo;
    this.config = config;
    if (this.formato === "epub" && this.rendition) {
      this.rendition.themes.default(temaEpub(config));
      if (trocouModo) this.rendition.flow(config.modo === "rolagem" ? "scrolled-doc" : "paginated");
    } else if (this.formato === "pdf") {
      this.container.style.background = coresDeLeitura(config.corFundo).fundo;
      await this.renderPdfTodo();
      this.irParaPaginaPdf(this.paginaAtual);
    }
  }

  async sumario(): Promise<ItemSumario[]> {
    if (this.formato === "epub" && this.book) {
      const nav = await this.book.loaded.navigation;
      const itens: ItemSumario[] = [];
      const anda = (lista: any[], nivel: number) => {
        for (const it of lista ?? []) {
          itens.push({ titulo: it.label?.trim() ?? "", destino: it.href, nivel });
          if (it.subitems?.length) anda(it.subitems, nivel + 1);
        }
      };
      anda(nav.toc, 0);
      return itens;
    }
    if (this.formato === "pdf" && this.pdf) {
      const total = this.pdf.numPages;
      return Array.from({ length: total }, (_, i) => ({ titulo: `Página ${i + 1}`, destino: String(i + 1), nivel: 0 }));
    }
    return [];
  }

  async irPara(destino: string): Promise<void> {
    if (this.formato === "epub") await this.rendition?.display(destino);
    else this.irParaPaginaPdf(Number(destino) || 1);
  }

  aoMudarLocalizacao(cb: AoMudar): void {
    this.aoMudar = cb;
  }

  destruir(): void {
    try {
      this.rendition?.destroy?.();
      this.book?.destroy?.();
      this.pdf?.destroy?.();
    } catch {
      // Já pode ter sido destruído; tudo bem.
    }
    this.rendition = null;
    this.book = null;
    this.pdf = null;
    this.container.replaceChildren();
  }
}
