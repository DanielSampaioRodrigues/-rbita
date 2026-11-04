import { describe, expect, it } from "vitest";
import { reconhecerForma } from "./reconhecer";
import type { Ponto2 } from "./selecao";

/** Pontos ao longo de um polígono, com tremor leve (mão humana). */
function polig(vs: Ponto2[], porLado = 20, tremor = 2, fechar = true): Ponto2[] {
  const out: Ponto2[] = [];
  const n = fechar ? vs.length : vs.length - 1;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const a = vs[i], b = vs[(i + 1) % vs.length];
    for (let j = 0; j < porLado; j++, k++) {
      const t = j / porLado;
      out.push([a[0] + (b[0] - a[0]) * t + Math.sin(k * 1.7) * tremor, a[1] + (b[1] - a[1]) * t + Math.cos(k * 2.3) * tremor]);
    }
  }
  out.push(fechar ? [vs[0][0] + 3, vs[0][1] + 2] : vs[vs.length - 1]);
  return out;
}

describe("desenhar e segurar: reconhecer a forma", () => {
  it("linha reta tremida vira reta, com as pontas do traço", () => {
    const r = reconhecerForma(polig([[10, 10], [300, 120]], 40, 2, false));
    expect(r?.forma).toBe("reta");
    expect(r?.x1).toBeCloseTo(10, -1);
    expect(r?.x2).toBeCloseTo(300, -1);
  });
  it("retângulo, triângulo e losango", () => {
    expect(reconhecerForma(polig([[20, 20], [320, 20], [320, 220], [20, 220]]))?.forma).toBe("retangulo");
    // Começando no meio de um lado (como a mão costuma fazer).
    expect(reconhecerForma(polig([[170, 20], [320, 20], [320, 220], [20, 220], [20, 20]]))?.forma).toBe("retangulo");
    expect(reconhecerForma(polig([[160, 20], [300, 240], [20, 240]]))?.forma).toBe("triangulo");
    expect(reconhecerForma(polig([[160, 20], [300, 140], [160, 260], [20, 140]]))?.forma).toBe("losango");
  });
  it("círculo vira elipse; rabisco não vira nada", () => {
    const circ: Ponto2[] = Array.from({ length: 60 }, (_v, i) => [150 + Math.cos((i / 58) * 2 * Math.PI) * 100 + Math.sin(i) * 2, 150 + Math.sin((i / 58) * 2 * Math.PI) * 80]);
    expect(reconhecerForma(circ)?.forma).toBe("elipse");
    const rabisco: Ponto2[] = Array.from({ length: 60 }, (_v, i) => [i * 5, (i % 2) * 40 + (i % 7) * 9]);
    expect(reconhecerForma(rabisco)).toBeNull();
    expect(reconhecerForma([[0, 0], [1, 1], [2, 2]])).toBeNull();
  });
});
