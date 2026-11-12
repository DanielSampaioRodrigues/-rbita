// Fontes do caderno (algo como o NotebookLM, feito dentro do Órbita). A pessoa junta
// PDFs, livros (EPUB), Word, textos e fotos ao caderno. O texto é tirado no aparelho e
// dividido em trechos; a busca dos trechos que importam também é feita aqui (BM25).
// Só esses trechos vão para a IA, cada um com uma etiqueta [F2 p.14], e a resposta
// cita de onde tirou cada coisa: tocar na etiqueta abre a fonte naquela página.
import { api } from "../api";

export type TipoFonte = "pdf" | "epub" | "word" | "texto" | "imagem" | "nota";

export interface FonteCaderno {
  id: string;
  nome: string;
  tipo: TipoFonte;
  /** Arquivo guardado no cofre (PDF, EPUB, imagem), para mostrar de onde veio. */
  anexoId?: string;
  /** O arquivo é o de um livro da Leitura (tirar a fonte não apaga o livro). */
  doLivro?: boolean;
  /** Quantas páginas (PDF) ou capítulos (EPUB). */
  partes: number;
  caracteres: number;
  /** Usar nas respostas (a pessoa pode desligar uma fonte sem tirar). */
  ligada: boolean;
  /** PDF de imagens (digitalizado) ou foto ainda não lida: sem texto. */
  semTexto?: boolean;
  /** Em quantos valores guardados os trechos estão (cada um tem até 2 MB). */
  pedacos: number;
  criadaEm: number;
}

/** Um trecho de uma fonte: o texto e onde está (página do PDF ou capítulo do EPUB). */
export interface Trecho { t: string; p?: number; cap?: number }

const CHAVE_LISTA = (cadernoId: string) => `caderno.fontes.${cadernoId}`;
const CHAVE_TRECHOS = (fonteId: string, k: number) => `caderno.fonte.${fonteId}.${k}`;
/** Tamanho de cada trecho (em caracteres), mais ou menos um parágrafo grande. */
export const TAMANHO_TRECHO = 1200;
const MAXIMO_POR_VALOR = 1_500_000;

/** Divide o texto (de uma página ou capítulo) em trechos, cortando em fim de parágrafo ou frase. */
export function dividir(texto: string, onde: { p?: number; cap?: number } = {}, tamanho = TAMANHO_TRECHO): Trecho[] {
  const limpo = texto.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  if (!limpo) return [];
  const saida: Trecho[] = [];
  let resto = limpo;
  while (resto.length > tamanho * 1.3) {
    const janela = resto.slice(0, tamanho * 1.3);
    let corte = janela.lastIndexOf("\n\n", tamanho * 1.15);
    if (corte < tamanho * 0.5) corte = Math.max(janela.lastIndexOf(". ", tamanho * 1.15), janela.lastIndexOf("\n", tamanho * 1.15));
    if (corte < tamanho * 0.5) corte = janela.lastIndexOf(" ", tamanho);
    if (corte < tamanho * 0.5) corte = tamanho;
    saida.push({ ...onde, t: resto.slice(0, corte + 1).trim() });
    resto = resto.slice(corte + 1).trim();
  }
  if (resto) saida.push({ ...onde, t: resto });
  return saida;
}

const PALAVRAS_VAZIAS = new Set("a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para pra com sem e ou que se ao aos à às é ser foi são como mais mas não sim seu sua seus suas ele ela eles elas isso isto esse essa este esta lhe me te nos vos já há tem ter qual quais quando onde porque também muito sobre entre até".split(" "));
/** Palavras para a busca: minúsculas, sem acento, sem as palavras muito comuns. */
export function palavras(texto: string): string[] {
  return texto.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !PALAVRAS_VAZIAS.has(w)).map(raiz);
}
/** Raiz simples (plural e algumas terminações), para "neurônios" achar "neurônio". */
function raiz(w: string): string {
  if (w.length > 5 && w.endsWith("coes")) return `${w.slice(0, -4)}cao`;
  if (w.length > 4 && (w.endsWith("oes") || w.endsWith("aes"))) return `${w.slice(0, -3)}ao`;
  if (w.length > 4 && w.endsWith("is")) return `${w.slice(0, -2)}l`;
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

export interface Achado { fonte: number; trecho: Trecho; nota: number; i: number }

/** Busca BM25 nos trechos de todas as fontes. `fontes[n]` é a fonte F(n+1). */
export function buscar(fontes: Trecho[][], consulta: string, quantos = 10, porFonte = 5): Achado[] {
  const termos = [...new Set(palavras(consulta))];
  if (!termos.length) return [];
  const docs: { fonte: number; i: number; trecho: Trecho; tf: Map<string, number>; n: number }[] = [];
  fontes.forEach((lista, f) => lista.forEach((trecho, i) => {
    const ws = palavras(trecho.t);
    const tf = new Map<string, number>();
    for (const w of ws) tf.set(w, (tf.get(w) ?? 0) + 1);
    docs.push({ fonte: f, i, trecho, tf, n: ws.length });
  }));
  if (!docs.length) return [];
  const media = docs.reduce((s, d) => s + d.n, 0) / docs.length || 1;
  const df = new Map(termos.map((w) => [w, docs.filter((d) => d.tf.has(w)).length]));
  const k1 = 1.4, b = 0.75;
  const notas = docs.map((d) => {
    let s = 0;
    for (const w of termos) {
      const f = d.tf.get(w);
      if (!f) continue;
      const idf = Math.log(1 + (docs.length - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.n) / media)));
    }
    return { fonte: d.fonte, trecho: d.trecho, nota: s, i: d.i };
  }).filter((a) => a.nota > 0).sort((a, b2) => b2.nota - a.nota);
  // Não deixa uma fonte só ocupar tudo.
  const conta = new Map<number, number>();
  const saida: Achado[] = [];
  for (const a of notas) {
    if ((conta.get(a.fonte) ?? 0) >= porFonte) continue;
    conta.set(a.fonte, (conta.get(a.fonte) ?? 0) + 1);
    saida.push(a);
    if (saida.length >= quantos) break;
  }
  return saida;
}

/** Trechos espalhados pela fonte toda (para resumo e fichamento, que pedem a visão geral). */
export function amostrar(fontes: Trecho[][], orcamento: number): Achado[] {
  const total = fontes.reduce((s, l) => s + l.reduce((x, t) => x + t.t.length, 0), 0);
  if (total <= orcamento) return fontes.flatMap((l, f) => l.map((trecho, i) => ({ fonte: f, trecho, nota: 0, i })));
  const saida: Achado[] = [];
  const porFonte = orcamento / Math.max(1, fontes.filter((l) => l.length).length);
  fontes.forEach((l, f) => {
    const tam = l.reduce((x, t) => x + t.t.length, 0);
    if (!tam) return;
    const fatia = Math.min(1, porFonte / tam);
    const passo = Math.max(1, Math.round(1 / fatia));
    // O começo sempre vai (introdução, sumário); depois, um a cada `passo`.
    l.forEach((trecho, i) => { if (i < 2 || i % passo === 0) saida.push({ fonte: f, trecho, nota: 0, i }); });
  });
  return saida;
}

export function etiqueta(fonte: number, t: Trecho): string {
  return t.p ? `[F${fonte + 1} p.${t.p}]` : t.cap ? `[F${fonte + 1} cap.${t.cap}]` : `[F${fonte + 1}]`;
}

/** O texto que vai para a IA: cada trecho com a etiqueta e o nome da fonte. */
export function montarTrechos(achados: Achado[], nomes: string[], limite = 100_000): string {
  // Na ordem da fonte (ler em sequência ajuda a IA a entender).
  const ordem = [...achados].sort((a, b) => a.fonte - b.fonte || a.i - b.i);
  let saida = "";
  for (const a of ordem) {
    const bloco = `${etiqueta(a.fonte, a.trecho)} ${nomes[a.fonte] ?? ""}\n${a.trecho.t}\n\n`;
    if (saida.length + bloco.length > limite) break;
    saida += bloco;
  }
  return saida.trim();
}

export interface Citacao { fonte: number; p?: number; cap?: number; texto: string }
const CITACAO = /\[F(\d{1,2})(?:,?\s*(p|cap)\.?\s*(\d{1,5}))?\]/g;
/** As citações da resposta, para virar botões que abrem a fonte. */
export function lerCitacoes(texto: string): Citacao[] {
  return [...texto.matchAll(CITACAO)].map((m) => ({ fonte: +m[1] - 1, ...(m[2] === "p" ? { p: +m[3] } : m[2] === "cap" ? { cap: +m[3] } : {}), texto: m[0] }));
}
/** Troca as citações do HTML (já limpo) por botões com os dados da fonte. */
export function citacoesEmBotoes(html: string, nFontes: number): string {
  return html.replace(CITACAO, (todo, f: string, tipo?: string, n?: string) => {
    const i = +f - 1;
    if (i < 0 || i >= nFontes) return todo;
    return `<button type="button" class="fonte-citacao" data-fonte="${i}"${tipo && n ? ` data-${tipo}="${+n}"` : ""}>${todo}</button>`;
  });
}

// ---------- Guardar (banco criptografado, valores) ----------

export async function lerFontes(cadernoId: string): Promise<FonteCaderno[]> {
  const v = await api.lerValor(CHAVE_LISTA(cadernoId)).catch(() => null);
  return Array.isArray(v) ? (v as FonteCaderno[]).filter((f) => f && typeof f.id === "string" && typeof f.nome === "string") : [];
}
export async function gravarFontes(cadernoId: string, lista: FonteCaderno[]): Promise<void> {
  await api.gravarValor(CHAVE_LISTA(cadernoId), lista);
}

/** Separa os trechos em pedaços que cabem num valor guardado. */
export function emPedacos(trechos: Trecho[], maximo = MAXIMO_POR_VALOR): Trecho[][] {
  const saida: Trecho[][] = [[]];
  let tam = 0;
  for (const t of trechos) {
    const n = t.t.length + 24;
    if (tam + n > maximo && saida[saida.length - 1].length) { saida.push([]); tam = 0; }
    saida[saida.length - 1].push(t);
    tam += n;
  }
  return saida;
}

const cache = new Map<string, Trecho[]>();
export async function gravarTrechos(fonteId: string, trechos: Trecho[]): Promise<number> {
  const pedacos = emPedacos(trechos);
  for (let k = 0; k < pedacos.length; k++) await api.gravarValor(CHAVE_TRECHOS(fonteId, k), pedacos[k]);
  cache.set(fonteId, trechos);
  return pedacos.length;
}
export async function lerTrechos(f: FonteCaderno): Promise<Trecho[]> {
  const c = cache.get(f.id);
  if (c) return c;
  const todos: Trecho[] = [];
  for (let k = 0; k < Math.max(1, f.pedacos); k++) {
    const v = await api.lerValor(CHAVE_TRECHOS(f.id, k)).catch(() => null);
    if (Array.isArray(v)) todos.push(...(v as Trecho[]).filter((t) => t && typeof t.t === "string"));
  }
  cache.set(f.id, todos);
  return todos;
}
export async function apagarTrechos(f: FonteCaderno): Promise<void> {
  cache.delete(f.id);
  for (let k = 0; k < Math.max(1, f.pedacos); k++) await api.apagarValor(CHAVE_TRECHOS(f.id, k)).catch(() => {});
}

// ---------- Tirar o texto de cada tipo de arquivo ----------

export function tipoDoArquivo(nome: string, mime: string): TipoFonte | null {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (ext === "epub" || mime === "application/epub+zip") return "epub";
  if (ext === "docx" || mime.includes("wordprocessingml")) return "word";
  if (["txt", "md", "markdown", "csv", "rtf"].includes(ext) || mime.startsWith("text/")) return "texto";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "heic"].includes(ext)) return "imagem";
  return null;
}

/** Tira o texto do arquivo, no aparelho. Devolve os trechos e quantas partes (páginas, capítulos). */
export async function textoDoArquivo(tipo: TipoFonte, bytes: ArrayBuffer, aoAndar?: (feitas: number, total: number) => void): Promise<{ trechos: Trecho[]; partes: number; semTexto: boolean }> {
  if (tipo === "pdf") {
    const { extrairTextoPdf } = await import("@orbita/leitor");
    const paginas = await extrairTextoPdf(bytes, aoAndar);
    const trechos = paginas.flatMap((t, i) => dividir(t, { p: i + 1 }));
    // Quase sem texto em página nenhuma: é um PDF de imagens (digitalizado).
    const comTexto = paginas.filter((t) => t.replace(/\s/g, "").length > 40).length;
    return { trechos, partes: paginas.length, semTexto: comTexto === 0 };
  }
  if (tipo === "epub") {
    const { extrairTextoEpub } = await import("@orbita/leitor");
    const caps = await extrairTextoEpub(bytes);
    return { trechos: caps.flatMap((c, i) => dividir(c.titulo ? `${c.titulo}\n\n${c.texto}` : c.texto, { cap: i + 1 })), partes: caps.length, semTexto: !caps.length };
  }
  if (tipo === "word") {
    const mammoth = (await import("mammoth")).default;
    const r = await mammoth.extractRawText({ arrayBuffer: bytes });
    const trechos = dividir(r.value);
    return { trechos, partes: 0, semTexto: !trechos.length };
  }
  if (tipo === "texto") {
    const trechos = dividir(new TextDecoder().decode(bytes));
    return { trechos, partes: 0, semTexto: !trechos.length };
  }
  return { trechos: [], partes: 0, semTexto: true };
}

export const novoIdFonte = () => `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Base64 de um ArrayBuffer (para guardar o arquivo no cofre). */
export function paraBase64(bytes: ArrayBuffer): string {
  const u = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function deBase64(b64: string): ArrayBuffer {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}

/** PDF digitalizado: quantas páginas a IA lê de uma vez e no máximo. */
export const PAGINAS_POR_PEDIDO = 4;
export const MAXIMO_PAGINAS_IA = 80;

/** O pedido para a IA transcrever páginas de um PDF digitalizado (com marca de página). */
export function pedidoTranscreverPaginas(numeros: number[]): string {
  return `As imagens são as páginas ${numeros.join(", ")} de um PDF digitalizado (na ordem). Transcreva fielmente todo o texto impresso de cada uma, na ordem em que aparece, sem resumir, sem corrigir e sem comentar. Antes do texto de cada página, ponha uma linha só com "=== Página N ===" (N é o número da página dado acima). Página sem texto: só a linha da marca. Tabelas e listas viram texto simples.`;
}

/** Separa a transcrição pelas marcas "=== Página N ===". Sem marcas, tudo fica na primeira página do lote. */
export function paginasDaTranscricao(texto: string, numeros: number[]): { p: number; texto: string }[] {
  const partes = texto.split(/^[ \t]*=+\s*P[áa]gina\s+(\d+)\s*=+[ \t]*$/gim);
  if (partes.length === 1) return texto.trim() ? [{ p: numeros[0] ?? 1, texto: texto.trim() }] : [];
  const out: { p: number; texto: string }[] = [];
  if (partes[0].trim()) out.push({ p: numeros[0] ?? 1, texto: partes[0].trim() });
  for (let i = 1; i + 1 < partes.length; i += 2) {
    const p = Number(partes[i]);
    const t = partes[i + 1].trim();
    if (t) out.push({ p: numeros.includes(p) ? p : numeros[Math.min(numeros.length - 1, (i - 1) / 2)] ?? p, texto: t });
  }
  return out;
}
