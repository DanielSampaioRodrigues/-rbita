// Fundos: padrões desenhados pelo Órbita, gradientes a partir das cores do tema,
// e a conta que garante a leitura do texto sobre qualquer fundo.
import { contraste, lerHex } from "./contraste";
import { congelarSvg, pintarSvg, svgComoUrl } from "./svg";
import type { Fundo, Paleta } from "./tipos";

export type Rgb = [number, number, number];

const hex = ([r, g, b]: Rgb) => "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

/** Mistura duas cores: t = 0 é só `a`, t = 1 é só `b`. */
export function misturar(a: string | Rgb, b: string | Rgb, t: number): Rgb {
  const x = typeof a === "string" ? lerHex(a) : a;
  const y = typeof b === "string" ? lerHex(b) : b;
  return [0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as Rgb;
}

/** Padrões em SVG, desenhados com currentColor (pintados com a cor do tema). */
export const PADROES: Record<string, { nome: string; svg: string; tamanho: number }> = {
  pontos: {
    nome: "Pontos",
    tamanho: 24,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="1.3" fill="currentColor" fill-opacity="0.32"/></svg>`,
  },
  linhas: {
    nome: "Linhas",
    tamanho: 28,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><path d="M-7 7l14-14M0 28L28 0M21 35l14-14" stroke="currentColor" stroke-opacity="0.16" stroke-width="1"/></svg>`,
  },
  grade: {
    nome: "Grade",
    tamanho: 32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="M32 0H0V32" fill="none" stroke="currentColor" stroke-opacity="0.14" stroke-width="1"/></svg>`,
  },
  papel: {
    nome: "Papel",
    tamanho: 120,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" fill="none" stroke="currentColor" stroke-opacity="0.09" stroke-linecap="round"><path d="M8 14l9 2M40 9l6 4M78 18l11-1M104 30l7 5M20 44l5 7M58 40l10 2M92 56l4 8M12 78l9-3M46 70l7 6M74 86l10 1M30 104l6 5M64 110l9-2M100 98l8 4"/></svg>`,
  },
  estrelas: {
    nome: "Estrelas",
    tamanho: 160,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" fill="currentColor"><circle cx="14" cy="22" r="1" fill-opacity="0.45"/><circle cx="62" cy="10" r="0.7" fill-opacity="0.35"/><circle cx="118" cy="30" r="1.4" fill-opacity="0.4"/><circle cx="40" cy="70" r="0.8" fill-opacity="0.3"/><circle cx="96" cy="84" r="1.1" fill-opacity="0.45"/><circle cx="146" cy="96" r="0.7" fill-opacity="0.3"/><circle cx="22" cy="128" r="1.2" fill-opacity="0.35"/><circle cx="78" cy="140" r="0.8" fill-opacity="0.4"/><circle cx="132" cy="150" r="1" fill-opacity="0.3"/><path d="M118 112l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill-opacity="0.35"/></svg>`,
  },
  folhas: {
    nome: "Folhas",
    tamanho: 140,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" fill="none" stroke="currentColor" stroke-opacity="0.13" stroke-width="1.2" stroke-linecap="round"><path d="M20 40c10-16 30-18 34-14-4 14-20 24-34 14zM20 40l28-10"/><path d="M90 100c12-14 32-14 35-9-6 13-23 21-35 9zM90 100l30-6"/><path d="M96 26c4-12 18-18 22-15 0 11-11 20-22 15zM96 26l18-11"/><path d="M26 112c3-11 15-16 19-13-1 10-11 17-19 13zM26 112l16-9"/></svg>`,
  },
};

/** Gradientes a partir das cores do tema (assim continuam combinando quando o tema muda). */
export const GRADIENTES: Record<string, { nome: string; paradas: (p: Paleta) => Rgb[]; angulo: number }> = {
  suave: { nome: "Suave", angulo: 160, paradas: (p) => [lerHex(p.fundo), lerHex(p.superficieAlternativa)] },
  luz: { nome: "Luz", angulo: 180, paradas: (p) => [lerHex(p.superficie), lerHex(p.fundo), lerHex(p.superficieAlternativa)] },
  cor: { nome: "Cor do tema", angulo: 135, paradas: (p) => [lerHex(p.fundo), misturar(p.fundo, p.destaque, 0.28)] },
};

export interface CamadaDeFundo {
  /** Valor para `background-image` (ou "none"). */
  imagem: string;
  tamanho: string;
  repetir: string;
  /** Desfoque da imagem, em px. */
  desfoque: number;
  /** De 0 a 1: véu escuro por cima da imagem. */
  escurecimento: number;
  /** Cores conhecidas do fundo (para a conta de contraste sem precisar de canvas). */
  amostrasConhecidas: Rgb[] | null;
}

/**
 * Como desenhar o fundo. Baixo estímulo leva tudo ao neutro (fundo liso).
 * SVG animado fica parado, a menos que a pessoa peça animação e não esteja
 * com "reduzir animações" ligado no sistema.
 */
export function camadaDeFundo(fundo: Fundo, paleta: Paleta, opcoes: { baixoEstimulo: boolean; reduzirAnimacao: boolean }): CamadaDeFundo {
  const liso: CamadaDeFundo = { imagem: "none", tamanho: "auto", repetir: "no-repeat", desfoque: 0, escurecimento: 0, amostrasConhecidas: [lerHex(paleta.fundo)] };
  if (opcoes.baixoEstimulo) return liso;
  switch (fundo.tipo) {
    case "cor":
      return liso;
    case "gradiente": {
      const g = GRADIENTES[fundo.nome];
      if (!g) return liso;
      const paradas = g.paradas(paleta);
      return { ...liso, imagem: `linear-gradient(${g.angulo}deg, ${paradas.map(hex).join(", ")})`, amostrasConhecidas: paradas };
    }
    case "padrao": {
      const pd = PADROES[fundo.nome];
      if (!pd) return liso;
      return {
        ...liso,
        imagem: svgComoUrl(pintarSvg(pd.svg, paleta.textoSuave)),
        tamanho: `${pd.tamanho}px ${pd.tamanho}px`,
        repetir: "repeat",
        // O traço é fino e transparente: a cor de fundo domina.
        amostrasConhecidas: [lerHex(paleta.fundo), misturar(paleta.fundo, paleta.textoSuave, 0.35)],
      };
    }
    case "imagem":
      return {
        ...liso,
        imagem: `url("${fundo.dados}")`,
        tamanho: "cover",
        desfoque: Math.max(0, Math.min(30, fundo.desfoque)),
        escurecimento: Math.max(0, Math.min(0.8, fundo.escurecimento)),
        amostrasConhecidas: null,
      };
    case "svg": {
      const animar = fundo.animar && !opcoes.reduzirAnimacao;
      const svg = pintarSvg(animar ? fundo.conteudo : congelarSvg(fundo.conteudo), paleta.textoSuave);
      return { ...liso, imagem: svgComoUrl(svg), tamanho: fundo.repetir ? "auto" : "cover", repetir: fundo.repetir ? "repeat" : "no-repeat", amostrasConhecidas: null };
    }
  }
}

/**
 * Contraste automático: a menor opacidade dos painéis (cor de fundo do tema por
 * cima da imagem) que mantém texto ≥ 7:1, texto suave e destaque ≥ 4,5:1 em
 * 98% dos pontos amostrados do fundo.
 */
export function opacidadeNecessaria(amostras: Rgb[], paleta: Paleta, minimo = 0): number {
  if (amostras.length === 0) return 1;
  const painel = lerHex(paleta.fundo);
  const toleradas = Math.floor(amostras.length * 0.02);
  for (let o = minimo; o <= 1.0001; o += 0.02) {
    let falhas = 0;
    for (const a of amostras) {
      const cor = hex(misturar(a, painel, o));
      if (contraste(paleta.texto, cor) < 7 || contraste(paleta.textoSuave, cor) < 4.5 || contraste(paleta.destaque, cor) < 4.5) falhas++;
      if (falhas > toleradas) break;
    }
    if (falhas <= toleradas) return Math.min(1, Math.round(o * 100) / 100);
  }
  return 1;
}

/** Aplica o véu escuro da imagem às amostras (o véu fica entre a imagem e os painéis). */
export function escurecerAmostras(amostras: Rgb[], escurecimento: number): Rgb[] {
  return amostras.map((a) => misturar(a, [0, 0, 0], escurecimento));
}
