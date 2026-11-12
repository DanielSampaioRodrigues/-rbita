// Atalhos do Word no editor (documento, página de texto e caixa de texto), para quem
// já tem a mão acostumada: alinhar, espaçamento entre linhas, tamanho da letra,
// limpar a formatação, subscrito e sobrescrito. Quem trata o atalho aqui "segura" a
// tecla, e o atalho do app (Ctrl+2 = Ideias, Ctrl+Shift+L = claro/escuro) não dispara.
import { Extension, type Editor } from "@tiptap/core";
import { Selection, TextSelection } from "@tiptap/pm/state";
import { lerPt } from "./estilos";

/** Os tamanhos da lista do Word (o "A+" e o "A−" andam por eles). */
export const TAMANHOS_WORD = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];

export function proximoTamanho(atual: number, passo: 1 | -1): number {
  const base = atual || 12;
  return passo > 0 ? TAMANHOS_WORD.find((n) => n > base) ?? Math.min(base + 1, 400) : [...TAMANHOS_WORD].reverse().find((n) => n < base) ?? Math.max(base - 1, 1);
}

const tamanhoDaSelecao = (editor: Editor) => lerPt(String(editor.getAttributes("textStyle").fontSize ?? ""));
const ptCss = (n: number) => `${n}pt`;

function entrelinha(editor: Editor, valor: string): boolean {
  // Um comando de cada vez: sem título na seleção, o do título "falha" e levaria o resto junto.
  editor.chain().focus().updateAttributes("paragraph", { entrelinha: valor }).run();
  editor.chain().updateAttributes("heading", { entrelinha: valor }).run();
  return true;
}
/** O atalho é do editor mesmo quando não muda nada (senão o atalho do app dispararia). */
const sempre = (f: () => unknown) => () => { f(); return true; };

function irPara(editor: Editor, onde: "inicio" | "fim", estender: boolean): boolean {
  const { state, view } = editor;
  const alvo = onde === "inicio" ? Selection.atStart(state.doc) : Selection.atEnd(state.doc);
  const sel = estender ? TextSelection.create(state.doc, state.selection.anchor, alvo.head) : alvo;
  view.dispatch(state.tr.setSelection(sel).scrollIntoView());
  return true;
}

export const AtalhosWord = Extension.create({
  name: "atalhosWord",
  addKeyboardShortcuts() {
    const e = this.editor;
    return {
      // Começo e fim do texto. No documento com páginas, o navegador levava o cursor para o
      // cabeçalho da página (que não é texto) e o que se digitava ia para o fim.
      "Mod-Home": () => irPara(e, "inicio", false),
      "Mod-End": () => irPara(e, "fim", false),
      "Mod-Shift-Home": () => irPara(e, "inicio", true),
      "Mod-Shift-End": () => irPara(e, "fim", true),
      // Alinhamento (Word: Ctrl+E centraliza, Ctrl+L esquerda, Ctrl+R direita, Ctrl+J justifica).
      "Mod-e": sempre(() => e.chain().focus().setTextAlign("center").run()),
      "Mod-l": sempre(() => e.chain().focus().setTextAlign("left").run()),
      "Mod-r": sempre(() => e.chain().focus().setTextAlign("right").run()),
      "Mod-j": sempre(() => e.chain().focus().setTextAlign("justify").run()),
      // Espaçamento entre linhas (Word: Ctrl+1 simples, Ctrl+2 duplo, Ctrl+5 um e meio).
      "Mod-1": () => entrelinha(e, "1"),
      "Mod-2": () => entrelinha(e, "2"),
      "Mod-5": () => entrelinha(e, "1.5"),
      // Tamanho da letra (Word: Ctrl+Shift+> e Ctrl+Shift+< andam pela lista; Ctrl+] e Ctrl+[ de 1 em 1).
      "Mod-Shift->": sempre(() => e.chain().focus().setFontSize(ptCss(proximoTamanho(tamanhoDaSelecao(e), 1))).run()),
      "Mod-Shift-<": sempre(() => e.chain().focus().setFontSize(ptCss(proximoTamanho(tamanhoDaSelecao(e), -1))).run()),
      "Mod-]": sempre(() => e.chain().focus().setFontSize(ptCss(Math.min(400, (tamanhoDaSelecao(e) || 12) + 1))).run()),
      "Mod-[": sempre(() => e.chain().focus().setFontSize(ptCss(Math.max(1, (tamanhoDaSelecao(e) || 12) - 1))).run()),
      // Limpar a formatação do trecho (Word: Ctrl+Espaço).
      "Mod-Space": sempre(() => e.chain().focus().unsetAllMarks().run()),
      // Subscrito e sobrescrito (Word: Ctrl+= e Ctrl+Shift++).
      "Mod-=": sempre(() => e.chain().focus().toggleSubscript().run()),
      "Mod-Shift-+": sempre(() => e.chain().focus().toggleSuperscript().run()),
      "Mod-Shift-=": sempre(() => e.chain().focus().toggleSuperscript().run()),
    };
  },
});
