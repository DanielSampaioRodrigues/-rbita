import { describe, expect, it } from "vitest";
import { textoSimples } from "./textoSimples";

describe("textoSimples", () => {
  it("tira a marcação e deixa o texto", () => {
    const md = "## Ideia\n\n**Convidar** pessoas *autistas* e ==artistas==.\n\n- [ ] Ligar para a Ana\n- tópico\n1. primeiro\n> citação\n[site](https://exemplo.com)";
    expect(textoSimples(md)).toBe("Ideia\n\nConvidar pessoas autistas e artistas.\n\nLigar para a Ana\ntópico\nprimeiro\ncitação\nsite");
  });
  it("não mexe em texto comum", () => {
    expect(textoSimples("comprar pão e café às 8h")).toBe("comprar pão e café às 8h");
  });
});
