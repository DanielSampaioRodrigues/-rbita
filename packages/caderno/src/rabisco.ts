// "Rabiscar para apagar": riscar em zigue-zague (ou em voltas) por cima da escrita
// apaga o que está embaixo, sem trocar de ferramenta. Puro: recebe os pontos do
// rabisco e os elementos da página, devolve a página sem o que foi coberto.
//
// Duas travas contra apagar sem querer:
// 1. o traço tem que ser um vai-e-vem de verdade (um "m" ou um "w" não bastam);
// 2. ele tem que estar por cima de escrita que já existia (rabisco em área vazia é desenho).

import { simplificar } from "./reconhecer";
import { pontoEmPoligono, type Ponto2 } from "./selecao";
import type { Elemento, Ponto, Traco } from "./tipos";

/** Viradas bruscas (de volta para trás) que fazem de um traço um zigue-zague. */
export const VIRADAS_RABISCO = 4;

const comprimento = (pts: Ponto2[]) => {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
};

function caixa(pts: Ponto2[]) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const [x, y] of pts) { if (x < x1) x1 = x; if (y < y1) y1 = y; if (x > x2) x2 = x; if (y > y2) y2 = y; }
  return { x1, y1, x2, y2, diag: Math.hypot(x2 - x1, y2 - y1) };
}

/**
 * O traço é um rabisco de apagar? Conta as viradas bruscas (mais de ~110°, ou seja,
 * a caneta voltou para trás) e o tanto que o traço girou no total. Vale com 4 viradas
 * (5 passadas de vai-e-vem) ou com 3 voltas completas (rabisco em espiral), e só se o
 * traço for "cheio": bem mais comprido do que o espaço que ocupa.
 */
export function ehRabisco(pts: Ponto2[]): boolean {
  if (pts.length < 10) return false;
  const { diag } = caixa(pts);
  if (diag < 16) return false;
  if (comprimento(pts) < diag * 2.5) return false;
  const s = simplificar(pts, Math.max(2.5, diag * 0.035));
  let viradas = 0, giro = 0;
  for (let i = 1; i < s.length - 1; i++) {
    const ax = s[i][0] - s[i - 1][0], ay = s[i][1] - s[i - 1][1];
    const bx = s[i + 1][0] - s[i][0], by = s[i + 1][1] - s[i][1];
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la === 0 || lb === 0) continue;
    const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
    giro += Math.acos(cos);
    if (cos < -0.35) viradas++;
  }
  return viradas >= VIRADAS_RABISCO || giro >= Math.PI * 6;
}

/** O contorno (fecho convexo) dos pontos: a área que o rabisco cobre. */
export function contorno(pts: Ponto2[]): Ponto2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const gira = (o: Ponto2, a: Ponto2, b: Ponto2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const baixo: Ponto2[] = [];
  for (const q of p) { while (baixo.length >= 2 && gira(baixo[baixo.length - 2], baixo[baixo.length - 1], q) <= 0) baixo.pop(); baixo.push(q); }
  const cima: Ponto2[] = [];
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (cima.length >= 2 && gira(cima[cima.length - 2], cima[cima.length - 1], q) <= 0) cima.pop(); cima.push(q); }
  return [...baixo.slice(0, -1), ...cima.slice(0, -1)];
}

/** Aumenta o contorno para fora (a partir do centro) em `folga` px: pega a tinta que encosta na borda do rabisco. */
function alargar(poly: Ponto2[], folga: number): Ponto2[] {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1; return [x + ((x - cx) / d) * folga, y + ((y - cy) / d) * folga] as Ponto2; });
}

const compPontos = (pts: Ponto[]) => {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
};

export interface ResultadoRabisco {
  /** A página sem o que o rabisco cobriu (igual à de entrada quando nada foi apagado). */
  elementos: Elemento[];
  apagou: boolean;
}

/**
 * Apaga a escrita à mão que está embaixo do rabisco. Só mexe em traços (caneta, lápis,
 * pincel e marca-texto): texto digitado, formas e imagens ficam (para esses existe o laço).
 * Traço todo coberto some; traço coberto em parte perde só a parte coberta, e o resto
 * continua (sobra muito pequena some junto, para não ficar farelo).
 * Não apaga nada se o rabisco cobre pouca tinta: aí ele é só um desenho que encostou em algo.
 */
export function apagarComRabisco(elementos: Elemento[], rabisco: Ponto2[], novoId: () => string): ResultadoRabisco {
  const nada = { elementos, apagou: false };
  if (rabisco.length < 3) return nada;
  const { diag } = caixa(rabisco);
  const area = alargar(contorno(rabisco), 3);
  if (area.length < 3) return nada;
  const novos: Elemento[] = [];
  let coberto = 0;
  for (const el of elementos) {
    if (el.tipo !== "traco") { novos.push(el); continue; }
    const tr: Traco = el;
    // Sequências de pontos que ficaram de fora do rabisco.
    const fora: Ponto[][] = [];
    let atual: Ponto[] = [], dentro = 0;
    for (const p of tr.pontos) {
      if (pontoEmPoligono(p.x, p.y, area)) { dentro++; if (atual.length) { fora.push(atual); atual = []; } }
      else atual.push(p);
    }
    if (atual.length) fora.push(atual);
    if (dentro === 0) { novos.push(el); continue; }
    const total = compPontos(tr.pontos);
    const sobras = fora.filter((r) => r.length >= 2).map((r) => ({ r, c: compPontos(r) })).filter((s) => s.c >= Math.max(6, total * 0.12));
    const restou = sobras.reduce((s, x) => s + x.c, 0);
    // Um pingo (o ponto do "i") tem comprimento quase zero: coberto por inteiro, conta como um tracinho.
    coberto += sobras.length === 0 ? Math.max(total, 12) : Math.max(0, total - restou);
    sobras.forEach((s, i) => novos.push({ ...tr, id: i === 0 && sobras.length === 1 ? tr.id : novoId(), pontos: s.r }));
  }
  // A tinta coberta tem que ser bastante para o tamanho do rabisco (metade da diagonal dele):
  // uma palavra escrita perto de outra, que só pega as pernas das letras de cima, não apaga nada.
  if (coberto < Math.max(12, diag * 0.5)) return nada;
  return { elementos: novos, apagou: true };
}
