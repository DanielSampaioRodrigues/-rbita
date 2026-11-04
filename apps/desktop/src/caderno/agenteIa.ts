// IA com liberdade total no caderno: descreve o caderno para a IA (cada coisa com um
// id curto; a escrita à mão vai agrupada em palavras), confere o plano de mudanças que
// ela devolve e aplica nas cenas. Puro e testado; quem guarda e cria páginas é o caderno.
import { transladar, limitesDe, type Cena, type Elemento, type Texto } from "@orbita/caderno";
import DOMPurify from "dompurify";
import type { EstiloProprio } from "./editor/meusEstilos";
import { palavrasDaPagina } from "./escrita";

export interface PaginaParaIa { id: string; titulo: string; texto: boolean; modelo: string; largura: number; altura: number; marcada: boolean }

/** Um id curto (e1, e2...) leva aos ids de verdade (uma palavra escrita à mão são vários traços). */
export type MapaIds = Map<string, { pid: string; ids: string[] }>;

const HEX = /^#[0-9a-f]{6}$/i;
const r = (n: number) => Math.round(n);

/** Só as propriedades de estilo que a IA pode pôr no texto. */
const ESTILOS_OK = new Set(["color", "background-color", "font-weight", "font-style", "text-decoration", "text-align", "font-size", "font-family"]);
let ganchoPosto = false;
/** HTML que a IA escreveu, limpo: marcas de texto, estilos simples e os estilos da pessoa. */
export function htmlDoAgente(html: string): string {
  if (!ganchoPosto) {
    ganchoPosto = true;
    DOMPurify.addHook("uponSanitizeAttribute", (_no, dados) => {
      if (dados.attrName !== "style") return;
      dados.attrValue = dados.attrValue
        .split(";")
        .map((d) => d.trim())
        .filter((d) => { const [k, v] = d.split(":").map((x) => x?.trim().toLowerCase() ?? ""); return ESTILOS_OK.has(k) && !!v && !/url\(|expression|@import|\\/.test(v); })
        .join("; ");
    });
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["h1", "h2", "h3", "p", "ul", "ol", "li", "strong", "em", "b", "i", "u", "s", "mark", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "hr", "br", "span"],
    ALLOWED_ATTR: ["style", "data-meu-estilo", "data-meu-estilo-letra", "data-estilo", "data-capitular"],
  });
}

const textoCurto = (html: string, n = 240) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

/** A descrição do caderno para a IA (JSON) e o mapa dos ids curtos. */
export function descreverCaderno(paginas: PaginaParaIa[], cenas: Record<string, Cena | undefined>, atualId: string, todas: boolean, estilos: EstiloProprio[], nome: string, limite = 150_000): { descricao: string; mapa: MapaIds } {
  const mapa: MapaIds = new Map();
  let n = 0;
  const curto = (pid: string, ids: string[]) => { const k = `e${++n}`; mapa.set(k, { pid, ids }); return k; };
  const detalhar = (p: PaginaParaIa) => {
    const c = cenas[p.id];
    const els = c?.elementos ?? [];
    const lista: Record<string, unknown>[] = [];
    for (const e of els) {
      if (e.tipo === "texto") lista.push({ id: curto(p.id, [e.id]), tipo: "caixa", x: r(e.x), y: r(e.y), largura: r(e.largura), html: e.texto, cor: e.cor, tamanho: e.tamanho, ...(e.fundo ? { fundo: e.fundo } : {}) });
      else if (e.tipo === "forma") lista.push({ id: curto(p.id, [e.id]), tipo: "forma", forma: e.forma, x1: r(e.x1), y1: r(e.y1), x2: r(e.x2), y2: r(e.y2), cor: e.cor });
      else if (e.tipo === "imagem") lista.push({ id: curto(p.id, [e.id]), tipo: "imagem", x: r(e.x), y: r(e.y), largura: r(e.largura), altura: r(e.altura) });
    }
    for (const w of palavrasDaPagina(els)) lista.push({ id: curto(p.id, w.ids), tipo: "escrita", x: r(w.x), y: r(w.y), largura: r(w.w), altura: r(w.h), cor: w.cor });
    const outros = els.filter((e) => e.tipo === "traco" && !["caneta", "lapis", "pincel"].includes(e.ferramenta)).length;
    return { tipo: p.texto ? "texto" : "mao", folha: p.modelo, largura: p.largura, altura: p.altura, ...(c?.documento ? { texto_html: c.documento } : {}), elementos: lista, ...(outros ? { marca_texto: outros } : {}) };
  };
  const base = (p: PaginaParaIa, i: number) => ({ n: i + 1, titulo: p.titulo || undefined, marcada: p.marcada || undefined, atual: p.id === atualId || undefined });
  let corpo = paginas.map((p, i) => (todas || p.id === atualId ? { ...base(p, i), ...detalhar(p) } : { ...base(p, i), tipo: p.texto ? "texto" : "mao", resumo: textoCurto(cenas[p.id]?.documento ?? "") || undefined }));
  let json = JSON.stringify({ caderno: nome, pagina_atual: paginas.findIndex((p) => p.id === atualId) + 1, estilos: estilos.map((e) => ({ id: e.id, nome: e.nome, letra: e.letra || undefined })), paginas: corpo });
  // Grande demais: só a página atual vai com tudo.
  if (json.length > limite && todas) {
    mapa.clear(); n = 0;
    corpo = paginas.map((p, i) => (p.id === atualId ? { ...base(p, i), ...detalhar(p) } : { ...base(p, i), tipo: p.texto ? "texto" : "mao", resumo: textoCurto(cenas[p.id]?.documento ?? "") || undefined }));
    json = JSON.stringify({ caderno: nome, pagina_atual: paginas.findIndex((p) => p.id === atualId) + 1, estilos: estilos.map((e) => ({ id: e.id, nome: e.nome })), paginas: corpo });
  }
  return { descricao: json, mapa };
}

export type Mudanca =
  | { op: "texto_da_pagina" | "acrescentar_texto"; pagina: number; html: string }
  | { op: "caixa"; id: string; html?: string; x?: number; y?: number; largura?: number; cor?: string; tamanho?: number; fundo?: string | null }
  | { op: "nova_caixa"; pagina: number; html: string; x: number; y: number; largura: number; cor?: string; tamanho?: number; fundo?: string }
  | { op: "mover"; id: string; x: number; y: number }
  | { op: "cor"; id: string; cor: string }
  | { op: "apagar"; id: string }
  | { op: "nova_pagina" | "mapa"; depois: number; html: string; titulo?: string }
  | { op: "apagar_pagina"; pagina: number }
  | { op: "mover_pagina"; pagina: number; para: number }
  | { op: "titulo_pagina"; pagina: number; titulo: string }
  | { op: "marcar_pagina"; pagina: number; marcada: boolean }
  | { op: "folha"; pagina: number; modelo?: string; corPapel?: string; corLinha?: string };

const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined);
const MODELOS = ["liso", "pautado", "quadriculado", "pontilhado", "isometrico", "planner", "partitura"];

/** Confere o plano da IA: tira o que não existe, o que não faz sentido e limpa o HTML. */
export function lerMudancas(bruto: unknown[], nPaginas: number, mapa: MapaIds): Mudanca[] {
  // Número de página que não existe é recusado (não "encosta" no último).
  const pag = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= nPaginas ? v : undefined);
  const saida: Mudanca[] = [];
  for (const b of bruto) {
    if (!b || typeof b !== "object") continue;
    const m = b as Record<string, unknown>;
    const id = typeof m.id === "string" && mapa.has(m.id) ? m.id : undefined;
    const html = typeof m.html === "string" ? htmlDoAgente(m.html) : undefined;
    const cor = typeof m.cor === "string" && HEX.test(m.cor) ? m.cor.toLowerCase() : undefined;
    switch (m.op) {
      case "texto_da_pagina": case "acrescentar_texto": { const p = pag(m.pagina); if (p && html !== undefined) saida.push({ op: m.op, pagina: p, html }); break; }
      case "caixa": if (id) saida.push({ op: "caixa", id, html, x: num(m.x, -50, 3000), y: num(m.y, -50, 5000), largura: num(m.largura, 40, 3000), cor, tamanho: num(m.tamanho, 6, 200), fundo: m.fundo === null || m.fundo === "" ? null : typeof m.fundo === "string" && HEX.test(m.fundo) ? m.fundo.toLowerCase() : undefined }); break;
      case "nova_caixa": { const p = pag(m.pagina); if (p && html) saida.push({ op: "nova_caixa", pagina: p, html, x: num(m.x, 0, 3000) ?? 60, y: num(m.y, 0, 5000) ?? 60, largura: num(m.largura, 40, 3000) ?? 400, cor, tamanho: num(m.tamanho, 6, 200), fundo: typeof m.fundo === "string" && HEX.test(m.fundo) ? m.fundo.toLowerCase() : undefined }); break; }
      case "mover": { const x = num(m.x, -50, 3000), y = num(m.y, -50, 5000); if (id && x !== undefined && y !== undefined) saida.push({ op: "mover", id, x, y }); break; }
      case "cor": if (id && cor) saida.push({ op: "cor", id, cor }); break;
      case "apagar": if (id) saida.push({ op: "apagar", id }); break;
      case "nova_pagina": case "mapa": { const d = typeof m.depois === "number" && Number.isInteger(m.depois) && m.depois >= 0 && m.depois <= nPaginas ? m.depois : undefined; if (d !== undefined && html) saida.push({ op: m.op, depois: d, html, titulo: typeof m.titulo === "string" ? m.titulo.slice(0, 80) : undefined }); break; }
      case "apagar_pagina": { const p = pag(m.pagina); if (p) saida.push({ op: "apagar_pagina", pagina: p }); break; }
      case "mover_pagina": { const p = pag(m.pagina), para = pag(m.para); if (p && para && p !== para) saida.push({ op: "mover_pagina", pagina: p, para }); break; }
      case "titulo_pagina": { const p = pag(m.pagina); if (p && typeof m.titulo === "string") saida.push({ op: "titulo_pagina", pagina: p, titulo: m.titulo.slice(0, 80) }); break; }
      case "marcar_pagina": { const p = pag(m.pagina); if (p) saida.push({ op: "marcar_pagina", pagina: p, marcada: m.marcada !== false }); break; }
      case "folha": { const p = pag(m.pagina); if (p) saida.push({ op: "folha", pagina: p, modelo: typeof m.modelo === "string" && MODELOS.includes(m.modelo) ? m.modelo : undefined, corPapel: typeof m.cor_papel === "string" && HEX.test(m.cor_papel) ? m.cor_papel : undefined, corLinha: typeof m.cor_linha === "string" && HEX.test(m.cor_linha) ? m.cor_linha : undefined }); break; }
    }
  }
  return saida;
}

const MEDIDA_PADRAO = { altura: (t: Texto) => Math.max(24, t.tamanho * 1.4 * Math.max(1, Math.ceil((t.texto.replace(/<[^>]+>/g, "").length * t.tamanho * 0.5) / Math.max(40, t.largura)))), largura: (t: Texto) => t.largura };

/** Aplica nas cenas as mudanças de elemento e de texto (as de página ficam com o caderno). */
export function aplicarNasCenas(mudancas: Mudanca[], paginas: PaginaParaIa[], cenas: Record<string, Cena | undefined>, mapa: MapaIds, novoId: () => string = () => crypto.randomUUID(), tamanhoTexto = 20): { cenas: Record<string, Cena>; alteradas: Set<string>; viraTexto: Set<string> } {
  const novas: Record<string, Cena> = {};
  const alteradas = new Set<string>();
  const viraTexto = new Set<string>();
  const cena = (pid: string): Cena => { if (!novas[pid]) novas[pid] = { ...(cenas[pid] ?? { elementos: [] }), elementos: [...(cenas[pid]?.elementos ?? [])] }; alteradas.add(pid); return novas[pid]; };
  const trocar = (pid: string, ids: string[], f: (e: Elemento) => Elemento | null) => {
    const c = cena(pid);
    c.elementos = c.elementos.flatMap((e) => { if (!ids.includes(e.id)) return [e]; const n = f(e); return n ? [n] : []; });
  };
  for (const m of mudancas) {
    if (m.op === "texto_da_pagina" || m.op === "acrescentar_texto") {
      const p = paginas[m.pagina - 1]; if (!p) continue;
      const c = cena(p.id);
      c.documento = m.op === "texto_da_pagina" ? m.html : `${c.documento ?? ""}${m.html}`;
      if (!p.texto) viraTexto.add(p.id);
    } else if (m.op === "nova_caixa") {
      const p = paginas[m.pagina - 1]; if (!p) continue;
      const t: Texto = { tipo: "texto", id: novoId(), x: m.x, y: m.y, largura: m.largura, texto: m.html, cor: m.cor ?? "#1f2937", tamanho: m.tamanho ?? tamanhoTexto, ...(m.fundo ? { fundo: m.fundo } : {}) };
      cena(p.id).elementos.push(t);
    } else if (m.op === "caixa" || m.op === "mover" || m.op === "cor" || m.op === "apagar") {
      const alvo = mapa.get(m.id); if (!alvo) continue;
      if (m.op === "apagar") { trocar(alvo.pid, alvo.ids, () => null); continue; }
      if (m.op === "cor") { trocar(alvo.pid, alvo.ids, (e) => ({ ...e, cor: m.cor }) as Elemento); continue; }
      if (m.op === "mover") {
        const els = cena(alvo.pid).elementos.filter((e) => alvo.ids.includes(e.id));
        const lim = limitesDe(els, MEDIDA_PADRAO.altura, MEDIDA_PADRAO.largura);
        if (!lim) continue;
        const dx = m.x - lim.x, dy = m.y - lim.y;
        trocar(alvo.pid, alvo.ids, (e) => transladar(e, dx, dy));
        continue;
      }
      trocar(alvo.pid, alvo.ids, (e) => {
        if (e.tipo !== "texto") return e;
        const n: Texto = { ...e };
        if (m.html !== undefined) n.texto = m.html;
        if (m.x !== undefined) n.x = m.x;
        if (m.y !== undefined) n.y = m.y;
        if (m.largura !== undefined) n.largura = m.largura;
        if (m.cor) n.cor = m.cor;
        if (m.tamanho) n.tamanho = m.tamanho;
        if (m.fundo === null) delete n.fundo; else if (m.fundo) n.fundo = m.fundo;
        return n;
      });
    }
  }
  return { cenas: novas, alteradas, viraTexto };
}

/** Quantas mudanças de cada tipo, para contar à pessoa o que a IA fez. */
export function contarMudancas(m: Mudanca[]): { paginasNovas: number; paginasApagadas: number; outras: number } {
  return {
    paginasNovas: m.filter((x) => x.op === "nova_pagina" || x.op === "mapa").length,
    paginasApagadas: m.filter((x) => x.op === "apagar_pagina").length,
    outras: m.filter((x) => !["nova_pagina", "mapa", "apagar_pagina"].includes(x.op)).length,
  };
}


/**
 * Onde cada página fica depois das mudanças de página. Os números que a IA usa são
 * sempre os da descrição (antes de qualquer mudança). Devolve a nova ordem só das
 * páginas que mudam de lugar, a ordem de cada página nova (pelo índice da mudança)
 * e as páginas apagadas. A ordem nunca é 0 (no banco, 0 quer dizer "no fim").
 */
export function arranjoDasPaginas(paginas: { id: string; ordem: number }[], mudancas: Mudanca[]): { ordens: Map<string, number>; novas: Map<number, number>; apagadas: string[] } {
  type Lugar = { id: string } | { nova: number };
  const original = paginas.map((p) => p.id);
  const arr: Lugar[] = original.map((id) => ({ id }));
  const pos = (id: string) => arr.findIndex((l) => "id" in l && l.id === id);
  let moveu = false;
  for (const m of mudancas) {
    if (m.op !== "mover_pagina") continue;
    const id = original[m.pagina - 1];
    const i = pos(id);
    if (i < 0) continue;
    const [l] = arr.splice(i, 1);
    arr.splice(Math.min(m.para - 1, arr.length), 0, l);
    moveu = true;
  }
  // Páginas novas: logo depois da página N (0 = no começo), na ordem em que vieram.
  const cauda = new Map<number, Lugar>();
  mudancas.forEach((m, i) => {
    if (m.op !== "nova_pagina" && m.op !== "mapa") return;
    const antes = cauda.get(m.depois);
    const onde = antes ? arr.indexOf(antes) + 1 : m.depois === 0 ? 0 : pos(original[m.depois - 1]) + 1;
    const l: Lugar = { nova: i };
    arr.splice(onde, 0, l);
    cauda.set(m.depois, l);
  });
  const apagadas = [...new Set(mudancas.flatMap((m) => (m.op === "apagar_pagina" ? [original[m.pagina - 1]] : [])))];
  const final = arr.filter((l) => !("id" in l && apagadas.includes(l.id)));
  const ordemDe = new Map(paginas.map((p) => [p.id, p.ordem]));
  const ordens = new Map<string, number>();
  const novas = new Map<number, number>();
  if (moveu) {
    // Mudou a ordem: renumera tudo (1, 2, 3...) e grava só o que mudou.
    final.forEach((l, i) => { if ("id" in l) { if (ordemDe.get(l.id) !== i + 1) ordens.set(l.id, i + 1); } else novas.set(l.nova, i + 1); });
    return { ordens, novas, apagadas };
  }
  // Sem mover: as páginas que já existem ficam onde estão; as novas entram no meio.
  for (let i = 0; i < final.length; ) {
    if ("id" in final[i]) { i++; continue; }
    let j = i;
    while (j < final.length && !("id" in final[j])) j++;
    const antes = i > 0 ? ordemDe.get((final[i - 1] as { id: string }).id) : undefined;
    const depois = j < final.length ? ordemDe.get((final[j] as { id: string }).id) : undefined;
    const k = j - i;
    for (let n = 1; n <= k; n++) {
      let v: number;
      if (antes !== undefined && depois !== undefined) v = antes + ((depois - antes) * n) / (k + 1);
      else if (antes !== undefined) v = antes + n;
      else if (depois !== undefined) v = depois > 0 ? (depois * n) / (k + 1) : depois - (k + 1 - n);
      else v = n;
      if (v === 0) v = -0.5 / (k + 1);
      novas.set((final[i + n - 1] as { nova: number }).nova, v);
    }
    i = j;
  }
  return { ordens, novas, apagadas };
}

/** A cópia do que a IA mexeu num pedido (fica guardada com o caderno). */
export interface ReversaoIa<P extends { id: string } = { id: string }> {
  resumo: string;
  quando: number;
  /** Como eram as páginas que mudaram de título, folha, lugar ou foram apagadas. */
  paginas: P[];
  /** Como eram as cenas mexidas (serializadas). */
  cenas: Record<string, string>;
  /** Marca de como cada cena ficou depois da IA (para saber se a pessoa mexeu depois). */
  depois: Record<string, string>;
  criadas: string[];
  apagadas: string[];
}

/** Uma marca curta de um texto (para comparar sem guardar tudo de novo). */
export function marcaDe(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h * 33) ^ texto.charCodeAt(i)) >>> 0;
  return `${texto.length}:${h.toString(36)}`;
}

export function lerReversoes<P extends { id: string }>(v: unknown): ReversaoIa<P>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((r): r is ReversaoIa<P> => !!r && typeof r === "object" && typeof r.resumo === "string" && Array.isArray(r.paginas) && Array.isArray(r.criadas) && Array.isArray(r.apagadas) && !!r.cenas && typeof r.cenas === "object")
    .map((r) => ({ ...r, depois: r.depois && typeof r.depois === "object" ? r.depois : {}, quando: typeof r.quando === "number" ? r.quando : 0 }));
}

/** Troca ids de página (quando o desfazer recria uma página apagada, ela ganha id novo). */
export function trocarIdsDaReversao<P extends { id: string }>(r: ReversaoIa<P>, trocas: Map<string, string>): ReversaoIa<P> {
  if (!trocas.size) return r;
  const t = (id: string) => trocas.get(id) ?? id;
  const chaves = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [t(k), v]));
  return { ...r, paginas: r.paginas.map((p) => ({ ...p, id: t(p.id) })), cenas: chaves(r.cenas), depois: chaves(r.depois), criadas: r.criadas.map(t), apagadas: r.apagadas.map(t) };
}

/**
 * Marca do conteúdo da cena: os elementos e o texto (sem as marcações). O editor
 * reescreve o HTML do jeito dele ao abrir (cores, espaços), e isso não é a pessoa mexendo.
 */
export function marcaDaCena(c: Cena): string {
  const texto = (c.documento ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return marcaDe(`${JSON.stringify(c.elementos)}|${texto}`);
}
