import { describe, expect, it } from "vitest";
import { filtrar } from "./Paleta";

describe("buscar ou fazer algo", () => {
  const itens = [{ nome: "Saúde" }, { nome: "Psicologia da Saúde" }, { nome: "Caderno" }, { nome: "Estágio específico" }];
  it("acha sem acento e põe primeiro o que começa com o que foi escrito", () => {
    expect(filtrar(itens, "saude").map((i) => i.nome)).toEqual(["Saúde", "Psicologia da Saúde"]);
    expect(filtrar(itens, "ESTAGIO")[0].nome).toBe("Estágio específico");
  });
  it("sem nada escrito, devolve o começo da lista", () => {
    expect(filtrar(itens, "  ", 2)).toHaveLength(2);
  });
});
