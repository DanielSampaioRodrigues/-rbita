// Dinheiro em centavos (inteiro), nunca float. Estas funções puras convertem
// entre o que a pessoa digita/lê ("12,50") e os centavos guardados (1250).

/** "12,50", "12.50", "R$ 1.234,56" ou "" → centavos. `null` se não for número.
 * Com vírgula, o ponto é separador de milhar; sem vírgula, o ponto é decimal
 * (como numa calculadora). */
export function reaisParaCentavos(texto: string): number | null {
  const limpo = texto.replace(/[R$\s]/g, "");
  if (limpo === "") return null;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normal);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Centavos → "12,50" (sem o "R$", para caber em qualquer lugar). */
export function centavosParaReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Centavos → "R$ 12,50". */
export function formatarMoeda(centavos: number): string {
  return `R$ ${centavosParaReais(centavos)}`;
}
