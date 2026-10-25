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

  it("bloqueio automático só aceita as opções da tela; o padrão é nunca", () => {
    expect(PADRAO.bloqueioAuto).toBe(0);
    expect(validar({ bloqueioAuto: 15 }).bloqueioAuto).toBe(15);
    expect(validar({ bloqueioAuto: 7 }).bloqueioAuto).toBe(0);
    expect(validar({ bloqueioAuto: "15" }).bloqueioAuto).toBe(0);
  });

  it("troca valores estranhos pelo padrão, sem perder os bons", () => {
    const resultado = validar({ fonte: "comic", tamanho: 99, densidade: "compacta", modoCor: 3 });
    expect(resultado).toEqual({ ...PADRAO, densidade: "compacta" });
  });

  it("completa os avisos de quem tinha preferências antigas", () => {
    expect(validar({ fonte: "lexend" }).avisos).toEqual(PADRAO.avisos);
    expect(validar({ avisos: { ligado: false, minutos: 7 } }).avisos).toEqual({ ligado: false, minutos: 10, notificacao: true });
  });

  it("aceita tema e fundo válidos e descarta os estranhos", () => {
    expect(validar({ tema: "floresta", fundo: { tipo: "padrao", nome: "folhas" } })).toMatchObject({ tema: "floresta", fundo: { tipo: "padrao", nome: "folhas" } });
    expect(validar({ tema: "inexistente", fundo: { tipo: "imagem", dados: "javascript:x" } })).toMatchObject({ tema: "papel", fundo: null });
    expect(validar({ fundo: { tipo: "svg", conteudo: "<svg/>" } }).fundo).toEqual({ tipo: "svg", conteudo: "<svg/>", repetir: true, animar: false });
  });

  it("tela inicial guarda ordem válida e acrescenta blocos que faltam", () => {
    const r = validar({ inicio: { ordem: ["hoje", "xyz", "hoje", "capturar"], ocultos: ["novidades", "nada"], largos: [] } });
    expect(r.inicio.ordem.slice(0, 2)).toEqual(["hoje", "capturar"]);
    expect(r.inicio.ordem).toHaveLength(6);
    expect(r.inicio.ocultos).toEqual(["novidades"]);
  });

  it("não quebra com texto corrompido", () => {
    const m = new Memoria();
    m.setItem("orbita.preferencias.v1", "{isto não é json");
    expect(carregar(m)).toEqual(PADRAO);
  });
});
