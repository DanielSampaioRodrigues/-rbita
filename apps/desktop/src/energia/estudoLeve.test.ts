import { describe, expect, it } from "vitest";
import type { Atividade } from "../api";
import { estudosLeves } from "./estudoLeve";

const at = (id: string, tipo: string, data: string, feita = false): Atividade => ({ id, materiaId: "m", tipo, titulo: id, data, peso: null, nota: null, feita, criadoEm: 0 });

describe("estudo leve na baixa energia", () => {
  it("só as leves, não feitas, perto ou sem data; a mais próxima primeiro", () => {
    const r = estudosLeves([
      at("prova", "prova", "2026-11-13"),
      at("feito", "dever", "2026-11-13", true),
      at("longe", "trabalho", "2026-12-20"),
      at("passou", "dever", "2026-11-10"),
      at("semData", "leitura", ""),
      at("amanha", "dever", "2026-11-13"),
      at("semana", "entrega", "2026-11-18"),
    ], "2026-11-12");
    expect(r.map((x) => x.id)).toEqual(["amanha", "semana", "semData"]);
  });
});
