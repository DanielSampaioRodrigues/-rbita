// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { citacaoNoTexto, deCsl, formatarReferencia, lerAutores, paraCsl, type Referencia } from "./referencias";

const livro: Referencia = { tipo: "book", autores: lerAutores("Silva, Maria da\nJoão Souza"), titulo: "Organização para pessoas neurodivergentes", ano: "2020", editora: "Editora Exemplo", local: "São Paulo", edicao: "2" };

describe("referências", () => {
  it("lê autores nos dois jeitos", () => {
    expect(lerAutores("Silva, Maria\nJoão Souza")).toEqual([{ family: "Silva", given: "Maria" }, { family: "Souza", given: "João" }]);
  });
  it("vai e volta do CSL-JSON", () => {
    const c = paraCsl(livro);
    expect(c.issued).toEqual({ "date-parts": [[2020]] });
    expect(deCsl(c).titulo).toBe(livro.titulo);
  });
  it("formata em ABNT (sobrenome em maiúsculas, título em negrito)", async () => {
    const r = await formatarReferencia(livro, "abnt");
    expect(r.texto).toContain("SILVA, Maria da");
    expect(r.texto).toContain("São Paulo: Editora Exemplo, 2020");
    expect(r.html).toMatch(/<b>Organização para pessoas neurodivergentes<\/b>/);
    // NBR 10520:2023: a citação entre parênteses fica em maiúsculas e minúsculas.
    expect(await citacaoNoTexto(livro, "abnt")).toBe("(Silva; Souza, 2020)");
  });
  it("formata em APA", async () => {
    const r = await formatarReferencia(livro, "apa");
    expect(r.texto).toContain("Silva, M. da, & Souza, J. (2020)");
  });
});
