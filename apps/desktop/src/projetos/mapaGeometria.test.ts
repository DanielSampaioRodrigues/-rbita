import { describe, expect, it } from "vitest";
import { COLUNA, LINHA, ZOOM_MAX, ZOOM_MIN, curva, enquadrar, moverPorTecla, paraMundo, paraTela, posicoesAutomaticas, toqueDuplo, zoomEm } from "./mapaGeometria";

describe("mapa mental: geometria", () => {
  it("monta a árvore da esquerda para a direita, com o pai no meio dos filhos", () => {
    const pos = posicoesAutomaticas({
      id: "p",
      filhos: [
        { id: "a", filhos: [{ id: "a1", filhos: [] }, { id: "a2", filhos: [] }] },
        { id: "b", filhos: [] },
      ],
    });
    expect(pos.a1).toEqual({ x: 2 * COLUNA, y: 0 });
    expect(pos.a2).toEqual({ x: 2 * COLUNA, y: LINHA });
    expect(pos.a).toEqual({ x: COLUNA, y: LINHA / 2 });
    expect(pos.b).toEqual({ x: COLUNA, y: 2 * LINHA });
    expect(pos.p.x).toBe(0);
    expect(pos.p.y).toBe((pos.a.y + pos.b.y) / 2);
  });

  it("projeto sem tarefas fica sozinho na origem", () => {
    expect(posicoesAutomaticas({ id: "p", filhos: [] })).toEqual({ p: { x: 0, y: 0 } });
  });

  it("vai e volta entre tela e mundo", () => {
    const v = { x: 30, y: -10, z: 1.5 };
    const p = { x: 12, y: 40 };
    expect(paraMundo(v, paraTela(v, p))).toEqual(p);
  });

  it("aproxima mantendo parado o ponto embaixo do dedo", () => {
    const v = { x: 10, y: 20, z: 1 };
    const centro = { x: 200, y: 100 };
    const antes = paraMundo(v, centro);
    const nova = zoomEm(v, 1.5, centro);
    expect(nova.z).toBe(1.5);
    const depois = paraMundo(nova, centro);
    expect(depois.x).toBeCloseTo(antes.x);
    expect(depois.y).toBeCloseTo(antes.y);
  });

  it("não passa dos limites de zoom", () => {
    expect(zoomEm({ x: 0, y: 0, z: 1 }, 100, { x: 0, y: 0 }).z).toBe(ZOOM_MAX);
    expect(zoomEm({ x: 0, y: 0, z: 1 }, 0.001, { x: 0, y: 0 }).z).toBe(ZOOM_MIN);
  });

  it("enquadra tudo sem aproximar além do tamanho real", () => {
    const v = enquadrar([{ x: 0, y: 0 }, { x: 100, y: 50 }], 1000, 600);
    expect(v.z).toBe(1);
    // O meio dos pontos fica no meio da tela.
    expect(paraTela(v, { x: 50, y: 25 })).toEqual({ x: 500, y: 300 });
    const pequena = enquadrar([{ x: 0, y: 0 }, { x: 2000, y: 0 }], 500, 400);
    expect(pequena.z).toBeLessThan(1);
  });

  it("setas movem 8 px, com Shift 32", () => {
    expect(moverPorTecla({ x: 0, y: 0 }, "ArrowRight", false)).toEqual({ x: 8, y: 0 });
    expect(moverPorTecla({ x: 0, y: 0 }, "ArrowUp", true)).toEqual({ x: 0, y: -32 });
    expect(moverPorTecla({ x: 0, y: 0 }, "Enter", false)).toBeNull();
  });

  it("reconhece o toque duplo só no mesmo alvo, perto e rápido", () => {
    const a = { t: 1000, x: 10, y: 10, alvo: "x" };
    expect(toqueDuplo(a, { t: 1200, x: 14, y: 12, alvo: "x" })).toBe(true);
    expect(toqueDuplo(a, { t: 1500, x: 10, y: 10, alvo: "x" })).toBe(false);
    expect(toqueDuplo(a, { t: 1200, x: 10, y: 10, alvo: "y" })).toBe(false);
    expect(toqueDuplo(a, { t: 1200, x: 80, y: 10, alvo: "x" })).toBe(false);
    expect(toqueDuplo(null, a)).toBe(false);
  });

  it("desenha a curva entre dois centros", () => {
    expect(curva({ x: 0, y: 0 }, { x: 100, y: 50 })).toBe("M 0 0 C 50 0, 50 50, 100 50");
  });
});
