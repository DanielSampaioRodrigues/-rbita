// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { arrumarMapa, elementosDoMapa, lerMapa } from "./mapaMental";

const html = "<ul><li>Neurônio<ul><li>Dendritos<ul><li>recebem sinais</li></ul></li><li>Axônio</li><li>Sinapse</li><li>Corpo celular</li></ul></li></ul>";

describe("mapa mental", () => {
  it("lê a lista aninhada da IA", () => {
    const m = lerMapa(html)!;
    expect(m.texto).toBe("Neurônio");
    expect(m.filhos.map((f) => f.texto)).toEqual(["Dendritos", "Axônio", "Sinapse", "Corpo celular"]);
    expect(m.filhos[0].filhos[0].texto).toBe("recebem sinais");
    expect(lerMapa("<ul><li>A</li><li>B</li></ul>")!.texto).toBe("Mapa mental");
    expect(lerMapa("<p>sem lista</p>")).toBeNull();
  });
  it("tema no meio, ramos dos dois lados e tudo dentro da página", () => {
    let n = 0;
    const { caixas, ligacoes } = arrumarMapa(lerMapa(html)!, 1123, 794, () => `id${n++}`);
    expect(caixas).toHaveLength(6);
    expect(ligacoes).toHaveLength(5);
    const raiz = caixas[0];
    // O mapa inteiro fica no meio da página.
    const minX = Math.min(...caixas.map((c) => c.x)), maxX = Math.max(...caixas.map((c) => c.x + c.w));
    expect(Math.abs((minX + maxX) / 2 - 1123 / 2)).toBeLessThan(2);
    const ramos = caixas.filter((c) => c.nivel === 1);
    expect(ramos.some((c) => c.x > raiz.x + raiz.w)).toBe(true);
    expect(ramos.some((c) => c.x + c.w < raiz.x)).toBe(true);
    for (const c of caixas) {
      expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(1123); expect(c.y + c.h).toBeLessThanOrEqual(794);
    }
  });
  it("vira caixas de texto e retas presas a elas", () => {
    let n = 0;
    const els = elementosDoMapa(lerMapa(html)!, 1123, 794, () => `id${n++}`);
    const retas = els.filter((e) => e.tipo === "forma");
    expect(retas).toHaveLength(5);
    expect(retas.every((r) => r.tipo === "forma" && r.forma === "reta" && r.ligaInicio && r.ligaFim)).toBe(true);
    expect(els.filter((e) => e.tipo === "texto")).toHaveLength(6);
  });
});
