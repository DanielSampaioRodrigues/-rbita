import { describe, expect, it } from "vitest";
import { maisNovos } from "./modelos";

describe("maisNovos", () => {
  it("GPT: só a geração mais nova, sem cópias com data nem modelos de voz", () => {
    const todos = ["gpt-4o", "gpt-4o-mini", "gpt-4.1-nano", "gpt-5.5", "gpt-5.5-mini", "gpt-5.6", "gpt-5.6-mini", "gpt-5.6-luna", "gpt-5.6-2026-08-01", "gpt-4o-realtime-preview", "text-embedding-3-large", "whisper-1", "o3", "o4-mini", "gpt-5.6-codex"];
    expect(maisNovos(todos)).toEqual(["gpt-5.6", "gpt-5.6-luna", "gpt-5.6-mini", "o4-mini"]);
  });
  it("Gemini: tira a geração anterior e prévias que já têm versão final", () => {
    const todos = ["gemini-2.0-flash-001", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-pro-preview", "gemini-3-flash", "gemini-3-flash-preview", "gemini-flash-latest", "gemini-embedding-001"];
    expect(maisNovos(todos)).toEqual(["gemini-3-flash", "gemini-3-pro-preview", "gemini-flash-latest"]);
  });
  it("Claude: cada linha na versão mais nova", () => {
    const todos = ["claude-opus-4-1-20250805", "claude-opus-5-5", "claude-sonnet-5-5", "claude-sonnet-4-5-20250929", "claude-haiku-5-5"];
    expect(maisNovos(todos)).toEqual(["claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5"]);
  });
  it("imagem: gpt-image mais novo e imagen mais novo", () => {
    const todos = ["dall-e-2", "dall-e-3", "gpt-image-1", "gpt-image-2", "gpt-image-2-mini", "chatgpt-image-latest"];
    expect(maisNovos(todos, [], true)).toEqual(["chatgpt-image-latest", "gpt-image-2", "gpt-image-2-mini"]);
    const g = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview", "gemini-3.1-flash-image", "imagen-4.0-generate-001", "imagen-4.0-ultra-generate-001", "imagen-3.0-generate-002"];
    expect(maisNovos(g, [], true)).toEqual(["gemini-3-pro-image-preview", "gemini-3.1-flash-image", "imagen-4.0-generate-001", "imagen-4.0-ultra-generate-001"]);
  });
  it("mantém o modelo em uso mesmo que seja antigo", () => {
    expect(maisNovos(["gpt-4o", "gpt-5.6"], ["gpt-4o"])).toEqual(["gpt-4o", "gpt-5.6"]);
  });
});
