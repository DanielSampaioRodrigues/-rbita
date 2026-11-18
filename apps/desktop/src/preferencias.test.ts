import { describe, expect, it } from "vitest";
import { BLOCOS_ATALHO, BLOCOS_INICIO, carregar, PADRAO, salvar, SECOES_MENU, validar } from "./preferencias";

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
    for (const m of [120, 240, 480, 1440, 4320, 10080]) expect(validar({ bloqueioAuto: m }).bloqueioAuto).toBe(m);
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
    expect(r.inicio.ordem).toHaveLength(BLOCOS_INICIO.length);
    // Os atalhos de módulo que a pessoa ainda não viu entram escondidos: o Início não muda sem aviso.
    expect(r.inicio.ocultos).toEqual(["novidades", ...BLOCOS_ATALHO]);
  });

  it("menu guarda ordem válida, acrescenta seções novas no fim e não esconde as travadas", () => {
    const r = validar({ menu: { ordem: ["ajustes", "xyz", "ajustes", "foco"], ocultos: ["dinheiro", "inicio", "aparencia", "ajustes", "nada", "dinheiro"] } });
    expect(r.menu.ordem.slice(0, 2)).toEqual(["ajustes", "foco"]);
    expect(r.menu.ordem).toHaveLength(SECOES_MENU.length);
    expect(new Set(r.menu.ordem).size).toBe(SECOES_MENU.length);
    // As que faltavam vêm depois, na ordem de fábrica.
    expect(r.menu.ordem.slice(2)).toEqual(SECOES_MENU.filter((s) => s !== "ajustes" && s !== "foco"));
    expect(r.menu.ocultos).toEqual(["dinheiro"]);
    // Preferências antigas, sem menu: tudo à mostra, na ordem de fábrica.
    expect(validar({ fonte: "lexend" }).menu).toEqual({ ordem: [...SECOES_MENU], ocultos: [] });
    expect(validar({ menu: "estragado" }).menu).toEqual(PADRAO.menu);
  });

  it("guarda que a pessoa dispensou a dica do céu, e começa sem dispensar", () => {
    expect(validar({}).orbita.dicaVista).toBe(false);
    expect(validar({ orbita: { dicaVista: true } }).orbita.dicaVista).toBe(true);
    expect(validar({ orbita: { dicaVista: "sim" } }).orbita.dicaVista).toBe(false);
  });

  it("não quebra com texto corrompido", () => {
    const m = new Memoria();
    m.setItem("orbita.preferencias.v1", "{isto não é json");
    expect(carregar(m)).toEqual(PADRAO);
  });
});
