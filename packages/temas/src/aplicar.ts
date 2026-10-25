import type { Paleta, Tema } from "./tipos";

export type Modo = "claro" | "escuro";

/** Paleta final de um tema, já com o baixo estímulo aplicado se estiver ligado. */
export function paletaFinal(tema: Tema, modo: Modo, baixoEstimulo: boolean): Paleta {
  const base = tema[modo];
  return baixoEstimulo ? { ...base, ...tema.baixoEstimulo[modo] } : base;
}

/** Converte "superficieAlternativa" em "--cor-superficie-alternativa". */
export function nomeVariavel(chave: string): string {
  return "--cor-" + chave.replace(/[A-Z]/g, (letra) => "-" + letra.toLowerCase());
}

/** Variáveis CSS de uma paleta. */
export function variaveisDaPaleta(paleta: Paleta): Record<string, string> {
  return Object.fromEntries(Object.entries(paleta).map(([chave, cor]) => [nomeVariavel(chave), cor]));
}

/** Aplica as variáveis num elemento (normalmente o <html>). */
export function aplicarVariaveis(elemento: HTMLElement, variaveis: Record<string, string>): void {
  for (const [nome, valor] of Object.entries(variaveis)) elemento.style.setProperty(nome, valor);
}
