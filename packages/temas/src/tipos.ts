/** Cores de um modo (claro ou escuro) de um tema. */
export interface Paleta {
  /** Fundo da janela. */
  fundo: string;
  /** Painéis e cartões sobre o fundo. */
  superficie: string;
  /** Áreas destacadas dentro de um painel (item selecionado, campo). */
  superficieAlternativa: string;
  texto: string;
  textoSuave: string;
  /** Divisórias decorativas; não precisam de contraste mínimo. */
  borda: string;
  /** Contorno de campos e botões; precisa de 3:1. */
  bordaControle: string;
  destaque: string;
  textoSobreDestaque: string;
  /** Anel de foco do teclado. */
  foco: string;
  /** Avisos e erros: chama atenção sem alarmar (nada de vermelho gritante). */
  atencao: string;
}

/** Fundo da janela. Imagens e SVG vêm da pessoa; padrões são desenhados pelo próprio Órbita. */
export type Fundo =
  | { tipo: "cor" }
  | { tipo: "gradiente"; nome: string }
  | { tipo: "padrao"; nome: string }
  | { tipo: "imagem"; dados: string; desfoque: number; escurecimento: number }
  | { tipo: "svg"; conteudo: string; repetir: boolean; animar: boolean };

export interface Tema {
  id: string;
  nome: string;
  /** Multiplica o arredondamento dos cantos (1 = padrão). */
  cantos?: number;
  /** false tira as sombras. */
  sombra?: boolean;
  /** Fundo sugerido pelo tema; a pessoa pode trocar. */
  fundoPadrao?: Fundo;
  claro: Paleta;
  escuro: Paleta;
  /** Versão sem cor de destaque, usada no modo de baixo estímulo. */
  baixoEstimulo: { claro: Partial<Paleta>; escuro: Partial<Paleta> };
}
