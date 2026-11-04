import { describe, expect, it } from "vitest";
import { lerEspaco, nomeDoEspaco } from "./espacoLetras";

describe("espaço entre letras", () => {
  it("lê pt, px e em, com negativo e decimal, e põe limite", () => {
    expect(lerEspaco("1.5pt")).toBe(1.5);
    expect(lerEspaco("-0.5pt")).toBe(-0.5);
    expect(lerEspaco("2px")).toBe(1.5);
    expect(lerEspaco("normal")).toBe(0);
    expect(lerEspaco("99pt")).toBe(20);
    expect(lerEspaco("-9pt")).toBe(-5);
  });
  it("nomes como no Word", () => {
    expect(nomeDoEspaco(0)).toBe("Normal");
    expect(nomeDoEspaco(1.5)).toBe("Expandido 1,5 pt");
    expect(nomeDoEspaco(-1)).toBe("Condensado 1 pt");
  });
});
