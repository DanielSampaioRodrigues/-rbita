import { describe, expect, it } from "vitest";
import { emFila } from "./fila";

describe("fila", () => {
  it("roda uma de cada vez, na ordem, mesmo com erro no meio", async () => {
    const ordem: string[] = [];
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await Promise.allSettled([
      emFila("x", async () => { await espera(20); ordem.push("a"); }),
      emFila("x", async () => { ordem.push("b"); throw new Error("falhou"); }),
      emFila("x", async () => { ordem.push("c"); }),
    ]);
    expect(ordem).toEqual(["a", "b", "c"]);
  });
});
