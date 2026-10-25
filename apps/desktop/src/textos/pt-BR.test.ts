import { describe, expect, it } from "vitest";
import { textos } from "./pt-BR";

function frases(objeto: unknown): string[] {
  if (typeof objeto === "string") return [objeto];
  if (Array.isArray(objeto)) return objeto.flatMap(frases);
  if (typeof objeto === "object" && objeto !== null) return Object.values(objeto).flatMap(frases);
  return [];
}

describe("textos da interface", () => {
  it("monta o texto da versão", () => {
    expect(textos.app.versao("0.2.0")).toBe("Versão 0.2.0");
  });

  it("não deixa frases vazias", () => {
    for (const frase of frases(textos)) expect(frase.trim().length).toBeGreaterThan(0);
  });

  it("tem um nome para cada tamanho de letra", () => {
    expect(textos.ajustes.tamanhos).toHaveLength(5);
  });
});
