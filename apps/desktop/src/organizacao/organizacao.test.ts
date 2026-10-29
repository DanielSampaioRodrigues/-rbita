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
    const c1 = await api.salvarCartaoOrg({ id: "", colunaId: cols[0].id, texto: " comprar tinta ", feito: false, cor: "", prazo: "", ordem: 0, criadoEm: 0 });
    expect(c1.texto).toBe("comprar tinta");
    await api.salvarCartaoOrg({ id: "", colunaId: cols[1].id, texto: "pintar", feito: false, cor: "", prazo: "", ordem: 0, criadoEm: 0 });
    await expect(api.salvarCartaoOrg({ id: "", colunaId: cols[0].id, texto: "  ", feito: false, cor: "", prazo: "", ordem: 0, criadoEm: 0 })).rejects.toThrow();
    expect(await api.listarCartoesOrg(q.id)).toHaveLength(2);

    await api.moverCartaoOrg(c1.id, cols[2].id, 1);
    await api.marcarCartaoOrg(c1.id, true);
    const movido = (await api.listarCartoesOrg(q.id)).find((c) => c.id === c1.id)!;
    expect([movido.colunaId, movido.feito]).toEqual([cols[2].id, true]);

    await api.excluirCartaoOrg(c1.id);
    expect(await api.listarCartoesOrg(q.id)).toHaveLength(1);
  });

  it("cartão guarda cor e prazo e reordena", async () => {
    const q = await api.salvarQuadro(quadro("Com cor", "quadro"));
    const col = (await api.listarColunas(q.id))[0];
    const a = await api.salvarCartaoOrg({ id: "", colunaId: col.id, texto: "a", feito: false, cor: "ceu", prazo: "2026-11-01", ordem: 0, criadoEm: 0 });
    const b = await api.salvarCartaoOrg({ id: "", colunaId: col.id, texto: "b", feito: false, cor: "", prazo: "", ordem: 0, criadoEm: 0 });
    const salvos = await api.listarCartoesOrg(q.id);
    const sa = salvos.find((c) => c.id === a.id)!;
    expect([sa.cor, sa.prazo]).toEqual(["ceu", "2026-11-01"]);
    expect(salvos.map((c) => c.id)).toEqual([a.id, b.id]);
    await api.reordenarCartoesOrg([b.id, a.id]);
    expect((await api.listarCartoesOrg(q.id)).map((c) => c.id)).toEqual([b.id, a.id]);
  });

  it("quadro e coluna guardam a cor (e quadros antigos ficam sem cor)", async () => {
    const q = await api.salvarQuadro({ ...quadro("Colorido", "quadro"), cor: "menta" });
    expect((await api.listarQuadros()).find((x) => x.id === q.id)?.cor).toBe("menta");
    await api.salvarQuadro({ ...q, cor: "ceu" });
    expect((await api.listarQuadros()).find((x) => x.id === q.id)?.cor).toBe("ceu");
    const antigo = await api.salvarQuadro(quadro("Antigo", "lista"));
    expect(antigo.cor ?? "").toBe("");
    const col = (await api.listarColunas(q.id))[0];
    await api.salvarColuna({ ...col, cor: "rosa" });
    expect((await api.listarColunas(q.id))[0].cor).toBe("rosa");
  });

  it("apagar o quadro leva colunas e cartões", async () => {
    const q = await api.salvarQuadro(quadro("Some tudo", "quadro"));
    const cols = await api.listarColunas(q.id);
    await api.salvarCartaoOrg({ id: "", colunaId: cols[0].id, texto: "a", feito: false, cor: "", prazo: "", ordem: 0, criadoEm: 0 });
    await api.excluirQuadro(q.id);
    expect(await api.listarColunas(q.id)).toHaveLength(0);
    expect(await api.listarCartoesOrg(q.id)).toHaveLength(0);
  });
});
