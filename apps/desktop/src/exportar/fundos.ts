// Fundos do CSS (degradê das capas, foto de capa) viram imagem antes de ir para o PDF
// ou para a imagem PNG. Só degradê linear e imagem com "cover" / "contain" / "100% 100%".
import type { ItemDesenho } from "./medir";

type Fundo = Extract<ItemDesenho, { tipo: "fundo" }>;

/** Separa as camadas do background-image (vírgulas fora de parênteses). */
export function separarCamadas(v: string): string[] {
  const partes: string[] = []; let nivel = 0; let atual = "";
  for (const ch of v) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel--;
    if (ch === "," && nivel === 0) { partes.push(atual.trim()); atual = ""; } else atual += ch;
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes;
}

/** Ângulo do degradê linear do CSS (em graus; 180 = de cima para baixo). */
export function anguloDoDegrade(primeiro: string): number | null {
  const m = /^(-?[\d.]+)(deg|turn|rad)$/.exec(primeiro.trim());
  if (m) return m[2] === "turn" ? Number(m[1]) * 360 : m[2] === "rad" ? (Number(m[1]) * 180) / Math.PI : Number(m[1]);
  const lados: Record<string, number> = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270, "to top right": 45, "to right top": 45, "to bottom right": 135, "to right bottom": 135, "to bottom left": 225, "to left bottom": 225, "to top left": 315, "to left top": 315 };
  return lados[primeiro.trim()] ?? null;
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => erro(new Error("imagem"));
    img.src = src;
  });
}

/** Desenha um fundo do CSS num canvas e devolve como imagem (data: URL). */
export async function fundoComoImagem(f: Fundo, escala = 1.5): Promise<string | null> {
  const w = Math.max(1, Math.round(f.w * escala)); const h = Math.max(1, Math.round(f.h * escala));
  const tela = document.createElement("canvas");
  tela.width = w; tela.height = h;
  const ctx = tela.getContext("2d");
  if (!ctx) return null;
  if (f.raio) { ctx.beginPath(); ctx.roundRect(0, 0, w, h, f.raio * escala); ctx.clip(); }
  // As camadas de cima vêm primeiro no CSS: desenha de trás para a frente.
  for (const camada of separarCamadas(f.imagem).reverse()) {
    const lin = /^linear-gradient\((.*)\)$/s.exec(camada);
    if (lin) {
      const partes = separarCamadas(lin[1]);
      let ang = anguloDoDegrade(partes[0]);
      if (ang == null) ang = 180; else partes.shift();
      const rad = (ang * Math.PI) / 180;
      const dx = Math.sin(rad), dy = -Math.cos(rad);
      const L = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
      const g = ctx.createLinearGradient(w / 2 - (dx * L) / 2, h / 2 - (dy * L) / 2, w / 2 + (dx * L) / 2, h / 2 + (dy * L) / 2);
      partes.forEach((p, i) => {
        const m = /^(.*?)(?:\s+([\d.]+)%)?$/.exec(p.trim());
        const cor = m?.[1] ?? p;
        const pos = m?.[2] != null ? Number(m[2]) / 100 : partes.length > 1 ? i / (partes.length - 1) : 0;
        try { g.addColorStop(Math.min(1, Math.max(0, pos)), cor); } catch { /* cor que o canvas não entende */ }
      });
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      continue;
    }
    const url = /^url\(["']?(.*?)["']?\)$/s.exec(camada);
    if (url) {
      try {
        const img = await carregarImagem(url[1]);
        const iw = img.naturalWidth || w, ih = img.naturalHeight || h;
        let dw = w, dh = h;
        if (/cover/.test(f.tamanho)) { const k = Math.max(w / iw, h / ih); dw = iw * k; dh = ih * k; }
        else if (/contain/.test(f.tamanho)) { const k = Math.min(w / iw, h / ih); dw = iw * k; dh = ih * k; }
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      } catch { /* imagem que não abriu: fica só a cor */ }
    }
  }
  return tela.toDataURL(f.raio ? "image/png" : "image/jpeg", 0.9);
}
