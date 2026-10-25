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
}

export interface Tema {
  id: string;
  nome: string;
  claro: Paleta;
  escuro: Paleta;
  /** Versão sem cor de destaque, usada no modo de baixo estímulo. */
  baixoEstimulo: { claro: Partial<Paleta>; escuro: Partial<Paleta> };
}
