// Gestos de toque do caderno, inspirados no Goodnotes, no Notability e no Procreate.
// Lógica pura (sem DOM): recebe os toques e diz quando houve um "toque" (dedos que
// encostam e saem rápido, sem arrastar) e quando houve um toque duplo.
//
// O caderno usa assim:
// - 2 dedos, 2 toques: desfazer;      - 3 dedos, 2 toques: refazer;
// - 1 dedo, 2 toques (com "só caneta"): aproximar ou voltar ao tamanho da página;
// - 4 dedos, 1 toque: esconder ou mostrar as barras (tela limpa).

/** Tempo máximo do primeiro dedo encostar até o último sair, para valer como toque (ms). */
export const TOQUE_MAX_MS = 320;
/** Quanto um dedo pode andar e ainda ser toque, em px de tela. */
export const TOQUE_MAX_MOV = 16;
/** Intervalo máximo entre dois toques para virar toque duplo (ms). */
export const DUPLO_MAX_MS = 380;

export interface GestoToque {
  tipo: "toque" | "duplo";
  /** Quantos dedos encostaram juntos. */
  dedos: number;
  /** Centro dos dedos, em px de tela (para o zoom no ponto). */
  x: number;
  y: number;
}

interface Sessao {
  inicio: number;
  max: number;
  andou: boolean;
  ativos: Map<number, { x0: number; y0: number }>;
  somaX: number;
  somaY: number;
  n: number;
}

export interface DetectorDeToques {
  descer(id: number, x: number, y: number, t: number): void;
  mover(id: number, x: number, y: number): void;
  /** Devolve o gesto quando o último dedo sai e foi um toque; senão, null. */
  subir(id: number, t: number): GestoToque | null;
  /** Desiste da sessão (ex.: a caneta encostou, ou virou pinça). */
  cancelar(): void;
}

export function criarDetectorDeToques(): DetectorDeToques {
  let s: Sessao | null = null;
  let ultimo: { dedos: number; t: number } | null = null;
  let cancelada = false;
  return {
    descer(id, x, y, t) {
      if (!s) {
        s = { inicio: t, max: 0, andou: false, ativos: new Map(), somaX: 0, somaY: 0, n: 0 };
        cancelada = false;
      }
      s.ativos.set(id, { x0: x, y0: y });
      s.max = Math.max(s.max, s.ativos.size);
      s.somaX += x;
      s.somaY += y;
      s.n++;
    },
    mover(id, x, y) {
      const a = s?.ativos.get(id);
      if (!s || !a) return;
      if (Math.hypot(x - a.x0, y - a.y0) > TOQUE_MAX_MOV) s.andou = true;
    },
    subir(id, t) {
      if (!s) return null;
      s.ativos.delete(id);
      if (s.ativos.size > 0) return null;
      const fim = s;
      s = null;
      if (cancelada || fim.andou || t - fim.inicio > TOQUE_MAX_MS) {
        ultimo = null;
        return null;
      }
      const x = fim.somaX / Math.max(1, fim.n);
      const y = fim.somaY / Math.max(1, fim.n);
      if (ultimo && ultimo.dedos === fim.max && t - ultimo.t <= DUPLO_MAX_MS) {
        ultimo = null;
        return { tipo: "duplo", dedos: fim.max, x, y };
      }
      ultimo = { dedos: fim.max, t };
      return { tipo: "toque", dedos: fim.max, x, y };
    },
    cancelar() {
      cancelada = true;
      ultimo = null;
    },
  };
}

/** O que cada gesto faz no caderno. `null`: nada. */
export type AcaoGesto = "desfazer" | "refazer" | "zoom" | "tela-limpa";
export function acaoDoGesto(g: GestoToque, soCaneta: boolean): AcaoGesto | null {
  if (g.tipo === "duplo" && g.dedos === 2) return "desfazer";
  if (g.tipo === "duplo" && g.dedos === 3) return "refazer";
  if (g.tipo === "duplo" && g.dedos === 1 && soCaneta) return "zoom";
  if (g.tipo === "toque" && g.dedos === 4) return "tela-limpa";
  return null;
}
