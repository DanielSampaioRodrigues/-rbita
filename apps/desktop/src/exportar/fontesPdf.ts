// Fontes do PDF. Usa os mesmos arquivos de fonte que o app já usa para desenhar o
// texto (lidos das regras @font-face da página), convertidos de WOFF2 e reduzidos às
// letras usadas. Times New Roman, Arial, Calibri, Georgia, Cambria e Courier New entram
// pelas substitutas de mesma medida (Tinos, Arimo, Carlito, Gelasio, Caladea,
// Cousine): o PDF fica igual em qualquer aparelho e as linhas quebram no mesmo lugar.
// Fontes do aparelho que não vão junto com o app viram uma parecida (com serifa, sem
// serifa ou de máquina de escrever), mantendo o lugar exato de cada palavra.
import type { PDFDocument, PDFFont } from "pdf-lib";
import { generica, temFonte } from "../caderno/editor/fontes";

interface Face { familia: string; italico: boolean; pesoMin: number; pesoMax: number; url: string }

/** As que têm uma substituta de mesma medida no app. */
export const GEMEAS: Record<string, string> = {
  "times new roman": "Tinos", times: "Tinos", "liberation serif": "Tinos",
  arial: "Arimo", helvetica: "Arimo", "helvetica neue": "Arimo", "liberation sans": "Arimo",
  calibri: "Carlito", georgia: "Gelasio", cambria: "Caladea",
  "courier new": "Cousine", courier: "Cousine", "liberation mono": "Cousine",
};
const GENERICAS: Record<string, string> = {
  serif: "Tinos", "ui-serif": "Tinos", "sans-serif": "Arimo", "system-ui": "Arimo", "-apple-system": "Arimo", "ui-sans-serif": "Arimo", "ui-rounded": "Arimo",
  monospace: "Cousine", "ui-monospace": "Cousine", cursive: "Caveat Variable", fantasy: "Arimo",
};

/** As famílias de uma pilha do CSS, sem aspas. */
export function familiasDaPilha(pilha: string): string[] {
  return pilha.split(",").map((f) => f.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

/** A regra de unicode-range cobre o alfabeto latino básico (U+0000-00FF)? */
function cobreLatino(faixa: string): boolean {
  if (!faixa) return true;
  return faixa.split(",").some((p) => {
    const m = /U\+([0-9A-F?]+)(?:-([0-9A-F]+))?/i.exec(p.trim());
    if (!m) return false;
    const ini = parseInt(m[1].replace(/\?/g, "0"), 16);
    const fim = m[2] ? parseInt(m[2], 16) : parseInt(m[1].replace(/\?/g, "F"), 16);
    return ini <= 0x41 && fim >= 0x7a;
  });
}

let faces: Map<string, Face[]> | null = null;
/** As fontes que o app carrega (das regras @font-face), por família. */
export function facesDoApp(): Map<string, Face[]> {
  if (faces) return faces;
  faces = new Map();
  for (const folha of Array.from(document.styleSheets)) {
    let regras: CSSRuleList;
    try { regras = folha.cssRules; } catch { continue; }
    for (const r of Array.from(regras)) {
      if (!(r instanceof CSSFontFaceRule)) continue;
      const st = r.style;
      const familia = st.getPropertyValue("font-family").trim().replace(/^["']|["']$/g, "");
      if (!familia || !cobreLatino(st.getPropertyValue("unicode-range"))) continue;
      const src = /url\(["']?([^"')]+)["']?\)/.exec(st.getPropertyValue("src"));
      if (!src) continue;
      const pesos = st.getPropertyValue("font-weight").trim().split(/\s+/).map((n) => (n === "normal" ? 400 : n === "bold" ? 700 : Number(n) || 400));
      const face: Face = {
        familia, italico: /italic|oblique/.test(st.getPropertyValue("font-style")),
        pesoMin: pesos[0], pesoMax: pesos[1] ?? pesos[0],
        url: new URL(src[1], folha.href ?? document.baseURI).href,
      };
      const k = familia.toLowerCase();
      faces.set(k, [...(faces.get(k) ?? []), face]);
    }
  }
  return faces;
}

export interface FontePdf { fonte: PDFFont; negritoFalso: boolean; italicoFalso: boolean; aproximada: boolean; letras: Set<number> }

/** Qual família do app usar para uma pilha do CSS (e se é só parecida). */
export function escolherFamilia(pilha: string): { familia: string; aproximada: boolean } {
  const todas = facesDoApp();
  for (const f of familiasDaPilha(pilha)) {
    const k = f.toLowerCase();
    if (GEMEAS[k]) return { familia: GEMEAS[k], aproximada: false };
    if (todas.has(k)) return { familia: f, aproximada: false };
    if (GENERICAS[k]) return { familia: GENERICAS[k], aproximada: false };
    // Fonte do aparelho que o app não tem: o navegador usou ela (se existe); no PDF
    // entra uma parecida no lugar.
    if (temFonte(f)) return { familia: GENERICAS[generica(f)] ?? "Arimo", aproximada: true };
  }
  return { familia: "Arimo", aproximada: true };
}

/** Converte e guarda as fontes de um documento PDF (uma vez por arquivo de fonte). */
export class FontesDoPdf {
  private embutidas = new Map<string, Promise<{ fonte: PDFFont; letras: Set<number> } | null>>();
  aproximadas = new Set<string>();
  constructor(private doc: PDFDocument) {}

  private carregar(url: string) {
    let p = this.embutidas.get(url);
    if (!p) {
      p = (async () => {
        try {
          const r = await fetch(url);
          let bytes: Uint8Array = new Uint8Array(await r.arrayBuffer());
          // WOFF2 ("wOF2") vira TTF antes (o leitor de fontes do PDF erra nas letras com acento do WOFF2).
          if (bytes[0] === 0x77 && bytes[1] === 0x4f && bytes[2] === 0x46 && bytes[3] === 0x32) {
            const { default: descomprimir } = await import("woff2-encoder/decompress");
            bytes = await descomprimir(bytes);
          }
          const fonte = await this.doc.embedFont(bytes, { subset: true });
          return { fonte, letras: new Set(fonte.getCharacterSet()) };
        } catch {
          return null;
        }
      })();
      this.embutidas.set(url, p);
    }
    return p;
  }

  /** A fonte do PDF para uma pilha do CSS, um peso e um estilo. */
  async fonte(pilha: string, peso: number, italico: boolean): Promise<FontePdf | null> {
    const { familia, aproximada } = escolherFamilia(pilha);
    if (aproximada) this.aproximadas.add(familiasDaPilha(pilha)[0] ?? pilha);
    const lista = facesDoApp().get(familia.toLowerCase()) ?? facesDoApp().get("arimo") ?? [];
    if (!lista.length) return null;
    const mesmoEstilo = lista.filter((f) => f.italico === italico);
    const opcoes = mesmoEstilo.length ? mesmoEstilo : lista;
    // O peso mais perto (fonte variável: a faixa toda conta, mas o arquivo desenha o padrão, 400).
    const dist = (f: Face) => (peso >= f.pesoMin && peso <= f.pesoMax ? 0 : Math.min(Math.abs(peso - f.pesoMin), Math.abs(peso - f.pesoMax)));
    const face = [...opcoes].sort((a, b) => dist(a) - dist(b))[0];
    const variavel = face.pesoMin !== face.pesoMax;
    const pesoDoArquivo = variavel ? 400 : face.pesoMin;
    const c = await this.carregar(face.url);
    if (!c) return null;
    return { fonte: c.fonte, letras: c.letras, negritoFalso: peso >= 600 && pesoDoArquivo < 600, italicoFalso: italico && !face.italico, aproximada };
  }
}
