import { describe, expect, it } from "vitest";
import { paginaDoTopo } from "./sumario";

describe("sumário", () => {
  it("a página de cada título pelas marcas de fim de página", () => {
    const fins = [1000, 2200, 3400];
    expect(paginaDoTopo(100, fins)).toBe(1);
    expect(paginaDoTopo(1500, fins)).toBe(2);
    expect(paginaDoTopo(3000, fins)).toBe(3);
    expect(paginaDoTopo(100, [])).toBe(0);
  });
});
