import { describe, expect, it } from "vitest";
import { caminhoDeTraco, caminhoSVG, tracoAtingido, type Traco } from "./index";

const traco = (pontos: [number, number][], ferramenta: Traco["ferramenta"] = "caneta"): Traco => ({
  tipo: "traco", id: "1", ferramenta, cor: "#000", espessura: 0, pontos: pontos.map(([x, y]) => ({ x, y, p: 0.5 })),
});

describe("caderno: traços (perfect-freehand)", () => {
  it("caminhoSVG começa com M e fecha", () => {
    expect(caminhoSVG([])).toBe("");
    const d = caminhoSVG([[0, 0], [10, 0], [10, 10]]);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
  });

  it("caminhoDeTraco gera um caminho de um rabisco", () => {
    const d = caminhoDeTraco(traco([[0, 0], [20, 10], [40, 0], [60, 20]]));
    expect(d.startsWith("M ")).toBe(true);
    expect(d.length).toBeGreaterThan(20);
  });

  it("borracha: acerta quem passa perto e erra quem está longe", () => {
    const t = traco([[0, 0], [100, 0]]);
    expect(tracoAtingido(t, 50, 3, 6)).toBe(true); // 3px da linha, raio 6
    expect(tracoAtingido(t, 50, 40, 6)).toBe(false); // longe
    expect(tracoAtingido(t, 50, 40, 60)).toBe(true); // raio grande acerta
  });

  it("borracha acerta um ponto isolado", () => {
    const t = traco([[10, 10]]);
    expect(tracoAtingido(t, 12, 12, 5)).toBe(true);
    expect(tracoAtingido(t, 30, 30, 5)).toBe(false);
  });
});
