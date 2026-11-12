import { describe, expect, it } from "vitest";
import { crescerAte, ehInfinito, INFINITO_INICIAL, medidaInfinito, tamanhoInfinito } from "./infinito";

describe("quadro infinito", () => {
  it("lê o tamanho guardado", () => {
    expect(ehInfinito("infinito")).toBe(true);
    expect(ehInfinito("infinito:6000x3600")).toBe(true);
    expect(ehInfinito("a4")).toBe(false);
    expect(medidaInfinito("infinito")).toEqual(INFINITO_INICIAL);
    expect(medidaInfinito("infinito:6000x4800")).toEqual({ largura: 6000, altura: 4800 });
    expect(medidaInfinito("infinito:100x100")).toEqual(INFINITO_INICIAL);
    expect(tamanhoInfinito(6000.4, 4800)).toBe("infinito:6000x4800");
  });
  it("cresce só quando chega perto da borda, com folga", () => {
    expect(crescerAte(null, INFINITO_INICIAL)).toBeNull();
    expect(crescerAte({ x: 2500, y: 1800 }, INFINITO_INICIAL)).toBeNull();
    const r = crescerAte({ x: 4300, y: 1800 }, INFINITO_INICIAL)!;
    expect(r.altura).toBe(3600);
    expect(r.largura).toBeGreaterThanOrEqual(4300 + 700 + 1200);
    const b = crescerAte({ x: 100, y: 3500 }, INFINITO_INICIAL)!;
    expect(b.largura).toBe(4800);
    expect(b.altura).toBeGreaterThan(3500 + 700);
  });
});
