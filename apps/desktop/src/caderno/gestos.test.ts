import { describe, expect, it } from "vitest";
import { acaoDoGesto, criarDetectorDeToques, DUPLO_MAX_MS, TOQUE_MAX_MS } from "./gestos";

/** Toca com `n` dedos no instante t (encostam juntos e saem 80 ms depois). */
function tocar(d: ReturnType<typeof criarDetectorDeToques>, n: number, t: number, andar = 0) {
  for (let i = 0; i < n; i++) d.descer(i + t, 100 + i * 30, 200, t);
  if (andar) for (let i = 0; i < n; i++) d.mover(i + t, 100 + i * 30 + andar, 200);
  let g = null;
  for (let i = 0; i < n; i++) g = d.subir(i + t, t + 80);
  return g;
}

describe("gestos de toque do caderno", () => {
  it("dois toques com dois dedos desfazem; com três, refazem", () => {
    const d = criarDetectorDeToques();
    expect(tocar(d, 2, 0)?.tipo).toBe("toque");
    const g = tocar(d, 2, 200)!;
    expect(g).toMatchObject({ tipo: "duplo", dedos: 2 });
    expect(acaoDoGesto(g, true)).toBe("desfazer");
    tocar(d, 3, 1000);
    expect(acaoDoGesto(tocar(d, 3, 1250)!, false)).toBe("refazer");
  });

  it("arrastar, demorar ou esperar demais entre os toques não vale", () => {
    const d = criarDetectorDeToques();
    expect(tocar(d, 2, 0, 40)).toBeNull(); // arrastou: era rolagem
    d.descer(1, 0, 0, 5000);
    expect(d.subir(1, 5000 + TOQUE_MAX_MS + 1)).toBeNull(); // segurou: não é toque
    tocar(d, 2, 9000);
    expect(tocar(d, 2, 9000 + 80 + DUPLO_MAX_MS + 1)?.tipo).toBe("toque"); // longe demais: recomeça
  });

  it("quantidade de dedos diferente não forma toque duplo; cancelar zera", () => {
    const d = criarDetectorDeToques();
    tocar(d, 2, 0);
    expect(tocar(d, 3, 150)?.tipo).toBe("toque");
    tocar(d, 2, 1000);
    d.cancelar();
    expect(tocar(d, 2, 1150)?.tipo).toBe("toque");
  });

  it("um dedo duas vezes só vira zoom com 'só caneta'; quatro dedos limpam a tela", () => {
    const d = criarDetectorDeToques();
    tocar(d, 1, 0);
    const g = tocar(d, 1, 200)!;
    expect(acaoDoGesto(g, true)).toBe("zoom");
    expect(acaoDoGesto(g, false)).toBeNull();
    expect(acaoDoGesto(tocar(d, 4, 2000)!, true)).toBe("tela-limpa");
  });
});
