import { describe, expect, it } from "vitest";
import { haQuanto, linhaPausa, resumir, ultimaCoisa } from "./tempo";

const agora = new Date(2026, 9, 29, 15, 0).getTime();
const diasAtras = (n: number, hora = 10) => new Date(2026, 9, 29 - n, hora, 0).getTime();

describe("tempo dos projetos", () => {
  it("conta dias do calendário", () => {
    expect(haQuanto(diasAtras(0, 1), agora)).toBe("hoje");
    expect(haQuanto(diasAtras(1, 23), agora)).toBe("ontem");
    expect(haQuanto(diasAtras(3), agora)).toBe("há 3 dias");
    expect(haQuanto(diasAtras(15), agora)).toBe("há 2 semanas");
    expect(haQuanto(diasAtras(7 * 1 + 7), agora)).toBe("há 2 semanas");
    expect(haQuanto(diasAtras(95), agora)).toBe("há 3 meses");
  });

  it("corta texto comprido no fim de uma palavra", () => {
    expect(resumir("curto")).toBe("curto");
    const longo = "revisar o capítulo dois inteiro com calma antes de mandar para a orientadora ler na semana que vem";
    const r = resumir(longo, 40);
    expect(r.endsWith("…")).toBe(true);
    expect(r.length).toBeLessThanOrEqual(41);
    expect(longo.startsWith(r.slice(0, -1))).toBe(true);
  });

  it("a última coisa é o próximo passo, ou o começo da anotação", () => {
    expect(ultimaCoisa({ ondeParei: null })).toBeNull();
    expect(ultimaCoisa({ ondeParei: { texto: "**Parei** no meio", proximoPasso: "", links: [], atualizadoEm: 0 } })).toBe("Parei no meio");
    expect(ultimaCoisa({ ondeParei: { texto: "x", proximoPasso: "Ligar para a gráfica", links: [], atualizadoEm: 0 } })).toBe("Ligar para a gráfica");
  });

  it("monta a linha de contexto do projeto pausado", () => {
    const base = { estado: "pausado" as const, pausadoEm: diasAtras(3), ondeParei: { texto: "", proximoPasso: "Revisar o roteiro", links: [], atualizadoEm: 0 } };
    expect(linhaPausa(base, agora)).toBe("Pausado há 3 dias — última coisa: Revisar o roteiro");
    expect(linhaPausa({ ...base, ondeParei: null }, agora)).toBe("Pausado há 3 dias");
    expect(linhaPausa({ ...base, pausadoEm: null, ondeParei: null }, agora)).toBe("Pausado");
    expect(linhaPausa({ ...base, estado: "ativo" }, agora)).toBeNull();
  });
});
