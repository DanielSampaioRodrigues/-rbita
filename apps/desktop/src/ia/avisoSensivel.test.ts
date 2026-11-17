import { describe, expect, it } from "vitest";
import { marcarAvisado, precisaAvisar } from "./avisoSensivel";

describe("aviso de dados sensíveis", () => {
  const fora = { id: "claude-1", local: false };
  it("sem o bloqueio, não para nunca (decisão de Dan, 17/11/2026)", async () => {
    expect(await precisaAvisar(true, fora, false)).toBe(false);
    await marcarAvisado(fora.id);
    expect(await precisaAvisar(true, { id: "gpt-1", local: false }, false)).toBe(false);
  });
  it("texto comum e IA local não pedem aviso", async () => {
    expect(await precisaAvisar(false, { id: "x", local: false }, false)).toBe(false);
    expect(await precisaAvisar(true, { id: "ollama", local: true }, false)).toBe(false);
  });
  it("com o bloqueio ligado, para sempre (é a escolha da pessoa)", async () => {
    expect(await precisaAvisar(true, fora, true)).toBe(true);
  });
});
