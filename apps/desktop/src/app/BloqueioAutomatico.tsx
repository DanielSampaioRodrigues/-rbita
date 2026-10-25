import { useEffect, useRef } from "react";
import { useFoco } from "../foco/Foco";

/** Avisa a tela de desbloqueio por que o Órbita foi bloqueado (nada muda sem aviso). */
export const CHAVE_MOTIVO = "orbita.bloqueado-por-tempo";

const EVENTOS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

/**
 * Bloqueia sozinho depois de `minutos` sem uso (0 = nunca). Não bloqueia
 * enquanto o timer de foco corre: quem está concentrado pode passar muito
 * tempo sem tocar no computador.
 */
export function BloqueioAutomatico({ minutos, aoBloquear }: { minutos: number; aoBloquear: () => void }) {
  const { estado } = useFoco();
  const ultimoUso = useRef(Date.now());
  const focoCorrendo = estado.terminaEm !== null;

  useEffect(() => {
    if (!minutos) return;
    ultimoUso.current = Date.now();
    const usou = () => (ultimoUso.current = Date.now());
    EVENTOS.forEach((e) => window.addEventListener(e, usou, { passive: true }));
    const conferir = setInterval(() => {
      if (focoCorrendo) return void (ultimoUso.current = Date.now());
      if (Date.now() - ultimoUso.current >= minutos * 60_000) {
        try {
          sessionStorage.setItem(CHAVE_MOTIVO, String(minutos));
        } catch {
          // Sem armazenamento: só não mostra o motivo.
        }
        aoBloquear();
      }
    }, 15_000);
    return () => {
      EVENTOS.forEach((e) => window.removeEventListener(e, usou));
      clearInterval(conferir);
    };
  }, [minutos, focoCorrendo, aoBloquear]);

  return null;
}

/** Lê o motivo do último bloqueio automático (sem apagar: a tela apaga depois de mostrar). */
export function motivoDoBloqueio(): number | null {
  try {
    const v = sessionStorage.getItem(CHAVE_MOTIVO);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function esquecerMotivo() {
  try {
    sessionStorage.removeItem(CHAVE_MOTIVO);
  } catch {
    // nada a fazer
  }
}
