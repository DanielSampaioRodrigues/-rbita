// Fontes do editor de texto: as das normas acadêmicas (ABNT e APA), as do Órbita
// (leitura e dislexia), algumas a mais (todas de licença livre, que vão junto com o
// app) e as instaladas no aparelho. No Windows, a lista do aparelho vem do Rust
// (todas as fontes instaladas); no navegador, que não deixa listar, o editor confere
// uma lista das fontes que costumam vir no iPad, no Mac, no Windows e no Android.
import { api, noApp } from "../../api";
import { FONTES } from "../../preferencias";
import { semAcento } from "./estilos";

export type GrupoFonte = "normas" | "orbita" | "mais" | "aparelho";
export interface FonteDoc {
  /** Nome mostrado (e a primeira família do CSS). */
  nome: string;
  /** Pilha do CSS, com as substitutas de mesma medida quando há. */
  css: string;
  grupo: GrupoFonte;
  /** Nota curta ao lado do nome ("ABNT e APA", "à mão"...). */
  nota?: string;
}

const N = (nome: string, css: string, nota?: string): FonteDoc => ({ nome, css, grupo: "normas", nota });
const M = (nome: string, css: string, nota?: string): FonteDoc => ({ nome, css, grupo: "mais", nota });

/** As das normas. As substitutas (Tinos, Arimo, Carlito, Gelasio) têm as mesmas medidas:
 *  num aparelho sem a original, o texto quebra nas mesmas linhas e páginas. */
export const FONTES_NORMAS: FonteDoc[] = [
  N("Times New Roman", '"Times New Roman", Times, Tinos, serif', "ABNT e APA"),
  N("Arial", "Arial, Helvetica, Arimo, sans-serif", "ABNT e APA"),
  N("Calibri", "Calibri, Carlito, sans-serif", "APA"),
  N("Georgia", "Georgia, Gelasio, serif", "APA"),
];

/** As que vão junto com o app (arquivos em fontes/documento.css). */
export const FONTES_MAIS: FonteDoc[] = [
  M("Cambria", "Cambria, Caladea, serif"),
  M("EB Garamond", '"EB Garamond Variable", "EB Garamond", Garamond, serif', "livro"),
  M("Source Serif 4", '"Source Serif 4 Variable", "Source Serif 4", serif'),
  M("Merriweather", "Merriweather, serif", "tela"),
  M("Lora", '"Lora Variable", Lora, serif'),
  M("Playfair Display", '"Playfair Display Variable", "Playfair Display", serif', "títulos"),
  M("Roboto", '"Roboto Variable", Roboto, sans-serif'),
  M("Open Sans", '"Open Sans Variable", "Open Sans", sans-serif'),
  M("Source Sans 3", '"Source Sans 3 Variable", "Source Sans 3", sans-serif'),
  M("Lato", "Lato, sans-serif"),
  M("Montserrat", '"Montserrat Variable", Montserrat, sans-serif', "títulos"),
  M("Caveat", '"Caveat Variable", Caveat, cursive', "à mão"),
  M("Patrick Hand", '"Patrick Hand", cursive', "letra de forma"),
  M("Courier Prime", '"Courier Prime", "Courier New", monospace', "máquina de escrever"),
  M("Courier New", '"Courier New", Courier, Cousine, monospace', "máquina de escrever"),
];

export const FONTES_ORBITA: FonteDoc[] = Object.values(FONTES).map((f) => ({ nome: f.nome, css: f.css, grupo: "orbita" as const }));

/** Fontes que costumam vir instaladas (o navegador não deixa listar; confere uma a uma). */
export const CONHECIDAS = [
  // iPad e Mac
  "Academy Engraved LET", "American Typewriter", "Apple Chancery", "Arial Black", "Arial Narrow", "Arial Rounded MT Bold", "Avenir", "Avenir Next", "Avenir Next Condensed",
  "Baskerville", "Big Caslon", "Bodoni 72", "Bodoni 72 Oldstyle", "Bodoni 72 Smallcaps", "Bradley Hand", "Brush Script MT", "Chalkboard SE", "Chalkduster", "Charter", "Cochin",
  "Comic Sans MS", "Copperplate", "Courier", "Didot", "DIN Alternate", "DIN Condensed", "Futura", "Geneva", "Gill Sans", "Helvetica", "Helvetica Neue", "Herculanum", "Hoefler Text",
  "Impact", "Iowan Old Style", "Lucida Grande", "Luminari", "Marker Felt", "Menlo", "Monaco", "Noteworthy", "Optima", "Palatino", "Papyrus", "Party LET", "Phosphate", "Rockwell",
  "Savoye LET", "Skia", "Snell Roundhand", "Tahoma", "Times", "Trattatello", "Trebuchet MS", "Verdana", "Zapfino",
  // Windows e Office
  "Agency FB", "Aptos", "Aptos Display", "Bahnschrift", "Baskerville Old Face", "Bierstadt", "Bodoni MT", "Book Antiqua", "Bookman Old Style", "Bradley Hand ITC", "Calibri Light",
  "Calisto MT", "Candara", "Cascadia Code", "Cascadia Mono", "Century", "Century Gothic", "Century Schoolbook", "Consolas", "Constantia", "Corbel", "Edwardian Script ITC",
  "Franklin Gothic Medium", "Freestyle Script", "Gabriola", "Garamond", "Gill Sans MT", "Goudy Old Style", "Grandview", "Ink Free", "Lucida Bright", "Lucida Calligraphy",
  "Lucida Console", "Lucida Handwriting", "Lucida Sans Unicode", "Microsoft Sans Serif", "Mistral", "Monotype Corsiva", "MV Boli", "Palatino Linotype", "Perpetua", "Seaford",
  "Segoe Print", "Segoe Script", "Segoe UI", "Sitka Text", "Skeena", "Stencil", "Sylfaen", "Tenorite", "Tw Cen MT",
  // Android, ChromeOS e Linux
  "Noto Sans", "Noto Serif", "Droid Sans", "Droid Serif", "DejaVu Sans", "DejaVu Serif", "DejaVu Sans Mono", "Liberation Sans", "Liberation Serif", "Liberation Mono", "Ubuntu", "Cantarell",
];

/** Primeira família de uma pilha do CSS, sem aspas. */
export function primeiraFamilia(css: string): string {
  const m = /^\s*(?:"([^"]+)"|'([^']+)'|([^,]+))/.exec(css);
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? "").trim();
}

/** Família genérica de reserva, pelo nome (se a fonte faltar em outro aparelho). */
export function generica(nome: string): string {
  if (/mono|courier|consol|menlo|monaco|code\b|typewriter/i.test(nome)) return "monospace";
  if (/script|hand|chancery|corsiva|brush|zapfino|snell|savoye|calligraph|marker|noteworthy|chalk|ink free|segoe print/i.test(nome)) return "cursive";
  if (/sans/i.test(nome)) return "sans-serif";
  if (/serif|times|garamond|georgia|roman|book|baskerville|didot|bodoni|palatino|cambria|caslon|minion|hoefler|cochin|charter|iowan|century|constantia|perpetua|goudy|calisto|sylfaen|sitka|literata|bright/i.test(nome)) return "serif";
  return "sans-serif";
}

/** Pilha do CSS para uma fonte do aparelho. */
export const cssDoAparelho = (nome: string) => `"${nome.replace(/["\\]/g, "")}", ${generica(nome)}`;

/** A fonte da lista que corresponde ao CSS guardado no texto (pela primeira família). */
export function acharFonte(lista: FonteDoc[], css: string): FonteDoc | undefined {
  const alvo = primeiraFamilia(css).toLowerCase();
  if (!alvo) return undefined;
  return lista.find((f) => primeiraFamilia(f.css).toLowerCase() === alvo || f.nome.toLowerCase() === alvo);
}

/** Junta as listas, tirando do grupo do aparelho o que já está em outro grupo. */
export function montarLista(doAparelho: string[]): FonteDoc[] {
  const fixas = [...FONTES_NORMAS, ...FONTES_ORBITA, ...FONTES_MAIS];
  const usados = new Set(fixas.flatMap((f) => [f.nome.toLowerCase(), primeiraFamilia(f.css).toLowerCase()]));
  // As substitutas de mesma medida não aparecem sozinhas (já estão por trás das originais).
  for (const s of ["tinos", "arimo", "carlito", "gelasio", "caladea", "cousine"]) usados.add(s);
  const aparelho: FonteDoc[] = [];
  for (const bruto of doAparelho) {
    const nome = bruto.trim();
    if (!nome || usados.has(nome.toLowerCase())) continue;
    usados.add(nome.toLowerCase());
    aparelho.push({ nome, css: cssDoAparelho(nome), grupo: "aparelho" });
  }
  aparelho.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
  return [...fixas, ...aparelho];
}

/** Filtro da busca: sem ligar para acentos e maiúsculas. */
export const casa = (nome: string, busca: string) => semAcento(nome).includes(semAcento(busca.trim()));

let tela: CanvasRenderingContext2D | null | undefined;
/** A fonte está instalada? (Mede um texto com ela e com as genéricas: se muda, existe.) */
export function temFonte(nome: string): boolean {
  if (tela === undefined) {
    try { tela = document.createElement("canvas").getContext("2d"); } catch { tela = null; }
  }
  if (!tela) return false;
  const amostra = "mmmmmmmmmmlliWWQ@#0123abcçãéÁ";
  const n = nome.replace(/["\\]/g, "");
  for (const base of ["monospace", "serif", "sans-serif"]) {
    tela.font = `72px ${base}`;
    const a = tela.measureText(amostra).width;
    tela.font = `72px "${n}", ${base}`;
    if (tela.measureText(amostra).width !== a) return true;
  }
  return false;
}

let doAparelho: Promise<string[]> | null = null;
/** Fontes do aparelho (lidas uma vez por sessão). */
export function fontesDoAparelho(): Promise<string[]> {
  doAparelho ??= (async () => {
    if (noApp) {
      try { const l = await api.listarFontesSistema(); if (l.length) return l; } catch { /* confere a lista conhecida */ }
    }
    return CONHECIDAS.filter(temFonte);
  })();
  return doAparelho;
}

type JanelaComFontes = Window & { queryLocalFonts?: () => Promise<{ family: string }[]> };
/** No Chrome e no Edge do computador, dá para pedir a lista completa (o navegador pergunta antes). */
export const podePedirFontes = () => !noApp && typeof (window as JanelaComFontes).queryLocalFonts === "function";
export async function pedirFontesDoComputador(): Promise<string[]> {
  const q = (window as JanelaComFontes).queryLocalFonts;
  if (!q) return [];
  const lista = await q.call(window);
  const nomes = [...new Set(lista.map((f) => f.family))];
  const antes = await fontesDoAparelho();
  const tudo = [...new Set([...antes, ...nomes])];
  doAparelho = Promise.resolve(tudo);
  return tudo;
}
