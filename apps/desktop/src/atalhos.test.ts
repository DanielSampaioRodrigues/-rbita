import { describe, expect, it } from "vitest";
import { acaoDoEvento, ATALHOS } from "./atalhos";

const tecla = (key: string, mods: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) => ({
  key,
  ctrlKey: !!mods.ctrl,
  metaKey: false,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
});

describe("atalhos", () => {
  it("reconhece os atalhos principais", () => {
    expect(acaoDoEvento(tecla("F1"))).toBe("verAtalhos");
    expect(acaoDoEvento(tecla(",", { ctrl: true }))).toBe("irAjustes");
    expect(acaoDoEvento(tecla("B", { ctrl: true, shift: true }))).toBe("alternarBaixoEstimulo");
    expect(acaoDoEvento(tecla("=", { ctrl: true }))).toBe("aumentarLetra");
    expect(acaoDoEvento(tecla(" ", { ctrl: true, alt: true }))).toBe("capturar");
    expect(acaoDoEvento(tecla("3", { ctrl: true }))).toBe("irProjetos");
  });

  it("ignora teclas comuns e combinações com Alt", () => {
    expect(acaoDoEvento(tecla("b"))).toBeNull();
    expect(acaoDoEvento(tecla("1", { ctrl: true, alt: true }))).toBeNull();
  });

  it("não tem duas ações na mesma combinação", () => {
    const vistas = new Set<string>();
    for (const a of ATALHOS)
      for (const c of a.combinacoes)
        for (const t of c.teclas) {
          const chave = `${c.ctrl}-${c.shift}-${!!c.alt}-${t}`;
          expect(vistas.has(chave), chave).toBe(false);
          vistas.add(chave);
        }
  });
});
