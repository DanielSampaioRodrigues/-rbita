import { describe, expect, it } from "vitest";
import { CAPA_NA_PAGINA, capaNaPagina, cenaDaCapaAntiga, tituloDaCapa } from "./capa";

describe("capa como primeira página", () => {
  it("marca do caderno com a capa na página", () => {
    expect(capaNaPagina(CAPA_NA_PAGINA)).toBe(true);
    expect(capaNaPagina("")).toBe(false);
    expect(capaNaPagina('{"titulo":{"texto":"x"}}')).toBe(false);
  });

  it("o nome vira um texto grande e centralizado, sem HTML de fora", () => {
    const t = tituloDaCapa("Diário <b>", 794, 1123);
    expect(t.alinhamento).toBe("centro");
    expect(t.texto).toBe("<p><strong>Diário &lt;b&gt;</strong></p>");
    expect(t.x + t.largura / 2).toBeCloseTo(397);
  });

  it("título e traços da capa antiga vão para a página na mesma posição", () => {
    const cena = cenaDaCapaAntiga({
      titulo: { texto: "Faculdade", x: 0.5, y: 0.25, tamanho: 0.1, cor: "#ff0000", negrito: true, alinhamento: "centro" },
      tracos: [{ tipo: "traco", id: "a", ferramenta: "caneta", cor: "#fff", espessura: 3, pontos: [{ x: 150, y: 200, p: 0.5 }] }],
    }, "Faculdade", 794, 1123);
    const traco = cena.elementos.find((e) => e.tipo === "traco");
    const texto = cena.elementos.find((e) => e.tipo === "texto");
    expect(traco && traco.tipo === "traco" && traco.pontos[0].x).toBeCloseTo(397);
    expect(traco && traco.tipo === "traco" && traco.pontos[0].y).toBeCloseTo(561.5);
    expect(texto && texto.tipo === "texto" && texto.cor).toBe("#ff0000");
    expect(texto && texto.tipo === "texto" && texto.tamanho).toBe(112);
    // Capa antiga vazia: o nome do caderno entra como título.
    expect(cenaDaCapaAntiga({}, "Ideias", 794, 1123).elementos[0].tipo).toBe("texto");
  });
});

describe("sem capa de propósito", () => {
  it("não é confundido com caderno antigo", async () => {
    const { SEM_CAPA, capaJaDecidida, capaNaPagina } = await import("./capa");
    expect(capaJaDecidida(SEM_CAPA)).toBe(true);
    expect(capaNaPagina(SEM_CAPA)).toBe(false);
    expect(capaJaDecidida("")).toBe(false);
    expect(capaJaDecidida('{"titulo":{"texto":"x"}}')).toBe(false);
  });
});
