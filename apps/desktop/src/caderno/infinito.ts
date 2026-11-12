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

/** A área a exportar: o conteúdo com folga, dentro do quadro, com um tamanho mínimo. */
export function areaParaExportar(conteudo: { x0: number; y0: number; x1: number; y1: number } | null, medida: { largura: number; altura: number }, folga = 60): { x: number; y: number; w: number; h: number } {
  if (!conteudo) return { x: 0, y: 0, w: Math.min(medida.largura, 1200), h: Math.min(medida.altura, 900) };
  const MIN_L = 600, MIN_A = 400;
  let x0 = conteudo.x0 - folga, x1 = conteudo.x1 + folga, y0 = conteudo.y0 - folga, y1 = conteudo.y1 + folga;
  if (x1 - x0 < MIN_L) { const c = (x0 + x1) / 2; x0 = c - MIN_L / 2; x1 = c + MIN_L / 2; }
  if (y1 - y0 < MIN_A) { const c = (y0 + y1) / 2; y0 = c - MIN_A / 2; y1 = c + MIN_A / 2; }
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(medida.largura, x1); y1 = Math.min(medida.altura, y1);
  return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
}

/** Escala da imagem PNG: até 2×, sem passar de ~16 milhões de pontos (limite do Safari no iPad). */
export function escalaDaImagem(w: number, h: number): number {
  return Math.max(0.5, Math.min(2, Math.sqrt(16_000_000 / Math.max(1, w * h))));
}

/**
 * Quanto empurrar o conteúdo para a direita e para baixo quando ele chega perto da borda
 * da esquerda ou de cima (o quadro cresce para esses lados assim). Zero se não precisa.
 */
export function deslocamentoPara(inicio: { x: number; y: number } | null): { dx: number; dy: number } {
  if (!inicio) return { dx: 0, dy: 0 };
  const quanto = (v: number) => (v < MARGEM_CRESCER ? Math.ceil((MARGEM_CRESCER - v) / PASSO) * PASSO + PASSO : 0);
  return { dx: quanto(inicio.x), dy: quanto(inicio.y) };
}
