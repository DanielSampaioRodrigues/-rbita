import { describe, expect, it } from "vitest";
import type { Atividade } from "../api";
import { extrasVazios, gravarExtras, lerExtras, normalizarExtras } from "./extras";
import { mediasPorBimestre } from "./media";
import { aceitaNota, bimestreDaData, diaDaSemana, diasAte, perfilDoNivel, tipoMostrado, tipoNativo } from "./nivel";
import { textos } from "../textos/pt-BR";

class Memoria implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe("nível de estudo", () => {
  it("escola usa bimestre e notas; faculdade, créditos; pós, pesquisa", () => {
    expect(perfilDoNivel("fundamental")).toMatchObject({ periodo: "bimestre", notas: true, creditos: false, pesquisa: false, vocabulario: "materia" });
    expect(perfilDoNivel("medio").periodo).toBe("bimestre");
    expect(perfilDoNivel("graduacao")).toMatchObject({ periodo: "semestre", creditos: true, pesquisa: false, vocabulario: "disciplina" });
    expect(perfilDoNivel("pos")).toMatchObject({ pesquisa: true, notas: false });
    expect(perfilDoNivel("todos")).toMatchObject({ notas: true, creditos: true, pesquisa: true });
  });

  it("leitura e entrega viram tipos que a parte nativa aceita, e voltam", () => {
    expect(tipoNativo("leitura")).toBe("dever");
    expect(tipoNativo("entrega")).toBe("trabalho");
    expect(tipoNativo("prova")).toBe("prova");
    expect(tipoMostrado("dever", "leitura")).toBe("leitura");
    expect(tipoMostrado("trabalho", "entrega")).toBe("entrega");
    // Extra que não combina com o nativo (dado antigo) é ignorado.
    expect(tipoMostrado("prova", "leitura")).toBe("prova");
    expect(tipoMostrado("dever", undefined)).toBe("dever");
    expect(aceitaNota("leitura")).toBe(false);
    expect(aceitaNota("entrega")).toBe(true);
  });

  it("conta os dias de forma literal", () => {
    expect(diasAte("2026-10-29", "2026-10-29")).toBe(0);
    expect(diasAte("2026-10-29", "2026-11-01")).toBe(3);
    expect(diasAte("2026-10-29", "2026-10-27")).toBe(-2);
    expect(diasAte("2026-12-31", "2027-01-01")).toBe(1);
    expect(textos.estudos.contagem(0)).toBe("hoje");
    expect(textos.estudos.contagem(1)).toBe("amanhã");
    expect(textos.estudos.contagem(3)).toBe("em 3 dias");
    expect(textos.estudos.contagem(-2)).toBe("foi há 2 dias");
    expect(diaDaSemana("2026-10-29")).toBe(4); // quinta
  });

  it("sugere o bimestre pela data", () => {
    expect(bimestreDaData("2026-03-10")).toBe(1);
    expect(bimestreDaData("2026-06-10")).toBe(2);
    expect(bimestreDaData("2026-09-01")).toBe(3);
    expect(bimestreDaData("2026-11-20")).toBe(4);
    expect(bimestreDaData("2026-01-15")).toBe(4);
  });
});

describe("extras do módulo", () => {
  it("guarda e lê de volta; sem nada guardado, nível fica em aberto", () => {
    const arm = new Memoria();
    expect(lerExtras(arm).nivel).toBeUndefined();
    const e = extrasVazios();
    e.nivel = "pos";
    e.materias.m1 = { creditos: 4, periodo: "2026.2" };
    e.atividades.a1 = { tipo: "leitura", bimestre: null };
    e.pesquisa.orientador = "Profa. Ana";
    e.pesquisa.reunioes.push({ id: "r1", data: "2026-11-03", pauta: "Capítulo 2", combinado: "" });
    gravarExtras(e, arm);
    const lido = lerExtras(arm);
    expect(lido.nivel).toBe("pos");
    expect(lido.materias.m1.creditos).toBe(4);
    expect(lido.atividades.a1.tipo).toBe("leitura");
    expect(lido.pesquisa.reunioes[0].pauta).toBe("Capítulo 2");
  });

  it("dado estranho vira padrão, sem quebrar", () => {
    const arm = new Memoria();
    arm.setItem("orbita.academico.extras", "{não é json");
    expect(lerExtras(arm)).toEqual(extrasVazios());
    const n = normalizarExtras({
      nivel: "doutorado",
      atividades: { a: { tipo: "outro", bimestre: 9 } },
      pesquisa: { leituras: [{ id: "l", titulo: "X", status: "qualquer" }, { titulo: "sem id" }] },
    });
    expect(n.nivel).toBeUndefined();
    expect(n.atividades.a).toEqual({ tipo: undefined, bimestre: null });
    expect(n.pesquisa.leituras).toEqual([{ id: "l", titulo: "X", referencia: "", status: "aLer" }]);
  });
});

describe("notas por bimestre", () => {
  const at = (over: Partial<Atividade>): Atividade => ({ id: "a", materiaId: "m", tipo: "prova", titulo: "t", data: "", peso: null, nota: null, feita: false, criadoEm: 0, ...over });

  it("separa por bimestre e soma o ano", () => {
    const lista = [at({ id: "1", nota: 8, data: "2026-03-01" }), at({ id: "2", nota: 6, data: "2026-03-20" }), at({ id: "3", nota: 10, data: "2026-06-01" }), at({ id: "4", nota: 4 })];
    const de = (a: Atividade) => (a.data ? bimestreDaData(a.data) : null);
    const m = mediasPorBimestre(lista, de);
    expect(m[0]).toBe(7);
    expect(m[1]).toBe(10);
    expect(m[2]).toBeNull();
    expect(m[3]).toBeNull();
    expect(m[4]).toBe(7); // (8+6+10+4)/4
  });
});
