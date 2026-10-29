import { describe, expect, it } from "vitest";
import { avancarRelogio, corpoDoDia, marcarCorpo, validarCorpo } from "./corpo";

const em = (dia: number, hora = 12) => new Date(2026, 9, dia, hora).getTime();

describe("como está o corpo", () => {
  it("conta o que foi marcado no dia, na ordem fixa", () => {
    let d = validarCorpo(null);
    d = marcarCorpo(d, "pausa", em(29, 10));
    d = marcarCorpo(d, "agua", em(29, 11));
    d = marcarCorpo(d, "agua", em(29, 15));
    d = marcarCorpo(d, "comida", em(28));
    expect(corpoDoDia(d, "2026-10-29")).toEqual([
      { coisa: "agua", vezes: 2 },
      { coisa: "pausa", vezes: 1 },
    ]);
  });

  it("valida dados estranhos", () => {
    expect(validarCorpo({ marcados: [{ coisa: "agua", momento: 1 }, { coisa: "cafe", momento: 2 }, { coisa: "pausa", momento: "x" }] })).toEqual({
      marcados: [{ coisa: "agua", momento: 1 }],
    });
  });

  it("o relógio não conta as horas em que o computador dormiu", () => {
    expect(avancarRelogio(0, 30_000)).toBe(30_000);
    expect(avancarRelogio(30_000, 5 * 3_600_000)).toBe(90_000);
    expect(avancarRelogio(10, -5)).toBe(10);
  });
});
