// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { contraste } from "./contraste";
import { camadaDeFundo, escurecerAmostras, misturar, opacidadeNecessaria, PADROES, tamanhoDoLadrilho, type Rgb } from "./fundos";
import { TEMAS } from "./prontos";
import { papel } from "./papel";

const p = papel.claro;
const hex = (c: Rgb) => "#" + c.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");

describe("contraste automático", () => {
  it("fundo igual ao do tema não precisa de painel", () => {
    expect(opacidadeNecessaria([[244, 241, 234]], p)).toBe(0);
  });

  it("foto escura pede painel quase opaco e garante o contraste", () => {
    const escuras: Rgb[] = Array.from({ length: 100 }, (_, i) => [10 + (i % 30), 15, 30 + (i % 20)]);
    const o = opacidadeNecessaria(escuras, p);
    expect(o).toBeGreaterThan(0.6);
    for (const a of escuras) {
      const cor = hex(misturar(a, p.fundo, o));
      expect(contraste(p.texto, cor)).toBeGreaterThanOrEqual(7);
      expect(contraste(p.textoSuave, cor)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("respeita o mínimo pedido e o escurecimento muda as amostras", () => {
    expect(opacidadeNecessaria([[244, 241, 234]], p, 0.6)).toBe(0.6);
    expect(escurecerAmostras([[200, 200, 200]], 0.5)[0][0]).toBe(100);
  });
});

describe("camadas de fundo", () => {
  it("baixo estímulo deixa tudo liso", () => {
    expect(camadaDeFundo({ tipo: "padrao", nome: "estrelas" }, p, { baixoEstimulo: true, reduzirAnimacao: false }).imagem).toBe("none");
  });

  it("padrões são pintados com a cor do tema e todos os temas dão leitura sobre eles", () => {
    for (const tema of TEMAS) {
      for (const modo of ["claro", "escuro"] as const) {
        const paleta = tema[modo];
        for (const nome of Object.keys(PADROES)) {
          const c = camadaDeFundo({ tipo: "padrao", nome }, paleta, { baixoEstimulo: false, reduzirAnimacao: false });
          expect(c.imagem).toContain(encodeURIComponent(paleta.textoSuave));
          expect(opacidadeNecessaria(c.amostrasConhecidas!, paleta)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("SVG animado fica parado quando não pediu animação", () => {
    const svg = `<svg><circle r="3"><animate attributeName="r" to="9" dur="1s"/></circle></svg>`;
    const parado = camadaDeFundo({ tipo: "svg", conteudo: svg, repetir: true, animar: false }, p, { baixoEstimulo: false, reduzirAnimacao: false });
    expect(decodeURIComponent(parado.imagem)).not.toContain("<animate");
    const animado = camadaDeFundo({ tipo: "svg", conteudo: svg, repetir: true, animar: true }, p, { baixoEstimulo: false, reduzirAnimacao: false });
    expect(decodeURIComponent(animado.imagem)).toContain("<animate");
    const sistema = camadaDeFundo({ tipo: "svg", conteudo: svg, repetir: true, animar: true }, p, { baixoEstimulo: false, reduzirAnimacao: true });
    expect(decodeURIComponent(sistema.imagem)).not.toContain("<animate");
  });
});

describe("tamanhoDoLadrilho", () => {
  it("usa o viewBox quando o SVG não diz o tamanho (como a IA escreve)", () => {
    expect(tamanhoDoLadrilho('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path/></svg>')).toBe("80px 80px");
  });
  it("prefere largura e altura e limita tamanhos extremos", () => {
    expect(tamanhoDoLadrilho('<svg width="120" height="60px" viewBox="0 0 10 10"></svg>')).toBe("120px 60px");
    expect(tamanhoDoLadrilho('<svg viewBox="0 0 1200 600"></svg>')).toBe("600px 300px");
    expect(tamanhoDoLadrilho('<svg viewBox="0 0 12 6"></svg>')).toBe("48px 24px");
    expect(tamanhoDoLadrilho("<svg></svg>")).toBe("200px 200px");
  });
});

describe("coleção Rua (fundos urbanos)", () => {
  it("cada fundo tem variante clara e escura, e fica liso no baixo estímulo", async () => {
    const { URBANOS, varianteUrbana } = await import("./urbanos");
    expect(Object.keys(URBANOS).length).toBeGreaterThanOrEqual(8);
    const claro = papel.claro;
    const escuro = papel.escuro;
    expect(varianteUrbana(claro.fundo)).toBe("claro");
    expect(varianteUrbana(escuro.fundo)).toBe("escuro");
    for (const nome of Object.keys(URBANOS)) {
      const c = camadaDeFundo({ tipo: "padrao", nome }, claro, { baixoEstimulo: false, reduzirAnimacao: false });
      const e = camadaDeFundo({ tipo: "padrao", nome }, escuro, { baixoEstimulo: false, reduzirAnimacao: false });
      expect(c.imagem).toMatch(/^url\("data:image\/svg\+xml/);
      // A cor de fundo do tema fica por baixo do desenho, e as variantes mudam as cores.
      expect(decodeURIComponent(c.imagem)).toContain(claro.fundo);
      expect(decodeURIComponent(e.imagem)).toContain(escuro.fundo);
      expect(c.imagem).not.toBe(e.imagem);
      // Mesmo desenho a cada abertura.
      expect(camadaDeFundo({ tipo: "padrao", nome }, claro, { baixoEstimulo: false, reduzirAnimacao: false }).imagem).toBe(c.imagem);
      expect(camadaDeFundo({ tipo: "padrao", nome }, claro, { baixoEstimulo: true, reduzirAnimacao: false }).imagem).toBe("none");
      // Desenho do próprio Órbita: nada de script nem link para fora.
      expect(decodeURIComponent(c.imagem)).not.toMatch(/<script|href=|https?:\/\/(?!www\.w3\.org)/);
    }
  });
});
