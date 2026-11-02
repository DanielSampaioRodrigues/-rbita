// Adaptador do Google Drive para a sincronização (ver docs/decisoes/0012-sincronizacao.md).
// Fala com a API REST v3 do Drive por `fetch`, só na pasta escondida do app
// (`appDataFolder`). Serve igual no navegador (acesso vindo de `googleWeb.ts`) e no
// Windows (acesso vindo do lado nativo, `googleWindows.ts`).
//
// Tudo o que passa por aqui já vem trancado pelo motor: o Drive nunca vê dado aberto.

import { AcessoNegado, SemInternet, type ArquivoRemoto, type Armazenamento } from "./armazenamento";

const ARQUIVOS = "https://www.googleapis.com/drive/v3/files";
const ENVIO = "https://www.googleapis.com/upload/drive/v3/files";
const CAMPOS = "id,name,modifiedTime,version";
/** Esperas entre novas tentativas quando o Google pede calma (429) ou falha (5xx). */
const ESPERAS_MS = [500, 1500, 4000];
/** Sem resposta nesse tempo, conta como sem internet. */
const LIMITE_MS = 60_000;

/** O Drive está ocupado ou com falha agora. É um "tente mais tarde", como sem internet. */
export class DriveOcupado extends SemInternet {
  constructor() {
    super();
    this.message = "O Google Drive está ocupado agora. O Órbita tenta de novo daqui a pouco.";
  }
}

export interface OpcoesDrive {
  /** Acesso válido ao Drive. Com `forcarNovo`, renova mesmo que o atual pareça válido. */
  pegarToken: (forcarNovo?: boolean) => Promise<string>;
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
}

interface ArquivoDrive {
  id: string;
  name: string;
  modifiedTime?: string;
  version?: string;
}

/** Texto entre aspas simples numa consulta do Drive. */
function aspas(texto: string): string {
  return `'${texto.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function comoArquivo(f: ArquivoDrive): ArquivoRemoto {
  const alteradoEm = f.modifiedTime ? Date.parse(f.modifiedTime) : 0;
  return { nome: f.name, versao: f.version ?? f.modifiedTime ?? "", alteradoEm: Number.isFinite(alteradoEm) ? alteradoEm : 0 };
}

const MAIS_NOVO = (a: ArquivoDrive, b: ArquivoDrive) => (Date.parse(b.modifiedTime ?? "") || 0) - (Date.parse(a.modifiedTime ?? "") || 0);

export function criarDriveRest(op: OpcoesDrive): Armazenamento {
  const buscar = op.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const esperar = op.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  /** Id de cada arquivo pelo nome, para não procurar de novo a cada envio. */
  const ids = new Map<string, string>();
  /** Envios do mesmo nome em fila, para não criar dois arquivos com o mesmo nome. */
  const filas = new Map<string, Promise<unknown>>();

  async function umaVez(url: string, init: RequestInit, token: string): Promise<Response> {
    const parar = new AbortController();
    const relogio = setTimeout(() => parar.abort(), LIMITE_MS);
    try {
      return await buscar(url, { ...init, signal: parar.signal, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
    } catch {
      throw new SemInternet();
    } finally {
      clearTimeout(relogio);
    }
  }

  /**
   * Faz o pedido com as regras de erro: acesso recusado renova uma vez; 429/5xx (e o
   * 403 de "limite de uso") tentam de novo até 3 vezes. 404 volta para quem chamou.
   */
  async function pedir(url: string, init: RequestInit = {}): Promise<Response> {
    let token = await op.pegarToken();
    let renovou = false;
    let tentativas = 0;
    for (;;) {
      const r = await umaVez(url, init, token);
      if (r.ok || r.status === 404) return r;
      const corpo = await r.text().catch(() => "");
      const limite = r.status === 429 || r.status >= 500 || (r.status === 403 && /rateLimitExceeded|userRateLimitExceeded|RATE_LIMIT/.test(corpo));
      if (limite) {
        if (tentativas >= ESPERAS_MS.length) throw new DriveOcupado();
        const pedido = Number(r.headers.get("Retry-After"));
        await esperar(pedido > 0 && pedido <= 10 ? pedido * 1000 : ESPERAS_MS[tentativas]);
        tentativas++;
        continue;
      }
      if (r.status === 401 || r.status === 403) {
        if (!renovou) {
          renovou = true;
          token = await op.pegarToken(true);
          continue;
        }
        throw new AcessoNegado(motivoDaRecusa(corpo));
      }
      throw new Error(`O Google Drive respondeu de um jeito inesperado (código ${r.status}). Tente de novo.`);
    }
  }

  async function json<T>(r: Response): Promise<T> {
    try {
      return (await r.json()) as T;
    } catch {
      throw new SemInternet(); // resposta cortada no meio
    }
  }

  async function consultar(q: string): Promise<ArquivoDrive[]> {
    const todos: ArquivoDrive[] = [];
    let pagina: string | undefined;
    do {
      const p = new URLSearchParams({ spaces: "appDataFolder", q, fields: `nextPageToken,files(${CAMPOS})`, pageSize: "1000" });
      if (pagina) p.set("pageToken", pagina);
      const r = await pedir(`${ARQUIVOS}?${p}`);
      if (r.status === 404) throw new AcessoNegado();
      const d = await json<{ files?: ArquivoDrive[]; nextPageToken?: string }>(r);
      todos.push(...(d.files ?? []));
      pagina = d.nextPageToken;
    } while (pagina);
    return todos;
  }

  /** Id do arquivo com esse nome (o mais novo, se houver repetido), ou null. */
  async function achar(nome: string): Promise<string | null> {
    const guardado = ids.get(nome);
    if (guardado) return guardado;
    const [f] = (await consultar(`name = ${aspas(nome)} and trashed = false`)).sort(MAIS_NOVO);
    if (!f) return null;
    ids.set(nome, f.id);
    return f.id;
  }

  async function criar(nome: string, conteudo: string): Promise<ArquivoRemoto> {
    const limite = `orbita_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const corpo =
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: nome, parents: ["appDataFolder"], mimeType: "text/plain" }) +
      `\r\n--${limite}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n` +
      conteudo +
      `\r\n--${limite}--`;
    const r = await pedir(`${ENVIO}?uploadType=multipart&fields=${CAMPOS}`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${limite}` },
      body: corpo,
    });
    if (r.status === 404) throw new AcessoNegado();
    const f = await json<ArquivoDrive>(r);
    ids.set(nome, f.id);
    return comoArquivo(f);
  }

  async function substituir(id: string, conteudo: string): Promise<ArquivoDrive | null> {
    const r = await pedir(`${ENVIO}/${encodeURIComponent(id)}?uploadType=media&fields=${CAMPOS}`, {
      method: "PATCH",
      headers: { "Content-Type": "text/plain; charset=UTF-8" },
      body: conteudo,
    });
    return r.status === 404 ? null : json<ArquivoDrive>(r);
  }

  async function enviarAgora(nome: string, conteudo: string): Promise<ArquivoRemoto> {
    const id = await achar(nome);
    if (id) {
      const f = await substituir(id, conteudo);
      if (f) return comoArquivo({ ...f, name: f.name ?? nome });
      ids.delete(nome); // apagado por outro aparelho: cria de novo
    }
    return criar(nome, conteudo);
  }

  return {
    async listar(prefixo = "") {
      const q = prefixo ? `name contains ${aspas(prefixo)} and trashed = false` : "trashed = false";
      // "contains" do Drive acha o texto no começo de palavras, não só no começo do nome: filtra aqui.
      const achados = (await consultar(q)).filter((f) => f.name.startsWith(prefixo)).sort(MAIS_NOVO);
      const vistos = new Set<string>();
      const lista: ArquivoRemoto[] = [];
      for (const f of achados) {
        if (vistos.has(f.name)) continue; // repetido: fica o mais novo
        vistos.add(f.name);
        ids.set(f.name, f.id);
        lista.push(comoArquivo(f));
      }
      return lista.sort((a, b) => a.nome.localeCompare(b.nome));
    },

    async baixar(nome) {
      for (let volta = 0; volta < 2; volta++) {
        const id = await achar(nome);
        if (!id) return null;
        const r = await pedir(`${ARQUIVOS}/${encodeURIComponent(id)}?alt=media`);
        if (r.status !== 404) {
          try {
            return await r.text();
          } catch {
            throw new SemInternet();
          }
        }
        ids.delete(nome); // o id guardado ficou velho: procura de novo
      }
      return null;
    },

    enviar(nome, conteudo) {
      const antes = filas.get(nome) ?? Promise.resolve();
      const agora = antes.catch(() => undefined).then(() => enviarAgora(nome, conteudo));
      filas.set(nome, agora);
      void agora.finally(() => filas.get(nome) === agora && filas.delete(nome)).catch(() => undefined);
      return agora;
    },

    async apagar(nome) {
      const id = await achar(nome);
      if (!id) return;
      await pedir(`${ARQUIVOS}/${encodeURIComponent(id)}`, { method: "DELETE" });
      ids.delete(nome);
    },
  };
}

/** A recusa do Drive em linguagem simples (o Google explica o motivo no corpo). */
function motivoDaRecusa(corpo: string): string {
  if (/insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient authentication scopes/.test(corpo)) {
    return "Na tela do Google, a permissão do Drive ficou desmarcada, então o Órbita não consegue sincronizar. Entre de novo e deixe marcada a opção “Ver, criar e excluir os próprios dados de configuração no Google Drive”.";
  }
  if (/accessNotConfigured|SERVICE_DISABLED/.test(corpo)) {
    return "O Google Drive não está ligado no cadastro do Órbita no Google. Isso é do lado de quem publica o Órbita, não seu.";
  }
  return "A conta Google não deixou o Órbita entrar na pasta do app. Entre com Google de novo.";
}
