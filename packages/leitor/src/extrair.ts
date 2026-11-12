// Tira o texto de um PDF (página por página) e de um EPUB (capítulo por capítulo),
// no aparelho, sem mandar nada para fora. Usado pelas fontes do caderno; serve também
// para o leitor da Arcano 3 e o Escuta.

import ePub from "epubjs";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** O texto de cada página do PDF (página vazia = digitalizada, sem texto). */
export async function extrairTextoPdf(bytes: ArrayBuffer, aoAndar?: (feitas: number, total: number) => void): Promise<string[]> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  const paginas: string[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i);
      const c = await pg.getTextContent();
      let t = "";
      for (const it of c.items as { str?: string; hasEOL?: boolean }[]) {
        if (typeof it.str !== "string") continue;
        t += it.str + (it.hasEOL ? "\n" : "");
      }
      // Hífen de fim de linha volta a juntar a palavra ("neuro-\nnio" → "neuronio").
      paginas.push(t.replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim());
      pg.cleanup();
      aoAndar?.(i, pdf.numPages);
    }
  } finally {
    await pdf.destroy();
  }
  return paginas;
}

/** O texto de cada capítulo do EPUB, na ordem de leitura. */
export async function extrairTextoEpub(bytes: ArrayBuffer): Promise<{ titulo: string; texto: string }[]> {
  // epub.js tem tipos incompletos: tratado de forma solta.
  const livro: any = ePub(bytes.slice(0));
  await livro.ready;
  const capitulos: { titulo: string; texto: string }[] = [];
  const nomes = new Map<string, string>();
  try {
    const nav = await livro.loaded.navigation;
    const andar = (itens: any[]) => itens?.forEach((i) => { if (i?.href) nomes.set(String(i.href).split("#")[0], String(i.label ?? "").trim()); andar(i?.subitems ?? []); });
    andar(nav?.toc ?? []);
  } catch { /* sem sumário */ }
  const secoes: any[] = [];
  livro.spine.each((s: any) => secoes.push(s));
  try {
    for (const s of secoes) {
      try {
        // epub.js devolve o elemento <html> do capítulo (não o Document).
        const raiz: any = await s.load(livro.load.bind(livro));
        const corpo: Element | undefined = raiz?.body ?? raiz?.querySelector?.("body") ?? raiz?.documentElement ?? raiz;
        // Quebra de linha entre os blocos (o textContent junta tudo).
        corpo?.querySelectorAll?.("p, h1, h2, h3, h4, h5, h6, li, br, div, tr").forEach((e: Element) => e.append("\n"));
        const texto = (corpo?.textContent ?? "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
        if (texto) capitulos.push({ titulo: nomes.get(s.href) ?? "", texto });
      } catch { /* capítulo que não abre */ } finally {
        s.unload?.();
      }
    }
  } finally {
    await Promise.resolve(livro.ready).catch(() => undefined);
    livro.destroy?.();
  }
  return capitulos;
}

/** Desenha uma página do PDF num canvas (para mostrar de onde veio a citação). */
export async function desenharPaginaPdf(bytes: ArrayBuffer, n: number, largura: number): Promise<{ canvas: HTMLCanvasElement; total: number }> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  try {
    const total = pdf.numPages;
    const pg = await pdf.getPage(Math.min(Math.max(1, n), total));
    const base = pg.getViewport({ scale: 1 });
    const escala = (largura / base.width) * (globalThis.devicePixelRatio || 1);
    const vista = pg.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vista.width);
    canvas.height = Math.round(vista.height);
    canvas.style.width = `${largura}px`;
    await pg.render({ canvasContext: canvas.getContext("2d")!, viewport: vista, canvas } as any).promise;
    return { canvas, total };
  } finally {
    await pdf.destroy();
  }
}

/** Abre o PDF uma vez para desenhar várias páginas (importar no caderno). */
export async function abrirPdf(bytes: ArrayBuffer): Promise<{ total: number; desenhar: (n: number, larguraPx: number) => Promise<{ canvas: HTMLCanvasElement; largura: number; altura: number }>; fechar: () => Promise<void> }> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  return {
    total: pdf.numPages,
    async desenhar(n, larguraPx) {
      const pg = await pdf.getPage(n);
      const base = pg.getViewport({ scale: 1 });
      const vista = pg.getViewport({ scale: larguraPx / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vista.width);
      canvas.height = Math.round(vista.height);
      const ctx = canvas.getContext("2d")!;
      // Fundo branco (PDF sem fundo ficaria transparente e o JPEG sairia preto).
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pg.render({ canvasContext: ctx, viewport: vista, canvas } as any).promise;
      pg.cleanup();
      return { canvas, largura: base.width, altura: base.height };
    },
    fechar: () => pdf.destroy(),
  };
}
