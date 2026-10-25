import { describe, expect, it } from "vitest";
import { contraste, lerHex, MINIMO } from "./contraste";
import { nomeVariavel, paletaFinal } from "./aplicar";
import { papel } from "./papel";
import type { Paleta, Tema } from "./tipos";

describe("contraste", () => {
  it("dá 21 entre preto e branco e 1 entre cores iguais", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contraste("#777", "#777777")).toBeCloseTo(1, 5);
  });

  it("recusa cor inválida", () => {
    expect(() => lerHex("verde")).toThrow();
  });
});

describe("nomes das variáveis", () => {
  it("converte para o padrão do CSS", () => {
    expect(nomeVariavel("superficieAlternativa")).toBe("--cor-superficie-alternativa");
  });
});

/** Todo par de texto e fundo que aparece na interface. */
function verificarPaleta(p: Paleta) {
  const fundos = { fundo: p.fundo, superficie: p.superficie, superficieAlternativa: p.superficieAlternativa };
  const falhas: string[] = [];
  const exigir = (nome: string, a: string, b: string, minimo: number) => {
    const valor = contraste(a, b);
    if (valor < minimo) falhas.push(`${nome}: ${valor.toFixed(2)} (mínimo ${minimo})`);
  };
  for (const [nomeFundo, fundo] of Object.entries(fundos)) {
    exigir(`texto sobre ${nomeFundo}`, p.texto, fundo, 7);
    exigir(`texto suave sobre ${nomeFundo}`, p.textoSuave, fundo, MINIMO.texto);
    exigir(`destaque sobre ${nomeFundo}`, p.destaque, fundo, MINIMO.texto);
    exigir(`borda de controle sobre ${nomeFundo}`, p.bordaControle, fundo, MINIMO.controle);
    exigir(`foco sobre ${nomeFundo}`, p.foco, fundo, MINIMO.controle);
    exigir(`atenção sobre ${nomeFundo}`, p.atencao, fundo, MINIMO.texto);
  }
  exigir("texto sobre destaque", p.textoSobreDestaque, p.destaque, MINIMO.texto);
  return falhas;
}

const temas: Tema[] = [papel];

describe.each(temas)("tema $nome", (tema) => {
  for (const modo of ["claro", "escuro"] as const) {
    for (const baixo of [false, true]) {
      it(`tem contraste suficiente no modo ${modo}${baixo ? " com baixo estímulo" : ""}`, () => {
        expect(verificarPaleta(paletaFinal(tema, modo, baixo))).toEqual([]);
      });
    }
  }
});
