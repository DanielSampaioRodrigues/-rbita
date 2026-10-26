import { describe, expect, it } from "vitest";
import { api, type Quadro } from "../api";

const quadro = (nome: string, estilo: Quadro["estilo"]): Quadro => ({ id: "", nome, estilo, criadoEm: 0 });

describe("organização: quadros e listas (simulação)", () => {
  it("lista nasce com uma coluna; quadro com três", async () => {
    const lista = await api.salvarQuadro(quadro(" Hoje ", "lista"));
    expect(lista.nome).toBe("Hoje");
    expect(await api.listarColunas(lista.id)).toHaveLength(1);
    const q = await api.salvarQuadro(quadro("Projeto", "quadro"));
    const cols = await api.listarColunas(q.id);
    expect(cols.map((c) => c.nome)).toEqual(["A fazer", "Fazendo", "Feito"]);
    await expect(api.salvarQuadro(quadro("  ", "lista"))).rejects.toThrow();
  });

  it("cartões: cria, move entre colunas, marca e apaga", async () => {
    const q = await api.salvarQuadro(quadro("Projeto 2", "quadro"));
    const cols = await api.listarColunas(q.id);
    const c1 = await api.salvarCartaoOrg({ id: "", colunaId: cols[0].id, texto: " comprar tinta ", feito: false, ordem: 0, criadoEm: 0 });
    expect(c1.texto).toBe("comprar tinta");
    await api.salvarCartaoOrg({ id: "", colunaId: cols[1].id, texto: "pintar", feito: false, ordem: 0, criadoEm: 0 });
    await expect(api.salvarCartaoOrg({ id: "", colunaId: cols[0].id, texto: "  ", feito: false, ordem: 0, criadoEm: 0 })).rejects.toThrow();
    expect(await api.listarCartoesOrg(q.id)).toHaveLength(2);

    await api.moverCartaoOrg(c1.id, cols[2].id, 1);
    await api.marcarCartaoOrg(c1.id, true);
    const movido = (await api.listarCartoesOrg(q.id)).find((c) => c.id === c1.id)!;
    expect([movido.colunaId, movido.feito]).toEqual([cols[2].id, true]);

    await api.excluirCartaoOrg(c1.id);
    expect(await api.listarCartoesOrg(q.id)).toHaveLength(1);
  });

  it("apagar o quadro leva colunas e cartões", async () => {
    const q = await api.salvarQuadro(quadro("Some tudo", "quadro"));
    const cols = await api.listarColunas(q.id);
    await api.salvarCartaoOrg({ id: "", colunaId: cols[0].id, texto: "a", feito: false, ordem: 0, criadoEm: 0 });
    await api.excluirQuadro(q.id);
    expect(await api.listarColunas(q.id)).toHaveLength(0);
    expect(await api.listarCartoesOrg(q.id)).toHaveLength(0);
  });
});
