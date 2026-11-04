// Conta Google dos conectores (Drive, Docs e Classroom), à parte da sincronização:
// ligar ou desligar uma não mexe na outra.
//
// Permissões, só as necessárias:
// - drive.file: o Órbita só vê e cria os arquivos que ele mesmo pôs no Drive (nada do resto);
// - classroom.courses.readonly e classroom.coursework.me.readonly: ver as turmas, as tarefas,
//   os prazos e se a tarefa já foi entregue. Só leitura.
//
// No Windows, o login é no navegador do computador e a renovação fica no banco
// criptografado (Rust, `conector_google_*`). No navegador (iPad), o Google Identity
// Services dá um acesso de 1 hora que fica só na memória; o Órbita guarda só qual conta é.
import { api, MODO_WEB, noApp } from "../api";
import { carregarScript, idDoCliente, oauth2Carregado, type ClienteToken, type GoogleOauth2, type RespostaToken } from "../sincronia/googleWeb";

export const ESCOPO_DRIVE = "https://www.googleapis.com/auth/drive.file";
export const ESCOPO_TURMAS = "https://www.googleapis.com/auth/classroom.courses.readonly";
export const ESCOPO_TAREFAS = "https://www.googleapis.com/auth/classroom.coursework.me.readonly";
export const ESCOPOS_CONECTORES = ["openid", "email", ESCOPO_DRIVE, ESCOPO_TURMAS, ESCOPO_TAREFAS].join(" ");
const CHAVE_WEB = "conector.google.web";

export interface ContaConectada { conta: string; escopos: string }

export class SemConta extends Error {
  constructor(mensagem = "Ligue a conta Google em Ajustes > Contas conectadas.") { super(mensagem); }
}
export class SemPermissao extends Error {
  constructor(o_que: string) { super(`Na tela do Google, a permissão de ${o_que} ficou desmarcada. Em Ajustes > Contas conectadas, ligue a conta de novo e deixe essa opção marcada.`); }
}

export const temEscopo = (c: ContaConectada | null, e: string) => !!c && c.escopos.split(/\s+/).includes(e);

// ---------- Navegador (iPad) ----------
let cliente: ClienteToken | null = null;
let gis: GoogleOauth2 | null = null;
let token: { valor: string; venceEm: number; escopos: string } | null = null;
let esperando: { resolver: (r: RespostaToken) => void; rejeitar: (e: Error) => void } | null = null;

function clienteWeb(g: GoogleOauth2): ClienteToken {
  if (cliente && gis === g) return cliente;
  gis = g;
  cliente = g.initTokenClient({
    client_id: idDoCliente(),
    scope: ESCOPOS_CONECTORES,
    callback: (r) => { const e = esperando; esperando = null; e?.resolver(r); },
    error_callback: (e) => { const x = esperando; esperando = null; x?.rejeitar(new Error(e?.type === "popup_failed_to_open" ? "O navegador não abriu a janela do Google. Toque de novo." : "A entrada com Google foi cancelada. Nada mudou.")); },
  });
  return cliente;
}
function pedirWeb(c: ClienteToken, config: { prompt: string; login_hint?: string }): Promise<RespostaToken> {
  esperando?.rejeitar(new Error("cancelado"));
  return new Promise<RespostaToken>((resolver, rejeitar) => {
    esperando = { resolver, rejeitar };
    try { c.requestAccessToken(config); } catch { esperando = null; rejeitar(new Error("O navegador não abriu a janela do Google. Toque de novo.")); }
  });
}
async function emailDe(acesso: string): Promise<string> {
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${acesso}` } });
    return r.ok ? ((await r.json()) as { email?: string }).email ?? "conta Google" : "conta Google";
  } catch { return "conta Google"; }
}

// ---------- O que o resto do app usa ----------

export function conectoresDisponiveis(): boolean {
  return MODO_WEB ? idDoCliente() !== "" : true;
}

export async function contaConectada(): Promise<ContaConectada | null> {
  if (MODO_WEB) {
    const v = (await api.lerValor(CHAVE_WEB).catch(() => null)) as ContaConectada | null;
    return v && typeof v.conta === "string" ? v : null;
  }
  return api.conectorGoogleSituacao();
}

/** Liga a conta. No navegador, chame direto do toque (o Safari só abre a janela assim). */
export async function conectar(): Promise<ContaConectada> {
  if (!MODO_WEB) return api.conectorGoogleEntrar(ESCOPOS_CONECTORES);
  const pronto = gis ?? oauth2Carregado();
  const r = await (pronto ? pedirWeb(clienteWeb(pronto), { prompt: "select_account" }) : carregarScript().then((g) => pedirWeb(clienteWeb(g), { prompt: "select_account" })));
  if (!r.access_token) throw new Error("A permissão não foi dada no Google. Nada mudou.");
  const escopos = r.scope ?? ESCOPOS_CONECTORES;
  token = { valor: r.access_token, venceEm: Date.now() + (Number(r.expires_in) || 3600) * 1000, escopos };
  const c = { conta: await emailDe(r.access_token), escopos };
  await api.gravarValor(CHAVE_WEB, c);
  return c;
}

export async function desconectar(): Promise<void> {
  if (!MODO_WEB) { await api.conectorGoogleSair(); return; }
  const t = token?.valor;
  token = null;
  if (t && gis) { try { gis.revoke(t); } catch { /* sem internet: vence sozinho */ } }
  await api.apagarValor(CHAVE_WEB).catch(() => {});
}

/** Acesso de curta duração para falar com o Drive e o Classroom. */
export async function acessoGoogle(): Promise<string> {
  if (!MODO_WEB) return (await api.conectorGoogleToken()).token;
  if (token && token.venceEm - 120_000 > Date.now()) return token.valor;
  const c = await contaConectada();
  if (!c) throw new SemConta();
  const g = gis ?? oauth2Carregado() ?? (await carregarScript());
  // Renova sem perguntar; se o Google pedir um toque, a tela mostra "Entrar de novo".
  const r = await pedirWeb(clienteWeb(g), { prompt: "", login_hint: c.conta });
  if (!r.access_token) throw new SemConta("Para continuar, toque em “Ligar a conta Google” de novo.");
  token = { valor: r.access_token, venceEm: Date.now() + (Number(r.expires_in) || 3600) * 1000, escopos: r.scope ?? c.escopos };
  return token.valor;
}

/** Na simulação (prévia e testes), Drive e Classroom são de mentira. */
export const simulado = () => !noApp && !MODO_WEB;
