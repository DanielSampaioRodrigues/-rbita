// Quadro infinito: uma tela só, grande, com as mesmas ferramentas do caderno. Começa
// com 4800 × 3600 (a pessoa começa no meio, com espaço para todos os lados) e cresce
// sozinha para a direita e para baixo quando o desenho chega perto da borda. O tamanho
// fica no próprio "tamanho" da página: "infinito" (o de começo) ou "infinito:LxA".

export const INFINITO_INICIAL = { largura: 4800, altura: 3600 };
const MAXIMO = 40000;
/** A que distância da borda o quadro cresce, e de quanto em quanto. */
export const MARGEM_CRESCER = 700;
const PASSO = 1200;

export function ehInfinito(tamanho: string): boolean {
  return tamanho === "infinito" || tamanho.startsWith("infinito:");
}

/** Medida do quadro a partir do tamanho guardado. */
export function medidaInfinito(tamanho: string): { largura: number; altura: number } {
  const m = /^infinito:(\d+)x(\d+)$/.exec(tamanho);
  if (!m) return { ...INFINITO_INICIAL };
  const lim = (v: number, ini: number) => Math.min(MAXIMO, Math.max(ini, v));
  return { largura: lim(+m[1], INFINITO_INICIAL.largura), altura: lim(+m[2], INFINITO_INICIAL.altura) };
}

export const tamanhoInfinito = (largura: number, altura: number) => `infinito:${Math.round(largura)}x${Math.round(altura)}`;

/**
 * O novo tamanho, se o conteúdo chegou perto da borda da direita ou de baixo (ou null).
 * Cresce em passos inteiros, com folga, para não crescer a cada traço.
 */
export function crescerAte(fim: { x: number; y: number } | null, medida: { largura: number; altura: number }): { largura: number; altura: number } | null {
  if (!fim) return null;
  let { largura, altura } = medida;
  if (fim.x > largura - MARGEM_CRESCER) largura = Math.min(MAXIMO, Math.ceil((fim.x + MARGEM_CRESCER) / PASSO) * PASSO + PASSO);
  if (fim.y > altura - MARGEM_CRESCER) altura = Math.min(MAXIMO, Math.ceil((fim.y + MARGEM_CRESCER) / PASSO) * PASSO + PASSO);
  return largura !== medida.largura || altura !== medida.altura ? { largura, altura } : null;
}
