import { describe, expect, it } from "vitest";
import type { Elemento } from "@orbita/caderno";
import { copiarElementos, lerIndice, normalizarObjetos } from "./biblioteca";

describe("biblioteca do caderno", () => {
  it("lê o índice e descarta o inválido", () => {
    const l = lerIndice([{ id: "b-1", nome: "Logo", tipo: "objetos", criadoEm: 1 }, { id: "b-1", nome: "repetido", tipo: "trecho" }, { id: "X!", tipo: "pagina" }, { id: "b-2", tipo: "outro" }, { id: "b-3", nome: "  ", tipo: "trecho" }]);
    expect(l.map((i) => i.id)).toEqual(["b-1", "b-3"]);
    expect(l[1].nome).toBe("Sem nome");
  });
  it("normaliza a seleção e copia com ids novos (setas e grupos acompanham)", () => {
    const els: Elemento[] = [
      { tipo: "texto", id: "a", x: 100, y: 200, largura: 100, texto: "<p>A</p>", cor: "#000", tamanho: 16, grupo: "g1" },
      { tipo: "texto", id: "b", x: 300, y: 200, largura: 100, texto: "<p>B</p>", cor: "#000", tamanho: 16, grupo: "g1" },
      { tipo: "forma", id: "s", forma: "seta", x1: 200, y1: 210, x2: 300, y2: 210, cor: "#000", espessura: 2, ligaInicio: "a", ligaFim: "b" },
    ];
    const c = normalizarObjetos(els, { x: 100, y: 200, largura: 300, altura: 40 });
    expect(c.elementos[0]).toMatchObject({ x: 0, y: 0 });
    let n = 0;
    const copia = copiarElementos(c.elementos, 10, 20, () => `n${n++}`);
    const [a, b, s] = copia as [Extract<Elemento, { tipo: "texto" }>, Extract<Elemento, { tipo: "texto" }>, Extract<Elemento, { tipo: "forma" }>];
    expect(a.id).not.toBe("a");
    expect(a).toMatchObject({ x: 10, y: 20 });
    expect(s.ligaInicio).toBe(a.id);
    expect(s.ligaFim).toBe(b.id);
    expect(a.grupo).toBe(b.grupo);
    expect(a.grupo).not.toBe("g1");
  });
});
