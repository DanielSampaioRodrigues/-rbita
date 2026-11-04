import { describe, expect, it } from "vitest";
import { cabecalhoRodape, CONFIG_PADRAO, CONJUNTOS, lerConfigDocumento, MARGENS, ocorrencias, varsDoConjunto } from "./estilos";

describe("estilos do documento", () => {
  it("ABNT: Times 12, entrelinha 1,5, recuo 1,25 cm, justificado e margens 3-2-3-2", () => {
    const v = varsDoConjunto(CONJUNTOS.abnt);
    expect(v["--doc-tamanho"]).toBe("12pt");
    expect(v["--doc-entrelinha"]).toBe("1.5");
    expect(v["--doc-recuo"]).toBe("1.25cm");
    expect(v["--doc-alinhamento"]).toBe("justify");
    expect(CONJUNTOS.abnt.margens).toEqual(MARGENS.abnt);
  });
  it("lê a configuração guardada com segurança", () => {
    expect(lerConfigDocumento(null)).toEqual(CONFIG_PADRAO);
    const c = lerConfigDocumento({ tamanho: "a5", conjunto: "apa", numero: "xx", margens: { topo: 99, baixo: 1, esquerda: 2, direita: 3 } });
    expect(c.tamanho).toBe("a5");
    expect(c.numero).toBe("baixo-direita");
    expect(c.margens.topo).toBe(2.5);
  });
  it("cabeçalho e rodapé escapam HTML e põem o número onde foi pedido", () => {
    const r = cabecalhoRodape({ ...CONFIG_PADRAO, cabecalho: "<b>Faculdade</b>", numero: "cima-direita" });
    expect(r.headerLeft).toBe("&lt;b&gt;Faculdade&lt;/b&gt;");
    expect(r.headerRight).toBe("{page}");
    expect(r.footerRight).toBe("");
  });
  it("localizar ignora acentos e maiúsculas", () => {
    expect(ocorrencias("Ação, acao e AÇÃO", "acao")).toEqual([0, 6, 13]);
    expect(ocorrencias("abc", "")).toEqual([]);
  });
});
