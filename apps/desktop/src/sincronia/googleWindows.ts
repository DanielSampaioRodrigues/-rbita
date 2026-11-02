// Acesso ao Drive no Windows, para o mesmo `driveRest.ts` do navegador.
// A conta Google já fica ligada desde a 0.22.0 (login com PKCE no lado nativo). O
// comando `nuvem_token_google` devolve um acesso de curta duração (cerca de 1 hora,
// só a pasta do app); a renovação continua no banco criptografado e nunca vem para cá.

import { invoke } from "@tauri-apps/api/core";
import { AcessoNegado, SemInternet } from "./armazenamento";

/** Pede de novo um pouco antes de vencer. */
const FOLGA_MS = 2 * 60 * 1000;

interface TokenGoogle {
  token: string;
  /** Milissegundos desde 1970. */
  expiraEm: number;
}

type Invocar = (comando: string) => Promise<unknown>;

/** Erro do lado nativo (`Erro` serializado em comandos.rs) para os erros da sincronização. */
function traduzir(e: unknown): Error {
  const x = (e ?? {}) as { codigo?: string; motivo?: string; mensagem?: string };
  if (x.codigo === "nuvem") {
    if (x.motivo === "rede") return new SemInternet();
    if (x.motivo === "limite" || x.motivo === "servico") return new SemInternet();
    return new AcessoNegado(x.mensagem);
  }
  if (x.codigo === "bloqueado") return new AcessoNegado("O Órbita está trancado. Abra o Órbita para sincronizar.");
  return new Error(x.mensagem ?? String(e));
}

/** `pegarToken` para `criarDriveRest` no Windows. */
export function tokenDoWindows(invocar: Invocar = (c) => invoke(c), agora: () => number = Date.now): (forcarNovo?: boolean) => Promise<string> {
  let atual: TokenGoogle | null = null;
  let pedindo: Promise<string> | null = null;
  return (forcarNovo = false) => {
    if (!forcarNovo && atual && atual.expiraEm - FOLGA_MS > agora()) return Promise.resolve(atual.token);
    if (forcarNovo) atual = null;
    pedindo ??= invocar("nuvem_token_google")
      .then((r) => {
        atual = r as TokenGoogle;
        return atual.token;
      })
      .catch((e) => {
        throw traduzir(e);
      })
      .finally(() => (pedindo = null));
    return pedindo;
  };
}
