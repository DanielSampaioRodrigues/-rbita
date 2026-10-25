import { describe, expect, it } from "vitest";
import { carregar, PADRAO, salvar, validar } from "./preferencias";

class Memoria implements Storage {
  private dados = new Map<string, string>();
  get length() { return this.dados.size; }
  clear() { this.dados.clear(); }
  getItem(k: string) { return this.dados.get(k) ?? null; }
  key(i: number) { return [...this.dados.keys()][i] ?? null; }
  removeItem(k: string) { this.dados.delete(k); }
  setItem(k: string, v: string) { this.dados.set(k, v); }
}

describe("preferências", () => {
  it("começa no padrão quando não há nada salvo", () => {
    expect(carregar(new Memoria())).toEqual(PADRAO);
  });

  it("salva e carrega de volta", () => {
    const m = new Memoria();
    const prefs = { ...PADRAO, fonte: "lexend" as const, tamanho: 4, baixoEstimulo: true };
    salvar(prefs, m);
    expect(carregar(m)).toEqual(prefs);
  });

  it("troca valores estranhos pelo padrão, sem perder os bons", () => {
    const resultado = validar({ fonte: "comic", tamanho: 99, densidade: "compacta", modoCor: 3 });
    expect(resultado).toEqual({ ...PADRAO, densidade: "compacta" });
  });

  it("não quebra com texto corrompido", () => {
    const m = new Memoria();
    m.setItem("orbita.preferencias.v1", "{isto não é json");
    expect(carregar(m)).toEqual(PADRAO);
  });
});
