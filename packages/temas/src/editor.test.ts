// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { contraste } from "./contraste";
import { ajustarCor, ajustarPaleta, conferirPaleta, gravarArquivoTema, lerArquivoTema, temaDaIa, TemaInvalido } from "./editor";
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

describe("tema escrito por IA", () => {
  const base = TEMAS[0];
  it("aceita texto em volta, corrige contraste e limpa o SVG", () => {
    const resposta = `Claro! Aqui está:\n${JSON.stringify({
      nome: "Floresta à noite",
      cantos: 9,
      claro: { ...base.claro, textoSuave: "#cccccc" },
      escuro: base.escuro,
      fundoSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><script>alert(1)</script><circle cx="20" cy="20" r="3" fill="#345"/></svg>',
    })}\nEspero que goste.`;
    const { tema, ajustado } = temaDaIa(resposta);
    expect(tema.nome).toBe("Floresta à noite");
    expect(ajustado).toBe(true);
    expect(conferirPaleta(tema.claro).every((r) => r.passa)).toBe(true);
    expect(tema.cantos).toBe(2);
    expect(tema.fundoPadrao?.tipo).toBe("svg");
    expect(JSON.stringify(tema.fundoPadrao)).not.toContain("script");
  });
  it("explica em linguagem simples quando falta algo", () => {
    expect(() => temaDaIa("não sei fazer isso")).toThrow(TemaInvalido);
    expect(() => temaDaIa('{"nome": "x", "claro": {"fundo": "#fff"}}')).toThrow(/faltou alguma cor/);
  });
});

describe("ícones do tema", () => {
  it("lê família, preenchimento e efeito, e cai no padrão com valores estranhos", () => {
    const base = JSON.parse(gravarArquivoTema(TEMAS[0]));
    const { tema } = lerArquivoTema(JSON.stringify({ ...base, icones: { traco: 2.5, pontas: "retas", familia: "phosphor", preenchimento: "cheio", efeito: "carimbo" } }));
    expect(tema.icones).toMatchObject({ familia: "phosphor", preenchimento: "cheio", efeito: "carimbo", pontas: "retas" });
    const { tema: estranho } = lerArquivoTema(JSON.stringify({ ...base, icones: { familia: "outra", efeito: "piscar" } }));
    expect(estranho.icones).toMatchObject({ familia: "lucide", efeito: "nenhum", preenchimento: "linha" });
  });

  it("desenhos próprios saem limpos, com a cor do tema e sem nomes estranhos", () => {
    const base = JSON.parse(gravarArquivoTema(TEMAS[0]));
    const desenhos = {
      Home: '<path d="M3 10 12 3l9 7v11H3z" stroke="#ff0000" onclick="alert(1)"/><script>alert(1)</script>',
      Plus: '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor"/></svg>',
      Vazio: "<g></g>",
      "../mal": "<path d='M0 0'/>",
    };
    const { tema } = lerArquivoTema(JSON.stringify({ ...base, icones: { traco: 2, pontas: "redondas", desenhos } }));
    const d = tema.icones?.desenhos ?? {};
    expect(Object.keys(d).sort()).toEqual(["Home", "Plus"]);
    expect(d.Home).toContain('stroke="currentColor"');
    expect(d.Home).not.toMatch(/script|onclick|ff0000/);
    expect(d.Plus).not.toContain("<svg");
    // Volta igual ao gravar e ler de novo.
    expect(lerArquivoTema(gravarArquivoTema(tema)).tema.icones?.desenhos).toEqual(d);
  });
});
