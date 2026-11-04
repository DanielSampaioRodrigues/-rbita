// Estilos do editor de texto (puros, testáveis): estilos de parágrafo (como no Word),
// conjuntos de estilo do documento (ABNT, APA...) e as margens prontas.

/** Estilos de parágrafo oferecidos. "p" é o texto normal. */
export type EstiloParagrafo = "p" | "titulo" | "subtitulo" | "h1" | "h2" | "h3" | "citacao" | "legenda" | "destaque";
export const ESTILOS_PARAGRAFO: EstiloParagrafo[] = ["p", "titulo", "subtitulo", "h1", "h2", "h3", "citacao", "legenda", "destaque"];

/** Conjuntos de estilo do documento: fonte, tamanho, entrelinha e o jeito dos títulos. */
export type ConjuntoEstilo = "orbita" | "abnt" | "apa" | "classico" | "moderno" | "leitura";
export interface DadosConjunto {
  fonte: string;
  /** Tamanho do texto, em pt. */
  tamanho: number;
  entrelinha: number;
  /** Recuo da primeira linha do parágrafo, em cm (0 = sem). */
  recuoPrimeira: number;
  /** Espaço depois do parágrafo, em em. */
  espacoDepois: number;
  alinhamento: "left" | "justify";
  titulosMaiusculos: boolean;
  fonteTitulos?: string;
  margens: Margens;
}
export interface Margens { topo: number; baixo: number; esquerda: number; direita: number }

const SERIFA = '"Times New Roman", Times, Tinos, serif';
const SEM_SERIFA = 'Arial, Helvetica, Arimo, sans-serif';

/** cm → px a 96 dpi. */
export const cm = (n: number) => Math.round((n * 96) / 2.54);

export const MARGENS: Record<"normal" | "abnt" | "estreita" | "larga", Margens> = {
  normal: { topo: 2.5, baixo: 2.5, esquerda: 2.5, direita: 2.5 },
  // ABNT (NBR 14724): superior e esquerda 3 cm, inferior e direita 2 cm.
  abnt: { topo: 3, baixo: 2, esquerda: 3, direita: 2 },
  estreita: { topo: 1.27, baixo: 1.27, esquerda: 1.27, direita: 1.27 },
  larga: { topo: 2.54, baixo: 2.54, esquerda: 5.08, direita: 5.08 },
};

export const CONJUNTOS: Record<ConjuntoEstilo, DadosConjunto> = {
  orbita: { fonte: "", tamanho: 12, entrelinha: 1.5, recuoPrimeira: 0, espacoDepois: 0.6, alinhamento: "left", titulosMaiusculos: false, margens: MARGENS.normal },
  // ABNT: Times ou Arial 12, entrelinha 1,5, recuo de 1,25 cm, justificado, títulos de seção em maiúsculas.
  abnt: { fonte: SERIFA, tamanho: 12, entrelinha: 1.5, recuoPrimeira: 1.25, espacoDepois: 0, alinhamento: "justify", titulosMaiusculos: true, margens: MARGENS.abnt },
  // APA 7: fonte legível 12, espaço duplo, recuo de 1,27 cm, alinhado à esquerda.
  apa: { fonte: SERIFA, tamanho: 12, entrelinha: 2, recuoPrimeira: 1.27, espacoDepois: 0, alinhamento: "left", titulosMaiusculos: false, margens: { topo: 2.54, baixo: 2.54, esquerda: 2.54, direita: 2.54 } },
  classico: { fonte: 'Georgia, Gelasio, "Times New Roman", serif', tamanho: 12, entrelinha: 1.45, recuoPrimeira: 0.75, espacoDepois: 0.3, alinhamento: "justify", titulosMaiusculos: false, margens: MARGENS.normal },
  moderno: { fonte: SEM_SERIFA, tamanho: 11, entrelinha: 1.5, recuoPrimeira: 0, espacoDepois: 0.8, alinhamento: "left", titulosMaiusculos: false, fonteTitulos: SEM_SERIFA, margens: MARGENS.normal },
  // Leitura confortável (dislexia e leitura longa): fonte do app, letra maior, mais espaço.
  leitura: { fonte: "", tamanho: 14, entrelinha: 1.8, recuoPrimeira: 0, espacoDepois: 1, alinhamento: "left", titulosMaiusculos: false, margens: MARGENS.normal },
};

/** Variáveis CSS do conjunto (aplicadas na raiz do documento). */
export function varsDoConjunto(c: DadosConjunto): Record<string, string> {
  return {
    "--doc-fonte": c.fonte || "var(--fonte-texto)",
    "--doc-fonte-titulos": c.fonteTitulos || c.fonte || "var(--fonte-texto)",
    "--doc-tamanho": `${c.tamanho}pt`,
    "--doc-entrelinha": String(c.entrelinha),
    "--doc-recuo": `${c.recuoPrimeira}cm`,
    "--doc-espaco-depois": `${c.espacoDepois}em`,
    "--doc-alinhamento": c.alinhamento,
    "--doc-titulos-caixa": c.titulosMaiusculos ? "uppercase" : "none",
  };
}

/** Configuração da página do documento (guardada na folha da página). */
export interface ConfigDocumento {
  tamanho: "a4" | "a5" | "carta";
  margens: Margens;
  conjunto: ConjuntoEstilo;
  cabecalho: string;
  rodape: string;
  /** Onde fica o número da página. */
  numero: "nenhum" | "baixo-direita" | "baixo-centro" | "cima-direita";
}
export const CONFIG_PADRAO: ConfigDocumento = { tamanho: "a4", margens: MARGENS.normal, conjunto: "orbita", cabecalho: "", rodape: "", numero: "baixo-direita" };

const MEDIDAS = { a4: { largura: 794, altura: 1123 }, a5: { largura: 559, altura: 794 }, carta: { largura: 816, altura: 1056 } };
export const medidaDocumento = (t: ConfigDocumento["tamanho"]) => MEDIDAS[t] ?? MEDIDAS.a4;

export function lerConfigDocumento(bruto: unknown): ConfigDocumento {
  const b = (bruto && typeof bruto === "object" ? bruto : {}) as Partial<ConfigDocumento>;
  const conjunto = b.conjunto && b.conjunto in CONJUNTOS ? b.conjunto : CONFIG_PADRAO.conjunto;
  const m = b.margens;
  const num = (v: unknown, p: number) => (typeof v === "number" && v >= 0 && v <= 10 ? v : p);
  return {
    tamanho: b.tamanho === "a5" || b.tamanho === "carta" ? b.tamanho : "a4",
    margens: m ? { topo: num(m.topo, 2.5), baixo: num(m.baixo, 2.5), esquerda: num(m.esquerda, 2.5), direita: num(m.direita, 2.5) } : CONJUNTOS[conjunto].margens,
    conjunto,
    cabecalho: typeof b.cabecalho === "string" ? b.cabecalho.slice(0, 200) : "",
    rodape: typeof b.rodape === "string" ? b.rodape.slice(0, 200) : "",
    numero: (["nenhum", "baixo-direita", "baixo-centro", "cima-direita"] as const).includes(b.numero as never) ? (b.numero as ConfigDocumento["numero"]) : "baixo-direita",
  };
}

/** Escapa texto simples para usar como HTML no cabeçalho e no rodapé. */
export const escaparHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Cabeçalho e rodapé da paginação, com o número da página onde a pessoa escolheu. */
export function cabecalhoRodape(c: ConfigDocumento): { headerLeft: string; headerRight: string; footerLeft: string; footerRight: string } {
  const n = "{page}";
  return {
    headerLeft: escaparHtml(c.cabecalho),
    headerRight: c.numero === "cima-direita" ? n : "",
    footerLeft: c.numero === "baixo-centro" ? `<div style="text-align:center">${escaparHtml(c.rodape)}${c.rodape ? " · " : ""}${n}</div>` : escaparHtml(c.rodape),
    footerRight: c.numero === "baixo-direita" ? n : "",
  };
}

/** Localizar: posições (no texto corrido) de cada ocorrência, sem ligar para maiúsculas e acentos. */
export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
export function ocorrencias(texto: string, busca: string): number[] {
  if (!busca) return [];
  const a = semAcento(texto), b = semAcento(busca);
  const out: number[] = [];
  for (let i = a.indexOf(b); i >= 0; i = a.indexOf(b, i + Math.max(1, b.length))) out.push(i);
  return out;
}
