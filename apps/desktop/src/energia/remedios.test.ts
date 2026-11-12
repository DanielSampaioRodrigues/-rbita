import { describe, expect, it } from "vitest";
import { basicosSemRemedio, ehBasicoDeRemedio, rotuloDaDose, todasTomadas } from "./remedios";

const dose = (nome: string, tomada = false, horario = "08:00", d = "") => ({ remedioId: nome, nome, dose: d, horario, tomada });

describe("remédios no modo baixa energia", () => {
  it("reconhece o básico de remédio, com ou sem acento", () => {
    expect(ehBasicoDeRemedio("Tomar o remédio")).toBe(true);
    expect(ehBasicoDeRemedio("REMEDIOS da noite")).toBe(true);
    expect(ehBasicoDeRemedio("Medicação")).toBe(true);
    expect(ehBasicoDeRemedio("Beber água")).toBe(false);
  });
  it("só esconde o básico genérico quando há dose hoje", () => {
    const bs = [{ texto: "Tomar o remédio", feito: false }, { texto: "Beber água", feito: false }];
    expect(basicosSemRemedio(bs, [])).toHaveLength(2);
    expect(basicosSemRemedio(bs, [dose("Sertralina")]).map((b) => b.texto)).toEqual(["Beber água"]);
  });
  it("monta o rótulo da dose", () => {
    expect(rotuloDaDose(dose("Sertralina", false, "08:00", "50 mg"))).toBe("Sertralina (50 mg) · 08:00");
    expect(rotuloDaDose(dose("Vitamina D", false, ""))).toBe("Vitamina D");
  });
  it("todas tomadas", () => {
    expect(todasTomadas([])).toBe(false);
    expect(todasTomadas([dose("A", true), dose("B", false)])).toBe(false);
    expect(todasTomadas([dose("A", true), dose("B", true)])).toBe(true);
  });
});
