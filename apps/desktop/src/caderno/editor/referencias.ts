// Referências bibliográficas (ABNT, APA, Vancouver) com o citation-js (MIT) e os
// estilos CSL, o mesmo padrão do Zotero e do Mendeley. Os dados vêm da pessoa (ou da
// busca pelo DOI/ISBN) e o formatador monta a referência: nada é inventado.
// Estilos CSL e idioma pt-BR: Citation Style Language (citationstyles.org), licença
// Creative Commons BY-SA 3.0 ("associacao-brasileira-de-normas-tecnicas.csl",
// "elsevier-vancouver.csl", "locales-pt-BR.xml"); o APA vem com o citation-js.
import abnt from "./csl/associacao-brasileira-de-normas-tecnicas.csl?raw";
import ptBR from "./csl/locales-pt-BR.xml?raw";
import vancouver from "./csl/vancouver.csl?raw";

export type Norma = "abnt" | "apa" | "vancouver";
export type TipoReferencia = "book" | "article-journal" | "chapter" | "webpage" | "thesis";
export interface Autor { family: string; given: string }
export interface Referencia {
  tipo: TipoReferencia;
  autores: Autor[];
  titulo: string;
  ano: string;
  editora?: string;
  local?: string;
  edicao?: string;
  /** Revista (artigo) ou livro (capítulo). */
  container?: string;
  volume?: string;
  numero?: string;
  paginas?: string;
  url?: string;
  /** Data de acesso (AAAA-MM-DD), para site. */
  acesso?: string;
  doi?: string;
  isbn?: string;
}

/** "Silva, Maria" ou "Maria Silva" (uma pessoa por linha) → autores. */
export function lerAutores(texto: string): Autor[] {
  return texto.split(/\n|;/).map((l) => l.trim()).filter(Boolean).map((l) => {
    if (l.includes(",")) { const [f, ...g] = l.split(","); return { family: f.trim(), given: g.join(",").trim() }; }
    const partes = l.split(/\s+/);
    return partes.length > 1 ? { family: partes[partes.length - 1], given: partes.slice(0, -1).join(" ") } : { family: l, given: "" };
  });
}
export const autoresEmTexto = (a: Autor[]) => a.map((x) => (x.given ? `${x.family}, ${x.given}` : x.family)).join("\n");

const data = (iso?: string) => {
  const m = iso ? /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(iso) : null;
  return m ? { "date-parts": [[Number(m[1]), ...(m[2] ? [Number(m[2])] : []), ...(m[3] ? [Number(m[3])] : [])]] } : undefined;
};

/** A referência no formato CSL-JSON. */
export function paraCsl(r: Referencia, id = "ref"): Record<string, unknown> {
  const o: Record<string, unknown> = { id, type: r.tipo, title: r.titulo, author: r.autores.filter((a) => a.family) };
  if (r.ano) o.issued = data(r.ano);
  if (r.editora) o.publisher = r.editora;
  if (r.local) o["publisher-place"] = r.local;
  if (r.edicao) o.edition = r.edicao;
  if (r.container) o["container-title"] = r.container;
  if (r.volume) o.volume = r.volume;
  if (r.numero) o.issue = r.numero;
  if (r.paginas) o.page = r.paginas;
  if (r.url) o.URL = r.url;
  if (r.acesso) o.accessed = data(r.acesso);
  if (r.doi) o.DOI = r.doi;
  if (r.isbn) o.ISBN = r.isbn;
  return o;
}

/** De CSL-JSON (o que a busca devolve) para os campos da janela. */
export function deCsl(c: Record<string, unknown>): Referencia {
  const tipos: TipoReferencia[] = ["book", "article-journal", "chapter", "webpage", "thesis"];
  const tipoBruto = String(c.type ?? "book");
  const tipo: TipoReferencia = tipos.includes(tipoBruto as TipoReferencia) ? (tipoBruto as TipoReferencia) : tipoBruto === "article" ? "article-journal" : tipoBruto.includes("chapter") ? "chapter" : "book";
  const ano = (c.issued as { "date-parts"?: number[][] } | undefined)?.["date-parts"]?.[0]?.[0];
  const s = (v: unknown) => (v == null ? undefined : Array.isArray(v) ? String(v[0] ?? "") : String(v));
  return {
    tipo, titulo: s(c.title) ?? "", ano: ano ? String(ano) : "",
    autores: ((c.author as Autor[] | undefined) ?? []).map((a) => ({ family: a.family ?? "", given: a.given ?? "" })),
    editora: s(c.publisher), local: s(c["publisher-place"]), edicao: s(c.edition), container: s(c["container-title"]),
    volume: s(c.volume), numero: s(c.issue), paginas: s(c.page), url: s(c.URL), doi: s(c.DOI), isbn: s(c.ISBN),
  };
}

type CiteCtor = new (dados: unknown) => { format: (tipo: string, opcoes: Record<string, unknown>) => string };
interface Citation { Cite: CiteCtor & { async: (dados: string) => Promise<{ data: Record<string, unknown>[] }> } }
let carregando: Promise<Citation> | null = null;
/** Carrega o citation-js e os estilos (só quando a pessoa abre as referências). */
function citation(): Promise<Citation> {
  carregando ??= (async () => {
    const core = await import("@citation-js/core");
    await import("@citation-js/plugin-csl");
    await import("@citation-js/plugin-doi");
    await import("@citation-js/plugin-isbn");
    const config = core.plugins.config.get("@csl") as unknown as { styles: { add: (n: string, x: string) => void }; locales: { add: (n: string, x: string) => void } };
    config.styles.add("abnt", abnt);
    config.styles.add("vancouver", vancouver);
    config.locales.add("pt-BR", ptBR);
    return core as unknown as Citation;
  })();
  return carregando;
}

/** A referência formatada pela norma (HTML com itálico e negrito, e o texto puro). */
export async function formatarReferencia(r: Referencia, norma: Norma): Promise<{ html: string; texto: string }> {
  const { Cite } = await citation();
  const c = new Cite(paraCsl(r));
  const opcoes = { style: norma, lang: "pt-BR" };
  const html = c.format("bibliography", { ...opcoes, format: "html" });
  const texto = c.format("bibliography", { ...opcoes, format: "text" }).trim();
  const d = document.createElement("div");
  d.innerHTML = html;
  const entrada = d.querySelector(".csl-entry");
  return { html: (entrada?.innerHTML ?? html).trim(), texto };
}

/** A citação no texto: (SILVA, 2020) na ABNT, (Silva, 2020) na APA, [1] na Vancouver. */
export async function citacaoNoTexto(r: Referencia, norma: Norma): Promise<string> {
  const { Cite } = await citation();
  return new Cite(paraCsl(r)).format("citation", { style: norma, lang: "pt-BR", format: "text" }).trim();
}

/** Busca os dados pelo DOI ou pelo ISBN (vai à internet: Crossref ou Google Livros). */
export async function buscarReferencia(identificador: string): Promise<Referencia | null> {
  const id = identificador.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  if (!id) return null;
  const { Cite } = await citation();
  const r = await Cite.async(/^10\.\d{4,}/.test(id) ? id : id.replace(/[^\dXx]/g, ""));
  return r.data[0] ? deCsl(r.data[0]) : null;
}
