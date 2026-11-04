// Zotero: buscar as referências da biblioteca da pessoa e pôr no texto (formatadas pela
// norma escolhida com o citation-js, como as outras referências). Dois jeitos:
// - "web": o número de usuário e uma chave só de leitura (zotero.org/settings/keys),
//   guardados no banco criptografado; funciona no iPad e no Windows;
// - "computador": o Zotero aberto neste computador (Zotero 7, só no Windows), sem chave.
import { api, MODO_WEB, noApp } from "../api";

const CHAVE = "conector.zotero";
export interface ConfigZotero { modo: "web" | "computador"; usuario?: string; chave?: string }

export async function lerConfigZotero(): Promise<ConfigZotero | null> {
  const v = (await api.lerValor(CHAVE).catch(() => null)) as ConfigZotero | null;
  return v && (v.modo === "web" || v.modo === "computador") ? v : null;
}
export async function gravarConfigZotero(c: ConfigZotero | null): Promise<void> {
  if (c) await api.gravarValor(CHAVE, c); else await api.apagarValor(CHAVE);
}
/** O Zotero do computador só existe no app do Windows (o navegador não deixa). */
export const zoteroDoComputadorPossivel = () => !MODO_WEB;

/** O que vem do Zotero (format=csljson): uma lista ou { items: [...] }. Tira anotações e anexos. */
export function lerCslDoZotero(texto: string): Record<string, unknown>[] {
  let v: unknown;
  try { v = JSON.parse(texto); } catch { return []; }
  const lista = Array.isArray(v) ? v : v && typeof v === "object" && Array.isArray((v as { items?: unknown }).items) ? (v as { items: unknown[] }).items : [];
  return lista.filter((i): i is Record<string, unknown> => !!i && typeof i === "object" && typeof (i as { title?: unknown }).title === "string" && !["note", "attachment"].includes(String((i as { type?: unknown }).type)));
}

/** Busca na biblioteca do Zotero (título, autor, ano). Até 25 itens. */
export async function buscarNoZotero(c: ConfigZotero, termo: string): Promise<Record<string, unknown>[]> {
  const q = encodeURIComponent(termo.trim());
  const caminho = `items/top?format=csljson&limit=25&sort=dateModified${q ? `&q=${q}&qmode=titleCreatorYear` : ""}`;
  if (c.modo === "computador") return lerCslDoZotero(await api.zoteroLocal(`/api/users/0/${caminho}`));
  if (!c.usuario || !c.chave) throw new Error("Falta o número de usuário ou a chave do Zotero (Ajustes > Contas conectadas).");
  if (!noApp && !MODO_WEB) return lerCslDoZotero(await api.zoteroLocal(`/api/users/0/${caminho}`)); // simulação
  let r: Response;
  try {
    r = await fetch(`https://api.zotero.org/users/${encodeURIComponent(c.usuario)}/${caminho}`, { headers: { "Zotero-API-Key": c.chave, "Zotero-API-Version": "3" } });
  } catch {
    throw new Error("Não consegui falar com o Zotero. Confira a internet e tente de novo.");
  }
  if (r.status === 403) throw new Error("O Zotero não aceitou a chave. Confira o número de usuário e a chave (precisa poder ler a biblioteca).");
  if (!r.ok) throw new Error(`O Zotero respondeu com o código ${r.status}. Tente de novo.`);
  return lerCslDoZotero(await r.text());
}

/** Uma linha para mostrar na lista: autor, ano e título. */
export function resumoDoItem(i: Record<string, unknown>): string {
  const autores = (i.author as { family?: string; literal?: string }[] | undefined) ?? [];
  const nome = autores[0]?.family ?? autores[0]?.literal ?? "";
  const ano = ((i.issued as { "date-parts"?: number[][] } | undefined)?.["date-parts"]?.[0]?.[0]) ?? "";
  return [nome + (autores.length > 1 ? " et al." : ""), ano, String(i.title ?? "")].filter((x) => x !== "").join(" · ");
}
