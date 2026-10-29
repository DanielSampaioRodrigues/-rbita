import { describe, expect, it } from "vitest";
import { juntarImagens, refDaImagem, refsUsadas, separarImagens } from "./imagensFundo";
import { PADRAO, validar } from "./preferencias";

const FOTO = "data:image/jpeg;base64," + "A".repeat(5000);

describe("imagem de fundo guardada à parte", () => {
  it("tira a foto das preferências e guarda uma vez só, mesmo usada em dois lugares", () => {
    const prefs = { ...PADRAO, fundo: { tipo: "imagem" as const, dados: FOTO, desfoque: 2, escurecimento: 0.1 }, imagemFundo: FOTO };
    const { leve, imagens } = separarImagens(prefs);
    expect(imagens.size).toBe(1);
    expect(JSON.stringify(leve).length).toBeLessThan(2000);
    expect(refsUsadas(leve)).toEqual([refDaImagem(FOTO)]);
    // A referência passa na conferência ao abrir o app.
    expect(validar(JSON.parse(JSON.stringify(leve))).fundo).toEqual(leve.fundo);
    expect(juntarImagens(leve, imagens)).toEqual(prefs);
  });

  it("se a imagem sumiu do aparelho, volta ao fundo do tema sem quebrar", () => {
    const { leve } = separarImagens({ ...PADRAO, fundo: { tipo: "imagem", dados: FOTO, desfoque: 0, escurecimento: 0 }, imagemFundo: FOTO });
    expect(juntarImagens(leve, new Map())).toMatchObject({ fundo: null, imagemFundo: "" });
  });

  it("não mexe em preferências sem imagem", () => {
    const { leve, imagens } = separarImagens(PADRAO);
    expect(leve).toEqual(PADRAO);
    expect(imagens.size).toBe(0);
  });
});
