import { beforeEach, describe, expect, it } from "vitest";
import { api, type Hobby } from "../api";

const h = (nome: string): Hobby => ({ id: "", nome, notas: "", criadoEm: 0 });

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
