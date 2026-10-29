import { describe, expect, it } from "vitest";
import { balanco, limitarPeso, marcar, marcarCamuflagem, podar, saldoDoDia, sugerirReposicao, ultimaVez, usarKit, validar, VAZIO, type DadosEnergia } from "./contasDados";

const base: DadosEnergia = {
  atividades: [
    { id: "reuniao", nome: "Reunião", peso: -3 },
    { id: "mercado", nome: "Mercado", peso: -2 },
    { id: "silencio", nome: "Ficar em silêncio", peso: 2 },
    { id: "interesse", nome: "Interesse especial", peso: 3 },
    { id: "banho", nome: "Banho morno", peso: 1 },
  ],
  feitos: {},
  sinais: [],
  sentidos: [],
  kit: [],
  usosKit: [],
  camuflagem: {},
};

const momento = (dia: string, hora = 12) => new Date(`${dia}T${String(hora).padStart(2, "0")}:00`).getTime();

describe("saldo do dia", () => {
  it("soma gasto e reposição separados e ignora ids desconhecidos ou repetidos", () => {
    expect(saldoDoDia(base.atividades, ["reuniao", "mercado", "silencio", "silencio", "sumiu"])).toEqual({ gastou: 5, repos: 2, saldo: -3 });
  });

  it("diz o balanço em palavras, com folga de 1 para equilibrado", () => {
    expect(balanco({ gastou: 0, repos: 0, saldo: 0 })).toBe("vazio");
    expect(balanco({ gastou: 3, repos: 2, saldo: -1 })).toBe("equilibrado");
    expect(balanco({ gastou: 5, repos: 2, saldo: -3 })).toBe("gastou-mais");
    expect(balanco({ gastou: 1, repos: 4, saldo: 3 })).toBe("repos-mais");
  });
});

describe("sugestão de reposição", () => {
  it("prefere a que a pessoa mais costuma fazer e pula a já feita hoje", () => {
    let d = base;
    d = marcar(d, "2026-10-26", "banho", true);
    d = marcar(d, "2026-10-27", "banho", true);
    d = marcar(d, "2026-10-27", "interesse", true);
    expect(sugerirReposicao(d, "2026-10-29")?.id).toBe("banho");
    d = marcar(d, "2026-10-29", "banho", true);
    expect(sugerirReposicao(d, "2026-10-29")?.id).toBe("interesse");
  });

  it("sem histórico, sugere a que mais repõe; sem nada que reponha, não sugere", () => {
    expect(sugerirReposicao(base, "2026-10-29")?.id).toBe("interesse");
    expect(sugerirReposicao({ ...base, atividades: base.atividades.filter((a) => a.peso < 0) }, "2026-10-29")).toBeNull();
  });
});

describe("kit sensorial e camuflagem", () => {
  const comKit: DadosEnergia = { ...base, kit: [{ id: "fone", nome: "Fone" }, { id: "escuro", nome: "Quarto escuro" }] };

  it("a sugestão aprende com o uso do kit e pula o que já foi usado hoje", () => {
    let d = comKit;
    d = usarKit(d, "fone", momento("2026-10-25"));
    d = usarKit(d, "fone", momento("2026-10-26"));
    d = usarKit(d, "fone", momento("2026-10-26", 18)); // mesmo dia conta uma vez
    d = marcar(d, "2026-10-27", "interesse", true);
    expect(sugerirReposicao(d, "2026-10-29")).toEqual({ id: "fone", nome: "Fone", origem: "kit" });
    d = usarKit(d, "fone", momento("2026-10-29"));
    expect(sugerirReposicao(d, "2026-10-29")?.id).toBe("interesse");
  });

  it("guarda, troca e apaga a resposta da camuflagem", () => {
    let d = marcarCamuflagem(base, "2026-10-29", "muito");
    expect(d.camuflagem).toEqual({ "2026-10-29": "muito" });
    d = marcarCamuflagem(d, "2026-10-29", null);
    expect(d.camuflagem).toEqual({});
  });

  it("valida kit, usos e camuflagem estranhos", () => {
    const v = validar({
      kit: [{ id: "a", nome: " Fone " }, { id: "b", nome: "  " }, null],
      usosKit: [{ itemId: "a", momento: 5 }, { itemId: 3, momento: 1 }],
      camuflagem: { "2026-10-29": "pouco", "2026-10-28": "demais", x: "muito" },
    });
    expect(v.kit).toEqual([{ id: "a", nome: "Fone" }]);
    expect(v.usosKit).toEqual([{ itemId: "a", momento: 5 }]);
    expect(v.camuflagem).toEqual({ "2026-10-29": "pouco" });
  });

  it("poda camuflagem antiga junto com os dias", () => {
    const d = { ...base, camuflagem: { "2026-01-01": "muito" as const, "2026-10-28": "pouco" as const } };
    expect(podar(d, "2026-10-29").camuflagem).toEqual({ "2026-10-28": "pouco" });
  });
});

describe("guardar", () => {
  it("valida dados estranhos sem quebrar", () => {
    expect(validar(null)).toEqual(VAZIO);
    // Dados de antes do kit e da camuflagem continuam valendo.
    expect(validar({ atividades: [], feitos: {}, sinais: [], sentidos: [] })).toEqual(VAZIO);
    const v = validar({ atividades: [{ id: "a", nome: " X ", peso: 9 }, { id: "b", nome: "", peso: 1 }, 3], feitos: { "2026-10-29": ["a", 2], lixo: [] } });
    expect(v.atividades).toEqual([{ id: "a", nome: "X", peso: 3 }]);
    expect(v.feitos).toEqual({ "2026-10-29": ["a"] });
  });

  it("peso nunca fica 0 nem passa de 3", () => {
    expect(limitarPeso(0)).toBe(-1);
    expect(limitarPeso(-7)).toBe(-3);
    expect(limitarPeso(2.4)).toBe(2);
  });

  it("poda dias antigos e vazios", () => {
    const d = { ...base, feitos: { "2026-01-01": ["banho"], "2026-10-28": ["banho"], "2026-10-29": [] } };
    expect(Object.keys(podar(d, "2026-10-29").feitos)).toEqual(["2026-10-28"]);
  });

  it("acha a última vez que um sinal foi sentido", () => {
    const d = { ...base, sentidos: [{ sinalId: "s", momento: 1 }, { sinalId: "t", momento: 2 }, { sinalId: "s", momento: 3 }] };
    expect(ultimaVez(d, "s")).toBe(3);
    expect(ultimaVez(d, "x")).toBeNull();
  });
});
