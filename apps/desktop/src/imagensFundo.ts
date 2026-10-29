// Imagens de fundo escolhidas pela pessoa (foto do aparelho ou gerada pela IA).
//
// Por que existe: as preferências ficam no localStorage, que tem pouco espaço
// (no Safari do iPad, cerca de 5 MB para tudo). Uma foto em texto (data URI)
// ocupa muito, e antes ela ia duas vezes (fundo atual + "última imagem"). Quando
// não cabia, o navegador recusava a gravação em silêncio e a imagem sumia ao reabrir.
//
// Agora a imagem vai para o IndexedDB (tem bem mais espaço e existe tanto no app
// do Windows quanto no navegador), e as preferências guardam só uma referência
// curta ("orbita-imagem:…"). Ao abrir, o app troca a referência pela imagem de novo.

import type { Preferencias } from "./preferencias";

/** Começo das referências guardadas nas preferências no lugar da imagem. */
export const PREFIXO_REF = "orbita-imagem:";

/** Maior imagem de fundo aceita (o arquivo escolhido), em bytes. */
export const LIMITE_IMAGEM_FUNDO = 8 * 1024 * 1024;

export const ehRefImagem = (s: string) => s.startsWith(PREFIXO_REF);

/** Referência curta e estável para o conteúdo (a mesma imagem sempre dá a mesma referência). */
export function refDaImagem(dados: string): string {
  // FNV-1a de 32 bits, mais o tamanho: basta para distinguir as poucas imagens guardadas.
  let h = 0x811c9dc5;
  for (let i = 0; i < dados.length; i++) {
    h ^= dados.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${PREFIXO_REF}${dados.length.toString(36)}-${(h >>> 0).toString(36)}`;
}

const ehDataUri = (s: string) => s.startsWith("data:image/");

/** Tira as imagens das preferências, deixando referências curtas no lugar. */
export function separarImagens(prefs: Preferencias): { leve: Preferencias; imagens: Map<string, string> } {
  const imagens = new Map<string, string>();
  const trocar = (s: string) => {
    if (!ehDataUri(s)) return s;
    const ref = refDaImagem(s);
    imagens.set(ref, s);
    return ref;
  };
  const fundo = prefs.fundo?.tipo === "imagem" ? { ...prefs.fundo, dados: trocar(prefs.fundo.dados) } : prefs.fundo;
  return { leve: { ...prefs, fundo, imagemFundo: trocar(prefs.imagemFundo) }, imagens };
}

/** Referências que as preferências usam (para buscar no IndexedDB). */
export function refsUsadas(prefs: Preferencias): string[] {
  const refs = new Set<string>();
  if (prefs.fundo?.tipo === "imagem" && ehRefImagem(prefs.fundo.dados)) refs.add(prefs.fundo.dados);
  if (ehRefImagem(prefs.imagemFundo)) refs.add(prefs.imagemFundo);
  return [...refs];
}

/**
 * Põe as imagens de volta no lugar das referências. Referência sem imagem
 * (apagada pelo navegador, por exemplo) volta ao fundo do tema, sem quebrar nada.
 */
export function juntarImagens(prefs: Preferencias, imagens: Map<string, string>): Preferencias {
  const achar = (s: string) => (ehRefImagem(s) ? imagens.get(s) ?? null : s);
  let fundo = prefs.fundo;
  if (fundo?.tipo === "imagem") {
    const dados = achar(fundo.dados);
    fundo = dados ? { ...fundo, dados } : null;
  }
  return { ...prefs, fundo, imagemFundo: achar(prefs.imagemFundo) ?? "" };
}

/** A imagem do fundo ainda não voltou do IndexedDB? (enquanto isso, a tela usa a cor lisa) */
export const fundoPendente = (prefs: Preferencias) => prefs.fundo?.tipo === "imagem" && ehRefImagem(prefs.fundo.dados);

// ── IndexedDB ──────────────────────────────────────────────────────────────────

const BANCO = "orbita-imagens";
const LOJA = "imagens";

let banco: Promise<IDBDatabase> | null = null;
function abrir(): Promise<IDBDatabase> {
  return (banco ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("sem IndexedDB"));
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((e) => {
    banco = null;
    throw e;
  }));
}

const comoPromessa = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Imagens já gravadas nesta sessão (para não regravar a cada mudança de preferência). */
const gravadas = new Set<string>();

/** Busca as imagens das referências. As que faltarem ficam de fora do mapa. */
export async function lerImagens(refs: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (!refs.length) return mapa;
  const loja = (await abrir()).transaction(LOJA, "readonly").objectStore(LOJA);
  // Todos os pedidos de uma vez, na mesma transação (o Safari fecha a transação se esperar entre eles).
  const valores = await Promise.all(refs.map((ref) => comoPromessa(loja.get(ref))));
  refs.forEach((ref, i) => {
    const v = valores[i];
    if (typeof v === "string") {
      mapa.set(ref, v);
      gravadas.add(ref);
    }
  });
  return mapa;
}

/**
 * Grava as imagens novas e apaga as que nenhuma preferência usa mais.
 * `manter`: todas as referências em uso (inclusive as que ainda não voltaram do banco).
 */
export async function guardarImagens(imagens: Map<string, string>, manter: string[]): Promise<void> {
  const db = await abrir();
  const usadas = new Set(manter);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LOJA, "readwrite");
    const loja = tx.objectStore(LOJA);
    for (const [ref, dados] of imagens) if (!gravadas.has(ref)) loja.put(dados, ref);
    const pedido = loja.getAllKeys();
    // As remoções saem dentro do próprio retorno, com a transação ainda aberta.
    pedido.onsuccess = () => {
      for (const k of pedido.result) if (typeof k === "string" && !usadas.has(k)) (loja.delete(k), gravadas.delete(k));
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  for (const ref of imagens.keys()) gravadas.add(ref);
}
