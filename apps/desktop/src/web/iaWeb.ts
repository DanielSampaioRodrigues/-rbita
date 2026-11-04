// IA na versão de navegador (iPad). O motor (o mesmo Rust do Windows, em
// WebAssembly) lê o provedor e a chave do banco, monta o texto, diz qual pedido
// fazer e confere a resposta (src-tauri/src/ia/fluxo.rs e protocolo.rs). Aqui só
// se envia o pedido com fetch e se devolve a resposta ao motor.
// Ver docs/decisoes/0013-ia-no-navegador.md.
//
// O pedido leva a chave nos cabeçalhos: ele só passa por aqui para ser enviado.
// Nunca vai para a tela, para o console nem para o armazenamento.

import { paraBase64 } from "./cofreWeb";

/** O pedido que o motor monta (`Pedido` em protocolo.rs). */
export interface PedidoIa {
  metodo: "GET" | "POST";
  url: string;
  cabecalhos: [string, string][];
  corpo: string | null;
  /** A resposta é um arquivo (imagem): volta ao motor em base64. */
  binario: boolean;
  /** Vai para o próprio aparelho (Ollama). */
  local: boolean;
}

type Passo = { tipo: "pedir"; pedido: PedidoIa; etapa: number } | { tipo: "pronto"; valor: unknown };

/** O que o motor oferece para a IA (ver crates/motor-web/src/lib.rs). Erros: JSON do erro do Windows. */
export interface MotorIa {
  ia_avancar(comando: string, args: string, resposta?: string | null): string;
  ia_falha_de_rede(url: string, local: boolean, demorou: boolean, semInternet: boolean): string;
}

/** O mesmo tempo do Windows: modelos locais demoram no primeiro pedido. */
export const TEMPO_LIMITE_MS = 180_000;
/** Nenhuma ordem precisa de mais que três pedidos; o limite só evita voltas sem fim. */
const MAXIMO_DE_PEDIDOS = 5;

type Buscar = (url: string, init: RequestInit) => Promise<Response>;

/** Envia um pedido. Se ele nem chegou ao provedor, lança o erro já explicado pelo motor (JSON). */
export async function enviarPedido(p: PedidoIa, motor: MotorIa, buscar: Buscar = (u, i) => fetch(u, i), tempo = TEMPO_LIMITE_MS): Promise<{ situacao: number; corpo: string }> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), tempo);
  try {
    const r = await buscar(p.url, {
      method: p.metodo,
      headers: p.cabecalhos,
      body: p.corpo ?? undefined,
      signal: controle.signal,
      // Nada de cookies nem de endereço de origem: só o que o motor montou.
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    const corpo = p.binario ? paraBase64(new Uint8Array(await r.arrayBuffer())) : await r.text();
    return { situacao: r.status, corpo };
  } catch {
    // No navegador, falta de internet e provedor que não aceita página (CORS) dão o mesmo erro.
    const semInternet = typeof navigator !== "undefined" && navigator.onLine === false;
    throw motor.ia_falha_de_rede(p.url, p.local, controle.signal.aborted, semInternet);
  } finally {
    clearTimeout(relogio);
  }
}

/** Roda uma ordem de IA até o fim: pede ao motor, envia, devolve a resposta, repete. */
export async function rodarIa<T>(motor: MotorIa, comando: string, args: Record<string, unknown> | undefined, buscar?: Buscar): Promise<T> {
  const a = JSON.stringify(args ?? {});
  let passo = JSON.parse(motor.ia_avancar(comando, a, null)) as Passo;
  for (let i = 0; passo.tipo === "pedir"; i++) {
    if (i >= MAXIMO_DE_PEDIDOS) throw JSON.stringify({ codigo: "ia", mensagem: "A IA não terminou de responder. Tente de novo.", motivo: "resposta" });
    const { situacao, corpo } = await enviarPedido(passo.pedido, motor, buscar);
    passo = JSON.parse(motor.ia_avancar(comando, a, JSON.stringify({ etapa: passo.etapa, situacao, corpo }))) as Passo;
  }
  return passo.valor as T;
}
