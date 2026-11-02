import type { EtapaProposta } from "../api";

/**
 * Estado da proposta de "Planejar com a IA", como a pessoa vê e edita na Lista.
 * Funções puras: a janela guarda o resultado em `useState`.
 */
export interface LinhaSub {
  chave: string;
  texto: string;
  incluir: boolean;
}

export interface LinhaPlano extends LinhaSub {
  /** Subtarefas. Quando o alvo é uma etapa, fica sempre vazia. */
  filhos: LinhaSub[];
}

export const MAXIMO_DE_ETAPAS = 12;
export const MAXIMO_DE_SUBTAREFAS = 10;
export const MAXIMO_DO_TEXTO = 120;

let contador = 0;
const novaChave = () => `l${++contador}`;

/** A proposta que chegou da IA vira linhas marcadas. */
export function comoLinhas(etapas: EtapaProposta[]): LinhaPlano[] {
  return etapas.map((e) => ({
    chave: novaChave(),
    texto: e.titulo,
    incluir: true,
    filhos: e.subtarefas.map((texto) => ({ chave: novaChave(), texto, incluir: true })),
  }));
}

export function mudarLinha(linhas: LinhaPlano[], chave: string, parte: Partial<LinhaSub>): LinhaPlano[] {
  return linhas.map((l) =>
    l.chave === chave ? { ...l, ...parte } : l.filhos.some((f) => f.chave === chave) ? { ...l, filhos: l.filhos.map((f) => (f.chave === chave ? { ...f, ...parte } : f)) } : l,
  );
}

/** Apaga uma etapa (com as subtarefas dela) ou uma subtarefa. */
export function apagarLinha(linhas: LinhaPlano[], chave: string): LinhaPlano[] {
  return linhas.filter((l) => l.chave !== chave).map((l) => (l.filhos.some((f) => f.chave === chave) ? { ...l, filhos: l.filhos.filter((f) => f.chave !== chave) } : l));
}

/** Acrescenta uma etapa vazia no fim, ou uma subtarefa vazia no fim de `pai`. Devolve a chave nova (para pôr o foco). */
export function acrescentar(linhas: LinhaPlano[], pai?: string): [LinhaPlano[], string | null] {
  const chave = novaChave();
  if (!pai) {
    if (linhas.length >= MAXIMO_DE_ETAPAS) return [linhas, null];
    return [[...linhas, { chave, texto: "", incluir: true, filhos: [] }], chave];
  }
  const alvo = linhas.find((l) => l.chave === pai);
  if (!alvo || alvo.filhos.length >= MAXIMO_DE_SUBTAREFAS) return [linhas, null];
  return [linhas.map((l) => (l.chave === pai ? { ...l, filhos: [...l.filhos, { chave, texto: "", incluir: true }] } : l)), chave];
}

/**
 * O que vale da proposta: só o marcado e com texto. Subtarefa de etapa
 * desmarcada não vale. É o que vai para a IA ao continuar a conversa e o que é
 * gravado ao aprovar.
 */
export function proposta(linhas: LinhaPlano[]): EtapaProposta[] {
  return linhas
    .filter((l) => l.incluir && l.texto.trim())
    .map((l) => ({ titulo: l.texto.trim(), subtarefas: l.filhos.filter((f) => f.incluir && f.texto.trim()).map((f) => f.texto.trim()) }));
}

/** Quantas etapas e subtarefas serão criadas. */
export function contar(linhas: LinhaPlano[]): { etapas: number; subtarefas: number } {
  const p = proposta(linhas);
  return { etapas: p.length, subtarefas: p.reduce((n, e) => n + e.subtarefas.length, 0) };
}
