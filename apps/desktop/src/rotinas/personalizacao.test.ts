import { describe, expect, it } from "vitest";
import { contraste } from "@orbita/temas";
import { PALETA, limparEmoji, resumoDeDias, textoSobre, valeNoDia } from "./personalizacao";

describe("personalização de rotinas", () => {
  it("o texto sobre cada cor da paleta passa no contraste AA", () => {
    for (const c of PALETA) expect(contraste(c.hex, textoSobre(c.hex))).toBeGreaterThanOrEqual(4.5);
  });
  it("resume os dias em linguagem simples", () => {
    expect(resumoDeDias([])).toBe("Todos os dias");
    expect(resumoDeDias([1, 2, 3, 4, 5])).toBe("Dias úteis");
    expect(resumoDeDias([0, 6])).toBe("Fins de semana");
    expect(resumoDeDias([1, 3, 5])).toBe("Seg, qua e sex");
  });
  it("sem dias escolhidos vale todo dia", () => {
    expect(valeNoDia([], 3)).toBe(true);
    expect(valeNoDia([1], 3)).toBe(false);
  });
  it("guarda só um emoji", () => {
    expect(limparEmoji("  🌞abc")).toBe("🌞");
    expect(limparEmoji("")).toBe("");
  });
});
