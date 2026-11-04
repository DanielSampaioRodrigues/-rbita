// Cena desenhada sobre a capa do caderno: por ora, um título (o nome que a
// pessoa escreve na capa). Guardada em JSON no caderno (campo capaCena). As
// coordenadas são frações 0..1 da capa, para render em qualquer tamanho.
import { FONTES } from "../preferencias";
import type { AlinharTexto, Cena, Texto, Traco } from "@orbita/caderno";

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

// ---------- Capa como primeira página (como no Goodnotes, novembro/2026) ----------
// A capa passou a ser a página 1 do caderno, editada com as mesmas ferramentas
// das outras páginas. A folha dessa página guarda o modelo da capa (`papel.capa`),
// e o caderno ganha esta marca em `capaCena` para não recriar a capa se a pessoa
// apagar a página (e para a estante mostrar a página no lugar da capa antiga).
export const CAPA_NA_PAGINA = '{"naPagina":true}';
/** Caderno criado sem capa (de propósito): a capa antiga não vira página. */
export const SEM_CAPA = '{"naPagina":false}';
/** A capa deste caderno já segue o modelo novo (na página, ou sem capa). */
export function capaJaDecidida(json?: string): boolean {
  return !!json && json.includes('"naPagina":');
}
export function capaNaPagina(json?: string): boolean {
  return !!json && json.includes('"naPagina":true');
}

/** O nome do caderno como caixa de texto da capa: grande, branco, centralizado. */
export function tituloDaCapa(nome: string, largura: number, altura: number): Texto {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const l = largura * 0.84;
  return {
    tipo: "texto", id: crypto.randomUUID(), x: (largura - l) / 2, y: altura * 0.32, largura: l,
    texto: `<p><strong>${esc(nome.trim() || "Meu caderno")}</strong></p>`, cor: "#ffffff", tamanho: Math.round(altura * 0.055), alinhamento: "centro",
  };
}

/** Converte a capa antiga (título e traços numa capa 3:4) na cena da página-capa. */
export function cenaDaCapaAntiga(antiga: CenaCapa, nome: string, largura: number, altura: number): Cena {
  const kx = largura / CAPA_REF.largura, ky = altura / CAPA_REF.altura;
  const elementos: Cena["elementos"] = [];
  for (const tr of antiga.tracos ?? []) {
    elementos.push({ ...tr, espessura: Math.max(1, (tr.espessura || 3) * kx), pontos: tr.pontos.map((p) => ({ ...p, x: p.x * kx, y: p.y * ky })) });
  }
  const tit = antiga.titulo;
  if (tit && tit.texto.trim()) {
    const l = largura * 0.84;
    const tam = Math.round(tit.tamanho * altura);
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = esc(tit.texto).split("\n").map((linha) => `<p>${tit.negrito ? `<strong>${linha}</strong>` : linha}</p>`).join("");
    const linhas = Math.max(1, tit.texto.split("\n").length);
    elementos.push({
      tipo: "texto", id: crypto.randomUUID(), x: tit.x * largura - l / 2, y: tit.y * altura - (linhas * tam * 1.3) / 2, largura: l,
      texto: html, cor: tit.cor || "#ffffff", tamanho: tam, fonte: tit.fonte || undefined, alinhamento: tit.alinhamento ?? "centro",
    });
  } else if (!(antiga.tracos?.length)) {
    elementos.push(tituloDaCapa(nome, largura, altura));
  }
  return { elementos };
}
