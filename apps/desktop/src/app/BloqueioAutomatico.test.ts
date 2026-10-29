import { describe, expect, it } from "vitest";
import { passouDoTempo } from "./BloqueioAutomatico";

describe("bloqueio automático", () => {
  const min = 60_000;
  it("nunca bloqueia com 0", () => {
    expect(passouDoTempo(10 * 24 * 60 * min, 0, 0)).toBe(false);
  });
  it("bloqueia só quando o tempo completa", () => {
    expect(passouDoTempo(14 * min, 0, 15)).toBe(false);
    expect(passouDoTempo(15 * min, 0, 15)).toBe(true);
  });
  it("funciona com tempos longos, sem depender de timer (7 dias)", () => {
    const seteDias = 10080;
    expect(passouDoTempo(6 * 24 * 60 * min, 0, seteDias)).toBe(false);
    expect(passouDoTempo(7 * 24 * 60 * min, 0, seteDias)).toBe(true);
    // 50 dias passados em segundo plano: bloqueia ao voltar.
    expect(passouDoTempo(50 * 24 * 60 * min, 0, seteDias)).toBe(true);
  });
});
