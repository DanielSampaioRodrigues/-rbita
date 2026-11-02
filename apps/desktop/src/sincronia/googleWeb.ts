// Login com Google na versão de navegador (iPad), para a sincronização pelo Drive
// (ver docs/decisoes/0012-sincronizacao.md e docs/google-cloud-web.md).
//
// Usa o Google Identity Services no "modelo de token": o Google devolve um acesso
// de curta duração (cerca de 1 hora), só para a pasta escondida do app
// (drive.appdata) e para nome, e-mail e foto. Não existe servidor do Órbita.
//
// Privacidade: o script do Google só é carregado quando a pessoa pede para entrar
// (ou abre a tela de entrar, com `prepararGoogle`). Nada fala com o Google ao abrir o app.
// O acesso fica só na memória: fechar a aba esquece.
//
// Safari do iPad: a janela do Google só abre se nascer de um toque. Por isso
// `entrar()` chama o Google sem esperar nada antes, quando o script já está carregado.
// Se não estiver, carrega e tenta; se o Safari bloquear, avisa (`JanelaBloqueada`)
// e o segundo toque funciona (o script já estará pronto).

import { AcessoNegado, SemInternet } from "./armazenamento";

/**
 * ID do cliente "Aplicativo da Web" do Google. NÃO é segredo (vai aberto no site,
 * e o Google só aceita pedidos vindos dos endereços cadastrados). Quando Dan mandar
 * o ID, ele entra aqui. `VITE_GOOGLE_CLIENT_ID_WEB` no build, se existir, vale mais.
 */
const CLIENTE_WEB_GOOGLE = "";

export const ESCOPOS = "https://www.googleapis.com/auth/drive.appdata openid email profile";
const ESCOPO_DRIVE = "https://www.googleapis.com/auth/drive.appdata";
const SCRIPT = "https://accounts.google.com/gsi/client";
const PERFIL = "https://www.googleapis.com/oauth2/v3/userinfo";
/** Renova um pouco antes de vencer, para não falhar no meio de um envio. */
const FOLGA_MS = 2 * 60 * 1000;
/** Quanto esperar a janela do Google responder antes de desistir. */
const ESPERA_MS = 2 * 60 * 1000;

// ---------- O pedaço do Google Identity Services que usamos ----------

export interface RespostaToken {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
  error_description?: string;
}
export interface ErroDaJanela {
  type?: string;
  message?: string;
}
export interface ClienteToken {
  requestAccessToken(config?: { prompt?: string; login_hint?: string }): void;
}
export interface GoogleOauth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    prompt?: string;
    callback: (r: RespostaToken) => void;
    error_callback?: (e: ErroDaJanela) => void;
  }): ClienteToken;
  revoke(token: string, feito?: () => void): void;
}

// ---------- Erros ----------

/** O acesso venceu e o Google pediu um toque da pessoa para continuar. */
export class PrecisaEntrarDeNovo extends AcessoNegado {
  constructor() {
    super("Para continuar sincronizando, toque em “Entrar com Google” de novo.");
  }
}

/** O navegador bloqueou a janela do Google (no iPad, quando não veio de um toque). */
export class JanelaBloqueada extends Error {
  constructor() {
    super("O navegador não abriu a janela do Google. Toque em “Entrar com Google” mais uma vez.");
  }
}

/** A pessoa fechou a janela do Google ou não deu a permissão. */
export class EntradaCancelada extends Error {
  constructor(mensagem = "A entrada com Google foi cancelada. Nada mudou.") {
    super(mensagem);
  }
}

export interface PerfilGoogle {
  nome: string;
  email: string;
  /** Endereço da foto da conta (pode faltar). */
  foto: string | null;
}

export interface OpcoesLogin {
  clienteId: string;
  /** Carrega o script do Google e devolve `google.accounts.oauth2`. */
  carregar: () => Promise<GoogleOauth2>;
  /** Já carregado (para chamar o Google ainda dentro do toque). */
  jaCarregado?: () => GoogleOauth2 | null;
  fetch?: typeof fetch;
  agora?: () => number;
}

export interface LoginGoogle {
  disponivel(): boolean;
  /** Carrega o script antes do toque (chamar ao abrir a tela de entrar). */
  preparar(): Promise<void>;
  /** Abre a janela do Google. Chame direto do toque/clique, sem `await` antes. */
  entrar(opcoes?: { dica?: string }): Promise<PerfilGoogle>;
  /**
   * Acesso válido para o Drive. Se venceu, tenta renovar sem perguntar nada;
   * se o Google exigir um toque, lança `PrecisaEntrarDeNovo`. Com `forcarNovo`,
   * descarta o atual (usado quando o Drive recusou o acesso).
   */
  pegarToken(forcarNovo?: boolean): Promise<string>;
  perfil(): PerfilGoogle | null;
  entrou(): boolean;
  /** Revoga o acesso no Google e esquece tudo. */
  sair(): Promise<void>;
}

interface Pedido {
  resolver: (r: RespostaToken) => void;
  rejeitar: (e: Error) => void;
}

export function criarLoginGoogle(op: OpcoesLogin): LoginGoogle {
  const buscar = op.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const agora = op.agora ?? Date.now;
  let gis: GoogleOauth2 | null = null;
  let cliente: ClienteToken | null = null;
  let pedido: Pedido | null = null;
  let token: { valor: string; venceEm: number } | null = null;
  let perfil: PerfilGoogle | null = null;
  let renovando: Promise<string> | null = null;

  const disponivel = () => op.clienteId.trim() !== "";

  function terminar(f: (p: Pedido) => void) {
    const p = pedido;
    pedido = null;
    if (p) f(p);
  }

  function prepararCliente(g: GoogleOauth2): ClienteToken {
    if (cliente && gis === g) return cliente;
    gis = g;
    cliente = g.initTokenClient({
      client_id: op.clienteId,
      scope: ESCOPOS,
      callback: (r) => terminar((p) => p.resolver(r)),
      error_callback: (e) =>
        terminar((p) => p.rejeitar(e?.type === "popup_failed_to_open" ? new JanelaBloqueada() : e?.type === "popup_closed" ? new EntradaCancelada() : new EntradaCancelada("A janela do Google não respondeu. Tente de novo."))),
    });
    return cliente;
  }

  /** Pede um acesso ao Google. A chamada ao Google acontece já, sem esperar nada antes. */
  function pedir(c: ClienteToken, config: { prompt: string; login_hint?: string }): Promise<RespostaToken> {
    // Um pedido anterior que nunca respondeu (janela esquecida aberta) é descartado.
    terminar((p) => p.rejeitar(new EntradaCancelada()));
    const resposta = new Promise<RespostaToken>((resolver, rejeitar) => {
      const espera = setTimeout(() => terminar((p) => p.rejeitar(new EntradaCancelada("A janela do Google demorou demais. Tente de novo."))), ESPERA_MS);
      pedido = {
        resolver: (r) => (clearTimeout(espera), resolver(r)),
        rejeitar: (e) => (clearTimeout(espera), rejeitar(e)),
      };
    });
    try {
      c.requestAccessToken(config.login_hint ? config : { prompt: config.prompt });
    } catch {
      terminar((p) => p.rejeitar(new JanelaBloqueada()));
    }
    return resposta;
  }

  function guardar(r: RespostaToken): string {
    if (!r.access_token) throw new EntradaCancelada();
    // A pessoa pode desmarcar a permissão do Drive na tela do Google.
    if (r.scope !== undefined && !r.scope.split(/\s+/).includes(ESCOPO_DRIVE)) {
      gis?.revoke(r.access_token);
      throw new AcessoNegado("Na tela do Google, a permissão do Drive ficou desmarcada, então o Órbita não consegue sincronizar. Entre de novo e deixe marcada a opção “Ver, criar e excluir os próprios dados de configuração no Google Drive”.");
    }
    const segundos = Number(r.expires_in) > 0 ? Number(r.expires_in) : 3600;
    token = { valor: r.access_token, venceEm: agora() + segundos * 1000 };
    return r.access_token;
  }

  async function lerPerfil(acesso: string): Promise<PerfilGoogle> {
    let resposta: Response;
    try {
      resposta = await buscar(PERFIL, { headers: { Authorization: `Bearer ${acesso}` } });
    } catch {
      throw new SemInternet();
    }
    if (!resposta.ok) throw new AcessoNegado();
    const d = (await resposta.json()) as { name?: string; email?: string; picture?: string };
    return { nome: d.name || d.email || "Conta Google", email: d.email ?? "", foto: d.picture || null };
  }

  async function carregar(): Promise<GoogleOauth2> {
    const pronto = gis ?? op.jaCarregado?.() ?? null;
    if (pronto) return pronto;
    try {
      return await op.carregar();
    } catch {
      throw new SemInternet();
    }
  }

  return {
    disponivel,

    async preparar() {
      if (!disponivel()) return;
      prepararCliente(await carregar());
    },

    entrar(opcoes = {}) {
      if (!disponivel()) return Promise.reject(new AcessoNegado("Esta versão do Órbita ainda não tem o login do Google configurado."));
      // Com a conta já conhecida, só confirma; sem ela, deixa escolher a conta.
      const config = opcoes.dica ? { prompt: "", login_hint: opcoes.dica } : { prompt: "select_account" };
      // Script pronto: chama o Google agora, ainda dentro do toque (Safari do iPad).
      const pronto = gis ?? op.jaCarregado?.() ?? null;
      const resposta = pronto ? pedir(prepararCliente(pronto), config) : carregar().then((g) => pedir(prepararCliente(g), config));
      return resposta.then(async (r) => {
        if (r.error) throw r.error === "access_denied" ? new EntradaCancelada("A permissão não foi dada no Google. Nada mudou.") : new EntradaCancelada();
        const acesso = guardar(r);
        perfil = await lerPerfil(acesso);
        return perfil;
      });
    },

    pegarToken(forcarNovo = false) {
      if (!forcarNovo && token && token.venceEm - FOLGA_MS > agora()) return Promise.resolve(token.valor);
      if (!perfil || !gis) return Promise.reject(new PrecisaEntrarDeNovo());
      if (forcarNovo) token = null;
      // Vários envios ao mesmo tempo esperam a mesma renovação.
      renovando ??= pedir(prepararCliente(gis), { prompt: "", login_hint: perfil.email || undefined })
        .then((r) => {
          if (r.error) throw new PrecisaEntrarDeNovo();
          return guardar(r);
        })
        .catch((e) => {
          throw e instanceof AcessoNegado ? e : new PrecisaEntrarDeNovo();
        })
        .finally(() => (renovando = null));
      return renovando;
    },

    perfil: () => perfil,
    entrou: () => perfil !== null,

    async sair() {
      const t = token?.valor;
      token = null;
      perfil = null;
      if (t && gis) {
        const g = gis;
        await new Promise<void>((pronto) => {
          try {
            g.revoke(t, () => pronto());
          } catch {
            pronto();
          }
          // Sem resposta (sem internet), não prende a pessoa: o acesso vence sozinho em 1 hora.
          setTimeout(pronto, 5000);
        });
      }
    },
  };
}

// ---------- Uso real: o script do Google, carregado sob demanda ----------

type JanelaComGoogle = Window & { google?: { accounts?: { oauth2?: GoogleOauth2 } } };

function oauth2Carregado(): GoogleOauth2 | null {
  return typeof window === "undefined" ? null : ((window as JanelaComGoogle).google?.accounts?.oauth2 ?? null);
}

let carregando: Promise<GoogleOauth2> | null = null;

function carregarScript(): Promise<GoogleOauth2> {
  const ja = oauth2Carregado();
  if (ja) return Promise.resolve(ja);
  carregando ??= new Promise<GoogleOauth2>((resolver, rejeitar) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => {
      const g = oauth2Carregado();
      if (g) resolver(g);
      else rejeitar(new Error("script do Google sem oauth2"));
    };
    s.onerror = () => {
      s.remove();
      rejeitar(new Error("não carregou o script do Google"));
    };
    document.head.appendChild(s);
  }).catch((e) => {
    carregando = null; // deixa tentar de novo quando a internet voltar
    throw e;
  });
  return carregando;
}

function idDoCliente(): string {
  const doBuild = (import.meta.env?.VITE_GOOGLE_CLIENT_ID_WEB as string | undefined) ?? "";
  return (doBuild || CLIENTE_WEB_GOOGLE).trim();
}

let unico: LoginGoogle | null = null;

/** O login do Google da versão de navegador (um só por aba). */
export function loginGoogle(): LoginGoogle {
  unico ??= criarLoginGoogle({ clienteId: idDoCliente(), carregar: carregarScript, jaCarregado: oauth2Carregado });
  return unico;
}

/** Falso enquanto não houver ID do cliente: a opção some da tela e nada quebra. */
export function googleDisponivel(): boolean {
  return idDoCliente() !== "";
}
