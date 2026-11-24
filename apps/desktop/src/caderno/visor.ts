// Contas do visor do caderno (puras, testáveis): o tamanho da página na tela e
// para qual página ir quando a pessoa solta a rolagem.

/** "pagina": a página inteira cabe na tela (padrão; nada da próxima aparece).
 *  "largura": a página ocupa a largura toda (letra maior; rola dentro dela). */
export type Encaixe = "pagina" | "largura";

/** Folga em volta da página, em px de tela. */
export const FOLGA_PAGINA = 8;

/**
 * O encaixe de quem ainda não escolheu. No tablet, no celular e em tela em pé, a folha
 * ocupa a largura toda (com "página inteira" ali sobra muita tela vazia dos lados).
 * No computador com a tela deitada, a página inteira continua sendo o começo.
 */
export function encaixePadrao(toque: boolean, largura: number, altura: number): Encaixe {
  return toque || altura > largura ? "largura" : "pagina";
}

/**
 * Largura da página na tela, em px, no zoom 1.
 * - rolagem vertical + "pagina": o menor entre caber na largura e caber na altura;
 * - rolagem vertical + "largura": a largura da área (até 1500 px);
 * - rolagem lateral: sempre cabe na altura (o "largura" não faz sentido de lado).
 */
export function larguraDaPagina(
  area: { largura: number; altura: number },
  pagina: { largura: number; altura: number },
  encaixe: Encaixe,
  lateral: boolean,
): number {
  const L = Math.max(120, area.largura - FOLGA_PAGINA * 2);
  const A = Math.max(120, area.altura - FOLGA_PAGINA * 2);
  const proporcao = pagina.largura / pagina.altura;
  const pelaAltura = A * proporcao;
  if (lateral) return Math.floor(pelaAltura);
  if (encaixe === "largura") return Math.floor(Math.min(L, 1500));
  return Math.floor(Math.min(L, pelaAltura));
}

/** Índice da página em que a posição está (a última que começa antes dela). */
export function paginaNaPosicao(posicao: number, inicios: number[]): number {
  let atual = 0;
  for (let i = 0; i < inicios.length; i++) if (inicios[i] <= posicao + 1) atual = i;
  return atual;
}

/**
 * Página de destino ao soltar a rolagem no modo "página inteira" (como virar a folha).
 * `origem`: a página em que o arrasto começou; `inicios`: onde cada página começa
 * (px, no eixo da rolagem); `tamanho`: o tamanho da área nesse eixo;
 * `velocidade`: px/ms, positiva quando avança. Soltou rápido ou arrastou mais de
 * 20% da área, vai para a vizinha naquele sentido; senão, volta para a de origem.
 */
export function paginaAoSoltar(posicao: number, inicios: number[], velocidade: number, tamanho: number, origem: number): number {
  if (!inicios.length) return 0;
  const o = Math.max(0, Math.min(inicios.length - 1, origem));
  const delta = posicao - inicios[o];
  let alvo = o;
  if (Math.abs(velocidade) > 0.35) alvo = o + Math.sign(velocidade);
  else if (delta > tamanho * 0.2) alvo = o + 1;
  else if (delta < -tamanho * 0.2) alvo = o - 1;
  return Math.max(0, Math.min(inicios.length - 1, alvo));
}
