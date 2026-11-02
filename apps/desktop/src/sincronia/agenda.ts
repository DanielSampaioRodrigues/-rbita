// Quando o maestro sincroniza (ver docs/decisoes/0012-sincronizacao.md, etapa 2b):
// ao ligar (cofre aberto), a cada 60 s com o app visível, ao voltar para o app e
// ~3 s depois de uma mudança feita aqui (a espera junta várias mudanças seguidas).
import type { Maestro } from "./maestro";

export interface OpcoesAgenda {
  intervaloMs?: number;
  esperaMudancaMs?: number;
  /** Voltar para o app logo depois de um ciclo não pede outro (focus e visibilitychange vêm juntos). */
  folgaVoltarMs?: number;
  documento?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  janela?: Pick<Window, "addEventListener" | "removeEventListener">;
}

export interface Agenda {
  /** Avise depois de uma mudança feita neste aparelho. */
  mudouAqui(): void;
  /** "Sincronizar agora": roda já (ou logo depois do ciclo em curso). */
  agora(): Promise<void>;
  parar(): void;
}

export function agendarSincronia(m: Maestro, o: OpcoesAgenda = {}): Agenda {
  const intervalo = o.intervaloMs ?? 60_000;
  const espera = o.esperaMudancaMs ?? 3_000;
  const folga = o.folgaVoltarMs ?? 5_000;
  const doc = o.documento ?? globalThis.document;
  const jan = o.janela ?? globalThis.window;
  let ultimoPedido = 0;
  let esperando: ReturnType<typeof setTimeout> | null = null;
  let parado = false;

  const visivel = () => !doc || doc.visibilityState !== "hidden";
  const automatico = () => {
    if (parado || !visivel()) return;
    ultimoPedido = Date.now();
    void m.sincronizar({ repetir: false });
  };
  const aoVoltar = () => {
    if (Date.now() - ultimoPedido < folga) return;
    automatico();
  };
  const relogio = setInterval(automatico, intervalo);
  doc?.addEventListener("visibilitychange", aoVoltar);
  jan?.addEventListener("focus", aoVoltar);
  automatico();

  return {
    mudouAqui() {
      if (parado) return;
      if (esperando) clearTimeout(esperando);
      esperando = setTimeout(() => {
        esperando = null;
        if (parado) return;
        ultimoPedido = Date.now();
        void m.sincronizar({ repetir: true });
      }, espera);
    },
    async agora() {
      if (parado) return;
      ultimoPedido = Date.now();
      await m.sincronizar({ repetir: true });
    },
    parar() {
      parado = true;
      clearInterval(relogio);
      if (esperando) clearTimeout(esperando);
      doc?.removeEventListener("visibilitychange", aoVoltar);
      jan?.removeEventListener("focus", aoVoltar);
      m.parar();
    },
  };
}
