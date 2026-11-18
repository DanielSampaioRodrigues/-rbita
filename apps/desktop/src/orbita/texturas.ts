// Texturas dos planetas, do sol e do céu, pintadas na hora com ruído (sem nenhuma imagem
// de fora: não há direito autoral envolvido e funciona sem internet).
import * as THREE from "three";
import type { Mundo } from "./universo";

function ruido3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const h = (a: number, b: number, c: number) => { let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1274126177)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v), l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
}
export function fbm(x: number, y: number, z: number, oit = 5): number { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oit; i++) { s += a * ruido3(x * f, y * f, z * f); a *= 0.5; f *= 2.03; } return s; }
type Cor = [number, number, number] | [number, number, number, number];
const mis = (a: Cor, b: Cor, t: number): Cor => { t = Math.max(0, Math.min(1, t)); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
export const suave = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
type Pintor = (x: number, y: number, z: number, lat: number) => Cor;

/** Pinta uma textura de esfera. `cru`: para os materiais com conta de luz própria (sem conversão de cor). */
export function pintar(w: number, h: number, fn: Pintor, cru = false): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d")!, img = g.createImageData(w, h), d = img.data;
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI, cy = Math.sin(lat), cr = Math.cos(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * 2 * Math.PI, p = fn(cr * Math.cos(lon), cy, cr * Math.sin(lon), lat), k = (j * w + i) * 4;
      d[k] = p[0]; d[k + 1] = p[1]; d[k + 2] = p[2]; d[k + 3] = p[3] === undefined ? 255 : p[3];
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = cru ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const faixas = (paleta: Cor[], sem: number): Pintor => (x, y, z, lat) => {
  const v = lat * 2.6 + (fbm(x * 2 + sem, y * 2, z * 2) - 0.5) * 1.1 + (fbm(x * 1.2, y * 9 + sem, z * 1.2, 3) - 0.5) * 0.5;
  const q = (((v * 1.25) % paleta.length) + paleta.length) % paleta.length, i = Math.floor(q);
  const c = mis(paleta[i], paleta[(i + 1) % paleta.length], suave(0.15, 0.85, q - i));
  const turb = 0.86 + 0.28 * fbm(x * 6 + sem, y * 14, z * 6, 4);
  return [c[0] * turb, c[1] * turb, c[2] * turb];
};
const pedra = (c1: Cor, c2: Cor, sem: number, polos = false): Pintor => (x, y, z, lat) => {
  if (polos && Math.abs(lat) > 1.36) return [232, 222, 214];
  const h = fbm(x * 2.6 + sem, y * 2.6, z * 2.6, 6), r = Math.abs(fbm(x * 8, y * 8 + sem, z * 8, 4) - 0.5) * 2, c = mis(c1, c2, h * 1.5 - 0.2), k = 0.76 + 0.24 * r;
  return [c[0] * k, c[1] * k, c[2] * k];
};
const alturaTerra = (x: number, y: number, z: number) => fbm(x * 1.9 + 3, y * 1.9, z * 1.9, 6);
const MUNDOS: Record<Mundo, Pintor> = {
  terra: (x, y, z, lat) => {
    const h = alturaTerra(x, y, z);
    if (Math.abs(lat) > 1.2 - fbm(x * 4, y * 4, z * 4, 3) * 0.25) return [236, 242, 248];
    if (h > 0.52) { const a = (h - 0.52) * 5; return mis(mis([64, 112, 62], [150, 132, 88], a), [222, 214, 200], suave(0.75, 1, a)); }
    return mis([8, 26, 78], [30, 96, 150], suave(0.3, 0.52, h));
  },
  selva: (x, y, z) => { const h = fbm(x * 2.2 + 11, y * 2.2, z * 2.2, 6); return h > 0.47 ? mis([34, 92, 48], [120, 150, 70], (h - 0.47) * 4) : mis([14, 52, 60], [36, 104, 96], h * 2); },
  deserto: pedra([120, 52, 28], [214, 138, 82], 21, true),
  areia: pedra([150, 124, 80], [236, 214, 160], 27),
  rocha: pedra([70, 72, 78], [200, 202, 206], 31),
  "rocha-lilas": pedra([92, 70, 120], [210, 186, 232], 37),
  gelo: faixas([[150, 218, 214], [96, 186, 190], [176, 232, 226], [70, 160, 172]], 41),
  "gelo-claro": faixas([[214, 234, 244], [170, 208, 228], [240, 248, 252], [150, 190, 214]], 45),
  "gas-rosa": faixas([[236, 190, 200], [198, 120, 150], [248, 226, 214], [170, 96, 128], [232, 160, 176]], 51),
  "gas-ouro": faixas([[232, 200, 130], [196, 150, 84], [246, 228, 176], [170, 124, 70]], 61),
  "gas-violeta": faixas([[170, 150, 230], [112, 92, 190], [206, 192, 244], [88, 70, 158]], 71),
  "gas-azul": faixas([[120, 170, 222], [70, 116, 186], [176, 210, 240], [52, 92, 160]], 81),
  "gas-laranja": faixas([[244, 176, 96], [214, 120, 60], [252, 220, 160], [180, 92, 50]], 91),
  "gas-magenta": faixas([[226, 140, 206], [170, 84, 160], [246, 200, 232], [120, 170, 150]], 101),
};
const guardadas = new Map<string, THREE.Texture>();
const umaVez = (chave: string, fazer: () => THREE.Texture) => { let t = guardadas.get(chave); if (!t) { t = fazer(); guardadas.set(chave, t); } return t; };

export const texMundo = (m: Mundo) => umaVez(`mundo:${m}`, () => pintar(m === "terra" ? 1024 : 512, m === "terra" ? 512 : 256, MUNDOS[m], true));
export const texNuvens = () => umaVez("nuvens", () => pintar(384, 192, (x, y, z) => [255, 255, 255, suave(0.5, 0.72, fbm(x * 2.6 + 90, y * 3.4, z * 2.6, 5)) * 235], true));
/** Luzes de cidade no lado da noite do planeta parecido com a Terra. */
export const texNoite = () => umaVez("noite", () => pintar(1024, 512, (x, y, z, lat) => {
  if (alturaTerra(x, y, z) <= 0.525 || Math.abs(lat) > 1.0) return [0, 0, 0];
  const v = suave(0.5, 0.62, fbm(x * 6 + 50, y * 6, z * 6, 3)) * suave(0.6, 0.78, fbm(x * 60, y * 60, z * 60, 2)); return [255 * v, 196 * v, 110 * v];
}, true));
export const texLua = (i: number) => umaVez(`lua:${i}`, () => pintar(128, 64, (x, y, z) => { const sem = 1 + i * 8, h = fbm(x * 3 + sem, y * 3, z * 3, 5), r = Math.abs(fbm(x * 8, y * 8 + sem, z * 8, 3) - 0.5) * 2, v = (120 + h * 120) * (0.75 + 0.25 * r); return [v, v, v]; }));
export const texCeu = () => umaVez("ceu", () => {
  const nx = 0.32 / 1.007, ny = 0.9 / 1.007, nz = 0.28 / 1.007;
  return pintar(1024, 512, (x, y, z) => {
    const d = x * nx + y * ny + z * nz, faixa = Math.exp(-d * d * 9), n = fbm(x * 2.2, y * 2.2, z * 2.2, 5), n2 = fbm(x * 4 + 7, y * 4, z * 4, 5), po = suave(0.45, 0.7, fbm(x * 6 + 3, y * 6, z * 6, 4));
    const b = faixa * (0.25 + n * 0.9) * (1 - po * 0.6), neb = suave(0.56, 0.8, n2) * 0.22;
    return [3 + b * 64 + neb * 90, 4 + b * 70 + neb * 30, 9 + b * 96 + neb * 110];
  });
});
function tela2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")!]; }
/** Mancha de luz redonda (`r,g,b`), para brilhos. */
export const texBrilho = (r: number, g: number, b: number, miolo = 0) => umaVez(`brilho:${r},${g},${b},${miolo}`, () => {
  const [c, x] = tela2d(256, 256), gr = x.createRadialGradient(128, 128, 128 * miolo, 128, 128, 128);
  for (const [p, a] of [[0, 0.95], [0.25, 0.35], [0.6, 0.08], [1, 0]]) gr.addColorStop(p, `rgba(${r},${g},${b},${a})`);
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
});
export const texMais = () => umaVez("mais", () => {
  const [c, g] = tela2d(128, 128); g.strokeStyle = "#fff"; g.lineWidth = 5; g.setLineDash([12, 9]); g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke();
  g.setLineDash([]); g.lineWidth = 6; g.beginPath(); g.moveTo(40, 64); g.lineTo(88, 64); g.moveTo(64, 40); g.lineTo(64, 88); g.stroke(); return new THREE.CanvasTexture(c);
});
export const texMarca = () => umaVez("marca", () => { const [c, g] = tela2d(128, 128); g.strokeStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.stroke(); return new THREE.CanvasTexture(c); });
export const texAnel = () => umaVez("anel", () => {
  const [c, g] = tela2d(256, 4), img = g.createImageData(256, 4);
  for (let i = 0; i < 256; i++) {
    const n = fbm(i * 0.09, 3, 7, 4), buraco = i > 118 && i < 132 ? 0.08 : 1, a = suave(0, 14, i) * suave(256, 236, i) * (0.35 + n * 0.9) * buraco;
    for (let j = 0; j < 4; j++) { const k = (j * 256 + i) * 4; img.data[k] = 232 - n * 40; img.data[k + 1] = 208 - n * 50; img.data[k + 2] = 160 - n * 50; img.data[k + 3] = Math.min(255, a * 255); }
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
});
