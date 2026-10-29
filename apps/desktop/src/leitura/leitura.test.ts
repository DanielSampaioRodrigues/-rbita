import { beforeEach, describe, expect, it } from "vitest";
import { api, type Anotacao, type Livro } from "../api";
import { corDaCapa, corDoTitulo, hashTexto, padraoDoTitulo, tamanhoDoTitulo } from "./capa";
import { livroParaContinuar, moverNaOrdem, ordenarPrateleiras } from "./estanteLocal";

const anotacao = (livroId: string, tipo: Anotacao["tipo"]): Anotacao => ({
  id: "", livroId, tipo, epubCfi: "", epubCfiRange: "", pdfPagina: 0, cor: "", texto: "", trecho: "", pontos: [], espessura: 0, criadoEm: 0,
});

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

describe("leitura: anotações (simulação)", () => {
  it("guarda marcador, grifo e traço por livro, e apaga", async () => {
    const atual = await api.listarAnotacoes("livro-1");
    for (const a of atual) await api.excluirAnotacao(a.id);

    await api.salvarAnotacao({ ...anotacao("livro-1", "marcador"), epubCfi: "epubcfi(/6/2)" });
    const g = await api.salvarAnotacao({ ...anotacao("livro-1", "grifo"), epubCfiRange: "epubcfi(/6/2,/1:0,/1:9)", cor: "lavanda", trecho: " bom trecho " });
    await api.salvarAnotacao({ ...anotacao("livro-2", "nota"), pdfPagina: 4, texto: "lembrar" });

    const l1 = await api.listarAnotacoes("livro-1");
    expect(l1.length).toBe(2);
    expect(l1.find((a) => a.tipo === "grifo")!.trecho).toBe("bom trecho");
    expect((await api.listarAnotacoes("livro-2")).length).toBe(1);

    await expect(api.salvarAnotacao({ ...anotacao("", "marcador") })).rejects.toThrow();

    await api.excluirAnotacao(g.id);
    expect((await api.listarAnotacoes("livro-1")).length).toBe(1);
  });
});

describe("leitura: capa gerada", () => {
  it("é estável: o mesmo título dá a mesma cor e o mesmo desenho", () => {
    expect(hashTexto("Dom Casmurro")).toBe(hashTexto("  dom casmurro "));
    expect(corDoTitulo("Dom Casmurro")).toBe(corDoTitulo("Dom Casmurro"));
    expect(padraoDoTitulo("Dom Casmurro")).toBe(padraoDoTitulo("Dom Casmurro"));
  });

  it("varia entre títulos e nunca sorteia cinza", () => {
    const titulos = ["A", "B", "Dom Casmurro", "Torto Arado", "Grande Sertão", "Fenomenologia", "Duna", "Quarto de Despejo", "Ensaio sobre a cegueira", "O cortiço"];
    const cores = new Set(titulos.map(corDoTitulo));
    expect(cores.size).toBeGreaterThan(2);
    expect(cores.has("cinza")).toBe(false);
  });

  it("usa a cor escolhida quando válida e a automática quando vazia", () => {
    expect(corDaCapa("lavanda", "X")).toBe("lavanda");
    expect(corDaCapa("", "X")).toBe(corDoTitulo("X"));
    expect(corDaCapa("inventada", "X")).toBe(corDoTitulo("X"));
  });

  it("diminui a letra de títulos longos", () => {
    expect(tamanhoDoTitulo("Duna")).toBe("grande");
    expect(tamanhoDoTitulo("Ensaio sobre a cegueira")).toBe("medio");
    expect(tamanhoDoTitulo("Memórias póstumas de Brás Cubas e outras histórias longas")).toBe("pequeno");
  });
});

describe("leitura: organização da estante", () => {
  const g = (id: string, nome: string, criadoEm: number) => ({ id, nome, criadoEm });

  it("ordena prateleiras pela ordem escolhida; novas vão para o fim", () => {
    const gs = [g("a", "Lazer", 1), g("b", "Faculdade", 2), g("c", "Quadrinhos", 3)];
    expect(ordenarPrateleiras(gs, ["c", "a"]).map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(ordenarPrateleiras(gs, []).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("move prateleira para cima e para baixo sem passar das pontas", () => {
    expect(moverNaOrdem(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moverNaOrdem(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    const ids = ["a", "b"];
    expect(moverNaOrdem(ids, "a", -1)).toBe(ids);
    expect(moverNaOrdem(ids, "x", 1)).toBe(ids);
  });

  it("'Continuar lendo' prefere o último aberto, ignora lidos e cai no primeiro 'lendo'", () => {
    const ls = [
      { ...livro("Lendo", "lendo"), id: "1" },
      { ...livro("Pausado", "pausado"), id: "2" },
      { ...livro("Lido", "lido"), id: "3" },
    ];
    expect(livroParaContinuar(ls, "2")?.id).toBe("2");
    expect(livroParaContinuar(ls, "3")?.id).toBe("1");
    expect(livroParaContinuar(ls, null)?.id).toBe("1");
    expect(livroParaContinuar([ls[2]], null)).toBeNull();
  });
});
