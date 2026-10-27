// Seleção por laço: dado um polígono (o laço desenhado à mão), descobre quais
// elementos estão inteiros dentro, e move/escala elementos. Tudo puro (sem DOM),
// para o app só desenhar o laço e as alças. A altura das caixas de texto não é
// conhecida aqui (depende da fonte renderizada), então entra por um callback.

import type { Elemento, Forma, Texto, Traco } from "./tipos";

export type Ponto2 = [number, number];
/** Altura de uma caixa de texto, medida/estimada pelo app. */
export type AlturaTexto = (t: Texto) => number;

/** Ponto dentro do polígono? Lança raio para a direita e conta cruzamentos. */
export function pontoEmPoligono(x: number, y: number, poly: Ponto2[]): boolean {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const cruza = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** Pontos que representam o elemento, para testar se está dentro do laço. */
export function pontosDoElemento(el: Elemento, alturaTexto: AlturaTexto): Ponto2[] {
  if (el.tipo === "traco") return el.pontos.map((p) => [p.x, p.y] as Ponto2);
  if (el.tipo === "texto") {
    const h = alturaTexto(el);
    return [[el.x, el.y], [el.x + el.largura, el.y], [el.x + el.largura, el.y + h], [el.x, el.y + h]];
  }
  // forma
  if (el.forma === "reta" || el.forma === "seta") return [[el.x1, el.y1], [el.x2, el.y2]];
  return [[el.x1, el.y1], [el.x2, el.y1], [el.x2, el.y2], [el.x1, el.y2]];
}

/** O elemento está inteiro dentro do laço? (todos os pontos-chave dentro). */
export function elementoDentro(el: Elemento, poly: Ponto2[], alturaTexto: AlturaTexto): boolean {
  if (poly.length < 3) return false;
  return pontosDoElemento(el, alturaTexto).every(([x, y]) => pontoEmPoligono(x, y, poly));
}

export interface Limites {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Retângulo que envolve todos os elementos dados (ou null se vazio). */
export function limitesDe(els: Elemento[], alturaTexto: AlturaTexto): Limites | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of els) {
    for (const [x, y] of pontosDoElemento(el, alturaTexto)) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, largura: maxX - minX, altura: maxY - minY };
}

/** Move o elemento por (dx, dy). Devolve um novo elemento. */
export function transladar(el: Elemento, dx: number, dy: number): Elemento {
  if (el.tipo === "traco") return { ...el, pontos: el.pontos.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
  if (el.tipo === "texto") return { ...el, x: el.x + dx, y: el.y + dy };
  return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
}

/** Escala o elemento por `fator` em torno da âncora (ax, ay). Novo elemento. */
export function escalar(el: Elemento, ax: number, ay: number, fator: number): Elemento {
  const ex = (x: number) => ax + (x - ax) * fator;
  const ey = (y: number) => ay + (y - ay) * fator;
  if (el.tipo === "traco") {
    const t = el as Traco;
    return { ...t, espessura: Math.max(0.5, t.espessura * fator), pontos: t.pontos.map((p) => ({ ...p, x: ex(p.x), y: ey(p.y) })) };
  }
  if (el.tipo === "texto") {
    const t = el as Texto;
    return { ...t, x: ex(t.x), y: ey(t.y), largura: Math.max(20, t.largura * fator), tamanho: Math.max(8, Math.round(t.tamanho * fator)) };
  }
  const f = el as Forma;
  return { ...f, x1: ex(f.x1), y1: ey(f.y1), x2: ex(f.x2), y2: ey(f.y2), espessura: Math.max(0.5, f.espessura * fator) };
}
