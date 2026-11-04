import { describe, expect, it } from "vitest";
import { acharFonte, casa, cssDoAparelho, FONTES_NORMAS, generica, montarLista, primeiraFamilia } from "./fontes";

describe("fontes do editor", () => {
  it("lê a primeira família da pilha", () => {
    expect(primeiraFamilia('"Times New Roman", Times, serif')).toBe("Times New Roman");
    expect(primeiraFamilia("Arial, sans-serif")).toBe("Arial");
    expect(primeiraFamilia("'Segoe UI'")).toBe("Segoe UI");
  });
  it("as normas ABNT vêm primeiro, com a substituta de mesma medida", () => {
    expect(FONTES_NORMAS.slice(0, 2).map((f) => f.nome)).toEqual(["Times New Roman", "Arial"]);
    expect(FONTES_NORMAS[0].css).toContain("Tinos");
    expect(FONTES_NORMAS[1].css).toContain("Arimo");
  });
  it("acha a fonte de um texto antigo pela primeira família", () => {
    const lista = montarLista([]);
    // Pilha antiga da 0.50 ("Monoespaçada").
    expect(acharFonte(lista, '"Courier New", ui-monospace, monospace')?.nome).toBe("Courier New");
    expect(acharFonte(lista, '"Times New Roman", Times, "Liberation Serif", serif')?.nome).toBe("Times New Roman");
    expect(acharFonte(lista, '"Fonte Que Não Existe", serif')).toBeUndefined();
  });
  it("a lista do aparelho não repete as outras nem mostra as substitutas", () => {
    const lista = montarLista(["Arial", "Tinos", "Segoe UI", "Bahnschrift", "segoe ui", "Roboto"]);
    const aparelho = lista.filter((f) => f.grupo === "aparelho").map((f) => f.nome);
    expect(aparelho).toEqual(["Bahnschrift", "Segoe UI"]);
  });
  it("escolhe a genérica de reserva pelo nome", () => {
    expect(generica("Consolas")).toBe("monospace");
    expect(generica("Book Antiqua")).toBe("serif");
    expect(generica("Segoe Script")).toBe("cursive");
    expect(generica("Noto Sans")).toBe("sans-serif");
    expect(cssDoAparelho('Fonte "X"')).toBe('"Fonte X", sans-serif');
  });
  it("a busca não liga para acentos e maiúsculas", () => {
    expect(casa("Times New Roman", "times")).toBe(true);
    expect(casa("Didot", "dídot")).toBe(true);
    expect(casa("Arial", "garamond")).toBe(false);
  });
});
