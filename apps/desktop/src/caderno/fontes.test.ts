import { describe, expect, it } from "vitest";
import { amostrar, buscar, citacoesEmBotoes, dividir, emPedacos, etiqueta, lerCitacoes, montarTrechos, paginasDaTranscricao, palavras, pedidoTranscreverPaginas, tipoDoArquivo, type Trecho } from "./fontes";

describe("fontes do caderno", () => {
  it("divide em trechos sem cortar no meio da palavra e guarda a página", () => {
    const frase = "A sinapse liga dois neurônios e passa o impulso adiante. ";
    const t = dividir(frase.repeat(80), { p: 7 }, 400);
    expect(t.length).toBeGreaterThan(5);
    expect(t.every((x) => x.p === 7 && x.t.length <= 560)).toBe(true);
    expect(t.every((x) => /\.$/.test(x.t))).toBe(true);
    expect(dividir("   ")).toEqual([]);
  });

  it("palavras sem acento, sem as muito comuns, com plural junto do singular", () => {
    expect(palavras("Os Neurônios e a sinapse")).toEqual(["neuronio", "sinapse"]);
    expect(palavras("funções")).toEqual(palavras("função"));
  });

  it("busca acha o trecho certo e não deixa uma fonte só ocupar tudo", () => {
    const f1: Trecho[] = [{ t: "A dopamina é um neurotransmissor ligado à motivação.", p: 3 }, { t: "O córtex pré-frontal organiza o planejamento.", p: 4 }];
    const f2: Trecho[] = Array.from({ length: 10 }, (_, i) => ({ t: `Dopamina e recompensa, parte ${i}.`, p: i + 1 }));
    const r = buscar([f1, f2], "o que é dopamina?", 6, 3);
    expect(r[0].fonte === 0 || r[0].trecho.t.includes("Dopamina")).toBe(true);
    expect(r.filter((a) => a.fonte === 1).length).toBe(3);
    expect(r.some((a) => a.fonte === 0 && a.trecho.p === 3)).toBe(true);
    expect(buscar([f1], "  ")).toEqual([]);
  });

  it("amostra a fonte toda quando não cabe", () => {
    const f: Trecho[] = Array.from({ length: 100 }, (_, i) => ({ t: "x".repeat(1000), p: i + 1 }));
    const a = amostrar([f], 20_000);
    expect(a.length).toBeLessThan(40);
    expect(a[0].trecho.p).toBe(1);
    expect(a.some((x) => (x.trecho.p ?? 0) > 80)).toBe(true);
    expect(amostrar([f.slice(0, 3)], 20_000).length).toBe(3);
  });

  it("etiquetas, trechos para a IA e citações viram botões", () => {
    expect(etiqueta(1, { t: "", p: 14 })).toBe("[F2 p.14]");
    expect(etiqueta(0, { t: "", cap: 3 })).toBe("[F1 cap.3]");
    expect(etiqueta(2, { t: "" })).toBe("[F3]");
    const m = montarTrechos([{ fonte: 1, trecho: { t: "B", p: 2 }, nota: 1, i: 0 }, { fonte: 0, trecho: { t: "A", p: 9 }, nota: 2, i: 0 }], ["Aula", "Artigo"]);
    expect(m).toBe("[F1 p.9] Aula\nA\n\n[F2 p.2] Artigo\nB");
    expect(lerCitacoes("Sim [F2 p.14] e [F1] e [F3 cap.2].")).toEqual([
      { fonte: 1, p: 14, texto: "[F2 p.14]" }, { fonte: 0, texto: "[F1]" }, { fonte: 2, cap: 2, texto: "[F3 cap.2]" },
    ]);
    const h = citacoesEmBotoes("<p>Isso [F2 p.14] e [F9 p.1].</p>", 2);
    expect(h).toContain('<button type="button" class="fonte-citacao" data-fonte="1" data-p="14">[F2 p.14]</button>');
    expect(h).toContain("[F9 p.1]"); // fonte que não existe fica como texto
  });

  it("tipos de arquivo e pedaços para guardar", () => {
    expect(tipoDoArquivo("Aula.PDF", "")).toBe("pdf");
    expect(tipoDoArquivo("livro.epub", "")).toBe("epub");
    expect(tipoDoArquivo("trab.docx", "")).toBe("word");
    expect(tipoDoArquivo("foto.jpg", "image/jpeg")).toBe("imagem");
    expect(tipoDoArquivo("notas.md", "")).toBe("texto");
    expect(tipoDoArquivo("planilha.xlsx", "")).toBeNull();
    const t: Trecho[] = Array.from({ length: 10 }, () => ({ t: "y".repeat(100) }));
    expect(emPedacos(t, 300).length).toBe(5);
  });
});


describe("PDF digitalizado lido pela IA", () => {
  it("o pedido diz as páginas e a marca", () => {
    const p = pedidoTranscreverPaginas([5, 6]);
    expect(p).toContain("páginas 5, 6");
    expect(p).toContain("=== Página N ===");
  });
  it("separa pelas marcas e guarda a página de cada parte", () => {
    const t = "=== Página 5 ===\nPrimeiro texto.\n\n=== Página 6 ===\n\n=== página 7 ===\nTerceiro.";
    expect(paginasDaTranscricao(t, [5, 6, 7])).toEqual([{ p: 5, texto: "Primeiro texto." }, { p: 7, texto: "Terceiro." }]);
  });
  it("sem marca, tudo fica na primeira página do lote", () => {
    expect(paginasDaTranscricao("Só texto.", [9, 10])).toEqual([{ p: 9, texto: "Só texto." }]);
    expect(paginasDaTranscricao("  ", [9])).toEqual([]);
  });
  it("número estranho na marca vai para a posição no lote", () => {
    expect(paginasDaTranscricao("=== Página 1 ===\nA\n=== Página 2 ===\nB", [11, 12])).toEqual([{ p: 11, texto: "A" }, { p: 12, texto: "B" }]);
  });
});
