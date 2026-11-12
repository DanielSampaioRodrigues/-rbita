import { describe, expect, it } from "vitest";
import { dividirEmFrases, vozesEmPortugues } from "./voz";

describe("ler em voz alta", () => {
  it("divide em frases e corta as muito longas", () => {
    expect(dividirEmFrases("A sinapse liga neurônios. A dopamina regula o foco!  E agora?")).toEqual(["A sinapse liga neurônios.", "A dopamina regula o foco!", "E agora?"]);
    const longa = Array.from({ length: 80 }, (_, i) => `palavra${i}`).join(" ");
    const partes = dividirEmFrases(longa, 100);
    expect(partes.every((p) => p.length <= 100)).toBe(true);
    expect(partes.join(" ")).toBe(longa);
    expect(dividirEmFrases("   ")).toEqual([]);
  });
  it("vozes em português, do Brasil primeiro", () => {
    const v = vozesEmPortugues([{ lang: "en-US", name: "A" }, { lang: "pt-PT", name: "B" }, { lang: "pt-BR", name: "C" }]);
    expect(v.map((x) => x.name)).toEqual(["C", "B"]);
  });
});
