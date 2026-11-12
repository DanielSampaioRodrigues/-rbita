import { describe, expect, it } from "vitest";
import { recortarPagina } from "../exportar/medir";
import { areaParaExportar, crescerAte, ehInfinito, escalaDaImagem, INFINITO_INICIAL, medidaInfinito, tamanhoInfinito } from "./infinito";

describe("quadro infinito", () => {
  it("lê o tamanho guardado", () => {
    expect(ehInfinito("infinito")).toBe(true);
    expect(ehInfinito("infinito:6000x3600")).toBe(true);
    expect(ehInfinito("a4")).toBe(false);
    expect(medidaInfinito("infinito")).toEqual(INFINITO_INICIAL);
    expect(medidaInfinito("infinito:6000x4800")).toEqual({ largura: 6000, altura: 4800 });
    expect(medidaInfinito("infinito:100x100")).toEqual(INFINITO_INICIAL);
    expect(tamanhoInfinito(6000.4, 4800)).toBe("infinito:6000x4800");
  });
  it("cresce só quando chega perto da borda, com folga", () => {
    expect(crescerAte(null, INFINITO_INICIAL)).toBeNull();
    expect(crescerAte({ x: 2500, y: 1800 }, INFINITO_INICIAL)).toBeNull();
    const r = crescerAte({ x: 4300, y: 1800 }, INFINITO_INICIAL)!;
    expect(r.altura).toBe(3600);
    expect(r.largura).toBeGreaterThanOrEqual(4300 + 700 + 1200);
    const b = crescerAte({ x: 100, y: 3500 }, INFINITO_INICIAL)!;
    expect(b.largura).toBe(4800);
    expect(b.altura).toBeGreaterThan(3500 + 700);
  });
});


describe("exportar o quadro infinito", () => {
  it("só a área com conteúdo, com folga e tamanho mínimo, dentro do quadro", () => {
    expect(areaParaExportar({ x0: 2000, y0: 1500, x1: 3000, y1: 2100 }, INFINITO_INICIAL)).toEqual({ x: 1940, y: 1440, w: 1120, h: 720 });
    expect(areaParaExportar({ x0: 10, y0: 10, x1: 50, y1: 30 }, INFINITO_INICIAL)).toEqual({ x: 0, y: 0, w: 330, h: 220 });
    expect(areaParaExportar(null, INFINITO_INICIAL)).toEqual({ x: 0, y: 0, w: 1200, h: 900 });
  });
  it("a imagem não passa do limite do iPad", () => {
    expect(escalaDaImagem(1000, 800)).toBe(2);
    expect(escalaDaImagem(4000, 4000) ** 2 * 16_000_000).toBeLessThanOrEqual(16_000_000 + 1);
  });
  it("recorta a página medida mexendo em cada tipo de item", () => {
    const pag = recortarPagina({ largura: 4800, altura: 3600, itens: [
      { tipo: "texto", x: 2100, y: 1600, largura: 50, texto: "a", familia: "x", peso: 400, italico: false, tamanho: 16, cor: { r: 0, g: 0, b: 0, a: 1 } },
      { tipo: "linha", x1: 2000, y1: 1500, x2: 2100, y2: 1550, cor: { r: 0, g: 0, b: 0, a: 1 }, largura: 1 },
      { tipo: "caminho", d: "M0 0", matriz: [1, 0, 0, 1, 2050, 1520] },
    ] }, { x: 1940, y: 1440, w: 1120, h: 720 });
    expect(pag.largura).toBe(1120);
    expect(pag.itens[0]).toMatchObject({ x: 160, y: 160 });
    expect(pag.itens[1]).toMatchObject({ x1: 60, y1: 60, x2: 160, y2: 110 });
    expect((pag.itens[2] as { matriz: number[] }).matriz).toEqual([1, 0, 0, 1, 110, 80]);
  });
});
