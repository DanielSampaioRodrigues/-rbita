// Fichamento de um livro, nas regras da ABNT (NBR 10520:2023 para as citações e
// NBR 6023 para a referência). Cada ficha é citação direta, paráfrase (citação
// indireta), resumo ou comentário. Aqui ficam as contas e a montagem do texto e do
// Word; a tela fica em Fichamento.tsx.
import type { Anotacao, TipoFicha } from "../api";

export interface CabecalhoFichamento {
  /** Referência completa, como a pessoa escreveu (ou a sugerida). */
  referencia: string;
  ano: string;
}

/** Acima disto, a citação direta é "longa" (mais de 3 linhas): recuo de 4 cm, letra menor, sem aspas. */
export const LIMITE_CITACAO_CURTA = 240;

const SUFIXOS = ["junior", "júnior", "filho", "neto", "sobrinho", "segundo"];

/** Um autor: "Lev Vygotsky" ou "Vygotsky, Lev" → { sobrenome: "VYGOTSKY", prenomes: "Lev" }. */
export function partesDoAutor(autor: string): { sobrenome: string; prenomes: string } {
  const a = autor.trim().replace(/\s+/g, " ");
  if (!a) return { sobrenome: "", prenomes: "" };
  if (a.includes(",")) {
    const [s, ...resto] = a.split(",");
    return { sobrenome: s.trim().toLocaleUpperCase("pt-BR"), prenomes: resto.join(",").trim() };
  }
  const ps = a.split(" ");
  if (ps.length === 1) return { sobrenome: a.toLocaleUpperCase("pt-BR"), prenomes: "" };
  const n = ps.length >= 3 && SUFIXOS.includes(ps[ps.length - 1].toLocaleLowerCase("pt-BR")) ? 2 : 1;
  return { sobrenome: ps.slice(-n).join(" ").toLocaleUpperCase("pt-BR"), prenomes: ps.slice(0, -n).join(" ") };
}

/** Os autores do campo "Autor" do livro (separados por ";" ou " e "). */
export function autores(autor: string): string[] {
  const a = autor.trim();
  if (!a) return [];
  const partes = a.includes(";") ? a.split(";") : a.split(/\s+e\s+|\s*&\s*/);
  return partes.map((x) => x.trim()).filter(Boolean);
}

/** Sobrenome(s) para a chamada: até 3 autores; mais que isso, o primeiro e "et al.". */
export function chaveAutoria(autor: string): string {
  const lista = autores(autor).map((x) => partesDoAutor(x).sobrenome).filter(Boolean);
  if (!lista.length) return "AUTOR";
  return lista.length > 3 ? `${lista[0]} et al.` : lista.join("; ");
}

/** A chamada da citação: "(VYGOTSKY, 1998, p. 23)". Sem ano, "s. d."; sem página, sem "p.". */
export function chamada(autor: string, ano: string, pagina?: string): string {
  const p = (pagina ?? "").trim();
  return `(${chaveAutoria(autor)}, ${ano.trim() || "s. d."}${p ? `, p. ${p}` : ""})`;
}

/** Referência sugerida para começar (a pessoa completa "Cidade: Editora"). */
export function referenciaSugerida(titulo: string, autor: string, ano: string): string {
  const lista = autores(autor).map(partesDoAutor);
  const quem = lista.length > 3
    ? `${lista[0].sobrenome}, ${lista[0].prenomes} et al.`
    : lista.map((x) => (x.prenomes ? `${x.sobrenome}, ${x.prenomes}` : x.sobrenome)).join("; ");
  return `${quem ? `${quem}. ` : ""}${titulo.trim() || "Título"}. Cidade: Editora, ${ano.trim() || "ano"}.`;
}

export const NOMES_FICHA: Record<TipoFicha, string> = {
  citacao: "Citação direta",
  parafrase: "Paráfrase (citação indireta)",
  resumo: "Resumo",
  comentario: "Comentário",
};

/** A página de uma ficha: a que a pessoa escreveu, ou a do PDF. */
export function paginaDaFicha(f: Pick<Anotacao, "paginaRef" | "pdfPagina">): string {
  return (f.paginaRef ?? "").trim() || (f.pdfPagina > 0 ? String(f.pdfPagina) : "");
}

export interface FichaFormatada {
  rotulo: string;
  texto: string;
  /** Citação direta longa (recuo de 4 cm). */
  longa: boolean;
  chamada: string;
}

/** Como a ficha aparece no fichamento. */
export function formatarFicha(f: Anotacao, autor: string, ano: string): FichaFormatada {
  const tipo = (f.ficha || "comentario") as TipoFicha;
  // Citação e paráfrase levam a página (a escrita ou a do PDF); resumo e comentário, só se a pessoa escreveu.
  const pagina = tipo === "citacao" || tipo === "parafrase" ? paginaDaFicha(f) : (f.paginaRef ?? "").trim();
  const texto = f.texto.trim();
  const rotulo = `${NOMES_FICHA[tipo]}${pagina ? `, p. ${pagina}` : ""}`;
  if (tipo === "citacao") {
    const longa = texto.length > LIMITE_CITACAO_CURTA;
    return { rotulo, texto: longa ? texto : `“${texto.replace(/^["“]|["”]$/g, "")}”`, longa, chamada: chamada(autor, ano, pagina) };
  }
  if (tipo === "parafrase") return { rotulo, texto, longa: false, chamada: chamada(autor, ano, pagina) };
  return { rotulo, texto, longa: false, chamada: "" };
}

/** O fichamento inteiro em texto (Markdown simples). */
export function fichamentoEmTexto(titulo: string, autor: string, cab: CabecalhoFichamento, fichas: Anotacao[]): string {
  const linhas = ["# Fichamento", "", `**Referência:** ${cab.referencia.trim() || referenciaSugerida(titulo, autor, cab.ano)}`, ""];
  for (const f of fichas) {
    const x = formatarFicha(f, autor, cab.ano);
    linhas.push(`## ${x.rotulo}`, "");
    if (x.longa) linhas.push(...x.texto.split(/\r?\n/).map((l) => `> ${l}`), "", x.chamada, "");
    else linhas.push(`${x.texto}${x.chamada ? ` ${x.chamada}.` : ""}`, "");
  }
  return linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

const CM = 567; // 1 cm em twips (unidade do Word)

/** O fichamento em Word (.docx): Times 12, entrelinha 1,5; citação longa com recuo de 4 cm, letra 10 e entrelinha simples. */
export async function fichamentoEmDocx(titulo: string, autor: string, cab: CabecalhoFichamento, fichas: Anotacao[]): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import("docx");
  const fonte = "Times New Roman";
  const corpo = (texto: string, extra: Record<string, unknown> = {}) =>
    new Paragraph({ children: [new TextRun({ text: texto, font: fonte, size: 24 })], spacing: { line: 360, after: 120 }, alignment: AlignmentType.JUSTIFIED, ...extra });
  const filhos = [
    new Paragraph({ children: [new TextRun({ text: "FICHAMENTO", font: fonte, size: 24, bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
    new Paragraph({ children: [new TextRun({ text: "Referência: ", font: fonte, size: 24, bold: true }), new TextRun({ text: cab.referencia.trim() || referenciaSugerida(titulo, autor, cab.ano), font: fonte, size: 24 })], spacing: { line: 240, after: 360 } }),
  ];
  for (const f of fichas) {
    const x = formatarFicha(f, autor, cab.ano);
    filhos.push(new Paragraph({ children: [new TextRun({ text: x.rotulo, font: fonte, size: 24, bold: true })], spacing: { before: 240, after: 120 } }));
    if (x.longa) {
      filhos.push(new Paragraph({ children: [new TextRun({ text: x.texto, font: fonte, size: 20 })], indent: { left: 4 * CM }, spacing: { line: 240, after: 120 }, alignment: AlignmentType.JUSTIFIED }));
      filhos.push(corpo(x.chamada, { indent: { left: 4 * CM }, spacing: { line: 240, after: 120 } }));
    } else {
      filhos.push(corpo(`${x.texto}${x.chamada ? ` ${x.chamada}.` : ""}`));
    }
  }
  const doc = new Document({
    creator: "Órbita",
    title: `Fichamento: ${titulo}`,
    sections: [{ properties: { page: { margin: { top: 3 * CM, left: 3 * CM, bottom: 2 * CM, right: 2 * CM } } }, children: filhos }],
  });
  return Packer.toBlob(doc);
}
