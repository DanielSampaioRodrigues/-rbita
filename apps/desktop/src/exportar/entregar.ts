// Entrega um arquivo exportado do jeito de cada aparelho:
// - iPad, iPhone e celular: abre o Compartilhar do sistema (WhatsApp, Drive, OneDrive,
//   Arquivos, e-mail, AirDrop...), sem o Órbita entrar em conta nenhuma;
// - app do computador: "Salvar como" (dá para salvar direto na pasta do Drive ou do OneDrive);
// - navegador do computador: baixa o arquivo.
import { save } from "@tauri-apps/plugin-dialog";
import { api, noApp } from "../api";

export type ComoEntregou = "compartilhado" | "salvo" | "baixado" | "cancelado";
export interface Entrega { como: ComoEntregou; onde?: string }

/** O Compartilhar precisa de um toque recente; se o arquivo demorou, pede outro toque. */
export class PrecisaDeToque extends Error {
  constructor(public arquivo: File) { super("toque"); }
}

/** Nome de arquivo seguro (sem barra, dois-pontos etc.), com a extensão. */
export function nomeDeArquivo(titulo: string, extensao: string): string {
  const base = titulo.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Documento";
  return `${base}.${extensao}`;
}

const podeCompartilhar = (f: File) =>
  typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 && typeof navigator.canShare === "function" && navigator.canShare({ files: [f] });

async function base64(b: Blob): Promise<string> {
  const url = await new Promise<string>((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => erro(r.error);
    r.readAsDataURL(b);
  });
  return url.slice(url.indexOf(",") + 1);
}

/** Abre o Compartilhar com o arquivo (chamar logo depois de um toque). */
export async function compartilhar(arquivo: File): Promise<Entrega> {
  try {
    await navigator.share({ files: [arquivo], title: arquivo.name });
    return { como: "compartilhado" };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return { como: "cancelado" };
    if (e instanceof DOMException && e.name === "NotAllowedError") throw new PrecisaDeToque(arquivo);
    throw e;
  }
}

export async function entregarArquivo(nome: string, tipo: string, dados: Blob | Uint8Array, filtro: { nome: string; extensao: string }): Promise<Entrega> {
  const blob = dados instanceof Blob ? dados : new Blob([dados as BlobPart], { type: tipo });
  if (noApp) {
    const caminho = await save({ defaultPath: nome, filters: [{ name: filtro.nome, extensions: [filtro.extensao] }] });
    if (!caminho) return { como: "cancelado" };
    await api.exportarArquivo(caminho, await base64(blob));
    return { como: "salvo", onde: caminho };
  }
  const arquivo = new File([blob], nome, { type: tipo });
  if (podeCompartilhar(arquivo)) return compartilhar(arquivo);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { como: "baixado" };
}
