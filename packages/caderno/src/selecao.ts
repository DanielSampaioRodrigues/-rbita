// Seleção por laço: dado um polígono (o laço desenhado à mão), descobre quais
// elementos estão inteiros dentro, e move/escala elementos. Tudo puro (sem DOM),
// para o app só desenhar o laço e as alças. A altura das caixas de texto não é
// conhecida aqui (depende da fonte renderizada), então entra por um callback.

import type { Elemento, Forma, Texto, Traco } from "./tipos";

export type Ponto2 = [number, number];
/** Altura de uma caixa de texto, medida/estimada pelo app. */
export type AlturaTexto = (t: Texto) => number;
/** Largura real (medida) de uma caixa de texto. Omissa = a largura guardada. */
export type LarguraTexto = (t: Texto) => number;

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
export function pontosDoElemento(el: Elemento, alturaTexto: AlturaTexto, larguraTexto?: LarguraTexto): Ponto2[] {
  if (el.tipo === "traco") return el.pontos.map((p) => [p.x, p.y] as Ponto2);
  if (el.tipo === "texto") {
    const h = alturaTexto(el);
    const w = larguraTexto ? larguraTexto(el) : el.largura;
    return [[el.x, el.y], [el.x + w, el.y], [el.x + w, el.y + h], [el.x, el.y + h]];
  }
  if (el.tipo === "imagem") {
    const cantos: Ponto2[] = [[el.x, el.y], [el.x + el.largura, el.y], [el.x + el.largura, el.y + el.altura], [el.x, el.y + el.altura]];
    if (!el.rot) return cantos;
    // Imagem girada: devolve os cantos já rotacionados (para a caixa envolver certo).
    const cx = el.x + el.largura / 2, cy = el.y + el.altura / 2;
    const r = (el.rot * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
    return cantos.map(([x, y]) => [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co] as Ponto2);
  }
  // forma
  if (el.forma === "reta" || el.forma === "seta") return [[el.x1, el.y1], [el.x2, el.y2]];
  return [[el.x1, el.y1], [el.x2, el.y1], [el.x2, el.y2], [el.x1, el.y2]];
}

/** O elemento está inteiro dentro do laço? (todos os pontos-chave dentro). */
export function elementoDentro(el: Elemento, poly: Ponto2[], alturaTexto: AlturaTexto, larguraTexto?: LarguraTexto): boolean {
  if (poly.length < 3) return false;
  return pontosDoElemento(el, alturaTexto, larguraTexto).every(([x, y]) => pontoEmPoligono(x, y, poly));
}

export interface Limites {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Retângulo que envolve todos os elementos dados (ou null se vazio). */
export function limitesDe(els: Elemento[], alturaTexto: AlturaTexto, larguraTexto?: LarguraTexto): Limites | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of els) {
    for (const [x, y] of pontosDoElemento(el, alturaTexto, larguraTexto)) {
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
  if (el.tipo === "texto" || el.tipo === "imagem") return { ...el, x: el.x + dx, y: el.y + dy };
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
  if (el.tipo === "imagem") {
    return { ...el, x: ex(el.x), y: ey(el.y), largura: Math.max(16, el.largura * fator), altura: Math.max(16, el.altura * fator) };
  }
  const f = el as Forma;
  return { ...f, x1: ex(f.x1), y1: ey(f.y1), x2: ex(f.x2), y2: ey(f.y2), espessura: Math.max(0.5, f.espessura * fator) };
}

/** Gira o elemento por `graus` (horário) em torno do pivô (ax, ay). As imagens
 *  guardam o giro (rot); traços e formas giram os próprios pontos. O texto não
 *  gira (fica em pé), só acompanha o pivô se for o caso. Novo elemento. */
export function rotacionar(el: Elemento, ax: number, ay: number, graus: number): Elemento {
  const r = (graus * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
  const gx = (x: number, y: number) => ax + (x - ax) * co - (y - ay) * si;
  const gy = (x: number, y: number) => ay + (x - ax) * si + (y - ay) * co;
  if (el.tipo === "traco") return { ...el, pontos: el.pontos.map((p) => ({ ...p, x: gx(p.x, p.y), y: gy(p.x, p.y) })) };
  if (el.tipo === "forma") return { ...el, x1: gx(el.x1, el.y1), y1: gy(el.x1, el.y1), x2: gx(el.x2, el.y2), y2: gy(el.x2, el.y2) };
  if (el.tipo === "imagem") {
    // Gira o centro em torno do pivô e soma ao giro próprio.
    const cx = el.x + el.largura / 2, cy = el.y + el.altura / 2;
    const ncx = gx(cx, cy), ncy = gy(cx, cy);
    return { ...el, x: ncx - el.largura / 2, y: ncy - el.altura / 2, rot: ((el.rot ?? 0) + graus) };
  }
  return el; // texto: não gira
}
