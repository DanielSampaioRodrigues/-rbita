// Estilos de parágrafo da própria pessoa (como "Criar um estilo" no Word e os estilos
// de parágrafo do InDesign): nome, tipo (texto ou título) e a formatação. Ficam no
// banco criptografado (`caderno.estilos`, viaja na sincronização), valem em todos os
// documentos, páginas de texto e caixas, e mudar um estilo muda todos os parágrafos
// que o usam. O texto guarda só o id do estilo (`data-meu-estilo`); o visual vem de
// um CSS gerado a partir da lista (`cssDosEstilos`, puro e testado).
import { Mark, type Editor } from "@tiptap/core";
import type { Node as NoPM } from "@tiptap/pm/model";
import { useSyncExternalStore } from "react";
import { api } from "../../api";
import { lerPt } from "./estilos";

export type BaseEstilo = "p" | "h1" | "h2" | "h3";
export type Alinhamento = "left" | "center" | "right" | "justify";

export interface EstiloProprio {
  id: string;
  nome: string;
  /** Tipo do parágrafo: texto ou título (os títulos entram no sumário). */
  base: BaseEstilo;
  /** Pilha do CSS da fonte ("" = a do estilo do documento). */
  fonte: string;
  /** Tamanho em pt (0 = o do documento). */
  tamanho: number;
  cor: string;
  negrito: boolean;
  italico: boolean;
  sublinhado: boolean;
  caixa: "" | "maiusculas" | "versalete";
  alinhamento: "" | Alinhamento;
  /** Entrelinha (0 = a do documento). */
  entrelinha: number;
  /** Recuo da primeira linha, em cm (-1 = o do documento). */
  recuoPrimeira: number;
  /** Recuo do parágrafo inteiro à esquerda, em cm. */
  recuoEsquerda: number;
  /** Espaço antes e depois, em pt (-1 = o do documento). */
  espacoAntes: number;
  espacoDepois: number;
  /** Capitular: quantas linhas a primeira letra ocupa (0 = sem). */
  capitular: number;
  /** Estilo de letra (caractere): vale para um trecho, não para o parágrafo inteiro. */
  letra?: boolean;
  /** Estilo de letra: cor do marca-texto ("" = sem). */
  fundo?: string;
}

export const ESTILO_VAZIO: Omit<EstiloProprio, "id" | "nome"> = {
  base: "p", fonte: "", tamanho: 0, cor: "", negrito: false, italico: false, sublinhado: false, caixa: "",
  alinhamento: "", entrelinha: 0, recuoPrimeira: -1, recuoEsquerda: 0, espacoAntes: -1, espacoDepois: -1, capitular: 0, letra: false, fundo: "",
};

const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[a-z0-9-]{1,40}$/;
const entre = (v: unknown, min: number, max: number, padrao: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao);
/** A pilha da fonte não pode fechar a regra do CSS (só letras, números, espaço, aspas, vírgula e hífen). */
const fonteSegura = (f: unknown) => (typeof f === "string" ? f.replace(/[^\p{L}\p{N} "',\-]/gu, "").slice(0, 200) : "");

/** Lê a lista guardada, descartando o que não for válido. */
export function lerEstilos(bruto: unknown): EstiloProprio[] {
  if (!Array.isArray(bruto)) return [];
  const vistos = new Set<string>();
  const lista: EstiloProprio[] = [];
  for (const b of bruto as Partial<EstiloProprio>[]) {
    if (!b || typeof b !== "object" || typeof b.id !== "string" || !ID.test(b.id) || vistos.has(b.id)) continue;
    const nome = typeof b.nome === "string" ? b.nome.trim().slice(0, 60) : "";
    if (!nome) continue;
    vistos.add(b.id);
    lista.push({
      id: b.id, nome,
      base: (["p", "h1", "h2", "h3"] as const).includes(b.base as BaseEstilo) ? (b.base as BaseEstilo) : "p",
      fonte: fonteSegura(b.fonte),
      tamanho: entre(b.tamanho, 0, 200, 0),
      cor: typeof b.cor === "string" && HEX.test(b.cor) ? b.cor.toLowerCase() : "",
      negrito: b.negrito === true, italico: b.italico === true, sublinhado: b.sublinhado === true,
      caixa: b.caixa === "maiusculas" || b.caixa === "versalete" ? b.caixa : "",
      alinhamento: (["left", "center", "right", "justify"] as const).includes(b.alinhamento as Alinhamento) ? (b.alinhamento as Alinhamento) : "",
      entrelinha: entre(b.entrelinha, 0, 5, 0),
      recuoPrimeira: entre(b.recuoPrimeira, -1, 10, -1),
      recuoEsquerda: entre(b.recuoEsquerda, 0, 15, 0),
      espacoAntes: entre(b.espacoAntes, -1, 200, -1),
      espacoDepois: entre(b.espacoDepois, -1, 200, -1),
      capitular: [0, 2, 3, 4, 5].includes(b.capitular as number) ? (b.capitular as number) : 0,
      letra: b.letra === true,
      fundo: typeof b.fundo === "string" && HEX.test(b.fundo) ? b.fundo.toLowerCase() : "",
    });
  }
  return lista;
}

/** As regras do CSS de um estilo (sem o seletor). O tamanho acompanha o zoom da caixa do caderno. */
export function regrasDoEstilo(e: EstiloProprio): string {
  const r: string[] = [];
  if (e.letra) {
    // Estilo de letra: só o que vale para um trecho.
    if (e.fonte) r.push(`font-family: ${e.fonte}`);
    if (e.tamanho) r.push(`font-size: calc(${e.tamanho}pt * var(--caderno-escala, 1))`);
    if (e.cor) r.push(`color: ${e.cor}`);
    if (e.negrito) r.push("font-weight: 700");
    if (e.italico) r.push("font-style: italic");
    if (e.sublinhado) r.push("text-decoration: underline");
    if (e.caixa === "maiusculas") r.push("text-transform: uppercase");
    if (e.caixa === "versalete") r.push("font-variant: small-caps");
    if (e.fundo) r.push(`background-color: ${e.fundo}`, "border-radius: 2px", "padding: 0 1px");
    return r.join("; ");
  }
  if (e.fonte) r.push(`font-family: ${e.fonte}`);
  if (e.tamanho) r.push(`font-size: calc(${e.tamanho}pt * var(--caderno-escala, 1))`);
  if (e.cor) r.push(`color: ${e.cor}`);
  if (e.negrito) r.push("font-weight: 700");
  if (e.italico) r.push("font-style: italic");
  if (e.sublinhado) r.push("text-decoration: underline");
  if (e.caixa === "maiusculas") r.push("text-transform: uppercase");
  if (e.caixa === "versalete") r.push("font-variant: small-caps", "text-transform: none");
  if (e.alinhamento) r.push(`text-align: ${e.alinhamento}`);
  if (e.entrelinha) r.push(`line-height: ${e.entrelinha}`);
  if (e.capitular) r.push("text-indent: 0");
  else if (e.recuoPrimeira >= 0) r.push(`text-indent: ${e.recuoPrimeira}cm`);
  if (e.recuoEsquerda) r.push(`margin-left: ${e.recuoEsquerda}cm`);
  if (e.espacoAntes >= 0) r.push(`margin-top: ${e.espacoAntes}pt`);
  if (e.espacoDepois >= 0) r.push(`margin-bottom: ${e.espacoDepois}pt`);
  return r.join("; ");
}

/** O CSS de todos os estilos da pessoa (vale no documento, na página de texto e nas caixas). */
export function cssDosEstilos(lista: EstiloProprio[]): string {
  return lista
    .map((e) => {
      const sel = e.letra ? `[data-meu-estilo-letra="${e.id}"]` : `[data-meu-estilo="${e.id}"]`;
      let css = `:is(.doc-conteudo, .caderno-caixa-area, .caderno-doc-conteudo) ${sel} { ${regrasDoEstilo(e)} }`;
      if (e.capitular && !e.letra) css += `\n:is(.doc-conteudo, .caderno-caixa-area, .caderno-doc-conteudo) ${sel}:not([data-capitular])::first-letter { -webkit-initial-letter: ${e.capitular}; initial-letter: ${e.capitular}; margin-right: 0.08em; }`;
      return css;
    })
    .join("\n");
}

/** Um id novo, curto. */
export const novoIdEstilo = () => `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** A formatação de letra de um trecho (as marcas do texto). */
export function estiloDasMarcas(marcas: readonly { type: { name: string }; attrs: Record<string, unknown> }[]): Partial<EstiloProprio> {
  const e: Partial<EstiloProprio> = {};
  for (const m of marcas) {
    if (m.type.name === "bold") e.negrito = true;
    else if (m.type.name === "italic") e.italico = true;
    else if (m.type.name === "underline") e.sublinhado = true;
    else if (m.type.name === "versalete") e.caixa = "versalete";
    else if (m.type.name === "highlight" && HEX.test(String(m.attrs.color ?? ""))) e.fundo = String(m.attrs.color).toLowerCase();
    else if (m.type.name === "textStyle") {
      if (m.attrs.fontFamily) e.fonte = fonteSegura(m.attrs.fontFamily);
      if (m.attrs.fontSize) e.tamanho = lerPt(String(m.attrs.fontSize));
      if (m.attrs.color && HEX.test(String(m.attrs.color))) e.cor = String(m.attrs.color).toLowerCase();
    }
  }
  return e;
}

/** Lê a formatação do trecho escolhido (onde está o cursor) como um estilo de letra. */
export function estiloDaSelecao(editor: Editor): Omit<EstiloProprio, "id" | "nome"> {
  const { $from } = editor.state.selection;
  const marcas = editor.state.storedMarks ?? $from.marks();
  const lidas = estiloDasMarcas(marcas);
  return { ...ESTILO_VAZIO, letra: true, fundo: lidas.fundo ?? "", ...lidas };
}

/** Lê a formatação de um parágrafo (o que foi mudado nele à mão) como um estilo. */
export function estiloDoParagrafo(no: NoPM, alinhamento?: string | null): Omit<EstiloProprio, "id" | "nome"> {
  const e = { ...ESTILO_VAZIO };
  if (no.type.name === "heading") {
    const n = Number(no.attrs.level);
    e.base = n === 2 ? "h2" : n >= 3 ? "h3" : "h1";
  }
  // A formatação de letra vem do primeiro trecho com texto.
  let primeiro: NoPM | null = null;
  no.descendants((f) => { if (!primeiro && f.isText) primeiro = f; return !primeiro; });
  Object.assign(e, estiloDasMarcas((primeiro as NoPM | null)?.marks ?? []));
  const al = alinhamento ?? (no.attrs.textAlign as string | null);
  if (al && ["left", "center", "right", "justify"].includes(al) && al !== "left") e.alinhamento = al as Alinhamento;
  const ent = Number(no.attrs.entrelinha);
  if (ent > 0) e.entrelinha = ent;
  const rec = Number(no.attrs.recuo);
  if (rec > 0) e.recuoEsquerda = rec * 1.25;
  const cap = Number(no.attrs.capitular);
  if (cap) e.capitular = cap;
  return e;
}

/** Descrição curta, para a lista ("Times New Roman, 14 pt, negrito, centralizado"). */
export function resumoDoEstilo(e: EstiloProprio, nomes: { titulo: (n: number) => string; texto: string; letra: string; negrito: string; italico: string; sublinhado: string; maiusculas: string; versalete: string; alinhamentos: Record<Alinhamento, string>; capitular: (n: number) => string }): string {
  const partes: string[] = [e.letra ? nomes.letra : e.base === "p" ? nomes.texto : nomes.titulo(Number(e.base.slice(1)))];
  if (e.fonte) partes.push(e.fonte.split(",")[0].replace(/["']/g, "").trim());
  if (e.tamanho) partes.push(`${e.tamanho} pt`);
  if (e.negrito) partes.push(nomes.negrito);
  if (e.italico) partes.push(nomes.italico);
  if (e.sublinhado) partes.push(nomes.sublinhado);
  if (e.caixa) partes.push(nomes[e.caixa]);
  if (e.alinhamento) partes.push(nomes.alinhamentos[e.alinhamento]);
  if (e.capitular) partes.push(nomes.capitular(e.capitular));
  return partes.join(", ");
}

// ---------- A lista guardada (uma só para o app inteiro) ----------

const CHAVE = "caderno.estilos";
let estilos: EstiloProprio[] = [];
let carregado: Promise<void> | null = null;
const ouvintes = new Set<() => void>();
let folha: HTMLStyleElement | null = null;

function aplicarCss() {
  if (typeof document === "undefined") return;
  folha ??= Object.assign(document.createElement("style"), { id: "orbita-meus-estilos" });
  if (!folha.isConnected) document.head.appendChild(folha);
  folha.textContent = cssDosEstilos(estilos);
}
function avisar() { aplicarCss(); for (const o of ouvintes) o(); }

/** Carrega a lista (uma vez) e põe o CSS na página. */
export function carregarEstilos(): Promise<void> {
  // Se falhar (cofre ainda fechado), tenta de novo na próxima vez.
  carregado ??= api.lerValor(CHAVE).then((v) => { estilos = lerEstilos(v); avisar(); }, () => { carregado = null; });
  return carregado;
}

export async function salvarEstilo(e: EstiloProprio): Promise<void> {
  await carregarEstilos();
  const i = estilos.findIndex((x) => x.id === e.id);
  estilos = i >= 0 ? estilos.map((x) => (x.id === e.id ? e : x)) : [...estilos, e];
  avisar();
  await api.gravarValor(CHAVE, estilos);
}

export async function apagarEstilo(id: string): Promise<void> {
  await carregarEstilos();
  estilos = estilos.filter((x) => x.id !== id);
  avisar();
  await api.gravarValor(CHAVE, estilos);
}

/** Os estilos da pessoa (e o CSS deles já na página). */
export function useMeusEstilos(): EstiloProprio[] {
  void carregarEstilos();
  return useSyncExternalStore(
    (o) => { ouvintes.add(o); return () => ouvintes.delete(o); },
    () => estilos,
    () => estilos,
  );
}

/** Aplica um estilo aos parágrafos da seleção: tira a fonte, o tamanho e a cor postos à
 *  mão (o negrito, o itálico, os links e o marca-texto ficam) para o estilo aparecer. */
export function aplicarMeuEstilo(editor: Editor, e: EstiloProprio) {
  const ch = editor.chain().focus();
  if (e.base === "p") ch.setParagraph(); else ch.setHeading({ level: Number(e.base.slice(1)) as 1 | 2 | 3 });
  const tipo = e.base === "p" ? "paragraph" : "heading";
  ch.updateAttributes(tipo, { meuEstilo: e.id, estilo: null, entrelinha: null, recuo: 0, capitular: null }).unsetTextAlign();
  ch.command(({ tr, state }) => {
    const marca = state.schema.marks.textStyle;
    const { from, to } = tr.selection;
    tr.doc.nodesBetween(from, to, (no, pos) => {
      if (!no.isTextblock) return true;
      if (marca) tr.removeMark(pos + 1, pos + no.nodeSize - 1, marca);
      // O versalete posto à mão também sai, se o estilo cuida da caixa.
      if (e.caixa && state.schema.marks.versalete) tr.removeMark(pos + 1, pos + no.nodeSize - 1, state.schema.marks.versalete);
      return false;
    });
    return true;
  });
  ch.run();
}

/** Aplica um estilo de letra ao trecho escolhido (tira a fonte, o tamanho, a cor e o
 *  marca-texto postos à mão no trecho, para o estilo aparecer). */
export function aplicarEstiloLetra(editor: Editor, e: EstiloProprio) {
  editor.chain().focus().unsetMark("textStyle").unsetMark("highlight").setMark("estiloLetra", { id: e.id }).run();
}

/** Tira o estilo de letra do trecho escolhido. */
export function tirarEstiloLetra(editor: Editor) {
  editor.chain().focus().unsetMark("estiloLetra").run();
}

/** A marca do estilo de letra no texto: só o id (`data-meu-estilo-letra`); o visual vem do CSS. */
export const EstiloLetra = Mark.create({
  name: "estiloLetra",
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => { const v = el.getAttribute("data-meu-estilo-letra"); return v && ID.test(v) ? v : null; },
        renderHTML: (a: { id?: string | null }) => (a.id ? { "data-meu-estilo-letra": a.id } : {}),
      },
    };
  },
  parseHTML() { return [{ tag: "span[data-meu-estilo-letra]" }]; },
  renderHTML({ HTMLAttributes }) { return ["span", HTMLAttributes, 0]; },
});

/** Tira o estilo próprio dos parágrafos da seleção (voltam ao texto normal). */
export function tirarMeuEstilo(editor: Editor) {
  editor.chain().focus().updateAttributes("paragraph", { meuEstilo: null }).updateAttributes("heading", { meuEstilo: null }).run();
}
