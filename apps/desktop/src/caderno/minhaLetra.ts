// "Minha letra": palavras que a pessoa usa e que estão certas (nomes de autores, termos
// da área, siglas). O corretor da escrita à mão manda a lista à IA, para ajudar a ler a
// letra dela, e nunca marca essas palavras como erro. Fica no cofre e vale em todos os
// cadernos e aparelhos.
import { api } from "../api";

const CHAVE = "caderno.minha-letra";
export const MAXIMO = 300;

/** Uma palavra por linha (ou separadas por vírgula), sem repetir, até o máximo. */
export function limparLista(lista: string[]): string[] {
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const bruta of lista.flatMap((x) => x.split(/[\n,;]+/))) {
    const p = bruta.trim().slice(0, 40);
    if (!p || vistas.has(p.toLocaleLowerCase("pt-BR"))) continue;
    vistas.add(p.toLocaleLowerCase("pt-BR"));
    out.push(p);
  }
  return out.slice(-MAXIMO);
}

export async function lerMinhaLetra(): Promise<string[]> {
  const v = await api.lerValor(CHAVE).catch(() => null);
  return Array.isArray(v) ? limparLista(v.filter((x): x is string => typeof x === "string")) : [];
}

export async function gravarMinhaLetra(lista: string[]): Promise<string[]> {
  const limpa = limparLista(lista);
  await api.gravarValor(CHAVE, limpa);
  return limpa;
}

/** Acrescenta uma palavra (a escrita da pessoa, que a IA achou errada mas está certa). */
export async function ensinarPalavra(palavra: string): Promise<string[]> {
  return gravarMinhaLetra([...(await lerMinhaLetra()), palavra]);
}
