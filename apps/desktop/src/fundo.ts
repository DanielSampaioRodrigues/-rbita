// Fundo da janela e contraste automático. A conta fica no pacote @orbita/temas;
// aqui só se lê os pixels de fotos e SVGs (com canvas) e se aplica no CSS.
import { camadaDeFundo, escurecerAmostras, opacidadeNecessaria, type Fundo, type Paleta, type Rgb } from "@orbita/temas";

/** Lê até 48 × 48 pontos do fundo. Se falhar, devolve vazio (e os painéis ficam opacos). */
async function amostrar(imagemCss: string): Promise<Rgb[]> {
  const url = /^url\("(.*)"\)$/s.exec(imagemCss)?.[1];
  if (!url) return [];
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  try {
    await img.decode();
  } catch {
    return [];
  }
  const lado = 48;
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, lado, lado);
  const { data } = ctx.getImageData(0, 0, lado, lado);
  const pontos: Rgb[] = [];
  for (let i = 0; i < data.length; i += 4) {
    // Ponto transparente (SVG com partes vazias): ali aparece a cor de fundo do tema, já levada em conta.
    if (data[i + 3] < 16) continue;
    pontos.push([data[i], data[i + 1], data[i + 2]]);
  }
  return pontos;
}

const cache = new Map<string, number>();

/** Desenha o fundo e ajusta a opacidade dos painéis para o texto continuar legível. */
export async function aplicarFundo(
  raiz: HTMLElement,
  fundo: Fundo,
  paleta: Paleta,
  opcoes: { baixoEstimulo: boolean; reduzirAnimacao: boolean },
): Promise<number> {
  const c = camadaDeFundo(fundo, paleta, opcoes);
  raiz.style.setProperty("--fundo-imagem", c.imagem);
  raiz.style.setProperty("--fundo-tamanho", c.tamanho);
  raiz.style.setProperty("--fundo-repetir", c.repetir);
  raiz.style.setProperty("--fundo-desfoque", `${c.desfoque}px`);
  raiz.style.setProperty("--fundo-escurecimento", String(c.escurecimento));
  raiz.dataset.fundo = c.imagem === "none" ? "liso" : "desenhado";

  const minimo = fundo.tipo === "imagem" || fundo.tipo === "svg" ? 0.6 : 0;
  const chave = `${c.imagem.length}|${c.imagem.slice(-200)}|${c.escurecimento}|${paleta.fundo}|${paleta.texto}|${minimo}`;
  let opacidade = cache.get(chave);
  if (opacidade === undefined) {
    // Enquanto mede, fica opaco (seguro).
    raiz.style.setProperty("--opacidade-paineis", "1");
    const amostras = c.amostrasConhecidas ?? (await amostrar(c.imagem));
    opacidade = c.imagem === "none" ? 1 : opacidadeNecessaria(escurecerAmostras(amostras, c.escurecimento), paleta, minimo);
    cache.set(chave, opacidade);
  }
  raiz.style.setProperty("--opacidade-paineis", String(opacidade));
  return opacidade;
}

/** Reduz uma foto para no máximo 1920 px e JPEG, para caber nas preferências. */
export async function prepararFoto(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const escala = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
