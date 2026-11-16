import { describe, expect, it } from "vitest";
import { recorteValido, tirarFundoDados } from "./imagemEdicao";

/** Imagem 5x5 branca com um quadrado preto 3x3 no meio. */
function imagem(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(5 * 5 * 4).fill(255);
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) { const k = (y * 5 + x) * 4; d[k] = d[k + 1] = d[k + 2] = 0; }
  return d;
}
const alfa = (d: Uint8ClampedArray, x: number, y: number) => d[(y * 5 + x) * 4 + 3];

describe("tirar o fundo", () => {
  it("apaga o fundo liso que encosta na borda e mantém o desenho", () => {
    const d = imagem();
    tirarFundoDados(d, 5, 5, 20);
    expect(alfa(d, 0, 0)).toBe(0);
    expect(alfa(d, 4, 2)).toBe(0);
    expect(alfa(d, 2, 2)).toBe(255);
    expect(alfa(d, 1, 1)).toBeLessThan(255); // beirada suavizada
    expect(alfa(d, 1, 1)).toBeGreaterThan(0);
  });
  it("com tolerância alta demais, apaga tudo o que for parecido (o preto fica, é muito diferente)", () => {
    const d = imagem();
    tirarFundoDados(d, 5, 5, 50);
    expect(alfa(d, 2, 2)).toBe(255);
  });
});

describe("recorte", () => {
  it("fica dentro da imagem", () => {
    expect(recorteValido({ x: -0.2, y: 0.5, w: 2, h: 0.9 })).toEqual({ x: 0, y: 0.5, w: 1, h: 0.5 });
  });
});
