// Abas dos cadernos abertos (contas puras, testáveis). A ordem é a de abertura e
// não muda quando a pessoa troca de aba: aba que pula de lugar confunde.

/** Quantas abas ficam abertas ao mesmo tempo. */
export const MAXIMO_ABAS = 8;

/** Abre (ou mantém) a aba do caderno. Passou do limite, sai a mais antiga que não é a pedida. */
export function abrirAba(abas: string[], id: string, maximo = MAXIMO_ABAS): string[] {
  if (abas.includes(id)) return abas;
  const novo = [...abas, id];
  while (novo.length > maximo) novo.shift();
  return novo;
}

/**
 * Fecha uma aba. Devolve a lista nova e para onde ir: `undefined` = continua onde
 * está (fechou outra aba); `null` = volta para a estante (era a última);
 * um id = a aba vizinha (a da direita; sem ela, a da esquerda).
 */
export function fecharAba(abas: string[], id: string, atual: string): { abas: string[]; ir: string | null | undefined } {
  const i = abas.indexOf(id);
  if (i < 0) return { abas, ir: undefined };
  const novo = abas.filter((x) => x !== id);
  if (id !== atual) return { abas: novo, ir: undefined };
  return { abas: novo, ir: novo[i] ?? novo[i - 1] ?? null };
}

/** Tira das abas os cadernos que não existem mais. */
export function abasValidas(abas: string[], existentes: string[]): string[] {
  const tem = new Set(existentes);
  return abas.filter((id, i) => tem.has(id) && abas.indexOf(id) === i);
}
