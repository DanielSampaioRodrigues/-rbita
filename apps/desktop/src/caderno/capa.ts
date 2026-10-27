// Cena desenhada sobre a capa do caderno: por ora, um título (o nome que a
// pessoa escreve na capa). Guardada em JSON no caderno (campo capaCena). As
// coordenadas são frações 0..1 da capa, para render em qualquer tamanho.
import { FONTES } from "../preferencias";
import type { AlinharTexto, Traco } from "@orbita/caderno";

/** Espaço de referência da capa (proporção 3:4). Os traços guardam coordenadas
 *  neste espaço; o título usa frações 0..1. Tudo escala junto na proporção. */
export const CAPA_REF = { largura: 300, altura: 400 } as const;

export interface TituloCapa {
  texto: string;
  /** Centro do título, fração 0..1 da largura e da altura da capa. */
  x: number;
  y: number;
  /** Tamanho da fonte, fração da altura da capa (ex.: 0.11 = 11%). */
  tamanho: number;
  cor: string;
  /** Chave da fonte ("" = padrão do app). */
  fonte?: string;
  alinhamento?: AlinharTexto;
  negrito?: boolean;
}

export interface CenaCapa {
  titulo?: TituloCapa;
  /** Traços à mão desenhados na capa (coordenadas no espaço CAPA_REF). */
  tracos?: Traco[];
}

export function lerCenaCapa(json?: string): CenaCapa {
  if (!json) return {};
  try {
    const c = JSON.parse(json) as CenaCapa;
    return c && typeof c === "object" ? c : {};
  } catch {
    return {};
  }
}

export function serializarCenaCapa(cena: CenaCapa): string {
  const tem = cena.titulo?.texto.trim() || (cena.tracos?.length ?? 0) > 0;
  return tem ? JSON.stringify(cena) : "";
}

/** Há algo desenhado na capa (título ou traços). */
export function temCapaCena(json?: string): boolean {
  const c = lerCenaCapa(json);
  return !!c.titulo?.texto.trim() || (c.tracos?.length ?? 0) > 0;
}

/** Título inicial, centralizado, a partir do nome do caderno. */
export function tituloPadrao(nome: string): TituloCapa {
  return { texto: nome.trim() || "Meu caderno", x: 0.5, y: 0.5, tamanho: 0.12, cor: "#ffffff", fonte: "", alinhamento: "centro", negrito: true };
}

/** CSS da fonte escolhida (ou vazio para herdar a do app). */
export function fonteCapaCss(fonte?: string): string | undefined {
  return fonte && fonte in FONTES ? FONTES[fonte as keyof typeof FONTES].css : undefined;
}
