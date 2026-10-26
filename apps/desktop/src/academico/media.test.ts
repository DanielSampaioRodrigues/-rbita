import { describe, expect, it } from "vitest";
import type { Atividade } from "../api";
import { mediaPonderada, situacao } from "./media";

const at = (over: Partial<Atividade>): Atividade => ({
  id: "a", materiaId: "m", tipo: "prova", titulo: "t", data: "", peso: null, nota: null, feita: false, criadoEm: 0, ...over,
});

describe("média da matéria", () => {
  it("sem nota lançada, não há média", () => {
    expect(mediaPonderada([at({ nota: null }), at({ nota: null })])).toBeNull();
    expect(mediaPonderada([])).toBeNull();
  });

  it("média simples quando não há pesos", () => {
    expect(mediaPonderada([at({ nota: 8 }), at({ nota: 6 })])).toBe(7);
  });

  it("média ponderada pelos pesos, ignorando atividades sem nota", () => {
    // (9*2 + 5*1) / (2+1) = 23/3
    const m = mediaPonderada([at({ nota: 9, peso: 2 }), at({ nota: 5, peso: 1 }), at({ nota: null, peso: 3 })]);
    expect(m).toBeCloseTo(23 / 3, 5);
  });

  it("situação é calma e tem faixa de 'quase'", () => {
    expect(situacao(null, 6)).toBe("semNota");
    expect(situacao(7, 6)).toBe("acima");
    expect(situacao(6, 6)).toBe("acima");
    expect(situacao(5.6, 6)).toBe("perto"); // dentro de meio ponto
    expect(situacao(4, 6)).toBe("abaixo");
  });
});
