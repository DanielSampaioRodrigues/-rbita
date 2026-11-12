import { describe, expect, it } from "vitest";
import { juntarRetangulos, pontosParaRetangulos, retangulosParaPontos } from "./grifoPdf";

describe("grifo no PDF", () => {
  it("junta pedaços da mesma linha e mantém linhas separadas", () => {
    const r = juntarRetangulos([
      { x: 0.1, y: 0.1, w: 0.2, h: 0.02 },
      { x: 0.305, y: 0.1, w: 0.1, h: 0.02 },
      { x: 0.1, y: 0.13, w: 0.3, h: 0.02 },
      { x: 0.5, y: 0.5, w: 0, h: 0.02 },
    ]);
    expect(r).toEqual([
      { x: 0.1, y: 0.1, w: 0.305, h: 0.02 },
      { x: 0.1, y: 0.13, w: 0.3, h: 0.02 },
    ]);
  });
  it("vai e volta como pontos", () => {
    const rs = [{ x: 0.1, y: 0.2, w: 0.3, h: 0.02 }];
    const volta = pontosParaRetangulos(retangulosParaPontos(rs));
    expect(volta[0].x).toBeCloseTo(0.1); expect(volta[0].w).toBeCloseTo(0.3); expect(volta[0].h).toBeCloseTo(0.02);
  });
});
