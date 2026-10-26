// Tipos comuns do motor de leitura.

export type Formato = "epub" | "pdf";

/** Cores de papel oferecidas, do claro ao escuro. */
export type CorFundo = "branco" | "creme" | "polen" | "cinza" | "escuro";

export type Alinhamento = "esquerda" | "justificado";

export type Modo = "paginas" | "rolagem";

/** Preferências de leitura, aplicadas ao conteúdo do livro. */
export interface ConfigLeitura {
  /** Família da fonte, por exemplo "Atkinson Hyperlegible" ou "OpenDyslexic". */
  fonte: string;
  /** Tamanho da letra em porcentagem (100 = padrão). */
  tamanho: number;
  /** Entrelinha (1.5 = uma vez e meia). */
  entrelinha: number;
  /** Margem lateral em porcentagem da largura. */
  margem: number;
  alinhamento: Alinhamento;
  corFundo: CorFundo;
  modo: Modo;
}

export const CONFIG_PADRAO: ConfigLeitura = {
  fonte: "Atkinson Hyperlegible Next",
  tamanho: 100,
  entrelinha: 1.6,
  margem: 6,
  alinhamento: "esquerda",
  corFundo: "creme",
  modo: "paginas",
};

/** Onde a pessoa parou. Para EPUB é um CFI; para PDF, o número da página. */
export interface Localizacao {
  epubCfi?: string;
  pdfPagina?: number;
}

/** Item do sumário navegável. */
export interface ItemSumario {
  titulo: string;
  /** Destino (href do EPUB ou número da página do PDF). */
  destino: string;
  nivel: number;
}

/** Cores de grifo e caneta, em hex, iguais à paleta de etiquetas do app. */
export const CORES_ANOTACAO: Record<string, string> = {
  musgo: "#5b7a4c",
  mar: "#2e7a80",
  ceu: "#44709f",
  lavanda: "#7c68a8",
  rosa: "#a95b7f",
  terra: "#94603d",
  areia: "#8f7738",
  cinza: "#6f747c",
};

/** Ferramenta ativa ao ler um PDF. */
export type ModoCaneta = "ler" | "caneta" | "marcaTexto" | "borracha";

/** Um traço da caneta numa página do PDF; pontos relativos (0 a 1). */
export interface Traco {
  id: string;
  pagina: number;
  /** Cor em hex. */
  cor: string;
  /** Espessura relativa à largura da página (0 a 1). */
  espessura: number;
  pontos: { x: number; y: number }[];
}

/** Um trecho selecionado no EPUB, para virar grifo. */
export interface SelecaoTexto {
  cfiRange: string;
  texto: string;
}
