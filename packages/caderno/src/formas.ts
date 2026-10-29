// Formas geométricas (reta, retângulo, elipse, seta, triângulo, losango,
// estrela) desenhadas arrastando.
// Puro: devolve o caminho SVG (traçado, sem preenchimento) e um teste de acerto
// para a borracha. O render e a captura do ponteiro ficam no app.

import type { Forma } from "./tipos";

const f2 = (n: number) => n.toFixed(2);

/** Pontos de uma elipse amostrada, para o caminho e para o teste da borracha. */
function pontosElipse(cx: number, cy: number, rx: number, ry: number, n = 40): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/** Ponta da seta: duas asas a partir da extremidade (x2,y2). */
function asasDaSeta(f: Forma, tam: number): [[number, number], [number, number]] {
  const ang = Math.atan2(f.y2 - f.y1, f.x2 - f.x1);
  const abertura = 0.45; // ~26°
  return [
    [f.x2 - Math.cos(ang - abertura) * tam, f.y2 - Math.sin(ang - abertura) * tam],
    [f.x2 - Math.cos(ang + abertura) * tam, f.y2 - Math.sin(ang + abertura) * tam],
  ];
}

/** Vértices dos polígonos (triângulo, losango, estrela) dentro da caixa da
 *  forma. O triângulo aponta para cima; a estrela tem cinco pontas. */
export function verticesDaForma(forma: Forma): [number, number][] | null {
  const xa = Math.min(forma.x1, forma.x2), ya = Math.min(forma.y1, forma.y2);
  const xb = Math.max(forma.x1, forma.x2), yb = Math.max(forma.y1, forma.y2);
  const cx = (xa + xb) / 2, cy = (ya + yb) / 2;
  switch (forma.forma) {
    case "triangulo":
      return [[cx, ya], [xb, yb], [xa, yb]];
    case "losango":
      return [[cx, ya], [xb, cy], [cx, yb], [xa, cy]];
    case "estrela": {
      const rx = (xb - xa) / 2, ry = (yb - ya) / 2;
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const k = i % 2 === 0 ? 1 : 0.42; // pontas e vales
        pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
      }
      return pts;
    }
    default:
      return null;
  }
}

/** Caminho SVG da forma, pronto para `<path d>` (só contorno, sem fill). */
export function caminhoDeForma(forma: Forma): string {
  const { x1, y1, x2, y2 } = forma;
  switch (forma.forma) {
    case "reta":
      return `M ${f2(x1)} ${f2(y1)} L ${f2(x2)} ${f2(y2)}`;
    case "retangulo": {
      const xa = Math.min(x1, x2), ya = Math.min(y1, y2), xb = Math.max(x1, x2), yb = Math.max(y1, y2);
      return `M ${f2(xa)} ${f2(ya)} L ${f2(xb)} ${f2(ya)} L ${f2(xb)} ${f2(yb)} L ${f2(xa)} ${f2(yb)} Z`;
    }
    case "elipse": {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
      return `M ${f2(cx - rx)} ${f2(cy)} A ${f2(rx)} ${f2(ry)} 0 1 0 ${f2(cx + rx)} ${f2(cy)} A ${f2(rx)} ${f2(ry)} 0 1 0 ${f2(cx - rx)} ${f2(cy)} Z`;
    }
    case "seta": {
      const tam = Math.max(10, forma.espessura * 3.2);
      const [a, b] = asasDaSeta(forma, tam);
      return `M ${f2(x1)} ${f2(y1)} L ${f2(x2)} ${f2(y2)} M ${f2(a[0])} ${f2(a[1])} L ${f2(x2)} ${f2(y2)} L ${f2(b[0])} ${f2(b[1])}`;
    }
    default: {
      const vs = verticesDaForma(forma) ?? [];
      return vs.length ? `M ${vs.map(([x, y]) => `${f2(x)} ${f2(y)}`).join(" L ")} Z` : "";
    }
  }
}

/** Contorno da forma como lista de segmentos, para a borracha. */
function segmentosDaForma(forma: Forma): [number, number][] {
  const { x1, y1, x2, y2 } = forma;
  switch (forma.forma) {
    case "reta":
    case "seta":
      return [[x1, y1], [x2, y2]];
    case "retangulo": {
      const xa = Math.min(x1, x2), ya = Math.min(y1, y2), xb = Math.max(x1, x2), yb = Math.max(y1, y2);
      return [[xa, ya], [xb, ya], [xb, yb], [xa, yb], [xa, ya]];
    }
    case "elipse":
      return pontosElipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2);
    default: {
      const vs = verticesDaForma(forma) ?? [];
      return vs.length ? [...vs, vs[0]] : [];
    }
  }
}

function distSeg2(x: number, y: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const comp = dx * dx + dy * dy;
  let t = comp ? ((x - a[0]) * dx + (y - a[1]) * dy) / comp : 0;
  t = Math.max(0, Math.min(1, t));
  const px = a[0] + t * dx, py = a[1] + t * dy;
  return (x - px) ** 2 + (y - py) ** 2;
}

/** A forma passa a menos de `raio` do ponto (x,y)? Usado pela borracha. */
export function formaAtingida(forma: Forma, x: number, y: number, raio: number): boolean {
  const r2 = raio * raio;
  const pts = segmentosDaForma(forma);
  for (let i = 0; i < pts.length - 1; i++) {
    if (distSeg2(x, y, pts[i], pts[i + 1]) <= r2) return true;
  }
  return false;
}
