// Exportação em formatos abertos: ICS (agenda), CSV (tabelas) e JSON (tudo).
// Tudo puro (sem DOM, sem relógio além do que entra por parâmetro), para testar.

import type {
  Atividade, Aula, Conta, Desejo, Evento, Gasto, Grupo, Hobby, Ideia, Livro,
  Materia, Meta, PastaProjeto, PlanoSaude, Profissional, Projeto, Quadro, RegistroSaude, Remedio,
} from "../api";
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

// ---------- Markdown (resumo legível) ----------

/** Tudo o que o resumo em Markdown sabe formatar. Qualquer parte pode faltar. */
export interface DadosResumo {
  ideias?: Ideia[];
  projetos?: Projeto[];
  /** Pastas de projetos (atalhos): os projetos dizem em quais estão. */
  pastasDeProjetos?: PastaProjeto[];
  agenda?: Evento[];
  remedios?: Remedio[];
  registrosDeSaude?: RegistroSaude[];
  planosDeSaude?: PlanoSaude[];
  profissionais?: Profissional[];
  materias?: Materia[];
  atividades?: Atividade[];
  aulas?: Aula[];
  gruposDeGasto?: Grupo[];
  gastos?: Gasto[];
  contas?: Conta[];
  desejos?: Desejo[];
  metas?: Meta[];
  hobbies?: Hobby[];
  quadros?: Quadro[];
  livros?: Livro[];
}

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const ROTULO_TIPO_SAUDE: Record<string, string> = {
  sono: "Sono", sintoma: "Sintoma", sobrecarga: "Sobrecarga", coisa_boa: "Coisa boa", potencialidade: "Potencialidade", regulacao: "Regulação",
};

/** "AAAA-MM-DD" → "DD/MM/AAAA"; vazio continua vazio. */
function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

/** Uma seção "## título" com uma linha por item; nada sai se a lista estiver vazia. */
function secao<T>(titulo: string, itens: T[] | undefined, linha: (x: T) => string): string {
  if (!itens || itens.length === 0) return "";
  return `## ${titulo}\n\n${itens.map((x) => `- ${linha(x)}`).join("\n")}\n`;
}

/**
 * Um documento legível com o que a pessoa guardou, por seção. Pensado para ler
 * e imprimir, não para reimportar (para isso há o JSON).
 */
export function paraMarkdown(dados: DadosResumo, agora = Date.now()): string {
  const grupo = new Map((dados.gruposDeGasto ?? []).map((g) => [g.id, g.nome]));
  const materia = new Map((dados.materias ?? []).map((m) => [m.id, m.nome]));
  const pasta = new Map((dados.pastasDeProjetos ?? []).map((p) => [p.id, p.nome]));
  const pastasDe = (p: Projeto) => (p.pastas ?? []).map((id) => pasta.get(id)).filter(Boolean).join(", ");
  const partes: string[] = [
    `# Meus dados do Órbita`,
    `Gerado em ${dataHoraLocal(agora)}.`,
    secao("Ideias", dados.ideias, (i) => `**${i.texto}**${i.nota ? ` — ${i.nota}` : ""}`),
    secao("Projetos", dados.projetos, (p) => `**${p.titulo}** (${p.estado})${p.prazo ? ` · entrega ${dataBR(p.prazo)}` : ""} · ${p.tarefasFeitas}/${p.tarefasTotal} tarefas${pastasDe(p) ? ` · pastas: ${pastasDe(p)}` : ""}${p.anotacoes ? ` — ${p.anotacoes}` : ""}`),
    secao("Agenda", dados.agenda, (e) => `**${e.titulo}** — ${e.diaInteiro ? dataHoraLocal(e.inicio).slice(0, 10) : dataHoraLocal(e.inicio)}${e.repeticao ? " (repete)" : ""}`),
    secao("Remédios", dados.remedios, (r) => `**${r.nome}**${r.dose ? ` — ${r.dose}` : ""}${r.horarios.length ? ` · ${r.horarios.join(", ")}` : ""}${r.estado === "pausado" ? " · pausado" : ""}`),
    secao("Registros de saúde", dados.registrosDeSaude, (r) => `${dataHoraLocal(r.momento)} · ${ROTULO_TIPO_SAUDE[r.tipo] ?? r.tipo}${r.intensidade != null ? ` (${r.intensidade}/5)` : ""}${r.nota ? ` — ${r.nota}` : ""}`),
    secao("Planos de crise e estratégias", dados.planosDeSaude, (p) => `**${p.titulo}** (${p.tipo})`),
    secao("Profissionais de saúde", dados.profissionais, (p) => `**${p.nome}**${p.especialidade ? ` — ${p.especialidade}` : ""}${p.proximaConsulta ? ` · próxima: ${dataBR(p.proximaConsulta)}` : ""}`),
    secao("Matérias", dados.materias, (m) => `**${m.nome}**${m.professor ? ` — ${m.professor}` : ""}`),
    secao("Provas, trabalhos e deveres", dados.atividades, (a) => `**${a.titulo}** (${a.tipo}) · ${dataBR(a.data)}${materia.get(a.materiaId) ? ` · ${materia.get(a.materiaId)}` : ""}${a.nota != null ? ` · nota ${a.nota}` : ""}`),
    secao("Aulas", dados.aulas, (a) => `${DIAS_SEMANA[a.diaSemana]} · ${a.inicio}–${a.fim}${materia.get(a.materiaId) ? ` · ${materia.get(a.materiaId)}` : ""}`),
    secao("Gastos", dados.gastos, (g) => `${dataHoraLocal(g.momento)} · ${formatarMoeda(g.centavos)}${grupo.get(g.grupoId) ? ` · ${grupo.get(g.grupoId)}` : ""}${g.interesse ? " · interesse especial" : ""}${g.descricao ? ` — ${g.descricao}` : ""}`),
    secao("Contas que se repetem", dados.contas, (c) => `**${c.nome}** — ${formatarMoeda(c.centavos)} · vence dia ${c.diaVencimento}`),
    secao("Metas de reserva", dados.metas, (m) => `**${m.nome}** — ${formatarMoeda(m.guardadoCentavos)} de ${formatarMoeda(m.alvoCentavos)}`),
    secao("Lista de espera", dados.desejos, (d) => `**${d.nome}**${d.centavos ? ` — ${formatarMoeda(d.centavos)}` : ""} (${d.estado})`),
    secao("Hobbies e interesses", dados.hobbies, (h) => `**${h.nome}**${h.notas ? ` — ${h.notas}` : ""}`),
    secao("Minha organização", dados.quadros, (q) => `**${q.nome}** (${q.estilo})`),
    secao("Leitura", dados.livros, (l) => `**${l.titulo}**${l.autor ? ` — ${l.autor}` : ""} (${l.status})`),
  ];
  return partes.filter(Boolean).join("\n") + "\n";
}

// ---------- JSON (tudo) ----------

/** Empacota um dump com versão e data, legível e reimportável no futuro. */
export function montarJSON(dados: Record<string, unknown>, agora = Date.now()): string {
  return JSON.stringify({ orbita: "exportação de dados", versao: 1, geradoEm: new Date(agora).toISOString(), dados }, null, 2);
}
