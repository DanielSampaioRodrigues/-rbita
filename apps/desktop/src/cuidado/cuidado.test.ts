import { describe, expect, it } from "vitest";
import { api } from "../api";

describe("cuidado psicológico (simulação)", () => {
  it("pauta e perguntas são listas separadas; aberta vem antes da feita", async () => {
    const a = await api.criarNotaCuidado("pauta", " falar do sono ");
    await api.criarNotaCuidado("pauta", "contar da semana");
    await api.criarNotaCuidado("pergunta", "trocar a dose?");
    await expect(api.criarNotaCuidado("pauta", "   ")).rejects.toThrow();
    await expect(api.criarNotaCuidado("outro", "x")).rejects.toThrow();

    expect(a.texto).toBe("falar do sono");
    expect(await api.listarNotasCuidado("pauta")).toHaveLength(2);
    expect(await api.listarNotasCuidado("pergunta")).toHaveLength(1);

    await api.marcarNotaCuidado(a.id, true);
    const pautas = await api.listarNotasCuidado("pauta");
    expect(pautas[0].feita).toBe(false);
    expect(pautas[pautas.length - 1].feita).toBe(true);

    await api.excluirNotaCuidado(a.id);
    expect(await api.listarNotasCuidado("pauta")).toHaveLength(1);
  });

  it("registra o que ficou da sessão e recusa vazio", async () => {
    const agora = Date.now();
    await expect(api.registrarSessao("   ")).rejects.toThrow();
    const r = await api.registrarSessao("falamos sobre o trabalho");
    const ss = await api.listarSessoes(agora - 1000, agora + 60_000);
    expect(ss.some((s) => s.nota === "falamos sobre o trabalho")).toBe(true);
    await api.excluirSessao(r.id);
    expect(await api.listarSessoes(agora - 1000, agora + 60_000)).toHaveLength(0);
  });
});
