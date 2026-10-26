import { beforeEach, describe, expect, it } from "vitest";
import { api, type Livro } from "../api";

const livro = (titulo: string, status = "quero"): Livro => ({
  id: "", titulo, autor: "Autor", status, ondeParei: "", impressoes: "", inicio: "", fim: "", formato: "", arquivoId: "", criadoEm: 0,
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
});
