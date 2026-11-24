import { describe, expect, it } from "vitest";
import { abasValidas, abrirAba, fecharAba } from "./abas";

describe("abas dos cadernos", () => {
  it("abre no fim e não muda a ordem ao reabrir", () => {
    expect(abrirAba(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    const mesma = ["a", "b"];
    expect(abrirAba(mesma, "a")).toBe(mesma);
  });

  it("passou do limite, sai a mais antiga", () => {
    expect(abrirAba(["a", "b", "c"], "d", 3)).toEqual(["b", "c", "d"]);
  });

  it("fechar outra aba não tira a pessoa de onde está", () => {
    expect(fecharAba(["a", "b", "c"], "c", "a")).toEqual({ abas: ["a", "b"], ir: undefined });
  });

  it("fechar a aba atual vai para a vizinha da direita, depois a da esquerda", () => {
    expect(fecharAba(["a", "b", "c"], "b", "b")).toEqual({ abas: ["a", "c"], ir: "c" });
    expect(fecharAba(["a", "b", "c"], "c", "c")).toEqual({ abas: ["a", "b"], ir: "b" });
  });

  it("fechar a última aba volta para a estante", () => {
    expect(fecharAba(["a"], "a", "a")).toEqual({ abas: [], ir: null });
  });

  it("fechar aba que não existe não muda nada", () => {
    const l = ["a"];
    expect(fecharAba(l, "x", "a")).toEqual({ abas: l, ir: undefined });
  });

  it("tira cadernos apagados e repetidos", () => {
    expect(abasValidas(["a", "x", "b", "a"], ["a", "b"])).toEqual(["a", "b"]);
  });
});
