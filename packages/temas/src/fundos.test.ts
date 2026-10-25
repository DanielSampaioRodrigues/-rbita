// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { contraste } from "./contraste";
import { camadaDeFundo, escurecerAmostras, misturar, opacidadeNecessaria, PADROES, type Rgb } from "./fundos";
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
