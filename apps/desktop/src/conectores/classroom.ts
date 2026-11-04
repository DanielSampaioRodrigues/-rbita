// Google Classroom: turmas, tarefas, prazos e se já foi entregue (só leitura).
//
// O Google não deixa um app de fora anexar arquivo nem entregar uma tarefa criada pelo
// professor (anexar e entregar só funcionam para o app que criou a tarefa). Por isso a
// entrega é em dois passos: o Órbita salva o trabalho na pasta "Órbita" do Drive e abre
// a tarefa no Classroom; lá, a pessoa toca em Adicionar > Google Drive e em Entregar.
import { api, type Evento } from "../api";
import { acessoGoogle, SemConta, SemPermissao, simulado } from "./google";

export interface Turma { id: string; nome: string; link: string }
export type EstadoEntrega = "pendente" | "entregue" | "devolvida";
export interface TarefaClassroom {
  id: string;
  turmaId: string;
  turma: string;
  titulo: string;
  descricao: string;
  /** Prazo em ms (o Classroom guarda em UTC); null = sem prazo. */
  prazo: number | null;
  link: string;
  estado: EstadoEntrega;
  atrasada: boolean;
}

interface DataGoogle { year?: number; month?: number; day?: number }
interface HoraGoogle { hours?: number; minutes?: number }
export interface TrabalhoGoogle { id: string; title?: string; description?: string; dueDate?: DataGoogle; dueTime?: HoraGoogle; alternateLink?: string; state?: string }
export interface EntregaGoogle { courseWorkId: string; state?: string; late?: boolean }

/** O prazo do Classroom (data e hora em UTC). Sem hora, vale o fim do dia. */
export function prazoDe(d?: DataGoogle, h?: HoraGoogle): number | null {
  if (!d?.year || !d.month || !d.day) return null;
  const hora = h && (h.hours !== undefined || h.minutes !== undefined) ? [h.hours ?? 0, h.minutes ?? 0] : [23, 59];
  return Date.UTC(d.year, d.month - 1, d.day, hora[0], hora[1]);
}

export function estadoDe(e?: EntregaGoogle): EstadoEntrega {
  if (e?.state === "TURNED_IN") return "entregue";
  if (e?.state === "RETURNED") return "devolvida";
  return "pendente";
}

/** Junta tarefas e entregas: as que faltam primeiro (pelo prazo), depois as entregues. */
export function juntarTarefas(turma: Turma, trabalhos: TrabalhoGoogle[], entregas: EntregaGoogle[], agora = Date.now()): TarefaClassroom[] {
  const porTrabalho = new Map(entregas.map((e) => [e.courseWorkId, e]));
  return trabalhos.filter((w) => !w.state || w.state === "PUBLISHED").map((w) => {
    const e = porTrabalho.get(w.id);
    const prazo = prazoDe(w.dueDate, w.dueTime);
    const estado = estadoDe(e);
    return { id: w.id, turmaId: turma.id, turma: turma.nome, titulo: (w.title ?? "").trim() || "Tarefa", descricao: (w.description ?? "").trim(), prazo, link: w.alternateLink ?? turma.link, estado, atrasada: estado === "pendente" && (!!e?.late || (prazo !== null && prazo < agora)) };
  });
}

export function ordenarTarefas(lista: TarefaClassroom[]): TarefaClassroom[] {
  const peso = (t: TarefaClassroom) => (t.estado === "pendente" ? 0 : 1);
  return [...lista].sort((a, b) => peso(a) - peso(b) || (a.prazo ?? Infinity) - (b.prazo ?? Infinity) || a.titulo.localeCompare(b.titulo));
}

async function pedir<T>(caminho: string): Promise<T> {
  const acesso = await acessoGoogle();
  let r: Response;
  try {
    r = await fetch(`https://classroom.googleapis.com/v1/${caminho}`, { headers: { Authorization: `Bearer ${acesso}` } });
  } catch {
    throw new Error("Não consegui falar com o Classroom. Confira a internet e tente de novo.");
  }
  if (r.status === 401) throw new SemConta("O acesso ao Google venceu. Em Ajustes > Contas conectadas, ligue a conta de novo.");
  if (r.status === 403) {
    const t = await r.text();
    if (/insufficient|scope/i.test(t)) throw new SemPermissao("ver as turmas e as tarefas do Classroom");
    if (/accessNotConfigured|SERVICE_DISABLED/.test(t)) throw new Error("O Classroom não está ligado no cadastro do Órbita no Google (isso é do lado de quem publica o Órbita).");
    // Conta da faculdade: o administrador pode não deixar apps de fora lerem o Classroom.
    throw new Error("O Classroom não deixou o Órbita ler as tarefas. Se for uma conta da faculdade, pode ser que a faculdade não permita apps de fora; fale com o suporte de TI.");
  }
  if (!r.ok) throw new Error(`O Classroom respondeu com o código ${r.status}. Tente de novo.`);
  return (await r.json()) as T;
}

const TURMAS_DE_EXEMPLO: Turma[] = [
  { id: "t1", nome: "Neuropsicologia", link: "https://classroom.google.com/c/t1" },
  { id: "t2", nome: "Psicologia do Desenvolvimento", link: "https://classroom.google.com/c/t2" },
];

export async function listarTurmas(): Promise<Turma[]> {
  if (simulado()) { await acessoGoogle(); return TURMAS_DE_EXEMPLO; }
  const d = await pedir<{ courses?: { id: string; name?: string; section?: string; alternateLink?: string }[] }>("courses?studentId=me&courseStates=ACTIVE&pageSize=50");
  return (d.courses ?? []).map((c) => ({ id: c.id, nome: [c.name, c.section].filter(Boolean).join(" · ") || "Turma", link: c.alternateLink ?? "https://classroom.google.com/" }));
}

export async function listarTarefas(turmas: Turma[]): Promise<TarefaClassroom[]> {
  if (simulado()) {
    const dia = 86_400_000, hoje = Date.now();
    return ordenarTarefas([
      ...juntarTarefas(TURMAS_DE_EXEMPLO[0], [{ id: "w1", title: "Resenha: memória de trabalho", dueDate: dataGoogle(hoje + 3 * dia), dueTime: { hours: 23, minutes: 59 }, alternateLink: "https://classroom.google.com/c/t1/a/w1/details" }, { id: "w2", title: "Fichamento do capítulo 2", dueDate: dataGoogle(hoje - 10 * dia), alternateLink: "https://classroom.google.com/c/t1/a/w2/details" }], [{ courseWorkId: "w2", state: "TURNED_IN" }]),
      ...juntarTarefas(TURMAS_DE_EXEMPLO[1], [{ id: "w3", title: "Mapa mental: Piaget", dueDate: dataGoogle(hoje + 9 * dia), alternateLink: "https://classroom.google.com/c/t2/a/w3/details" }], []),
    ]);
  }
  const todas: TarefaClassroom[] = [];
  for (const t of turmas) {
    const [w, e] = await Promise.all([
      pedir<{ courseWork?: TrabalhoGoogle[] }>(`courses/${encodeURIComponent(t.id)}/courseWork?courseWorkStates=PUBLISHED&pageSize=60`),
      pedir<{ studentSubmissions?: EntregaGoogle[] }>(`courses/${encodeURIComponent(t.id)}/courseWork/-/studentSubmissions?userId=me&pageSize=200`).catch(() => ({ studentSubmissions: [] })),
    ]);
    todas.push(...juntarTarefas(t, w.courseWork ?? [], e.studentSubmissions ?? []));
  }
  return ordenarTarefas(todas);
}

function dataGoogle(ms: number): DataGoogle {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// ---------- Prazos na agenda do Órbita ----------
const CHAVE_AGENDA = "conector.classroom.agenda";

/** O compromisso de dia inteiro no dia do prazo (no fuso daqui), com o link nas notas. */
export function eventoDaTarefa(t: TarefaClassroom): Evento | null {
  if (t.prazo === null) return null;
  const d = new Date(t.prazo);
  const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return { id: "", titulo: `Entregar: ${t.titulo} (${t.turma})`, inicio, fim: null, diaInteiro: true, repeticao: null, modelo: false, notas: `Prazo no Classroom: até ${hora}.\n${t.link}`, excecoes: [] };
}

export async function tarefasNaAgenda(): Promise<Record<string, string>> {
  const v = await api.lerValor(CHAVE_AGENDA).catch(() => null);
  return v && typeof v === "object" ? (v as Record<string, string>) : {};
}

/** Põe o prazo na agenda (uma vez por tarefa). Devolve false se já estava. */
export async function porNaAgenda(t: TarefaClassroom): Promise<boolean> {
  const ja = await tarefasNaAgenda();
  if (ja[t.id]) return false;
  const ev = eventoDaTarefa(t);
  if (!ev) return false;
  const salvo = await api.salvarEvento(ev);
  await api.gravarValor(CHAVE_AGENDA, { ...ja, [t.id]: salvo.id });
  return true;
}
