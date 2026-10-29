// Cofre da versão de navegador (iPad). Mesma ideia do cofre nativo
// (src-tauri/src/cofre): uma chave aleatória dos dados, que nunca é gravada
// aberta, trancada de até três jeitos:
// - pela senha (opcional);
// - pelas 6 palavras da chave de recuperação (sempre existe);
// - pelo aparelho (opcional): PIN ou abrir direto, com uma chave que o
//   navegador guarda e não deixa ser copiada (CryptoKey não extraível).
// Usa a criptografia do próprio navegador (WebCrypto): PBKDF2-SHA-256 para
// derivar a chave de uma senha e AES-GCM para trancar. Nada sai do aparelho.

/** Iterações do PBKDF2 (recomendação atual da OWASP para SHA-256). */
export const ITERACOES = 600_000;
const ROTULO_DADOS = "orbita-dados-v1";

export interface Envelope {
  sal: Uint8Array;
  iv: Uint8Array;
  cifra: Uint8Array;
  iteracoes: number;
}

export interface Trancado {
  iv: Uint8Array;
  cifra: Uint8Array;
}

/** O que fica guardado no aparelho sobre o cofre (só envelopes). */
export interface ArquivoCofreWeb {
  versao: 1;
  id: string;
  modo: "pin" | "senha" | "direto";
  senha?: Envelope;
  recuperacao: Envelope;
  /** PIN ou abrir direto: a chave dos dados trancada pela chave do aparelho. */
  aparelho?: { trancado: Trancado; pin: boolean; sal?: Uint8Array; erradas: number };
  /** As 6 palavras, trancadas com a chave dos dados (para mostrar em Ajustes). */
  palavras: Trancado;
}

const codificador = new TextEncoder();
const decodificador = new TextDecoder();
const texto = (s: string) => codificador.encode(s);

// Algumas versões do TypeScript tipam o ArrayBuffer do Uint8Array como
// "ArrayBufferLike"; o WebCrypto quer um BufferSource. Esta conversão é só de tipo.
const buf = (u: Uint8Array) => u as unknown as BufferSource;

export function aleatorio(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function derivar(segredo: string, sal: Uint8Array, iteracoes: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", buf(texto(segredo)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: buf(sal), iterations: iteracoes },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function trancar(chave: CryptoKey, dados: Uint8Array, rotulo: string): Promise<Trancado> {
  const iv = aleatorio(12);
  const cifra = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(iv), additionalData: buf(texto(rotulo)) }, chave, buf(dados)));
  return { iv, cifra };
}

/** Destranca; devolve null se a chave ou o rótulo estiverem errados. */
export async function destrancar(chave: CryptoKey, t: Trancado, rotulo: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(t.iv), additionalData: buf(texto(rotulo)) }, chave, buf(t.cifra)));
  } catch {
    return null;
  }
}

/** Tranca a chave dos dados com um segredo (senha ou palavras). */
export async function envelopar(segredo: string, chaveDados: Uint8Array, rotulo: string): Promise<Envelope> {
  const sal = aleatorio(16);
  const k = await derivar(segredo, sal, ITERACOES);
  const t = await trancar(k, chaveDados, rotulo);
  return { sal, ...t, iteracoes: ITERACOES };
}

export async function abrirEnvelope(segredo: string, e: Envelope, rotulo: string): Promise<Uint8Array | null> {
  const k = await derivar(segredo, e.sal, e.iteracoes);
  return destrancar(k, e, rotulo);
}

/** A chave dos dados como CryptoKey (para trancar e destrancar os dados). */
export function chaveDosDados(bruta: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", buf(bruta), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export const rotuloDados = (id: string) => `${ROTULO_DADOS}:${id}`;

export async function trancarTexto(chave: CryptoKey, s: string, rotulo: string): Promise<Trancado> {
  return trancar(chave, texto(s), rotulo);
}

export async function destrancarTexto(chave: CryptoKey, t: Trancado, rotulo: string): Promise<string | null> {
  const b = await destrancar(chave, t, rotulo);
  return b ? decodificador.decode(b) : null;
}

// ── Armazenamento no aparelho (IndexedDB) ──────────────────────────────────────

const BANCO = "orbita";
const LOJA = "guardado";

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let banco: Promise<IDBDatabase> | null = null;
const db = () => (banco ??= abrirBanco());

export async function ler<T>(chave: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction(LOJA, "readonly").objectStore(LOJA).get(chave);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function gravar(chave: string, valor: unknown): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(LOJA, "readwrite");
    tx.objectStore(LOJA).put(valor, chave);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** A chave do aparelho: criada uma vez, guardada sem poder ser copiada. */
export async function chaveDoAparelho(criarSeFaltar: boolean): Promise<CryptoKey | null> {
  const existente = await ler<CryptoKey>("chave-aparelho");
  if (existente || !criarSeFaltar) return existente ?? null;
  const nova = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await gravar("chave-aparelho", nova);
  return nova;
}

const ROTULO_APARELHO = "orbita-aparelho-v1";
const ROTULO_PIN = "orbita-pin-v1";

/** Tranca a chave dos dados pelo aparelho. Com PIN, tranca duas vezes: pelo PIN
 *  e depois pela chave do aparelho (copiar os dados para outro lugar não basta). */
export async function trancarAparelho(chaveDados: Uint8Array, pin: string | null): Promise<NonNullable<ArquivoCofreWeb["aparelho"]>> {
  const k = await chaveDoAparelho(true);
  if (!k) throw new Error("sem chave do aparelho");
  if (pin === null) return { trancado: await trancar(k, chaveDados, ROTULO_APARELHO), pin: false, erradas: 0 };
  const sal = aleatorio(16);
  const porPin = await trancar(await derivar(pin, sal, ITERACOES), chaveDados, ROTULO_PIN);
  const junto = new Uint8Array(12 + porPin.cifra.length);
  junto.set(porPin.iv, 0);
  junto.set(porPin.cifra, 12);
  return { trancado: await trancar(k, junto, ROTULO_APARELHO), pin: true, sal, erradas: 0 };
}

/** Destranca pelo aparelho. "sem-chave" quando o navegador perdeu a chave do aparelho. */
export async function abrirAparelho(a: NonNullable<ArquivoCofreWeb["aparelho"]>, pin: string | null): Promise<Uint8Array | null | "sem-chave"> {
  const k = await chaveDoAparelho(false);
  if (!k) return "sem-chave";
  const dentro = await destrancar(k, a.trancado, ROTULO_APARELHO);
  if (!dentro) return "sem-chave";
  if (!a.pin) return dentro;
  if (pin === null || !a.sal) return null;
  return destrancar(await derivar(pin, a.sal, ITERACOES), { iv: dentro.subarray(0, 12), cifra: dentro.subarray(12) }, ROTULO_PIN);
}

/** Pede ao navegador para não apagar os dados quando faltar espaço. */
export function pedirArmazenamentoPersistente(): void {
  void navigator.storage?.persist?.().catch(() => {});
}

// ── Base64 (para o arquivo de backup) ──────────────────────────────────────────

export function paraBase64(b: Uint8Array): string {
  let s = "";
  const passo = 0x8000;
  for (let i = 0; i < b.length; i += passo) s += String.fromCharCode(...b.subarray(i, i + passo));
  return btoa(s);
}

export function deBase64(s: string): Uint8Array {
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}
