// Lógica pura: transforma a configuração de leitura em cores e em CSS. Sem DOM,
// sem bibliotecas — dá para testar sozinha.

import type { ConfigLeitura, CorFundo } from "./tipos";

/** Cor do papel e do texto de cada fundo, com contraste garantido. */
export const CORES_FUNDO: Record<CorFundo, { fundo: string; texto: string }> = {
  branco: { fundo: "#ffffff", texto: "#1a1a1a" },
  creme: { fundo: "#f6efe0", texto: "#2a2620" },
  polen: { fundo: "#f2e8c8", texto: "#30291a" },
  cinza: { fundo: "#d9d9d9", texto: "#1f1f1f" },
  escuro: { fundo: "#15171a", texto: "#d7d9dc" },
};

export function coresDeLeitura(cor: CorFundo): { fundo: string; texto: string } {
  return CORES_FUNDO[cor] ?? CORES_FUNDO.creme;
}

/** Declarações CSS para o corpo do texto, a partir da configuração. */
export function estiloDoCorpo(config: ConfigLeitura): Record<string, string> {
  const cores = coresDeLeitura(config.corFundo);
  return {
    "font-family": `"${config.fonte}", system-ui, sans-serif`,
    "font-size": `${config.tamanho}%`,
    "line-height": `${config.entrelinha}`,
    "text-align": config.alinhamento === "justificado" ? "justify" : "left",
    color: cores.texto,
    background: cores.fundo,
  };
}

/**
 * Tema no formato que o epub.js espera em `rendition.themes.default(...)`:
 * um mapa de seletor → declarações. A margem vira padding lateral do corpo.
 */
export function temaEpub(config: ConfigLeitura): Record<string, Record<string, string>> {
  const corpo = estiloDoCorpo(config);
  return {
    body: {
      ...corpo,
      "padding-left": `${config.margem}%`,
      "padding-right": `${config.margem}%`,
    },
    p: { "line-height": `${config.entrelinha}`, "text-align": corpo["text-align"] },
    a: { color: coresDeLeitura(config.corFundo).texto },
  };
}

/** Fator de zoom do PDF a partir do tamanho (100% = 1). */
export function zoomPdf(config: ConfigLeitura): number {
  return Math.max(0.5, Math.min(4, config.tamanho / 100));
}
