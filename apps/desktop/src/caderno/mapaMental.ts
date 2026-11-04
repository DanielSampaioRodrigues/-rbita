// Mapa mental desenhado no caderno a partir da lista aninhada que a IA devolve
// (<ul><li>tema<ul><li>ramo…</li></ul></li></ul>): o tema no meio, os ramos dos dois
// lados e os detalhes ao lado de cada ramo. Cada ideia vira uma caixa de texto (com
// a cor do ramo) e as ligações são retas presas às caixas: mover uma caixa leva a
// linha junto. Tudo continua editável à mão depois.
import type { Elemento, Forma, Texto } from "@orbita/caderno";

export interface NoMapa { texto: string; filhos: NoMapa[] }
export interface CaixaMapa { id: string; x: number; y: number; w: number; h: number; nivel: number; ramo: number; tamanho: number; texto: string }

/** Lê a lista aninhada (ul/ol). Mais de um item no topo: ganham um tema central. */
export function lerMapa(html: string): NoMapa | null {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const lista = doc.querySelector("ul, ol");
  if (!lista) return null;
  const itens = (el: Element) => Array.from(el.children).filter((c) => c.tagName === "LI");
  const no = (li: Element): NoMapa => {
    const sub = Array.from(li.children).find((c) => c.tagName === "UL" || c.tagName === "OL");
    const copia = li.cloneNode(true) as Element;
    copia.querySelectorAll("ul, ol").forEach((x) => x.remove());
    return { texto: (copia.textContent ?? "").replace(/\s+/g, " ").trim(), filhos: sub ? itens(sub).map(no) : [] };
  };
  const topo = itens(lista).map(no).filter((n) => n.texto || n.filhos.length);
  if (!topo.length) return null;
  return topo.length === 1 ? topo[0] : { texto: "Mapa mental", filhos: topo };
}

const TAMANHO = [24, 18, 15, 13];
const LARGURA = [220, 190, 170, 150];
const VAO = 14;
const COLUNA = 46;

/** Arruma as caixas: tema no centro, ramos à direita e à esquerda, tudo dentro da página. */
export function arrumarMapa(raiz: NoMapa, largura: number, altura: number, novoId: () => string = () => crypto.randomUUID()): { caixas: CaixaMapa[]; ligacoes: [string, string][] } {
  const nivelDe = (n: number) => Math.min(n, TAMANHO.length - 1);
  const medida = (texto: string, nivel: number) => {
    const t = TAMANHO[nivelDe(nivel)]; const w = LARGURA[nivelDe(nivel)];
    const porLinha = Math.max(6, Math.floor((w - 20) / (t * 0.55)));
    const linhas = Math.max(1, Math.ceil(texto.length / porLinha));
    return { w, h: Math.round(linhas * t * 1.3 + 18), t };
  };
  const alturaDe = (n: NoMapa, nivel: number): number => {
    const m = medida(n.texto, nivel);
    if (!n.filhos.length) return m.h;
    const filhos = n.filhos.reduce((s, f) => s + alturaDe(f, nivel + 1), 0) + VAO * (n.filhos.length - 1);
    return Math.max(m.h, filhos);
  };
  const caixas: CaixaMapa[] = [];
  const ligacoes: [string, string][] = [];
  const mr = medida(raiz.texto, 0);
  const cx = largura / 2, cy = altura / 2;
  const idRaiz = novoId();
  caixas.push({ id: idRaiz, x: cx - mr.w / 2, y: cy - mr.h / 2, w: mr.w, h: mr.h, nivel: 0, ramo: -1, tamanho: mr.t, texto: raiz.texto });
  // Põe um ramo (e o que vem dele) num bloco vertical que começa em `topo`.
  const por = (n: NoMapa, nivel: number, ramo: number, lado: 1 | -1, xBorda: number, topo: number, pai: string) => {
    const m = medida(n.texto, nivel);
    const bloco = alturaDe(n, nivel);
    const id = novoId();
    const x = lado === 1 ? xBorda : xBorda - m.w;
    caixas.push({ id, x, y: topo + bloco / 2 - m.h / 2, w: m.w, h: m.h, nivel, ramo, tamanho: m.t, texto: n.texto });
    ligacoes.push([pai, id]);
    const filhosAltura = n.filhos.reduce((s, f) => s + alturaDe(f, nivel + 1), 0) + VAO * Math.max(0, n.filhos.length - 1);
    let y = topo + (bloco - filhosAltura) / 2;
    const proxBorda = lado === 1 ? x + m.w + COLUNA : x - COLUNA;
    for (const f of n.filhos) { por(f, nivel + 1, ramo, lado, proxBorda, y, id); y += alturaDe(f, nivel + 1) + VAO; }
  };
  const metade = Math.ceil(raiz.filhos.length / 2);
  const lados: [NoMapa[], 1 | -1][] = [[raiz.filhos.slice(0, metade), 1], [raiz.filhos.slice(metade), -1]];
  let ramo = 0;
  for (const [ramos, lado] of lados) {
    const total = ramos.reduce((s, f) => s + alturaDe(f, 1), 0) + VAO * 2 * Math.max(0, ramos.length - 1);
    let y = cy - total / 2;
    const borda = lado === 1 ? cx + mr.w / 2 + COLUNA + 10 : cx - mr.w / 2 - COLUNA - 10;
    for (const f of ramos) { por(f, 1, ramo++, lado, borda, y, idRaiz); y += alturaDe(f, 1) + VAO * 2; }
  }
  // Não coube? Encolhe tudo em volta do centro da página.
  const minX = Math.min(...caixas.map((c) => c.x)), maxX = Math.max(...caixas.map((c) => c.x + c.w));
  const minY = Math.min(...caixas.map((c) => c.y)), maxY = Math.max(...caixas.map((c) => c.y + c.h));
  const margem = 30;
  const k = Math.min(1, (largura - margem * 2) / (maxX - minX), (altura - margem * 2) / (maxY - minY));
  const bx = (minX + maxX) / 2, by = (minY + maxY) / 2;
  for (const c of caixas) {
    c.x = Math.round(cx + (c.x - bx) * k); c.y = Math.round(cy + (c.y - by) * k);
    c.w = Math.round(c.w * k); c.h = Math.round(c.h * k); c.tamanho = Math.max(9, Math.round(c.tamanho * k));
  }
  return { caixas, ligacoes };
}

const CORES_RAMO = ["#cfe8ff", "#d9f2d0", "#ffd6e0", "#e6d9ff", "#ffe0c2", "#c9f0ee", "#fff3b0"];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** As caixas e as linhas do mapa, prontas para a cena da página. */
export function elementosDoMapa(raiz: NoMapa, largura: number, altura: number, novoId?: () => string): Elemento[] {
  const { caixas, ligacoes } = arrumarMapa(raiz, largura, altura, novoId);
  const porId = new Map(caixas.map((c) => [c.id, c]));
  const textos: Texto[] = caixas.map((c) => ({
    tipo: "texto", id: c.id, x: c.x, y: c.y, largura: c.w, texto: `<p>${c.nivel === 0 ? `<strong>${esc(c.texto)}</strong>` : esc(c.texto)}</p>`,
    cor: "#1f2937", tamanho: c.tamanho, alinhamento: "centro",
    fundo: c.nivel === 0 ? "#fff3b0" : CORES_RAMO[c.ramo % CORES_RAMO.length],
  }));
  const linhas: Forma[] = ligacoes.map(([de, para]) => {
    const a = porId.get(de)!, b = porId.get(para)!;
    return {
      tipo: "forma", id: (novoId ?? (() => crypto.randomUUID()))(), forma: "reta",
      x1: a.x + a.w / 2, y1: a.y + a.h / 2, x2: b.x + b.w / 2, y2: b.y + b.h / 2,
      cor: "#9aa0aa", espessura: 2, ligaInicio: de, ligaFim: para,
    };
  });
  // As linhas ficam atrás das caixas.
  return [...linhas, ...textos];
}
