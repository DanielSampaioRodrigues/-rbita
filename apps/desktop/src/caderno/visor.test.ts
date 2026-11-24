import { describe, expect, it } from "vitest";
import { encaixePadrao, FOLGA_PAGINA, larguraDaPagina, paginaAoSoltar, paginaNaPosicao } from "./visor";

const FOLGA = FOLGA_PAGINA * 2;

const A4 = { largura: 794, altura: 1123 };

describe("visor do caderno", () => {
  it("página inteira cabe na tela: iPad em pé usa a altura, deitado também", () => {
    // iPad em pé (área 820 × 1000): pela largura daria 796 de largura e 1126 de altura (passa da tela).
    const emPe = larguraDaPagina({ largura: 820, altura: 1000 }, A4, "pagina", false);
    expect(emPe * (A4.altura / A4.largura)).toBeLessThanOrEqual(1000 - FOLGA);
    // Deitado (1180 × 700): cabe pela altura.
    const deitado = larguraDaPagina({ largura: 1180, altura: 700 }, A4, "pagina", false);
    expect(deitado * (A4.altura / A4.largura)).toBeLessThanOrEqual(700 - FOLGA);
    // "largura" usa a largura inteira.
    expect(larguraDaPagina({ largura: 820, altura: 1000 }, A4, "largura", false)).toBe(820 - FOLGA);
  });

  it("quem ainda não escolheu: toque e tela em pé começam na largura toda; computador deitado, na página inteira", () => {
    expect(encaixePadrao(true, 834, 1194)).toBe("largura");
    expect(encaixePadrao(true, 1194, 834)).toBe("largura");
    expect(encaixePadrao(false, 900, 1400)).toBe("largura");
    expect(encaixePadrao(false, 1366, 768)).toBe("pagina");
  });

  it("rolagem lateral sempre cabe na altura", () => {
    const l = larguraDaPagina({ largura: 2000, altura: 800 }, A4, "largura", true);
    expect(Math.round(l * (A4.altura / A4.largura))).toBeLessThanOrEqual(800 - FOLGA);
  });

  it("virar a página ao soltar", () => {
    const inicios = [0, 1000, 2000, 3000];
    expect(paginaNaPosicao(1500, inicios)).toBe(1);
    // Arrastou pouco: volta para a de origem.
    expect(paginaAoSoltar(1100, inicios, 0, 1000, 1)).toBe(1);
    // Passou de 20%: vai para a próxima; para trás, a anterior.
    expect(paginaAoSoltar(1250, inicios, 0, 1000, 1)).toBe(2);
    expect(paginaAoSoltar(750, inicios, 0, 1000, 1)).toBe(0);
    // Soltou rápido: vai mesmo arrastando pouco.
    expect(paginaAoSoltar(1050, inicios, 0.8, 1000, 1)).toBe(2);
    expect(paginaAoSoltar(950, inicios, -0.8, 1000, 1)).toBe(0);
    // Nas pontas não passa do limite.
    expect(paginaAoSoltar(3300, inicios, 1, 1000, 3)).toBe(3);
    expect(paginaAoSoltar(-100, inicios, -1, 1000, 0)).toBe(0);
  });
});
