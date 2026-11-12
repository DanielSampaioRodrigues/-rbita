// Atalhos do caderno no teclado (Windows, Mac e iPad com teclado). Uma lista só: a
// mesma fonte decide a tecla e aparece na janela de atalhos (F1). As letras seguem
// as dos programas da Adobe onde dá (V, L, P, N, B, E, T, U, H) e o português no resto.

export type FerramentaAtalho = "selecao" | "laco" | "caneta" | "lapis" | "pincel" | "marcatexto" | "borracha" | "texto" | "nota" | "forma" | "seta" | "laser";

export type AcaoCaderno =
  | { tipo: "ferramenta"; ferramenta: FerramentaAtalho }
  | { tipo: "maoFixa" }
  | { tipo: "duplicar" }
  | { tipo: "primeira" }
  | { tipo: "ultima" };

/** Letra (sem Ctrl, sem Alt) → ferramenta. Com Shift: as variações. */
const LETRAS: Record<string, FerramentaAtalho> = {
  v: "selecao", l: "laco", p: "caneta", n: "lapis", b: "pincel", m: "marcatexto", e: "borracha", t: "texto", u: "forma", k: "laser",
};
const COM_SHIFT: Record<string, FerramentaAtalho> = { t: "nota", u: "seta" };

/** Tecla apertada fora de campo de texto: o que o caderno faz. Null = nada. */
export function acaoDaTecla(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "repeat">): AcaoCaderno | null {
  if (e.altKey || e.repeat) return null;
  const ctrl = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (ctrl) {
    if (k === "d" && !e.shiftKey) return { tipo: "duplicar" };
    return null;
  }
  if (e.key === "Home") return { tipo: "primeira" };
  if (e.key === "End") return { tipo: "ultima" };
  if (k === "h" && !e.shiftKey) return { tipo: "maoFixa" };
  const f = e.shiftKey ? COM_SHIFT[k] : LETRAS[k];
  return f ? { tipo: "ferramenta", ferramenta: f } : null;
}

/** A tecla é o espaço (para segurar e mover a página com a mão)? */
export const ehEspaco = (e: Pick<KeyboardEvent, "key" | "code">) => e.key === " " || e.code === "Space";

/** Caneta com a ponta de borracha (virada) ou com o botão lateral apertado. */
export function canetaApagando(e: Pick<PointerEvent, "pointerType" | "button" | "buttons">): boolean {
  return e.pointerType === "pen" && (e.button === 5 || e.button === 2 || (e.buttons & 32) !== 0 || (e.buttons & 2) !== 0);
}

/** Para a janela de atalhos (F1). */
export const ATALHOS_CADERNO: { teclas: string[][]; descricao: string }[] = [
  { teclas: [["Espaço"]], descricao: "Segurar e arrastar: mover a página (a mão)" },
  { teclas: [["H"]], descricao: "Mão fixa: arrastar move a página (H ou Esc volta)" },
  { teclas: [["Botão do meio do mouse"]], descricao: "Arrastar: mover a página" },
  { teclas: [["P"]], descricao: "Caneta" },
  { teclas: [["N"]], descricao: "Lápis" },
  { teclas: [["B"]], descricao: "Pincel" },
  { teclas: [["M"]], descricao: "Marca-texto" },
  { teclas: [["E"]], descricao: "Borracha" },
  { teclas: [["T"]], descricao: "Texto" },
  { teclas: [["Shift", "T"]], descricao: "Nota adesiva" },
  { teclas: [["U"]], descricao: "Formas" },
  { teclas: [["Shift", "U"]], descricao: "Seta" },
  { teclas: [["V"]], descricao: "Seleção" },
  { teclas: [["L"]], descricao: "Laço" },
  { teclas: [["K"]], descricao: "Apontador laser" },
  { teclas: [["Ctrl", "Z"]], descricao: "Desfazer" },
  { teclas: [["Ctrl", "Y"], ["Ctrl", "Shift", "Z"]], descricao: "Refazer" },
  { teclas: [["Ctrl", "C"], ["Ctrl", "X"], ["Ctrl", "V"]], descricao: "Copiar, recortar e colar o que está selecionado (também imagens)" },
  { teclas: [["Ctrl", "D"]], descricao: "Duplicar o que está selecionado" },
  { teclas: [["Ctrl", "A"]], descricao: "Selecionar tudo da página (com Seleção ou Laço)" },
  { teclas: [["Delete"]], descricao: "Apagar o que está selecionado" },
  { teclas: [["Setas"]], descricao: "Mover o que está selecionado (Shift: passo maior)" },
  { teclas: [["Ctrl", "G"], ["Ctrl", "Shift", "G"]], descricao: "Agrupar e desagrupar" },
  { teclas: [["Ctrl", "]"], ["Ctrl", "["]], descricao: "Um nível para a frente ou para trás (Shift: para a frente ou para trás de tudo)" },
  { teclas: [["Ctrl", "+"], ["Ctrl", "−"], ["Ctrl", "0"]], descricao: "Aproximar, afastar e voltar a 100%" },
  { teclas: [["Page Down"], ["Page Up"]], descricao: "Próxima página e página anterior" },
  { teclas: [["Home"], ["End"]], descricao: "Primeira e última página" },
  { teclas: [["Esc"]], descricao: "Soltar a seleção, sair da mão fixa ou da tela limpa" },
];

/** Caneta e dedos (iPad, celular e tela de toque). */
export const GESTOS_CADERNO: { gesto: string; descricao: string }[] = [
  { gesto: "Caneta do Windows virada (ponta de borracha) ou com o botão lateral", descricao: "Apagar" },
  { gesto: "Dois dedos, dois toques", descricao: "Desfazer" },
  { gesto: "Três dedos, dois toques", descricao: "Refazer" },
  { gesto: "Um dedo, dois toques", descricao: "Aproximar (de novo: voltar)" },
  { gesto: "Quatro dedos, um toque", descricao: "Esconder e mostrar as barras" },
  { gesto: "Pinça com dois dedos (ou com o polegar)", descricao: "Aproximar e afastar" },
  { gesto: "Arrastar com um dedo (com \"Só a caneta escreve\")", descricao: "Mover a página" },
  { gesto: "Desenhar uma forma e segurar parado no fim", descricao: "Vira a forma perfeita" },
];

/** No editor de texto (documento, página de texto, caixa de texto), como no Word. */
export const ATALHOS_EDITOR: { teclas: string[][]; descricao: string }[] = [
  { teclas: [["Ctrl", "B"], ["Ctrl", "I"], ["Ctrl", "U"]], descricao: "Negrito, itálico e sublinhado" },
  { teclas: [["Ctrl", "E"], ["Ctrl", "L"], ["Ctrl", "R"], ["Ctrl", "J"]], descricao: "Centralizar, à esquerda, à direita e justificar" },
  { teclas: [["Ctrl", "1"], ["Ctrl", "2"], ["Ctrl", "5"]], descricao: "Espaço entre linhas simples, duplo e 1,5" },
  { teclas: [["Ctrl", "Shift", ">"], ["Ctrl", "Shift", "<"]], descricao: "Letra maior e menor" },
  { teclas: [["Ctrl", "]"], ["Ctrl", "["]], descricao: "Letra 1 ponto maior ou menor" },
  { teclas: [["Ctrl", "Espaço"]], descricao: "Limpar a formatação do trecho" },
  { teclas: [["Ctrl", "="], ["Ctrl", "Shift", "+"]], descricao: "Subscrito e sobrescrito" },
  { teclas: [["Shift", "F3"]], descricao: "Minúsculas, Iniciais e MAIÚSCULAS" },
  { teclas: [["Ctrl", "Home"], ["Ctrl", "End"]], descricao: "Começo e fim do texto (com Shift: seleciona até lá)" },
  { teclas: [["Ctrl", "Alt", "1"], ["Ctrl", "Alt", "2"], ["Ctrl", "Alt", "3"]], descricao: "Título 1, 2 e 3" },
  { teclas: [["Ctrl", "Shift", "8"]], descricao: "Lista com marcadores" },
  { teclas: [["Ctrl", "Shift", "7"]], descricao: "Lista numerada" },
];
