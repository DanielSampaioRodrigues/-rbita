// Espaço entre letras (como no Word: Fonte > Avançado > Espaçamento), num trecho.
// Fica no HTML como `letter-spacing` em pt dentro do estilo do texto; o PDF usa o
// espaçamento de verdade (não estica a letra) e o Word recebe em pontos.
import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    espacoLetras: {
      setLetterSpacing: (valor: string) => ReturnType;
      unsetLetterSpacing: () => ReturnType;
    };
  }
}

/** As opções da lista (pt; negativo = condensado). */
export const ESPACOS_LETRAS = [-1.5, -1, -0.5, 0.5, 1, 1.5, 2, 3, 5];

/** "1.5pt" → 1.5; "2px" → 1.5; "normal" → 0. Aceita negativo e decimal. */
export function lerEspaco(v: unknown): number {
  const m = /^\s*(-?[\d.]+)\s*(pt|px|em)?\s*$/.exec(String(v ?? ""));
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 0;
  const pt = m[2] === "px" ? n * 0.75 : m[2] === "em" ? n * 12 : n;
  return Math.round(Math.min(20, Math.max(-5, pt)) * 100) / 100;
}

export const nomeDoEspaco = (pt: number) => (pt === 0 ? "Normal" : `${pt < 0 ? "Condensado" : "Expandido"} ${String(Math.abs(pt)).replace(".", ",")} pt`);

export const EspacoLetras = Extension.create({
  name: "espacoLetras",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: {
        letterSpacing: {
          default: null,
          parseHTML: (el: HTMLElement) => { const pt = lerEspaco(el.style.letterSpacing); return pt ? `${pt}pt` : null; },
          renderHTML: (a: { letterSpacing?: string | null }) => (a.letterSpacing ? { style: `letter-spacing: ${a.letterSpacing}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setLetterSpacing: (valor) => ({ chain }) => chain().setMark("textStyle", { letterSpacing: valor }).run(),
      unsetLetterSpacing: () => ({ chain }) => chain().setMark("textStyle", { letterSpacing: null }).removeEmptyTextStyle().run(),
    };
  },
});
