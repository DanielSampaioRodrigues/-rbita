import type { Elemento, Traco } from "@orbita/caderno";
import { describe, expect, it } from "vitest";
import { palavrasDaPagina } from "./escrita";

// Um "traço de letra" de 12 x 20 px em (x, y).
const letra = (id: string, x: number, y: number): Traco => ({ tipo: "traco", id, ferramenta: "caneta", cor: "#1f2937", espessura: 2, pontos: [{ x, y, p: 0.5 }, { x: x + 12, y: y + 20, p: 0.5 }] } as Traco);

describe("palavras escritas à mão", () => {
  it("separa as linhas e as palavras pelos vãos", () => {
    const els: Elemento[] = [
      // linha 1: "ab" (letras coladas) e "cd" depois de um vão grande
      letra("a", 100, 100), letra("b", 114, 102), letra("c", 160, 100), letra("d", 174, 101),
      // linha 2: uma palavra
      letra("e", 100, 160), letra("f", 113, 161),
      // marca-texto não conta
      { tipo: "traco", id: "m", ferramenta: "marcatexto", cor: "#ff0", espessura: 16, pontos: [{ x: 0, y: 0, p: 1 }, { x: 300, y: 0, p: 1 }] } as Traco,
    ];
    const p = palavrasDaPagina(els);
    expect(p.map((x) => x.ids)).toEqual([["a", "b"], ["c", "d"], ["e", "f"]]);
    expect(p.map((x) => x.n)).toEqual([1, 2, 3]);
    expect(p[0].x).toBeLessThan(100);
  });
  it("página sem escrita: nenhuma palavra", () => {
    expect(palavrasDaPagina([])).toEqual([]);
  });
});
