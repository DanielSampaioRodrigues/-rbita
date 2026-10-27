import { describe, expect, it } from "vitest";
import { cenaVazia, lerCena, papelPadrao, serializarCena, TAMANHOS, type Cena } from "./index";

describe("caderno: tipos e cena", () => {
  it("cena vazia e papel padrão", () => {
    expect(cenaVazia()).toEqual({ elementos: [] });
    expect(papelPadrao().modelo).toBe("liso");
  });

  it("serializa e lê a cena de volta", () => {
    const cena: Cena = { elementos: [{ tipo: "traco", id: "1", ferramenta: "caneta", cor: "#000", espessura: 2, pontos: [{ x: 0, y: 0, p: 1 }] }] };
    expect(lerCena(serializarCena(cena))).toEqual(cena);
  });

  it("guarda cena com traço e caixa de texto juntos", () => {
    const cena: Cena = { elementos: [
      { tipo: "traco", id: "1", ferramenta: "caneta", cor: "#000", espessura: 2, pontos: [{ x: 0, y: 0, p: 1 }] },
      { tipo: "texto", id: "2", x: 40, y: 60, largura: 240, texto: "oi", cor: "#1f2937", tamanho: 28 },
    ] };
    expect(lerCena(serializarCena(cena))).toEqual(cena);
  });

  it("texto vazio ou inválido vira cena vazia, sem quebrar", () => {
    expect(lerCena("")).toEqual({ elementos: [] });
    expect(lerCena("{ não é json")).toEqual({ elementos: [] });
    expect(lerCena("{}")).toEqual({ elementos: [] });
  });

  it("tamanhos de página conhecidos", () => {
    expect(TAMANHOS.a4.altura).toBeGreaterThan(TAMANHOS.a4.largura);
    expect(TAMANHOS.a5.largura).toBeLessThan(TAMANHOS.a4.largura);
  });
});
