import { describe, expect, it } from "vitest";
import { caminhoDeForma, formaAtingida, type Forma } from "./index";

const base = { tipo: "forma", id: "1", cor: "#000", espessura: 2 } as const;

describe("caderno: formas", () => {
  it("gera caminho para cada tipo", () => {
    const reta: Forma = { ...base, forma: "reta", x1: 0, y1: 0, x2: 10, y2: 10 };
    const ret: Forma = { ...base, forma: "retangulo", x1: 0, y1: 0, x2: 10, y2: 6 };
    const eli: Forma = { ...base, forma: "elipse", x1: 0, y1: 0, x2: 10, y2: 6 };
    const seta: Forma = { ...base, forma: "seta", x1: 0, y1: 0, x2: 10, y2: 0 };
    expect(caminhoDeForma(reta)).toContain("M 0.00 0.00 L 10.00 10.00");
    expect(caminhoDeForma(ret)).toContain("Z");
    expect(caminhoDeForma(eli)).toContain("A");
    expect(caminhoDeForma(seta).match(/L/g)?.length).toBeGreaterThanOrEqual(3); // linha + 2 asas
  });

  it("retângulo normaliza cantos trocados", () => {
    const ret: Forma = { ...base, forma: "retangulo", x1: 10, y1: 6, x2: 0, y2: 0 };
    expect(caminhoDeForma(ret)).toBe("M 0.00 0.00 L 10.00 0.00 L 10.00 6.00 L 0.00 6.00 Z");
  });

  it("a borracha acerta a borda e erra o centro vazio", () => {
    const ret: Forma = { ...base, forma: "retangulo", x1: 0, y1: 0, x2: 100, y2: 100 };
    expect(formaAtingida(ret, 0, 50, 3)).toBe(true);   // na borda esquerda
    expect(formaAtingida(ret, 50, 50, 3)).toBe(false); // meio vazio
    const reta: Forma = { ...base, forma: "reta", x1: 0, y1: 0, x2: 100, y2: 0 };
    expect(formaAtingida(reta, 50, 1, 3)).toBe(true);
    expect(formaAtingida(reta, 50, 40, 3)).toBe(false);
  });
});

describe("caderno: formas novas", () => {
  it("triângulo, losango e estrela viram polígonos fechados", () => {
    for (const forma of ["triangulo", "losango", "estrela"] as const) {
      const f: Forma = { ...base, forma, x1: 0, y1: 0, x2: 100, y2: 80 };
      const d = caminhoDeForma(f);
      expect(d.startsWith("M ")).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
    }
  });

  it("a borracha acerta a borda do losango", () => {
    const f: Forma = { ...base, forma: "losango", x1: 0, y1: 0, x2: 100, y2: 100 };
    expect(formaAtingida(f, 25, 25, 3)).toBe(true);
    expect(formaAtingida(f, 50, 50, 3)).toBe(false);
  });
});
