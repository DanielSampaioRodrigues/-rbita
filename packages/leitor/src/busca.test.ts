import { describe, expect, it } from "vitest";
import { normalizar, trechoEmVolta } from "./leitor";

describe("busca no livro", () => {
  it("sem acento e sem maiúscula, com o mesmo tamanho do texto", () => {
    expect(normalizar("Memória de Trabalho")).toBe("memoria de trabalho");
    expect(normalizar("ação").length).toBe("ação".length);
    expect(normalizar("A MEMÓRIA").indexOf(normalizar("memoria"))).toBe(2);
  });
  it("trecho em volta com reticências", () => {
    const t = "x".repeat(100) + "ALVO" + "y".repeat(100);
    const r = trechoEmVolta(t, 100, 4, 10);
    expect(r).toBe(`…${"x".repeat(10)}ALVO${"y".repeat(10)}…`);
    expect(trechoEmVolta("curto ALVO", 6, 4)).toBe("curto ALVO");
  });
});
