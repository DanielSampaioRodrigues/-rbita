// Motor do traço à mão: transforma os pontos (com pressão) num contorno
// preenchido, pela biblioteca perfect-freehand, com cara de caneta de verdade.
// Puro — devolve o caminho SVG; a captura do ponteiro e o render ficam no app.

import { getStroke } from "perfect-freehand";
import type { Ferramenta, Ponto, Traco } from "./tipos";

export interface OpcoesFerramenta {
  /** Espessura base, em px. */
  tamanho: number;
  /** Quanto a pressão afina/engrossa (0 = espessura fixa). */
  afinar: number;
  suavizar: number;
  alisar: number;
  /** Opacidade do traço (marca-texto é translúcido). */
  opacidade: number;
  /** Pontas retas e espessura fixa (marca-texto); false = ponta de caneta. */
  achatado: boolean;
}

/** Ajuste de cada ferramenta. A borracha não desenha; o tamanho é só o cursor. */
export const FERRAMENTAS: Record<Ferramenta, OpcoesFerramenta> = {
  caneta: { tamanho: 3.5, afinar: 0.6, suavizar: 0.5, alisar: 0.5, opacidade: 1, achatado: false },
  lapis: { tamanho: 2.6, afinar: 0.45, suavizar: 0.6, alisar: 0.5, opacidade: 0.85, achatado: false },
  pincel: { tamanho: 7, afinar: 0.85, suavizar: 0.5, alisar: 0.4, opacidade: 1, achatado: false },
  marcatexto: { tamanho: 16, afinar: 0, suavizar: 0.5, alisar: 0.5, opacidade: 0.35, achatado: true },
  borracha: { tamanho: 18, afinar: 0, suavizar: 0.5, alisar: 0.5, opacidade: 1, achatado: true },
};

function media(a: number[], b: number[]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** Contorno (lista de pontos) → caminho SVG suave, fechado. */
export function caminhoSVG(pts: number[][]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}` : "";
  const f = (n: number) => n.toFixed(2);
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])} Q`;
  for (let i = 0; i < pts.length - 1; i++) {
    const m = media(pts[i], pts[i + 1]);
    d += ` ${f(pts[i][0])} ${f(pts[i][1])} ${f(m[0])} ${f(m[1])}`;
  }
  return d + " Z";
}

/** Caminho SVG do traço, pronto para `<path d>`. */
export function caminhoDeTraco(traco: Traco): string {
  const op = FERRAMENTAS[traco.ferramenta] ?? FERRAMENTAS.caneta;
  const afinar = traco.afinar ?? op.afinar;
  const contorno = getStroke(
    traco.pontos.map((p) => [p.x, p.y, p.p]),
    {
      size: traco.espessura || op.tamanho,
      thinning: afinar,
      smoothing: op.suavizar,
      streamline: traco.alisar ?? op.alisar,
      // Com caneta de verdade, usa a pressão gravada; senão, simula pela
      // velocidade (mouse e dedo não têm pressão).
      simulatePressure: afinar > 0 && !traco.pressao,
      last: true,
      start: { cap: !op.achatado },
      end: { cap: !op.achatado },
    },
  );
  return caminhoSVG(contorno as number[][]);
}

/** Distância² do ponto (x,y) ao segmento a-b. Para a borracha. */
function distanciaSeg2(x: number, y: number, a: Ponto, b: Ponto): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const comp = dx * dx + dy * dy;
  let t = comp ? ((x - a.x) * dx + (y - a.y) * dy) / comp : 0;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return (x - px) ** 2 + (y - py) ** 2;
}

/** Fragmentos de um traço depois de apagar os pontos a menos de `raio` de
 *  (x,y): devolve as sequências de pontos que sobraram (cada uma vira um traço).
 *  Null quando nada foi apagado. É a borracha "de verdade", que come só o
 *  pedaço tocado em vez do traço inteiro. */
export function fragmentosAoApagar(traco: Traco, x: number, y: number, raio: number): Ponto[][] | null {
  const r2 = raio * raio;
  const runs: Ponto[][] = [];
  let atual: Ponto[] = [];
  let apagou = false;
  for (const p of traco.pontos) {
    if ((x - p.x) ** 2 + (y - p.y) ** 2 <= r2) {
      apagou = true;
      if (atual.length) { runs.push(atual); atual = []; }
    } else atual.push(p);
  }
  if (atual.length) runs.push(atual);
  if (!apagou) return null;
  return runs.filter((r) => r.length >= 2);
}

/** O traço passa a menos de `raio` do ponto (x,y)? Usado pela borracha. */
export function tracoAtingido(traco: Traco, x: number, y: number, raio: number): boolean {
  const r2 = raio * raio;
  const pts = traco.pontos;
  if (pts.length === 1) return (x - pts[0].x) ** 2 + (y - pts[0].y) ** 2 <= r2;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distanciaSeg2(x, y, pts[i], pts[i + 1]) <= r2) return true;
  }
  return false;
}
