import { describe, expect, it } from "vitest";
import type { CartaoOrg, Coluna } from "../api";
import { quadroEmTexto } from "./enviar";

const col = (id: string, nome: string, ordem: number, p: Partial<Coluna> = {}): Coluna => ({ id, quadroId: "q", nome, ordem, ...p });
const cartao = (id: string, colunaId: string, texto: string, p: Partial<CartaoOrg> = {}): CartaoOrg => ({ id, colunaId, texto, feito: false, cor: "", prazo: "", ordem: 1, criadoEm: 0, ...p });

describe("quadro em texto", () => {
  it("colunas na ordem, cartões com feito, data, etiquetas, descrição e checklist", () => {
    const txt = quadroEmTexto("Trabalho",
      [col("b", "Feito", 2), col("a", "A fazer", 1), col("z", "Velha", 3, { arquivada: true })],
      [
        cartao("1", "a", "Relatório", { prazo: "2026-11-15", hora: "14:30", etiquetas: ["e1"], descricao: "Ver dados\nRevisar", checklists: [{ id: "c", nome: "Passos", itens: [{ id: "i", texto: "Tabela", feito: true }] }] }),
        cartao("2", "b", "Planilha", { feito: true }),
        cartao("3", "a", "Arquivado", { arquivado: true }),
      ],
      [{ id: "e1", nome: "Urgente", cor: "rosa" }], "Sem nome");
    expect(txt).toBe(`# Trabalho

## A fazer (1)

- [ ] Relatório (entrega 15/11/2026 às 14:30 · Urgente)
    Ver dados
    Revisar
    Passos:
    - [x] Tabela

## Feito (1)

- [x] Planilha
`);
  });
  it("coluna vazia aparece como vazia", () => {
    expect(quadroEmTexto("Q", [col("a", "", 1)], [], [], "Sem nome")).toContain("## Sem nome (0)\n\n_(vazia)_");
  });
});
