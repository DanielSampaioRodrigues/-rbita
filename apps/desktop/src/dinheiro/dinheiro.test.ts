import { beforeEach, describe, expect, it } from "vitest";
import { api, type Conta, type Meta } from "../api";

async function limpar() {
  const agora = Date.now();
  for (const g of await api.listarGastos(0, agora + 1_000_000)) await api.excluirGasto(g.id);
  for (const c of await api.listarContas()) await api.excluirConta(c.id);
  for (const d of await api.listarDesejos()) await api.excluirDesejo(d.id);
  for (const m of await api.listarMetas()) await api.excluirMeta(m.id);
}

describe("dinheiro (simulação)", () => {
  beforeEach(limpar);

  it("registra gasto com grupo e marca de interesse, e recusa negativo", async () => {
    const agora = Date.now();
    await api.registrarGasto(1250, "g-mercado", "pão", false);
    await api.registrarGasto(9900, "g-jogos", "DLC", true);
    await expect(api.registrarGasto(-1, "x", "", false)).rejects.toThrow();
    const gs = await api.listarGastos(agora - 1000, agora + 60_000);
    expect(gs).toHaveLength(2);
    expect(gs.some((g) => g.interesse && g.grupoId === "g-jogos")).toBe(true);
  });

  it("grupos: cria, valida e exclui", async () => {
    const g = await api.salvarGrupoGasto({ id: "", nome: " Assinaturas ", cor: "", criadoEm: 0 });
    expect([g.nome, g.cor]).toEqual(["Assinaturas", "mar"]);
    await expect(api.salvarGrupoGasto({ id: "", nome: "  ", cor: "", criadoEm: 0 })).rejects.toThrow();
    expect(await api.listarGruposGasto()).toHaveLength(1);
    await api.excluirGrupoGasto(g.id);
    expect(await api.listarGruposGasto()).toHaveLength(0);
  });

  it("conta valida o dia de vencimento", async () => {
    const boa: Conta = { id: "", nome: "Luz", centavos: 12000, diaVencimento: 10, avisoDias: 3, grupoId: "", criadoEm: 0 };
    const c = await api.salvarConta(boa);
    expect(c.id).not.toBe("");
    await expect(api.salvarConta({ ...boa, id: "", diaVencimento: 40 })).rejects.toThrow();
    expect(await api.listarContas()).toHaveLength(1);
  });

  it("desejo nasce com prazo futuro e pode ser resolvido", async () => {
    const d = await api.criarDesejo("Fone", 30000, 48);
    expect(d.decidirEm).toBeGreaterThan(Date.now());
    expect(d.estado).toBe("esperando");
    await api.resolverDesejo(d.id);
    expect((await api.listarDesejos())[0].estado).toBe("resolvido");
    await expect(api.criarDesejo("   ", 0, 48)).rejects.toThrow();
  });

  it("meta guarda alvo e progresso", async () => {
    const m: Meta = { id: "", nome: "Viagem", alvoCentavos: 100000, guardadoCentavos: 25000, criadoEm: 0 };
    await api.salvarMeta(m);
    await expect(api.salvarMeta({ ...m, id: "", nome: "" })).rejects.toThrow();
    const ms = await api.listarMetas();
    expect(ms).toHaveLength(1);
    expect([ms[0].alvoCentavos, ms[0].guardadoCentavos]).toEqual([100000, 25000]);
  });
});
