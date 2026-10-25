import { describe, expect, it } from "vitest";
import { avaliarPin, avaliarSenha } from "./validacao";

describe("validação de senha e PIN", () => {
  it("pede 12 caracteres e confirmação igual", () => {
    expect(avaliarSenha("curta", "curta").ok).toBe(false);
    expect(avaliarSenha("curta", "").dica).toBe("Faltam 7 caracteres.");
    expect(avaliarSenha("gato azul na janela", "gato azul na janela").ok).toBe(true);
    expect(avaliarSenha("gato azul na janela", "gato azul").erro).toBe("As duas senhas estão diferentes.");
  });

  it("aceita PIN de 4 a 8 números", () => {
    expect(avaliarPin("2468", "2468").ok).toBe(true);
    expect(avaliarPin("123", "123").ok).toBe(false);
    expect(avaliarPin("123456789", "123456789").ok).toBe(false);
    expect(avaliarPin("12a4", "").erro).toBe("Use só números, de 4 a 8.");
  });
});
