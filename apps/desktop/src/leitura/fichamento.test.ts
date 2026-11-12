import { describe, expect, it } from "vitest";
import type { Anotacao } from "../api";
import { autores, chamada, chaveAutoria, fichamentoEmTexto, formatarFicha, partesDoAutor, referenciaSugerida } from "./fichamento";

const ficha = (p: Partial<Anotacao>): Anotacao => ({
  id: "f", livroId: "l", tipo: "ficha", epubCfi: "", epubCfiRange: "", pdfPagina: 0, cor: "", texto: "", trecho: "", pontos: [], espessura: 0, ficha: "comentario", paginaRef: "", criadoEm: 0, ...p,
});

describe("autoria", () => {
  it("separa sobrenome e prenomes", () => {
    expect(partesDoAutor("Lev Vygotsky")).toEqual({ sobrenome: "VYGOTSKY", prenomes: "Lev" });
    expect(partesDoAutor("Vygotsky, Lev")).toEqual({ sobrenome: "VYGOTSKY", prenomes: "Lev" });
    expect(partesDoAutor("Ana Maria da Silva")).toEqual({ sobrenome: "SILVA", prenomes: "Ana Maria da" });
    expect(partesDoAutor("Joaquim Assis Júnior")).toEqual({ sobrenome: "ASSIS JÚNIOR", prenomes: "Joaquim" });
    expect(partesDoAutor("Platão")).toEqual({ sobrenome: "PLATÃO", prenomes: "" });
  });
  it("vários autores", () => {
    expect(autores("Paulo Freire e Ira Shor")).toEqual(["Paulo Freire", "Ira Shor"]);
    expect(chaveAutoria("Paulo Freire e Ira Shor")).toBe("FREIRE; SHOR");
    expect(chaveAutoria("A Um; B Dois; C Três; D Quatro")).toBe("UM et al.");
    expect(chaveAutoria("")).toBe("AUTOR");
  });
  it("chamada e referência", () => {
    expect(chamada("Lev Vygotsky", "1998", "23")).toBe("(VYGOTSKY, 1998, p. 23)");
    expect(chamada("Lev Vygotsky", "", "")).toBe("(VYGOTSKY, s. d.)");
    expect(referenciaSugerida("A formação social da mente", "Lev Vygotsky", "1998")).toBe("VYGOTSKY, Lev. A formação social da mente. Cidade: Editora, 1998.");
  });
});

describe("fichas", () => {
  it("citação curta entre aspas, com a chamada", () => {
    const x = formatarFicha(ficha({ ficha: "citacao", texto: "O aprendizado desperta processos internos.", paginaRef: "103" }), "Lev Vygotsky", "1998");
    expect(x).toEqual({ rotulo: "Citação direta, p. 103", texto: "“O aprendizado desperta processos internos.”", longa: false, chamada: "(VYGOTSKY, 1998, p. 103)" });
  });
  it("citação longa sem aspas, com recuo", () => {
    const x = formatarFicha(ficha({ ficha: "citacao", texto: "a".repeat(300), pdfPagina: 12 }), "Lev Vygotsky", "1998");
    expect(x.longa).toBe(true);
    expect(x.texto.startsWith("“")).toBe(false);
    expect(x.chamada).toBe("(VYGOTSKY, 1998, p. 12)");
  });
  it("comentário não pega a página do PDF sozinho", () => {
    expect(formatarFicha(ficha({ ficha: "comentario", texto: "X", pdfPagina: 4 }), "A B", "1").rotulo).toBe("Comentário");
    expect(formatarFicha(ficha({ ficha: "comentario", texto: "X", paginaRef: "7" }), "A B", "1").rotulo).toBe("Comentário, p. 7");
    expect(formatarFicha(ficha({ ficha: "parafrase", texto: "X", pdfPagina: 4 }), "A B", "1").rotulo).toBe("Paráfrase (citação indireta), p. 4");
  });
  it("resumo e comentário sem chamada; paráfrase com chamada", () => {
    expect(formatarFicha(ficha({ ficha: "resumo", texto: "Resumo." }), "X Y", "2000").chamada).toBe("");
    expect(formatarFicha(ficha({ ficha: "parafrase", texto: "Ideia." }), "X Y", "2000").chamada).toBe("(Y, 2000)");
  });
  it("texto do fichamento", () => {
    const txt = fichamentoEmTexto("Livro", "Lev Vygotsky", { referencia: "", ano: "1998" }, [
      ficha({ ficha: "citacao", texto: "Curta.", paginaRef: "5" }),
      ficha({ ficha: "comentario", texto: "Gostei." }),
    ]);
    expect(txt).toBe(`# Fichamento

**Referência:** VYGOTSKY, Lev. Livro. Cidade: Editora, 1998.

## Citação direta, p. 5

“Curta.” (VYGOTSKY, 1998, p. 5).

## Comentário

Gostei.
`);
  });
});
