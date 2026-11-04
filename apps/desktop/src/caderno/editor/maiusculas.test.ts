// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { aplicarCaixa, mudarCaixa, proximaCaixa, Versalete } from "./maiusculas";

describe("mudarCaixa", () => {
  it("maiúsculas e minúsculas com acento", () => {
    expect(mudarCaixa("ação é útil", "maiusculas")).toBe("AÇÃO É ÚTIL");
    expect(mudarCaixa("AÇÃO É ÚTIL", "minusculas")).toBe("ação é útil");
  });
  it("primeira letra da frase", () => {
    expect(mudarCaixa("O ALUNO CHEGOU. ELE SENTOU! e saiu?", "frase")).toBe("O aluno chegou. Ele sentou! E saiu?");
    // No meio da frase, nada vira maiúscula.
    expect(mudarCaixa("ALUNO", "frase", "Chegou o ")).toBe("aluno");
    expect(mudarCaixa("ALUNO", "frase", "Chegou. ")).toBe("Aluno");
  });
  it("iniciais maiúsculas, com as palavras pequenas em minúscula no meio", () => {
    expect(mudarCaixa("o senhor dos anéis e a sociedade do anel", "iniciais")).toBe("O Senhor dos Anéis e a Sociedade do Anel");
    expect(mudarCaixa("DE VOLTA PARA CASA", "iniciais")).toBe("De Volta para Casa");
    expect(mudarCaixa("d'água", "iniciais")).toBe("D'água");
    // Depois de um ponto, começa de novo (com maiúscula mesmo sendo "um").
    expect(mudarCaixa("o fim. um livro de tolkien", "iniciais")).toBe("O Fim. Um Livro de Tolkien");
    expect(mudarCaixa("de tolkien", "iniciais", "Um livro ")).toBe("de Tolkien");
  });
  it("inverter", () => {
    expect(mudarCaixa("Órbita", "inverter")).toBe("óRBITA");
  });
  it("o atalho passa por minúsculas, iniciais e maiúsculas", () => {
    expect(proximaCaixa("casa azul")).toBe("iniciais");
    expect(proximaCaixa("Casa Azul")).toBe("maiusculas");
    expect(proximaCaixa("CASA AZUL")).toBe("minusculas");
    expect(proximaCaixa("cASA")).toBe("minusculas");
  });
});

describe("aplicarCaixa no editor", () => {
  const novo = (html: string) => new Editor({ extensions: [StarterKit, Versalete], content: html });
  it("muda a caixa sem perder o negrito e o itálico", () => {
    const ed = novo("<p>um <strong>texto</strong> <em>bonito</em></p>");
    ed.commands.selectAll();
    aplicarCaixa(ed, "maiusculas");
    expect(ed.getHTML()).toBe("<p>UM <strong>TEXTO</strong> <em>BONITO</em></p>");
    ed.destroy();
  });
  it("sem seleção, muda a palavra do cursor", () => {
    const ed = novo("<p>casa azul</p>");
    ed.commands.setTextSelection(3); // dentro de "casa"
    aplicarCaixa(ed, "maiusculas");
    expect(ed.getHTML()).toBe("<p>CASA azul</p>");
    ed.destroy();
  });
  it("versalete vai e volta do HTML", () => {
    const ed = novo('<p><span style="font-variant: small-caps">Silva</span></p>');
    expect(ed.getHTML()).toContain("small-caps");
    ed.destroy();
  });
});
