// Cartão com prazo na Agenda (escolha por cartão, desligada até a pessoa ligar). O
// compromisso acompanha o cartão: muda com o título, a data e a hora; sai quando o
// cartão é feito, arquivado, fica sem data ou é apagado (e volta se for desfeito).
// Os vínculos ficam no cofre de valores ("organizacao.agenda").
import { api, type CartaoOrg, type Evento } from "../api";
import { emFila } from "../app/fila";

const CHAVE = "organizacao.agenda";
/** Duração do compromisso quando o cartão tem hora. */
const MINUTOS = 30;

/** cartão → compromisso ("" = ligado, mas sem compromisso agora). */
export type Vinculos = Record<string, string>;

export async function lerVinculos(): Promise<Vinculos> {
  const v = await api.lerValor(CHAVE).catch(() => null);
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Vinculos) : {};
}

/** O compromisso de um cartão (ou nada, se não deve aparecer na Agenda). */
export function eventoDoCartao(c: CartaoOrg, quadro: string): Evento | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c.prazo || "");
  if (!m || c.feito || c.arquivado || !c.texto.trim()) return null;
  const h = /^(\d{1,2}):(\d{2})$/.exec(c.hora || "");
  const inicio = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h ? Number(h[1]) : 0, h ? Number(h[2]) : 0).getTime();
  return {
    id: "", titulo: c.texto.trim().slice(0, 200), inicio, fim: h ? inicio + MINUTOS * 60_000 : null, diaInteiro: !h,
    repeticao: null, modelo: false, notas: quadro ? `Da Minha organização (quadro "${quadro}").` : "Da Minha organização.", excecoes: [],
  };
}

/**
 * Põe, atualiza ou tira o compromisso do cartão. `ligar` muda a escolha; sem ele, só
 * acompanha (cartão que não está ligado fica como está).
 */
export function sincronizarCartao(c: CartaoOrg, quadro: string, ligar?: boolean): Promise<void> {
  return emFila(CHAVE, () => sincronizarAgora(c, quadro, ligar));
}
async function sincronizarAgora(c: CartaoOrg, quadro: string, ligar?: boolean): Promise<void> {
  const v = await lerVinculos();
  const ligado = ligar ?? c.id in v;
  if (!ligado && !(c.id in v)) return;
  const antes = v[c.id] || "";
  const ev = ligado ? eventoDoCartao(c, quadro) : null;
  // Se o compromisso guardado não existe mais (apagado na Agenda), cria outro.
  if (ev) v[c.id] = (await api.salvarEvento({ ...ev, id: antes }).catch(() => api.salvarEvento({ ...ev, id: "" }))).id;
  else {
    if (antes) await api.excluirEvento(antes).catch(() => {});
    if (ligado) v[c.id] = ""; else delete v[c.id];
  }
  await api.gravarValor(CHAVE, v);
}

/** Ao apagar o cartão, tira o compromisso dele. */
export function tirarCartao(id: string): Promise<void> {
  return emFila(CHAVE, () => tirarAgora(id));
}
async function tirarAgora(id: string): Promise<void> {
  const v = await lerVinculos();
  if (!(id in v)) return;
  if (v[id]) await api.excluirEvento(v[id]).catch(() => {});
  delete v[id];
  await api.gravarValor(CHAVE, v);
}
