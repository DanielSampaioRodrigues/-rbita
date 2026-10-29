// Modelos de pincel e o desenho final de cada traço, em camadas.
//
// Cada traço vira uma lista de camadas (caminhos SVG preenchidos ou
// contornados), todas na cor do traço. O app desenha as camadas dentro de um
// grupo com a opacidade do traço. Tudo é determinístico: as texturas (giz,
// spray, pincel seco...) usam um sorteio com semente guardada no traço, então
// o mesmo traço sai sempre igual. O resultado fica em cache por traço (os
// traços são objetos imutáveis), para não recalcular o que já está pronto.

import { getStroke } from "perfect-freehand";
import { caminhoDeTraco, caminhoSVG, FERRAMENTAS } from "./tracos";
import type { ModeloPincel, Ponto, Traco } from "./tipos";

/** Uma camada do desenho de um traço. */
export interface CamadaTraco {
  d: string;
  /** "preencher" = área cheia; "contornar" = linha com `largura`. */
  modo: "preencher" | "contornar";
  /** Multiplica a opacidade do traço (0..1). */
  opacidade: number;
  /** Espessura da linha (só em "contornar"), em px de referência. */
  largura?: number;
  /** Regra par-ímpar: os furinhos dentro do contorno viram falhas (giz). */
  parImpar?: boolean;
}

/** Sorteio pequeno e previsível (mulberry32): mesma semente, mesma sequência. */
export function sorteio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semente a partir de um texto (o id do traço), para traços sem semente. */
export function sementeDeTexto(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Uma semente nova para um traço que está nascendo. */
export function novaSemente(): number {
  return Math.floor(Math.random() * 4294967295) >>> 0;
}

const f2 = (n: number) => n.toFixed(2);

/** Suaviza a mão (média móvel exponencial) — tira o tremido sem atrasar muito. */
function suavizar(pts: Ponto[], alisar: number): Ponto[] {
  if (pts.length < 3) return pts;
  const a = 1 - Math.min(0.85, Math.max(0, alisar) * 0.8);
  const out: Ponto[] = [pts[0]];
  let x = pts[0].x, y = pts[0].y, p = pts[0].p;
  for (let i = 1; i < pts.length; i++) {
    x += (pts[i].x - x) * a;
    y += (pts[i].y - y) * a;
    p += (pts[i].p - p) * a;
    out.push({ x, y, p });
  }
  // Garante que o traço termina onde a caneta levantou.
  out.push(pts[pts.length - 1]);
  return out;
}

/** Reamostra o caminho em passos iguais (com a pressão interpolada). */
function reamostrar(pts: Ponto[], passo: number): Ponto[] {
  if (pts.length < 2) return pts.slice();
  const out: Ponto[] = [pts[0]];
  let resto = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg === 0) continue;
    let t = passo - resto;
    while (t <= seg) {
      const k = t / seg;
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, p: a.p + (b.p - a.p) * k });
      t += passo;
    }
    resto = seg - (t - passo);
  }
  const ult = pts[pts.length - 1];
  const fim = out[out.length - 1];
  if (fim.x !== ult.x || fim.y !== ult.y) out.push(ult);
  return out;
}

/** Normal (perpendicular unitária) do caminho em cada ponto. */
function normais(pts: Ponto[]): [number, number][] {
  return pts.map((_p, i) => {
    const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)];
    const dx = b.x - a.x, dy = b.y - a.y;
    const n = Math.hypot(dx, dy) || 1;
    return [-dy / n, dx / n];
  });
}

/** Pressão usada nos pincéis: real com caneta, média (0,5) sem ela. */
const pressaoDe = (traco: Traco, p: number) => (traco.pressao ? p : 0.5);

/** Ruído fixo por posição (0..1): o mesmo ponto da borda recebe sempre o
 *  mesmo desvio, mesmo enquanto o traço cresce (a borda não "ferve" ao vivo). */
function ruido(x: number, y: number, semente: number): number {
  let h = Math.imul(Math.round(x * 2) | 0, 374761393) ^ Math.imul(Math.round(y * 2) | 0, 668265263) ^ semente;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Pontos de um contorno de perfect-freehand com as bordas mexidas (giz, aquarela). */
function bordaIrregular(contorno: number[][], amplitude: number, semente: number): number[][] {
  return contorno.map(([x, y]) => {
    const ang = ruido(x, y, semente) * Math.PI * 2;
    const r = ruido(y, x, semente ^ 0x5bd1e995) * amplitude;
    return [x + Math.cos(ang) * r, y + Math.sin(ang) * r];
  });
}

function contornoPF(traco: Traco, tamanho: number, afinar: number, alisar: number, afilar = 0): number[][] {
  // afilar > 0: pontas afinando (sem a "bolinha" da ponta redonda, que na
  // aquarela aparecia como um círculo desenhado).
  const pontas = afilar > 0 ? { start: { taper: afilar }, end: { taper: afilar } } : {};
  return getStroke(
    traco.pontos.map((p) => [p.x, p.y, pressaoDe(traco, p.p)]),
    { size: tamanho, thinning: afinar, smoothing: 0.5, streamline: alisar, simulatePressure: false, last: true, ...pontas },
  ) as number[][];
}

/** Um quadradinho girado (furo do giz). */
function quadradinho(cx: number, cy: number, r: number, ang: number): string {
  const c = Math.cos(ang) * r, s = Math.sin(ang) * r;
  return `M ${f2(cx + c)} ${f2(cy + s)} L ${f2(cx - s)} ${f2(cy + c)} L ${f2(cx - c)} ${f2(cy - s)} L ${f2(cx + s)} ${f2(cy - c)} Z`;
}
/** Um pontinho redondo (spray). */
function pontinho(cx: number, cy: number, r: number): string {
  return `M ${f2(cx - r)} ${f2(cy)} a ${f2(r)} ${f2(r)} 0 1 0 ${f2(r * 2)} 0 a ${f2(r)} ${f2(r)} 0 1 0 ${f2(-r * 2)} 0 Z`;
}

/** Giz: borda irregular e falhas granuladas (furinhos dentro do traço). */
function giz(traco: Traco, tam: number, semente: number): CamadaTraco[] {
  const contorno = bordaIrregular(contornoPF(traco, tam, 0.3, traco.alisar ?? 0.4), tam * 0.14, semente);
  const partes = [caminhoSVG(contorno)];
  const rnd = sorteio(semente ^ 0x9e3779b9);
  const base = reamostrar(traco.pontos, Math.max(1.2, tam * 0.3));
  const porPonto = Math.max(1, Math.round(tam * 0.3));
  for (const p of base) {
    for (let k = 0; k < porPonto && partes.length < 700; k++) {
      const ang = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * tam * 0.45;
      partes.push(quadradinho(p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r, Math.max(0.35, tam * (0.03 + rnd() * 0.05)), rnd() * Math.PI));
    }
  }
  return [{ d: partes.join(" "), modo: "preencher", opacidade: 0.92, parImpar: true }];
}

/** Spray: pontinhos espalhados em volta do traço; a pressão dá a densidade. */
function spray(traco: Traco, tam: number, semente: number): CamadaTraco[] {
  const rnd = sorteio(semente);
  const base = reamostrar(suavizar(traco.pontos, traco.alisar ?? 0.4), Math.max(1.5, tam * 0.35));
  const partes: string[] = [];
  const max = 2600;
  for (const p of base) {
    const pr = pressaoDe(traco, p.p);
    const n = Math.round(1 + pr * 5 + tam * 0.25);
    for (let k = 0; k < n && partes.length < max; k++) {
      const ang = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * tam * 1.3;
      partes.push(pontinho(p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r, Math.max(0.4, tam * (0.045 + rnd() * 0.06))));
    }
  }
  return [{ d: partes.join(" "), modo: "preencher", opacidade: 0.9 }];
}

/** Pincel seco: cerdas (várias linhas finas lado a lado) com falhas, que
 *  aumentam com pouca pressão e conforme a tinta "acaba" no fim do traço. */
function seco(traco: Traco, tam: number, semente: number): CamadaTraco[] {
  const base = reamostrar(suavizar(traco.pontos, traco.alisar ?? 0.4), Math.max(1, tam * 0.25));
  const ns = normais(base);
  const k = Math.max(4, Math.min(12, Math.round(tam / 1.4)));
  const partes: string[] = [];
  for (let j = 0; j < k; j++) {
    // Cada cerda tem o seu sorteio: o começo do traço não muda enquanto ele cresce.
    const rnd = sorteio(semente + j * 7919);
    const off = (j / (k - 1) - 0.5) + (rnd() - 0.5) * 0.08;
    const secura = rnd();
    let tinta = true;
    let andado = 0;
    let seg: string[] = [];
    base.forEach((p, i) => {
      if (i > 0) andado += Math.hypot(p.x - base[i - 1].x, p.y - base[i - 1].y);
      const pr = pressaoDe(traco, p.p);
      const acabando = Math.min(1, andado / (tam * 60));
      const chanceFalha = 0.02 + 0.1 * (1 - pr) + 0.12 * acabando * secura;
      if (tinta && rnd() < chanceFalha) tinta = false;
      else if (!tinta && rnd() < 0.35) tinta = true;
      if (tinta) {
        const larg = tam * (0.65 + 0.35 * pr);
        seg.push(`${f2(p.x + ns[i][0] * off * larg)} ${f2(p.y + ns[i][1] * off * larg)}`);
      } else if (seg.length) {
        if (seg.length > 1) partes.push(`M ${seg.join(" L ")}`);
        seg = [];
      }
    });
    if (seg.length > 1) partes.push(`M ${seg.join(" L ")}`);
  }
  return [{ d: partes.join(" "), modo: "contornar", largura: Math.max(0.5, (tam / k) * 0.85), opacidade: 0.9 }];
}

/** Aquarela: translúcida, com a borda um pouco mais escura; um traço por cima
 *  do outro acumula a cor. */
function aquarela(traco: Traco, tam: number, semente: number): CamadaTraco[] {
  const d = caminhoSVG(bordaIrregular(contornoPF(traco, tam * 1.25, 0.35, traco.alisar ?? 0.5, tam * 2.5), tam * 0.06, semente));
  return [
    { d, modo: "preencher", opacidade: 0.3 },
    { d, modo: "contornar", largura: Math.max(0.6, tam * 0.1), opacidade: 0.42 },
  ];
}

/** Caneta caligráfica: uma pena de ponta chata, inclinada a 45°. Traço que
 *  corre na direção da pena sai fino; traço atravessado sai largo. */
function caligrafica(traco: Traco, tam: number): CamadaTraco[] {
  const base = reamostrar(suavizar(traco.pontos, traco.alisar ?? 0.5), Math.max(0.8, tam * 0.2));
  const nx = Math.SQRT1_2, ny = -Math.SQRT1_2; // direção da pena
  const partes: string[] = [];
  for (let i = 0; i < base.length - 1; i++) {
    const a = base[i], b = base[i + 1];
    const ha = (tam * 0.8) * (0.7 + 0.3 * pressaoDe(traco, a.p));
    const hb = (tam * 0.8) * (0.7 + 0.3 * pressaoDe(traco, b.p));
    let q = [
      [a.x + nx * ha, a.y + ny * ha], [b.x + nx * hb, b.y + ny * hb],
      [b.x - nx * hb, b.y - ny * hb], [a.x - nx * ha, a.y - ny * ha],
    ];
    // Todos os pedaços no mesmo sentido: assim se somam, sem abrir buracos.
    let area = 0;
    for (let j = 0; j < 4; j++) { const [x1, y1] = q[j], [x2, y2] = q[(j + 1) % 4]; area += x1 * y2 - x2 * y1; }
    if (area < 0) q = q.reverse();
    partes.push(`M ${q.map(([x, y]) => `${f2(x)} ${f2(y)}`).join(" L ")} Z`);
  }
  const linha = base.length > 1 ? `M ${base.map((p) => `${f2(p.x)} ${f2(p.y)}`).join(" L ")}` : "";
  const camadas: CamadaTraco[] = [];
  if (partes.length) camadas.push({ d: partes.join(" "), modo: "preencher", opacidade: 1 });
  // Uma linha fina no meio: o traço nunca some, nem na direção da pena.
  if (linha) camadas.push({ d: linha, modo: "contornar", largura: Math.max(0.6, tam * 0.16), opacidade: 1 });
  if (!camadas.length && traco.pontos.length) camadas.push({ d: pontinho(traco.pontos[0].x, traco.pontos[0].y, tam * 0.4), modo: "preencher", opacidade: 1 });
  return camadas;
}

/** Lápis: contínuo, com o miolo um pouco mais escuro que as bordas (cara de
 *  grafite), sem as falhas de antes. */
function lapis(traco: Traco): CamadaTraco[] {
  return [
    { d: caminhoDeTraco(traco), modo: "preencher", opacidade: 0.72 },
    { d: caminhoDeTraco(traco, 0.55), modo: "preencher", opacidade: 0.7 },
  ];
}

function calcular(traco: Traco): CamadaTraco[] {
  if (traco.ferramenta === "lapis") return lapis(traco);
  const modelo: ModeloPincel = traco.ferramenta === "pincel" ? traco.pincel ?? "redondo" : "redondo";
  if (modelo === "redondo" || !traco.pontos.length) return [{ d: caminhoDeTraco(traco), modo: "preencher", opacidade: 1 }];
  const tam = traco.espessura || FERRAMENTAS.pincel.tamanho;
  const semente = (traco.semente ?? sementeDeTexto(traco.id)) >>> 0;
  switch (modelo) {
    case "giz": return giz(traco, tam, semente);
    case "spray": return spray(traco, tam, semente);
    case "seco": return seco(traco, tam, semente);
    case "aquarela": return aquarela(traco, tam, semente);
    case "caligrafica": return caligrafica(traco, tam);
    default: return [{ d: caminhoDeTraco(traco), modo: "preencher", opacidade: 1 }];
  }
}

const cache = new WeakMap<Traco, CamadaTraco[]>();

/** O desenho do traço, em camadas. Fica guardado por traço: um traço pronto
 *  não é recalculado (trocar a cor da barra ou criar outro traço não refaz os
 *  antigos). O traço "ao vivo" muda a cada ponto, então é sempre recalculado. */
export function desenhoDeTraco(traco: Traco): CamadaTraco[] {
  const c = cache.get(traco);
  if (c) return c;
  const novo = calcular(traco);
  cache.set(traco, novo);
  return novo;
}
