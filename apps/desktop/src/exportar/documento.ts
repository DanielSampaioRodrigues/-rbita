// Exportar o documento de texto (o editor com páginas): PDF igual às páginas da tela,
// texto simples e Markdown. O Word fica em docx.ts.
import { Editor } from "@tiptap/core";
import { extensoesBase } from "../caderno/editor/extensoes";
import { medirPaginas, type PaginaMedida } from "./medir";

/** Mede as páginas do documento como estão na tela (sem o zoom). */
export async function medirDocumento(pm: HTMLElement, medida: { largura: number; altura: number }): Promise<PaginaMedida[]> {
  await document.fonts.ready;
  const folhas = pm.closest<HTMLElement>(".documento-folhas");
  // O zoom sai só durante a medição (tudo na mesma tarefa: nada pisca na tela).
  const zoomAntes = folhas?.style.zoom ?? "";
  if (folhas) folhas.style.zoom = "1";
  try {
    const caixa = pm.getBoundingClientRect();
    const borda = parseFloat(getComputedStyle(pm).borderTopWidth) || 0;
    const vaos = Array.from(pm.querySelectorAll<HTMLElement>(".rm-pagination-gap"))
      .map((g) => g.getBoundingClientRect())
      .filter((r) => r.height > 0)
      .sort((a, b) => a.top - b.top);
    const topos = [caixa.top + borda, ...vaos.map((v) => v.bottom)];
    const regioes = topos.map((y) => ({ x: caixa.left + borda, y, largura: medida.largura, altura: medida.altura }));
    const paginas = medirPaginas(pm, regioes, 1, medida.largura, medida.altura);
    // Folha branca por baixo de cada página.
    for (const p of paginas) p.itens.unshift({ tipo: "retangulo", x: 0, y: 0, w: p.largura, h: p.altura, cor: { r: 1, g: 1, b: 1, a: 1 } });
    return paginas;
  } finally {
    if (folhas) folhas.style.zoom = zoomAntes;
  }
}

/** Texto simples, com uma linha em branco entre os parágrafos. */
export function textoSimples(html: string): string {
  const ed = new Editor({ extensions: extensoesBase(), content: html || "" });
  try {
    return `${ed.getText({ blockSeparator: "\n\n" }).trim()}\n`;
  } finally {
    ed.destroy();
  }
}

/** Markdown (títulos, listas, negrito, itálico, links, citações). */
export async function markdown(html: string): Promise<string> {
  const { Markdown } = await import("@tiptap/markdown");
  const ed = new Editor({ extensions: [...extensoesBase(), Markdown], content: html || "" });
  try {
    const md = (ed as unknown as { getMarkdown: () => string }).getMarkdown();
    return `${md.trim()}\n`;
  } finally {
    ed.destroy();
  }
}
