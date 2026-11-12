import { describe, expect, it } from "vitest";
import { decodificar, lerCsv, lerData, lerExtrato, lerOfx, lerValor, pareceRegistrado } from "./extrato";

describe("valores do extrato", () => {
  it.each([
    ["-45,90", -4590], ["1.234,56", 123456], ["R$ -1.234,56", -123456], ["-1234.56", -123456],
    ["12.5", 1250], ["0.99", 99], ["1.234", 123400], ["(12,00)", -1200], ["12,00 D", -1200],
    ["12,00 C", 1200], ["45,90-", -4590], ["+300", 30000], ["1,234.56", 123456], ["", null], ["abc", null],
  ])("%s", (s, c) => expect(lerValor(s)).toBe(c));
});

describe("datas do extrato", () => {
  it.each([
    ["31/10/2026", "2026-10-31"], ["31/10/26", "2026-10-31"], ["2026-10-31", "2026-10-31"],
    ["20261031120000[-3:BRT]", "2026-10-31"], ["1/2/2026", "2026-02-01"], ["31/02/2026", null], ["ontem", null],
  ])("%s", (s, d) => expect(lerData(s)).toBe(d));
});

describe("OFX", () => {
  const ofx = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261003000000[-3:BRT]
<TRNAMT>-45.90
<FITID>abc123
<MEMO>Compra no débito - Padaria Pão &amp; Cia
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261005
<TRNAMT>2500.00
<FITID>def456
<NAME>Salário
<MEMO>Salário
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;
  it("lê os lançamentos, com sinal, data, descrição e identificador", () => {
    const l = lerOfx(ofx);
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ data: "2026-10-03", centavos: -4590, descricao: "Compra no débito - Padaria Pão & Cia" });
    expect(l[0].id).toContain("abc123");
    expect(l[1]).toMatchObject({ data: "2026-10-05", centavos: 250000, descricao: "Salário" });
  });
  it("reconhece pelo nome ou pelo conteúdo", () => {
    expect(lerExtrato("extrato.ofx", ofx)?.formato).toBe("ofx");
    expect(lerExtrato("qualquer.txt", ofx)?.linhas).toHaveLength(2);
  });
  it("decodifica Windows-1252", () => {
    const bytes = new Uint8Array([...new TextEncoder().encode("CHARSET:1252\n<MEMO>P"), 0xe3, 0x6f]);
    expect(decodificar(bytes)).toContain("Pão");
    expect(decodificar(new TextEncoder().encode("﻿Data;Valor"))).toBe("Data;Valor");
  });
});

describe("CSV", () => {
  it("conta do Nubank (Data,Valor,Identificador,Descrição)", () => {
    const e = lerCsv("Data,Valor,Identificador,Descrição\n01/10/2026,-32.50,id-1,Compra no débito - Mercado\n02/10/2026,1500.00,id-2,Transferência recebida");
    expect(e?.formato).toBe("conta");
    expect(e?.linhas.map((l) => [l.data, l.centavos, l.descricao])).toEqual([
      ["2026-10-01", -3250, "Compra no débito - Mercado"],
      ["2026-10-02", 150000, "Transferência recebida"],
    ]);
    expect(e?.linhas[0].id).toContain("id-1");
  });
  it("fatura do Nubank (date,title,amount): compra positiva vira gasto", () => {
    const e = lerCsv("date,title,amount\n2026-10-03,Livraria,89.90\n2026-10-10,Pagamento recebido,-500.00");
    expect(e?.formato).toBe("cartao");
    expect(e?.linhas.map((l) => l.centavos)).toEqual([-8990, 50000]);
  });
  it("ponto e vírgula, aspas, linhas antes do cabeçalho e débito/crédito separados", () => {
    const csv = `Extrato de conta corrente
Agência 0001;Conta 12345-6

Data Lançamento;Histórico;Débito (R$);Crédito (R$);Saldo
03/10/2026;"PIX ENVIADO; FULANO";150,00;;1.000,00
04/10/2026;SALARIO;;3.200,00;4.200,00
05/10/2026;SALDO DO DIA;;;4.200,00`;
    const e = lerCsv(csv);
    expect(e?.linhas.map((l) => [l.data, l.descricao, l.centavos])).toEqual([
      ["2026-10-03", "PIX ENVIADO; FULANO", -15000],
      ["2026-10-04", "SALARIO", 320000],
    ]);
  });
  it("dois lançamentos iguais no mesmo dia ficam com identificadores diferentes", () => {
    const e = lerCsv("Data;Descrição;Valor\n01/10/2026;Ônibus;-4,50\n01/10/2026;Ônibus;-4,50");
    expect(new Set(e?.linhas.map((l) => l.id)).size).toBe(2);
  });
  it("sem as colunas, devolve nada", () => {
    expect(lerCsv("nome;idade\nAna;30")).toBeNull();
  });
});

describe("parece já registrado", () => {
  const dia = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const meioDia = Date.UTC(2026, 9, 3, 12);
  it("mesmo dia e mesmo valor", () => {
    const g = [{ id: "g", centavos: 4590, grupoId: "", categoria: "", interesse: false, descricao: "Padaria", momento: meioDia }];
    expect(pareceRegistrado({ id: "1", data: "2026-10-03", descricao: "X", centavos: -4590 }, g, [], dia)).toBe(true);
    expect(pareceRegistrado({ id: "1", data: "2026-10-04", descricao: "X", centavos: -4590 }, g, [], dia)).toBe(false);
    expect(pareceRegistrado({ id: "1", data: "2026-10-03", descricao: "X", centavos: 4590 }, g, [], dia)).toBe(false);
  });
});
