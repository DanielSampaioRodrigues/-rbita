// Cena desenhada sobre a capa do caderno: por ora, um título (o nome que a
// pessoa escreve na capa). Guardada em JSON no caderno (campo capaCena). As
// coordenadas são frações 0..1 da capa, para render em qualquer tamanho.
import { FONTES } from "../preferencias";
import type { AlinharTexto } from "@orbita/caderno";

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
  return cena.titulo?.texto.trim() ? JSON.stringify(cena) : "";
}

/** Há algo desenhado na capa (hoje: um título com texto). */
export const temCapaCena = (json?: string) => !!lerCenaCapa(json).titulo?.texto.trim();

/** Título inicial, centralizado, a partir do nome do caderno. */
export function tituloPadrao(nome: string): TituloCapa {
  return { texto: nome.trim() || "Meu caderno", x: 0.5, y: 0.5, tamanho: 0.12, cor: "#ffffff", fonte: "", alinhamento: "centro", negrito: true };
}

/** CSS da fonte escolhida (ou vazio para herdar a do app). */
export function fonteCapaCss(fonte?: string): string | undefined {
  return fonte && fonte in FONTES ? FONTES[fonte as keyof typeof FONTES].css : undefined;
}
