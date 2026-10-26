import { describe, expect, it } from "vitest";
import { api, type Profissional } from "../api";

const prof = (nome: string): Profissional => ({ id: "", nome, especialidade: "psiquiatra", sobre: "", proximaConsulta: "", criadoEm: 0 });

describe("cuidado — profissionais (simulação)", () => {
  it("profissional guarda os campos e recusa nome vazio", async () => {
    const p = await api.salvarProfissional({ ...prof(" Dra. Ana "), sobre: " atende online ", proximaConsulta: "2026-11-10" });
    expect([p.nome, p.especialidade, p.sobre, p.proximaConsulta]).toEqual(["Dra. Ana", "psiquiatra", "atende online", "2026-11-10"]);
    await expect(api.salvarProfissional(prof("  "))).rejects.toThrow();
  });

  it("pautas, perguntas e sessões ficam por profissional, com cascata ao apagar", async () => {
    for (const p of await api.listarProfissionais()) await api.excluirProfissional(p.id);
    const a = await api.salvarProfissional(prof("Dra. Ana"));
    const b = await api.salvarProfissional(prof("Dr. Beto"));

    const n = await api.criarNotaCuidado(a.id, "pauta", " falar do sono ");
    await api.criarNotaCuidado(a.id, "pergunta", "trocar a dose?");
    await api.criarNotaCuidado(b.id, "pauta", "ansiedade");
    await expect(api.criarNotaCuidado("", "pauta", "x")).rejects.toThrow();
    await expect(api.criarNotaCuidado(a.id, "outro", "x")).rejects.toThrow();
    expect(n.texto).toBe("falar do sono");
    expect(await api.listarNotasCuidado(a.id, "pauta")).toHaveLength(1);
    expect(await api.listarNotasCuidado(b.id, "pauta")).toHaveLength(1);

    await api.registrarSessao(a.id, "2026-10-20", "falamos do trabalho");
    await expect(api.registrarSessao(a.id, "2026-10-21", "  ")).rejects.toThrow();
    expect(await api.listarSessoes(a.id)).toHaveLength(1);
    expect(await api.listarSessoes(b.id)).toHaveLength(0);

    await api.excluirProfissional(a.id);
    expect(await api.listarNotasCuidado(a.id, "pauta")).toHaveLength(0);
    expect(await api.listarSessoes(a.id)).toHaveLength(0);
    expect(await api.listarProfissionais()).toHaveLength(1);
  });
});
