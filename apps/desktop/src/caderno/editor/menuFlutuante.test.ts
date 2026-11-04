import { describe, expect, it } from "vitest";
import { encaixarNaTela, posicaoDaSelecao } from "./menuFlutuante";

describe("menu flutuante", () => {
  const tela = { largura: 1000, altura: 800 };
  it("fica em cima do trecho, centralizado, no computador", () => {
    const p = posicaoDaSelecao({ left: 300, top: 200, bottom: 220 }, { left: 380, right: 400, top: 200, bottom: 220 }, false);
    expect(p.x).toBe(350);
    expect(encaixarNaTela(p, 200, 80, tela)).toEqual({ left: 250, top: 112 });
  });
  it("no iPad fica embaixo (em cima vem o menu do sistema)", () => {
    const p = posicaoDaSelecao({ left: 300, top: 200, bottom: 220 }, { left: 380, right: 400, top: 200, bottom: 220 }, true);
    expect(encaixarNaTela(p, 200, 80, tela).top).toBe(248);
  });
  it("sem espaço em cima, vai para baixo; nunca sai pela lateral", () => {
    const p = posicaoDaSelecao({ left: 5, top: 30, bottom: 50 }, { left: 10, right: 20, top: 30, bottom: 50 }, false);
    expect(encaixarNaTela(p, 300, 80, tela)).toEqual({ left: 8, top: 62 });
    const q = posicaoDaSelecao({ left: 980, top: 400, bottom: 420 }, { left: 990, right: 995, top: 400, bottom: 420 }, false);
    expect(encaixarNaTela(q, 300, 80, tela).left).toBe(692);
  });
  it("várias linhas: perto do fim do trecho", () => {
    const p = posicaoDaSelecao({ left: 300, top: 200, bottom: 220 }, { left: 120, right: 130, top: 260, bottom: 280 }, false);
    expect(p.x).toBe(120);
    expect(p.topo).toBe(200);
    expect(p.base).toBe(280);
  });
});
