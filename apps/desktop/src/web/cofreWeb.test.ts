import { describe, expect, it } from "vitest";
import { abrirEnvelope, aleatorio, chaveDosDados, deBase64, destrancarTexto, envelopar, paraBase64, rotuloDados, trancarTexto } from "./cofreWeb";

describe("cofre da versão de navegador", () => {
  it("tranca a chave dos dados com um segredo e só abre com o mesmo segredo e rótulo", async () => {
    const chave = aleatorio(32);
    const env = await envelopar("cavalo azul na janela", chave, "senha");
    expect(await abrirEnvelope("cavalo azul na janela", env, "senha")).toEqual(chave);
    expect(await abrirEnvelope("cavalo azul na janelo", env, "senha")).toBeNull();
    expect(await abrirEnvelope("cavalo azul na janela", env, "recuperacao")).toBeNull();
  });

  it("os dados trancados não guardam o texto aberto e só abrem com a chave certa", async () => {
    const k = await chaveDosDados(aleatorio(32));
    const t = await trancarTexto(k, '{"hobby":"aquarela"}', rotuloDados("id-1"));
    expect(new TextDecoder().decode(t.cifra)).not.toContain("aquarela");
    expect(await destrancarTexto(k, t, rotuloDados("id-1"))).toBe('{"hobby":"aquarela"}');
    expect(await destrancarTexto(k, t, rotuloDados("id-2"))).toBeNull();
    expect(await destrancarTexto(await chaveDosDados(aleatorio(32)), t, rotuloDados("id-1"))).toBeNull();
  });

  it("base64 vai e volta, inclusive com arquivos grandes", () => {
    const b = Uint8Array.from({ length: 200_000 }, (_, i) => (i * 31 + 7) % 256);
    expect(deBase64(paraBase64(b))).toEqual(b);
  });
});
