import { TEMAS, type Tema } from "@orbita/temas";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aplicarAparencia, definirPreviaTema, forcarTrava } from "./aparencia";
import { PADRAO } from "./preferencias";

// Um <html> de mentira: guarda as variáveis CSS e os data-*.
function raizFalsa() {
  const vars = new Map<string, string>();
  return { vars, el: { style: { setProperty: (k: string, v: string) => vars.set(k, v) }, dataset: {} as Record<string, string> } as unknown as HTMLElement };
}

const escuro = (sim: boolean) => {
  vi.stubGlobal("window", { matchMedia: (q: string) => ({ matches: sim && q.includes("dark"), addEventListener() {}, removeEventListener() {} }) });
  vi.stubGlobal("document", { documentElement: raizFalsa().el });
};

const papel = TEMAS.find((x) => x.id === "papel")!;
const meu: Tema = { ...papel, id: "proprio-teste", nome: "Meu", claro: { ...papel.claro, fundo: "#ffeedd" }, escuro: { ...papel.escuro, fundo: "#112233" } };

afterEach(() => {
  definirPreviaTema(null);
  vi.unstubAllGlobals();
});

describe("aparência", () => {
  it("tema criado vale na hora, no modo que está na tela", () => {
    escuro(true);
    forcarTrava(false);
    const { vars, el } = raizFalsa();
    aplicarAparencia({ ...PADRAO, semTrava: true, temasProprios: [meu], tema: meu.id }, el);
    expect(vars.get("--cor-fundo")).toBe("#112233");
  });

  it("o tema em edição aparece no app inteiro antes de salvar", () => {
    escuro(false);
    forcarTrava(false);
    const { vars, el } = raizFalsa();
    aplicarAparencia({ ...PADRAO, semTrava: true }, el);
    expect(vars.get("--cor-fundo")).toBe(papel.claro.fundo);
    definirPreviaTema(meu, papel);
    // A prévia reaplica sozinha no <html> de verdade; aqui confere pela mesma regra.
    aplicarAparencia({ ...PADRAO, semTrava: true }, el);
    expect(vars.get("--cor-fundo")).toBe("#ffeedd");
  });
});
