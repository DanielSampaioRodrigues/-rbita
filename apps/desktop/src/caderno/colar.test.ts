// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { textoParaHtml } from "./colar";

describe("colar texto de fora", () => {
  it("um parágrafo por linha, com os caracteres escapados", () => {
    expect(textoParaHtml("Oi <b>\r\nTudo & bem")).toBe("<p>Oi &lt;b&gt;</p><p>Tudo &amp; bem</p>");
  });
  it("tira linhas vazias do começo e do fim e junta as repetidas", () => {
    expect(textoParaHtml("\n\nA\n\n\n\nB\n\n")).toBe("<p>A</p><p></p><p>B</p>");
  });
});

import { escolherColado, htmlColado, svgLimpo } from "./colar";

describe("colar de tudo", () => {
  it("texto com formatação fica só com as marcas simples", () => {
    expect(htmlColado('<h2 style="color:red">Tema</h2><p><b onclick="x()">forte</b> <a href="javascript:1">link</a></p><script>alert(1)</script>')).toBe("<h2>Tema</h2><p><b>forte</b> link</p>");
    expect(htmlColado("só texto")).toBe("<p>só texto</p>");
  });
  it("SVG perde script e links externos", () => {
    const s = svgLimpo('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><image href="https://x/y.png"/><circle r="4"/></svg>');
    expect(s).not.toContain("script");
    expect(s).not.toContain("https://x");
    expect(s).toContain("circle");
  });
  it("imagem vem antes do texto e fica do jeito que veio (PNG continua PNG)", async () => {
    const png = new File([new Uint8Array([137, 80, 78, 71])], "x.png", { type: "image/png" });
    const c = await escolherColado([png], { "text/plain": async () => "legenda" });
    expect(c.tipo).toBe("imagem");
    if (c.tipo === "imagem") expect(c.blob).toBe(png);
  });
  it("PDF vira páginas; texto puro vira caixa", async () => {
    const pdf = new File([new Uint8Array([1])], "aula.pdf", { type: "application/pdf" });
    expect((await escolherColado([pdf], {})).tipo).toBe("pdf");
    expect(await escolherColado([], { "text/plain": async () => "oi" })).toEqual({ tipo: "texto", texto: "oi" });
  });
});
