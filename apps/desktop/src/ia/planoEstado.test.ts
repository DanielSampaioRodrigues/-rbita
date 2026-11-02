import { describe, expect, it } from "vitest";
import { acrescentar, apagarLinha, comoLinhas, contar, MAXIMO_DE_ETAPAS, MAXIMO_DE_SUBTAREFAS, mudarLinha, proposta } from "./planoEstado";

const exemplo = () =>
  comoLinhas([
    { titulo: "Planejar", subtarefas: ["Listar ideias", "Escolher uma"] },
    { titulo: "Gravar", subtarefas: ["Testar o microfone"] },
  ]);

describe("estado da proposta de Planejar com a IA", () => {
  it("chega toda marcada e volta igual para gravar", () => {
    const linhas = exemplo();
    expect(linhas.every((l) => l.incluir && l.filhos.every((f) => f.incluir))).toBe(true);
    expect(proposta(linhas)).toEqual([
      { titulo: "Planejar", subtarefas: ["Listar ideias", "Escolher uma"] },
      { titulo: "Gravar", subtarefas: ["Testar o microfone"] },
    ]);
    expect(contar(linhas)).toEqual({ etapas: 2, subtarefas: 3 });
  });

  it("edita o texto de etapas e subtarefas", () => {
    let linhas = exemplo();
    linhas = mudarLinha(linhas, linhas[0].chave, { texto: "  Planejar o podcast " });
    linhas = mudarLinha(linhas, linhas[1].filhos[0].chave, { texto: "Testar o fone" });
    expect(proposta(linhas)[0].titulo).toBe("Planejar o podcast");
    expect(proposta(linhas)[1].subtarefas).toEqual(["Testar o fone"]);
  });

  it("desmarcar tira do que vai ser gravado; etapa desmarcada leva as subtarefas junto", () => {
    let linhas = exemplo();
    linhas = mudarLinha(linhas, linhas[0].filhos[1].chave, { incluir: false });
    expect(proposta(linhas)[0].subtarefas).toEqual(["Listar ideias"]);
    linhas = mudarLinha(linhas, linhas[1].chave, { incluir: false });
    expect(proposta(linhas).map((e) => e.titulo)).toEqual(["Planejar"]);
    expect(contar(linhas)).toEqual({ etapas: 1, subtarefas: 1 });
  });

  it("apaga e acrescenta; linha vazia não conta", () => {
    let linhas = exemplo();
    linhas = apagarLinha(linhas, linhas[0].filhos[0].chave);
    linhas = apagarLinha(linhas, linhas[1].chave);
    expect(proposta(linhas)).toEqual([{ titulo: "Planejar", subtarefas: ["Escolher uma"] }]);
    let nova: string | null;
    [linhas, nova] = acrescentar(linhas);
    expect(nova).not.toBeNull();
    expect(contar(linhas).etapas).toBe(1);
    linhas = mudarLinha(linhas, nova!, { texto: "Divulgar" });
    [linhas, nova] = acrescentar(linhas, linhas[1].chave);
    linhas = mudarLinha(linhas, nova!, { texto: "Mandar o link" });
    expect(proposta(linhas)[1]).toEqual({ titulo: "Divulgar", subtarefas: ["Mandar o link"] });
  });

  it("respeita os limites ao acrescentar", () => {
    let linhas = comoLinhas(Array.from({ length: MAXIMO_DE_ETAPAS }, (_, i) => ({ titulo: `E${i}`, subtarefas: Array.from({ length: MAXIMO_DE_SUBTAREFAS }, (_, j) => `S${j}`) })));
    const [depois, nova] = acrescentar(linhas);
    expect(nova).toBeNull();
    expect(depois).toBe(linhas);
    [linhas] = acrescentar(linhas, linhas[0].chave);
    expect(linhas[0].filhos).toHaveLength(MAXIMO_DE_SUBTAREFAS);
  });
});
