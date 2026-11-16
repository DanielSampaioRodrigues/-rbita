// Colar no caderno o que veio de fora (outro app, o iPhone, o navegador): texto vira
// uma caixa de texto; imagem entra como imagem. O que foi copiado no próprio caderno
// (desenhos, formas) tem um caminho próprio, em Caderno.tsx.
import { escaparHtml } from "./editor/estilos";

/** Texto simples em HTML de caixa de texto: um parágrafo por linha (linhas vazias somem). */
export function textoParaHtml(texto: string): string {
  const linhas = texto.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+$/, ""));
  while (linhas.length && !linhas[0].trim()) linhas.shift();
  while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
  return linhas.filter((l, i) => l.trim() || (i > 0 && linhas[i - 1].trim())).map((l) => (l.trim() ? `<p>${escaparHtml(l)}</p>` : "<p></p>")).join("");
}

/** O que há na área de transferência, lido por botão (no iPad o sistema pede "Colar"). */
export type Colado = { tipo: "imagem"; blob: Blob } | { tipo: "texto"; texto: string } | { tipo: "nada" };

export async function lerAreaDeTransferencia(): Promise<Colado> {
  const cb = navigator.clipboard;
  if (cb?.read) {
    try {
      const itens = await cb.read();
      for (const it of itens) {
        const img = it.types.find((t) => t.startsWith("image/"));
        if (img) return { tipo: "imagem", blob: await it.getType(img) };
      }
      for (const it of itens) {
        if (it.types.includes("text/plain")) {
          const texto = await (await it.getType("text/plain")).text();
          if (texto.trim()) return { tipo: "texto", texto };
        }
      }
      return { tipo: "nada" };
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
