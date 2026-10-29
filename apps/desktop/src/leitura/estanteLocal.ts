import type { GrupoLivro, Livro } from "../api";
import { chavesAntigasCom, criarLoja, useLoja, type Antigo } from "../valores";

/*
  Preferências da estante: ordem das prateleiras, último livro aberto e quanto já leu.
  Ficam no cofre de valores (banco criptografado, entra no backup), chave "leitura.estante".
  Antes ficavam no localStorage; migram sozinhas na primeira leitura.
*/

export interface Estante {
  ordem: string[];
  ultimo: { id: string; em: number } | null;
  /** livro → quanto já leu, de 0 a 100 */
  progresso: Record<string, number>;
}

const CHAVE_ORDEM = "orbita.leitura.ordemPrateleiras";
const CHAVE_ULTIMO = "orbita.leitura.ultimoAberto";
const PREFIXO_PROGRESSO = "orbita.leitura.progresso.";

const limitar = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

/** Aceita qualquer coisa vinda do armazenamento e devolve uma estante válida. */
export function validarEstante(bruto: unknown): Estante {
  const b = (bruto && typeof bruto === "object" ? bruto : {}) as { ordem?: unknown; ultimo?: unknown; progresso?: unknown };
  const ordem = Array.isArray(b.ordem) ? b.ordem.filter((x): x is string => typeof x === "string") : [];
  const u = b.ultimo as { id?: unknown; em?: unknown } | null | undefined;
  const ultimo = u && typeof u === "object" && typeof u.id === "string" ? { id: u.id, em: typeof u.em === "number" ? u.em : 0 } : null;
  const progresso: Record<string, number> = {};
  if (b.progresso && typeof b.progresso === "object") {
    for (const [id, v] of Object.entries(b.progresso as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) progresso[id] = limitar(v);
    }
  }
  return { ordem, ultimo, progresso };
}

/** As chaves antigas (uma por coisa, e uma por livro no progresso) viram uma estante só. */
const antigo: Antigo = {
  ler: () => {
    const chaves = [CHAVE_ORDEM, CHAVE_ULTIMO, ...chavesAntigasCom(PREFIXO_PROGRESSO)];
    const texto = (k: string) => {
      try {
        return globalThis.localStorage?.getItem(k) ?? null;
      } catch {
        return null;
      }
    };
    if (chaves.every((k) => texto(k) === null)) return undefined;
    const json = (k: string): unknown => {
      try {
        return JSON.parse(texto(k) ?? "null");
      } catch {
        return null;
      }
    };
    const progresso: Record<string, unknown> = {};
    for (const k of chavesAntigasCom(PREFIXO_PROGRESSO)) progresso[k.slice(PREFIXO_PROGRESSO.length)] = json(k);
    return { ordem: json(CHAVE_ORDEM), ultimo: json(CHAVE_ULTIMO), progresso };
  },
  apagar: () => {
    for (const k of [CHAVE_ORDEM, CHAVE_ULTIMO, ...chavesAntigasCom(PREFIXO_PROGRESSO)]) {
      try {
        globalThis.localStorage?.removeItem(k);
      } catch {
        // Sem armazenamento: nada a apagar.
      }
    }
  },
};

export const lojaEstante = criarLoja<Estante>({
  chave: "leitura.estante",
  antiga: antigo,
  vazio: () => ({ ordem: [], ultimo: null, progresso: {} }),
  validar: validarEstante,
});

/** Lê do cofre ao montar e redesenha quando a estante muda. */
export const useEstante = () => useLoja(lojaEstante);

export const lerOrdem = (): string[] => lojaEstante.obter().ordem;
export const gravarOrdem = (ids: string[]) => lojaEstante.mudar((e) => ({ ...e, ordem: [...ids] }));

export const lerUltimo = (): { id: string; em: number } | null => lojaEstante.obter().ultimo;
export const marcarUltimo = (id: string) => lojaEstante.mudar((e) => ({ ...e, ultimo: { id, em: Date.now() } }));

/** Quanto já leu, de 0 a 100; null = não informado. */
export const lerProgresso = (id: string): number | null => lojaEstante.obter().progresso[id] ?? null;
export const gravarProgresso = (id: string, valor: number | null) =>
  lojaEstante.mudar((e) => {
    const progresso = { ...e.progresso };
    if (valor === null || !Number.isFinite(valor)) delete progresso[id];
    else progresso[id] = limitar(valor);
    return { ...e, progresso };
  });

/** Prateleiras na ordem escolhida pela pessoa; as que não estão na lista vão para o fim, por data de criação. */
export function ordenarPrateleiras(grupos: GrupoLivro[], ordem: string[]): GrupoLivro[] {
  const pos = (g: GrupoLivro) => {
    const i = ordem.indexOf(g.id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...grupos].sort((a, b) => pos(a) - pos(b) || a.criadoEm - b.criadoEm || a.nome.localeCompare(b.nome));
}

/** Move uma prateleira uma posição para cima (-1) ou para baixo (+1). Devolve a nova ordem de ids. */
export function moverNaOrdem(ids: string[], id: string, delta: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const novo = [...ids];
  [novo[i], novo[j]] = [novo[j], novo[i]];
  return novo;
}

/**
 * Livro do cartão "Continuar lendo": o último aberto (se ainda não foi lido);
 * senão, o primeiro marcado como "lendo". Nenhum: null.
 */
export function livroParaContinuar(livros: Livro[], ultimoId: string | null): Livro | null {
  const ultimo = ultimoId ? livros.find((l) => l.id === ultimoId && l.status !== "lido") : undefined;
  return ultimo ?? livros.find((l) => l.status === "lendo") ?? null;
}
