// Imagem PNG de uma página medida (medir.ts), desenhada num canvas com as próprias
// fontes do navegador: fica igual à tela. Boa para mandar uma página no WhatsApp.
import { fundoComoImagem } from "./fundos";
import type { Cor, PaginaMedida } from "./medir";

const css = (c: Cor) => `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;

function carregar(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

/** Desenha a página (em `escala` vezes o tamanho de tela) e devolve o PNG. */
export async function gerarPng(pag: PaginaMedida, escala = 2): Promise<Blob> {
  const tela = document.createElement("canvas");
  tela.width = Math.round(pag.largura * escala);
  tela.height = Math.round(pag.altura * escala);
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("Este aparelho não conseguiu desenhar a imagem.");
  ctx.scale(escala, escala);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pag.largura, pag.altura);
  for (const it of pag.itens) {
    ctx.save();
    if (it.tipo === "texto") {
      ctx.font = `${it.italico ? "italic " : ""}${it.versalete ? "small-caps " : ""}${it.peso} ${it.tamanho}px ${it.familia}`;
      ctx.fillStyle = css(it.cor);
      ctx.textBaseline = "alphabetic";
      const natural = ctx.measureText(it.texto).width;
      const sx = natural > 0 ? Math.min(1.6, Math.max(0.6, it.largura / natural)) : 1;
      ctx.translate(it.x, it.y);
      ctx.scale(sx, 1);
      ctx.fillText(it.texto, 0, 0);
    } else if (it.tipo === "retangulo") {
      ctx.fillStyle = css(it.cor);
      ctx.beginPath();
      if (it.raio) ctx.roundRect(it.x, it.y, it.w, it.h, it.raio); else ctx.rect(it.x, it.y, it.w, it.h);
      ctx.fill();
    } else if (it.tipo === "linha") {
      ctx.strokeStyle = css(it.cor); ctx.lineWidth = it.largura; ctx.lineCap = it.ponta === "round" ? "round" : "butt";
      ctx.setLineDash(it.tracejado ?? []);
      ctx.beginPath(); ctx.moveTo(it.x1, it.y1); ctx.lineTo(it.x2, it.y2); ctx.stroke();
      ctx.setLineDash([]);
    } else if (it.tipo === "caminho") {
      ctx.transform(...it.matriz);
      const p = new Path2D(it.d);
      if (it.preencher) { ctx.fillStyle = css(it.preencher); ctx.fill(p, it.parImpar ? "evenodd" : "nonzero"); }
      if (it.contorno) { ctx.strokeStyle = css(it.contorno); ctx.lineWidth = it.larguraContorno ?? 1; ctx.lineCap = it.ponta ?? "butt"; ctx.lineJoin = "round"; ctx.stroke(p); }
    } else if (it.tipo === "imagem" || it.tipo === "fundo") {
      const src = it.tipo === "fundo" ? await fundoComoImagem(it, escala) : it.src;
      const img = src ? await carregar(src) : null;
      if (img) {
        ctx.globalAlpha = it.opacidade;
        if (it.tipo === "fundo") ctx.drawImage(img, it.x, it.y, it.w, it.h);
        else { ctx.transform(...it.matriz); ctx.drawImage(img, 0, 0, 1, 1); }
      }
    } else if (it.tipo === "caixinha") {
      ctx.strokeStyle = css(it.cor); ctx.lineWidth = Math.max(0.8, it.lado / 12);
      ctx.strokeRect(it.x, it.y, it.lado, it.lado);
      if (it.marcada) {
        ctx.lineWidth = Math.max(1, it.lado / 8); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(it.x + it.lado * 0.2, it.y + it.lado * 0.52); ctx.lineTo(it.x + it.lado * 0.42, it.y + it.lado * 0.75); ctx.lineTo(it.x + it.lado * 0.82, it.y + it.lado * 0.27); ctx.stroke();
      }
    }
    ctx.restore();
  }
  return new Promise((ok, erro) => tela.toBlob((b) => (b ? ok(b) : erro(new Error("Não consegui gerar a imagem."))), "image/png"));
}
