import { describe, expect, it } from "vitest";
import { limparLista, MAXIMO } from "./minhaLetra";

describe("minha letra", () => {
  it("separa por linha ou vírgula, tira repetidas e vazias", () => {
    expect(limparLista(["Vygotsky\nTDAH, neurodivergente", " vygotsky ", ""])).toEqual(["Vygotsky", "TDAH", "neurodivergente"]);
  });
  it("guarda as mais recentes até o máximo", () => {
    const muitas = Array.from({ length: MAXIMO + 5 }, (_, i) => `p${i}`);
    const r = limparLista(muitas);
    expect(r).toHaveLength(MAXIMO);
    expect(r[r.length - 1]).toBe(`p${MAXIMO + 4}`);
  });
});
