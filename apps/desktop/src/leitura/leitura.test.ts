import { beforeEach, describe, expect, it } from "vitest";
import { api, type Livro } from "../api";

const livro = (titulo: string, status = "quero"): Livro => ({
  id: "", titulo, autor: "Autor", status, ondeParei: "", impressoes: "", inicio: "", fim: "", formato: "", arquivoId: "", grupoId: "", cor: "mar", criadoEm: 0,
});

async function limpar() {
  for (const l of await api.listarLivros()) await api.excluirLivro(l.id);
}

describe("leitura: estante (simulação)", () => {
  beforeEach(limpar);

  it("ordena por status (lendo primeiro, lido por último) e recusa título vazio", async () => {
    await api.salvarLivro(livro("Lido", "lido"));
    await api.salvarLivro(livro("Lendo", "lendo"));
    await api.salvarLivro(livro("Quero", "quero"));
    await expect(api.salvarLivro(livro("  "))).rejects.toThrow();
    const ls = await api.listarLivros();
    expect(ls[0].status).toBe("lendo");
    expect(ls[ls.length - 1].status).toBe("lido");
  });

  it("status inválido vira 'quero' e mudarStatus valida", async () => {
    const l = await api.salvarLivro(livro("X", "inventado"));
    expect(l.status).toBe("quero");
    await api.mudarStatusLivro(l.id, "pausado");
    expect((await api.listarLivros())[0].status).toBe("pausado");
    await expect(api.mudarStatusLivro(l.id, "xpto")).rejects.toThrow();
  });

  it("guarda o diário (onde parei, impressões, datas)", async () => {
    const l = await api.salvarLivro({ ...livro("Diário", "lendo"), ondeParei: "cap. 3", impressoes: "bom", inicio: "2026-10-01" });
    await api.salvarLivro({ ...l, ondeParei: "cap. 5" });
    const lido = (await api.listarLivros())[0];
    expect(lido.ondeParei).toBe("cap. 5");
    expect(lido.impressoes).toBe("bom");
    expect(lido.inicio).toBe("2026-10-01");
  });

  it("guarda prateleira e cor do livro", async () => {
    const g = await api.salvarGrupoLivro({ id: "", nome: "Faculdade", criadoEm: 0 });
    const l = await api.salvarLivro({ ...livro("Fenomenologia", "quero"), grupoId: g.id, cor: "lavanda" });
    const lido = (await api.listarLivros()).find((x) => x.id === l.id)!;
    expect(lido.grupoId).toBe(g.id);
    expect(lido.cor).toBe("lavanda");
    for (const x of await api.listarGruposLivro()) await api.excluirGrupoLivro(x.id);
  });
});

describe("leitura: prateleiras (simulação)", () => {
  beforeEach(async () => {
    for (const g of await api.listarGruposLivro()) await api.excluirGrupoLivro(g.id);
  });

  it("cria, renomeia, apaga e recusa nome vazio", async () => {
    const g = await api.salvarGrupoLivro({ id: "", nome: "Lazer", criadoEm: 0 });
    expect((await api.listarGruposLivro()).length).toBe(1);
    await expect(api.salvarGrupoLivro({ id: "", nome: "  ", criadoEm: 0 })).rejects.toThrow();
    await api.salvarGrupoLivro({ ...g, nome: "Lazer e hobbies" });
    expect((await api.listarGruposLivro())[0].nome).toBe("Lazer e hobbies");
    await api.excluirGrupoLivro(g.id);
    expect((await api.listarGruposLivro()).length).toBe(0);
  });
});
