import { describe, expect, it } from "vitest";
import type { Elemento, Forma } from "@orbita/caderno";
import { agrupar, ajustarConectores, desagrupar, expandirGrupos, idsNoRetangulo, imagemAtingida, moverUmNivel, objetoNoPonto, soltarSetasMovidas, type MedidaTexto } from "./edicao";

const m: MedidaTexto = { altura: (t) => t.tamanho * 1.4, largura: (t) => t.largura };
const ret = (id: string, x: number, y: number, l = 20): Forma => ({ tipo: "forma", id, forma: "retangulo", x1: x, y1: y, x2: x + l, y2: y + l, cor: "#000", espessura: 2 });
const traco = (id: string, pts: [number, number][]): Elemento => ({ tipo: "traco", id, ferramenta: "caneta", cor: "#000", espessura: 2, pontos: pts.map(([x, y]) => ({ x, y, p: 0.5 })) });

describe("caderno: edição de objetos", () => {
  it("tocar acerta o objeto de cima, pelo contorno", () => {
    const els = [ret("a", 0, 0, 100), traco("b", [[0, 50], [100, 50]])];
    expect(objetoNoPonto(els, 50, 51, 4, m)?.id).toBe("b");
    expect(objetoNoPonto(els, 0, 20, 4, m)?.id).toBe("a");
    expect(objetoNoPonto(els, 30, 20, 4, m)?.id).toBe("a"); // miolo do retângulo também pega
    expect(objetoNoPonto(els, 300, 300, 4, m)).toBeUndefined();
  });

  it("imagem girada: acerto pela caixa girada", () => {
    const img = { tipo: "imagem", id: "i", x: 0, y: 40, largura: 100, altura: 20, anexoId: "x", rot: 90 } as const;
    expect(imagemAtingida(img, 50, 5, 0)).toBe(true); // de pé depois de girar
    expect(imagemAtingida(img, 5, 50, 0)).toBe(false);
  });

  it("agrupar faz o grupo inteiro ser selecionado junto; desagrupar solta", () => {
    let els: Elemento[] = [ret("a", 0, 0), ret("b", 50, 0), ret("c", 100, 0)];
    els = agrupar(els, ["a", "b"], "g1");
    expect(expandirGrupos(els, ["a"]).sort()).toEqual(["a", "b"]);
    els = desagrupar(els, ["a", "b"]);
    expect(expandirGrupos(els, ["a"])).toEqual(["a"]);
    expect(els.every((e) => !("grupo" in e))).toBe(true);
  });

  it("um nível para a frente passa só pelo objeto que encosta", () => {
    const els = [ret("a", 0, 0), ret("longe", 500, 500), ret("b", 10, 10), ret("c", 900, 900)];
    const r = moverUmNivel(els, ["a"], true, m).map((e) => e.id);
    expect(r).toEqual(["longe", "b", "a", "c"]);
    const r2 = moverUmNivel(els, ["b"], false, m).map((e) => e.id);
    expect(r2).toEqual(["b", "a", "longe", "c"]);
    expect(moverUmNivel(els, ["c"], true, m)).toBe(els); // já está na frente
  });

  it("seta presa acompanha o objeto e se solta ao ser movida sozinha", () => {
    const seta: Forma = { tipo: "forma", id: "s", forma: "seta", x1: 0, y1: 0, x2: 0, y2: 0, cor: "#000", espessura: 2, ligaInicio: "a", ligaFim: "b" };
    const els = ajustarConectores([ret("a", 0, 0), ret("b", 200, 0), seta], m);
    const s = els[2] as Forma;
    expect(s.x1).toBeGreaterThan(20); // sai da borda direita de "a"
    expect(s.x2).toBeLessThan(200); // chega na borda esquerda de "b"
    expect(Math.round(s.y1)).toBe(10);
    const solta = soltarSetasMovidas(els, ["s"])[2] as Forma;
    expect(solta.ligaInicio).toBeUndefined();
    expect(solta.ligaFim).toBeUndefined();
  });

  it("retângulo de seleção pega só o que está inteiro dentro", () => {
    const els = [ret("a", 10, 10), ret("b", 90, 90)];
    expect(idsNoRetangulo(els, { x: 0, y: 0, largura: 100, altura: 100 }, m)).toEqual(["a"]);
  });
});
