// Tipos do Caderno: o modelo de dados dos dois modos (caderno com páginas e
// quadro infinito) e da cena desenhável. Tudo puro (sem DOM, sem React), para
// o motor rodar aqui e também no Escuta. O desenho em si chega nas próximas
// etapas; aqui ficam as estruturas que tudo o mais usa.

/** Modo do caderno, escolhido ao criar e fixo depois. */
export type ModoCaderno = "caderno" | "infinito";

/** Tamanho da página no modo caderno. "infinito" é o quadro sem bordas. */
export type TamanhoPagina = "a4" | "a5" | "carta" | "infinito";

/** Medidas (em pixels de referência, a 96 dpi) de cada tamanho de página. */
export const TAMANHOS: Record<Exclude<TamanhoPagina, "infinito">, { largura: number; altura: number }> = {
  a4: { largura: 794, altura: 1123 },
  a5: { largura: 559, altura: 794 },
  carta: { largura: 816, altura: 1056 },
};

/** Modelo de linhas da folha. "proprio" usa um arquivo da pessoa (PDF/PNG/SVG). */
export type ModeloPapel = "liso" | "pautado" | "quadriculado" | "pontilhado" | "isometrico" | "planner" | "partitura" | "proprio";

/** Os modelos de folha oferecidos (sem "proprio", que depende de importar arquivo). */
export const MODELOS_PAPEL: ModeloPapel[] = ["liso", "pautado", "quadriculado", "pontilhado", "isometrico", "planner", "partitura"];

/** A folha: fundo e linhas. Vale por página (cada página pode ter a sua). */
export interface Papel {
  modelo: ModeloPapel;
  /** Nome de cor da paleta, um hex livre (#rrggbb), ou vazio para o padrão. */
  corPapel: string;
  corLinha: string;
  /** Opacidade do fundo e das linhas (0..1). Ausente = 1 (cheio). */
  opacPapel?: number;
  opacLinha?: number;
  /** Distância entre linhas, em px. */
  espacamento: number;
  /** Espessura das linhas, em px. */
  espessura: number;
  /** Linha de margem à esquerda. */
  margem: boolean;
  /** Linha de cabeçalho no topo. */
  cabecalho: boolean;
  /** Modelo "proprio": id do anexo (PDF/PNG/SVG) usado como fundo. */
  anexoId: string;
}

export function papelPadrao(): Papel {
  return { modelo: "liso", corPapel: "", corLinha: "", espacamento: 32, espessura: 1, margem: false, cabecalho: false, anexoId: "" };
}

/** Um ponto do traço, com pressão de 0 a 1 (1 quando não há caneta sensível). */
export interface Ponto {
  x: number;
  y: number;
  p: number;
}

export type Ferramenta = "caneta" | "lapis" | "pincel" | "marcatexto" | "borracha";

/** Um traço à mão livre. As formas, texto, setas, notas e imagens entram nas
 *  etapas seguintes; por isso `Elemento` já é uma união aberta. */
export interface Traco {
  tipo: "traco";
  id: string;
  ferramenta: Ferramenta;
  cor: string;
  espessura: number;
  /** Sensibilidade à pressão (0 = sem pressão). Omisso = padrão da ferramenta. */
  afinar?: number;
  /** Estabilização do traço (0..1). Omisso = padrão da ferramenta. */
  alisar?: number;
  /** Opacidade (0..1). Omisso = padrão da ferramenta. */
  opacidade?: number;
  pontos: Ponto[];
}

/** Uma caixa de texto digitado na página. A largura é fixa (a pessoa arrasta
 *  para mover); a altura cresce com o conteúdo. Coordenadas em px de referência. */
export type AlinharTexto = "esquerda" | "centro" | "direita";

export interface Texto {
  tipo: "texto";
  id: string;
  x: number;
  y: number;
  /** Largura da caixa, em px de referência. */
  largura: number;
  /** Conteúdo em HTML simples (negrito, itálico, sublinhado e quebras). */
  texto: string;
  cor: string;
  /** Tamanho da fonte, em px de referência. */
  tamanho: number;
  /** Chave da fonte ("" ou ausente = fonte padrão do app). */
  fonte?: string;
  /** Alinhamento do texto na caixa (ausente = à esquerda). */
  alinhamento?: AlinharTexto;
  /** Cor de fundo (nota adesiva/post-it). Ausente = caixa sem fundo. */
  fundo?: string;
}

/** Formas que se desenham arrastando (traçadas de um canto a outro). */
export type TipoForma = "reta" | "retangulo" | "elipse" | "seta";
export const TIPOS_FORMA: TipoForma[] = ["reta", "retangulo", "elipse", "seta"];

/** Uma forma geométrica. Guarda o retângulo que a contém (dois cantos), em px
 *  de referência; a reta e a seta usam esses dois pontos como extremos. */
export interface Forma {
  tipo: "forma";
  id: string;
  forma: TipoForma;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cor: string;
  espessura: number;
}

/** Uma imagem colada ou inserida na página. Os bytes ficam no cofre (anexo);
 *  aqui guardamos só a referência e a caixa (posição e tamanho). */
export interface Imagem {
  tipo: "imagem";
  id: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  /** Id do anexo (no cofre) com os bytes da imagem. */
  anexoId: string;
}

export type Elemento = Traco | Texto | Forma | Imagem;

/** A cena desenhável de uma página (ou do quadro infinito). */
export interface Cena {
  elementos: Elemento[];
}

export function cenaVazia(): Cena {
  return { elementos: [] };
}

/** Serializa a cena para guardar no cofre (JSON compacto). */
export function serializarCena(cena: Cena): string {
  return JSON.stringify(cena);
}

/** Lê a cena guardada; texto vazio ou inválido vira cena vazia (nunca quebra). */
export function lerCena(texto: string): Cena {
  if (!texto) return cenaVazia();
  try {
    const c = JSON.parse(texto) as Cena;
    return c && Array.isArray(c.elementos) ? c : cenaVazia();
  } catch {
    return cenaVazia();
  }
}

/** Tipo da capa do caderno: cor da paleta, gradiente pronto da galeria, capa de
 *  arte empacotada, ou uma imagem da própria pessoa (enviada ou criada com IA). */
export type TipoCapa = "cor" | "galeria" | "arte" | "imagem";

export interface Capa {
  tipo: TipoCapa;
  /** Cor da paleta ("cor"), id de um gradiente pronto ("galeria"), id de uma
   *  capa de arte empacotada ("arte"), ou o endereço de dados (data URI, já
   *  reduzido) da imagem ("imagem"). */
  valor: string;
}

export function capaPadrao(): Capa {
  return { tipo: "cor", valor: "mar" };
}
