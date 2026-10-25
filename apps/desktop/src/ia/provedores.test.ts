import { describe, expect, it } from "vitest";
import { MODELOS_PROVEDOR, modeloDe } from "./provedores";

describe("provedores de IA", () => {
  it("reconhece o provedor salvo pelo endereço", () => {
    expect(modeloDe("compativel", "https://generativelanguage.googleapis.com/v1beta/openai").id).toBe("gemini");
    expect(modeloDe("claude", "https://api.anthropic.com").id).toBe("claude");
    expect(modeloDe("compativel", "https://meu-servidor.exemplo/v1").id).toBe("outro");
  });

  it("só o Ollama dispensa chave e usa http, e só no próprio computador", () => {
    for (const m of MODELOS_PROVEDOR) {
      if (m.id === "ollama") expect(m.url.startsWith("http://localhost")).toBe(true);
      else if (m.id !== "outro") expect(m.url.startsWith("https://")).toBe(true);
      expect(m.precisaChave).toBe(m.id !== "ollama");
    }
  });
});
