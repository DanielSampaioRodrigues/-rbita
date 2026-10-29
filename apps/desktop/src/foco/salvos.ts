// Focos salvos: atalhos com nome, minutos de foco e (se quiser) minutos de pausa.
// Ficam no mesmo lugar do estado do timer (armazenamento local do aparelho),
// assim funcionam igual no Windows e na versão de navegador.

export interface FocoSalvo {
  id: string;
  nome: string;
  /** Minutos de foco, de 1 a 180. */
  minutos: number;
  /** Minutos de pausa depois do foco (0 = sem pausa). */
  pausa: number;
}

export const CHAVE_SALVOS = "orbita.foco.salvos";
export const MAXIMO_SALVOS = 30;
export const MAXIMO_NOME = 60;

/** Prende os minutos entre 1 e 180 (ou 0 e 180, para a pausa). */
export const limitarMinutos = (v: unknown, minimo = 1) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(180, Math.max(minimo, n)) : minimo;
};

/** Aceita só o que tem forma de foco salvo; o resto fica de fora. */
export function validarSalvos(bruto: unknown): FocoSalvo[] {
  if (!Array.isArray(bruto)) return [];
  const lista: FocoSalvo[] = [];
  const ids = new Set<string>();
  for (const x of bruto) {
    if (lista.length >= MAXIMO_SALVOS) break;
    if (typeof x !== "object" || x === null) continue;
    const f = x as Record<string, unknown>;
    if (typeof f.id !== "string" || !f.id || ids.has(f.id)) continue;
    if (typeof f.nome !== "string" || !f.nome.trim()) continue;
    if (typeof f.minutos !== "number") continue;
    ids.add(f.id);
    lista.push({
      id: f.id,
      nome: f.nome.trim().slice(0, MAXIMO_NOME),
      minutos: limitarMinutos(f.minutos),
      pausa: typeof f.pausa === "number" ? limitarMinutos(f.pausa, 0) : 0,
    });
  }
  return lista;
}

export function lerSalvos(armazenamento: Storage = localStorage): FocoSalvo[] {
  try {
    return validarSalvos(JSON.parse(armazenamento.getItem(CHAVE_SALVOS) ?? "[]"));
  } catch {
    return [];
  }
}

export function gravarSalvos(lista: FocoSalvo[], armazenamento: Storage = localStorage): void {
  try {
    armazenamento.setItem(CHAVE_SALVOS, JSON.stringify(lista));
  } catch {
    // Sem armazenamento: a lista vale só enquanto o app estiver aberto.
  }
}

export const novoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `f${Date.now()}${Math.random().toString(36).slice(2)}`;
