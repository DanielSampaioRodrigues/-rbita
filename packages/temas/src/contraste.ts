// Cálculo de contraste da norma de acessibilidade WCAG 2.

/** Converte "#rrggbb" ou "#rgb" em [r, g, b] de 0 a 255. */
export function lerHex(hex: string): [number, number, number] {
  const limpo = hex.replace("#", "");
  const cheio = limpo.length === 3 ? [...limpo].map((c) => c + c).join("") : limpo;
  if (!/^[0-9a-f]{6}$/i.test(cheio)) throw new Error(`Cor inválida: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(cheio.slice(i, i + 2), 16)) as [number, number, number];
}

/** Luminância relativa, de 0 (preto) a 1 (branco). */
export function luminancia(hex: string): number {
  const [r, g, b] = lerHex(hex).map((canal) => {
    const c = canal / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste entre duas cores, de 1 a 21. */
export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

/** Mínimos da WCAG AA. */
export const MINIMO = {
  texto: 4.5,
  /** Bordas de campos, botões e foco, que precisam ser percebidos. */
  controle: 3,
} as const;
