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
