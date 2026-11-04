// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO } from "../caderno/editor/estilos";
import { gerarDocx } from "./docx";
import { markdown, textoSimples } from "./documento";
import { nomeDeArquivo } from "./entregar";
import { escolherFamilia, familiasDaPilha } from "./fontesPdf";
import { anguloDoDegrade, separarCamadas } from "./fundos";
import { caminhoDeElemento, caminhoRetangulo, compor, lerCor } from "./medir";
import { gerarPdf } from "./pdf";

describe("exportar: contas da medição", () => {
  it("lê as cores do CSS calculado", () => {
    expect(lerCor("rgb(255, 0, 0)")).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(lerCor("rgba(0, 0, 0, 0.5)").a).toBe(0.5);
    expect(lerCor("color(srgb 0.5 0.25 1 / 50%)")).toEqual({ r: 0.5, g: 0.25, b: 1, a: 0.5 });
    expect(lerCor("#fff")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(lerCor("none").a).toBe(0);
  });
  it("compõe matrizes (aplica a da direita primeiro)", () => {
    const escala = [2, 0, 0, 2, 0, 0] as const;
    const mover = [1, 0, 0, 1, 10, 5] as const;
    expect(compor([...escala], [...mover])).toEqual([2, 0, 0, 2, 20, 10]);
  });
  it("faz os caminhos SVG das formas", () => {
    expect(caminhoRetangulo(0, 0, 10, 5)).toBe("M0 0H10V5H0Z");
    expect(caminhoRetangulo(0, 0, 10, 10, 2)).toContain("A2 2");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "line");
    svg.setAttribute("x1", "1"); svg.setAttribute("y1", "2"); svg.setAttribute("x2", "3"); svg.setAttribute("y2", "4");
    expect(caminhoDeElemento(svg)).toBe("M1 2L3 4");
  });
  it("lê os degradês das capas", () => {
    expect(separarCamadas("linear-gradient(135deg, rgb(1, 2, 3), rgb(4, 5, 6)), url(a.png)")).toHaveLength(2);
    expect(anguloDoDegrade("135deg")).toBe(135);
    expect(anguloDoDegrade("to right")).toBe(90);
    expect(anguloDoDegrade("rgb(1, 2, 3)")).toBeNull();
  });
});

describe("exportar: fontes do PDF", () => {
  it("as fontes das normas entram pelas substitutas de mesma medida", () => {
    expect(familiasDaPilha('"Times New Roman", Times, Tinos, serif')).toEqual(["Times New Roman", "Times", "Tinos", "serif"]);
    expect(escolherFamilia('"Times New Roman", Times, serif').familia).toBe("Tinos");
    expect(escolherFamilia("Arial, sans-serif").familia).toBe("Arimo");
    expect(escolherFamilia("Calibri, Carlito, sans-serif").familia).toBe("Carlito");
    expect(escolherFamilia("monospace").familia).toBe("Cousine");
  });
});

describe("exportar: arquivos", () => {
  it("nome de arquivo seguro", () => {
    expect(nomeDeArquivo("TCC: versão 2/3", "pdf")).toBe("TCC versão 2 3.pdf");
    expect(nomeDeArquivo("   ", "docx")).toBe("Documento.docx");
  });
  it("texto simples e Markdown", async () => {
    expect(textoSimples("<h1>Título</h1><p>um <strong>dois</strong></p>")).toBe("Título\n\num dois\n");
    const md = await markdown("<h1>Título</h1><p>um <strong>dois</strong></p><ul><li><p>item</p></li></ul>");
    expect(md).toContain("# Título");
    expect(md).toContain("**dois**");
    expect(md).toContain("- item");
  });
  it("PDF com o tamanho da página, formas e traços", async () => {
    const r = await gerarPdf([{
      largura: 794, altura: 1123, itens: [
        { tipo: "retangulo", x: 0, y: 0, w: 794, h: 1123, cor: { r: 1, g: 1, b: 0.9, a: 1 } },
        { tipo: "linha", x1: 10, y1: 10, x2: 200, y2: 10, cor: { r: 0, g: 0, b: 0, a: 1 }, largura: 1 },
        { tipo: "caminho", d: "M0 0L10 10", matriz: [1, 0, 0, 1, 50, 50], contorno: { r: 0, g: 0, b: 1, a: 1 }, larguraContorno: 2 },
      ],
    }], { titulo: "Teste" });
    expect(new TextDecoder().decode(r.bytes.slice(0, 5))).toBe("%PDF-");
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(r.bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(596);
    expect(doc.getTitle()).toBe("Teste");
  });
  it("Word com estilos, títulos e listas", async () => {
    const json = { type: "doc", content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introdução" }] },
      { type: "paragraph", attrs: { meuEstilo: "e-1" }, content: [{ type: "text", text: "Texto", marks: [{ type: "bold" }] }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item" }] }] }] },
    ] };
    const blob = await gerarDocx(json, { ...CONFIG_PADRAO, conjunto: "abnt", cabecalho: "Universidade" }, [{ id: "e-1", nome: "Destaque meu", base: "p", fonte: "Georgia", tamanho: 14, cor: "", negrito: false, italico: false, sublinhado: false, caixa: "", alinhamento: "", entrelinha: 0, recuoPrimeira: -1, recuoEsquerda: 0, espacoAntes: -1, espacoDepois: -1, capitular: 0 }], "TCC");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x50); // "PK": é um .docx (zip)
    expect(bytes.length).toBeGreaterThan(3000);
  });
});
