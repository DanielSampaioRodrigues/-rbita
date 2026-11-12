import { describe, expect, it } from "vitest";
import type { CartaoOrg } from "../api";
import { eventoDoCartao } from "./agenda";

const cartao = (p: Partial<CartaoOrg>): CartaoOrg => ({ id: "c", colunaId: "x", texto: "Entregar relatório", feito: false, cor: "", prazo: "2026-11-20", ordem: 1, criadoEm: 0, ...p });

describe("cartão na Agenda", () => {
  it("sem hora: dia inteiro", () => {
    const e = eventoDoCartao(cartao({}), "Trabalho");
    expect(e).toMatchObject({ titulo: "Entregar relatório", diaInteiro: true, fim: null });
    expect(new Date(e!.inicio).getDate()).toBe(20);
    expect(e!.notas).toContain("Trabalho");
  });
  it("com hora: meia hora naquele horário", () => {
    const e = eventoDoCartao(cartao({ hora: "14:30" }), "");
    expect(e!.diaInteiro).toBe(false);
    expect(new Date(e!.inicio).getHours()).toBe(14);
    expect(new Date(e!.inicio).getMinutes()).toBe(30);
    expect(e!.fim! - e!.inicio).toBe(30 * 60_000);
  });
  it("feito, arquivado, sem data ou sem título: nada", () => {
    expect(eventoDoCartao(cartao({ feito: true }), "")).toBeNull();
    expect(eventoDoCartao(cartao({ arquivado: true }), "")).toBeNull();
    expect(eventoDoCartao(cartao({ prazo: "" }), "")).toBeNull();
    expect(eventoDoCartao(cartao({ texto: "  " }), "")).toBeNull();
  });
});
