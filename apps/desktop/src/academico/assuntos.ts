// Matéria como assunto: cadernos e livros ligados a uma matéria. A matéria (Estudos >
// Matérias) mostra o que é dela, com "Abrir". O vínculo fica no cofre de valores
// ("estudos.assuntos"), sem mudar o banco, e vai junto na sincronização.
import { api } from "../api";

export type TipoAssunto = "cadernos" | "livros";
export interface Assuntos { cadernos: Record<string, string>; livros: Record<string, string> }

const CHAVE = "estudos.assuntos";
const mapa = (v: unknown): Record<string, string> =>
  v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string" && !!e[1])) : {};

export async function lerAssuntos(): Promise<Assuntos> {
  const v = (await api.lerValor(CHAVE).catch(() => null)) as Partial<Assuntos> | null;
  return { cadernos: mapa(v?.cadernos), livros: mapa(v?.livros) };
}

/** Liga (ou desliga, com materiaId vazio) um caderno ou livro a uma matéria. */
export function comAssunto(a: Assuntos, tipo: TipoAssunto, id: string, materiaId: string): Assuntos {
  const novo = { ...a[tipo] };
  if (materiaId) novo[id] = materiaId; else delete novo[id];
  return { ...a, [tipo]: novo };
}

export async function ligarAssunto(tipo: TipoAssunto, id: string, materiaId: string): Promise<void> {
  const a = await lerAssuntos();
  if ((a[tipo][id] ?? "") === materiaId) return;
  await api.gravarValor(CHAVE, comAssunto(a, tipo, id, materiaId));
}

/** O que é de uma matéria (só o que ainda existe). */
export function daMateria(a: Assuntos, materiaId: string, existem: { cadernos: Set<string>; livros: Set<string> }): { cadernos: string[]; livros: string[] } {
  const de = (tipo: TipoAssunto) => Object.entries(a[tipo]).filter(([id, m]) => m === materiaId && existem[tipo].has(id)).map(([id]) => id);
  return { cadernos: de("cadernos"), livros: de("livros") };
}
