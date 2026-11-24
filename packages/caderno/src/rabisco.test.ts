import { describe, expect, it } from "vitest";
import { apagarComRabisco, contorno, ehRabisco } from "./rabisco";
import type { Ponto2 } from "./selecao";
import type { Elemento, Traco } from "./tipos";

/** Zigue-zague de `passadas` idas e vindas, de x0 a x1, descendo um pouco a cada passada. */
function zigue(x0: number, x1: number, y: number, passadas: number, passo = 6): Ponto2[] {
  const pts: Ponto2[] = [];
  for (let k = 0; k < passadas; k++) {
    const de = k % 2 === 0 ? x0 : x1, ate = k % 2 === 0 ? x1 : x0;
    for (let i = 0; i <= 12; i++) pts.push([de + ((ate - de) * i) / 12, y + k * passo + (passo * i) / 12]);
  }
  return pts;
}
const traco = (id: string, pontos: [number, number][], extra: Partial<Traco> = {}): Traco =>
  ({ tipo: "traco", id, ferramenta: "caneta", cor: "#000000", espessura: 3, pontos: pontos.map(([x, y]) => ({ x, y, p: 1 })), ...extra });
/** Uma linha de escrita: ondinha de x0 a x1 na altura y. */
const linha = (id: string, x0: number, x1: number, y: number) => {
  const pts: [number, number][] = [];
  for (let x = x0; x <= x1; x += 4) pts.push([x, y + Math.sin(x / 6) * 5]);
  return traco(id, pts);
};
let n = 0;
const novoId = () => `novo-${++n}`;

describe("ehRabisco", () => {
  it("reconhece o zigue-zague de cinco passadas", () => {
    expect(ehRabisco(zigue(100, 220, 100, 5))).toBe(true);
    expect(ehRabisco(zigue(100, 220, 100, 9))).toBe(true);
  });

  it("zigue-zague na diagonal e em pé também valem", () => {
    const diag = zigue(0, 100, 0, 6).map(([x, y]) => [x + y * 2, y * 3 + x * 0.6] as Ponto2);
    expect(ehRabisco(diag)).toBe(true);
    const emPe = zigue(0, 100, 0, 6).map(([x, y]) => [y, x] as Ponto2);
    expect(ehRabisco(emPe)).toBe(true);
  });

  it("rabisco em espiral (três voltas) vale", () => {
    const pts: Ponto2[] = [];
    for (let a = 0; a <= Math.PI * 7; a += 0.2) pts.push([200 + Math.cos(a) * (30 + a), 200 + Math.sin(a) * (16 + a)]);
    expect(ehRabisco(pts)).toBe(true);
  });

  it("letras e traços comuns não são rabisco", () => {
    // Um "M" (3 viradas) e um "W".
    const m: Ponto2[] = [];
    const cantos: Ponto2[] = [[0, 40], [10, 0], [20, 30], [30, 0], [40, 40]];
    for (let i = 0; i < cantos.length - 1; i++) for (let k = 0; k <= 8; k++) m.push([cantos[i][0] + ((cantos[i + 1][0] - cantos[i][0]) * k) / 8, cantos[i][1] + ((cantos[i + 1][1] - cantos[i][1]) * k) / 8]);
    expect(ehRabisco(m)).toBe(false);
    expect(ehRabisco(m.map(([x, y]) => [x, 40 - y] as Ponto2))).toBe(false);
    // Uma linha reta, um sublinhado ondulado e um círculo.
    expect(ehRabisco(Array.from({ length: 30 }, (_, i) => [i * 5, 10] as Ponto2))).toBe(false);
    expect(ehRabisco(Array.from({ length: 60 }, (_, i) => [i * 4, 10 + Math.sin(i / 3) * 6] as Ponto2))).toBe(false);
    expect(ehRabisco(Array.from({ length: 40 }, (_, i) => [Math.cos((i / 39) * Math.PI * 2) * 30, Math.sin((i / 39) * Math.PI * 2) * 30] as Ponto2))).toBe(false);
    // Três passadas só (duas viradas): riscou pouco.
    expect(ehRabisco(zigue(100, 220, 100, 3))).toBe(false);
  });

  it("traço curto demais ou minúsculo não conta", () => {
    expect(ehRabisco([[0, 0], [1, 1]])).toBe(false);
    expect(ehRabisco(zigue(0, 6, 0, 6, 1))).toBe(false);
  });
});

describe("contorno", () => {
  it("devolve o fecho convexo", () => {
    const c = contorno([[0, 0], [10, 0], [10, 10], [0, 10], [5, 5], [2, 8]]);
    expect(c).toHaveLength(4);
    expect(c).toEqual(expect.arrayContaining([[0, 0], [10, 0], [10, 10], [0, 10]]));
  });
});

describe("apagarComRabisco", () => {
  it("apaga a escrita coberta e deixa a de fora", () => {
    const pagina: Elemento[] = [linha("a", 100, 220, 115), linha("b", 100, 220, 300)];
    const r = apagarComRabisco(pagina, zigue(95, 225, 100, 6), novoId);
    expect(r.apagou).toBe(true);
    expect(r.elementos.map((e) => e.id)).toEqual(["b"]);
  });

  it("leva junto o pingo do i que está embaixo do rabisco", () => {
    const pingo = traco("pingo", [[150, 104], [150.5, 104.5]]);
    const r = apagarComRabisco([linha("a", 100, 220, 118), pingo], zigue(95, 225, 100, 6), novoId);
    expect(r.elementos).toHaveLength(0);
  });

  it("traço coberto em parte perde só a parte coberta", () => {
    const comprida = linha("c", 0, 600, 115);
    const r = apagarComRabisco([comprida], zigue(200, 320, 100, 6), novoId);
    expect(r.apagou).toBe(true);
    expect(r.elementos).toHaveLength(2);
    const xs = r.elementos.flatMap((e) => (e as Traco).pontos.map((p) => p.x));
    expect(xs.some((x) => x > 205 && x < 315)).toBe(false);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(600);
    // Os dois pedaços têm ids diferentes.
    expect(new Set(r.elementos.map((e) => e.id)).size).toBe(2);
  });

  it("rabisco em área vazia não apaga nada (é desenho)", () => {
    const pagina: Elemento[] = [linha("b", 100, 220, 300)];
    const r = apagarComRabisco(pagina, zigue(95, 225, 100, 6), novoId);
    expect(r.apagou).toBe(false);
    expect(r.elementos).toBe(pagina);
  });

  it("só encostar na ponta de um traço não apaga", () => {
    const pagina: Elemento[] = [linha("c", 222, 500, 112)];
    const r = apagarComRabisco(pagina, zigue(95, 225, 100, 6), novoId);
    expect(r.apagou).toBe(false);
  });

  it("um rabisco pequeno apaga um pingo solto; um rabisco grande que só pega um pingo não", () => {
    const pingo = traco("pingo", [[150, 104], [150.5, 104.5]]);
    expect(apagarComRabisco([pingo], zigue(142, 158, 98, 6, 2), novoId).apagou).toBe(true);
    expect(apagarComRabisco([pingo], zigue(95, 225, 90, 6), novoId).apagou).toBe(false);
  });

  it("palavra escrita perto de outra, pegando só as pernas das letras de cima, não apaga", () => {
    // Três "pernas" de 9 px da linha de cima entram na área do traço novo.
    const pernas: Elemento[] = [120, 160, 200].map((x, i) => traco(`p${i}`, [[x, 80], [x, 92], [x, 101]]));
    const r = apagarComRabisco(pernas, zigue(95, 225, 96, 6), novoId);
    expect(r.apagou).toBe(false);
  });

  it("não mexe em texto, forma nem imagem", () => {
    const forma: Elemento = { tipo: "forma", id: "f", forma: "retangulo", x1: 110, y1: 105, x2: 200, y2: 125, cor: "#000000", espessura: 2 };
    const r = apagarComRabisco([linha("a", 100, 220, 115), forma], zigue(95, 225, 100, 6), novoId);
    expect(r.elementos.map((e) => e.id)).toEqual(["f"]);
  });
});
