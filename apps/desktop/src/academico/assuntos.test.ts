import { describe, expect, it } from "vitest";
import { comAssunto, daMateria, type Assuntos } from "./assuntos";

describe("matéria como assunto", () => {
  const vazio: Assuntos = { cadernos: {}, livros: {} };
  it("liga, troca e desliga", () => {
    let a = comAssunto(vazio, "cadernos", "c1", "m1");
    a = comAssunto(a, "livros", "l1", "m1");
    a = comAssunto(a, "cadernos", "c2", "m2");
    expect(a).toEqual({ cadernos: { c1: "m1", c2: "m2" }, livros: { l1: "m1" } });
    a = comAssunto(a, "cadernos", "c1", "");
    expect(a.cadernos).toEqual({ c2: "m2" });
  });
  it("a matéria mostra só o que ainda existe", () => {
    const a: Assuntos = { cadernos: { c1: "m1", c9: "m1" }, livros: { l1: "m1", l2: "m2" } };
    expect(daMateria(a, "m1", { cadernos: new Set(["c1"]), livros: new Set(["l1", "l2"]) })).toEqual({ cadernos: ["c1"], livros: ["l1"] });
  });
});
