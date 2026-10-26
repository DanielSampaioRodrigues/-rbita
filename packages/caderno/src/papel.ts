// Gerador das folhas (o "papel" por trás de cada página): linhas, grade,
// pontos, pauta musical, isométrico. Puro — devolve uma string SVG, para
// desenhar atrás da página, nas miniaturas e na exportação em PDF. As cores
// entram resolvidas (hex ou nome CSS), porque o pacote não conhece o tema.

import type { Papel } from "./tipos";

export interface CoresPapel {
  /** Cor de fundo do papel. */
  fundo: string;
  /** Cor das linhas. */
  linha: string;
}

/** Posição da linha de margem e altura do cabeçalho, em px. */
const MARGEM_X = 56;
const CABECALHO_Y = 56;
const COR_MARGEM = "#c98b9b";

function linhaH(y: number, x1: number, x2: number, cor: string, lw: number): string {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${cor}" stroke-width="${lw}"/>`;
}
function linhaV(x: number, y1: number, y2: number, cor: string, lw: number): string {
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${cor}" stroke-width="${lw}"/>`;
}
function ponto(x: number, y: number, r: number, cor: string): string {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${cor}"/>`;
}

/** As linhas do modelo escolhido, dentro da área útil (depois da margem/cabeçalho). */
function linhasDoModelo(papel: Papel, largura: number, altura: number, cor: string, esp: number, lw: number, x0: number, y0: number): string[] {
  const el: string[] = [];
  switch (papel.modelo) {
    case "pautado":
      for (let y = y0 + esp; y < altura; y += esp) el.push(linhaH(y, x0, largura, cor, lw));
      break;
    case "quadriculado":
      for (let y = y0 + esp; y < altura; y += esp) el.push(linhaH(y, x0, largura, cor, lw));
      for (let x = x0 + esp; x < largura; x += esp) el.push(linhaV(x, y0, altura, cor, lw));
      break;
    case "pontilhado": {
      const r = Math.max(0.6, lw);
      for (let y = y0 + esp; y < altura; y += esp)
        for (let x = x0 + esp; x < largura; x += esp) el.push(ponto(x, y, r, cor));
      break;
    }
    case "isometrico": {
      // Verticais + duas famílias de diagonais a 30° (o passo horizontal mantém
      // o espaçamento perpendicular ≈ esp).
      for (let x = x0 + esp; x < largura; x += esp) el.push(linhaV(x, y0, altura, cor, lw));
      const corrida = altura * Math.sqrt(3); // run horizontal para subir toda a altura a 30°
      const passo = esp / Math.sin(Math.PI / 3); // passo em x entre diagonais paralelas
      for (let x = x0 - corrida; x < largura; x += passo) {
        el.push(`<line x1="${x.toFixed(1)}" y1="${y0}" x2="${(x + corrida).toFixed(1)}" y2="${altura}" stroke="${cor}" stroke-width="${lw}"/>`);
        el.push(`<line x1="${(x + corrida).toFixed(1)}" y1="${y0}" x2="${x.toFixed(1)}" y2="${altura}" stroke="${cor}" stroke-width="${lw}"/>`);
      }
      break;
    }
    case "planner": {
      // Pautado com uma coluna estreita à esquerda (para marcar horas/tarefas).
      el.push(linhaV(x0 + esp * 2, y0, altura, cor, lw));
      for (let y = y0 + esp; y < altura; y += esp) el.push(linhaH(y, x0, largura, cor, lw));
      break;
    }
    case "partitura": {
      // Grupos de 5 linhas (a pauta), com um vão maior entre as pautas.
      const linha = Math.max(5, esp * 0.4);
      const vao = esp * 1.4;
      let y = y0 + vao;
      while (y + linha * 4 < altura) {
        for (let i = 0; i < 5; i++) el.push(linhaH(y + i * linha, x0, largura, cor, lw));
        y += linha * 4 + vao;
      }
      break;
    }
    case "liso":
    case "proprio":
    default:
      break;
  }
  return el;
}

/**
 * SVG completo da folha, no tamanho dado (px). `proprio` só devolve o fundo (o
 * arquivo da pessoa entra por cima, no app). A SVG é autossuficiente e recorta
 * o que passar das bordas, para servir também na exportação.
 */
export function svgPapel(papel: Papel, largura: number, altura: number, cores: CoresPapel): string {
  const esp = Math.max(6, papel.espacamento || 32);
  const lw = Math.max(0.3, papel.espessura || 1);
  const el = linhasDoModelo(papel, largura, altura, cores.linha, esp, lw, papel.margem ? MARGEM_X : 0, papel.cabecalho ? CABECALHO_Y : 0);
  if (papel.margem) el.push(linhaV(MARGEM_X, 0, altura, COR_MARGEM, lw));
  if (papel.cabecalho) el.push(linhaH(CABECALHO_Y, 0, largura, cores.linha, lw));
  const fundo = cores.fundo ? `<rect width="${largura}" height="${altura}" fill="${cores.fundo}"/>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" preserveAspectRatio="none">` +
    `<defs><clipPath id="folha"><rect width="${largura}" height="${altura}"/></clipPath></defs>` +
    `${fundo}<g clip-path="url(#folha)">${el.join("")}</g></svg>`
  );
}

/** A mesma folha como `data:` URI, pronta para `background-image` ou `<img>`. */
export function papelDataUri(papel: Papel, largura: number, altura: number, cores: CoresPapel): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgPapel(papel, largura, altura, cores))}`;
}
