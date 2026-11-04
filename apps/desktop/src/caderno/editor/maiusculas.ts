// Maiúsculas e minúsculas (como o "Aa" do Word): muda a caixa do texto escolhido
// sem mexer na formatação, e o versalete (letras maiúsculas pequenas).
// A conta é pura (`mudarCaixa`), testada à parte; o comando aplica no editor.
import { Extension, Mark, type Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

export type Caixa = "maiusculas" | "minusculas" | "frase" | "iniciais" | "inverter";

const LOCAL = "pt-BR";
const LETRA = /[\p{L}\p{N}]/u;
const FIM_DE_FRASE = /[.!?…]/;
/** Palavras que ficam minúsculas no meio de um título em português. */
const MIUDAS = new Set(["a", "à", "ao", "aos", "as", "às", "com", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os", "ou", "para", "pela", "pelas", "pelo", "pelos", "por", "sem", "sob", "sobre", "um", "uma", "umas", "uns"]);

/**
 * Muda a caixa de um trecho. `antes` é o texto que vem antes dele no mesmo
 * parágrafo (para saber se o trecho começa uma frase ou fica no meio de uma palavra).
 * Devolve um pedaço por letra de entrada (uma letra pode virar duas, como "ß" → "SS").
 */
export function mudarCaixaLetras(texto: string, caixa: Caixa, antes = ""): string[] {
  const letras = Array.from(texto);
  const saida: string[] = [];
  // Contexto: início de frase e início de palavra, a partir do que vem antes.
  let inicioFrase = !/\S/.test(antes) || FIM_DE_FRASE.test(antes.trimEnd().slice(-1));
  let anterior = antes.slice(-1);
  // Para as iniciais: a palavra inteira (para saber se é "de", "da"...).
  const palavraEm = (i: number) => {
    let a = i; let b = i;
    while (a > 0 && LETRA.test(letras[a - 1])) a--;
    while (b < letras.length && LETRA.test(letras[b])) b++;
    const inicio = a === 0 ? (antes.match(/[\p{L}\p{N}]+$/u)?.[0] ?? "") : "";
    return (inicio + letras.slice(a, b).join("")).toLocaleLowerCase(LOCAL);
  };
  let primeiraPalavra = inicioFrase;
  for (let i = 0; i < letras.length; i++) {
    const l = letras[i];
    const ehLetra = LETRA.test(l);
    const comecaPalavra = ehLetra && !LETRA.test(anterior) && anterior !== "'" && anterior !== "’";
    let nova = l;
    if (caixa === "maiusculas") nova = l.toLocaleUpperCase(LOCAL);
    else if (caixa === "minusculas") nova = l.toLocaleLowerCase(LOCAL);
    else if (caixa === "inverter") nova = l === l.toLocaleUpperCase(LOCAL) ? l.toLocaleLowerCase(LOCAL) : l.toLocaleUpperCase(LOCAL);
    else if (caixa === "frase") {
      nova = ehLetra && inicioFrase ? l.toLocaleUpperCase(LOCAL) : l.toLocaleLowerCase(LOCAL);
      if (ehLetra) inicioFrase = false;
    } else if (caixa === "iniciais") {
      if (comecaPalavra) {
        const miuda = !primeiraPalavra && MIUDAS.has(palavraEm(i));
        nova = miuda ? l.toLocaleLowerCase(LOCAL) : l.toLocaleUpperCase(LOCAL);
        primeiraPalavra = false;
      } else nova = l.toLocaleLowerCase(LOCAL);
    }
    // Depois de um ponto, a palavra seguinte começa uma frase (também nas iniciais).
    if (FIM_DE_FRASE.test(l)) { inicioFrase = true; primeiraPalavra = true; }
    anterior = l;
    saida.push(nova);
  }
  return saida;
}

export const mudarCaixa = (texto: string, caixa: Caixa, antes = "") => mudarCaixaLetras(texto, caixa, antes).join("");

/** Próxima caixa no atalho Shift + F3: minúsculas → Iniciais → MAIÚSCULAS → minúsculas. */
export function proximaCaixa(texto: string): Caixa {
  const so = texto.replace(/[^\p{L}]/gu, "");
  if (!so) return "maiusculas";
  if (so === so.toLocaleLowerCase(LOCAL)) return "iniciais";
  if (so === so.toLocaleUpperCase(LOCAL)) return "minusculas";
  if (mudarCaixa(texto, "iniciais") === texto) return "maiusculas";
  return "minusculas";
}

/** O trecho a mudar: a seleção ou, sem seleção, a palavra em que está o cursor (como no Word). */
function trecho(editor: Editor): { de: number; ate: number } | null {
  const { from, to, empty, $from } = editor.state.selection;
  if (!empty) return { de: from, ate: to };
  const bloco = $from.parent;
  if (!bloco.isTextblock) return null;
  const texto = bloco.textBetween(0, bloco.content.size, undefined, "￼");
  let a = $from.parentOffset; let b = a;
  while (a > 0 && LETRA.test(texto[a - 1])) a--;
  while (b < texto.length && LETRA.test(texto[b])) b++;
  if (a === b) return null;
  const inicio = $from.start();
  return { de: inicio + a, ate: inicio + b };
}

/** Muda a caixa do trecho escolhido, parágrafo por parágrafo, sem tirar a formatação. */
export function aplicarCaixa(editor: Editor, caixa: Caixa | "alternar"): boolean {
  const alvo = trecho(editor);
  if (!alvo) return false;
  const { state } = editor;
  const tr = state.tr;
  const modo = caixa === "alternar" ? proximaCaixa(state.doc.textBetween(alvo.de, alvo.ate, " ")) : caixa;
  const trocas: { de: number; ate: number; texto: string; marcas: readonly import("@tiptap/pm/model").Mark[] }[] = [];
  state.doc.nodesBetween(alvo.de, alvo.ate, (no, pos) => {
    if (!no.isTextblock) return true;
    // O texto do parágrafo, com cada peça (texto ou não) ocupando o seu lugar.
    let antes = "";
    no.forEach((filho, desloc) => {
      const p = pos + 1 + desloc;
      if (!filho.isText || !filho.text) { antes += "￼"; return; }
      const de = Math.max(p, alvo.de); const ate = Math.min(p + filho.nodeSize, alvo.ate);
      if (de < ate) {
        const pedaco = filho.text.slice(de - p, ate - p);
        const contexto = antes + filho.text.slice(0, de - p);
        const novo = mudarCaixa(pedaco, modo, contexto);
        if (novo !== pedaco) trocas.push({ de, ate, texto: novo, marcas: filho.marks });
      }
      antes += filho.text;
    });
    return false;
  });
  if (!trocas.length) return true;
  // De trás para frente: as posições de antes não andam.
  for (const tc of trocas.reverse()) tr.replaceWith(tc.de, tc.ate, state.schema.text(tc.texto, tc.marcas));
  const ate = tr.mapping.map(alvo.ate);
  if (!state.selection.empty) tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(alvo.de, -1), ate));
  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
}

/** Versalete: letras maiúsculas pequenas (fica no HTML como `font-variant: small-caps`). */
export const Versalete = Mark.create({
  name: "versalete",
  parseHTML() {
    return [
      { tag: "span.versalete" },
      { style: "font-variant", getAttrs: (v) => (/small-caps/.test(String(v)) ? null : false) },
      { style: "font-variant-caps", getAttrs: (v) => (/small-caps/.test(String(v)) ? null : false) },
    ];
  },
  renderHTML() {
    return ["span", { class: "versalete", style: "font-variant: small-caps" }, 0];
  },
});

/** Atalho do Word: Shift + F3 passa por minúsculas, Iniciais e MAIÚSCULAS. */
export const AtalhoCaixa = Extension.create({
  name: "atalhoCaixa",
  addKeyboardShortcuts() {
    return { "Shift-F3": () => aplicarCaixa(this.editor, "alternar") };
  },
});
