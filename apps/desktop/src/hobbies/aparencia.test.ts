import { describe, expect, it } from "vitest";
import { contraste } from "@orbita/temas";
import { aparenciaPadrao, encaixar, estiloFundo, lerQuadro, serializarQuadro, TINTAS, tintaLegivel, visualDoCartao } from "./aparencia";
import { bytesParaBase64, base64ParaBytes, escolherMimeAudio, extensaoDoMime, medidasReduzidas, mimeDaExtensao, motivoErroMic } from "./midia";

describe("hobbies: aparência do quadro", () => {
  it("lê desenhos antigos (sem aparência) sem quebrar", () => {
    const q = lerQuadro(JSON.stringify({ elementos: [] }));
    expect(q.aparencia).toEqual(aparenciaPadrao());
    expect(lerQuadro("lixo").cena.elementos).toEqual([]);
    expect(lerQuadro("").aparencia.grade).toBe(false);
  });

  it("guarda e lê de volta a aparência junto com o desenho", () => {
    const a = aparenciaPadrao();
    a.fundo = { tipo: "gradiente", cor: "mar", gradiente: "campo", imagem: "", padrao: "pontos" };
    a.grade = true;
    a.cartoes = { c1: { cor: "rosa", tinta: "azul", fonte: "lexend", mini: "m1" } };
    const q = lerQuadro(serializarQuadro({ elementos: [] }, a));
    expect(q.aparencia).toEqual(a);
    expect(q.cena).toEqual({ elementos: [] });
  });

  it("não grava aparência quando está tudo no padrão", () => {
    expect(serializarQuadro({ elementos: [] }, aparenciaPadrao())).toBe('{"elementos":[]}');
  });

  it("ignora valores estranhos", () => {
    const q = lerQuadro(JSON.stringify({ elementos: [], aparencia: { fundo: { tipo: "xpto", padrao: 3, cor: "roxo-neon" }, grade: "sim", cartoes: { a: null, b: { cor: 5 } } } }));
    expect(q.aparencia.fundo.tipo).toBe("tema");
    expect(q.aparencia.fundo.padrao).toBe("nenhum");
    expect(q.aparencia.fundo.cor).toBe("mar");
    expect(q.aparencia.grade).toBe(false);
    expect(q.aparencia.cartoes).toEqual({ b: {} });
  });

  it("encaixa na grade de 8 px", () => {
    expect(encaixar(13, true)).toBe(16);
    expect(encaixar(11, true)).toBe(8);
    expect(encaixar(-20, true)).toBe(0);
    expect(encaixar(13.4, false)).toBe(13);
  });

  it("fundo: cor e gradiente têm versão clara e escura; tema não mexe em nada", () => {
    const f = aparenciaPadrao().fundo;
    expect(estiloFundo(f, null)).toEqual({});
    const cor = estiloFundo({ ...f, tipo: "cor", cor: "menta" }, null) as Record<string, string>;
    expect(cor["--hobby-fundo-c"]).toMatch(/^#/);
    expect(cor["--hobby-fundo-e"]).toMatch(/^#/);
    const g = estiloFundo({ ...f, tipo: "gradiente", gradiente: "aurora" }, null) as Record<string, string>;
    expect(g["--hobby-fundo-c"]).toContain("linear-gradient");
    expect(estiloFundo({ ...f, tipo: "imagem", imagem: "x" }, "blob:abc") as Record<string, string>).toHaveProperty("--hobby-fundo-c");
  });

  it("todas as cores de texto passam no contraste mínimo sobre o fundo do tema", () => {
    for (const tt of TINTAS) {
      expect(contraste(tt.claro, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contraste(tt.escuro, "#202226")).toBeGreaterThanOrEqual(4.5);
      expect(tintaLegivel(tt.id, undefined)).not.toBeNull();
    }
  });

  it("cartão: cor, tinta e fonte viram classe e estilo", () => {
    const v = visualDoCartao({ cor: "areia", tinta: "grafite", fonte: "lexend" });
    expect(v.classe).toContain("org-pintado");
    expect(v.classe).toContain("hobby-com-tinta");
    expect(String(v.estilo.fontFamily)).toContain("Lexend");
    expect(visualDoCartao(undefined)).toEqual({ classe: "", estilo: {} });
  });
});

describe("hobbies: mídia", () => {
  it("escolhe o formato de gravação que o aparelho sabe gravar", () => {
    expect(escolherMimeAudio((m) => m.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    // Safari (iPad) só grava MP4.
    expect(escolherMimeAudio((m) => m.startsWith("audio/mp4"))).toBe("audio/mp4;codecs=mp4a.40.2");
    expect(escolherMimeAudio(() => false)).toBe("");
    expect(escolherMimeAudio(undefined)).toBe("");
    expect(escolherMimeAudio(() => { throw new Error("x"); })).toBe("");
  });

  it("extensão e formato combinam (gravar e tocar)", () => {
    expect(extensaoDoMime("audio/mp4")).toBe("m4a");
    expect(extensaoDoMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extensaoDoMime("audio/ogg;codecs=opus")).toBe("ogg");
    expect(mimeDaExtensao("audio-1.m4a")).toBe("audio/mp4");
    expect(mimeDaExtensao("a.webm")).toBe("audio/webm");
    expect(mimeDaExtensao("musica.MP3")).toBe("audio/mpeg");
  });

  it("explica por que o microfone não abriu", () => {
    expect(motivoErroMic({ name: "NotAllowedError" })).toBe("negado");
    expect(motivoErroMic({ name: "NotFoundError" })).toBe("semMic");
    expect(motivoErroMic({ name: "NotReadableError" })).toBe("ocupado");
    expect(motivoErroMic(new Error("?"))).toBe("outro");
    expect(motivoErroMic(null)).toBe("outro");
  });

  it("base64 em blocos dá o mesmo resultado, ida e volta", () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 31) % 256);
    const b64 = bytesParaBase64(bytes);
    expect(Array.from(base64ParaBytes(b64))).toEqual(Array.from(bytes));
  });

  it("reduz mantendo a proporção; não mexe no que já é pequeno", () => {
    expect(medidasReduzidas(4000, 3000, 720)).toEqual({ largura: 720, altura: 540 });
    expect(medidasReduzidas(1000, 4000, 720)).toEqual({ largura: 180, altura: 720 });
    expect(medidasReduzidas(600, 400, 720)).toBeNull();
    expect(medidasReduzidas(0, 0, 720)).toBeNull();
  });
});
