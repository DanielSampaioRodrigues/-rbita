// "O que gasta / o que repõe" e "meus sinais de sobrecarga".
// Ideia da contabilidade de energia (Maja Toudal): cada coisa do dia tira ou põe energia,
// e a lista é da pessoa. Ver docs/pesquisa-energia.md.
//
// São dados pessoais: ficam no cofre de valores (banco criptografado, entra no
// backup), chave "energia.contas". Antes ficavam no localStorage; migram sozinhos.
import { criarLoja } from "../valores";

export interface Atividade {
  id: string;
  nome: string;
  /** De −3 (gasta muito) a +3 (repõe muito). Nunca 0. */
  peso: number;
}

export interface Sinal {
  id: string;
  texto: string;
}

export interface DadosEnergia {
  atividades: Atividade[];
  /** Dia ("AAAA-MM-DD") → ids das atividades marcadas naquele dia. */
  feitos: Record<string, string[]>;
  sinais: Sinal[];
  /** Momentos em que a pessoa apertou "Estou sentindo isso". */
  sentidos: { sinalId: string; momento: number }[];
}

export const PESOS = [-3, -2, -1, 1, 2, 3] as const;
const DIAS_GUARDADOS = 90;
const SENTIDOS_GUARDADOS = 200;
/** Onde ficavam antes (localStorage). */
export const CHAVE_ANTIGA = "orbita.energia.contas";

export const VAZIO: DadosEnergia = { atividades: [], feitos: {}, sinais: [], sentidos: [] };

export function limitarPeso(p: number): number {
  const n = Math.round(Number(p));
  if (!Number.isFinite(n) || n === 0) return -1;
  return Math.max(-3, Math.min(3, n));
}

/** Aceita qualquer coisa vinda do armazenamento e devolve dados válidos. */
export function validar(bruto: unknown): DadosEnergia {
  if (!bruto || typeof bruto !== "object") return structuredClone(VAZIO);
  const b = bruto as Partial<Record<keyof DadosEnergia, unknown>>;
  const atividades = Array.isArray(b.atividades)
    ? b.atividades
        .filter((a): a is Atividade => !!a && typeof a.id === "string" && typeof a.nome === "string" && a.nome.trim() !== "")
        .map((a) => ({ id: a.id, nome: a.nome.trim(), peso: limitarPeso(a.peso) }))
    : [];
  const feitos: Record<string, string[]> = {};
  if (b.feitos && typeof b.feitos === "object") {
    for (const [dia, ids] of Object.entries(b.feitos as Record<string, unknown>)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && Array.isArray(ids)) feitos[dia] = ids.filter((x): x is string => typeof x === "string");
    }
  }
  const sinais = Array.isArray(b.sinais)
    ? b.sinais.filter((s): s is Sinal => !!s && typeof s.id === "string" && typeof s.texto === "string" && s.texto.trim() !== "")
    : [];
  const sentidos = Array.isArray(b.sentidos)
    ? b.sentidos.filter((s): s is DadosEnergia["sentidos"][number] => !!s && typeof s.sinalId === "string" && typeof s.momento === "number")
    : [];
  return { atividades, feitos, sinais, sentidos };
}

/** Tira dias muito antigos e anotações demais, para o armazenamento não crescer sem fim. */
export function podar(d: DadosEnergia, hoje: string): DadosEnergia {
  const limite = new Date(`${hoje}T00:00`);
  limite.setDate(limite.getDate() - DIAS_GUARDADOS);
  const corte = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}-${String(limite.getDate()).padStart(2, "0")}`;
  const feitos = Object.fromEntries(Object.entries(d.feitos).filter(([dia, ids]) => dia >= corte && ids.length > 0));
  return { ...d, feitos, sentidos: d.sentidos.slice(-SENTIDOS_GUARDADOS) };
}

/** Atividades, marcações do dia, sinais e "estou sentindo isso", no cofre. */
export const lojaContas = criarLoja<DadosEnergia>({
  chave: "energia.contas",
  antiga: CHAVE_ANTIGA,
  vazio: () => structuredClone(VAZIO),
  validar,
});

export function novoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface Saldo {
  gastou: number;
  repos: number;
  /** repos − gastou */
  saldo: number;
}

export function saldoDoDia(atividades: Atividade[], ids: string[]): Saldo {
  let gastou = 0;
  let repos = 0;
  for (const id of new Set(ids)) {
    const a = atividades.find((x) => x.id === id);
    if (!a) continue;
    if (a.peso < 0) gastou += -a.peso;
    else repos += a.peso;
  }
  return { gastou, repos, saldo: repos - gastou };
}

export type Balanco = "vazio" | "gastou-mais" | "equilibrado" | "repos-mais";

/** Em palavras, nunca em número solto: "gastou mais", "equilibrado", "repôs mais". */
export function balanco(s: Saldo): Balanco {
  if (s.gastou === 0 && s.repos === 0) return "vazio";
  if (Math.abs(s.saldo) <= 1) return "equilibrado";
  return s.saldo < 0 ? "gastou-mais" : "repos-mais";
}

/**
 * Uma coisa que costuma repor e ainda não foi feita hoje.
 * Prefere a que a pessoa mais marcou nos outros dias; no empate, a que repõe mais.
 */
export function sugerirReposicao(d: DadosEnergia, hoje: string): Atividade | null {
  const feitasHoje = new Set(d.feitos[hoje] ?? []);
  const vezes = new Map<string, number>();
  for (const [dia, ids] of Object.entries(d.feitos)) {
    if (dia === hoje) continue;
    for (const id of new Set(ids)) vezes.set(id, (vezes.get(id) ?? 0) + 1);
  }
  const candidatas = d.atividades.filter((a) => a.peso > 0 && !feitasHoje.has(a.id));
  candidatas.sort((a, b) => (vezes.get(b.id) ?? 0) - (vezes.get(a.id) ?? 0) || b.peso - a.peso || a.nome.localeCompare(b.nome));
  return candidatas[0] ?? null;
}

/** Marca ou desmarca uma atividade num dia. */
export function marcar(d: DadosEnergia, dia: string, id: string, feito: boolean): DadosEnergia {
  const atuais = new Set(d.feitos[dia] ?? []);
  if (feito) atuais.add(id);
  else atuais.delete(id);
  return { ...d, feitos: { ...d.feitos, [dia]: [...atuais] } };
}

/** Última vez que a pessoa sentiu este sinal, ou null. */
export function ultimaVez(d: DadosEnergia, sinalId: string): number | null {
  for (let i = d.sentidos.length - 1; i >= 0; i--) if (d.sentidos[i].sinalId === sinalId) return d.sentidos[i].momento;
  return null;
}
