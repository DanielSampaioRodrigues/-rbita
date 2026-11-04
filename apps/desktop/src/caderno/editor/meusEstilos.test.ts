// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { extensoesBase } from "./extensoes";
import { aplicarMeuEstilo, cssDosEstilos, ESTILO_VAZIO, estiloDoParagrafo, lerEstilos, regrasDoEstilo, type EstiloProprio } from "./meusEstilos";

const estilo = (p: Partial<EstiloProprio>): EstiloProprio => ({ ...ESTILO_VAZIO, id: "e-1", nome: "Citação longa", ...p });

describe("estilos da pessoa", () => {
  it("lê a lista guardada e descarta o inválido", () => {
    const lista = lerEstilos([
      { id: "e-1", nome: "Bom", tamanho: 14, cor: "#AA0000" },
      { id: "e-1", nome: "Repetido" },
      { id: "MAL ID!", nome: "x" },
      { id: "e-2", nome: "   " },
      { id: "e-3", nome: "Tamanho louco", tamanho: 9999, capitular: 7 },
      "lixo",
    ]);
    expect(lista.map((e) => e.nome)).toEqual(["Bom", "Tamanho louco"]);
    expect(lista[0].cor).toBe("#aa0000");
    expect(lista[1].tamanho).toBe(200);
    expect(lista[1].capitular).toBe(0);
  });
  it("a fonte guardada não consegue fechar a regra do CSS", () => {
    const [e] = lerEstilos([{ id: "e-1", nome: "x", fonte: 'Arial; } body { display: none' }]);
    expect(e.fonte).not.toMatch(/[;{}]/);
    expect(cssDosEstilos([e])).not.toContain("display: none;");
  });
  it("gera as regras só do que o estilo muda", () => {
    expect(regrasDoEstilo(estilo({}))).toBe("");
    const r = regrasDoEstilo(estilo({ tamanho: 10, recuoEsquerda: 4, entrelinha: 1, alinhamento: "justify", negrito: true }));
    expect(r).toContain("font-size: calc(10pt * var(--caderno-escala, 1))");
    expect(r).toContain("margin-left: 4cm");
    expect(r).toContain("line-height: 1");
    expect(r).toContain("text-align: justify");
    expect(r).toContain("font-weight: 700");
  });
  it("capitular no estilo põe a primeira letra grande e tira o recuo", () => {
    const css = cssDosEstilos([estilo({ capitular: 3, recuoPrimeira: 1.25 })]);
    expect(css).toContain("initial-letter: 3");
    expect(css).toContain("text-indent: 0");
    expect(css).not.toContain("text-indent: 1.25cm");
  });
  it("lê a formatação feita à mão num parágrafo e aplica o estilo tirando ela", () => {
    const ed = new Editor({ extensions: extensoesBase(), content: '<h2 style="text-align: center"><span style="font-family: Georgia; font-size: 14pt; color: #991b1b"><strong>Resumo</strong></span></h2><p>outro</p>' });
    const no = ed.state.doc.firstChild!;
    const lido = estiloDoParagrafo(no);
    expect(lido.base).toBe("h2");
    expect(lido.fonte).toBe("Georgia");
    expect(lido.tamanho).toBe(14);
    expect(lido.cor).toBe("#991b1b");
    expect(lido.negrito).toBe(true);
    expect(lido.alinhamento).toBe("center");
    ed.commands.setTextSelection(2);
    aplicarMeuEstilo(ed, estilo({ ...lido, id: "e-9" }));
    const html = ed.getHTML();
    expect(html).toContain('data-meu-estilo="e-9"');
    expect(html).not.toContain("font-family");
    expect(html).toContain("<strong>Resumo</strong>");
    // O outro parágrafo não muda.
    expect(html).toContain("<p>outro</p>");
    ed.destroy();
  });
});
