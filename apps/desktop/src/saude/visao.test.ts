import { describe, expect, it } from "vitest";
import type { RegistroSaude } from "../api";
import { equilibrio, janelas, resumoPorTipo } from "./visao";

const DIA = 86_400_000;
const reg = (tipo: string, intensidade: number | null, momento: number): RegistroSaude => ({
  id: crypto.randomUUID(), tipo, intensidade, momento, nota: "",
});

describe("saúde: visão (puro)", () => {
  it("janelas: diárias até 31 dias, semanais acima", () => {
    const ate = new Date(2026, 9, 26);
    expect(janelas(ate, 7)).toHaveLength(7);
    expect(janelas(ate, 30)).toHaveLength(30);
    expect(janelas(ate, 90)).toHaveLength(13); // ceil(90/7)
    const js = janelas(ate, 7);
    // Última janela termina no começo de amanhã e dura um dia.
    expect(js[6].fim - js[6].inicio).toBe(DIA);
  });

  it("equilíbrio separa bons de difíceis por janela", () => {
    const ate = new Date(2026, 9, 26);
    const js = janelas(ate, 7);
    const hoje = js[6].inicio + 1000;
    const ontem = js[5].inicio + 1000;
    const registros = [
      reg("sono", 2, hoje),
      reg("sobrecarga", 4, hoje),
      reg("coisa_boa", 5, hoje),
      reg("regulacao", 3, ontem),
    ];
    const eq = equilibrio(registros, js);
    expect({ bons: eq[6].bons, dificeis: eq[6].dificeis }).toEqual({ bons: 1, dificeis: 2 });
    expect({ bons: eq[5].bons, dificeis: eq[5].dificeis }).toEqual({ bons: 1, dificeis: 0 });
  });

  it("resumo por tipo: total e média de intensidade, mais frequente primeiro", () => {
    const base = new Date(2026, 9, 20).getTime();
    const registros = [
      reg("sintoma", 2, base),
      reg("sintoma", 4, base + 1000),
      reg("sintoma", null, base + 2000),
      reg("sono", 5, base + 3000),
    ];
    const r = resumoPorTipo(registros, 0, Date.now());
    expect(r[0].tipo).toBe("sintoma");
    expect(r[0].total).toBe(3);
    expect(r[0].media).toBe(3); // (2+4)/2, ignora o null
    expect(r[1].media).toBe(5);
  });
});
