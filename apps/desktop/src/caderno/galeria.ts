// Galeria embutida: capas de arte e adesivos prontos, compostos a partir de
// elementos de stock e empacotados com o app (em apps/desktop/public/galeria).
// As capas são referência por id (o endereço aponta para o arquivo empacotado);
// os adesivos entram na página como figura comum (vão para o cofre ao inserir).

export interface ItemGaleria {
  id: string;
  nome: string;
}

/** Capas de arte prontas (imagem empacotada). Estilos variados, público amplo. */
export const CAPAS_ARTE: ItemGaleria[] = [
  { id: "montanha-serena", nome: "Montanha serena" },
  { id: "montanha-neblina", nome: "Montanha na neblina" },
  { id: "por-do-sol", nome: "Pôr do sol" },
  { id: "pastel-suave", nome: "Pastel suave" },
  { id: "papel-recortado", nome: "Papel recortado" },
  { id: "formas-organicas", nome: "Formas orgânicas" },
  { id: "traco-boho", nome: "Traço boho" },
  { id: "gradiente-colorido", nome: "Gradiente colorido" },
];

/** Adesivos prontos, agrupados por tema (o grupo ajuda a achar). */
export const ADESIVOS: { grupo: string; itens: ItemGaleria[] }[] = [
  {
    grupo: "Bichos",
    itens: [
      { id: "gato", nome: "Gato" },
      { id: "raposa", nome: "Raposa" },
      { id: "panda", nome: "Panda" },
      { id: "coruja", nome: "Coruja" },
      { id: "pinguim", nome: "Pinguim" },
      { id: "coala", nome: "Coala" },
      { id: "coelho", nome: "Coelho" },
    ],
  },
  {
    grupo: "Plantas",
    itens: [
      { id: "folha", nome: "Folha" },
      { id: "flor", nome: "Flor" },
      { id: "planta", nome: "Plantinha" },
      { id: "lotus", nome: "Lótus" },
      { id: "tulipa", nome: "Tulipa" },
    ],
  },
  {
    grupo: "Céu",
    itens: [
      { id: "lua", nome: "Lua" },
      { id: "lua-estrelas", nome: "Lua e estrelas" },
      { id: "saturno", nome: "Saturno" },
      { id: "estrela", nome: "Planeta" },
      { id: "sol", nome: "Planeta azul" },
    ],
  },
  {
    grupo: "Retrô",
    itens: [
      { id: "arcoiris", nome: "Arco-íris" },
      { id: "arcoiris-retro", nome: "Arco-íris retrô" },
      { id: "flor-groovy", nome: "Flor groovy" },
      { id: "flor-coracao", nome: "Flor coração" },
      { id: "flor-sorriso", nome: "Flor sorriso" },
      { id: "florzinha", nome: "Florzinha" },
      { id: "carinha", nome: "Carinha de óculos" },
      { id: "paz", nome: "Paz e amor" },
    ],
  },
  {
    grupo: "Pop",
    itens: [
      { id: "pop-boca", nome: "Boca" },
      { id: "pop-coracao", nome: "Coração pop" },
      { id: "pop-estrela", nome: "Estrela pop" },
      { id: "pop-coroa", nome: "Coroa" },
      { id: "pop-diamante", nome: "Diamante" },
      { id: "pop-raio", nome: "Raio pop" },
      { id: "pop-bola", nome: "Bola 5" },
      { id: "pop-fita", nome: "Fita cassete" },
      { id: "pop-paz", nome: "Paz" },
    ],
  },
  {
    grupo: "Rock",
    itens: [
      { id: "caveira", nome: "Caveira" },
      { id: "caveira-rock", nome: "Caveira rock" },
      { id: "raio", nome: "Raio" },
      { id: "raio-asas", nome: "Raio com asas" },
      { id: "palheta", nome: "Palheta de guitarra" },
      { id: "estrela-cadente", nome: "Estrela cadente" },
      { id: "estrela-ninja", nome: "Estrela ninja" },
    ],
  },
];

const base = import.meta.env.BASE_URL || "/";

/** Endereço do arquivo de uma capa de arte empacotada. */
export const urlCapaArte = (id: string): string => `${base}galeria/capas/${id}.jpg`;

/** Endereço do arquivo de um adesivo empacotado (PNG com transparência). */
export const urlAdesivo = (id: string): string => `${base}galeria/adesivos/${id}.png`;
