// Sumário automático (como no Word): um bloco no texto feito a partir dos títulos, com
// o número da página no documento paginado. É um bloco fechado (não se digita dentro);
// "Atualizar o sumário" refaz a lista. Vai para o PDF, o Word e o Markdown.
import { Node, type Editor } from "@tiptap/core";

export interface ItemSumario { nivel: number; texto: string; pagina: number }

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sumario: {
      /** Põe o sumário onde está o cursor (ou atualiza o que já existe). */
      porSumario: (itens: ItemSumario[]) => ReturnType;
    };
  }
}

const lerItens = (bruto: string | null): ItemSumario[] => {
  try {
    const v = JSON.parse(bruto ?? "[]");
    return Array.isArray(v) ? v.filter((i) => i && typeof i.texto === "string").map((i) => ({ nivel: Math.min(3, Math.max(1, Number(i.nivel) || 1)), texto: String(i.texto).slice(0, 300), pagina: Math.max(0, Number(i.pagina) || 0) })) : [];
  } catch { return []; }
};

export const TITULO_SUMARIO = "SUMÁRIO";

export const Sumario = Node.create({
  name: "sumario",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      itens: {
        default: [] as ItemSumario[],
        parseHTML: (el: HTMLElement) => lerItens(el.getAttribute("data-sumario")),
        renderHTML: (a: { itens?: ItemSumario[] }) => ({ "data-sumario": JSON.stringify(a.itens ?? []) }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "nav[data-sumario]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const itens = (node.attrs.itens as ItemSumario[]) ?? [];
    return [
      "nav", { ...HTMLAttributes, class: "sumario", "aria-label": "Sumário" },
      ["p", { class: "sumario-titulo" }, TITULO_SUMARIO],
      ...itens.map((i) => [
        "p", { class: `sumario-item nivel-${i.nivel}` },
        ["span", { class: "sumario-texto" }, i.texto],
        ["span", { class: "sumario-pontos", "aria-hidden": "true" }],
        ["span", { class: "sumario-pagina" }, i.pagina ? String(i.pagina) : ""],
      ]),
    ];
  },
  renderText({ node }) {
    const itens = (node.attrs.itens as ItemSumario[]) ?? [];
    return [TITULO_SUMARIO, ...itens.map((i) => `${"  ".repeat(i.nivel - 1)}${i.texto}${i.pagina ? ` ... ${i.pagina}` : ""}`)].join("\n");
  },
  // Markdown: uma lista com o número da página.
  renderMarkdown: (node: { attrs?: { itens?: ItemSumario[] } }) => {
    const itens = node.attrs?.itens ?? [];
    return `**${TITULO_SUMARIO}**\n\n${itens.map((i) => `${"  ".repeat(i.nivel - 1)}- ${i.texto}${i.pagina ? ` — ${i.pagina}` : ""}`).join("\n")}\n`;
  },
  addCommands() {
    return {
      porSumario: (itens) => ({ state, tr, dispatch }) => {
        let pos = -1;
        state.doc.descendants((n, p) => { if (pos < 0 && n.type.name === "sumario") pos = p; return pos < 0; });
        if (!dispatch) return true;
        if (pos >= 0) tr.setNodeMarkup(pos, undefined, { itens });
        else tr.replaceSelectionWith(this.type.create({ itens }));
        dispatch(tr);
        return true;
      },
    };
  },
} as Parameters<typeof Node.create>[0]);

/** A página de um ponto (topo na tela), pelas marcas de fim de página da paginação. 0 = sem páginas. */
export function paginaDoTopo(topo: number, finsDePagina: number[]): number {
  if (!finsDePagina.length) return 0;
  return 1 + finsDePagina.filter((f) => f < topo).length;
}

/** Os títulos (até o nível 3) do documento, com a página de cada um. */
export function itensDoSumario(editor: Editor): ItemSumario[] {
  const fins = [...editor.view.dom.querySelectorAll(".breaker")].map((e) => e.getBoundingClientRect().top);
  const itens: ItemSumario[] = [];
  editor.state.doc.descendants((n, pos) => {
    if (n.type.name === "sumario") return false;
    if (n.type.name !== "heading") return true;
    const nivel = Number(n.attrs.level) || 1;
    const texto = n.textContent.trim();
    if (nivel > 3 || !texto) return false;
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    const topo = dom?.getBoundingClientRect?.().top ?? 0;
    itens.push({ nivel, texto, pagina: paginaDoTopo(topo, fins) });
    return false;
  });
  return itens;
}

/** Põe ou atualiza o sumário. Duas passadas: pôr o sumário empurra os títulos de página. */
export async function porOuAtualizarSumario(editor: Editor): Promise<number> {
  const primeiros = itensDoSumario(editor);
  // Sem títulos ainda: não põe um sumário vazio.
  if (!primeiros.length) return 0;
  editor.chain().focus().porSumario(primeiros).run();
  await new Promise((ok) => setTimeout(ok, 180));
  const itens = itensDoSumario(editor);
  editor.commands.porSumario(itens);
  return itens.length;
}
