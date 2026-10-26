// Exportação em formatos abertos: ICS (agenda), CSV (tabelas) e JSON (tudo).
// Tudo puro (sem DOM, sem relógio além do que entra por parâmetro), para testar.

import type { Evento, Gasto, Grupo, RegistroSaude } from "../api";
import { formatarMoeda } from "../dinheiro/moeda";

// ---------- CSV ----------

/** Escapa um valor de célula: envolve em aspas se tiver vírgula, aspas ou quebra. */
function celula(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Monta um CSV (linhas separadas por CRLF, para o Excel abrir certo). */
export function paraCSV(cabecalho: string[], linhas: string[][]): string {
  return [cabecalho, ...linhas].map((l) => l.map(celula).join(",")).join("\r\n");
}

/** Data e hora locais "AAAA-MM-DD HH:MM" a partir de ms. */
export function dataHoraLocal(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function gastosParaCSV(gastos: Gasto[], grupos: Grupo[]): string {
  const nomeGrupo = new Map(grupos.map((g) => [g.id, g.nome]));
  const linhas = [...gastos]
    .sort((a, b) => a.momento - b.momento)
    .map((g) => [
      dataHoraLocal(g.momento),
      formatarMoeda(g.centavos),
      nomeGrupo.get(g.grupoId) || g.categoria || "",
      g.interesse ? "sim" : "não",
      g.descricao,
    ]);
  return paraCSV(["Data", "Valor", "Grupo", "Interesse especial", "Descrição"], linhas);
}

export function registrosSaudeParaCSV(registros: RegistroSaude[], rotuloTipo: (t: string) => string): string {
  const linhas = [...registros]
    .sort((a, b) => a.momento - b.momento)
    .map((r) => [dataHoraLocal(r.momento), rotuloTipo(r.tipo), r.intensidade == null ? "" : String(r.intensidade), r.nota]);
  return paraCSV(["Data", "Tipo", "Intensidade", "Nota"], linhas);
}

// ---------- ICS (agenda) ----------

const DIAS_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function p2(n: number): string {
  return String(n).padStart(2, "0");
}
/** "AAAAMMDD" no horário local. */
function dataICS(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
}
/** "AAAAMMDDTHHMMSS" no horário local (hora "flutuante", sem fuso). */
function dataHoraICS(ms: number): string {
  const d = new Date(ms);
  return `${dataICS(ms)}T${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
}
/** "AAAAMMDDTHHMMSSZ" em UTC (para o DTSTAMP). */
function carimboUTC(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
}

/** Escapa texto de SUMMARY/DESCRIPTION conforme o RFC 5545. */
function textoICS(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Dobra linhas longas (> 74 caracteres) com CRLF + espaço, como pede o ICS. */
function dobrar(linha: string): string {
  if (linha.length <= 74) return linha;
  const partes: string[] = [];
  let resto = linha;
  partes.push(resto.slice(0, 74));
  resto = resto.slice(74);
  while (resto.length > 73) {
    partes.push(" " + resto.slice(0, 73));
    resto = resto.slice(73);
  }
  if (resto.length) partes.push(" " + resto);
  return partes.join("\r\n");
}

function regraRepeticao(ev: Evento): string | null {
  if (!ev.repeticao) return null;
  const { frequencia, dias, ate } = ev.repeticao;
  const freq = frequencia === "diaria" ? "DAILY" : frequencia === "mensal" ? "MONTHLY" : "WEEKLY";
  let r = `RRULE:FREQ=${freq}`;
  if (frequencia === "semanal" && dias.length) r += `;BYDAY=${dias.map((d) => DIAS_ICS[d]).join(",")}`;
  if (ate) r += `;UNTIL=${dataICS(ate)}`;
  return r;
}

/** Um VEVENT. Eventos "modelo" (semana-modelo) ficam de fora de quem chama. */
function vevento(ev: Evento, carimbo: string): string[] {
  const linhas = ["BEGIN:VEVENT", `UID:${ev.id || `orbita-${ev.inicio}`}@orbita`, `DTSTAMP:${carimbo}`];
  if (ev.diaInteiro) {
    linhas.push(`DTSTART;VALUE=DATE:${dataICS(ev.inicio)}`);
    // Dia inteiro: DTEND é exclusivo; o dia seguinte ao fim (ou ao início).
    const fim = ev.fim ?? ev.inicio;
    linhas.push(`DTEND;VALUE=DATE:${dataICS(fim + 86_400_000)}`);
  } else {
    linhas.push(`DTSTART:${dataHoraICS(ev.inicio)}`);
    if (ev.fim) linhas.push(`DTEND:${dataHoraICS(ev.fim)}`);
  }
  linhas.push(`SUMMARY:${textoICS(ev.titulo)}`);
  if (ev.notas.trim()) linhas.push(`DESCRIPTION:${textoICS(ev.notas)}`);
  const rrule = regraRepeticao(ev);
  if (rrule) linhas.push(rrule);
  for (const ex of ev.excecoes) {
    const dia = ex.replace(/-/g, "");
    if (ev.diaInteiro) linhas.push(`EXDATE;VALUE=DATE:${dia}`);
    else linhas.push(`EXDATE:${dia}T${dataHoraICS(ev.inicio).slice(9)}`);
  }
  linhas.push("END:VEVENT");
  return linhas;
}

/** Agenda inteira como um arquivo .ics. `agora` entra por parâmetro para testar. */
export function eventosParaICS(eventos: Evento[], agora = Date.now()): string {
  const carimbo = carimboUTC(agora);
  const corpo = eventos.filter((e) => !e.modelo).flatMap((e) => vevento(e, carimbo));
  const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Orbita//Agenda//PT", "CALSCALE:GREGORIAN", ...corpo, "END:VCALENDAR"];
  return linhas.map(dobrar).join("\r\n") + "\r\n";
}

// ---------- JSON (tudo) ----------

/** Empacota um dump com versão e data, legível e reimportável no futuro. */
export function montarJSON(dados: Record<string, unknown>, agora = Date.now()): string {
  return JSON.stringify({ orbita: "exportação de dados", versao: 1, geradoEm: new Date(agora).toISOString(), dados }, null, 2);
}
