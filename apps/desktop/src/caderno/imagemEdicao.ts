// Edição das imagens da página (barra da imagem): recortar, tirar o fundo, girar e
// espelhar. Tudo é feito aqui no aparelho, num canvas, e vira uma imagem nova no
// cofre: a original continua guardada, e o desfazer do caderno volta para ela.

/** Recorte em frações da imagem (0 a 1). */
export interface Recorte { x: number; y: number; w: number; h: number }

export function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error("Não deu para abrir a imagem."));
    img.src = url;
  });
}

function emBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error("Não deu para gravar a imagem."))), "image/png"));
}

function tela(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext("2d")!];
}

/** Limita o recorte à imagem e a um tamanho mínimo. */
export function recorteValido(r: Recorte): Recorte {
  const x = Math.min(Math.max(0, r.x), 0.98), y = Math.min(Math.max(0, r.y), 0.98);
  return { x, y, w: Math.min(Math.max(0.02, r.w), 1 - x), h: Math.min(Math.max(0.02, r.h), 1 - y) };
}

export async function recortar(img: HTMLImageElement, r: Recorte): Promise<Blob> {
  const v = recorteValido(r);
  const W = img.naturalWidth, H = img.naturalHeight;
  const [c, g] = tela(W * v.w, H * v.h);
  g.drawImage(img, W * v.x, H * v.y, W * v.w, H * v.h, 0, 0, c.width, c.height);
  return emBlob(c);
}

/** Gira 90° (horário) ou espelha na horizontal. */
export async function transformar(img: HTMLImageElement, como: "girar" | "espelhar"): Promise<Blob> {
  const W = img.naturalWidth, H = img.naturalHeight;
  const [c, g] = como === "girar" ? tela(H, W) : tela(W, H);
  if (como === "girar") { g.translate(H, 0); g.rotate(Math.PI / 2); }
  else { g.translate(W, 0); g.scale(-1, 1); }
  g.drawImage(img, 0, 0);
  return emBlob(c);
}

/**
 * Tira o fundo que encosta nas bordas (papel, parede, quadro branco): a partir de
 * cada ponto da borda, vai apagando os vizinhos de cor parecida. Funciona bem com
 * fundo liso; foto com fundo cheio de detalhes precisa de outro caminho.
 * `tolerancia` vai de 0 a 100. Mexe nos dados (RGBA) direto.
 */
export function tirarFundoDados(d: Uint8ClampedArray, w: number, h: number, tolerancia: number): void {
  const lim = (tolerancia / 100) * 442; // 442 ≈ maior distância entre duas cores
  const lim2 = lim * lim;
  const visto = new Uint8Array(w * h);
  const fila = new Int32Array(w * h);
  // Cor de referência de cada pixel apagado: a da semente (da borda) de onde veio.
  const refR = new Uint8Array(w * h), refG = new Uint8Array(w * h), refB = new Uint8Array(w * h);
  let ini = 0, fim = 0;
  const semear = (i: number) => {
    if (visto[i] || d[i * 4 + 3] === 0) return;
    visto[i] = 1; refR[i] = d[i * 4]; refG[i] = d[i * 4 + 1]; refB[i] = d[i * 4 + 2];
    fila[fim++] = i;
  };
  for (let x = 0; x < w; x++) { semear(x); semear((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { semear(y * w); semear(y * w + w - 1); }
  const perto = (de: number, para: number) => {
    const k = para * 4;
    const dr = d[k] - refR[de], dg = d[k + 1] - refG[de], db = d[k + 2] - refB[de];
    return dr * dr + dg * dg + db * db <= lim2;
  };
  while (ini < fim) {
    const i = fila[ini++];
    const x = i % w, y = (i - x) / w;
    const viz = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const v of viz) {
      if (v < 0 || visto[v] || !perto(i, v)) continue;
      visto[v] = 1; refR[v] = refR[i]; refG[v] = refG[i]; refB[v] = refB[i];
      fila[fim++] = v;
    }
  }
  // Apaga o que foi alcançado; a beirada fica meio transparente (borda mais suave).
  for (let i = 0; i < w * h; i++) if (visto[i]) d[i * 4 + 3] = 0;
  for (let i = 0; i < w * h; i++) {
    if (visto[i]) continue;
    const x = i % w, y = (i - x) / w;
    const encosta = (x > 0 && visto[i - 1]) || (x < w - 1 && visto[i + 1]) || (y > 0 && visto[i - w]) || (y < h - 1 && visto[i + w]);
    if (encosta) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * 0.6);
  }
}

/** Imagem sem o fundo (PNG com transparência). Imagens grandes são reduzidas antes. */
export async function tirarFundo(img: HTMLImageElement, tolerancia: number, maximo = 2000): Promise<Blob> {
  const k = Math.min(1, maximo / Math.max(img.naturalWidth, img.naturalHeight));
  const [c, g] = tela(img.naturalWidth * k, img.naturalHeight * k);
  g.drawImage(img, 0, 0, c.width, c.height);
  const dados = g.getImageData(0, 0, c.width, c.height);
  tirarFundoDados(dados.data, c.width, c.height, tolerancia);
  g.putImageData(dados, 0, 0);
  return emBlob(c);
}
