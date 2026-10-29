// Cálculo da média de uma matéria. Função pura e testável. A média é ponderada
// pelo peso de cada atividade com nota lançada (peso vazio conta como 1). Sem
// nota lançada, não há média (devolve null) — nada de assumir zero.

import type { Atividade } from "../api";

/** Média ponderada das atividades que já têm nota. `null` se nenhuma tem. */
export function mediaPonderada(atividades: Atividade[]): number | null {
  const comNota = atividades.filter((a) => a.nota != null);
  if (comNota.length === 0) return null;
  let somaPesos = 0;
  let soma = 0;
  for (const a of comNota) {
    const peso = a.peso != null && a.peso > 0 ? a.peso : 1;
    soma += (a.nota as number) * peso;
    somaPesos += peso;
  }
  if (somaPesos === 0) return null;
  return soma / somaPesos;
}

/** Como a matéria vai, de forma calma (nunca como fracasso). */
export type Situacao = "semNota" | "acima" | "perto" | "abaixo";

/**
 * Compara a média com a de aprovação, com uma faixa de folga de meio ponto
 * para o "perto" (nem tudo é aprovado/reprovado). Informativo, não punitivo.
 */
export function situacao(media: number | null, aprovacao: number): Situacao {
  if (media == null) return "semNota";
  if (media >= aprovacao) return "acima";
  if (media >= aprovacao - 0.5) return "perto";
  return "abaixo";
}

/**
 * Médias por bimestre (índices 0–3) e a média do ano (índice 4), cada uma com
 * as notas lançadas. `bimestreDe` diz em que bimestre cada atividade cai
 * (null = sem bimestre: entra só no ano).
 */
export function mediasPorBimestre(atividades: Atividade[], bimestreDe: (a: Atividade) => number | null): (number | null)[] {
  const saida: (number | null)[] = [1, 2, 3, 4].map((b) => mediaPonderada(atividades.filter((a) => bimestreDe(a) === b)));
  saida.push(mediaPonderada(atividades));
  return saida;
}
