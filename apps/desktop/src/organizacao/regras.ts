// Regras de "Minha organização" sem tela: completar dados antigos, prazo,
// checklist, filtro e ordem. Ficam aqui para serem testadas sozinhas.
import type { CartaoOrg, Coluna, Quadro } from "../api";

/** Forma de ver o quadro. Quadros antigos de estilo "lista" abrem na vista Lista. */
export function vistaDe(q: Quadro): "quadro" | "lista" {
  if (q.vista === "quadro" || q.vista === "lista") return q.vista;
  return q.estilo === "lista" ? "lista" : "quadro";
}

/** Cartão com todos os campos (dados antigos não têm os novos). */
export function completarCartao(c: CartaoOrg): Required<CartaoOrg> {
  return {
    ...c,
    hora: c.hora ?? "",
    descricao: c.descricao ?? "",
    checklists: c.checklists ?? [],
    etiquetas: c.etiquetas ?? [],
    capa: c.capa ?? { tipo: "", valor: "" },
    arquivado: c.arquivado ?? false,
    anexos: c.anexos ?? 0,
  };
}

export const colunaVisivel = (c: Coluna) => !c.arquivada;

// ── Prazo ──────────────────────────────────────────────────────────────────

export type SituacaoPrazo = "" | "feito" | "atrasado" | "hoje" | "perto" | "normal";

const DIA = 24 * 60 * 60 * 1000;

/** Meia-noite (hora local) do dia "AAAA-MM-DD". */
function diaDe(prazo: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(prazo);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Dias inteiros entre hoje e a data (negativo = já passou). */
export function diasAte(prazo: string, agora: Date): number | null {
  const d = diaDe(prazo);
  if (!d) return null;
  return Math.round((d.getTime() - inicioDoDia(agora).getTime()) / DIA);
}

/**
 * Como a data está: sem data (""), feito, passou da data, vence hoje, perto (até 2 dias) ou normal.
 * Com hora, "hoje" passa a "atrasado" depois da hora.
 */
export function situacaoPrazo(prazo: string, hora: string, feito: boolean, agora: Date): SituacaoPrazo {
  const dias = diasAte(prazo, agora);
  if (dias === null) return "";
  if (feito) return "feito";
  if (dias < 0) return "atrasado";
  if (dias === 0) {
    const h = /^(\d{1,2}):(\d{2})$/.exec(hora);
    if (h && agora.getHours() * 60 + agora.getMinutes() > Number(h[1]) * 60 + Number(h[2])) return "atrasado";
    return "hoje";
  }
  return dias <= 2 ? "perto" : "normal";
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "5 nov", "5 nov, 14:30"; com o ano só quando não é o ano de agora. */
export function textoPrazo(prazo: string, hora: string, agora: Date): string {
  const d = diaDe(prazo);
  if (!d) return "";
  let s = `${d.getDate()} ${MESES[d.getMonth()]}`;
  if (d.getFullYear() !== agora.getFullYear()) s += ` ${d.getFullYear()}`;
  if (/^\d{1,2}:\d{2}$/.test(hora)) s += `, ${hora}`;
  return s;
}

// ── Checklist ──────────────────────────────────────────────────────────────

export function progresso(c: Pick<CartaoOrg, "checklists">): { feitos: number; total: number } {
  let feitos = 0;
  let total = 0;
  for (const cl of c.checklists ?? []) {
    for (const i of cl.itens) {
      total++;
      if (i.feito) feitos++;
    }
  }
  return { feitos, total };
}

// ── Filtro ─────────────────────────────────────────────────────────────────

export interface Filtro {
  texto: string;
  etiquetas: string[];
  /** Vence nos próximos 7 dias (e os que já passaram da data). */
  semana: boolean;
  semFeitos: boolean;
}

export const filtroVazio = (): Filtro => ({ texto: "", etiquetas: [], semana: false, semFeitos: false });

/** Quantas condições estão ligadas. */
export function partesDoFiltro(f: Filtro): number {
  return (f.texto.trim() ? 1 : 0) + (f.etiquetas.length ? 1 : 0) + (f.semana ? 1 : 0) + (f.semFeitos ? 1 : 0);
}

/** Sem acento e em minúsculas, para buscar "acao" e achar "Ação". */
export const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O cartão aparece com este filtro? (As etiquetas valem se o cartão tiver qualquer uma das escolhidas.) */
export function passaNoFiltro(c: CartaoOrg, f: Filtro, agora: Date): boolean {
  const busca = normalizar(f.texto.trim());
  if (busca) {
    const onde = normalizar(`${c.texto}\n${c.descricao ?? ""}\n${(c.checklists ?? []).flatMap((cl) => [cl.nome, ...cl.itens.map((i) => i.texto)]).join("\n")}`);
    if (!onde.includes(busca)) return false;
  }
  if (f.etiquetas.length && !(c.etiquetas ?? []).some((e) => f.etiquetas.includes(e))) return false;
  if (f.semFeitos && c.feito) return false;
  if (f.semana) {
    const dias = diasAte(c.prazo, agora);
    if (dias === null || dias > 7) return false;
  }
  return true;
}

// ── Ordem ──────────────────────────────────────────────────────────────────

/**
 * Ordem completa de uma coluna depois de mover `id` numa parte visível dela.
 * `completa`: todos os cartões da coluna de destino, na ordem guardada (inclusive
 * os escondidos pelo filtro ou arquivados). `visivelNova`: a ordem nova só dos
 * visíveis. Os escondidos ficam onde estavam; o movido entra logo depois do
 * vizinho visível de cima (ou antes do primeiro visível, se foi para o topo).
 */
export function encaixarNaOrdem(completa: string[], visivelNova: string[], id: string): string[] {
  const resto = completa.filter((x) => x !== id);
  const visiveis = new Set(visivelNova);
  // Os visíveis (sem o movido) ficam na ordem nova; os escondidos, no lugar de antes.
  const outrosVisiveis = visivelNova.filter((x) => x !== id);
  let k = 0;
  const base = resto.map((x) => (visiveis.has(x) ? outrosVisiveis[k++] ?? x : x));
  const i = visivelNova.indexOf(id);
  if (i < 0) return [...base, id];
  if (i === 0) {
    const primeiro = visivelNova[1];
    const pos = primeiro ? base.indexOf(primeiro) : base.length;
    base.splice(pos < 0 ? base.length : pos, 0, id);
    return base;
  }
  const antes = base.indexOf(visivelNova[i - 1]);
  base.splice(antes + 1, 0, id);
  return base;
}
