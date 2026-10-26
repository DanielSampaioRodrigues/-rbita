import { beforeEach, describe, expect, it } from "vitest";
import { api, type CartaoQuadro, type Hobby } from "../api";

const h = (nome: string): Hobby => ({ id: "", nome, notas: "", criadoEm: 0 });
const cartao = (hobbyId: string, tipo: CartaoQuadro["tipo"]): CartaoQuadro => ({
  id: "", hobbyId, tipo, texto: "", anexoId: "", x: 10, y: 20, largura: 200, altura: 120, criadoEm: 0,
});

async function limpar() {
  for (const x of await api.listarHobbies()) await api.excluirHobby(x.id);
}

describe("hobbies (simulação)", () => {
  beforeEach(limpar);

  it("salva, edita e exclui; recusa nome vazio", async () => {
    const criado = await api.salvarHobby({ ...h("Teclados"), notas: " switches " });
    expect(criado.id).not.toBe("");
    expect(criado.notas).toBe("switches");
    await expect(api.salvarHobby(h("   "))).rejects.toThrow();
    await api.salvarHobby({ ...criado, nome: "Teclados ISO" });
    expect((await api.listarHobbies())[0].nome).toBe("Teclados ISO");
    await api.excluirHobby(criado.id);
    expect(await api.listarHobbies()).toHaveLength(0);
  });
});

describe("hobbies: quadro livre (simulação)", () => {
  it("adiciona cartões, move, valida e apaga", async () => {
    const hobby = await api.salvarHobby(h("Fotografia"));
    const atuais = await api.listarCartoes(hobby.id);
    for (const c of atuais) await api.excluirCartao(c.id);

    const texto = await api.salvarCartao({ ...cartao(hobby.id, "texto"), texto: "lembrar da luz" });
    await api.salvarCartao({ ...cartao(hobby.id, "link"), anexoId: "a1" });
    await expect(api.salvarCartao(cartao(hobby.id, "xpto" as CartaoQuadro["tipo"]))).rejects.toThrow();
    await expect(api.salvarCartao(cartao("  ", "texto"))).rejects.toThrow();

    expect((await api.listarCartoes(hobby.id)).length).toBe(2);

    await api.moverCartao(texto.id, 333, 444);
    const movido = (await api.listarCartoes(hobby.id)).find((c) => c.id === texto.id)!;
    expect([movido.x, movido.y]).toEqual([333, 444]);
    expect(movido.largura).toBe(200);

    await api.excluirCartao(texto.id);
    expect((await api.listarCartoes(hobby.id)).length).toBe(1);
  });
});
