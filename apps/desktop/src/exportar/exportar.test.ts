import { describe, expect, it } from "vitest";
import type { Evento, Gasto, Grupo, RegistroSaude } from "../api";
import { eventosParaICS, gastosParaCSV, montarJSON, paraCSV, registrosSaudeParaCSV } from "./exportar";

const evento = (e: Partial<Evento>): Evento => ({
  id: "e1", titulo: "Terapia", inicio: new Date(2026, 9, 15, 14, 30).getTime(), fim: new Date(2026, 9, 15, 15, 30).getTime(),
  diaInteiro: false, repeticao: null, modelo: false, notas: "", excecoes: [], ...e,
});

describe("exportar (puro)", () => {
  it("CSV escapa vírgula, aspas e quebra de linha", () => {
    const csv = paraCSV(["a", "b"], [["x,y", 'diz "oi"'], ["linha\nquebrada", "z"]]);
    expect(csv).toBe('a,b\r\n"x,y","diz ""oi"""\r\n"linha\nquebrada",z');
  });

  it("gastos em CSV, ordenados por data", () => {
    const grupos: Grupo[] = [{ id: "g1", nome: "Mercado", cor: "mar", criadoEm: 0 }];
    const gastos: Gasto[] = [
      { id: "2", centavos: 500, grupoId: "g1", categoria: "", interesse: true, descricao: "café", momento: new Date(2026, 9, 2, 9, 0).getTime() },
      { id: "1", centavos: 1000, grupoId: "", categoria: "antigo", interesse: false, descricao: "", momento: new Date(2026, 9, 1, 8, 0).getTime() },
    ];
    const csv = gastosParaCSV(gastos, grupos);
    const linhas = csv.split("\r\n");
    expect(linhas[0]).toBe("Data,Valor,Grupo,Interesse especial,Descrição");
    expect(linhas[1]).toContain("2026-10-01 08:00");
    expect(linhas[1]).toContain("antigo");
    expect(linhas[1]).toContain("não");
    expect(linhas[2]).toContain("Mercado");
    expect(linhas[2]).toContain("sim");
  });

  it("registros de saúde em CSV, com rótulo e intensidade vazia", () => {
    const regs: RegistroSaude[] = [
      { id: "1", tipo: "sono", momento: new Date(2026, 9, 1, 7, 0).getTime(), intensidade: 3, nota: "ok" },
      { id: "2", tipo: "coisa_boa", momento: new Date(2026, 9, 2, 7, 0).getTime(), intensidade: null, nota: "" },
    ];
    const csv = registrosSaudeParaCSV(regs, (t) => (t === "sono" ? "Sono" : "Coisa boa"));
    const linhas = csv.split("\r\n");
    expect(linhas[1]).toBe("2026-10-01 07:00,Sono,3,ok");
    expect(linhas[2]).toBe("2026-10-02 07:00,Coisa boa,,");
  });

  it("ICS: evento com hora, descrição e cabeçalho", () => {
    const ics = eventosParaICS([evento({ notas: "levar; o caderno" })], 0);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("UID:e1@orbita");
    expect(ics).toContain("DTSTART:20261015T143000");
    expect(ics).toContain("DTEND:20261015T153000");
    expect(ics).toContain("SUMMARY:Terapia");
    expect(ics).toContain("DESCRIPTION:levar\\; o caderno");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n")).toContain("END:VEVENT");
  });

  it("ICS: dia inteiro usa VALUE=DATE e DTEND exclusivo", () => {
    const ics = eventosParaICS([evento({ diaInteiro: true, inicio: new Date(2026, 9, 15).getTime(), fim: null })], 0);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261015");
    expect(ics).toContain("DTEND;VALUE=DATE:20261016");
  });

  it("ICS: repetição semanal com dias e até; exceções", () => {
    const ics = eventosParaICS([evento({ repeticao: { frequencia: "semanal", dias: [4], ate: new Date(2026, 11, 31).getTime() }, excecoes: ["2026-10-22"] })], 0);
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=TH;UNTIL=20261231");
    expect(ics).toContain("EXDATE:20261022T143000");
  });

  it("ICS: pula eventos da semana-modelo", () => {
    const ics = eventosParaICS([evento({ modelo: true })], 0);
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("JSON empacota com versão e data", () => {
    const j = JSON.parse(montarJSON({ ideias: [{ id: "1" }] }, 0));
    expect(j.versao).toBe(1);
    expect(j.geradoEm).toBe("1970-01-01T00:00:00.000Z");
    expect(j.dados.ideias[0].id).toBe("1");
  });
});
