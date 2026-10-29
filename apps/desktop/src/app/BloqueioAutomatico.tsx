import { useEffect, useRef } from "react";
import { useFoco } from "../foco/Foco";

/** Avisa a tela de desbloqueio por que o Órbita foi bloqueado (nada muda sem aviso). */
export const CHAVE_MOTIVO = "orbita.bloqueado-por-tempo";

const EVENTOS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

/** Já passou o tempo sem uso? Conta por data e hora, então vale mesmo se o app ficou parado em segundo plano. */
export function passouDoTempo(agora: number, ultimoUso: number, minutos: number): boolean {
  return minutos > 0 && agora - ultimoUso >= minutos * 60_000;
}

/**
 * Bloqueia sozinho depois de `minutos` sem uso (0 = nunca). Não bloqueia
 * enquanto o timer de foco corre: quem está concentrado pode passar muito
 * tempo sem tocar no computador.
 *
 * Não usa `setTimeout` longo (estoura em ~24,8 dias e o navegador atrasa timers
 * em segundo plano). Guarda a hora do último uso e compara com a hora de agora:
 * a cada 15 s, ao voltar para a janela e antes de registrar um novo uso.
 */
export function BloqueioAutomatico({ minutos, aoBloquear }: { minutos: number; aoBloquear: () => void }) {
  const { estado } = useFoco();
  const ultimoUso = useRef(Date.now());
  const focoCorrendo = estado.terminaEm !== null;

  useEffect(() => {
    if (!minutos) return;
    ultimoUso.current = Date.now();
    let bloqueou = false;
    const bloquear = () => {
      if (bloqueou) return;
      bloqueou = true;
      try {
        sessionStorage.setItem(CHAVE_MOTIVO, String(minutos));
      } catch {
        // Sem armazenamento: só não mostra o motivo.
      }
      aoBloquear();
    };
    /** Confere o tempo; com foco correndo, conta como uso. Devolve true se bloqueou. */
    const conferir = () => {
      const agora = Date.now();
      if (focoCorrendo) {
        ultimoUso.current = agora;
        return false;
      }
      if (passouDoTempo(agora, ultimoUso.current, minutos)) {
        bloquear();
        return true;
      }
      return false;
    };
    // Um gesto depois de passar o tempo (app voltando de segundo plano) bloqueia, não "salva" a sessão.
    const usou = () => {
      if (!conferir()) ultimoUso.current = Date.now();
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible") conferir();
    };
    EVENTOS.forEach((e) => window.addEventListener(e, usou, { passive: true }));
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    const intervalo = setInterval(conferir, 15_000);
    return () => {
      EVENTOS.forEach((e) => window.removeEventListener(e, usou));
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
      clearInterval(intervalo);
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
