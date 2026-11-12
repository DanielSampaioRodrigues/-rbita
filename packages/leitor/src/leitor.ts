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
import type { ConfigLeitura, Formato, GrifoPdf, ItemSumario, Localizacao, ModoCaneta, Retangulo, SelecaoTexto, Traco } from "./tipos";
import { juntarRetangulos } from "./grifoPdf";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Título e autor do livro, lidos dos metadados do arquivo. Campos vazios quando não houver. */
export async function lerMetadados(bytes: ArrayBuffer, formato: Formato): Promise<{ titulo: string; autor: string }> {
  try {
    if (formato === "epub") {
      const livro: any = ePub(bytes);
      const meta = await livro.loaded.metadata;
      const r = { titulo: (meta?.title ?? "").trim(), autor: (meta?.creator ?? "").trim() };
      // Fechar só depois de o epub.js terminar de carregar o resto (sumário, estilos);
      // fechar antes faz ele tropeçar no livro já destruído.
      await Promise.resolve(livro.ready).catch(() => undefined);
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

/** Um achado da busca: para onde ir (CFI no EPUB, número da página no PDF) e o trecho em volta. */
export interface ResultadoBusca { destino: string; trecho: string; onde: string }

/** Minúsculas e sem acento, com o mesmo tamanho (para achar "memoria" em "Memória"). */
export const normalizar = (t: string) => Array.from(t.toLowerCase()).map((c) => c.normalize("NFD").replace(/\p{M}/gu, "") || c).join("");

/** O trecho em volta do achado, com reticências. */
export function trechoEmVolta(texto: string, i: number, n: number, folga = 60): string {
  const ini = Math.max(0, i - folga), fim = Math.min(texto.length, i + n + folga);
  return `${ini > 0 ? "…" : ""}${texto.slice(ini, fim).replace(/\s+/g, " ").trim()}${fim < texto.length ? "…" : ""}`;
}
const SVG_NS = "http://www.w3.org/2000/svg";
/** Traço grosso (marca-texto) fica translúcido para deixar ler por baixo; fino (caneta) fica opaco. */
const opacidadePara = (espessura: number): number => (espessura >= 0.015 ? 0.3 : 0.9);

export class Leitor {
  private container: HTMLElement;
  private formato: Formato = "epub";
  private config!: ConfigLeitura;
  private aoMudar: AoMudar = () => {};
  private aoSelecionar: (s: SelecaoTexto) => void = () => {};
  private aoTracar: (t: Omit<Traco, "id">) => void = () => {};
  private aoApagarTraco: (id: string) => void = () => {};
  private ultimaLoc: Localizacao = {};

  // Caneta do PDF.
  private modoCaneta: ModoCaneta = "ler";
  private corTraco = "#2e7a80";
  private espessuraTraco = 0.004;
  private tracosGuardados: Traco[] = [];

  // Fontes a injetar na página do EPUB (que roda num iframe isolado, sem as
  // fontes do app). Cada uma: família e URL do arquivo.
  private fontes: { family: string; url: string }[] = [];

  // EPUB (epub.js, tipos soltos).
  private book: any = null;
  private rendition: any = null;

  // PDF (PDF.js).
  private pdf: pdfjs.PDFDocumentProxy | null = null;
  /** Grifos do PDF (desenhados numa camada por página). */
  private grifosPdf: GrifoPdf[] = [];
  /** Páginas do PDF cuja camada de texto já foi montada. */
  private textoMontado = new Set<number>();
  private ultimaSelecaoPdf = "";
  private relogioSelecao: number | null = null;
  private tamanhoObs: ResizeObserver | null = null;
  private aoMudarSelecao = () => this.agendarSelecaoPdf(450);
  private paginaAtual = 1;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /** Fontes do app para usar dentro do EPUB (chamar antes de `abrir`). */
  definirFontes(fontes: { family: string; url: string }[]): void {
    this.fontes = fontes;
  }

  private cssDasFontes(): string {
    return this.fontes.map((f) => `@font-face { font-family: "${f.family}"; src: url("${f.url}") format("woff2"); font-display: swap; }`).join("\n");
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
    // Injeta as fontes do app dentro da página do livro (iframe isolado),
    // senão a troca de fonte (inclusive a de dislexia) não teria efeito.
    const css = this.cssDasFontes();
    if (css) {
      this.rendition.hooks.content.register((contents: any) => {
        try {
          const estilo = contents.document.createElement("style");
          estilo.textContent = css;
          contents.document.head.appendChild(estilo);
        } catch {
          // Se não der para injetar, a fonte cai no padrão do livro.
        }
      });
    }
    this.rendition.themes.default(temaEpub(this.config));
    this.rendition.on("relocated", (loc: any) => {
      this.ultimaLoc = { epubCfi: loc?.start?.cfi };
      this.aoMudar(this.ultimaLoc);
    });
    // Seleção de texto vira um grifo (a pessoa escolhe a cor e confirma).
    this.rendition.on("selected", (cfiRange: string, contents: any) => {
      let texto = "";
      try {
        texto = contents?.window?.getSelection?.()?.toString?.() ?? "";
      } catch {
        // Sem acesso à seleção: o grifo guarda só a posição.
      }
      this.aoSelecionar({ cfiRange, texto: texto.trim() });
    });
    await this.rendition.display(inicial?.epubCfi || undefined);
  }

  /** Adiciona um grifo ao EPUB (cor em hex). */
  grifar(cfiRange: string, cor: string): void {
    try {
      this.rendition?.annotations?.add("highlight", cfiRange, {}, undefined, "grifo-orbita", {
        fill: cor,
        "fill-opacity": "0.3",
        "mix-blend-mode": "multiply",
      });
    } catch {
      // epub.js pode recusar um CFI inválido; ignora.
    }
  }

  /** Remove um grifo do EPUB. */
  removerGrifo(cfiRange: string): void {
    try {
      this.rendition?.annotations?.remove(cfiRange, "highlight");
    } catch {
      // Já pode ter sido removido.
    }
  }

  /** Desenha de novo os grifos guardados (ao abrir ou trocar de página). */
  aplicarGrifos(grifos: { cfiRange: string; cor: string }[]): void {
    for (const g of grifos) this.grifar(g.cfiRange, g.cor);
  }

  /** Limpa a seleção de texto atual dentro do livro. */
  limparSelecao(): void {
    this.ultimaSelecaoPdf = "";
    if (this.formato === "pdf") { window.getSelection()?.removeAllRanges(); return; }
    try {
      for (const c of this.rendition?.getContents?.() ?? []) c?.window?.getSelection?.()?.removeAllRanges?.();
    } catch {
      // Sem seleção para limpar.
    }
  }

  /** Posição atual (CFI no EPUB, página no PDF) — para marcadores e notas. */
  localizacaoAtual(): Localizacao {
    return { ...this.ultimaLoc };
  }

  aoSelecionarTexto(cb: (s: SelecaoTexto) => void): void {
    this.aoSelecionar = cb;
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
    this.textoMontado.clear();
    const escala = zoomPdf(this.config);
    for (let n = 1; n <= this.pdf.numPages; n++) {
      const pagina = await this.pdf.getPage(n);
      const viewport = pagina.getViewport({ scale: escala * 1.5 });
      // Uma "folha" por página: o canvas do PDF e, por cima, a camada da caneta.
      const folha = document.createElement("div");
      folha.className = "leitor-pdf-folha";
      folha.dataset.pagina = String(n);
      folha.style.position = "relative";
      folha.style.margin = "0 auto 0.75rem";
      folha.style.width = `${viewport.width}px`;
      folha.style.maxWidth = "100%";
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      const ctx = canvas.getContext("2d");
      if (ctx) await pagina.render({ canvasContext: ctx, viewport }).promise;
      folha.appendChild(canvas);
      // Grifos (embaixo do texto), o texto invisível que dá para escolher e a caneta (em cima).
      const grifos = document.createElement("div");
      grifos.className = "leitor-pdf-grifos";
      folha.appendChild(grifos);
      const texto = document.createElement("div");
      texto.className = "textLayer leitor-pdf-texto";
      folha.dataset.largura = String(pagina.getViewport({ scale: 1 }).width);
      folha.appendChild(texto);
      folha.appendChild(this.criarCamadaCaneta(n, viewport.width, viewport.height));
      this.container.appendChild(folha);
    }
    this.aplicarModoCaneta();
    this.redesenharTracos();
    this.redesenharGrifosPdf();
    this.ajustarEscalaTexto();
    if (!this.tamanhoObs) {
      this.tamanhoObs = new ResizeObserver(() => this.ajustarEscalaTexto());
      this.tamanhoObs.observe(this.container);
      // Escolher texto no PDF (mouse, dedo ou teclado) vira um grifo, como no EPUB.
      document.addEventListener("selectionchange", this.aoMudarSelecao);
      this.container.addEventListener("pointerup", () => this.agendarSelecaoPdf(60));
      this.container.addEventListener("keyup", () => this.agendarSelecaoPdf(60));
    }
    // A camada de texto de cada página só é montada quando ela chega perto da tela.
    const obsTexto = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) void this.montarTextoPdf(Number((e.target as HTMLElement).dataset.pagina) || 1, e.target as HTMLElement);
      },
      { root: this.container, rootMargin: "600px 0px" },
    );
    this.container.querySelectorAll(".leitor-pdf-folha").forEach((c) => obsTexto.observe(c));
    // Observa qual página está visível, para guardar "onde parei".
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            this.paginaAtual = Number((e.target as HTMLElement).dataset.pagina) || 1;
            this.ultimaLoc = { pdfPagina: this.paginaAtual };
            this.aoMudar(this.ultimaLoc);
          }
        }
      },
      { root: this.container, threshold: 0.5 },
    );
    this.container.querySelectorAll(".leitor-pdf-folha").forEach((c) => obs.observe(c));
  }

  /** O texto da página (invisível, por cima da imagem), para escolher e grifar. */
  private async montarTextoPdf(n: number, folha: HTMLElement): Promise<void> {
    if (!this.pdf || this.textoMontado.has(n)) return;
    this.textoMontado.add(n);
    const camada = folha.querySelector<HTMLElement>(".leitor-pdf-texto");
    if (!camada) return;
    try {
      const pagina = await this.pdf.getPage(n);
      const tl = new pdfjs.TextLayer({ textContentSource: pagina.streamTextContent(), container: camada, viewport: pagina.getViewport({ scale: 1 }) });
      await tl.render();
    } catch {
      // PDF sem texto (digitalizado): dá para ler e usar a caneta, mas não escolher texto.
    }
  }

  /** O texto acompanha o tamanho em que a página aparece na tela. */
  private ajustarEscalaTexto(): void {
    this.container.querySelectorAll<HTMLElement>(".leitor-pdf-folha").forEach((f) => {
      const largura = Number(f.dataset.largura) || 0;
      if (largura && f.clientWidth) f.style.setProperty("--scale-factor", String(f.clientWidth / largura));
    });
  }

  private agendarSelecaoPdf(ms: number): void {
    if (this.formato !== "pdf") return;
    if (this.relogioSelecao) window.clearTimeout(this.relogioSelecao);
    this.relogioSelecao = window.setTimeout(() => this.lerSelecaoPdf(), ms);
  }

  /** Lê a seleção dentro do PDF e avisa (página, texto e retângulos relativos à página). */
  private lerSelecaoPdf(): void {
    if (this.modoCaneta !== "ler") return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { this.ultimaSelecaoPdf = ""; return; }
    const range = sel.getRangeAt(0);
    const inicio = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
    const folha = inicio?.closest?.(".leitor-pdf-folha") as HTMLElement | null;
    if (!folha || !this.container.contains(folha) || !inicio?.closest(".leitor-pdf-texto")) return;
    const caixa = folha.getBoundingClientRect();
    if (!caixa.width || !caixa.height) return;
    const brutos: Retangulo[] = [];
    for (const r of Array.from(range.getClientRects())) {
      const x1 = Math.max(r.left, caixa.left), x2 = Math.min(r.right, caixa.right);
      const y1 = Math.max(r.top, caixa.top), y2 = Math.min(r.bottom, caixa.bottom);
      if (x2 <= x1 || y2 <= y1) continue;
      brutos.push({ x: (x1 - caixa.left) / caixa.width, y: (y1 - caixa.top) / caixa.height, w: (x2 - x1) / caixa.width, h: (y2 - y1) / caixa.height });
    }
    const retangulos = juntarRetangulos(brutos);
    const texto = sel.toString().replace(/\s+/g, " ").trim();
    const pagina = Number(folha.dataset.pagina) || 1;
    if (!texto || !retangulos.length) return;
    const chave = `${pagina}|${texto}|${retangulos.length}`;
    if (chave === this.ultimaSelecaoPdf) return;
    this.ultimaSelecaoPdf = chave;
    this.aoSelecionar({ cfiRange: "", texto, pdf: { pagina, retangulos } });
  }

  /** Desenha os grifos guardados do PDF (troca a lista inteira). */
  desenharGrifosPdf(lista: GrifoPdf[]): void {
    this.grifosPdf = [...lista];
    this.redesenharGrifosPdf();
  }

  /** Acrescenta um grifo ao PDF. */
  grifarPdf(g: GrifoPdf): void {
    this.grifosPdf = [...this.grifosPdf.filter((x) => x.id !== g.id), g];
    this.redesenharGrifosPdf();
  }

  /** Tira um grifo do PDF. */
  removerGrifoPdf(id: string): void {
    this.grifosPdf = this.grifosPdf.filter((x) => x.id !== id);
    this.redesenharGrifosPdf();
  }

  private redesenharGrifosPdf(): void {
    this.container.querySelectorAll<HTMLElement>(".leitor-pdf-folha").forEach((folha) => {
      const camada = folha.querySelector<HTMLElement>(".leitor-pdf-grifos");
      if (!camada) return;
      const pagina = Number(folha.dataset.pagina) || 1;
      camada.replaceChildren(...this.grifosPdf.filter((g) => g.pagina === pagina).flatMap((g) => g.retangulos.map((r) => {
        const d = document.createElement("div");
        d.className = "leitor-pdf-grifo";
        d.dataset.id = g.id;
        Object.assign(d.style, { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, background: g.cor });
        return d;
      })));
    });
  }

  /** A camada SVG onde a caneta desenha, por cima de uma página do PDF. */
  private criarCamadaCaneta(pagina: number, largura: number, altura: number): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.classList.add("leitor-pdf-caneta");
    svg.dataset.pagina = String(pagina);
    svg.setAttribute("viewBox", `0 0 ${largura} ${altura}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.position = "absolute";
    svg.style.inset = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.touchAction = "none";
    this.ligarEventosCaneta(svg, largura, altura);
    return svg;
  }

  private ligarEventosCaneta(svg: SVGSVGElement, largura: number, altura: number): void {
    let atual: SVGPolylineElement | null = null;
    let pontos: { x: number; y: number }[] = [];
    const rel = (ev: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
    };
    const apagarEm = (ev: PointerEvent) => {
      const alvo = ev.target as Element | null;
      const linha = alvo?.closest?.(".traco-guardado") as SVGElement | null;
      const id = linha?.dataset?.id;
      if (id) {
        linha?.remove();
        this.tracosGuardados = this.tracosGuardados.filter((t) => t.id !== id);
        this.aoApagarTraco(id);
      }
    };
    svg.addEventListener("pointerdown", (ev) => {
      if (this.modoCaneta === "ler") return;
      ev.preventDefault();
      svg.setPointerCapture(ev.pointerId);
      if (this.modoCaneta === "borracha") {
        apagarEm(ev);
        return;
      }
      pontos = [rel(ev)];
      atual = document.createElementNS(SVG_NS, "polyline");
      atual.setAttribute("fill", "none");
      atual.setAttribute("stroke", this.corTraco);
      atual.setAttribute("stroke-linecap", "round");
      atual.setAttribute("stroke-linejoin", "round");
      atual.setAttribute("stroke-width", String(this.espessuraTraco * largura));
      atual.setAttribute("stroke-opacity", String(opacidadePara(this.espessuraTraco)));
      svg.appendChild(atual);
    });
    svg.addEventListener("pointermove", (ev) => {
      if (this.modoCaneta === "ler") return;
      if (this.modoCaneta === "borracha") {
        if (ev.buttons) apagarEm(ev);
        return;
      }
      if (!atual) return;
      pontos.push(rel(ev));
      atual.setAttribute("points", pontos.map((p) => `${p.x * largura},${p.y * altura}`).join(" "));
    });
    const terminar = (ev: PointerEvent) => {
      if (!atual) return;
      try {
        svg.releasePointerCapture(ev.pointerId);
      } catch {
        // Sem captura; tudo bem.
      }
      if (pontos.length >= 2) {
        this.aoTracar({
          pagina: Number(svg.dataset.pagina) || 1,
          cor: this.corTraco,
          espessura: this.espessuraTraco,
          pontos: [...pontos],
        });
      }
      // Some o traço "ao vivo"; ele volta já salvo, via desenharTracos.
      atual.remove();
      atual = null;
      pontos = [];
    };
    svg.addEventListener("pointerup", terminar);
    svg.addEventListener("pointercancel", terminar);
  }

  private aplicarModoCaneta(): void {
    const desenhando = this.modoCaneta !== "ler";
    this.container.querySelectorAll<SVGElement>(".leitor-pdf-caneta").forEach((svg) => {
      svg.style.pointerEvents = desenhando ? "auto" : "none";
      svg.style.cursor = this.modoCaneta === "borracha" ? "cell" : desenhando ? "crosshair" : "auto";
    });
  }

  /** Redesenha os traços guardados nas páginas certas. */
  private redesenharTracos(): void {
    this.container.querySelectorAll(".leitor-pdf-caneta .traco-guardado").forEach((n) => n.remove());
    for (const t of this.tracosGuardados) {
      const svg = this.container.querySelector<SVGSVGElement>(`.leitor-pdf-caneta[data-pagina="${t.pagina}"]`);
      if (!svg) continue;
      const vb = svg.viewBox.baseVal;
      const linha = document.createElementNS(SVG_NS, "polyline");
      linha.classList.add("traco-guardado");
      linha.dataset.id = t.id;
      linha.setAttribute("fill", "none");
      linha.setAttribute("stroke", t.cor);
      linha.setAttribute("stroke-linecap", "round");
      linha.setAttribute("stroke-linejoin", "round");
      linha.setAttribute("stroke-width", String(t.espessura * vb.width));
      linha.setAttribute("stroke-opacity", String(opacidadePara(t.espessura)));
      linha.style.pointerEvents = "stroke";
      linha.setAttribute("points", t.pontos.map((p) => `${p.x * vb.width},${p.y * vb.height}`).join(" "));
      svg.appendChild(linha);
    }
  }

  /** Mostra os traços guardados (chamar ao abrir e quando a lista mudar). */
  desenharTracos(tracos: Traco[]): void {
    this.tracosGuardados = [...tracos];
    this.redesenharTracos();
  }

  definirModoCaneta(modo: ModoCaneta): void {
    this.modoCaneta = modo;
    this.aplicarModoCaneta();
  }

  definirCorTraco(cor: string): void {
    this.corTraco = cor;
  }

  definirEspessuraTraco(rel: number): void {
    this.espessuraTraco = rel;
  }

  aoTracarNovo(cb: (t: Omit<Traco, "id">) => void): void {
    this.aoTracar = cb;
  }

  aoApagarTracoGuardado(cb: (id: string) => void): void {
    this.aoApagarTraco = cb;
  }

  private irParaPaginaPdf(n: number): void {
    const alvo = this.container.querySelector<HTMLElement>(`.leitor-pdf-folha[data-pagina="${n}"]`);
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

  // ---------- Busca no livro ----------
  private marcaDaBusca: string | null = null;

  /** Procura no livro (sem diferenciar maiúsculas e acentos). Até `maximo` resultados. */
  async buscar(termo: string, maximo = 100): Promise<ResultadoBusca[]> {
    const alvo = normalizar(termo.trim());
    if (alvo.length < 2) return [];
    const saida: ResultadoBusca[] = [];
    if (this.formato === "epub" && this.book) {
      const itens: any[] = [];
      this.book.spine.each((s: any) => itens.push(s));
      for (const item of itens) {
        if (saida.length >= maximo) break;
        try {
          const raiz: any = await item.load(this.book.load.bind(this.book));
          const corpo: any = raiz?.body ?? raiz?.querySelector?.("body") ?? raiz;
          const doc: Document = corpo?.ownerDocument;
          // Anda pelos textos do capítulo e marca cada ocorrência com o CFI dela.
          const andar = doc.createTreeWalker(corpo, 4);
          let no: Node | null;
          while ((no = andar.nextNode()) && saida.length < maximo) {
            const texto = no.textContent ?? "";
            const base = normalizar(texto);
            let i = base.indexOf(alvo);
            while (i >= 0 && saida.length < maximo) {
              const r = doc.createRange();
              r.setStart(no, i);
              r.setEnd(no, Math.min(texto.length, i + termo.trim().length));
              let destino = "";
              try { destino = item.cfiFromRange(r); } catch { destino = item.href; }
              saida.push({ destino, trecho: trechoEmVolta(texto, i, termo.trim().length), onde: item.href });
              i = base.indexOf(alvo, i + alvo.length);
            }
          }
        } catch {
          // Capítulo que não abre: segue para o próximo.
        } finally {
          item.unload?.();
        }
      }
      return saida;
    }
    if (this.formato === "pdf" && this.pdf) {
      for (let n = 1; n <= this.pdf.numPages && saida.length < maximo; n++) {
        const texto = await this.textoDaPaginaPdf(n);
        const base = normalizar(texto);
        let i = base.indexOf(alvo);
        while (i >= 0 && saida.length < maximo) {
          saida.push({ destino: String(n), trecho: trechoEmVolta(texto, i, termo.trim().length), onde: `p. ${n}` });
          i = base.indexOf(alvo, i + alvo.length);
        }
      }
    }
    return saida;
  }

  /** Vai até um resultado da busca e deixa a palavra marcada (no EPUB). */
  async irParaResultado(r: ResultadoBusca): Promise<void> {
    if (this.formato === "epub" && this.rendition) {
      if (this.marcaDaBusca) { try { this.rendition.annotations.remove(this.marcaDaBusca, "highlight"); } catch { /* já saiu */ } }
      await this.rendition.display(r.destino);
      if (r.destino.startsWith("epubcfi(")) {
        try { this.rendition.annotations.highlight(r.destino, {}, undefined, "leitor-busca-marca", { fill: "#f59e0b", "fill-opacity": "0.35" }); this.marcaDaBusca = r.destino; } catch { /* sem marca */ }
      }
    } else {
      this.irParaPaginaPdf(Number(r.destino) || 1);
    }
  }

  // ---------- Ler em voz alta ----------
  private async textoDaPaginaPdf(n: number): Promise<string> {
    if (!this.pdf) return "";
    const pg = await this.pdf.getPage(n);
    const c = await pg.getTextContent();
    return (c.items as { str?: string; hasEOL?: boolean }[]).map((it) => (it.str ?? "") + (it.hasEOL ? "\n" : "")).join("").replace(/[ \t]+/g, " ").trim();
  }

  /** O texto de onde a pessoa está até o fim do capítulo (EPUB) ou da página (PDF). */
  async textoAPartirDaqui(): Promise<string> {
    if (this.formato === "pdf") return this.textoDaPaginaPdf(this.paginaAtual);
    if (!this.rendition) return "";
    const contents = this.rendition.getContents?.()?.[0];
    const doc: Document | undefined = contents?.document;
    if (!doc?.body) return "";
    const cfi = this.rendition.currentLocation?.()?.start?.cfi;
    try {
      // A posição tem de vir da página aberta (o `book.getRange` daria um ponto numa cópia
      // do capítulo, e o trecho sairia vazio).
      const inicio: Range | null = cfi && typeof contents.range === "function" ? contents.range(cfi) : null;
      if (inicio && inicio.startContainer.ownerDocument === doc) {
        const r = doc.createRange();
        r.setStart(inicio.startContainer, inicio.startOffset);
        r.setEndAfter(doc.body.lastChild ?? doc.body);
        const texto = r.toString().replace(/\s+/g, " ").trim();
        if (texto) return texto;
      }
    } catch { /* sem a posição: lê o capítulo todo */ }
    return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  /** Passa para o próximo capítulo (EPUB) ou página (PDF). False no fim do livro. */
  async avancarParaLer(): Promise<boolean> {
    if (this.formato === "pdf") {
      if (!this.pdf || this.paginaAtual >= this.pdf.numPages) return false;
      this.irParaPaginaPdf(this.paginaAtual + 1);
      return true;
    }
    const idx = this.rendition?.currentLocation?.()?.start?.index;
    const prox = typeof idx === "number" ? this.book?.spine?.get(idx + 1) : null;
    if (!prox) return false;
    await this.rendition.display(prox.href);
    return true;
  }

  // ---------- Régua de leitura ----------
  /** Avisa onde está o ponteiro (y na tela), também dentro da página do EPUB (que é um iframe). */
  aoMoverPonteiro(cb: (yNaTela: number) => void): void {
    this.container.addEventListener("pointermove", (e) => cb(e.clientY));
    if (this.rendition) {
      this.rendition.on("mousemove", (e: MouseEvent, contents: any) => {
        const quadro = contents?.document?.defaultView?.frameElement as HTMLElement | undefined;
        const topo = quadro?.getBoundingClientRect().top ?? 0;
        cb(topo + e.clientY);
      });
    }
  }

  aoMudarLocalizacao(cb: AoMudar): void {
    this.aoMudar = cb;
  }

  destruir(): void {
    document.removeEventListener("selectionchange", this.aoMudarSelecao);
    this.tamanhoObs?.disconnect();
    this.tamanhoObs = null;
    if (this.relogioSelecao) window.clearTimeout(this.relogioSelecao);
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
