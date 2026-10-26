import { describe, expect, it } from "vitest";
import type { Remedio, RegistroSaude } from "../api";
import { montarResumo } from "./resumo";

const rem = (over: Partial<Remedio>): Remedio => ({
  id: "r", nome: "Remédio", dose: "1 comprimido", horarios: ["08:00"], estoque: null, porDose: 1, receita: null, estado: "ativo", criadoEm: 0, ...over,
});
const reg = (over: Partial<RegistroSaude>): RegistroSaude => ({ id: "x", tipo: "sono", momento: 0, intensidade: null, nota: "", ...over });

// Formatador fixo para o teste não depender de fuso nem de locale.
const fmt = (ms: number) => `m${ms}`;

describe("resumo para a consulta", () => {
  it("lista os remédios ativos e ignora os pausados", () => {
    const texto = montarResumo({
      remedios: [rem({ nome: "Sertralina", estoque: 10, receita: "2026-11-30" }), rem({ nome: "Pausado", estado: "pausado" })],
      registros: [],
      periodoDias: 30,
      ate: "2026-10-26",
      formatarMomento: fmt,
    });
    expect(texto).toContain("**Sertralina** — 1 comprimido, às 08:00. Estoque: 10. Receita até 2026-11-30.");
    expect(texto).not.toContain("Pausado");
    expect(texto).toContain("Nenhum registro no período.");
  });

  it("conta os registros por tipo e tira a média da intensidade", () => {
    const texto = montarResumo({
      remedios: [],
      registros: [
        reg({ id: "a", tipo: "sono", intensidade: 2, momento: 100 }),
        reg({ id: "b", tipo: "sono", intensidade: 4, momento: 200 }),
        reg({ id: "c", tipo: "sobrecarga", intensidade: null, nota: "barulho", momento: 300 }),
      ],
      periodoDias: 7,
      ate: "2026-10-26",
      formatarMomento: fmt,
    });
    expect(texto).toContain("Nenhum remédio em uso.");
    expect(texto).toContain("**Sono**: 2 registros (média 3,0 de 5).");
    expect(texto).toContain("**Sobrecarga sensorial**: 1 registro.");
    // Registros do mais novo para o mais antigo.
    expect(texto.indexOf("m300")).toBeLessThan(texto.indexOf("m200"));
    expect(texto).toContain("m300 — Sobrecarga sensorial: barulho");
  });
});
