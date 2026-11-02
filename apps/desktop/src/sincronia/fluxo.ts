// Passos de ligar a sincronização (etapa 2d; ver docs/decisoes/0012-sincronizacao.md).
// Lógica pura, sem tela: as telas (TelasSincronia.tsx) chamam estas funções, e os testes
// (fluxo.test.ts) também.
//
// Arquivos na pasta, além dos do maestro:
//   recuperacao.orbita-sync  as 6 perguntas (abertas) + a chave trancada por PIN e respostas
//   pin.orbita-sync          resumo do PIN, trancado pela chave (aparelho novo confere se é o mesmo)
//
// Dois modos da chave (decisão de Dan, 03/11/2026): "conta" (padrão, só o Google: a chave
// fica aberta em chave.orbita-sync) e "senha" (proteção extra: envelope aberto pela senha;
// só nele valem a recuperação por PIN + 6 perguntas).
import type { Api, ModoChaveSincronia } from "../api";
import type { Armazenamento } from "./armazenamento";
import { ARQUIVO_CHAVE, JaExisteChave } from "./maestro";

export const ARQUIVO_RECUPERACAO = "recuperacao.orbita-sync";
export const ARQUIVO_PIN = "pin.orbita-sync";
export const QUANTAS_PERGUNTAS = 6;
export const MAXIMO_PERGUNTA = 200;

export type ApiFluxo = Pick<
  Api,
  | "sincroniaSituacao"
  | "sincroniaCriarChave"
  | "sincroniaCriarChaveConta"
  | "sincroniaEntrar"
  | "sincroniaEntrarPorConta"
  | "sincroniaLigarProtecao"
  | "sincroniaDesligarProtecao"
  | "sincroniaModoDaChave"
  | "sincroniaCriarRecuperacao"
  | "sincroniaPerguntas"
  | "sincroniaEntrarPorRecuperacao"
  | "sincroniaMarcaDoPin"
  | "sincroniaConferirPin"
>;

/** O que já existe na pasta da conta. */
export interface OQueTemNaPasta {
  /** Já há uma sincronização nesta conta: este aparelho entra com a senha. */
  temChave: boolean;
  /** Dá para entrar por "Esqueci a senha" (PIN + perguntas). */
  temRecuperacao: boolean;
}

export async function olharPasta(arm: Armazenamento): Promise<OQueTemNaPasta> {
  const nomes = new Set((await arm.listar()).map((a) => a.nome));
  return { temChave: nomes.has(ARQUIVO_CHAVE), temRecuperacao: nomes.has(ARQUIVO_RECUPERACAO) };
}

/**
 * A mesma regra do motor (Rust, `normalizar_resposta`): minúsculas, sem acento,
 * espaços colapsados. Aqui serve só para a tela saber se a resposta está vazia;
 * quem compara de verdade é o motor.
 */
export function normalizarResposta(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** Pares escritos pela pessoa: dá para guardar? `faltam` = quantos pares ainda incompletos. */
export function avaliarPerguntas(perguntas: string[], respostas: string[]): { ok: boolean; faltam: number; repetidas: boolean } {
  let faltam = 0;
  for (let i = 0; i < QUANTAS_PERGUNTAS; i++) {
    const p = (perguntas[i] ?? "").trim();
    const r = normalizarResposta(respostas[i] ?? "");
    if (!p || !r || p.length > MAXIMO_PERGUNTA) faltam++;
  }
  const escritas = perguntas.map((p) => normalizarResposta(p)).filter(Boolean);
  const repetidas = new Set(escritas).size !== escritas.length;
  return { ok: faltam === 0 && !repetidas, faltam, repetidas };
}

/** O modo da chave guardada na pasta ("conta" ou "senha"), ou null se ainda não há chave. */
export async function modoDaPasta(arm: Armazenamento, api: ApiFluxo): Promise<ModoChaveSincronia | null> {
  const arquivo = await arm.baixar(ARQUIVO_CHAVE);
  return arquivo === null ? null : api.sincroniaModoDaChave(arquivo);
}

/**
 * Aparelho novo, modo conta: entra sem senha. Devolve o modo que achou: "conta" (entrou),
 * "senha" (precisa da senha; nada mudou aqui) ou null (ainda não há chave na pasta).
 */
export async function entrarPelaConta(arm: Armazenamento, api: ApiFluxo): Promise<ModoChaveSincronia | null> {
  const arquivo = await arm.baixar(ARQUIVO_CHAVE);
  if (arquivo === null) return null;
  const modo = await api.sincroniaModoDaChave(arquivo);
  if (modo === "conta") await api.sincroniaEntrarPorConta(arquivo);
  return modo;
}

/**
 * Liga a proteção extra: troca o arquivo aberto pelo envelope com a senha, da MESMA chave
 * (os aparelhos já conectados continuam funcionando).
 */
export async function ligarProtecao(arm: Armazenamento, api: ApiFluxo, senha: string): Promise<void> {
  if (!(await api.sincroniaSituacao()).temChave) throw new Error("A sincronização não está ligada neste aparelho.");
  await arm.enviar(ARQUIVO_CHAVE, await api.sincroniaLigarProtecao(senha));
}

/** Desliga a proteção extra: volta o arquivo aberto, da MESMA chave. */
export async function desligarProtecao(arm: Armazenamento, api: ApiFluxo): Promise<void> {
  if (!(await api.sincroniaSituacao()).temChave) throw new Error("A sincronização não está ligada neste aparelho.");
  await arm.enviar(ARQUIVO_CHAVE, await api.sincroniaDesligarProtecao());
}

/** Troca a senha de sincronização (este aparelho já tem a chave): novo envelope da MESMA chave. */
export async function trocarSenha(arm: Armazenamento, api: ApiFluxo, senha: string): Promise<void> {
  if (!(await api.sincroniaSituacao()).temChave) throw new Error("A sincronização não está ligada neste aparelho.");
  const envelope = await api.sincroniaCriarChave(senha); // com chave existente, só faz outro envelope dela
  await arm.enviar(ARQUIVO_CHAVE, envelope);
}

/** Guarda (ou refaz) a recuperação: PIN + 6 perguntas. */
export async function guardarRecuperacao(arm: Armazenamento, api: ApiFluxo, pin: string, perguntas: string[], respostas: string[]): Promise<void> {
  const arquivo = await api.sincroniaCriarRecuperacao(pin, perguntas, respostas);
  await arm.enviar(ARQUIVO_RECUPERACAO, arquivo);
}

/** As perguntas da recuperação guardada, ou null se ainda não foi feita. */
export async function perguntasDaPasta(arm: Armazenamento, api: ApiFluxo): Promise<string[] | null> {
  const arquivo = await arm.baixar(ARQUIVO_RECUPERACAO);
  return arquivo === null ? null : api.sincroniaPerguntas(arquivo);
}

/** "Esqueci a senha": entra com o PIN e as respostas. Lança `respostas_erradas` se não confere. */
export async function entrarPorRecuperacao(arm: Armazenamento, api: ApiFluxo, pin: string, respostas: string[]): Promise<void> {
  const arquivo = await arm.baixar(ARQUIVO_RECUPERACAO);
  if (arquivo === null) throw new Error("Esta conta ainda não tem as perguntas de recuperação.");
  await api.sincroniaEntrarPorRecuperacao(arquivo, pin, respostas);
}

/** Guarda o resumo do PIN (para os aparelhos novos conferirem que é o mesmo). */
export async function guardarPin(arm: Armazenamento, api: ApiFluxo, pin: string): Promise<void> {
  await arm.enviar(ARQUIVO_PIN, await api.sincroniaMarcaDoPin(pin));
}

/**
 * Confere se o PIN é o mesmo dos outros aparelhos. `null`: ainda não há resumo na pasta
 * (então este PIN passa a ser o de referência). Precisa da chave neste aparelho.
 */
export async function conferirPin(arm: Armazenamento, api: ApiFluxo, pin: string): Promise<boolean | null> {
  const marca = await arm.baixar(ARQUIVO_PIN);
  if (marca === null) return null;
  return api.sincroniaConferirPin(marca, pin);
}

/** Erro de "já existe chave" (para a tela mudar de "ligar" para "entrar"). */
export const ehJaExisteChave = (e: unknown): e is JaExisteChave => e instanceof JaExisteChave;
