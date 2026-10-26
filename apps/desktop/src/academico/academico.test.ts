import { beforeEach, describe, expect, it } from "vitest";
import { api, type Atividade, type Materia } from "../api";

const mat = (nome: string): Materia => ({ id: "", nome, professor: "", cor: "mar", criadoEm: 0 });
const ativ = (materiaId: string, over: Partial<Atividade> = {}): Atividade => ({
  id: "", materiaId, tipo: "prova", titulo: "Prova", data: "2026-11-10", peso: null, nota: null, feita: false, criadoEm: 0, ...over,
});

async function limpar() {
  for (const m of await api.listarMaterias()) await api.excluirMateria(m.id);
}

describe("vida acadêmica (simulação)", () => {
  beforeEach(limpar);

  it("cria matéria com cor padrão e recusa nome vazio", async () => {
    const m = await api.salvarMateria(mat("Matemática"));
    expect(m.id).not.toBe("");
    expect(m.cor).toBe("mar");
    await expect(api.salvarMateria(mat("  "))).rejects.toThrow();
  });

  it("valida tipo, matéria e faixa da nota na atividade", async () => {
    const m = await api.salvarMateria(mat("História"));
    await api.salvarAtividade(ativ(m.id, { peso: 2 }));
    await expect(api.salvarAtividade(ativ(m.id, { tipo: "outro" }))).rejects.toThrow();
    await expect(api.salvarAtividade(ativ("", {}))).rejects.toThrow();
    await expect(api.salvarAtividade(ativ(m.id, { nota: 120 }))).rejects.toThrow();
    expect(await api.listarAtividades()).toHaveLength(1);
  });

  it("apagar a matéria leva as atividades junto", async () => {
    const m = await api.salvarMateria(mat("Química"));
    await api.salvarAtividade(ativ(m.id, { tipo: "dever", titulo: "Lista" }));
    expect(await api.listarAtividades()).toHaveLength(1);
    await api.excluirMateria(m.id);
    expect(await api.listarMaterias()).toHaveLength(0);
    expect(await api.listarAtividades()).toHaveLength(0);
  });

  it("guarda a média de aprovação", async () => {
    expect(await api.mediaAprovacao()).toBe(6);
    await api.definirMediaAprovacao(7);
    expect(await api.mediaAprovacao()).toBe(7);
    await api.definirMediaAprovacao(6);
  });

  it("aulas da grade validam e somem com a matéria", async () => {
    const m = await api.salvarMateria(mat("Biologia"));
    const a = await api.salvarAula({ id: "", materiaId: m.id, diaSemana: 1, inicio: "08:00", fim: "09:40", criadoEm: 0 });
    expect(a.id).not.toBe("");
    await expect(api.salvarAula({ id: "", materiaId: m.id, diaSemana: 9, inicio: "08:00", fim: "", criadoEm: 0 })).rejects.toThrow();
    await expect(api.salvarAula({ id: "", materiaId: m.id, diaSemana: 1, inicio: "25:00", fim: "", criadoEm: 0 })).rejects.toThrow();
    await expect(api.salvarAula({ id: "", materiaId: "", diaSemana: 1, inicio: "08:00", fim: "", criadoEm: 0 })).rejects.toThrow();
    expect(await api.listarAulas()).toHaveLength(1);
    await api.excluirMateria(m.id);
    expect(await api.listarAulas()).toHaveLength(0);
  });
});
