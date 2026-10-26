import { describe, expect, it } from "vitest";
import type { Conta, Gasto, Grupo } from "../api";
import { chaveMes, fatiasPizza, filtrar, mesesRecentes, pontosLinha, tabelaPorMes } from "./visao";

const gasto = (centavos: number, grupoId: string, ano: number, mes1: number, interesse = false): Gasto => ({
  id: crypto.randomUUID(), centavos, grupoId, categoria: "", interesse, descricao: "", momento: new Date(ano, mes1 - 1, 15).getTime(),
});
const grupo = (id: string, nome: string, cor = "mar"): Grupo => ({ id, nome, cor, criadoEm: 0 });
const conta = (centavos: number, grupoId: string, criadoEm: number): Conta => ({
  id: crypto.randomUUID(), nome: "Conta", centavos, diaVencimento: 10, avisoDias: 3, grupoId, criadoEm,
});

describe("dinheiro: visão (puro)", () => {
  it("chaveMes e mesesRecentes", () => {
    expect(chaveMes(new Date(2026, 9, 15).getTime())).toBe("2026-10");
    expect(mesesRecentes(new Date(2026, 9, 1), 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
    // Vira o ano para trás.
    expect(mesesRecentes(new Date(2026, 1, 1), 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("agrupa por grupo e por mês, com sem-grupo e totais", () => {
    const grupos = [grupo("g1", "Mercado"), grupo("g2", "Jogos")];
    const gastos = [
      gasto(1000, "g1", 2026, 9),
      gasto(500, "g1", 2026, 10),
      gasto(9900, "g2", 2026, 10),
      gasto(300, "inexistente", 2026, 10), // vira "sem grupo"
      gasto(1, "g1", 2026, 5), // fora da janela de meses
    ];
    const meses = ["2026-09", "2026-10"];
    const tabela = tabelaPorMes(gastos, [], grupos, meses);
    expect(tabela.total).toBe(1000 + 500 + 9900 + 300);
    expect(tabela.totaisMes["2026-10"]).toBe(500 + 9900 + 300);
    // Jogos tem o maior total, vem primeiro; sem-grupo por último.
    expect(tabela.linhas[0].nome).toBe("Jogos");
    expect(tabela.linhas[tabela.linhas.length - 1].nome).toBe("Sem grupo");
    const mercado = tabela.linhas.find((l) => l.id === "g1")!;
    expect(mercado.porMes["2026-09"]).toBe(1000);
    expect(mercado.total).toBe(1500);
  });

  it("contas fixas entram todo mês a partir da criação", () => {
    const grupos = [grupo("casa", "Casa")];
    const meses = ["2026-08", "2026-09", "2026-10"];
    // Conta criada em setembro: não conta em agosto, conta em set e out.
    const contas = [conta(12000, "casa", new Date(2026, 8, 1).getTime())];
    const gastos = [gasto(500, "casa", 2026, 10)];
    const tabela = tabelaPorMes(gastos, contas, grupos, meses);
    const casa = tabela.linhas.find((l) => l.id === "casa")!;
    expect(casa.porMes["2026-08"]).toBe(0);
    expect(casa.porMes["2026-09"]).toBe(12000);
    expect(casa.porMes["2026-10"]).toBe(12000 + 500);
    expect(tabela.total).toBe(12000 * 2 + 500);
  });

  it("filtra por grupo e por interesse especial", () => {
    const gastos = [
      gasto(1000, "g1", 2026, 10, true),
      gasto(500, "g1", 2026, 10, false),
      gasto(300, "g2", 2026, 10, false),
    ];
    const contas = [conta(12000, "g1", new Date(2026, 9, 1).getTime())];
    // Todos: passa tudo.
    expect(filtrar(gastos, contas, { grupoId: "todos", soInteresse: false })).toEqual({ gastos, contas });
    // Um grupo: só g1 (gastos e contas).
    const g1 = filtrar(gastos, contas, { grupoId: "g1", soInteresse: false });
    expect(g1.gastos).toHaveLength(2);
    expect(g1.contas).toHaveLength(1);
    // Só interesse: um gasto, nenhuma conta.
    const so = filtrar(gastos, contas, { grupoId: "todos", soInteresse: true });
    expect(so.gastos).toHaveLength(1);
    expect(so.contas).toHaveLength(0);
  });

  it("pontos da linha: x cresce, valor maior fica mais em cima, vazio na base", () => {
    const meses = ["2026-08", "2026-09", "2026-10"];
    const pts = pontosLinha(meses, { "2026-08": 100, "2026-09": 0, "2026-10": 200 });
    expect(pts.map((p) => p.x)).toEqual([0, 50, 100]);
    expect(pts[2].y).toBe(0); // maior valor, topo
    expect(pts[1].y).toBe(100); // zero, base
    // Sem valor nenhum: todos na base.
    expect(pontosLinha(meses, {}).every((p) => p.y === 100)).toBe(true);
    // Um mês só: fica no meio do x.
    expect(pontosLinha(["2026-10"], { "2026-10": 50 })[0].x).toBe(50);
  });

  it("fatias da pizza: porcentagens e vazio", () => {
    expect(fatiasPizza([])).toEqual([]);
    expect(fatiasPizza([{ label: "a", cor: "mar", centavos: 0 }])).toEqual([]);
    const f = fatiasPizza([
      { label: "a", cor: "mar", centavos: 75 },
      { label: "b", cor: "ceu", centavos: 25 },
    ]);
    expect(f.map((x) => x.porcentagem)).toEqual([75, 25]);
    expect(f[0].d).toContain("A"); // tem arco
  });
});
