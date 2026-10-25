// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { contraste } from "./contraste";
import { ajustarCor, ajustarPaleta, conferirPaleta, gravarArquivoTema, lerArquivoTema, TemaInvalido } from "./editor";
import { paletaFinal } from "./aplicar";
import { TEMAS } from "./prontos";
import { papel } from "./papel";

describe("editor de tema", () => {
  it("os temas prontos passam em todos os pares", () => {
    for (const t of TEMAS) for (const m of ["claro", "escuro"] as const) expect(conferirPaleta(t[m]).every((r) => r.passa)).toBe(true);
  });

  it("ajusta uma cor fraca até passar, mantendo o rumo (escurecer no fundo claro)", () => {
    const nova = ajustarCor("#9aa0a6", ["#ffffff"], 4.5);
    expect(contraste(nova, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(parseInt(nova.slice(1, 3), 16)).toBeLessThan(0x9a);
  });

  it("corrige uma paleta inteira", () => {
    const ruim = { ...papel.claro, texto: "#b0b0b0", destaque: "#c8e0d8" };
    expect(conferirPaleta(ruim).some((r) => !r.passa)).toBe(true);
    expect(conferirPaleta(ajustarPaleta(ruim)).every((r) => r.passa)).toBe(true);
  });

  it("exporta e importa o mesmo tema", () => {
    const { tema, ajustado } = lerArquivoTema(gravarArquivoTema(papel));
    expect(ajustado).toBe(false);
    expect(tema.claro).toEqual(papel.claro);
    expect(tema.nome).toBe("Papel");
    expect(conferirPaleta(paletaFinal(tema, "claro", true)).filter((r) => r.frente === "destaque").every((r) => r.passa)).toBe(true);
  });

  it("recusa arquivo estranho e limpa SVG e contraste de arquivo de terceiros", () => {
    expect(() => lerArquivoTema("oi")).toThrow(TemaInvalido);
    expect(() => lerArquivoTema(JSON.stringify({ formato: "orbita-tema", claro: {}, escuro: {} }))).toThrow(TemaInvalido);
    const arquivo = JSON.parse(gravarArquivoTema(papel));
    arquivo.claro.texto = "#dddddd";
    arquivo.fundo = { tipo: "svg", conteudo: `<svg onload="alert(1)"><script>x</script><circle r="2"/></svg>` };
    const { tema, ajustado } = lerArquivoTema(JSON.stringify(arquivo));
    expect(ajustado).toBe(true);
    expect(conferirPaleta(tema.claro).every((r) => r.passa)).toBe(true);
    expect(tema.fundoPadrao?.tipo === "svg" && tema.fundoPadrao.conteudo).not.toMatch(/onload|script/);
  });
});
