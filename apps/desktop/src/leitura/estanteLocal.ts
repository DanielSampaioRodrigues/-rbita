import type { GrupoLivro, Livro } from "../api";

/*
  Preferências da estante que ficam guardadas neste aparelho (como a posição de leitura,
  que o leitor já guarda assim): ordem das prateleiras, último livro aberto e quanto já leu.
  Se o armazenamento falhar, a estante continua funcionando com a ordem padrão.
*/

const CHAVE_ORDEM = "orbita.leitura.ordemPrateleiras";
const CHAVE_ULTIMO = "orbita.leitura.ultimoAberto";
const chaveProgresso = (id: string) => `orbita.leitura.progresso.${id}`;

function ler<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Conveniência; se não der para guardar, tudo bem.
  }
}

export const lerOrdem = (): string[] => {
  const v = ler<unknown>(CHAVE_ORDEM, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
};
export const gravarOrdem = (ids: string[]) => gravar(CHAVE_ORDEM, ids);

export const lerUltimo = (): { id: string; em: number } | null => {
  const v = ler<{ id?: unknown; em?: unknown } | null>(CHAVE_ULTIMO, null);
  return v && typeof v.id === "string" ? { id: v.id, em: typeof v.em === "number" ? v.em : 0 } : null;
};
export const marcarUltimo = (id: string) => gravar(CHAVE_ULTIMO, { id, em: Date.now() });

/** Quanto já leu, de 0 a 100; null = não informado. */
export const lerProgresso = (id: string): number | null => {
  const v = ler<unknown>(chaveProgresso(id), null);
  return typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : null;
};
export const gravarProgresso = (id: string, valor: number | null) =>
  gravar(chaveProgresso(id), valor === null ? null : Math.min(100, Math.max(0, Math.round(valor))));

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
