import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import { lojaContas, CHAVE_ANTIGA as ENERGIA_ANTIGA } from "./energia/contasDados";
import { lojaEstante } from "./leitura/estanteLocal";
import { CHAVE_ANTIGA as ROTINAS_ANTIGA, comPasso, lojaPersonalizacoes } from "./rotinas/personalizacao";
import { criarLoja, lerValoresParaExportar } from "./valores";

class Memoria implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

afterEach(async () => {
  vi.unstubAllGlobals();
  for (const c of ["rotinas.personalizacao", "energia.contas", "leitura.estante", "foco.salvos"]) await api.apagarValor(c);
});

describe("cofre de valores", () => {
  it("a simulação guarda uma cópia e recusa nomes estranhos", async () => {
    const v = { a: [1, 2] };
    await api.gravarValor("foco.salvos", v);
    v.a.push(3);
    expect(await api.lerValor("foco.salvos")).toEqual({ a: [1, 2] });
    await expect(api.lerValor("Com Espaço")).rejects.toThrow();
  });

  it("não grava por cima do cofre antes de ler", async () => {
    await api.gravarValor("foco.salvos", ["guardado"]);
    const loja = criarLoja<string[]>({ chave: "foco.salvos", vazio: () => [], validar: (b) => (Array.isArray(b) ? b.map(String) : []), espera: 0 });
    loja.mudar((l) => [...l, "novo"]);
    await loja.carregar();
    await loja.gravarAgora();
    expect(loja.obter()).toEqual(["guardado", "novo"]);
    expect(await api.lerValor("foco.salvos")).toEqual(["guardado", "novo"]);
  });

  it("rotinas e energia migram do localStorage e saem de lá", async () => {
    const m = new Memoria();
    m.setItem(ROTINAS_ANTIGA, JSON.stringify({ r1: { cor: "verde", dias: [1, 9], horario: "07:30" } }));
    m.setItem(ENERGIA_ANTIGA, JSON.stringify({ atividades: [{ id: "a", nome: "Barulho", peso: -2 }], sinais: [{ id: "s", texto: "Irritação" }] }));
    vi.stubGlobal("localStorage", m);
    await lojaPersonalizacoes.carregar();
    await lojaContas.carregar();
    expect(lojaPersonalizacoes.obter().r1).toEqual({ cor: "verde", icone: null, dias: [1], horario: "07:30" });
    expect(lojaContas.obter().sinais[0].texto).toBe("Irritação");
    expect(m.length).toBe(0);
    expect(await api.lerValor("energia.contas")).toMatchObject({ atividades: [{ nome: "Barulho" }] });
  });

  it("a estante junta as chaves antigas numa só", async () => {
    const m = new Memoria();
    m.setItem("orbita.leitura.ordemPrateleiras", JSON.stringify(["g2", "g1"]));
    m.setItem("orbita.leitura.ultimoAberto", JSON.stringify({ id: "l1", em: 5 }));
    m.setItem("orbita.leitura.progresso.l1", "40");
    m.setItem("orbita.leitura.progresso.l2", "130");
    m.setItem("orbita.leitura.config", "{}"); // do leitor: não mexe
    vi.stubGlobal("localStorage", m);
    await lojaEstante.carregar();
    expect(lojaEstante.obter()).toEqual({ ordem: ["g2", "g1"], ultimo: { id: "l1", em: 5 }, progresso: { l1: 40, l2: 100 } });
    expect(m.length).toBe(1);
    expect(await lerValoresParaExportar()).toHaveProperty("leitura.estante");
  });

  it("o feito de hoje recomeça no dia seguinte", () => {
    const ontem = comPasso({ dia: "", passos: {} }, "r", "p1", true, "2026-10-28");
    expect(ontem.passos.r).toEqual(["p1"]);
    expect(comPasso(ontem, "r", "p2", true, "2026-10-29")).toEqual({ dia: "2026-10-29", passos: { r: ["p2"] } });
  });
});
