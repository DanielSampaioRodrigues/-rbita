// "Desenhar e segurar": reconhece a forma que a pessoa desenhou à mão (como no
// Goodnotes) e devolve a forma geométrica perfeita no lugar do traço tremido.
// Puro: recebe os pontos e devolve a forma (ou null, quando não parece nada).

import type { Ponto2 } from "./selecao";
import type { TipoForma } from "./tipos";

export interface FormaReconhecida {
  forma: Extract<TipoForma, "reta" | "retangulo" | "elipse" | "triangulo" | "losango">;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const dist = (a: Ponto2, b: Ponto2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Distância do ponto p à reta que passa por a e b. */
function distReta(p: Ponto2, a: Ponto2, b: Ponto2): number {
  const d = dist(a, b);
  if (d === 0) return dist(p, a);
  return Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / d;
}

/** Simplifica a linha (Ramer–Douglas–Peucker): sobram os "cantos". */
export function simplificar(pts: Ponto2[], tolerancia: number): Ponto2[] {
  if (pts.length < 3) return pts.slice();
  let maior = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distReta(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maior) { maior = d; idx = i; }
  }
  if (maior <= tolerancia) return [pts[0], pts[pts.length - 1]];
  const a = simplificar(pts.slice(0, idx + 1), tolerancia);
  const b = simplificar(pts.slice(idx), tolerancia);
  return [...a.slice(0, -1), ...b];
}

/** Comprimento total do traço. */
function comprimento(pts: Ponto2[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
}

/** Simplifica uma linha fechada começando pelo ponto mais longe do primeiro
 *  (assim o começo do traço, que cai no meio de um lado, não conta como canto). */
function cantosFechados(pts: Ponto2[], tol: number): Ponto2[] {
  let longe = 0, dMax = 0;
  for (let i = 0; i < pts.length; i++) { const d = dist(pts[i], pts[0]); if (d > dMax) { dMax = d; longe = i; } }
  const giro = [...pts.slice(longe), ...pts.slice(0, longe), pts[longe]];
  const s = simplificar(giro, tol);
  // Tira o ponto repetido do fim e cantos quase colineares.
  const c = s.slice(0, -1);
  const fora: Ponto2[] = [];
  for (let i = 0; i < c.length; i++) {
    const a = c[(i - 1 + c.length) % c.length], b = c[i], d = c[(i + 1) % c.length];
    if (distReta(b, a, d) > tol * 0.9) fora.push(b);
  }
  return fora;
}

/**
 * Reconhece a forma. Linha aberta e quase reta = reta (o fim vem do primeiro e do
 * último ponto). Linha fechada: 3 cantos = triângulo, 4 = retângulo (ou losango,
 * quando os cantos ficam no meio dos lados da caixa), redonda = elipse.
 */
export function reconhecerForma(pts: Ponto2[]): FormaReconhecida | null {
  if (pts.length < 4) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
  const diag = Math.hypot(x2 - x1, y2 - y1);
  if (diag < 12) return null;
  const total = comprimento(pts);
  const ini = pts[0], fim = pts[pts.length - 1];
  // Aberta e reta: os pontos ficam perto da linha entre o começo e o fim.
  const corda = dist(ini, fim);
  if (corda > diag * 0.6) {
    const desvio = Math.max(...pts.map((p) => distReta(p, ini, fim)));
    if (desvio < Math.max(6, corda * 0.07)) return { forma: "reta", x1: ini[0], y1: ini[1], x2: fim[0], y2: fim[1] };
    if (total < corda * 1.6) return null; // linha aberta que não é reta: não vira forma
  }
  // Fechada: o fim volta perto do começo.
  if (corda > Math.max(24, total * 0.18)) return null;
  const tol = diag * 0.075;
  const cantos = cantosFechados(pts, tol);
  if (cantos.length === 3) return { forma: "triangulo", x1, y1, x2, y2 };
  if (cantos.length === 4) {
    // Losango: os cantos ficam perto do meio dos lados da caixa.
    const meioX = (x1 + x2) / 2, meioY = (y1 + y2) / 2;
    const noMeio = cantos.filter((c) => Math.abs(c[0] - meioX) < (x2 - x1) * 0.2 || Math.abs(c[1] - meioY) < (y2 - y1) * 0.2).length;
    return { forma: noMeio >= 3 ? "losango" : "retangulo", x1, y1, x2, y2 };
  }
  // Redonda: a distância ao centro varia pouco em relação à elipse da caixa.
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = (x2 - x1) / 2 || 1, ry = (y2 - y1) / 2 || 1;
  const erro = pts.reduce((s, p) => s + Math.abs(Math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry) - 1), 0) / pts.length;
  if (erro < 0.18) return { forma: "elipse", x1, y1, x2, y2 };
  if (cantos.length >= 5 && cantos.length <= 6 && erro < 0.3) return { forma: "elipse", x1, y1, x2, y2 };
  return null;
}
