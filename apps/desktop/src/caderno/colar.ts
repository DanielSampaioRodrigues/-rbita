// Colar no caderno o que veio de fora (outro app, o iPhone, o navegador): imagem entra
// como imagem, do jeito que veio (PNG sem fundo continua sem fundo); SVG passa pela
// limpeza de segurança; PDF vira páginas para anotar; texto com formatação vira uma
// caixa de texto com a formatação simples (títulos, negrito, listas); texto puro vira
// uma caixa. O que foi copiado no próprio caderno tem um caminho próprio (Caderno.tsx).
import DOMPurify from "dompurify";
import { escaparHtml } from "./editor/estilos";

/** Texto simples em HTML de caixa de texto: um parágrafo por linha (linhas vazias somem). */
export function textoParaHtml(texto: string): string {
  const linhas = texto.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+$/, ""));
  while (linhas.length && !linhas[0].trim()) linhas.shift();
  while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
  return linhas.filter((l, i) => l.trim() || (i > 0 && linhas[i - 1].trim())).map((l) => (l.trim() ? `<p>${escaparHtml(l)}</p>` : "<p></p>")).join("");
}

/** HTML colado de outro app, só com as marcas de texto (sem estilo, script, imagem ou link estranho). */
export function htmlColado(html: string): string {
  const limpo = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["h1", "h2", "h3", "p", "ul", "ol", "li", "strong", "em", "b", "i", "u", "s", "blockquote", "br", "table", "thead", "tbody", "tr", "th", "td"],
    ALLOWED_ATTR: [],
  }).trim();
  // Texto solto (sem parágrafo em volta) ganha um.
  return limpo && !/^<(h[1-3]|p|ul|ol|blockquote|table)/i.test(limpo) ? `<p>${limpo}</p>` : limpo;
}

/** SVG sem scripts nem links externos (regra do Órbita para SVG importado). */
export function svgLimpo(svg: string): string {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ["script", "foreignObject"], FORBID_ATTR: ["href", "xlink:href"] });
}

/** O que há na área de transferência, do jeito que o caderno usa. */
export type Colado =
  | { tipo: "imagem"; blob: Blob }
  | { tipo: "pdf"; arquivo: File }
  | { tipo: "html"; html: string; texto: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "nada" };

/** Prepara a imagem: SVG passa pela limpeza; as outras ficam exatamente como vieram. */
export async function imagemSegura(b: Blob): Promise<Blob> {
  if (b.type !== "image/svg+xml") return b;
  return new Blob([svgLimpo(await b.text())], { type: "image/svg+xml" });
}

/** Escolhe o que colar entre o que veio (imagem e PDF antes de texto). */
export async function escolherColado(arquivos: File[], tipos: Record<string, () => Promise<string>>): Promise<Colado> {
  const img = arquivos.find((f) => f.type.startsWith("image/"));
  if (img) return { tipo: "imagem", blob: await imagemSegura(img) };
  const pdf = arquivos.find((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
  if (pdf) return { tipo: "pdf", arquivo: pdf };
  const texto = tipos["text/plain"] ? await tipos["text/plain"]() : "";
  if (tipos["text/html"]) {
    const html = htmlColado(await tipos["text/html"]());
    if (html.replace(/<[^>]+>/g, "").trim()) return { tipo: "html", html, texto };
  }
  if (texto.trim()) return { tipo: "texto", texto };
  return { tipo: "nada" };
}

/** Lê a área de transferência por botão (no iPad o sistema pede "Colar"). */
export async function lerAreaDeTransferencia(): Promise<Colado> {
  const cb = navigator.clipboard;
  if (cb?.read) {
    try {
      const itens = await cb.read();
      const arquivos: File[] = [];
      const tipos: Record<string, () => Promise<string>> = {};
      for (const it of itens) {
        for (const t of it.types) {
          if (t.startsWith("image/") || t === "application/pdf") arquivos.push(new File([await it.getType(t)], t === "application/pdf" ? "colado.pdf" : "colado", { type: t }));
          else if ((t === "text/plain" || t === "text/html") && !tipos[t]) tipos[t] = async () => (await it.getType(t)).text();
        }
      }
      return await escolherColado(arquivos, tipos);
    } catch {
      // Sem permissão para ler tudo: tenta só o texto.
    }
  }
  if (cb?.readText) {
    const texto = await cb.readText().catch(() => "");
    if (texto.trim()) return { tipo: "texto", texto };
  }
  return { tipo: "nada" };
}

/** O que veio num evento de colar (Ctrl + V, menu Editar). */
export function coladoDoEvento(dt: DataTransfer | null): Promise<Colado> {
  if (!dt) return Promise.resolve({ tipo: "nada" });
  const arquivos = [...dt.items].filter((i) => i.kind === "file").map((i) => i.getAsFile()).filter((f): f is File => !!f);
  const tipos: Record<string, () => Promise<string>> = {};
  for (const t of ["text/plain", "text/html"]) { const v = dt.getData(t); if (v) tipos[t] = async () => v; }
  return escolherColado(arquivos, tipos);
}
