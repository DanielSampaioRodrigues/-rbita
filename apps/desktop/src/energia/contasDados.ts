// "O que gasta / o que repõe", "meus sinais de sobrecarga", o kit de recuperação
// sensorial e a pergunta da camuflagem (custo de parecer "normal").
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
  /** Kit de recuperação sensorial: o que ajuda a baixar a entrada sensorial. */
  kit: ItemKit[];
  /** Momentos em que a pessoa apertou "Usar agora" num item do kit. */
  usosKit: { itemId: string; momento: number }[];
  /** Dia → quanto precisou se camuflar (pergunta opcional ao registrar o dia). */
  camuflagem: Record<string, Camuflagem>;
}

export interface ItemKit {
  id: string;
  nome: string;
}

export const CAMUFLAGENS = ["nada", "pouco", "muito"] as const;
export type Camuflagem = (typeof CAMUFLAGENS)[number];

export const PESOS = [-3, -2, -1, 1, 2, 3] as const;
const DIAS_GUARDADOS = 90;
const SENTIDOS_GUARDADOS = 200;
const USOS_GUARDADOS = 300;
/** Onde ficavam antes (localStorage). */
export const CHAVE_ANTIGA = "orbita.energia.contas";

export const VAZIO: DadosEnergia = { atividades: [], feitos: {}, sinais: [], sentidos: [], kit: [], usosKit: [], camuflagem: {} };

const DIA = /^\d{4}-\d{2}-\d{2}$/;

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
      if (DIA.test(dia) && Array.isArray(ids)) feitos[dia] = ids.filter((x): x is string => typeof x === "string");
    }
  }
  const sinais = Array.isArray(b.sinais)
    ? b.sinais.filter((s): s is Sinal => !!s && typeof s.id === "string" && typeof s.texto === "string" && s.texto.trim() !== "")
    : [];
  const sentidos = Array.isArray(b.sentidos)
    ? b.sentidos.filter((s): s is DadosEnergia["sentidos"][number] => !!s && typeof s.sinalId === "string" && typeof s.momento === "number")
    : [];
  const kit = Array.isArray(b.kit)
    ? b.kit
        .filter((k): k is ItemKit => !!k && typeof k.id === "string" && typeof k.nome === "string" && k.nome.trim() !== "")
        .map((k) => ({ id: k.id, nome: k.nome.trim() }))
    : [];
  const usosKit = Array.isArray(b.usosKit)
    ? b.usosKit.filter((u): u is DadosEnergia["usosKit"][number] => !!u && typeof u.itemId === "string" && typeof u.momento === "number")
    : [];
  const camuflagem: Record<string, Camuflagem> = {};
  if (b.camuflagem && typeof b.camuflagem === "object") {
    for (const [dia, v] of Object.entries(b.camuflagem as Record<string, unknown>)) {
      if (DIA.test(dia) && (CAMUFLAGENS as readonly unknown[]).includes(v)) camuflagem[dia] = v as Camuflagem;
    }
  }
  return { atividades, feitos, sinais, sentidos, kit, usosKit, camuflagem };
}

/** Tira dias muito antigos e anotações demais, para o armazenamento não crescer sem fim. */
export function podar(d: DadosEnergia, hoje: string): DadosEnergia {
  const limite = new Date(`${hoje}T00:00`);
  limite.setDate(limite.getDate() - DIAS_GUARDADOS);
  const corte = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}-${String(limite.getDate()).padStart(2, "0")}`;
  const feitos = Object.fromEntries(Object.entries(d.feitos).filter(([dia, ids]) => dia >= corte && ids.length > 0));
  const camuflagem = Object.fromEntries(Object.entries(d.camuflagem).filter(([dia]) => dia >= corte));
  return { ...d, feitos, camuflagem, sentidos: d.sentidos.slice(-SENTIDOS_GUARDADOS), usosKit: d.usosKit.slice(-USOS_GUARDADOS) };
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

/** Dia ("AAAA-MM-DD") de um momento, no horário local. */
export function diaDe(momento: number): string {
  const d = new Date(momento);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Algo sugerido para repor: uma atividade que repõe ou um item do kit sensorial. */
export interface Sugestao {
  id: string;
  nome: string;
  origem: "atividade" | "kit";
}

/**
 * Uma coisa que costuma repor e ainda não foi feita hoje: uma atividade que repõe
 * ou um item do kit de recuperação sensorial.
 * Prefere a que a pessoa usou em mais dias; no empate, a que repõe mais
 * (um item do kit conta como "repõe").
 */
export function sugerirReposicao(d: DadosEnergia, hoje: string): Sugestao | null {
  const feitasHoje = new Set(d.feitos[hoje] ?? []);
  const dias = new Map<string, Set<string>>();
  const contar = (id: string, dia: string) => {
    if (dia === hoje) return;
    if (!dias.has(id)) dias.set(id, new Set());
    dias.get(id)!.add(dia);
  };
  for (const [dia, ids] of Object.entries(d.feitos)) for (const id of ids) contar(id, dia);
  const kitHoje = new Set<string>();
  for (const u of d.usosKit) {
    const dia = diaDe(u.momento);
    if (dia === hoje) kitHoje.add(u.itemId);
    contar(u.itemId, dia);
  }
  const candidatas = [
    ...d.atividades.filter((a) => a.peso > 0 && !feitasHoje.has(a.id)).map((a) => ({ id: a.id, nome: a.nome, peso: a.peso, origem: "atividade" as const })),
    ...d.kit.filter((k) => !kitHoje.has(k.id)).map((k) => ({ id: k.id, nome: k.nome, peso: 2, origem: "kit" as const })),
  ];
  const vezes = (id: string) => dias.get(id)?.size ?? 0;
  candidatas.sort((a, b) => vezes(b.id) - vezes(a.id) || b.peso - a.peso || a.nome.localeCompare(b.nome));
  const c = candidatas[0];
  return c ? { id: c.id, nome: c.nome, origem: c.origem } : null;
}

/** Anota que um item do kit foi usado agora. */
export function usarKit(d: DadosEnergia, itemId: string, momento: number): DadosEnergia {
  return { ...d, usosKit: [...d.usosKit, { itemId, momento }] };
}

/** Responde (ou apaga, com null) a pergunta da camuflagem de um dia. */
export function marcarCamuflagem(d: DadosEnergia, dia: string, valor: Camuflagem | null): DadosEnergia {
  const camuflagem = { ...d.camuflagem };
  if (valor) camuflagem[dia] = valor;
  else delete camuflagem[dia];
  return { ...d, camuflagem };
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
