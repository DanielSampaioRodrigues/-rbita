import { describe, expect, it } from "vitest";
import { papelPadrao, svgPapel, papelDataUri, type Papel } from "./index";

const cores = { fundo: "#fff", linha: "#99a" };
const com = (p: Partial<Papel>): Papel => ({ ...papelPadrao(), ...p });
const contar = (svg: string, marca: string) => svg.split(marca).length - 1;

describe("caderno: folhas (svgPapel)", () => {
  it("liso só tem o fundo, sem linhas", () => {
    const svg = svgPapel(com({ modelo: "liso" }), 800, 1000, cores);
    expect(svg).toContain("<rect");
    expect(contar(svg, "<line")).toBe(0);
    expect(contar(svg, "<circle")).toBe(0);
  });

  it("pautado tem linhas horizontais no espaçamento pedido", () => {
    const svg = svgPapel(com({ modelo: "pautado", espacamento: 100 }), 800, 1000, cores);
    // y = 100,200,...,900 → 9 linhas
    expect(contar(svg, "<line")).toBe(9);
  });

  it("quadriculado tem horizontais e verticais", () => {
    const svg = svgPapel(com({ modelo: "quadriculado", espacamento: 100 }), 800, 1000, cores);
    // 9 horizontais (y<1000) + 7 verticais (x<800)
    expect(contar(svg, "<line")).toBe(9 + 7);
  });

  it("pontilhado desenha pontos na grade", () => {
    const svg = svgPapel(com({ modelo: "pontilhado", espacamento: 100 }), 800, 1000, cores);
    expect(contar(svg, "<circle")).toBe(9 * 7);
  });

  it("partitura agrupa linhas em pautas de 5", () => {
    const svg = svgPapel(com({ modelo: "partitura", espacamento: 40 }), 800, 1000, cores);
    expect(contar(svg, "<line") % 5).toBe(0);
    expect(contar(svg, "<line")).toBeGreaterThan(0);
  });

  it("margem e cabeçalho acrescentam uma linha cada", () => {
    const base = contar(svgPapel(com({ modelo: "pautado", espacamento: 100 }), 800, 1000, cores), "<line");
    const comExtras = contar(svgPapel(com({ modelo: "pautado", espacamento: 100, margem: true, cabecalho: true }), 800, 1000, cores), "<line");
    expect(comExtras).toBe(base + 2);
  });

  it("data URI embute a SVG", () => {
    const uri = papelDataUri(com({ modelo: "liso" }), 100, 100, cores);
    expect(uri.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    expect(decodeURIComponent(uri)).toContain("<svg");
  });
});
