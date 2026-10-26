import { beforeEach, describe, expect, it } from "vitest";
import { api, type Remedio } from "../api";

// No ambiente de teste, `api` é a simulação em memória (sem Tauri). Serve para
// garantir que as regras de dose, estoque e avisos batem com o backend Rust.

const base = (over: Partial<Remedio> = {}): Remedio => ({
  id: "",
  nome: "Remédio",
  dose: "1 comprimido",
  horarios: [],
  estoque: null,
  porDose: 1,
  receita: null,
  estado: "ativo",
  criadoEm: 0,
  ...over,
});

async function limpar() {
  for (const r of await api.listarRemedios()) await api.excluirRemedio(r.id);
}

describe("saúde: medicação (simulação)", () => {
  beforeEach(limpar);

  it("normaliza horários ao salvar (sem repetidos, em ordem)", async () => {
    const r = await api.salvarRemedio(base({ nome: "Metil", horarios: ["20:00", "08:00", "08:00", " "] }));
    expect(r.id).not.toBe("");
    expect(r.horarios).toEqual(["08:00", "20:00"]);
  });

  it("recusa nome vazio", async () => {
    await expect(api.salvarRemedio(base({ nome: "   " }))).rejects.toThrow();
  });

  it("a dose baixa o estoque uma vez e o desfazer estorna", async () => {
    const r = await api.salvarRemedio(base({ nome: "Rivotril", horarios: ["08:00"], estoque: 2 }));
    await api.marcarDose(r.id, "08:00", "2026-10-26", true);
    await api.marcarDose(r.id, "08:00", "2026-10-26", true); // idempotente
    expect((await api.listarRemedios())[0].estoque).toBe(1);
    await api.marcarDose(r.id, "08:00", "2026-10-26", false);
    expect((await api.listarRemedios())[0].estoque).toBe(2);
  });

  it("as doses do dia marcam o que foi tomado e ignoram pausados", async () => {
    const r = await api.salvarRemedio(base({ nome: "Sertralina", horarios: ["08:00", "20:00"] }));
    await api.marcarDose(r.id, "08:00", "2026-10-26", true);
    const doses = await api.dosesDoDia("2026-10-26");
    expect(doses.map((d) => [d.horario, d.tomada])).toEqual([
      ["08:00", true],
      ["20:00", false],
    ]);
    await api.pausarRemedio(r.id, true);
    expect(await api.dosesDoDia("2026-10-26")).toHaveLength(0);
  });

  it("avisa de estoque baixo e receita vencendo", async () => {
    await api.salvarRemedio(base({ nome: "Pouco", horarios: ["08:00"], estoque: 3, receita: "2026-10-30" }));
    const a = await api.alertasSaude("2026-10-26");
    expect(a.find((x) => x.tipo === "estoque")?.quanto).toBe(3);
    expect(a.find((x) => x.tipo === "receita")?.quanto).toBe(4);
  });
});

describe("saúde: registros e plano de crise (simulação)", () => {
  it("registra sono/sintoma/sobrecarga, lista do mais novo e valida", async () => {
    const agora = Date.now();
    await api.registrarSaude("sono", 4, "dormi mal");
    await api.registrarSaude("sobrecarga", null, "barulho");
    await expect(api.registrarSaude("outro", null, "")).rejects.toThrow();
    await expect(api.registrarSaude("sono", 9, "")).rejects.toThrow();
    const rs = await api.listarRegistrosSaude(agora - 1000, agora + 60_000);
    expect(rs).toHaveLength(2);
    expect(rs.map((r) => r.tipo).sort()).toEqual(["sobrecarga", "sono"]);
    await api.excluirRegistroSaude(rs[0].id);
    expect(await api.listarRegistrosSaude(agora - 1000, agora + 60_000)).toHaveLength(1);
  });

  it("salva o plano de crise e carimba a data", async () => {
    expect((await api.planoDeCrise()).sinais).toBe("");
    const salvo = await api.salvarPlanoDeCrise({ sinais: "  mãos suando ", ajuda: "respirar", contatos: "mãe", atualizadoEm: 0 });
    expect(salvo.sinais).toBe("mãos suando");
    expect(salvo.atualizadoEm).toBeGreaterThan(0);
    expect((await api.planoDeCrise()).contatos).toBe("mãe");
  });
});
