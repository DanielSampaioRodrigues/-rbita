// "Ensinar a minha letra": a pessoa escreve cada letra uma vez (a–z, ç e os acentos), e o
// corretor da escrita à mão passa a trocar a palavra errada pela certa **na letra dela**,
// montando a palavra com essas letras (em vez da fonte cursiva). Fica no cofre
// ("caderno.alfabeto") e vale em todos os cadernos e aparelhos.
//
// Cada letra é guardada em "unidades da caixa": a caixa onde a pessoa escreve tem altura 1,
// com a linha de base em 0,72 e a linha do meio (altura do "a") em 0,42.
import { api } from "../api";

export const LETRAS = "abcdefghijklmnopqrstuvwxyzç".split("");
export const ACENTOS = ["´", "`", "^", "~"];
export const CARACTERES = [...LETRAS, ...ACENTOS];
export const LINHA_BASE = 0.72;
export const LINHA_MEIO = 0.42;
/** Espaço entre uma letra e a próxima, em unidades da caixa. */
const ESPACO = 0.05;

export interface PontoGlifo { x: number; y: number; p: number }
export interface Glifo { tracos: PontoGlifo[][] }
export type Alfabeto = Record<string, Glifo>;

const CHAVE = "caderno.alfabeto";

export async function lerAlfabeto(): Promise<Alfabeto> {
  const v = await api.lerValor(CHAVE).catch(() => null);
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Alfabeto = {};
  for (const [k, g] of Object.entries(v as Record<string, unknown>)) {
    const tracos = (g as Glifo | null)?.tracos;
    if (CARACTERES.includes(k) && Array.isArray(tracos) && tracos.length) out[k] = { tracos };
  }
  return out;
}

export async function gravarAlfabeto(a: Alfabeto): Promise<void> {
  const arred = (n: number) => Math.round(n * 1000) / 1000;
  const limpo: Alfabeto = {};
  for (const [k, g] of Object.entries(a)) {
    if (!CARACTERES.includes(k) || !g.tracos.length) continue;
    limpo[k] = { tracos: g.tracos.filter((t) => t.length).map((t) => t.map((p) => ({ x: arred(p.x), y: arred(p.y), p: arred(p.p) }))) };
  }
  await api.gravarValor(CHAVE, limpo);
}

const ACENTO_DE: Record<string, string> = { "́": "´", "̀": "`", "̂": "^", "̃": "~" };

/** "á" → { base: "a", acento: "´" }; "ç" fica "ç"; maiúscula usa a letra minúscula. */
export function decompor(ch: string): { base: string; acento?: string } | null {
  const minuscula = ch.toLocaleLowerCase("pt-BR");
  if (minuscula === "ç") return { base: "ç" };
  const [base, ...marcas] = minuscula.normalize("NFD");
  if (!LETRAS.includes(base)) return null;
  if (!marcas.length) return { base };
  if (marcas.length > 1 || !ACENTO_DE[marcas[0]]) return null;
  return { base, acento: ACENTO_DE[marcas[0]] };
}

/** Dá para escrever a palavra só com as letras que a pessoa ensinou? */
export function podeEscrever(palavra: string, a: Alfabeto): boolean {
  const chars = Array.from(palavra);
  return chars.length > 0 && chars.every((c) => { const d = decompor(c); return !!d && !!a[d.base] && (!d.acento || !!a[d.acento]); });
}

function caixaDe(tracos: PontoGlifo[][]): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of tracos) for (const p of t) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

/** O pingo do "i" e do "j" sai quando a letra leva acento (í). */
function semPingo(tracos: PontoGlifo[][]): PontoGlifo[][] {
  return tracos.filter((t) => { const c = caixaDe([t]); return !c || !(c.y1 < LINHA_MEIO && c.y1 - c.y0 < 0.12 && c.x1 - c.x0 < 0.12); });
}

/** Monta a palavra com as letras da pessoa (em unidades da caixa, lado a lado na mesma linha de base). */
export function comporPalavra(palavra: string, a: Alfabeto): PontoGlifo[][] {
  const { letras, acentos } = comporSeparado(palavra, a);
  return [...letras, ...acentos];
}

/** A palavra montada, com as letras e os acentos separados (o tamanho se mede só pelas letras). */
export function comporSeparado(palavra: string, a: Alfabeto): { letras: PontoGlifo[][]; acentos: PontoGlifo[][] } {
  const out: PontoGlifo[][] = [];
  const acentos: PontoGlifo[][] = [];
  let cursor = 0;
  for (const c of Array.from(palavra)) {
    const d = decompor(c);
    if (!d || !a[d.base]) continue;
    const base = d.acento && (d.base === "i" || d.base === "j") ? semPingo(a[d.base].tracos) : a[d.base].tracos;
    const cx = caixaDe(base);
    if (!cx) continue;
    const dx = cursor - cx.x0;
    out.push(...base.map((t) => t.map((p) => ({ ...p, x: p.x + dx }))));
    if (d.acento && a[d.acento]) {
      // O acento vai centrado em cima da letra, logo acima dela.
      const ac = a[d.acento].tracos, ca = caixaDe(ac);
      if (ca) {
        const meioLetra = cursor + (cx.x1 - cx.x0) / 2;
        const ax = meioLetra - (ca.x0 + ca.x1) / 2;
        const ay = Math.min(0, cx.y0 - 0.04 - ca.y1);
        acentos.push(...ac.map((t) => t.map((p) => ({ ...p, x: p.x + ax, y: p.y + ay }))));
      }
    }
    cursor += cx.x1 - cx.x0 + ESPACO;
  }
  return { letras: out, acentos };
}

/** Leva a palavra montada para a caixa da palavra original (mesma altura, começando no mesmo lugar). */
export function encaixar(tracos: PontoGlifo[][], caixa: { x: number; y: number; h: number }, medida: PontoGlifo[][] = tracos): PontoGlifo[][] {
  // A medida (normalmente só as letras, sem os acentos) define o tamanho e o lugar;
  // o acento fica por cima, como na escrita de verdade.
  const c = caixaDe(medida.length ? medida : tracos);
  if (!c) return [];
  const k = caixa.h / Math.max(0.05, c.y1 - c.y0);
  return tracos.map((t) => t.map((p) => ({ x: caixa.x + (p.x - c.x0) * k, y: caixa.y + (p.y - c.y0) * k, p: p.p })));
}
