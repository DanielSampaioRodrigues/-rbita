import { describe, expect, it } from "vitest";
import { caminhoDeTraco, desenhoDeTraco, MODELOS_PINCEL, sorteio, type ModeloPincel, type Traco } from "./index";

const rabisco = (extra: Partial<Traco> = {}): Traco => ({
  tipo: "traco", id: "abc", ferramenta: "pincel", cor: "#000", espessura: 8, pressao: true,
  pontos: Array.from({ length: 30 }, (_x, i) => ({ x: i * 5, y: Math.sin(i / 4) * 20, p: 0.3 + (i % 5) * 0.1 })),
  ...extra,
});

describe("caderno: modelos de pincel", () => {
  it("o sorteio com a mesma semente repete a sequência", () => {
    const a = sorteio(42), b = sorteio(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("todo modelo desenha alguma coisa", () => {
    for (const m of MODELOS_PINCEL) {
      const camadas = desenhoDeTraco(rabisco({ pincel: m as ModeloPincel, semente: 7 }));
      expect(camadas.length).toBeGreaterThan(0);
      expect(camadas.every((c) => c.d.startsWith("M "))).toBe(true);
    }
  });

  it("é determinístico: o mesmo traço sai igual (semente guardada)", () => {
    for (const m of ["giz", "spray", "seco", "aquarela"] as ModeloPincel[]) {
      const d1 = desenhoDeTraco(rabisco({ pincel: m, semente: 99 })).map((c) => c.d).join("|");
      const d2 = desenhoDeTraco(rabisco({ pincel: m, semente: 99 })).map((c) => c.d).join("|");
      const d3 = desenhoDeTraco(rabisco({ pincel: m, semente: 100 })).map((c) => c.d).join("|");
      expect(d1).toBe(d2);
      expect(d1).not.toBe(d3);
    }
  });

  it("traço antigo (sem modelo) continua o pincel redondo de sempre", () => {
    const t = rabisco();
    expect(desenhoDeTraco(t)).toEqual([{ d: caminhoDeTraco(t), modo: "preencher", opacidade: 1 }]);
  });

  it("traço pronto fica em cache (mesmo objeto, mesmo resultado)", () => {
    const t = rabisco({ pincel: "spray", semente: 3 });
    expect(desenhoDeTraco(t)).toBe(desenhoDeTraco(t));
  });

  it("spray: mais pressão, mais pontinhos", () => {
    const comP = (p: number) => desenhoDeTraco(rabisco({ pincel: "spray", semente: 5, pontos: Array.from({ length: 20 }, (_x, i) => ({ x: i * 6, y: 0, p })) }))[0].d.split("M").length;
    expect(comP(0.95)).toBeGreaterThan(comP(0.1));
  });
});

describe("caderno: lápis com a Apple Pencil", () => {
  const largura = (d: string) => {
    const ys = [...d.matchAll(/-?\d+\.\d+/g)].map((m) => Number(m[0])).filter((_n, i) => i % 2 === 1);
    return Math.max(...ys) - Math.min(...ys);
  };
  const lapis = (p: number): Traco => ({
    tipo: "traco", id: "l", ferramenta: "lapis", cor: "#000", espessura: 4, pressao: true,
    pontos: Array.from({ length: 16 }, (_x, i) => ({ x: i * 6, y: 0, p })),
  });
  it("encostando de leve, o traço continua visível (não some)", () => {
    expect(largura(caminhoDeTraco(lapis(0.02)))).toBeGreaterThan(4 * 0.45);
  });
  it("e a pressão ainda engrossa o traço", () => {
    expect(largura(caminhoDeTraco(lapis(0.95)))).toBeGreaterThan(largura(caminhoDeTraco(lapis(0.05))));
  });
  it("desenha em duas camadas (borda e miolo), contínuas", () => {
    const c = desenhoDeTraco(lapis(0.3));
    expect(c).toHaveLength(2);
    expect(c.every((x) => x.modo === "preencher" && (x.d.match(/M /g) ?? []).length === 1)).toBe(true);
  });
});

describe("caderno: pincel ao vivo", () => {
  it("o começo do traço não muda enquanto ele cresce (sem tremer na tela)", () => {
    for (const m of ["spray", "seco", "giz"] as ModeloPincel[]) {
      const pts = Array.from({ length: 40 }, (_x, i) => ({ x: i * 5, y: Math.cos(i / 6) * 15, p: 0.6 }));
      const curto = desenhoDeTraco(rabisco({ pincel: m, semente: 11, pontos: pts.slice(0, 25) }))[0].d;
      const longo = desenhoDeTraco(rabisco({ pincel: m, semente: 11, pontos: pts }))[0].d;
      // Os primeiros pedaços (depois do contorno, no giz) coincidem.
      // No pincel seco, cada cerda é um pedaço que ainda pode crescer: compara o começo da primeira.
      const ini = (d: string) => (m === "seco" ? d.split("M")[1].split(" L ").slice(0, 8).join(" L ") : d.split("M").slice(m === "giz" ? 2 : 1, 12).join("M"));
      expect(ini(longo)).toBe(ini(curto));
    }
  });
});
