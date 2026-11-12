import { describe, expect, it } from "vitest";
import { comporPalavra, decompor, encaixar, podeEscrever, type Alfabeto } from "./alfabeto";

// Letras de mentira: um traço vertical da linha do meio até a base, com a largura dada.
const letra = (largura: number) => ({ tracos: [[{ x: 0.2, y: 0.42, p: 0.5 }, { x: 0.2 + largura, y: 0.72, p: 0.5 }]] });
const alfa: Alfabeto = {
  a: letra(0.3), o: letra(0.3), c: letra(0.25), s: letra(0.2), m: letra(0.4),
  i: { tracos: [[{ x: 0.3, y: 0.42, p: 0.5 }, { x: 0.3, y: 0.72, p: 0.5 }], [{ x: 0.3, y: 0.3, p: 0.5 }, { x: 0.31, y: 0.31, p: 0.5 }]] },
  "´": { tracos: [[{ x: 0.4, y: 0.2, p: 0.5 }, { x: 0.5, y: 0.1, p: 0.5 }]] },
};

describe("a minha letra", () => {
  it("separa a letra do acento", () => {
    expect(decompor("á")).toEqual({ base: "a", acento: "´" });
    expect(decompor("Ã")).toEqual({ base: "a", acento: "~" });
    expect(decompor("ç")).toEqual({ base: "ç" });
    expect(decompor("b")).toEqual({ base: "b" });
    expect(decompor("1")).toBeNull();
    expect(decompor("-")).toBeNull();
  });
  it("só escreve se tiver todas as letras e acentos", () => {
    expect(podeEscrever("caos", alfa)).toBe(true);
    expect(podeEscrever("cás", alfa)).toBe(true);
    expect(podeEscrever("cão", alfa)).toBe(false); // falta o til
    expect(podeEscrever("bola", alfa)).toBe(false);
    expect(podeEscrever("", alfa)).toBe(false);
  });
  it("põe as letras lado a lado, na ordem, sem encostar", () => {
    const t = comporPalavra("ao", alfa);
    expect(t).toHaveLength(2);
    const fimA = Math.max(...t[0].map((p) => p.x)), iniO = Math.min(...t[1].map((p) => p.x));
    expect(iniO).toBeGreaterThan(fimA);
  });
  it("acento em cima da letra; o i com acento perde o pingo", () => {
    const t = comporPalavra("í", alfa);
    expect(t).toHaveLength(2); // a perna do i e o acento (sem o pingo)
    const acento = t[1];
    expect(Math.max(...acento.map((p) => p.y))).toBeLessThan(0.42);
  });
  it("encaixa na caixa da palavra original (mesma altura e começo)", () => {
    const e = encaixar(comporPalavra("ma", alfa), { x: 100, y: 50, h: 30 });
    const ys = e.flat().map((p) => p.y), xs = e.flat().map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(100);
    expect(Math.min(...ys)).toBeCloseTo(50);
    expect(Math.max(...ys)).toBeCloseTo(80);
  });
});
