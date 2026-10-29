/**
 * Contas do mapa mental, sem tela: onde cada item fica, como a vista se move e aproxima.
 * "Mundo" é o papel do mapa; "tela" é o retângulo visível. A vista leva um no outro:
 * tela = mundo × z + (x, y).
 */

export interface Ponto {
  x: number;
  y: number;
}

export interface Vista {
  x: number;
  y: number;
  z: number;
}

export interface NoArvore {
  id: string;
  filhos: NoArvore[];
}

export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 2;
/** Distância entre as colunas (principal, etapas, subtarefas) e entre as linhas. */
export const COLUNA = 320;
export const LINHA = 72;

export const limitarZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/** Árvore da esquerda para a direita: folhas uma embaixo da outra, cada pai no meio dos filhos. */
export function posicoesAutomaticas(raiz: NoArvore): Record<string, Ponto> {
  const pos: Record<string, Ponto> = {};
  let linha = 0;
  const andar = (n: NoArvore, nivel: number): number => {
    let y: number;
    if (n.filhos.length === 0) {
      y = linha * LINHA;
      linha += 1;
    } else {
      const ys = n.filhos.map((f) => andar(f, nivel + 1));
      y = (ys[0] + ys[ys.length - 1]) / 2;
    }
    pos[n.id] = { x: nivel * COLUNA, y };
    return y;
  };
  andar(raiz, 0);
  return pos;
}

/** Curva suave entre dois centros, saindo e chegando na horizontal. */
export function curva(a: Ponto, b: Ponto): string {
  const meio = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${meio} ${a.y}, ${meio} ${b.y}, ${b.x} ${b.y}`;
}

export const paraMundo = (v: Vista, p: Ponto): Ponto => ({ x: (p.x - v.x) / v.z, y: (p.y - v.y) / v.z });
export const paraTela = (v: Vista, p: Ponto): Ponto => ({ x: p.x * v.z + v.x, y: p.y * v.z + v.y });

/** Aproxima ou afasta mantendo parado o ponto que está embaixo de `centro` (na tela). */
export function zoomEm(v: Vista, fator: number, centro: Ponto): Vista {
  const z = limitarZoom(v.z * fator);
  const m = paraMundo(v, centro);
  return { z, x: centro.x - m.x * z, y: centro.y - m.y * z };
}

/** Vista que mostra todos os pontos, com folga para o tamanho dos itens. Nunca aproxima além de 1. */
export function enquadrar(pontos: Ponto[], largura: number, altura: number, folga: Ponto = { x: 150, y: 48 }): Vista {
  if (pontos.length === 0 || largura <= 0 || altura <= 0) return { x: largura / 2, y: altura / 2, z: 1 };
  const xs = pontos.map((p) => p.x);
  const ys = pontos.map((p) => p.y);
  const esq = Math.min(...xs) - folga.x;
  const dir = Math.max(...xs) + folga.x;
  const cima = Math.min(...ys) - folga.y;
  const baixo = Math.max(...ys) + folga.y;
  const z = limitarZoom(Math.min(1, largura / (dir - esq), altura / (baixo - cima)));
  return { z, x: largura / 2 - ((esq + dir) / 2) * z, y: altura / 2 - ((cima + baixo) / 2) * z };
}

/** Setas movem um item: 8 px por toque, 32 px com Shift. Outras teclas: null. */
export function moverPorTecla(p: Ponto, tecla: string, grande: boolean): Ponto | null {
  const passo = grande ? 32 : 8;
  const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const dir = d[tecla];
  return dir ? { x: p.x + dir[0] * passo, y: p.y + dir[1] * passo } : null;
}

export interface Toque {
  t: number;
  x: number;
  y: number;
  alvo: string | null;
}

/** Dois toques no mesmo alvo, perto e em menos de 350 ms. */
export const toqueDuplo = (antes: Toque | null, agora: Toque) =>
  !!antes && antes.alvo === agora.alvo && agora.t - antes.t < 350 && Math.hypot(agora.x - antes.x, agora.y - antes.y) < 24;
