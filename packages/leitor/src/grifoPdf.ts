// Contas do grifo no PDF: juntar os retângulos da seleção (o navegador devolve um por
// pedaço de texto) e guardar como pares de pontos (o mesmo campo dos traços da caneta).
import type { Retangulo } from "./tipos";

/** Junta os retângulos de uma mesma linha que se tocam; tira os vazios. */
export function juntarRetangulos(lista: Retangulo[]): Retangulo[] {
  const rs = lista.filter((r) => r.w > 0.001 && r.h > 0.001).map((r) => ({ ...r })).sort((a, b) => a.y - b.y || a.x - b.x);
  const out: Retangulo[] = [];
  for (const r of rs) {
    const u = out.find((o) => {
      const sobreV = Math.min(o.y + o.h, r.y + r.h) - Math.max(o.y, r.y);
      const altura = Math.min(o.h, r.h);
      const vao = Math.max(r.x - (o.x + o.w), o.x - (r.x + r.w));
      return sobreV > altura * 0.5 && vao < altura * 0.8;
    });
    if (!u) { out.push(r); continue; }
    const x1 = Math.min(u.x, r.x), y1 = Math.min(u.y, r.y);
    const x2 = Math.max(u.x + u.w, r.x + r.w), y2 = Math.max(u.y + u.h, r.y + r.h);
    Object.assign(u, { x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
  }
  return out.map((r) => ({ x: arred(r.x), y: arred(r.y), w: arred(r.w), h: arred(r.h) }));
}

const arred = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;

/** Retângulos → pares de pontos (canto de cima à esquerda, canto de baixo à direita). */
export function retangulosParaPontos(rs: Retangulo[]): { x: number; y: number }[] {
  return rs.flatMap((r) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }]);
}

/** Pares de pontos → retângulos. */
export function pontosParaRetangulos(ps: { x: number; y: number }[]): Retangulo[] {
  const out: Retangulo[] = [];
  for (let i = 0; i + 1 < ps.length; i += 2) out.push({ x: ps[i].x, y: ps[i].y, w: ps[i + 1].x - ps[i].x, h: ps[i + 1].y - ps[i].y });
  return out;
}
