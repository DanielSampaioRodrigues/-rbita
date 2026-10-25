import { describe, expect, it } from "vitest";
import { LISTA, reconhecer, separar } from "./palavras";

describe("palavras da chave de recuperação", () => {
  it("lê a mesma lista da parte nativa", () => {
    expect(LISTA).toHaveLength(2048);
  });

  it("reconhece como a parte nativa", () => {
    expect(reconhecer("ABACATE")).toBe("abacate");
    expect(reconhecer("abac")).toBe("abacate");
    expect(reconhecer("abacáte")).toBe("abacate");
    expect(reconhecer("aba")).toBeNull();
    expect(reconhecer("abacatx")).toBeNull();
  });

  it("separa texto colado com números", () => {
    expect(separar("1. janela 2. cometa\n3. farol")).toEqual(["janela", "cometa", "farol"]);
  });
});
