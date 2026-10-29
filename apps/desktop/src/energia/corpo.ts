// "Como está o corpo?": lembrete opcional de água, comida, banheiro e pausa.
// A interocepção (perceber fome, sede, cansaço) costuma ser diferente em pessoas
// neurodivergentes, e some no hiperfoco. Ver docs/pesquisa-energia.md (proposta 3).
//
// O que a pessoa marca fica no cofre de valores, chave "energia.corpo".
import { criarLoja } from "../valores";
import { diaDe } from "./contasDados";

export const COISAS_DO_CORPO = ["agua", "comida", "banheiro", "pausa"] as const;
export type CoisaDoCorpo = (typeof COISAS_DO_CORPO)[number];

export interface DadosCorpo {
  marcados: { coisa: CoisaDoCorpo; momento: number }[];
}

const GUARDADOS = 500;

export function validarCorpo(bruto: unknown): DadosCorpo {
  const b = (bruto && typeof bruto === "object" ? bruto : {}) as { marcados?: unknown };
  const marcados = Array.isArray(b.marcados)
    ? b.marcados.filter(
        (m): m is DadosCorpo["marcados"][number] =>
          !!m && (COISAS_DO_CORPO as readonly unknown[]).includes(m.coisa) && typeof m.momento === "number" && Number.isFinite(m.momento),
      )
    : [];
  return { marcados: marcados.slice(-GUARDADOS) };
}

export const lojaCorpo = criarLoja<DadosCorpo>({
  chave: "energia.corpo",
  vazio: () => ({ marcados: [] }),
  validar: validarCorpo,
});

export function marcarCorpo(d: DadosCorpo, coisa: CoisaDoCorpo, momento: number): DadosCorpo {
  return { marcados: [...d.marcados, { coisa, momento }].slice(-GUARDADOS) };
}

/** Quantas vezes cada coisa foi marcada num dia, na ordem fixa (água, comida, banheiro, pausa). */
export function corpoDoDia(d: DadosCorpo, dia: string): { coisa: CoisaDoCorpo; vezes: number }[] {
  return COISAS_DO_CORPO.map((coisa) => ({ coisa, vezes: d.marcados.filter((m) => m.coisa === coisa && diaDe(m.momento) === dia).length })).filter(
    (x) => x.vezes > 0,
  );
}

/**
 * Relógio do lembrete: soma só o tempo em que o Órbita esteve aberto e desbloqueado.
 * Cada passo conta no máximo `maximoPorPasso` (assim, um computador que dormiu não
 * conta as horas dormidas). Devolve o novo acumulado.
 */
export function avancarRelogio(acumulado: number, decorrido: number, maximoPorPasso = 60_000): number {
  if (!Number.isFinite(decorrido) || decorrido <= 0) return acumulado;
  return acumulado + Math.min(decorrido, maximoPorPasso);
}
