import { describe, expect, it } from "vitest";
import { ESPACOS, MAXIMO_LUAS, montarUniverso, posicaoLocal, semente, todos, type DadosOrbita } from "./universo";
import { SECOES_MENU } from "../preferencias";

const dados = (n: number, espacos = 3): DadosOrbita => ({
  agora: "Livre",
  hoje: [{ id: "e1", nome: "Psicóloga · 14:30", alvo: { tipo: "secao", secao: "agenda" } }],
  espacos: (["caderno", "projetos", "ideias", "agenda", "leitura", "saude", "dinheiro", "estudos", "rotinas", "foco"] as const).slice(0, espacos).map((secao) => ({
    secao, novo: "+ Novo", coisas: Array.from({ length: secao === "caderno" ? n : 2 }, (_, i) => ({ id: `c${i}`, nome: `Coisa ${i}`, alvo: { tipo: "secao" as const, secao } })),
  })),
});

describe("universo do Órbita", () => {
  it("todo espaço do menu (menos Início, Aparência e Ajustes) tem um planeta", () => {
    for (const s of SECOES_MENU) if (!["inicio", "aparencia", "ajustes"].includes(s)) expect(ESPACOS[s], s).toBeTruthy();
  });
  it("monta o agora, o hoje e os planetas com as luas", () => {
    const r = montarUniverso(dados(3));
    expect(r.filhos.map((k) => k.tipo)).toEqual(["hoje", "espaco", "espaco", "espaco"]);
    const caderno = r.filhos[1];
    expect(caderno.filhos.map((k) => k.nome)).toEqual(["+ Novo", "Coisa 0", "Coisa 1", "Coisa 2"]);
    expect(caderno.filhos[1].pai).toBe(caderno);
    expect(caderno.filhos[1].prof).toBe(2);
  });
  it("com coisas demais, o resto vira um corpo \"+ N\" que abre o espaço", () => {
    const caderno = montarUniverso(dados(30)).filhos[1];
    expect(caderno.filhos.length).toBe(MAXIMO_LUAS + 1);
    expect(caderno.filhos.at(-1)?.nome).toBe("+ 20 em Caderno");
  });
  it("os planetas não se encostam: o sistema de um não invade o do vizinho", () => {
    const r = montarUniverso(dados(30, 10));
    const planetas = r.filhos.filter((k) => k.tipo === "espaco");
    expect(new Set(planetas.map((p) => p.anel))).toEqual(new Set([1, 2]));
    for (const t of [0, 37, 500]) {
      for (const a of planetas) for (const b of planetas) {
        if (a === b) continue;
        const pa = posicaoLocal(a, t), pb = posicaoLocal(b, t), d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
        expect(d, `${a.nome} e ${b.nome}`).toBeGreaterThan(a.ext + b.ext - 6);
      }
    }
  });
  it("ids únicos e semente estável", () => {
    const ids = todos(montarUniverso(dados(30, 10))).map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(semente("espaco:caderno")).toBe(semente("espaco:caderno"));
  });
});
