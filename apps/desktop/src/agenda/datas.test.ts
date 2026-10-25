import { describe, expect, it } from "vitest";
import type { Evento } from "../api";
import { chaveDia, diasDaGradeDoMes, expandir, inicioDaSemana } from "./datas";

const ev = (x: Partial<Evento>): Evento => ({
  id: "e", titulo: "t", inicio: new Date(2026, 9, 1, 14, 0).getTime(), fim: new Date(2026, 9, 1, 15, 0).getTime(),
  diaInteiro: false, repeticao: null, modelo: false, notas: "", excecoes: [], ...x,
});
const outubro = [new Date(2026, 9, 1), new Date(2026, 10, 1)] as const;

describe("repetição de eventos", () => {
  it("evento simples aparece só no seu dia", () => {
    const o = expandir([ev({})], ...outubro);
    expect(o.map((x) => x.dia)).toEqual(["2026-10-01"]);
  });

  it("semanal às quintas, mantendo o horário e a duração", () => {
    const o = expandir([ev({ repeticao: { frequencia: "semanal", dias: [4], ate: null } })], ...outubro);
    expect(o.map((x) => x.dia)).toEqual(["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29"]);
    expect(o[2].inicio.getHours()).toBe(14);
    expect(o[2].fim!.getTime() - o[2].inicio.getTime()).toBe(3_600_000);
  });

  it("diária respeita a data final e as datas puladas", () => {
    const o = expandir(
      [ev({ repeticao: { frequencia: "diaria", dias: [], ate: new Date(2026, 9, 5).getTime() }, excecoes: ["2026-10-03"] })],
      ...outubro,
    );
    expect(o.map((x) => x.dia)).toEqual(["2026-10-01", "2026-10-02", "2026-10-04", "2026-10-05"]);
  });

  it("mensal no dia 31 pula meses curtos", () => {
    const base = new Date(2026, 0, 31, 9).getTime();
    const o = expandir([ev({ inicio: base, fim: null, repeticao: { frequencia: "mensal", dias: [], ate: null } })], new Date(2026, 0, 1), new Date(2026, 4, 1));
    expect(o.map((x) => x.dia)).toEqual(["2026-01-31", "2026-03-31"]);
  });

  it("não aparece antes de começar", () => {
    const o = expandir([ev({ repeticao: { frequencia: "diaria", dias: [], ate: null } })], new Date(2026, 8, 25), new Date(2026, 9, 3));
    expect(o[0].dia).toBe("2026-10-01");
  });

  it("dia inteiro vem antes dos horários", () => {
    const o = expandir([ev({ id: "a" }), ev({ id: "b", diaInteiro: true, inicio: new Date(2026, 9, 1).getTime(), fim: null })], ...outubro);
    expect(o.map((x) => x.evento.id)).toEqual(["b", "a"]);
  });
});

describe("calendário", () => {
  it("semana começa na segunda", () => {
    expect(chaveDia(inicioDaSemana(new Date(2026, 9, 25)))).toBe("2026-10-19");
  });

  it("grade do mês tem semanas completas", () => {
    const dias = diasDaGradeDoMes(new Date(2026, 9, 10));
    expect(dias.length % 7).toBe(0);
    expect(chaveDia(dias[0])).toBe("2026-09-28");
    expect(chaveDia(dias[dias.length - 1])).toBe("2026-11-01");
  });
});
