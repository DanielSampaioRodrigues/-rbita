import { CORES_ETIQUETA, type CorEtiqueta } from "../api";

/** Desenhos de fundo da capa gerada (textura sutil, em SVG). */
export const PADROES = ["orbita", "linhas", "pontos", "ondas"] as const;
export type PadraoCapa = (typeof PADROES)[number];

/** Hash simples e estável (FNV-1a) de um texto: o mesmo título dá sempre a mesma capa. */
export function hashTexto(texto: string): number {
  let h = 0x811c9dc5;
  const limpo = texto.trim().toLocaleLowerCase("pt-BR");
  for (let i = 0; i < limpo.length; i++) {
    h ^= limpo.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Cor automática da capa, tirada do título (nunca "cinza", que fica para quem escolher). */
export function corDoTitulo(titulo: string): CorEtiqueta {
  const cores = CORES_ETIQUETA.filter((c) => c !== "cinza");
  return cores[hashTexto(titulo) % cores.length];
}

/** Desenho da textura, também tirado do título (independente da cor). */
export function padraoDoTitulo(titulo: string): PadraoCapa {
  return PADROES[Math.floor(hashTexto(titulo) / 7) % PADROES.length];
}

/** Cor válida da paleta; vazio ou desconhecido = automática pelo título. */
export function corDaCapa(cor: string, titulo: string): CorEtiqueta {
  return (CORES_ETIQUETA as readonly string[]).includes(cor) ? (cor as CorEtiqueta) : corDoTitulo(titulo);
}

/** Tamanho do título na capa: títulos compridos usam letra menor para caber. */
export function tamanhoDoTitulo(titulo: string): "grande" | "medio" | "pequeno" {
  const n = titulo.trim().length;
  if (n <= 18) return "grande";
  if (n <= 42) return "medio";
  return "pequeno";
}
