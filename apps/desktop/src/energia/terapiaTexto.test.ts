import { describe, expect, it } from "vitest";
import type { RegistroEnergia } from "../api";
import { marcar, marcarCamuflagem, usarKit, VAZIO, type DadosEnergia } from "./contasDados";
import { textoParaTerapia } from "./terapiaTexto";

// 29/10/2026 é uma quinta-feira.
const HOJE = new Date(2026, 9, 29, 15, 0);
const em = (dia: number, hora = 12, mes = 9) => new Date(2026, mes, dia, hora).getTime();

function dados(): DadosEnergia {
  let d: DadosEnergia = {
    ...VAZIO,
    atividades: [
      { id: "reuniao", nome: "Reunião", peso: -3 },
      { id: "silencio", nome: "Silêncio", peso: 2 },
    ],
    sinais: [{ id: "luz", texto: "A luz incomoda" }, { id: "palavras", texto: "Perco as palavras" }],
    kit: [{ id: "fone", nome: "Fone" }],
  };
  d = marcar(d, "2026-10-26", "reuniao", true);
  d = marcar(d, "2026-10-27", "reuniao", true);
  d = marcar(d, "2026-10-28", "reuniao", true);
  d = marcar(d, "2026-10-28", "silencio", true);
  d = marcar(d, "2026-10-29", "silencio", true);
  d = marcar(d, "2026-09-01", "reuniao", true); // fora do período
  d = marcarCamuflagem(d, "2026-10-27", "muito");
  d = marcarCamuflagem(d, "2026-10-28", "pouco");
  d = marcarCamuflagem(d, "2026-10-29", "muito");
  d = usarKit(d, "fone", em(27));
  d = usarKit(d, "fone", em(28));
  d = usarKit(d, "sumiu", em(28));
  d = usarKit(d, "fone", em(1)); // fora do período
  d = {
    ...d,
    sentidos: [
      { sinalId: "luz", momento: em(26) },
      { sinalId: "luz", momento: em(27) },
      { sinalId: "palavras", momento: em(27) },
      { sinalId: "luz", momento: em(2) }, // fora do período
    ],
  };
  return d;
}

const registros: RegistroEnergia[] = [
  { id: "1", nivel: 2, momento: em(27, 9), nota: "" },
  { id: "2", nivel: 2, momento: em(27, 18), nota: "" },
  { id: "3", nivel: 4, momento: em(1), nota: "" }, // fora
];

describe("texto para a terapia", () => {
  it("monta o Markdown das últimas 2 semanas", () => {
    expect(textoParaTerapia(dados(), registros, HOJE, 2)).toBe(
      [
        "# Energia: resumo para a terapia",
        "",
        "Período: 16/10/2026 a 29/10/2026 (2 semanas).",
        "Montado no Órbita, a pedido da pessoa. Os pesos de cada atividade são dela.",
        "",
        "## Saldo de cada dia",
        "",
        "Dias sem nada marcado ficam de fora.",
        "",
        "- seg, 26/10: gastou mais (gasto 3, reposição 0)",
        "- ter, 27/10: gastou mais (gasto 5, reposição 0) · energia baixa · camuflagem: muito",
        "- qua, 28/10: gastou mais (gasto 4, reposição 2) · camuflagem: um pouco",
        "- qui, 29/10: equilibrado (gasto 2, reposição 2) · camuflagem: muito",
        "",
        "## Resumo",
        "",
        "- Dias em que gastou mais do que repôs: 3 de 4 com registro.",
        "- Maior sequência de dias seguidos gastando mais: 3.",
        "",
        "## Sinais de sobrecarga sentidos",
        "",
        "- A luz incomoda: 2 vezes",
        "- Perco as palavras: 1 vez",
        "",
        "## Esforço para parecer “normal” (camuflagem)",
        "",
        "- Muito: 2 dias",
        "- Um pouco: 1 dia",
        "",
        "## Kit de recuperação sensorial usado",
        "",
        "- Fone: 2 vezes",
        "- (item removido): 1 vez",
        "",
      ].join("\n"),
    );
  });

  it("diz com clareza quando não há nada no período", () => {
    const texto = textoParaTerapia(VAZIO, [], HOJE, 4);
    expect(texto).toContain("Período: 02/10/2026 a 29/10/2026 (4 semanas).");
    expect(texto).toContain("Nada marcado no período.");
    expect(texto).toContain("Nenhum sinal anotado no período.");
    expect(texto).toContain("Pergunta não respondida no período.");
    expect(texto).toContain("Nenhum uso anotado no período.");
    expect(texto).not.toContain("## Resumo");
  });
});
