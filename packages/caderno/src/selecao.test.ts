import { describe, expect, it } from "vitest";
import { elementoDentro, escalar, limitesDe, pontoEmPoligono, transladar, type Elemento, type Ponto2 } from "./index";

const quadrado: Ponto2[] = [[0, 0], [100, 0], [100, 100], [0, 100]];
const alturaTexto = (t: { tamanho: number }) => t.tamanho * 1.3;

const traco = (pts: [number, number][]): Elemento => ({ tipo: "traco", id: "t", ferramenta: "caneta", cor: "#000", espessura: 2, pontos: pts.map(([x, y]) => ({ x, y, p: 1 })) });

describe("caderno: seleção por laço", () => {
  it("ponto dentro e fora do polígono", () => {
    expect(pontoEmPoligono(50, 50, quadrado)).toBe(true);
    expect(pontoEmPoligono(150, 50, quadrado)).toBe(false);
  });

  it("seleciona só o que está inteiro dentro do laço", () => {
    const dentro = traco([[10, 10], [40, 40]]);
    const meio = traco([[10, 10], [200, 200]]); // sai do laço
    expect(elementoDentro(dentro, quadrado, alturaTexto)).toBe(true);
    expect(elementoDentro(meio, quadrado, alturaTexto)).toBe(false);
  });

  it("limites envolvem todos os elementos", () => {
    const lim = limitesDe([traco([[10, 20], [30, 40]]), traco([[50, 5], [60, 80]])], alturaTexto);
    expect(lim).toEqual({ x: 10, y: 5, largura: 50, altura: 75 });
    expect(limitesDe([], alturaTexto)).toBeNull();
  });

  it("transladar move todos os pontos", () => {
    const t = transladar(traco([[0, 0], [10, 10]]), 5, -3) as Extract<Elemento, { tipo: "traco" }>;
    expect(t.pontos[0]).toMatchObject({ x: 5, y: -3 });
    expect(t.pontos[1]).toMatchObject({ x: 15, y: 7 });
  });

  it("escalar em torno da âncora dobra o tamanho", () => {
    const t = escalar(traco([[0, 0], [10, 0]]), 0, 0, 2) as Extract<Elemento, { tipo: "traco" }>;
    expect(t.pontos[1].x).toBe(20);
    expect(t.espessura).toBe(4);
  });

  it("escalar caixa de texto cresce largura e fonte", () => {
    const txt: Elemento = { tipo: "texto", id: "x", x: 10, y: 10, largura: 100, texto: "oi", cor: "#000", tamanho: 20 };
    const e = escalar(txt, 0, 0, 1.5) as Extract<Elemento, { tipo: "texto" }>;
    expect(e.largura).toBe(150);
    expect(e.tamanho).toBe(30);
  });
});
