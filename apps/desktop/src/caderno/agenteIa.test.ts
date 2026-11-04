// @vitest-environment jsdom
import type { Cena, Texto, Traco } from "@orbita/caderno";
import { describe, expect, it } from "vitest";
import { aplicarNasCenas, arranjoDasPaginas, descreverCaderno, htmlDoAgente, lerMudancas, type PaginaParaIa } from "./agenteIa";

const letra = (id: string, x: number, y: number): Traco => ({ tipo: "traco", id, ferramenta: "caneta", cor: "#1f2937", espessura: 2, pontos: [{ x, y, p: 0.5 }, { x: x + 12, y: y + 20, p: 0.5 }] } as Traco);
const caixa: Texto = { tipo: "texto", id: "cx-real", x: 50, y: 300, largura: 300, texto: "<p>Sinapse</p>", cor: "#000000", tamanho: 20 };
const paginas: PaginaParaIa[] = [
  { id: "p1", titulo: "Aula", texto: false, modelo: "pautado", largura: 794, altura: 1123, marcada: false },
  { id: "p2", titulo: "", texto: true, modelo: "liso", largura: 794, altura: 1123, marcada: false },
];
const cenas: Record<string, Cena> = { p1: { elementos: [letra("a", 100, 100), letra("b", 114, 100), caixa] }, p2: { elementos: [], documento: "<p>Resumo antigo</p>" } };

describe("IA com liberdade total no caderno", () => {
  it("descreve o caderno com ids curtos (a escrita vai agrupada em palavras)", () => {
    const { descricao, mapa } = descreverCaderno(paginas, cenas, "p1", false, [], "Neuro");
    const d = JSON.parse(descricao);
    expect(d.pagina_atual).toBe(1);
    const els = d.paginas[0].elementos;
    expect(els.map((e: { tipo: string }) => e.tipo).sort()).toEqual(["caixa", "escrita"]);
    const escrita = els.find((e: { tipo: string }) => e.tipo === "escrita");
    expect(mapa.get(escrita.id)?.ids).toEqual(["a", "b"]);
    // Página que não é a atual vai só em resumo.
    expect(d.paginas[1].elementos).toBeUndefined();
    expect(d.paginas[1].resumo).toBe("Resumo antigo");
  });
  it("confere o plano: tira o que não existe e limpa o HTML", () => {
    const { mapa } = descreverCaderno(paginas, cenas, "p1", true, [], "Neuro");
    const m = lerMudancas([
      { op: "apagar", id: "e999" },
      { op: "nova_pagina", depois: 1, html: '<p style="color:#ff0000; position:fixed">Oi<script>x()</script></p><img src=x onerror=y>' },
      { op: "texto_da_pagina", pagina: 7, html: "<p>x</p>" },
      { op: "inventada" },
      { op: "cor", id: "e1", cor: "azul" },
    ], 2, mapa);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ op: "nova_pagina", depois: 1 });
    const html = (m[0] as { html: string }).html;
    expect(html).toContain("color:#ff0000");
    expect(html).not.toContain("position");
    expect(html).not.toContain("script");
    expect(html).not.toContain("img");
  });
  it("aplica nas cenas: texto da página, caixa nova, mover e apagar uma palavra", () => {
    const { mapa } = descreverCaderno(paginas, cenas, "p1", true, [], "Neuro");
    const idEscrita = [...mapa.entries()].find(([, v]) => v.ids.length === 2)![0];
    const idCaixa = [...mapa.entries()].find(([, v]) => v.ids[0] === "cx-real")![0];
    const mud = lerMudancas([
      { op: "texto_da_pagina", pagina: 1, html: "<h1>Neurônio</h1>" },
      { op: "nova_caixa", pagina: 2, html: "<p>Nova</p>", x: 10, y: 20, largura: 200 },
      { op: "mover", id: idCaixa, x: 400, y: 500 },
      { op: "apagar", id: idEscrita },
    ], 2, mapa);
    let n = 0;
    const r = aplicarNasCenas(mud, paginas, cenas, mapa, () => `novo${n++}`);
    expect(r.cenas.p1.documento).toBe("<h1>Neurônio</h1>");
    expect(r.viraTexto.has("p1")).toBe(true);
    expect(r.cenas.p1.elementos.map((e) => e.id)).toEqual(["cx-real"]);
    expect(r.cenas.p1.elementos[0]).toMatchObject({ x: 400, y: 500 });
    expect(r.cenas.p2.elementos[0]).toMatchObject({ id: "novo0", x: 10, y: 20 });
    // O original não foi mexido (dá para desfazer).
    expect(cenas.p1.elementos).toHaveLength(3);
  });
  it("estilo perigoso some do HTML", () => {
    expect(htmlDoAgente('<span style="background-color: url(http://x)">a</span>')).not.toContain("url(");
  });
});

describe("arranjoDasPaginas", () => {
  const pgs = [{ id: "a", ordem: 1 }, { id: "b", ordem: 2 }, { id: "c", ordem: 3 }];
  it("página nova entra logo depois da página pedida, sem mexer nas outras", () => {
    const r = arranjoDasPaginas(pgs, [{ op: "nova_pagina", depois: 1, html: "<p>x</p>" }, { op: "mapa", depois: 1, html: "<ul></ul>" }]);
    expect(r.ordens.size).toBe(0);
    const [x, y] = [r.novas.get(0)!, r.novas.get(1)!];
    expect(1 < x && x < y && y < 2).toBe(true);
  });
  it("no começo e no fim, e nunca ordem 0", () => {
    const r = arranjoDasPaginas(pgs, [{ op: "nova_pagina", depois: 0, html: "<p>x</p>" }, { op: "nova_pagina", depois: 3, html: "<p>y</p>" }]);
    expect(r.novas.get(0)! < 1 && r.novas.get(0)! !== 0).toBe(true);
    expect(r.novas.get(1)).toBe(4);
    const z = arranjoDasPaginas([{ id: "a", ordem: 0.000001 }], [{ op: "nova_pagina", depois: 0, html: "<p>x</p>" }]);
    expect(z.novas.get(0)).not.toBe(0);
  });
  it("mover renumera e os números são os de antes das mudanças", () => {
    const r = arranjoDasPaginas(pgs, [{ op: "mover_pagina", pagina: 3, para: 1 }, { op: "nova_pagina", depois: 1, html: "<p>x</p>" }, { op: "apagar_pagina", pagina: 2 }]);
    // c, a, nova  (b apagada)
    expect(r.apagadas).toEqual(["b"]);
    expect(r.ordens.get("c")).toBe(1);
    expect(r.ordens.get("a")).toBe(2);
    expect(r.novas.get(1)).toBe(3);
  });
});
