import { describe, expect, it } from "vitest";
import { acaoDaTecla, canetaApagando, ehEspaco } from "./atalhosCaderno";

const tecla = (key: string, m: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean; repeat: boolean }> = {}) =>
  ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, repeat: false, ...m });

describe("atalhos do caderno", () => {
  it("letras escolhem a ferramenta; com Shift, as variações", () => {
    expect(acaoDaTecla(tecla("p"))).toEqual({ tipo: "ferramenta", ferramenta: "caneta" });
    expect(acaoDaTecla(tecla("E"))).toEqual({ tipo: "ferramenta", ferramenta: "borracha" });
    expect(acaoDaTecla(tecla("T", { shiftKey: true }))).toEqual({ tipo: "ferramenta", ferramenta: "nota" });
    expect(acaoDaTecla(tecla("U", { shiftKey: true }))).toEqual({ tipo: "ferramenta", ferramenta: "seta" });
    expect(acaoDaTecla(tecla("h"))).toEqual({ tipo: "maoFixa" });
  });
  it("Ctrl+D duplica; Alt, tecla repetida e Ctrl+letra comum não fazem nada", () => {
    expect(acaoDaTecla(tecla("d", { ctrlKey: true }))).toEqual({ tipo: "duplicar" });
    expect(acaoDaTecla(tecla("p", { ctrlKey: true }))).toBeNull();
    expect(acaoDaTecla(tecla("p", { altKey: true }))).toBeNull();
    expect(acaoDaTecla(tecla("p", { repeat: true }))).toBeNull();
    expect(acaoDaTecla(tecla("q"))).toBeNull();
  });
  it("Home e End vão à primeira e à última página", () => {
    expect(acaoDaTecla(tecla("Home"))).toEqual({ tipo: "primeira" });
    expect(acaoDaTecla(tecla("End"))).toEqual({ tipo: "ultima" });
  });
  it("espaço e caneta apagando", () => {
    expect(ehEspaco({ key: " ", code: "Space" })).toBe(true);
    expect(ehEspaco({ key: "a", code: "KeyA" })).toBe(false);
    expect(canetaApagando({ pointerType: "pen", button: 5, buttons: 32 })).toBe(true);
    expect(canetaApagando({ pointerType: "pen", button: 0, buttons: 3 })).toBe(true);
    expect(canetaApagando({ pointerType: "pen", button: 0, buttons: 1 })).toBe(false);
    expect(canetaApagando({ pointerType: "mouse", button: 2, buttons: 2 })).toBe(false);
  });
});
