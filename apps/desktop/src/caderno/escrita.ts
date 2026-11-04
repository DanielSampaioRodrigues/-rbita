// Corretor da escrita à mão: agrupa os traços da página em linhas e palavras (pelo
// lugar de cada traço: o que fica na mesma altura é a mesma linha; um vão maior entre
// traços separa as palavras) e desenha a imagem que vai para a IA, com uma caixa
// numerada em volta de cada palavra.
import type { Elemento, Traco } from "@orbita/caderno";

export interface PalavraEscrita { n: number; ids: string[]; x: number; y: number; w: number; h: number; cor: string }
interface Caixa { id: string; x1: number; y1: number; x2: number; y2: number; cor: string }

const ESCRITA = new Set(["caneta", "lapis", "pincel"]);

function caixaDoTraco(t: Traco): Caixa | null {
  if (!t.pontos.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of t.pontos) { if (p.x < x1) x1 = p.x; if (p.y < y1) y1 = p.y; if (p.x > x2) x2 = p.x; if (p.y > y2) y2 = p.y; }
  const m = (t.espessura || 2) / 2;
  return { id: t.id, x1: x1 - m, y1: y1 - m, x2: x2 + m, y2: y2 + m, cor: t.cor };
}

const mediana = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** As palavras escritas à mão na página (de cima para baixo, da esquerda para a direita). */
export function palavrasDaPagina(els: Elemento[]): PalavraEscrita[] {
  const caixas = els
    .filter((e): e is Traco => e.tipo === "traco" && ESCRITA.has(e.ferramenta))
    .map(caixaDoTraco)
    .filter((c): c is Caixa => !!c);
  if (!caixas.length) return [];
  // Altura típica de uma letra: a mediana das alturas dos traços (no mínimo 8 px).
  const altura = Math.max(8, mediana(caixas.map((c) => c.y2 - c.y1)));
  // Linhas: traços cujo centro fica perto do centro da linha.
  const linhas: { centro: number; caixas: Caixa[] }[] = [];
  for (const c of [...caixas].sort((a, b) => (a.y1 + a.y2) / 2 - (b.y1 + b.y2) / 2)) {
    const centro = (c.y1 + c.y2) / 2;
    const linha = linhas.find((l) => Math.abs(l.centro - centro) < altura * 0.75);
    if (linha) { linha.caixas.push(c); linha.centro = mediana(linha.caixas.map((x) => (x.y1 + x.y2) / 2)); }
    else linhas.push({ centro, caixas: [c] });
  }
  linhas.sort((a, b) => a.centro - b.centro);
  // Palavras: dentro da linha, um vão maior que ~40% da altura da letra separa as palavras.
  const vao = Math.max(6, altura * 0.4);
  const palavras: PalavraEscrita[] = [];
  for (const l of linhas) {
    const ord = l.caixas.sort((a, b) => a.x1 - b.x1);
    let atual: Caixa[] = [];
    let direita = -Infinity;
    const fechar = () => {
      if (!atual.length) return;
      const x1 = Math.min(...atual.map((c) => c.x1)), y1 = Math.min(...atual.map((c) => c.y1));
      const x2 = Math.max(...atual.map((c) => c.x2)), y2 = Math.max(...atual.map((c) => c.y2));
      palavras.push({ n: palavras.length + 1, ids: atual.map((c) => c.id), x: x1, y: y1, w: x2 - x1, h: y2 - y1, cor: atual[0].cor });
      atual = [];
    };
    for (const c of ord) {
      if (atual.length && c.x1 - direita > vao) fechar();
      atual.push(c);
      direita = Math.max(direita, c.x2);
    }
    fechar();
  }
  return palavras;
}

/** A imagem da página com uma caixa vermelha numerada em volta de cada palavra. */
export async function imagemComCaixas(pagina: Blob, palavras: PalavraEscrita[], escala: number): Promise<string> {
  const url = URL.createObjectURL(pagina);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const tela = document.createElement("canvas");
    tela.width = img.naturalWidth; tela.height = img.naturalHeight;
    const ctx = tela.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0);
    ctx.strokeStyle = "#e11d48"; ctx.fillStyle = "#e11d48"; ctx.lineWidth = Math.max(1, escala);
    ctx.font = `bold ${Math.round(11 * escala)}px sans-serif`;
    ctx.textBaseline = "bottom";
    for (const p of palavras) {
      const x = (p.x - 3) * escala, y = (p.y - 3) * escala, w = (p.w + 6) * escala, h = (p.h + 6) * escala;
      ctx.strokeRect(x, y, w, h);
      ctx.fillText(String(p.n), x, y);
    }
    return tela.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
