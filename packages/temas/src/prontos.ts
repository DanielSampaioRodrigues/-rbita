import type { Tema } from "./tipos";
import { papel } from "./papel";

const neutroClaro = { destaque: "#575c63", foco: "#3d4249" };

export const cinzaCalmo: Tema = {
  id: "cinza-calmo",
  nome: "Cinza calmo",
  cantos: 1,
  claro: {
    fundo: "#eceef1", superficie: "#f7f8f9", superficieAlternativa: "#e2e5e9", texto: "#1f2328", textoSuave: "#50575f",
    borda: "#d3d8dd", bordaControle: "#757c84", destaque: "#45607a", textoSobreDestaque: "#ffffff", foco: "#2c5d8f", atencao: "#8a4a26",
  },
  escuro: {
    fundo: "#1b1d20", superficie: "#23262a", superficieAlternativa: "#2c3035", texto: "#e6e8eb", textoSuave: "#a7adb4",
    borda: "#353a40", bordaControle: "#7b838c", destaque: "#9fb6cb", textoSobreDestaque: "#15191d", foco: "#8fb8e6", atencao: "#e2a47c",
  },
  baixoEstimulo: { claro: neutroClaro, escuro: { destaque: "#b3b6bb", textoSobreDestaque: "#1b1d20", foco: "#c4c7cc" } },
};

export const minimo: Tema = {
  id: "minimo",
  nome: "Mínimo",
  cantos: 0.45,
  sombra: false,
  claro: {
    fundo: "#ffffff", superficie: "#ffffff", superficieAlternativa: "#f2f2f2", texto: "#111111", textoSuave: "#555555",
    borda: "#e3e3e3", bordaControle: "#767676", destaque: "#1f1f1f", textoSobreDestaque: "#ffffff", foco: "#1a5fb4", atencao: "#8a4a26",
  },
  escuro: {
    fundo: "#0f0f0f", superficie: "#161616", superficieAlternativa: "#222222", texto: "#f2f2f2", textoSuave: "#aaaaaa",
    borda: "#2a2a2a", bordaControle: "#7a7a7a", destaque: "#ededed", textoSobreDestaque: "#111111", foco: "#8fb8e6", atencao: "#e2a47c",
  },
  baixoEstimulo: { claro: neutroClaro, escuro: { destaque: "#b3b3b3", textoSobreDestaque: "#0f0f0f", foco: "#c4c7cc" } },
};

export const biblioteca: Tema = {
  id: "biblioteca",
  nome: "Biblioteca",
  cantos: 0.7,
  claro: {
    fundo: "#eee5d6", superficie: "#f8f2e8", superficieAlternativa: "#e5d9c4", texto: "#2b2118", textoSuave: "#5c4c3d",
    borda: "#d8c9b2", bordaControle: "#80705c", destaque: "#7a3b2e", textoSobreDestaque: "#ffffff", foco: "#2c5d8f", atencao: "#7d4a12",
  },
  escuro: {
    fundo: "#1e1814", superficie: "#28201a", superficieAlternativa: "#332a22", texto: "#efe4d4", textoSuave: "#bba892",
    borda: "#3d3229", bordaControle: "#8a7866", destaque: "#dca47e", textoSobreDestaque: "#1e1814", foco: "#8fb8e6", atencao: "#e2b07c",
  },
  baixoEstimulo: { claro: { destaque: "#5c5650", foco: "#3d4249" }, escuro: { destaque: "#b8b0a6", textoSobreDestaque: "#1e1814", foco: "#c4c7cc" } },
  fundoPadrao: { tipo: "padrao", nome: "papel" },
};

export const espaco: Tema = {
  id: "espaco",
  nome: "Espaço",
  cantos: 1.2,
  claro: {
    fundo: "#eceef6", superficie: "#f7f8fc", superficieAlternativa: "#e1e4f0", texto: "#1b1f33", textoSuave: "#4c536e",
    borda: "#d3d7e6", bordaControle: "#727996", destaque: "#4848ad", textoSobreDestaque: "#ffffff", foco: "#1a5fb4", atencao: "#8a4a26",
  },
  escuro: {
    fundo: "#0e1022", superficie: "#171a30", superficieAlternativa: "#20243d", texto: "#e7e9f7", textoSuave: "#a6abc8",
    borda: "#2c3150", bordaControle: "#7a80a6", destaque: "#aaa7ff", textoSobreDestaque: "#12132a", foco: "#8fb8e6", atencao: "#e2a47c",
  },
  baixoEstimulo: { claro: neutroClaro, escuro: { destaque: "#b4b6c4", textoSobreDestaque: "#0e1022", foco: "#c4c7cc" } },
  fundoPadrao: { tipo: "padrao", nome: "estrelas" },
};

export const floresta: Tema = {
  id: "floresta",
  nome: "Floresta",
  cantos: 1,
  claro: {
    fundo: "#e7eee4", superficie: "#f5f8f3", superficieAlternativa: "#dbe5d6", texto: "#1c261c", textoSuave: "#485846",
    borda: "#cdd9c7", bordaControle: "#6e7e6d", destaque: "#2d673c", textoSobreDestaque: "#ffffff", foco: "#2c5d8f", atencao: "#7d4a12",
  },
  escuro: {
    fundo: "#121a14", superficie: "#1a241c", superficieAlternativa: "#233026", texto: "#e3ece0", textoSuave: "#a3b4a0",
    borda: "#2c3a2f", bordaControle: "#748575", destaque: "#8ccf9b", textoSobreDestaque: "#102014", foco: "#8fb8e6", atencao: "#e2a47c",
  },
  baixoEstimulo: { claro: neutroClaro, escuro: { destaque: "#b3b8b3", textoSobreDestaque: "#121a14", foco: "#c4c7cc" } },
  fundoPadrao: { tipo: "padrao", nome: "folhas" },
};

/** Ordem em que aparecem na tela: primeiro os neutros, depois os temáticos. */
export const TEMAS: Tema[] = [papel, cinzaCalmo, minimo, biblioteca, espaco, floresta];

export const temaPorId = (id: string): Tema => TEMAS.find((t) => t.id === id) ?? papel;
