// Monta o PDF a partir das páginas medidas (medir.ts), com pdf-lib (MIT): texto de
// verdade (dá para buscar, copiar e o detector de plágio lê), traços e formas em
// vetor (nítidos em qualquer zoom) e imagens. Cada palavra vai no lugar exato em que
// estava na tela; se a fonte do PDF for um pouco mais larga ou estreita, a palavra é
// ajustada à largura medida.
import type { PDFDocument, PDFImage, PDFPage } from "pdf-lib";
import { FontesDoPdf, type FontePdf } from "./fontesPdf";
import { fundoComoImagem } from "./fundos";
import { compor, type Cor, type ItemDesenho, type Matriz, type PaginaMedida } from "./medir";

const PT = 0.75; // 1 px (96 por polegada) = 0,75 pt
const ITALICO_FALSO = Math.tan((12 * Math.PI) / 180);

export interface ResultadoPdf {
  bytes: Uint8Array;
  /** Fontes do aparelho que entraram no PDF por uma parecida. */
  aproximadas: string[];
}

/** Lê os bytes de uma imagem (data:, blob: ou do próprio app). */
async function bytesDaImagem(src: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(src);
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

/** Imagem em formato que não é PNG nem JPEG (WebP, GIF, SVG): passa pelo canvas. */
async function paraPng(src: string): Promise<Uint8Array | null> {
  const img = new Image();
  img.src = src;
  try { await img.decode(); } catch { return null; }
  const tela = document.createElement("canvas");
  tela.width = img.naturalWidth || 1; tela.height = img.naturalHeight || 1;
  tela.getContext("2d")?.drawImage(img, 0, 0);
  const url = tela.toDataURL("image/png");
  return bytesDaImagem(url);
}

export async function gerarPdf(paginas: PaginaMedida[], meta: { titulo: string; autor?: string }): Promise<ResultadoPdf> {
  const lib = await import("pdf-lib");
  const { default: fontkit } = await import("@pdf-lib/fontkit");
  const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix, setTextRenderingMode, TextRenderingMode, setLineWidth, setStrokingRgbColor, LineCapStyle } = lib;
  const doc: PDFDocument = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(meta.titulo || "Documento");
  if (meta.autor) doc.setAuthor(meta.autor);
  doc.setCreator("Órbita");
  doc.setProducer("Órbita (pdf-lib)");
  doc.setLanguage("pt-BR");
  const fontes = new FontesDoPdf(doc);
  const imagens = new Map<string, Promise<PDFImage | null>>();
  const imagem = (src: string) => {
    let p = imagens.get(src);
    if (!p) {
      p = (async () => {
        let b = await bytesDaImagem(src);
        if (!b) return null;
        const png = b[0] === 0x89 && b[1] === 0x50;
        const jpg = b[0] === 0xff && b[1] === 0xd8;
        if (!png && !jpg) { b = await paraPng(src); if (!b) return null; }
        try { return jpg ? await doc.embedJpg(b) : await doc.embedPng(b); } catch { return null; }
      })();
      imagens.set(src, p);
    }
    return p;
  };
  const cor = (c: Cor) => rgb(Math.min(1, Math.max(0, c.r)), Math.min(1, Math.max(0, c.g)), Math.min(1, Math.max(0, c.b)));
  const F: Matriz = [1, 0, 0, -1, 0, 0];

  for (const pag of paginas) {
    const H = pag.altura * PT;
    const page: PDFPage = doc.addPage([pag.largura * PT, H]);
    const P: Matriz = [PT, 0, 0, -PT, 0, H];
    const comMatriz = (K: Matriz, desenhar: () => void) => {
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...K));
      desenhar();
      page.pushOperators(popGraphicsState());
    };

    const texto = async (it: Extract<ItemDesenho, { tipo: "texto" }>) => {
      const f = await fontes.fonte(it.familia, it.peso, it.italico);
      if (!f) return;
      // Letras que a fonte não tem caem numa reserva (ou somem, se nem ela tiver).
      let reserva: FontePdf | null = null;
      const pedacos: { t: string; f: FontePdf; pequeno: boolean }[] = [];
      for (const ch of Array.from(it.texto)) {
        const cp = ch.codePointAt(0) ?? 32;
        let fonte = f;
        if (!f.letras.has(cp)) {
          reserva ??= await fontes.fonte("Arimo", it.peso, it.italico);
          if (!reserva || !reserva.letras.has(cp)) continue;
          fonte = reserva;
        }
        // Versalete: as minúsculas viram maiúsculas menores.
        const pequeno = !!it.versalete && ch !== ch.toLocaleUpperCase("pt-BR");
        const t = pequeno ? ch.toLocaleUpperCase("pt-BR") : ch;
        const ult = pedacos[pedacos.length - 1];
        if (ult && ult.f === fonte && ult.pequeno === pequeno) ult.t += t; else pedacos.push({ t, f: fonte, pequeno });
      }
      if (!pedacos.length) return;
      const tam = it.tamanho * PT;
      const larguras = pedacos.map((p) => p.f.fonte.widthOfTextAtSize(p.t, p.pequeno ? tam * 0.78 : tam));
      const natural = larguras.reduce((a, b) => a + b, 0);
      if (natural <= 0) return;
      const X = it.x * PT, Y = H - it.y * PT;
      const sx = Math.min(1.6, Math.max(0.6, (it.largura * PT) / natural));
      const inclinar = f.italicoFalso ? ITALICO_FALSO : 0;
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(sx, 0, inclinar, 1, X - sx * X - inclinar * Y, 0));
      if (f.negritoFalso) page.pushOperators(setTextRenderingMode(TextRenderingMode.FillAndOutline), setLineWidth(tam * 0.035), setStrokingRgbColor(it.cor.r, it.cor.g, it.cor.b));
      let x = X;
      pedacos.forEach((p, i) => {
        page.drawText(p.t, { x, y: Y, size: p.pequeno ? tam * 0.78 : tam, font: p.f.fonte, color: cor(it.cor), opacity: it.cor.a });
        x += larguras[i];
      });
      page.pushOperators(popGraphicsState());
    };

    for (const it of pag.itens) {
      try {
        if (it.tipo === "texto") await texto(it);
        else if (it.tipo === "retangulo") {
          const d = it.raio
            ? `M${it.x + it.raio} ${it.y}H${it.x + it.w - it.raio}A${it.raio} ${it.raio} 0 0 1 ${it.x + it.w} ${it.y + it.raio}V${it.y + it.h - it.raio}A${it.raio} ${it.raio} 0 0 1 ${it.x + it.w - it.raio} ${it.y + it.h}H${it.x + it.raio}A${it.raio} ${it.raio} 0 0 1 ${it.x} ${it.y + it.h - it.raio}V${it.y + it.raio}A${it.raio} ${it.raio} 0 0 1 ${it.x + it.raio} ${it.y}Z`
            : `M${it.x} ${it.y}H${it.x + it.w}V${it.y + it.h}H${it.x}Z`;
          page.drawSvgPath(d, { x: 0, y: H, scale: PT, color: cor(it.cor), opacity: it.cor.a, borderWidth: 0 });
        } else if (it.tipo === "linha") {
          page.drawLine({ start: { x: it.x1 * PT, y: H - it.y1 * PT }, end: { x: it.x2 * PT, y: H - it.y2 * PT }, thickness: it.largura * PT, color: cor(it.cor), opacity: it.cor.a, lineCap: it.ponta === "round" ? LineCapStyle.Round : LineCapStyle.Butt });
        } else if (it.tipo === "caminho") {
          const K = compor(compor(P, it.matriz), F);
          comMatriz(K, () => page.drawSvgPath(it.d, {
            x: 0, y: 0, scale: 1,
            color: it.preencher ? cor(it.preencher) : undefined, opacity: it.preencher?.a,
            borderColor: it.contorno ? cor(it.contorno) : undefined, borderOpacity: it.contorno?.a,
            borderWidth: it.contorno ? it.larguraContorno ?? 1 : 0,
            borderLineCap: it.ponta === "round" ? LineCapStyle.Round : it.ponta === "square" ? LineCapStyle.Projecting : LineCapStyle.Butt,
          }));
        } else if (it.tipo === "imagem" || it.tipo === "fundo") {
          let src: string | null; let M: Matriz; let op: number;
          if (it.tipo === "fundo") {
            src = await fundoComoImagem(it);
            M = [it.w, 0, 0, it.h, it.x, it.y]; op = it.opacidade;
          } else { src = it.src; M = it.matriz; op = it.opacidade; }
          if (!src) continue;
          const img = await imagem(src);
          if (!img) continue;
          const K = compor(compor(P, M), [1, 0, 0, -1, 0, 1]);
          comMatriz(K, () => page.drawImage(img, { x: 0, y: 0, width: 1, height: 1, opacity: op }));
        } else if (it.tipo === "caixinha") {
          const x = it.x * PT, y = H - (it.y + it.lado) * PT, l = it.lado * PT;
          page.drawRectangle({ x, y, width: l, height: l, borderColor: cor(it.cor), borderWidth: Math.max(0.6, l / 12), opacity: 0 , borderOpacity: it.cor.a });
          if (it.marcada) {
            const d = `M${it.x + it.lado * 0.2} ${it.y + it.lado * 0.52}L${it.x + it.lado * 0.42} ${it.y + it.lado * 0.75}L${it.x + it.lado * 0.82} ${it.y + it.lado * 0.27}`;
            page.drawSvgPath(d, { x: 0, y: H, scale: PT, borderColor: cor(it.cor), borderWidth: Math.max(1, it.lado / 8), borderLineCap: LineCapStyle.Round });
          }
        }
      } catch {
        // Um item que não deu certo não impede o resto da página.
      }
    }
  }
  const bytes = await doc.save();
  return { bytes, aproximadas: [...fontes.aproximadas] };
}
