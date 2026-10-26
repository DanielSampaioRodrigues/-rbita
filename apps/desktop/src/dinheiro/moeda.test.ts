import { describe, expect, it } from "vitest";
import { centavosParaReais, formatarMoeda, reaisParaCentavos } from "./moeda";

describe("dinheiro em centavos", () => {
  it("lê o que a pessoa digita", () => {
    expect(reaisParaCentavos("12,50")).toBe(1250);
    expect(reaisParaCentavos("12.50")).toBe(1250);
    expect(reaisParaCentavos("R$ 1.234,56")).toBe(123456);
    expect(reaisParaCentavos("8")).toBe(800);
    expect(reaisParaCentavos("0")).toBe(0);
  });

  it("recusa o que não é número ou é negativo", () => {
    expect(reaisParaCentavos("")).toBeNull();
    expect(reaisParaCentavos("abc")).toBeNull();
    expect(reaisParaCentavos("-5")).toBeNull();
  });

  it("formata de volta", () => {
    expect(centavosParaReais(1250)).toBe("12,50");
    expect(formatarMoeda(123456)).toBe("R$ 1.234,56");
    expect(formatarMoeda(0)).toBe("R$ 0,00");
  });
});
