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
