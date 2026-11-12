import { describe, expect, it } from "vitest";
import { ehImagem, ehPdf, nomeSemExtensao, ordensEntre, tamanhoImportado } from "./importarPaginas";

describe("importar páginas", () => {
  it("A4 em pé e slide deitado ganham o tamanho certo", () => {
    expect(tamanhoImportado(595.28, 841.89)).toBe("custom:794x1123");
    expect(tamanhoImportado(960, 540)).toBe("custom:1123x632");
  });
  it("página muito comprida cabe na altura máxima; nada fica menor que o mínimo", () => {
    expect(tamanhoImportado(1080, 4000)).toBe("custom:513x1900");
    expect(tamanhoImportado(4000, 200)).toBe("custom:1123x300");
    expect(tamanhoImportado(0, 10)).toBe("a4");
  });
  it("ordens entre duas páginas, depois da última e antes da primeira, nunca 0", () => {
    expect(ordensEntre(1, 2, 3)).toEqual([1.25, 1.5, 1.75]);
    expect(ordensEntre(5, undefined, 2)).toEqual([6, 7]);
    expect(ordensEntre(undefined, 1, 1)).toEqual([0.5]);
    expect(ordensEntre(undefined, 0, 2)).toEqual([-2, -1]);
    expect(ordensEntre(-1, 1, 1)).toEqual([-1e-6]);
  });
  it("tipos e nomes", () => {
    expect(ehPdf({ name: "Aula 3.PDF", type: "" })).toBe(true);
    expect(ehImagem({ name: "quadro.jpg", type: "image/jpeg" })).toBe(true);
    expect(ehImagem({ name: "texto.docx", type: "" })).toBe(false);
    expect(nomeSemExtensao("Aula 3.pdf")).toBe("Aula 3");
  });
});
