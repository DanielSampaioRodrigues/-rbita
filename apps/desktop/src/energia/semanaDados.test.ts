import { describe, expect, it } from "vitest";
import type { Evento } from "../api";
import type { Ocorrencia } from "../agenda/datas";
import { marcar, marcarCamuflagem, VAZIO, type DadosEnergia } from "./contasDados";
import { diasPesados, fraseAviso, juntar, negativosSeguidos, semanaEmSaldo } from "./semanaDados";

// 29/10/2026 é uma quinta-feira.
const HOJE = new Date(2026, 9, 29, 15, 0);

const base: DadosEnergia = {
  ...VAZIO,
  atividades: [
    { id: "reuniao", nome: "Reunião", peso: -3 },
    { id: "silencio", nome: "Silêncio", peso: 2 },
    { id: "banho", nome: "Banho", peso: 1 },
  ],
};

function comDias(dias: Record<string, string[]>): DadosEnergia {
  let d = base;
  for (const [dia, ids] of Object.entries(dias)) for (const id of ids) d = marcar(d, dia, id, true);
  return d;
}

describe("semana em saldo", () => {
  it("monta 7 dias terminando hoje, em ordem, com o balanço e a camuflagem", () => {
    let d = comDias({ "2026-10-23": ["reuniao"], "2026-10-27": ["silencio", "banho"], "2026-10-28": ["reuniao", "silencio"] });
    d = marcarCamuflagem(d, "2026-10-28", "muito");
    const s = semanaEmSaldo(d, HOJE);
    expect(s.map((x) => x.dia)).toEqual(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"]);
    expect(s.map((x) => x.balanco)).toEqual(["gastou-mais", "vazio", "vazio", "vazio", "repos-mais", "equilibrado", "vazio"]);
    expect(s[5].camuflagem).toBe("muito");
    expect(s[0].camuflagem).toBeNull();
  });

  it("conta os dias seguidos no negativo; hoje vazio não quebra, um dia bom quebra", () => {
    const tres = comDias({ "2026-10-26": ["reuniao"], "2026-10-27": ["reuniao"], "2026-10-28": ["reuniao"] });
    expect(negativosSeguidos(semanaEmSaldo(tres, HOJE))).toBe(3);
    const hojeTambem = marcar(tres, "2026-10-29", "reuniao", true);
    expect(negativosSeguidos(semanaEmSaldo(hojeTambem, HOJE))).toBe(4);
    const hojeBom = marcar(tres, "2026-10-29", "silencio", true);
    expect(negativosSeguidos(semanaEmSaldo(hojeBom, HOJE))).toBe(0);
    const buraco = comDias({ "2026-10-25": ["reuniao"], "2026-10-26": ["reuniao"], "2026-10-28": ["reuniao"] });
    expect(negativosSeguidos(semanaEmSaldo(buraco, HOJE))).toBe(1);
  });
});

function evento(id: string, inicio: Date, extra: Partial<Evento> = {}): Evento {
  return { id, titulo: id, inicio: inicio.getTime(), fim: null, diaInteiro: false, repeticao: null, modelo: false, notas: "", excecoes: [], ...extra };
}

function ocorrencias(porDia: Record<number, number>, extra: Partial<Evento> = {}): Ocorrencia[] {
  const saida: Ocorrencia[] = [];
  for (const [dia, n] of Object.entries(porDia)) {
    for (let i = 0; i < n; i++) {
      const inicio = new Date(2026, 9, Number(dia), 9 + i);
      const d = `2026-10-${String(dia).padStart(2, "0")}`;
      saida.push({ evento: evento(`${dia}-${i}`, inicio, extra), inicio, fim: null, dia: d });
    }
  }
  return saida;
}

describe("dias pesados à vista", () => {
  it("avisa de um dia com 3 ou mais compromissos", () => {
    const avisos = diasPesados(ocorrencias({ 29: 1, 31: 4 }), HOJE);
    expect(avisos).toEqual([{ tipo: "dia", dia: "2026-10-31", quantos: 4 }]);
    expect(fraseAviso(avisos[0], HOJE)).toBe("Sábado tem 4 compromissos. Vale guardar energia antes e depois.");
  });

  it("chama hoje e amanhã pelo nome", () => {
    const [a] = diasPesados(ocorrencias({ 29: 3 }), HOJE);
    const [b] = diasPesados(ocorrencias({ 30: 5 }), HOJE);
    expect(fraseAviso(a, HOJE)).toBe("Hoje tem 3 compromissos. Vale guardar energia antes e depois.");
    expect(fraseAviso(b, HOJE)).toBe("Amanhã tem 5 compromissos. Vale guardar energia antes e depois.");
  });

  it("junta dias seguidos cheios (2 ou mais) num aviso só", () => {
    const avisos = diasPesados(ocorrencias({ 30: 2, 31: 3 }), HOJE);
    expect(avisos).toEqual([{ tipo: "seguidos", dias: [{ dia: "2026-10-30", quantos: 2 }, { dia: "2026-10-31", quantos: 3 }] }]);
    expect(fraseAviso(avisos[0], HOJE)).toBe("Dias seguidos com compromissos: amanhã (2) e sábado (3). Vale guardar energia antes e depois.");
  });

  it("não avisa de um dia só com 2, nem conta blocos da semana-modelo", () => {
    expect(diasPesados(ocorrencias({ 30: 2 }), HOJE)).toEqual([]);
    expect(diasPesados(ocorrencias({ 30: 5 }, { modelo: true }), HOJE)).toEqual([]);
  });

  it("olha só os próximos 7 dias", () => {
    expect(diasPesados(ocorrencias({ 28: 5 }), HOJE)).toEqual([]);
    const novembro: Ocorrencia[] = [0, 1, 2].map((i) => {
      const inicio = new Date(2026, 10, 5, 9 + i);
      return { evento: evento(`n${i}`, inicio), inicio, fim: null, dia: "2026-11-05" };
    });
    expect(diasPesados(novembro, HOJE)).toEqual([]);
    const ultimo = novembro.map((o) => ({ ...o, dia: "2026-11-04" }));
    expect(diasPesados(ultimo, HOJE)).toEqual([{ tipo: "dia", dia: "2026-11-04", quantos: 3 }]);
  });

  it("junta palavras com vírgula e 'e'", () => {
    expect(juntar(["a"])).toBe("a");
    expect(juntar(["a", "b"])).toBe("a e b");
    expect(juntar(["a", "b", "c"])).toBe("a, b e c");
  });
});
