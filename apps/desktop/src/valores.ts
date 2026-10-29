// Cofre de valores: dados pequenos de módulo (personalização das rotinas, focos
// salvos, contas de energia…) guardados em JSON dentro do banco criptografado.
// Entram no backup e na exportação. Antes ficavam no localStorage, sem
// criptografia; na primeira leitura, o que estiver lá passa para o cofre e sai
// do localStorage.
import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";

/** Todas as chaves usadas hoje (para a exportação em JSON). */
export const CHAVES_DE_VALOR = ["rotinas.personalizacao", "rotinas.feitos", "foco.salvos", "energia.contas", "leitura.estante", "estudos.extras"] as const;
export type ChaveDeValor = (typeof CHAVES_DE_VALOR)[number];

function lerAntigo(chave: string): string | null {
  try {
    return globalThis.localStorage?.getItem(chave) ?? null;
  } catch {
    return null;
  }
}

function apagarAntigo(chave: string) {
  try {
    globalThis.localStorage?.removeItem(chave);
  } catch {
    // Sem armazenamento: nada a apagar.
  }
}

/** Dado antigo no localStorage: como ler (undefined = não há) e como apagar. */
export interface Antigo {
  ler: () => unknown;
  apagar: () => void;
}

/** O caso comum: uma chave do localStorage com JSON. */
export function antigoEmChave(chave: string): Antigo {
  return {
    ler: () => {
      const texto = lerAntigo(chave);
      if (texto === null) return undefined;
      try {
        return JSON.parse(texto) as unknown;
      } catch {
        return null; // estragado: não migra, mas apaga
      }
    },
    apagar: () => apagarAntigo(chave),
  };
}

/** Todas as chaves do localStorage que começam com `prefixo`. */
export function chavesAntigasCom(prefixo: string): string[] {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return [];
    const chaves: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k?.startsWith(prefixo)) chaves.push(k);
    }
    return chaves;
  } catch {
    return [];
  }
}

/**
 * Lê do cofre. Se o cofre ainda não tem nada e há dado antigo no localStorage,
 * passa para o cofre e só então apaga do localStorage (se a gravação falhar,
 * o dado antigo fica onde estava, para tentar de novo da próxima vez).
 */
export async function lerComMigracao<T>(chave: string, antigo: Antigo | string | undefined, validar: (bruto: unknown) => T): Promise<T | null> {
  const velho = typeof antigo === "string" ? antigoEmChave(antigo) : antigo;
  const guardado = await api.lerValor(chave);
  const bruto = velho?.ler();
  if (guardado !== null) {
    if (velho && bruto !== undefined) velho.apagar(); // já migrado antes
    return validar(guardado);
  }
  if (!velho || bruto === undefined) return null;
  if (bruto === null) {
    velho.apagar();
    return null;
  }
  const valor = validar(bruto);
  await api.gravarValor(chave, valor);
  velho.apagar();
  return valor;
}

export interface OpcoesLoja<T> {
  /** Chave no cofre, por exemplo "foco.salvos". */
  chave: ChaveDeValor;
  /** Dado antigo no localStorage (uma chave, ou um jeito próprio de ler), para migrar uma vez. */
  antiga?: string | Antigo;
  vazio: () => T;
  /** Aceita qualquer coisa e devolve um valor válido. */
  validar: (bruto: unknown) => T;
  /** Espera antes de gravar, para juntar mudanças seguidas (ms). */
  espera?: number;
}

export interface Loja<T> {
  obter: () => T;
  assinar: (ouvinte: () => void) => () => void;
  /** Lê de novo do cofre (grava antes o que estiver pendente). */
  carregar: () => Promise<void>;
  mudar: (f: (atual: T) => T) => void;
  /** Grava agora o que estiver pendente. */
  gravarAgora: () => Promise<void>;
  /** Já leu do cofre pelo menos uma vez com sucesso. */
  carregado: () => boolean;
}

/**
 * Um valor do cofre com cópia em memória, para usar com `useSyncExternalStore`.
 * Começa vazio, carrega do cofre de forma assíncrona e grava com uma pequena espera.
 * Se a leitura falhar (cofre bloqueado, por exemplo), nada é gravado por cima do
 * que está no cofre: as mudanças valem só na memória até a próxima leitura dar certo.
 */
const todas = new Set<Loja<unknown>>();
/** Grava agora tudo o que estiver pendente (ao esconder ou fechar a janela). */
export function gravarTudoAgora(): Promise<void> {
  return Promise.all([...todas].map((l) => l.gravarAgora())).then(() => undefined);
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void gravarTudoAgora());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void gravarTudoAgora();
  });
}

export function criarLoja<T>(o: OpcoesLoja<T>): Loja<T> {
  let atual = o.vazio();
  let lido = false;
  let carregando: Promise<void> | null = null;
  let pendente = false;
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const ouvintes = new Set<() => void>();
  const avisar = () => ouvintes.forEach((f) => f());

  const gravarAgora = async () => {
    clearTimeout(relogio);
    relogio = undefined;
    if (!pendente || !lido) return;
    pendente = false;
    try {
      await api.gravarValor(o.chave, atual);
    } catch {
      // Bloqueado ou sem banco: a mudança segue na memória e tenta de novo na próxima.
      pendente = true;
    }
  };

  const agendar = () => {
    pendente = true;
    clearTimeout(relogio);
    relogio = setTimeout(() => void gravarAgora(), o.espera ?? 300);
  };

  const carregar = () =>
    (carregando ??= (async () => {
      try {
        await gravarAgora();
        const valor = await lerComMigracao(o.chave, o.antiga, o.validar);
        // Se algo mudou enquanto lia, o que está na memória é mais novo.
        if (!pendente) atual = valor ?? o.vazio();
        lido = true;
        avisar();
      } catch {
        // Fica com o que está na memória; a próxima leitura tenta de novo.
      } finally {
        carregando = null;
      }
    })());

  const mudar = (f: (atual: T) => T) => {
    const aplicar = () => {
      atual = f(atual);
      if (lido) agendar(); // sem leitura boa, não grava por cima do cofre
      avisar();
    };
    // Antes da primeira leitura, espera o cofre, para não gravar por cima do que já existe.
    if (lido) aplicar();
    else void carregar().then(aplicar);
  };

  const loja: Loja<T> = {
    obter: () => atual,
    assinar: (f) => {
      ouvintes.add(f);
      return () => void ouvintes.delete(f);
    },
    carregar,
    mudar,
    gravarAgora,
    carregado: () => lido,
  };
  todas.add(loja as Loja<unknown>);
  return loja;
}

/** Usa uma loja numa tela: lê do cofre ao montar e redesenha quando muda. */
export function useLoja<T>(loja: Loja<T>): T {
  useEffect(() => void loja.carregar(), [loja]);
  return useSyncExternalStore(loja.assinar, loja.obter);
}

/** Os valores do cofre, para a exportação em JSON. */
export async function lerValoresParaExportar(): Promise<Record<string, unknown>> {
  const pares = await Promise.all(CHAVES_DE_VALOR.map(async (c) => [c, await api.lerValor(c).catch(() => null)] as const));
  return Object.fromEntries(pares.filter(([, v]) => v !== null));
}
