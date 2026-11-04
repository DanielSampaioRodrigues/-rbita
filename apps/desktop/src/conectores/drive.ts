// Salvar no Google Drive e abrir no Google Docs. Com a permissão drive.file, o Órbita
// só enxerga o que ele mesmo pôs no Drive: a pasta "Órbita" e os arquivos dela.
import { api } from "../api";
import { acessoGoogle, SemConta, SemPermissao, simulado } from "./google";

const PASTA = "Órbita";
const CHAVE_PASTA = "conector.drive.pasta";
const DOCS = "application/vnd.google-apps.document";

export interface ArquivoNoDrive { id: string; nome: string; link: string }

async function pedir(url: string, init: RequestInit = {}): Promise<Response> {
  const acesso = await acessoGoogle();
  let r: Response;
  try {
    r = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${acesso}` } });
  } catch {
    throw new Error("Não consegui falar com o Google Drive. Confira a internet e tente de novo.");
  }
  if (r.status === 401) throw new SemConta("O acesso ao Google venceu. Em Ajustes > Contas conectadas, ligue a conta de novo.");
  if (r.status === 403) {
    const t = await r.text();
    if (/insufficient|scope/i.test(t)) throw new SemPermissao("ver e criar arquivos do Órbita no Drive");
    if (/accessNotConfigured|SERVICE_DISABLED/.test(t)) throw new Error("O Google Drive não está ligado no cadastro do Órbita no Google (isso é do lado de quem publica o Órbita).");
    throw new Error("O Google Drive recusou o pedido. Tente de novo mais tarde.");
  }
  if (!r.ok) throw new Error(`O Google Drive respondeu com o código ${r.status}. Tente de novo.`);
  return r;
}

/** A pasta "Órbita" no Drive da pessoa (cria na primeira vez). */
async function pasta(): Promise<string> {
  const guardada = (await api.lerValor(CHAVE_PASTA).catch(() => null)) as string | null;
  if (guardada) {
    const r = await pedir(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(guardada)}?fields=id,trashed`).catch(() => null);
    if (r) { const d = (await r.json()) as { id?: string; trashed?: boolean }; if (d.id && !d.trashed) return d.id; }
  }
  const q = encodeURIComponent(`name = '${PASTA}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const achada = (await (await pedir(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`)).json()) as { files?: { id: string }[] };
  let id = achada.files?.[0]?.id;
  if (!id) {
    const criada = await pedir("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: PASTA, mimeType: "application/vnd.google-apps.folder" }),
    });
    id = ((await criada.json()) as { id: string }).id;
  }
  await api.gravarValor(CHAVE_PASTA, id).catch(() => {});
  return id;
}

/**
 * Manda o arquivo para a pasta "Órbita" do Drive. Com `comoDocs`, o Word vira um
 * Google Docs (para abrir e editar no Docs). Devolve o link para abrir.
 */
export async function salvarNoDrive(nome: string, tipo: string, dados: Blob | Uint8Array, opcoes: { comoDocs?: boolean } = {}): Promise<ArquivoNoDrive> {
  if (simulado()) {
    await acessoGoogle();
    await new Promise((r) => setTimeout(r, 400));
    const id = `sim-${Date.now().toString(36)}`;
    return { id, nome: opcoes.comoDocs ? nome.replace(/\.docx$/i, "") : nome, link: opcoes.comoDocs ? `https://docs.google.com/document/d/${id}/edit` : `https://drive.google.com/file/d/${id}/view` };
  }
  const meta: Record<string, unknown> = { name: opcoes.comoDocs ? nome.replace(/\.docx$/i, "") : nome, parents: [await pasta()] };
  if (opcoes.comoDocs) meta.mimeType = DOCS;
  const corpo = new FormData();
  corpo.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  corpo.append("file", dados instanceof Blob ? dados : new Blob([dados as BlobPart], { type: tipo }), nome);
  const r = await pedir("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", { method: "POST", body: corpo });
  const d = (await r.json()) as { id: string; name: string; webViewLink?: string };
  return { id: d.id, nome: d.name, link: d.webViewLink ?? (opcoes.comoDocs ? `https://docs.google.com/document/d/${d.id}/edit` : `https://drive.google.com/file/d/${d.id}/view`) };
}
