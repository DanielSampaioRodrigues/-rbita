// Fundo da janela e contraste automático. A conta fica no pacote @orbita/temas;
// aqui só se lê os pixels de fotos e SVGs (com canvas) e se aplica no CSS.
import { camadaDeFundo, escurecerAmostras, LIMITES_MINIMOS, opacidadeNecessaria, type Fundo, type Paleta, type Rgb } from "@orbita/temas";

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

const cache = new Map<string, { paineis: number; cartoes: number }>();

/**
 * Desenha o fundo e ajusta a opacidade dos painéis para o texto continuar legível.
 * `vidro` (0 a 100): caixas de opacas a transparentes, como vidro. Com a trava, só até o mínimo de leitura.
 */
export async function aplicarFundo(
  raiz: HTMLElement,
  fundo: Fundo,
  paleta: Paleta,
  opcoes: { baixoEstimulo: boolean; reduzirAnimacao: boolean; visivel?: number; semTrava?: boolean; natural?: boolean; vidro?: number },
): Promise<number> {
  const c = camadaDeFundo(fundo, paleta, opcoes);
  raiz.style.setProperty("--fundo-imagem", c.imagem);
  raiz.style.setProperty("--fundo-tamanho", c.tamanho);
  raiz.style.setProperty("--fundo-repetir", c.repetir);
  // "Cores originais": nada de desfoque nem escurecimento (os valores escolhidos ficam guardados).
  const natural = !!opcoes.natural && c.imagem !== "none";
  raiz.style.setProperty("--fundo-desfoque", `${natural ? 0 : c.desfoque}px`);
  raiz.style.setProperty("--fundo-escurecimento", String(natural ? 0 : c.escurecimento));
  raiz.dataset.fundoNatural = String(natural);
  // "foto": painéis com leve desfoque; "desenhado": sem desfoque, para o desenho aparecer nítido.
  raiz.dataset.fundo = c.imagem === "none" ? "liso" : fundo.tipo === "imagem" ? "foto" : "desenhado";
  const vidro = c.imagem === "none" ? 0 : Math.min(100, Math.max(0, opcoes.vidro ?? 0)) / 100;
  raiz.dataset.vidro = String(vidro > 0);

  // A cobertura dos painéis é a menor que mantém o texto legível (medida no próprio fundo).
  // Foto tem um piso, porque varia muito de um ponto para outro; desenho, não.
  const minimo = fundo.tipo === "imagem" ? 0.3 : 0;
  // "Quanto o fundo aparece" (0 a 100): vai do ponto mais legível ao mínimo de leitura (WCAG AA), nunca abaixo.
  // Sem a trava (escolha da pessoa), vai até o fundo inteiro à mostra.
  const visivel = Math.min(100, Math.max(0, opcoes.visivel ?? 0)) / 100;
  const chave = [c.imagem.length, c.imagem.slice(-200), c.escurecimento, paleta.fundo, paleta.superficie, paleta.texto, minimo, visivel, opcoes.semTrava, natural, vidro].join("|");
  let valores = cache.get(chave);
  if (!valores) {
    // Enquanto mede, fica opaco (seguro).
    raiz.style.setProperty("--opacidade-paineis", "1");
    raiz.style.setProperty("--opacidade-cartoes", "1");
    if (c.imagem === "none") valores = { paineis: 1, cartoes: 1 };
    else {
      const amostras = c.amostrasConhecidas ?? (await amostrar(c.imagem));
      // Desenhos: linhas finas raramente ficam embaixo das letras, então até 15% dos pontos
      // podem ser as linhas (que ainda precisam de 3:1 com o texto). Fotos seguem a regra rígida.
      const tolerancia = fundo.tipo === "imagem" ? 0.02 : 0.15;
      const escurecidas = escurecerAmostras(amostras, natural ? 0 : c.escurecimento);
      let paineis = 0;
      if (!natural) {
        const rigida = opacidadeNecessaria(escurecidas, paleta, minimo, tolerancia);
        const leve = opcoes.semTrava ? 0 : visivel > 0 ? opacidadeNecessaria(escurecidas, paleta, 0, tolerancia, LIMITES_MINIMOS) : rigida;
        paineis = Math.round((rigida - visivel * Math.max(0, rigida - leve)) * 100) / 100;
      }
      // Caixas: medidas com a cor delas (superfície), como se nada houvesse entre elas e o fundo.
      const pisoCartoes = opcoes.semTrava || vidro === 0 ? 0 : opacidadeNecessaria(escurecidas, { ...paleta, fundo: paleta.superficie }, 0, tolerancia, LIMITES_MINIMOS);
      const cartoes = Math.round((1 - vidro * (1 - pisoCartoes)) * 100) / 100;
      valores = { paineis, cartoes };
    }
    cache.set(chave, valores);
  }
  raiz.style.setProperty("--opacidade-paineis", String(valores.paineis));
  raiz.style.setProperty("--opacidade-cartoes", String(valores.cartoes));
  return valores.paineis;
}

/** Reduz uma foto para no máximo 1920 px e JPEG, para caber nas preferências. */
export async function prepararFoto(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    return await reduzirImagem(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** O mesmo, a partir de um endereço de imagem (por exemplo, a que a IA gerou). `maximo`: maior lado, em pixels. */
export async function reduzirImagem(endereco: string, maximo = 1920): Promise<string> {
  {
    const img = new Image();
    img.src = endereco;
    await img.decode();
    const escala = Math.min(1, maximo / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  }
}
