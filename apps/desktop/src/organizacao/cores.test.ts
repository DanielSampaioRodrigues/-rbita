import { describe, expect, it } from "vitest";
import { contraste } from "@orbita/temas";
import { CORES_ORG, PALETA_ORG, coresPara, estiloCor } from "./cores";

describe("organização: cores com contraste garantido", () => {
  it("toda cor, nos dois modos, tem texto e texto suave legíveis (4,5:1)", () => {
    for (const nome of CORES_ORG) {
      for (const fundo of [PALETA_ORG[nome].claro, PALETA_ORG[nome].escuro]) {
        const c = coresPara(fundo);
        expect(contraste(c.texto, c.fundo), `${nome} ${fundo}`).toBeGreaterThanOrEqual(4.5);
        expect(contraste(c.suave, c.fundo), `${nome} ${fundo} (suave)`).toBeGreaterThanOrEqual(4.5);
        expect(contraste(c.texto, c.realce), `${nome} ${fundo} (realce)`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("escolhe texto claro em fundo escuro e escuro em fundo claro", () => {
    expect(coresPara("#1a1a1a").texto).not.toBe(coresPara("#f5f5f5").texto);
    expect(contraste(coresPara("#202020").texto, "#ffffff")).toBeLessThan(2);
  });

  it("sem cor ou cor desconhecida não pinta nada", () => {
    expect(estiloCor("")).toEqual({});
    expect(estiloCor("roxo-neon")).toEqual({});
    expect(Object.keys(estiloCor("menta")).length).toBeGreaterThan(0);
  });
});
