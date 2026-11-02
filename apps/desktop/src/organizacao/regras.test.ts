import { describe, expect, it } from "vitest";
import type { CartaoOrg, Quadro } from "../api";
import { completarCartao, encaixarNaOrdem, filtroVazio, partesDoFiltro, passaNoFiltro, progresso, situacaoPrazo, textoPrazo, vistaDe } from "./regras";

const agora = new Date(2026, 10, 2, 10, 0); // 2 nov 2026, 10h
const cartao = (extra: Partial<CartaoOrg> = {}): CartaoOrg => ({ id: "c", colunaId: "col", texto: "Relatório", feito: false, cor: "", prazo: "", ordem: 1, criadoEm: 0, ...extra });

describe("organização: regras", () => {
  it("vista: quadros antigos de lista abrem em lista; novos em quadro", () => {
    const q: Quadro = { id: "q", nome: "x", estilo: "lista", criadoEm: 0 };
    expect(vistaDe(q)).toBe("lista");
    expect(vistaDe({ ...q, estilo: "quadro" })).toBe("quadro");
    expect(vistaDe({ ...q, vista: "quadro" })).toBe("quadro");
  });

  it("completa cartões antigos sem os campos novos", () => {
    const c = completarCartao(cartao());
    expect([c.descricao, c.checklists, c.etiquetas, c.arquivado, c.capa.tipo, c.anexos]).toEqual(["", [], [], false, "", 0]);
  });

  it("situação do prazo: suave, sem alarme", () => {
    expect(situacaoPrazo("", "", false, agora)).toBe("");
    expect(situacaoPrazo("2026-11-01", "", false, agora)).toBe("atrasado");
    expect(situacaoPrazo("2026-11-01", "", true, agora)).toBe("feito");
    expect(situacaoPrazo("2026-11-02", "", false, agora)).toBe("hoje");
    expect(situacaoPrazo("2026-11-02", "09:30", false, agora)).toBe("atrasado");
    expect(situacaoPrazo("2026-11-02", "18:00", false, agora)).toBe("hoje");
    expect(situacaoPrazo("2026-11-04", "", false, agora)).toBe("perto");
    expect(situacaoPrazo("2026-11-10", "", false, agora)).toBe("normal");
    expect(textoPrazo("2026-11-05", "14:30", agora)).toBe("5 nov, 14:30");
    expect(textoPrazo("2027-01-05", "", agora)).toBe("5 jan 2027");
  });

  it("progresso das checklists soma todas", () => {
    const c = cartao({ checklists: [
      { id: "a", nome: "A", itens: [{ id: "1", texto: "um", feito: true }, { id: "2", texto: "dois", feito: false }] },
      { id: "b", nome: "B", itens: [{ id: "3", texto: "três", feito: true }] },
    ] });
    expect(progresso(c)).toEqual({ feitos: 2, total: 3 });
  });

  it("filtro: texto sem acento, etiqueta, 7 dias e sem os feitos", () => {
    const f = filtroVazio();
    expect(partesDoFiltro(f)).toBe(0);
    expect(passaNoFiltro(cartao(), { ...f, texto: "relatorio" }, agora)).toBe(true);
    expect(passaNoFiltro(cartao({ descricao: "ligar para a **Ana**" }), { ...f, texto: "ana" }, agora)).toBe(true);
    expect(passaNoFiltro(cartao(), { ...f, texto: "pão" }, agora)).toBe(false);
    expect(passaNoFiltro(cartao({ etiquetas: ["e1"] }), { ...f, etiquetas: ["e1", "e2"] }, agora)).toBe(true);
    expect(passaNoFiltro(cartao(), { ...f, etiquetas: ["e1"] }, agora)).toBe(false);
    expect(passaNoFiltro(cartao({ prazo: "2026-11-08" }), { ...f, semana: true }, agora)).toBe(true);
    expect(passaNoFiltro(cartao({ prazo: "2026-10-20" }), { ...f, semana: true }, agora)).toBe(true);
    expect(passaNoFiltro(cartao({ prazo: "2026-11-20" }), { ...f, semana: true }, agora)).toBe(false);
    expect(passaNoFiltro(cartao(), { ...f, semana: true }, agora)).toBe(false);
    expect(passaNoFiltro(cartao({ feito: true }), { ...f, semFeitos: true }, agora)).toBe(false);
    expect(partesDoFiltro({ ...f, texto: "x", semFeitos: true })).toBe(2);
  });

  it("ordem: mover entre visíveis não tira os escondidos do lugar", () => {
    // a, [h1 escondido], b, c  → arrastar c para o topo dos visíveis
    expect(encaixarNaOrdem(["a", "h1", "b", "c"], ["c", "a", "b"], "c")).toEqual(["c", "a", "h1", "b"]);
    // arrastar a para depois de b
    expect(encaixarNaOrdem(["a", "h1", "b", "c"], ["b", "a", "c"], "a")).toEqual(["h1", "b", "a", "c"]);
    // vindo de outra coluna, entra depois do vizinho de cima
    expect(encaixarNaOrdem(["a", "h1", "b"], ["a", "novo", "b"], "novo")).toEqual(["a", "novo", "h1", "b"]);
    // coluna só com escondidos: vai para o fim
    expect(encaixarNaOrdem(["h1", "h2"], ["novo"], "novo")).toEqual(["h1", "h2", "novo"]);
    // sem filtro, é a própria ordem nova
    expect(encaixarNaOrdem(["a", "b", "c"], ["b", "c", "a"], "a")).toEqual(["b", "c", "a"]);
  });
});
