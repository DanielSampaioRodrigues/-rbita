import { describe, expect, it } from "vitest";
import type { RegistroSaude } from "../api";
import { agruparPorDia, contarGatilhos, gatilhosConhecidos, juntarNota, separarNota } from "./gatilhos";
import { diasAte, ordenarPorConsulta } from "../cuidado/consulta";

const reg = (over: Partial<RegistroSaude>): RegistroSaude => ({ id: "x", tipo: "sobrecarga", momento: 0, intensidade: null, nota: "", ...over });

describe("gatilhos sensoriais", () => {
  it("junta e separa a linha de gatilhos da nota", () => {
    const nota = juntarNota(["Barulho", " luz ", "barulho"], "  no mercado ");
    expect(nota).toBe("Gatilhos: Barulho, luz\nno mercado");
    expect(separarNota(nota)).toEqual({ gatilhos: ["Barulho", "luz"], texto: "no mercado" });
    expect(juntarNota([], " só nota ")).toBe("só nota");
    expect(separarNota("sem gatilho")).toEqual({ gatilhos: [], texto: "sem gatilho" });
  });

  it("conta os gatilhos e oferece os padrões mais os criados pela pessoa", () => {
    const rs = [
      reg({ nota: "Gatilhos: Barulho, Cheiro de café" }),
      reg({ nota: "Gatilhos: barulho" }),
      reg({ nota: "outra coisa" }),
    ];
    expect(contarGatilhos(rs)).toEqual([
      { gatilho: "Barulho", vezes: 2 },
      { gatilho: "Cheiro de café", vezes: 1 },
    ]);
    expect(gatilhosConhecidos(rs, ["Barulho", "Luz"])).toEqual(["Barulho", "Luz", "Cheiro de café"]);
  });

  it("agrupa por dia, do mais novo ao mais antigo", () => {
    const d1 = new Date(2026, 9, 20, 9).getTime();
    const d1b = new Date(2026, 9, 20, 18).getTime();
    const d2 = new Date(2026, 9, 22, 8).getTime();
    const g = agruparPorDia([reg({ id: "a", momento: d1 }), reg({ id: "b", momento: d2 }), reg({ id: "c", momento: d1b })]);
    expect(g.map((x) => x.dia)).toEqual(["2026-10-22", "2026-10-20"]);
    expect(g[1].registros.map((r) => r.id)).toEqual(["c", "a"]);
  });
});

describe("próxima consulta", () => {
  it("conta os dias até a data", () => {
    expect(diasAte("2026-10-29", "2026-10-29")).toBe(0);
    expect(diasAte("2026-10-29", "2026-11-02")).toBe(4);
    expect(diasAte("2026-10-29", "2026-10-20")).toBe(-9);
    expect(diasAte("2026-10-29", "")).toBeNull();
  });

  it("ordena: próximas primeiro, depois sem data, depois as que passaram", () => {
    const ps = [
      { nome: "C", proximaConsulta: "" },
      { nome: "A", proximaConsulta: "2026-11-10" },
      { nome: "B", proximaConsulta: "2026-10-01" },
      { nome: "D", proximaConsulta: "2026-10-30" },
    ];
    expect(ordenarPorConsulta(ps, "2026-10-29").map((p) => p.nome)).toEqual(["D", "A", "C", "B"]);
  });
});
