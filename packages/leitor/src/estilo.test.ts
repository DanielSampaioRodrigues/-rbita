import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO } from "./tipos";
import { coresDeLeitura, estiloDoCorpo, temaEpub, zoomPdf } from "./estilo";

describe("estilo de leitura", () => {
  it("cada fundo tem cor de papel e de texto", () => {
    expect(coresDeLeitura("escuro").fundo).toBe("#15171a");
    expect(coresDeLeitura("branco").texto).toBe("#1a1a1a");
    // Valor desconhecido cai no creme.
    expect(coresDeLeitura("xpto" as never)).toEqual(coresDeLeitura("creme"));
  });

  it("monta o estilo do corpo a partir da configuração", () => {
    const css = estiloDoCorpo({ ...CONFIG_PADRAO, tamanho: 120, entrelinha: 2, alinhamento: "justificado", corFundo: "escuro" });
    expect(css["font-size"]).toBe("120%");
    expect(css["line-height"]).toBe("2");
    expect(css["text-align"]).toBe("justify");
    expect(css.background).toBe("#15171a");
    expect(css["font-family"]).toContain("Atkinson");
  });

  it("o tema do epub põe a margem como padding lateral", () => {
    const tema = temaEpub({ ...CONFIG_PADRAO, margem: 10 });
    expect(tema.body["padding-left"]).toBe("10%");
    expect(tema.body["padding-right"]).toBe("10%");
  });

  it("o zoom do PDF fica entre 0,5 e 4", () => {
    expect(zoomPdf({ ...CONFIG_PADRAO, tamanho: 100 })).toBe(1);
    expect(zoomPdf({ ...CONFIG_PADRAO, tamanho: 200 })).toBe(2);
    expect(zoomPdf({ ...CONFIG_PADRAO, tamanho: 10 })).toBe(0.5);
    expect(zoomPdf({ ...CONFIG_PADRAO, tamanho: 9999 })).toBe(4);
  });
});
