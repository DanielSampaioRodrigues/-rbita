import { describe, expect, it } from "vitest";
import { validar } from "../preferencias";
import { anguloPonteiro, areiaAmpulheta } from "./Mostradores";
import { CHAVE_SALVOS, gravarSalvos, lerSalvos, limitarMinutos, MAXIMO_SALVOS, validarSalvos } from "./salvos";

class Memoria implements Storage {
  private dados = new Map<string, string>();
  get length() { return this.dados.size; }
  clear() { this.dados.clear(); }
  getItem(k: string) { return this.dados.get(k) ?? null; }
  key(i: number) { return [...this.dados.keys()][i] ?? null; }
  removeItem(k: string) { this.dados.delete(k); }
  setItem(k: string, v: string) { this.dados.set(k, v); }
}

describe("estilo do foco", () => {
  it("começa no disco e guarda a escolha", () => {
    expect(validar({}).estiloFoco).toBe("circulo");
    expect(validar({ estiloFoco: "ampulheta" }).estiloFoco).toBe("ampulheta");
    expect(validar({ estiloFoco: "estranho" }).estiloFoco).toBe("circulo");
  });

  it("o ponteiro volta ao 12 quando o tempo acaba", () => {
    expect(anguloPonteiro(1)).toBe(360);
    expect(anguloPonteiro(0.5)).toBe(180);
    expect(anguloPonteiro(0)).toBe(0);
    expect(anguloPonteiro(-3)).toBe(0);
  });

  it("a areia passa toda de cima para baixo", () => {
    expect(areiaAmpulheta(1).baixo).toBe("");
    expect(areiaAmpulheta(1).cima).not.toBe("");
    expect(areiaAmpulheta(0).cima).toBe("");
    expect(areiaAmpulheta(0).baixo).toBe("50,60 50,60 86,108 14,108");
    // Metade do tempo: a altura da areia em cima é 48·√0,5 (área de triângulo).
    const y = Number(areiaAmpulheta(0.5).cima.split(" ")[0].split(",")[1]);
    expect(y).toBeCloseTo(60 - 48 * Math.SQRT1_2);
  });
});

describe("focos salvos", () => {
  it("grava e lê de volta", () => {
    const m = new Memoria();
    expect(lerSalvos(m)).toEqual([]);
    const lista = [{ id: "a", nome: "Estudar", minutos: 45, pausa: 10 }];
    gravarSalvos(lista, m);
    expect(lerSalvos(m)).toEqual(lista);
  });

  it("deixa de fora o que vier estranho e corrige os minutos", () => {
    const m = new Memoria();
    m.setItem(CHAVE_SALVOS, "não é json");
    expect(lerSalvos(m)).toEqual([]);
    expect(
      validarSalvos([
        { id: "a", nome: "  Ler  ", minutos: 500, pausa: -2 },
        { id: "a", nome: "Repetido", minutos: 10 },
        { id: "b", nome: "", minutos: 10 },
        { id: "c", nome: "Sem pausa", minutos: 0.4 },
        null,
        "texto",
      ]),
    ).toEqual([
      { id: "a", nome: "Ler", minutos: 180, pausa: 0 },
      { id: "c", nome: "Sem pausa", minutos: 1, pausa: 0 },
    ]);
  });

  it("tem um limite de cartões", () => {
    const muitos = Array.from({ length: MAXIMO_SALVOS + 5 }, (_, i) => ({ id: String(i), nome: `F${i}`, minutos: 25, pausa: 5 }));
    expect(validarSalvos(muitos)).toHaveLength(MAXIMO_SALVOS);
  });

  it("prende os minutos", () => {
    expect(limitarMinutos("abc")).toBe(1);
    expect(limitarMinutos("abc", 0)).toBe(0);
    expect(limitarMinutos(25)).toBe(25);
  });
});
