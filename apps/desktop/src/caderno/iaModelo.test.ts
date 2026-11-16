import { describe, expect, it } from "vitest";
import type { EstadoIa } from "../api";
import { iaDoCaderno, nomeCurtoModelo } from "./iaModelo";

const p = (id: string, modelo: string) => ({ id, tipo: "claude" as const, nome: id, url: "https://x", modelo, finalChave: null, local: false });

describe("IA do caderno", () => {
  it("sem escolha própria, usa a da conversa", () => {
    const e: EstadoIa = { provedores: [p("a", "m-a"), p("b", "m-b")], funcoes: { conversa: "b" }, modelos: { conversa: "m-x" }, bloquearSensivel: false };
    expect(iaDoCaderno(e)).toMatchObject({ provedor: { id: "b" }, modelo: "m-x", propria: false });
  });
  it("com escolha própria, usa a dela", () => {
    const e: EstadoIa = { provedores: [p("a", "m-a"), p("b", "m-b")], funcoes: { conversa: "b", caderno: "a" }, modelos: {}, bloquearSensivel: false };
    expect(iaDoCaderno(e)).toMatchObject({ provedor: { id: "a" }, modelo: "m-a", propria: true });
  });
  it("nome curto", () => {
    expect(nomeCurtoModelo("claude-sonnet-5-5")).toBe("sonnet 5.5");
    expect(nomeCurtoModelo("gemini-2.5-flash")).toBe("2.5 flash");
  });
});
