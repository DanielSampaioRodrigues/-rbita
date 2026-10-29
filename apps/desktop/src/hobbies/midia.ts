// Mídia do quadro de hobbies: áudio (gravar e tocar no Windows e no iPad) e
// imagens (miniatura reduzida para o quadro, sem pesar a tela).

// ── Base64 ──────────────────────────────────────────────────────────────────

/** Bytes → base64, em blocos (um áudio de minutos não trava a tela). */
export function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  const BLOCO = 0x8000;
  for (let i = 0; i < bytes.length; i += BLOCO) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + BLOCO) as unknown as number[]);
  }
  return btoa(bin);
}

export function base64ParaBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ── Áudio ───────────────────────────────────────────────────────────────────

/** Formatos de gravação, do preferido ao último recurso. O Safari (iPad) grava em audio/mp4. */
export const MIMES_GRAVACAO = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"];

/** O primeiro formato que o aparelho sabe gravar; vazio = deixa o aparelho escolher. */
export function escolherMimeAudio(suporta: ((mime: string) => boolean) | undefined): string {
  if (!suporta) return "";
  for (const m of MIMES_GRAVACAO) {
    try {
      if (suporta(m)) return m;
    } catch {
      // Alguns navegadores lançam erro para formatos desconhecidos.
    }
  }
  return "";
}

/** Extensão do arquivo a partir do formato gravado. */
export function extensaoDoMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.startsWith("audio/mp4") || m.startsWith("video/mp4") || m.includes("m4a")) return "m4a";
  if (m.startsWith("audio/aac")) return "aac";
  if (m.startsWith("audio/ogg")) return "ogg";
  if (m.startsWith("audio/mpeg")) return "mp3";
  if (m.startsWith("audio/wav") || m.startsWith("audio/x-wav")) return "wav";
  return "webm";
}

/** Formato para tocar, a partir do nome do arquivo. */
export function mimeDaExtensao(nome: string): string {
  const ext = (nome.split(".").pop() ?? "").toLowerCase();
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "m4a" || ext === "mp4") return "audio/mp4";
  if (ext === "aac") return "audio/aac";
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg" || ext === "oga" || ext === "opus") return "audio/ogg";
  if (ext === "flac") return "audio/flac";
  return "audio/webm";
}

export type MotivoMic = "negado" | "semMic" | "ocupado" | "outro";

/** Por que o microfone não abriu, a partir do erro do navegador. */
export function motivoErroMic(e: unknown): MotivoMic {
  const nome = e && typeof e === "object" && "name" in e ? String((e as { name: unknown }).name) : "";
  if (nome === "NotAllowedError" || nome === "SecurityError" || nome === "PermissionDeniedError") return "negado";
  if (nome === "NotFoundError" || nome === "DevicesNotFoundError" || nome === "OverconstrainedError") return "semMic";
  if (nome === "NotReadableError" || nome === "TrackStartError" || nome === "AbortError") return "ocupado";
  return "outro";
}

// ── Imagens ─────────────────────────────────────────────────────────────────

/** Medidas reduzidas mantendo a proporção; null quando já cabe. */
export function medidasReduzidas(largura: number, altura: number, maximo: number): { largura: number; altura: number } | null {
  if (largura <= 0 || altura <= 0) return null;
  const maior = Math.max(largura, altura);
  if (maior <= maximo) return null;
  const f = maximo / maior;
  return { largura: Math.max(1, Math.round(largura * f)), altura: Math.max(1, Math.round(altura * f)) };
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("imagem ilegível"));
    img.src = src;
  });
}

function temTransparencia(ctx: CanvasRenderingContext2D, l: number, a: number): boolean {
  try {
    const d = ctx.getImageData(0, 0, l, a).data;
    for (let i = 3; i < d.length; i += 16) if (d[i] < 250) return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * Reduz a imagem (endereço de dados ou blob) para caber em `maximo` px no lado maior.
 * Devolve null quando ela já é pequena ou quando o aparelho não consegue reduzir.
 */
export async function reduzirImagem(src: string, maximo: number): Promise<{ base64: string; ext: string; url: string } | null> {
  try {
    const img = await carregarImagem(src);
    const m = medidasReduzidas(img.naturalWidth, img.naturalHeight, maximo);
    if (!m) return null;
    const canvas = document.createElement("canvas");
    canvas.width = m.largura;
    canvas.height = m.altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, m.largura, m.altura);
    let url = canvas.toDataURL("image/webp", 0.85);
    let ext = "webp";
    if (!url.startsWith("data:image/webp")) {
      // Safari não grava WebP: JPEG quando não há transparência, PNG quando há.
      const alfa = temTransparencia(ctx, m.largura, m.altura);
      url = alfa ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);
      ext = alfa ? "png" : "jpg";
    }
    canvas.width = canvas.height = 0;
    return { base64: url.slice(url.indexOf(",") + 1), ext, url };
  } catch {
    return null;
  }
}

/** Endereço de dados → endereço de blob (leve no DOM; liberar com URL.revokeObjectURL). */
export function dadosParaBlobUrl(dataUrl: string): string {
  const virgula = dataUrl.indexOf(",");
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? "application/octet-stream";
  const corpo = dataUrl.slice(virgula + 1);
  const bytes = dataUrl.slice(0, virgula).includes(";base64") ? base64ParaBytes(corpo) : new TextEncoder().encode(decodeURIComponent(corpo));
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
}
