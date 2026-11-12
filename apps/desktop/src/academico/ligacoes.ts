// Estudos ligado ao resto: prova e entrega viram compromisso na Agenda (com o aviso de
// sempre), o "comece antes" marca o dia de começar a estudar ou a fazer, e as tarefas
// do Classroom entram como atividades da matéria. Os vínculos ficam no cofre de valores
// ("estudos.ligacoes"), para atualizar em vez de repetir.
import { api, type Atividade, type Evento, type Materia } from "../api";
import type { TipoAtividade } from "./nivel";

/** Quantos dias antes começar, por tipo (a pessoa muda no formulário). */
export const DIAS_ANTES_PADRAO: Record<TipoAtividade, number> = { prova: 3, trabalho: 5, entrega: 3, dever: 0, leitura: 0 };
export const OPCOES_DIAS_ANTES = [0, 1, 2, 3, 5, 7, 10, 14];

/** "AAAA-MM-DD" menos `dias` (no calendário daqui). */
export function diasAntes(data: string, dias: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const inicioDoDia = (data: string) => { const [a, m, d] = data.split("-").map(Number); return new Date(a, m - 1, d).getTime(); };

/** O compromisso de dia inteiro de uma atividade (a prova, a entrega) ou do dia de começar. */
export function eventoDaAtividade(a: Atividade, nomeTipo: string, materia: string, qual: "prazo" | "comecar", dias = 0): Evento | null {
  const data = qual === "prazo" ? a.data : diasAntes(a.data, dias);
  if (!data || (qual === "comecar" && dias <= 0)) return null;
  const titulo = qual === "prazo" ? `${nomeTipo}: ${a.titulo}${materia ? ` (${materia})` : ""}` : `Começar: ${a.titulo}${materia ? ` (${materia})` : ""}`;
  const notas = qual === "prazo" ? "Dos Estudos." : `Dos Estudos. ${nomeTipo} em ${a.data.split("-").reverse().join("/")}.`;
  return { id: "", titulo, inicio: inicioDoDia(data), fim: null, diaInteiro: true, repeticao: null, modelo: false, notas, excecoes: [] };
}

export interface Ligacoes {
  /** atividade → compromissos que ela criou na Agenda. */
  agenda: Record<string, { prazo?: string; comecar?: string; dias?: number }>;
  /** tarefa do Classroom → atividade dos Estudos. */
  classroom: Record<string, string>;
}
const CHAVE = "estudos.ligacoes";
export async function lerLigacoes(): Promise<Ligacoes> {
  const v = (await api.lerValor(CHAVE).catch(() => null)) as Partial<Ligacoes> | null;
  return { agenda: v?.agenda && typeof v.agenda === "object" ? v.agenda : {}, classroom: v?.classroom && typeof v.classroom === "object" ? v.classroom : {} };
}
const gravarLigacoes = (l: Ligacoes) => api.gravarValor(CHAVE, l);

/** Põe, atualiza ou tira os compromissos de uma atividade na Agenda. */
export async function sincronizarNaAgenda(a: Atividade, nomeTipo: string, materia: string, opcoes: { agenda: boolean; dias: number }): Promise<void> {
  const l = await lerLigacoes();
  const antes = l.agenda[a.id] ?? {};
  const agora: { prazo?: string; comecar?: string; dias?: number } = { dias: opcoes.dias };
  for (const qual of ["prazo", "comecar"] as const) {
    const ev = opcoes.agenda && !a.feita ? eventoDaAtividade(a, nomeTipo, materia, qual, opcoes.dias) : null;
    const id = antes[qual];
    if (ev) agora[qual] = (await api.salvarEvento({ ...ev, id: id ?? "" })).id;
    else if (id) await api.excluirEvento(id).catch(() => {});
  }
  // Guarda a escolha mesmo sem compromisso (atividade feita): ao desmarcar, eles voltam.
  if (opcoes.agenda) l.agenda[a.id] = agora; else delete l.agenda[a.id];
  await gravarLigacoes(l);
}

/** Ao apagar a atividade, tira os compromissos dela. */
export async function tirarDaAgenda(atividadeId: string): Promise<void> {
  const l = await lerLigacoes();
  const antes = l.agenda[atividadeId];
  if (!antes) return;
  for (const id of [antes.prazo, antes.comecar]) if (id) await api.excluirEvento(id).catch(() => {});
  delete l.agenda[atividadeId];
  await gravarLigacoes(l);
}

/** A matéria de uma turma do Classroom: a de mesmo nome (sem acento e maiúscula) ou uma nova. */
export function materiaDaTurma(turma: string, materias: Materia[]): Materia | null {
  const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();
  const alvo = n(turma.split(" · ")[0]);
  return materias.find((m) => n(m.nome) === alvo) ?? materias.find((m) => alvo.includes(n(m.nome)) || n(m.nome).includes(alvo)) ?? null;
}

/** Traz uma tarefa do Classroom para os Estudos (uma vez; depois só atualiza a data e o feito). */
export async function trazerDoClassroom(tarefa: { id: string; titulo: string; turma: string; prazo: number | null; estado: string }, materias: Materia[]): Promise<{ atividade: Atividade; nova: boolean; materiaNova: boolean }> {
  const l = await lerLigacoes();
  let materia = materiaDaTurma(tarefa.turma, materias);
  let materiaNova = false;
  if (!materia) {
    materia = await api.salvarMateria({ id: "", nome: tarefa.turma.split(" · ")[0].slice(0, 80), professor: "", cor: "mar", criadoEm: 0 });
    materiaNova = true;
  }
  const d = tarefa.prazo !== null ? new Date(tarefa.prazo) : null;
  const data = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
  const ja = l.classroom[tarefa.id];
  const existentes = ja ? (await api.listarAtividades()).find((x) => x.id === ja) : undefined;
  const base: Atividade = existentes ?? { id: "", materiaId: materia.id, tipo: "trabalho", titulo: tarefa.titulo.slice(0, 120), data, peso: null, nota: null, feita: false, criadoEm: 0 };
  const salva = await api.salvarAtividade({ ...base, data: data || base.data, feita: base.feita || tarefa.estado !== "pendente" });
  l.classroom[tarefa.id] = salva.id;
  await gravarLigacoes(l);
  return { atividade: salva, nova: !existentes, materiaNova };
}
