// Edição de objetos do caderno: acerto de toque, grupos, camadas por nível,
// conectores das setas e a borracha por objeto. Tudo puro (sem React, sem DOM),
// para testar à parte; o Caderno.tsx só chama.

import { formaAtingida, limitesDe, tracoAtingido, type Elemento, type Forma, type Imagem, type Limites, type Texto } from "@orbita/caderno";

/** Mede uma caixa de texto (largura e altura reais, em px de referência). */
export type MedidaTexto = { altura: (t: Texto) => number; largura: (t: Texto) => number };

/** Limites de um elemento só (ou null). */
export function limitesDoElemento(el: Elemento, m: MedidaTexto): Limites | null {
  return limitesDe([el], m.altura, m.largura);
}

/** O ponto cai dentro da imagem (girada ou não), com folga `raio`? */
export function imagemAtingida(img: Imagem, x: number, y: number, raio: number): boolean {
  const cx = img.x + img.largura / 2, cy = img.y + img.altura / 2;
  // Desfaz o giro da imagem no ponto e testa contra a caixa reta.
  const r = (-(img.rot ?? 0) * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
  const lx = cx + (x - cx) * co - (y - cy) * si;
  const ly = cy + (x - cx) * si + (y - cy) * co;
  return lx >= img.x - raio && lx <= img.x + img.largura + raio && ly >= img.y - raio && ly <= img.y + img.altura + raio;
}

function dentroDaCaixa(b: Limites | null, x: number, y: number, folga: number): boolean {
  return !!b && x >= b.x - folga && x <= b.x + b.largura + folga && y >= b.y - folga && y <= b.y + b.altura + folga;
}

/** O elemento está sob o ponto? Traços e formas pelo contorno (com tolerância);
 *  imagens e textos pela caixa. Usado para tocar e selecionar, e pela borracha
 *  por objeto. */
export function elementoNoPonto(el: Elemento, x: number, y: number, tol: number, m: MedidaTexto): boolean {
  if (el.tipo === "traco") return tracoAtingido(el, x, y, tol + el.espessura / 2);
  if (el.tipo === "forma") return formaAtingida(el, x, y, tol + el.espessura / 2);
  if (el.tipo === "imagem") return imagemAtingida(el, x, y, tol / 2);
  return dentroDaCaixa(limitesDoElemento(el, m), x, y, tol / 2);
}

const FECHADAS = new Set(["retangulo", "elipse", "triangulo", "losango", "estrela"]);

/** O objeto de cima (o último desenhado) sob o ponto, ou undefined. Primeiro
 *  vale o contorno (traço, borda da forma, imagem, texto); se nada encostar,
 *  vale o miolo de uma forma fechada (tocar dentro do retângulo pega ele). */
export function objetoNoPonto(els: Elemento[], x: number, y: number, tol: number, m: MedidaTexto): Elemento | undefined {
  for (let i = els.length - 1; i >= 0; i--) if (elementoNoPonto(els[i], x, y, tol, m)) return els[i];
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el.tipo === "forma" && FECHADAS.has(el.forma) && dentroDaCaixa(limitesDoElemento(el, m), x, y, 0)) return el;
  }
  return undefined;
}

/** Acrescenta aos ids todos os outros membros dos grupos tocados. */
export function expandirGrupos(els: Elemento[], ids: string[]): string[] {
  const grupos = new Set(els.filter((e) => ids.includes(e.id) && e.grupo).map((e) => e.grupo));
  if (!grupos.size) return ids;
  const extra = els.filter((e) => e.grupo && grupos.has(e.grupo) && !ids.includes(e.id)).map((e) => e.id);
  return [...ids, ...extra];
}

/** Agrupa os selecionados com um id de grupo novo. */
export function agrupar(els: Elemento[], ids: string[], grupo: string): Elemento[] {
  return els.map((e) => (ids.includes(e.id) ? { ...e, grupo } : e));
}

/** Desfaz o grupo dos selecionados (cada um volta a ser solto). */
export function desagrupar(els: Elemento[], ids: string[]): Elemento[] {
  return els.map((e) => {
    if (!ids.includes(e.id) || !e.grupo) return e;
    const { grupo: _g, ...resto } = e;
    return resto as Elemento;
  });
}

/** Os selecionados formam exatamente um grupo (dá para desagrupar)? */
export function temGrupo(els: Elemento[], ids: string[]): boolean {
  return els.some((e) => ids.includes(e.id) && !!e.grupo);
}

/** Leva os selecionados para a frente de tudo (fim) ou para trás de tudo. */
export function ordenarTudo(els: Elemento[], ids: string[], frente: boolean): Elemento[] {
  const sel = els.filter((e) => ids.includes(e.id));
  const resto = els.filter((e) => !ids.includes(e.id));
  return frente ? [...resto, ...sel] : [...sel, ...resto];
}

function cruzam(a: Limites | null, b: Limites | null): boolean {
  return !!a && !!b && a.x <= b.x + b.largura && b.x <= a.x + a.largura && a.y <= b.y + b.altura && b.y <= a.y + a.altura;
}

/** Um nível para a frente (ou para trás): os selecionados passam por cima (ou
 *  por baixo) do próximo objeto que encosta neles. Se nenhum encosta, passam
 *  só pelo vizinho, para a mudança sempre acontecer. Mantém a ordem entre os
 *  selecionados. */
export function moverUmNivel(els: Elemento[], ids: string[], frente: boolean, m: MedidaTexto): Elemento[] {
  const sel = els.filter((e) => ids.includes(e.id));
  if (!sel.length || sel.length === els.length) return els;
  const caixa = limitesDe(sel, m.altura, m.largura);
  const resto = els.filter((e) => !ids.includes(e.id));
  const idx = els.map((e, i) => (ids.includes(e.id) ? i : -1)).filter((i) => i >= 0);
  if (frente) {
    const topo = Math.max(...idx);
    const acima = els.slice(topo + 1).filter((e) => !ids.includes(e.id));
    if (!acima.length) return els;
    const alvo = acima.find((e) => cruzam(caixa, limitesDoElemento(e, m))) ?? acima[0];
    const pos = resto.indexOf(alvo) + 1;
    return [...resto.slice(0, pos), ...sel, ...resto.slice(pos)];
  }
  const fundo = Math.min(...idx);
  const abaixo = els.slice(0, fundo).filter((e) => !ids.includes(e.id)).reverse();
  if (!abaixo.length) return els;
  const alvo = abaixo.find((e) => cruzam(caixa, limitesDoElemento(e, m))) ?? abaixo[0];
  const pos = resto.indexOf(alvo);
  return [...resto.slice(0, pos), ...sel, ...resto.slice(pos)];
}

/** Ponto da borda da caixa `b` (com folga) na reta entre o centro dela e (ox, oy). */
function pontoNaBorda(b: Limites, ox: number, oy: number, folga: number): [number, number] {
  const cx = b.x + b.largura / 2, cy = b.y + b.altura / 2;
  const hw = b.largura / 2 + folga, hh = b.altura / 2 + folga;
  const dx = ox - cx, dy = oy - cy;
  if (dx === 0 && dy === 0) return [cx, cy - hh];
  const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return t >= 1 ? [cx, cy] : [cx + dx * t, cy + dy * t];
}

/** Recalcula as pontas das setas presas a objetos (conectores): cada ponta
 *  presa vai para a borda do objeto, na direção da outra ponta. Ligação com
 *  objeto que não existe mais é solta. */
export function ajustarConectores(els: Elemento[], m: MedidaTexto): Elemento[] {
  const porId = new Map(els.map((e) => [e.id, e] as const));
  let mudou = false;
  const novos = els.map((e) => {
    if (e.tipo !== "forma" || e.forma !== "seta" || (!e.ligaInicio && !e.ligaFim)) return e;
    const a = e.ligaInicio ? porId.get(e.ligaInicio) : undefined;
    const b = e.ligaFim ? porId.get(e.ligaFim) : undefined;
    const ba = a ? limitesDoElemento(a, m) : null;
    const bb = b ? limitesDoElemento(b, m) : null;
    const folga = 6 + e.espessura;
    // A "mira" de cada ponta é o centro do outro objeto (ou a outra ponta solta).
    const alvoFim: [number, number] = bb ? [bb.x + bb.largura / 2, bb.y + bb.altura / 2] : [e.x2, e.y2];
    const alvoIni: [number, number] = ba ? [ba.x + ba.largura / 2, ba.y + ba.altura / 2] : [e.x1, e.y1];
    const [x1, y1] = ba ? pontoNaBorda(ba, alvoFim[0], alvoFim[1], folga) : [e.x1, e.y1];
    const [x2, y2] = bb ? pontoNaBorda(bb, alvoIni[0], alvoIni[1], folga) : [e.x2, e.y2];
    const n: Forma = { ...e, x1, y1, x2, y2 };
    if (e.ligaInicio && !a) delete n.ligaInicio;
    if (e.ligaFim && !b) delete n.ligaFim;
    if (n.x1 !== e.x1 || n.y1 !== e.y1 || n.x2 !== e.x2 || n.y2 !== e.y2 || n.ligaInicio !== e.ligaInicio || n.ligaFim !== e.ligaFim) mudou = true;
    return n;
  });
  return mudou ? novos : els;
}

/** Ao mover uma seta sozinha (sem o objeto em que ela está presa), a ligação
 *  daquela ponta se solta — senão a seta voltaria para o lugar. */
export function soltarSetasMovidas(els: Elemento[], movidos: string[]): Elemento[] {
  return els.map((e) => {
    if (e.tipo !== "forma" || !movidos.includes(e.id)) return e;
    let n = e;
    if (e.ligaInicio && !movidos.includes(e.ligaInicio)) { n = { ...n }; delete n.ligaInicio; }
    if (e.ligaFim && !movidos.includes(e.ligaFim)) { n = { ...n }; delete n.ligaFim; }
    return n;
  });
}

/** Ids dentro do retângulo (arrastar sobre a área vazia): só o que fica inteiro dentro. */
export function idsNoRetangulo(els: Elemento[], r: Limites, m: MedidaTexto): string[] {
  return els.filter((e) => {
    const b = limitesDoElemento(e, m);
    return !!b && b.x >= r.x && b.y >= r.y && b.x + b.largura <= r.x + r.largura && b.y + b.altura <= r.y + r.altura;
  }).map((e) => e.id);
}
