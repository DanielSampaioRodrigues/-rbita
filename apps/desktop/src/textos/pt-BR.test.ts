import { describe, expect, it } from "vitest";
import { textos } from "./pt-BR";

describe("textos da interface", () => {
  it("monta o texto da versão", () => {
    expect(textos.boasVindas.versao("0.1.0")).toBe("Versão 0.1.0");
  });

  it("não deixa frases vazias", () => {
    const frases = Object.values(textos.boasVindas).filter((v) => typeof v === "string");
    for (const frase of frases) expect(frase.trim().length).toBeGreaterThan(0);
  });
});
