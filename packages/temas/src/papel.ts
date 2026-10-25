import type { Tema } from "./tipos";

/** Tema neutro padrão: creme quente, texto grafite e destaque verde-sálvia. */
export const papel: Tema = {
  id: "papel",
  nome: "Papel",
  claro: {
    fundo: "#f4f1ea",
    superficie: "#fbfaf6",
    superficieAlternativa: "#ece8df",
    texto: "#22252a",
    textoSuave: "#545a62",
    borda: "#dfdad0",
    bordaControle: "#7a7e85",
    destaque: "#3f6b5c",
    textoSobreDestaque: "#ffffff",
    foco: "#2c5d8f",
    atencao: "#8a4a26",
  },
  escuro: {
    fundo: "#191b1f",
    superficie: "#212429",
    superficieAlternativa: "#2b2f35",
    texto: "#e9e6df",
    textoSuave: "#a8acb3",
    borda: "#33373e",
    bordaControle: "#7c828b",
    destaque: "#8fbcaa",
    textoSobreDestaque: "#13201b",
    foco: "#8fb8e6",
    atencao: "#e2a47c",
  },
  baixoEstimulo: {
    claro: { destaque: "#575c63", foco: "#3d4249" },
    escuro: { destaque: "#b3b6bb", textoSobreDestaque: "#191b1f", foco: "#c4c7cc" },
  },
};
