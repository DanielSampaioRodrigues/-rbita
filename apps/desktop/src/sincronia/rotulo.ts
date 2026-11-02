// Os textos literais do aviso de sincronização, a partir do estado do maestro.
import { textos } from "../textos/pt-BR";
import type { EstadoSincronia } from "./maestro";

const t = textos.sincronia;

/** "1 min", "2 h", "3 dias" desde `desde`. Abaixo de 1 minuto, null ("agora"). */
export function tempoDesde(desde: number, agora: number): string | null {
  const min = Math.floor(Math.max(0, agora - desde) / 60_000);
  if (min < 1) return null;
  if (min < 60) return t.minutos(min);
  const h = Math.floor(min / 60);
  if (h < 24) return t.horas(h);
  return t.dias(Math.floor(h / 24));
}

/**
 * O que o aviso mostra. `sincronizando` só aparece se o ciclo já demora (quem chama decide):
 * os ciclos de todo minuto costumam ser rápidos e não precisam piscar na tela.
 */
export function rotuloDoAviso(e: EstadoSincronia, agora: number, mostrarSincronizando: boolean): string {
  switch (e.fase) {
    case "sem-internet":
      return t.semInternet;
    case "entrar-de-novo":
      return t.entrarDeNovo;
    case "erro":
      return t.erro(e.motivo ?? "erro inesperado");
    case "sincronizando":
      if (mostrarSincronizando || e.ultima === null) return t.sincronizando;
      break;
  }
  if (e.ultima === null) return t.sincronizando;
  const quanto = tempoDesde(e.ultima, agora);
  return quanto === null ? t.agora : t.ha(quanto);
}

/** "hoje às 14:32" ou a data e a hora, para o painel. */
export function quandoFoi(ms: number, agora: number): string {
  const d = new Date(ms);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date(agora).toDateString()) return t.hojeAs(hora);
  return `${d.toLocaleDateString("pt-BR")} ${hora}`;
}
