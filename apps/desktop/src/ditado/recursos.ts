import { useEffect, useSyncExternalStore } from "react";
import { api, type EstadoDitado, type ProvedorVisivel } from "../api";

/**
 * O que os campos de texto precisam saber para mostrar o microfone e a
 * revisão: se o ditado está instalado, se a IA de revisão está escolhida e
 * qual campo está gravando agora (só um por vez).
 */
interface Recursos {
  ditado: EstadoDitado | null;
  revisor: ProvedorVisivel | null;
  bloquearSensivel: boolean;
  gravandoEm: string | null;
}

let atual: Recursos = { ditado: null, revisor: null, bloquearSensivel: false, gravandoEm: null };
let carregado = false;
const ouvintes = new Set<() => void>();

function mudar(parte: Partial<Recursos>) {
  atual = { ...atual, ...parte };
  ouvintes.forEach((f) => f());
}

/** Lê de novo o estado do ditado e da IA (chamado pelos Ajustes depois de mudanças). */
export async function recarregarRecursos() {
  carregado = true;
  const [ditado, ia] = await Promise.all([api.ditadoEstado().catch(() => null), api.estadoIa().catch(() => null)]);
  mudar({
    ditado,
    revisor: ia?.provedores.find((p) => p.id === ia.funcoes.revisao) ?? null,
    bloquearSensivel: ia?.bloquearSensivel ?? false,
  });
}

export const marcarGravando = (campo: string | null) => mudar({ gravandoEm: campo });

export function useRecursos(): Recursos {
  useEffect(() => {
    if (!carregado) void recarregarRecursos();
  }, []);
  return useSyncExternalStore(
    (f) => (ouvintes.add(f), () => void ouvintes.delete(f)),
    () => atual,
  );
}
