// Biblioteca do caderno (como as bibliotecas dos programas da Adobe): o que a pessoa
// usa sempre fica guardado para pôr em qualquer caderno, em qualquer aparelho.
// - "objetos": o que estava selecionado (cabeçalho desenhado, logo da faculdade, um
//   esquema, adesivos), com as posições a partir do canto do conjunto;
// - "pagina": um modelo de página (folha, tamanho e tudo o que tem nela);
// - "trecho": um texto pronto (por exemplo, uma resposta da IA).
// Cada item fica num valor próprio do banco criptografado (`caderno.bib.<id>`, até 2 MB)
// e um índice pequeno lista todos (`caderno.biblioteca`). Os dois viajam na sincronização.
// As imagens continuam no cofre (anexos), e o item guarda só a referência.
import { lerCena, serializarCena, transladar, type Cena, type Elemento } from "@orbita/caderno";
import { useSyncExternalStore } from "react";
import { api } from "../api";

export type TipoItemBiblioteca = "objetos" | "pagina" | "trecho";
export interface ItemBiblioteca { id: string; nome: string; tipo: TipoItemBiblioteca; criadoEm: number }
export interface DadosBiblioteca {
  /** objetos e página: a cena (serializada, como no banco). */
  cena?: string;
  /** objetos: largura e altura do conjunto (px de referência). */
  largura?: number;
  altura?: number;
  /** página: tamanho e folha. */
  tamanho?: string;
  papel?: unknown;
  /** trecho: HTML simples. */
  html?: string;
}

const INDICE = "caderno.biblioteca";
const chaveItem = (id: string) => `caderno.bib.${id}`;
const ID = /^[a-z0-9-]{1,40}$/;

/** Lê o índice guardado, descartando o que não for válido. */
export function lerIndice(bruto: unknown): ItemBiblioteca[] {
  if (!Array.isArray(bruto)) return [];
  const vistos = new Set<string>();
  const lista: ItemBiblioteca[] = [];
  for (const b of bruto as Partial<ItemBiblioteca>[]) {
    if (!b || typeof b.id !== "string" || !ID.test(b.id) || vistos.has(b.id)) continue;
    if (b.tipo !== "objetos" && b.tipo !== "pagina" && b.tipo !== "trecho") continue;
    vistos.add(b.id);
    lista.push({ id: b.id, nome: typeof b.nome === "string" && b.nome.trim() ? b.nome.trim().slice(0, 80) : "Sem nome", tipo: b.tipo, criadoEm: typeof b.criadoEm === "number" ? b.criadoEm : 0 });
  }
  return lista;
}

/** Os elementos escolhidos com o canto de cima à esquerda do conjunto em (0, 0). */
export function normalizarObjetos(els: Elemento[], limites: { x: number; y: number; largura: number; altura: number }): Cena {
  return { elementos: els.map((e) => transladar(e, -limites.x, -limites.y)) };
}

/** Copia elementos com ids novos (as ligações de setas e os grupos acompanham) e desloca. */
export function copiarElementos(els: Elemento[], dx: number, dy: number, novoId: () => string = () => crypto.randomUUID()): Elemento[] {
  const ids = new Map(els.map((e) => [e.id, novoId()]));
  const grupos = new Map<string, string>();
  const grupo = (g?: string) => (g ? (grupos.get(g) ?? (grupos.set(g, novoId()), grupos.get(g)!)) : undefined);
  return els.map((e) => {
    const c = { ...transladar(e, dx, dy), id: ids.get(e.id)! } as Elemento & { grupo?: string; ligaInicio?: string; ligaFim?: string };
    if (c.grupo) c.grupo = grupo(c.grupo);
    if (c.ligaInicio) { const n = ids.get(c.ligaInicio); if (n) c.ligaInicio = n; else delete c.ligaInicio; }
    if (c.ligaFim) { const n = ids.get(c.ligaFim); if (n) c.ligaFim = n; else delete c.ligaFim; }
    return c;
  });
}

/** Os elementos de um item "objetos" ou "pagina", já lidos da cena guardada. */
export function cenaDoItem(d: DadosBiblioteca | null): Cena | null {
  if (!d?.cena) return null;
  try { return lerCena(d.cena); } catch { return null; }
}

// ---------- A lista guardada ----------

let indice: ItemBiblioteca[] = [];
let carregado: Promise<void> | null = null;
const dados = new Map<string, DadosBiblioteca | null>();
const ouvintes = new Set<() => void>();
const avisar = () => { for (const o of ouvintes) o(); };

export function carregarBiblioteca(): Promise<void> {
  carregado ??= api.lerValor(INDICE).then((v) => { indice = lerIndice(v); avisar(); }, () => { carregado = null; });
  return carregado;
}

export function useBiblioteca(): ItemBiblioteca[] {
  void carregarBiblioteca();
  return useSyncExternalStore((o) => { ouvintes.add(o); return () => ouvintes.delete(o); }, () => indice, () => indice);
}

export async function lerItemBiblioteca(id: string): Promise<DadosBiblioteca | null> {
  if (dados.has(id)) return dados.get(id) ?? null;
  const v = await api.lerValor(chaveItem(id)).catch(() => null);
  const d = v && typeof v === "object" ? (v as DadosBiblioteca) : null;
  dados.set(id, d);
  return d;
}

export async function guardarNaBiblioteca(nome: string, tipo: TipoItemBiblioteca, d: DadosBiblioteca): Promise<ItemBiblioteca> {
  await carregarBiblioteca();
  const item: ItemBiblioteca = { id: `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, nome: nome.trim().slice(0, 80) || "Sem nome", tipo, criadoEm: Date.now() };
  // Primeiro o item (se for grande demais, o banco recusa e o índice não muda).
  await api.gravarValor(chaveItem(item.id), d);
  dados.set(item.id, d);
  indice = [item, ...indice];
  avisar();
  await api.gravarValor(INDICE, indice);
  return item;
}

export async function renomearItemBiblioteca(id: string, nome: string): Promise<void> {
  indice = indice.map((i) => (i.id === id ? { ...i, nome: nome.trim().slice(0, 80) || i.nome } : i));
  avisar();
  await api.gravarValor(INDICE, indice);
}

export async function apagarItemBiblioteca(id: string): Promise<void> {
  indice = indice.filter((i) => i.id !== id);
  dados.delete(id);
  avisar();
  await api.gravarValor(INDICE, indice);
  await api.apagarValor(chaveItem(id)).catch(() => undefined);
}

/** Cena serializada (para guardar). */
export const cenaParaGuardar = (c: Cena) => serializarCena(c);
