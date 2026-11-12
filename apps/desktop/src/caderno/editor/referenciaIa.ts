// "Preencher com a IA": a pessoa cola uma referência pronta (de um PDF, de um site, de
// uma lista da aula, em qualquer formato) e a IA só separa nos campos. Nada é gravado
// nem inserido: os campos aparecem na janela para a pessoa conferir e corrigir.
import { api } from "../../api";
import { deCsl, type Referencia } from "./referencias";

/** O pedido à IA (a mesma IA do caderno, sem dado sensível). */
export const PEDIDO_REFERENCIA = `Desta vez, não responda em HTML. Leia a referência bibliográfica que a pessoa colou (pode estar em qualquer norma ou bagunçada) e devolva SÓ um objeto JSON no formato CSL-JSON, sem nenhum texto antes ou depois, com os campos que existirem no texto:
type ("book", "article-journal", "chapter", "webpage" ou "thesis"), title, author (lista de {"family": sobrenome, "given": prenomes}), issued ({"date-parts": [[ano]]}), publisher, publisher-place, edition, container-title (revista ou livro do capítulo), volume, issue, page, DOI, ISBN, URL.
Copie os dados como estão no texto. Não invente nem complete nada: o campo que não estiver no texto fica de fora.`;

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** Acha o JSON na resposta (que pode vir com marcas de HTML, cercas de código ou entidades). */
export function referenciaDaResposta(resposta: string): Referencia | null {
  const texto = resposta
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (ENTIDADES[e.toLowerCase()]) return ENTIDADES[e.toLowerCase()];
      if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith("#")) return String.fromCodePoint(parseInt(e.slice(1), 10));
      return m;
    });
  const ini = texto.indexOf("{"), fim = texto.lastIndexOf("}");
  if (ini < 0 || fim <= ini) return null;
  let bruto: unknown;
  try { bruto = JSON.parse(texto.slice(ini, fim + 1)); } catch { return null; }
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  // O que a IA marcou como faltando ("[falta: ...]") fica vazio.
  const limpo = JSON.parse(JSON.stringify(bruto, (_k, v) => (typeof v === "string" && /^\s*\[falta/i.test(v) ? undefined : v))) as Record<string, unknown>;
  const r = deCsl(limpo);
  return r.titulo || r.autores.length ? r : null;
}

export async function referenciaPorIa(texto: string): Promise<Referencia | null> {
  const r = await api.iaCaderno(PEDIDO_REFERENCIA, texto.trim().slice(0, 4000), [], false);
  return referenciaDaResposta(r.html);
}
