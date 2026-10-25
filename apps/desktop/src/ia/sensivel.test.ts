import { describe, expect, it } from "vitest";
import { pareceSensivel } from "./sensivel";

describe("pareceSensivel", () => {
  it("percebe saúde e terapia, com ou sem acento", () => {
    expect(pareceSensivel("tenho consulta com a psiquiatra quinta")).toBe(true);
    expect(pareceSensivel("comprar REMÉDIO")).toBe(true);
    expect(pareceSensivel("sessão de terapia às 10h")).toBe(true);
    expect(pareceSensivel("tomar 50 mg de manhã")).toBe(true);
  });
  it("não avisa sem motivo", () => {
    expect(pareceSensivel("pagar a luz e ideia de livro")).toBe(false);
    expect(pareceSensivel("comprar tomate")).toBe(false);
  });
});
