// Lê o extrato que o banco deixa baixar (OFX ou CSV) e transforma em lançamentos.
// Tudo acontece neste aparelho: o arquivo não vai para lugar nenhum. A pessoa vê a
// lista antes e escolhe o que entra (nada é gravado sem confirmar).
import type { Entrada, Gasto } from "../api";

export interface LinhaExtrato {
  /** Identificador estável do lançamento (o FITID do OFX, ou um feito dos dados). */
  id: string;
  /** "AAAA-MM-DD". */
  data: string;
  descricao: string;
  /** Com sinal: negativo saiu, positivo entrou. */
  centavos: number;
}

export interface Extrato {
  linhas: LinhaExtrato[];
  /** "cartao": fatura em que valor positivo é gasto (o sinal foi invertido). */
  formato: "ofx" | "conta" | "cartao";
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normal = (s: string) => semAcento(s).toLowerCase().replace(/\s+/g, " ").trim();

/** Bytes do arquivo em texto: UTF-8, ou Windows-1252 (o mais comum nos OFX dos bancos). */
export function decodificar(bytes: Uint8Array): string {
  const inicio = new TextDecoder("latin1").decode(bytes.subarray(0, 400));
  if (/CHARSET:\s*(1252|ISO-?8859-?1|LATIN)/i.test(inicio)) return new TextDecoder("windows-1252").decode(bytes);
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8.replace(/^﻿/, "");
}

/**
 * Valor em centavos: "R$ -1.234,56", "-1234.56", "1.234,56", "(12,00)", "12,00 D", "45,90-".
 * Ponto sozinho com 3 casas é milhar ("1.234"); com 1 ou 2, é decimal ("12.5").
 */
export function lerValor(bruto: string): number | null {
  let s = bruto.replace(/R\$|\s| /gi, "");
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1); }
  if (/[dD]$/.test(s)) { negativo = true; s = s.slice(0, -1); } else if (/[cC]$/.test(s)) s = s.slice(0, -1);
  if (s.endsWith("-")) { negativo = true; s = s.slice(0, -1); }
  if (s.startsWith("-")) { negativo = !negativo; s = s.slice(1); } else if (s.startsWith("+")) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const ultPonto = s.lastIndexOf("."), ultVirgula = s.lastIndexOf(",");
  let inteiro: string, frac = "";
  if (ultPonto >= 0 && ultVirgula >= 0) {
    const d = Math.max(ultPonto, ultVirgula);
    inteiro = s.slice(0, d).replace(/[.,]/g, ""); frac = s.slice(d + 1);
  } else if (ultVirgula >= 0) {
    inteiro = s.slice(0, ultVirgula).replace(/,/g, ""); frac = s.slice(ultVirgula + 1);
  } else if (ultPonto >= 0) {
    const casas = s.length - ultPonto - 1;
    if (casas === 3 || (s.match(/\./g) ?? []).length > 1) inteiro = s.replace(/\./g, "");
    else { inteiro = s.slice(0, ultPonto); frac = s.slice(ultPonto + 1); }
  } else inteiro = s;
  if (frac.length > 2) frac = frac.slice(0, 2);
  const c = Number(inteiro || "0") * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isFinite(c)) return null;
  return negativo ? -c : c;
}

/** Data em "AAAA-MM-DD": "31/10/2026", "31/10/26", "2026-10-31", "20261031...", "31-10-2026". */
export function lerData(bruto: string): string | null {
  const s = bruto.trim();
  let a: number, m: number, d: number;
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (r) { a = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = /^(\d{4})(\d{2})(\d{2})/.exec(s))) { a = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s))) { d = +r[1]; m = +r[2]; a = +r[3]; if (a < 100) a += 2000; }
  else return null;
  const dt = new Date(a, m - 1, d);
  if (dt.getFullYear() !== a || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Um identificador feito dos dados (para CSV sem coluna de identificador). */
function idDosDados(data: string, centavos: number, descricao: string, repeticao: number): string {
  return `${data}|${centavos}|${normal(descricao).slice(0, 60)}|${repeticao}`;
}

/** OFX (SGML 1.x, sem as tags de fechar, ou XML 2.x). */
export function lerOfx(texto: string): LinhaExtrato[] {
  const linhas: LinhaExtrato[] = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const campo = (bloco: string, nome: string) => {
    const r = new RegExp(`<${nome}>([^<\\r\\n]*)`, "i").exec(bloco);
    return r ? r[1].trim() : "";
  };
  for (const bruto of blocos) {
    const bloco = bruto.split(/<\/STMTTRN>/i)[0];
    const data = lerData(campo(bloco, "DTPOSTED"));
    const centavos = lerValor(campo(bloco, "TRNAMT"));
    if (!data || centavos === null || centavos === 0) continue;
    const memo = campo(bloco, "MEMO"), nome = campo(bloco, "NAME");
    const descricao = desfazerEntidades([nome, memo].filter((x, i, l) => x && l.indexOf(x) === i).join(" · ")) || "Lançamento";
    const fitid = campo(bloco, "FITID");
    linhas.push({ id: fitid ? `ofx:${fitid}|${data}|${centavos}` : idDosDados(data, centavos, descricao, 0), data, descricao, centavos });
  }
  return linhas;
}

function desfazerEntidades(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'");
}

/** Divide uma linha de CSV respeitando aspas. */
function dividir(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = "", aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
      else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { out.push(atual.trim()); atual = ""; }
    else atual += c;
  }
  out.push(atual.trim());
  return out;
}

const COLUNAS = {
  data: ["data", "date", "data lancamento", "data de lancamento", "data do lancamento", "dt lancamento", "data movimento", "data da transacao", "data transacao"],
  descricao: ["descricao", "title", "historico", "lancamento", "estabelecimento", "memo", "description", "detalhes", "descricao do lancamento", "transacao"],
  valor: ["valor", "amount", "valor (r$)", "valor r$", "valor em r$", "quantia", "valor da transacao"],
  debito: ["debito", "saida", "saidas", "valor debito", "debito (r$)"],
  credito: ["credito", "entrada", "entradas", "valor credito", "credito (r$)"],
  id: ["identificador", "id", "codigo", "documento", "n documento"],
};

function achar(cabeca: string[], nomes: string[]): number {
  const i = cabeca.findIndex((c) => nomes.includes(c));
  return i >= 0 ? i : cabeca.findIndex((c) => nomes.some((n) => n.length > 3 && c.startsWith(n)));
}

/**
 * CSV de banco: acha as colunas pelo nome (data, descrição, valor; ou débito e crédito).
 * A fatura do Nubank ("date,title,amount") traz a compra positiva: vira "cartao" e o sinal
 * é invertido. Devolve null se não achar as colunas.
 */
export function lerCsv(texto: string): Extrato | null {
  const todas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  // A primeira linha que tem data e valor é o cabeçalho (alguns bancos põem linhas antes).
  for (let h = 0; h < Math.min(15, todas.length); h++) {
    const bruta = todas[h];
    const sep = [";", ",", "\t"].sort((a, b) => bruta.split(b).length - bruta.split(a).length)[0];
    const cabeca = dividir(bruta, sep).map(normal);
    const iData = achar(cabeca, COLUNAS.data);
    const iValor = achar(cabeca, COLUNAS.valor);
    const iDeb = achar(cabeca, COLUNAS.debito), iCred = achar(cabeca, COLUNAS.credito);
    if (iData < 0 || (iValor < 0 && iDeb < 0 && iCred < 0)) continue;
    const iDesc = achar(cabeca, COLUNAS.descricao);
    const iId = achar(cabeca, COLUNAS.id);
    const cartao = cabeca.includes("title") && cabeca.includes("amount");
    const linhas: LinhaExtrato[] = [];
    const vistos = new Map<string, number>();
    for (const l of todas.slice(h + 1)) {
      const cel = dividir(l, sep);
      const data = lerData(cel[iData] ?? "");
      if (!data) continue;
      let centavos: number | null = null;
      if (iValor >= 0) centavos = lerValor(cel[iValor] ?? "");
      if ((centavos === null || centavos === 0) && (iDeb >= 0 || iCred >= 0)) {
        const deb = iDeb >= 0 ? lerValor(cel[iDeb] ?? "") : null;
        const cred = iCred >= 0 ? lerValor(cel[iCred] ?? "") : null;
        if (deb) centavos = -Math.abs(deb);
        else if (cred) centavos = Math.abs(cred);
      }
      if (centavos === null || centavos === 0) continue;
      if (cartao) centavos = -centavos;
      const descricao = (iDesc >= 0 ? cel[iDesc] : "")?.trim() || "Lançamento";
      const base = `${data}|${centavos}|${normal(descricao)}`;
      const rep = vistos.get(base) ?? 0;
      vistos.set(base, rep + 1);
      const ident = iId >= 0 ? (cel[iId] ?? "").trim() : "";
      linhas.push({ id: ident ? `csv:${ident}|${data}|${centavos}` : idDosDados(data, centavos, descricao, rep), data, descricao, centavos });
    }
    return { linhas, formato: cartao ? "cartao" : "conta" };
  }
  return null;
}

/** Lê o arquivo pelo nome e pelo conteúdo. */
export function lerExtrato(nome: string, texto: string): Extrato | null {
  if (/\.(ofx|qfx)$/i.test(nome) || /<OFX>|OFXHEADER/i.test(texto.slice(0, 2000))) {
    return { linhas: lerOfx(texto), formato: "ofx" };
  }
  return lerCsv(texto);
}

/**
 * O lançamento parece já estar no Órbita? (um gasto ou entrada do mesmo dia e do
 * mesmo valor). Fica desmarcado na lista; a pessoa pode marcar mesmo assim.
 */
export function pareceRegistrado(l: LinhaExtrato, gastos: Gasto[], entradas: Entrada[], chaveDia: (ms: number) => string): boolean {
  if (l.centavos < 0) return gastos.some((g) => g.centavos === -l.centavos && chaveDia(g.momento) === l.data);
  return entradas.some((e) => e.centavos === l.centavos && chaveDia(e.momento) === l.data);
}
