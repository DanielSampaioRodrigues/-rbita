import type { KeyboardCoordinateGetter } from "@dnd-kit/core";

const DIRECOES: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };

/**
 * Arrastar pelo teclado: cada seta pula para a coluna mais próxima naquela direção,
 * em vez de andar alguns pixels (o padrão do dnd-kit).
 */
export const pularEntreColunas: KeyboardCoordinateGetter = (evento, { context: { collisionRect, droppableRects, droppableContainers } }) => {
  const direcao = DIRECOES[evento.code];
  if (!direcao || !collisionRect) return undefined;
  evento.preventDefault();
  const [dx, dy] = direcao;
  const cx = collisionRect.left + collisionRect.width / 2;
  const cy = collisionRect.top + collisionRect.height / 2;
  let melhor: { x: number; y: number; custo: number } | null = null;
  for (const c of droppableContainers.getEnabled()) {
    const r = droppableRects.get(c.id);
    // A coluna onde o cartão já está não conta.
    if (!r || (cx >= r.left && cx <= r.left + r.width && cy >= r.top && cy <= r.top + r.height)) continue;
    // Ponto de chegada: no meio da coluna, perto do topo (colunas podem ser compridas).
    const tx = r.left + r.width / 2;
    const ty = r.top + Math.min(r.height / 2, collisionRect.height / 2 + 48);
    const frente = (tx - cx) * dx + (ty - cy) * dy;
    if (frente <= 8) continue;
    const lado = Math.abs((tx - cx) * dy) + Math.abs((ty - cy) * dx);
    const custo = frente + lado * 2;
    if (!melhor || custo < melhor.custo) melhor = { x: tx - collisionRect.width / 2, y: ty - collisionRect.height / 2, custo };
  }
  return melhor ? { x: melhor.x, y: melhor.y } : undefined;
};
