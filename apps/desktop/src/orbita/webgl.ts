// Fica fora de cena.ts para o app perguntar isto sem carregar a biblioteca de 3D.
let resposta: boolean | null = null;

/** Dá para desenhar em 3D neste aparelho? */
export function temWebGL(): boolean {
  if (resposta === null) {
    try { const c = document.createElement("canvas"); resposta = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { resposta = false; }
  }
  return resposta;
}
