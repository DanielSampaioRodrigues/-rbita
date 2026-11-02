import type { Projeto } from "../api";
import { textoSimples } from "../componentes/textoSimples";
import { textos } from "../textos/pt-BR";

const t = textos.projetos.tempo;
const DIA = 86_400_000;

const inicioDoDia = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** "hoje", "ontem", "há 3 dias", "há 2 semanas", "há 4 meses". Conta dias do calendário, não horas. */
export function haQuanto(ms: number, agora = Date.now()): string {
  const dias = Math.max(0, Math.round((inicioDoDia(agora) - inicioDoDia(ms)) / DIA));
  if (dias === 0) return t.hoje;
  if (dias === 1) return t.ontem;
  if (dias < 14) return t.dias(dias);
  if (dias < 60) return t.semanas(Math.floor(dias / 7));
  return t.meses(Math.floor(dias / 30));
}

/** Corta um texto longo no fim de uma palavra. */
export function resumir(texto: string, max = 80): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= max) return limpo;
  const corte = limpo.slice(0, max);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > max * 0.6 ? corte.slice(0, espaco) : corte).replace(/[\s,.;:—-]+$/, "")}…`;
}

/** A última coisa anotada: o próximo passo, ou o começo da anotação. */
export function ultimaCoisa(p: Pick<Projeto, "ondeParei">): string | null {
  const o = p.ondeParei;
  if (!o) return null;
  if (o.proximoPasso.trim()) return resumir(o.proximoPasso);
  const texto = textoSimples(o.texto);
  return texto.trim() ? resumir(texto) : null;
}

/** "Pausado há 3 dias — última coisa: revisar o capítulo 2". Null se não está pausado. */
export function linhaPausa(p: Pick<Projeto, "estado" | "pausadoEm" | "ondeParei">, agora = Date.now()): string | null {
  if (p.estado !== "pausado") return null;
  const quando = p.pausadoEm ? t.pausadoHa(haQuanto(p.pausadoEm, agora)) : t.pausado;
  const ultima = ultimaCoisa(p);
  return ultima ? `${quando} — ${t.ultimaCoisa(ultima)}` : quando;
}

/**
 * Quando vence o lembrete "rever a cada N meses": N meses do calendário depois da última
 * vez que a pessoa disse "Olhei". Null se o lembrete está desligado.
 */
export function proximaRevisao(p: Pick<Projeto, "revisarMeses" | "revisadoEm" | "criadoEm">): number | null {
  if (!p.revisarMeses) return null;
  const d = new Date(p.revisadoEm ?? p.criadoEm);
  const dia = d.getDate();
  d.setMonth(d.getMonth() + p.revisarMeses, 1);
  // 31 de janeiro + 1 mês = último dia de fevereiro, sem pular para março.
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return inicioDoDia(d.getTime());
}

/** Já passou a data do lembrete? Só vale para projetos em uso. */
export function horaDeOlhar(p: Pick<Projeto, "estado" | "revisarMeses" | "revisadoEm" | "criadoEm">, agora = Date.now()): boolean {
  if (p.estado !== "em_uso") return false;
  const quando = proximaRevisao(p);
  return quando !== null && agora >= quando;
}

/** Conta só os ativos: em uso, pausados e concluídos ficam fora do limite. */
export function contarNoLimite(projetos: Pick<Projeto, "estado">[]): number {
  return projetos.filter((p) => p.estado === "ativo").length;
}
