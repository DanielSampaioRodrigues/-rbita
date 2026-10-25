// Lista única de atalhos: a mesma fonte alimenta o teclado e a tela de atalhos (F1).

export type AcaoAtalho =
  | "verAtalhos"
  | "irInicio"
  | "irIdeias"
  | "irProjetos"
  | "irAgenda"
  | "irRotinas"
  | "irFoco"
  | "irEnergia"
  | "alternarBaixaEnergia"
  | "capturar"
  | "irAjustes"
  | "alternarBaixoEstimulo"
  | "alternarClaroEscuro"
  | "aumentarLetra"
  | "diminuirLetra"
  | "letraPadrao"
  | "bloquear";

export interface Atalho {
  acao: AcaoAtalho;
  /** Como aparece na tela, tecla por tecla. */
  teclas: string[][];
  descricao: string;
  /** Teclas aceitas (event.key), com ou sem Ctrl/Shift. */
  /** `alt` só conta quando é true; os outros atalhos recusam Alt (para não confundir com AltGr). */
  combinacoes: { ctrl: boolean; shift: boolean; alt?: boolean; teclas: string[] }[];
}

export const ATALHOS: Atalho[] = [
  {
    acao: "verAtalhos",
    teclas: [["F1"], ["Ctrl", "/"]],
    descricao: "Ver todos os atalhos",
    combinacoes: [
      { ctrl: false, shift: false, teclas: ["F1"] },
      { ctrl: true, shift: false, teclas: ["/", ";"] },
    ],
  },
  {
    acao: "irInicio",
    teclas: [["Ctrl", "1"]],
    descricao: "Ir para o Início",
    combinacoes: [{ ctrl: true, shift: false, teclas: ["1"] }],
  },
  {
    acao: "capturar",
    teclas: [["Ctrl", "Alt", "Espaço"]],
    descricao: "Capturar uma ideia (funciona mesmo com o Órbita minimizado)",
    combinacoes: [{ ctrl: true, shift: false, alt: true, teclas: [" "] }],
  },
  {
    acao: "irIdeias",
    teclas: [["Ctrl", "2"]],
    descricao: "Ir para Ideias",
    combinacoes: [{ ctrl: true, shift: false, teclas: ["2"] }],
  },
  {
    acao: "irProjetos",
    teclas: [["Ctrl", "3"]],
    descricao: "Ir para Projetos",
    combinacoes: [{ ctrl: true, shift: false, teclas: ["3"] }],
  },
  {
    acao: "irAgenda",
    teclas: [["Ctrl", "4"]],
    descricao: "Ir para a Agenda",
    combinacoes: [{ ctrl: true, shift: false, teclas: ["4"] }],
  },
  {
    acao: "irRotinas",
    teclas: [["Ctrl", "5"]],
    descricao: "Ir para Rotinas",
    combinacoes: [{ ctrl: true, shift: false, teclas: ["5"] }],
  },
  {
    acao: "irFoco",
    teclas: [["Ctrl", "6"]],
    descricao: "Ir para Foco",
    combinacoes: [{ ctrl: true, shift: false, teclas: ["6"] }],
  },
  {
    acao: "irEnergia",
    teclas: [["Ctrl", "7"]],
    descricao: "Ir para Energia",
    combinacoes: [{ ctrl: true, shift: false, teclas: ["7"] }],
  },
  {
    acao: "alternarBaixaEnergia",
    teclas: [["Ctrl", "Shift", "E"]],
    descricao: "Ligar ou desligar o modo baixa energia",
    combinacoes: [{ ctrl: true, shift: true, teclas: ["e", "E"] }],
  },
  {
    acao: "irAjustes",
    teclas: [["Ctrl", ","]],
    descricao: "Abrir os Ajustes",
    combinacoes: [{ ctrl: true, shift: false, teclas: [","] }],
  },
  {
    acao: "alternarBaixoEstimulo",
    teclas: [["Ctrl", "Shift", "B"]],
    descricao: "Ligar ou desligar o baixo estímulo",
    combinacoes: [{ ctrl: true, shift: true, teclas: ["b", "B"] }],
  },
  {
    acao: "alternarClaroEscuro",
    teclas: [["Ctrl", "Shift", "L"]],
    descricao: "Trocar entre modo claro e escuro",
    combinacoes: [{ ctrl: true, shift: true, teclas: ["l", "L"] }],
  },
  {
    acao: "aumentarLetra",
    teclas: [["Ctrl", "+"]],
    descricao: "Aumentar o tamanho da letra",
    combinacoes: [{ ctrl: true, shift: false, teclas: ["=", "+"] }, { ctrl: true, shift: true, teclas: ["+"] }],
  },
  {
    acao: "diminuirLetra",
    teclas: [["Ctrl", "-"]],
    descricao: "Diminuir o tamanho da letra",
    combinacoes: [{ ctrl: true, shift: false, teclas: ["-", "_"] }],
  },
  {
    acao: "letraPadrao",
    teclas: [["Ctrl", "0"]],
    descricao: "Voltar a letra ao tamanho padrão",
    combinacoes: [{ ctrl: true, shift: false, teclas: ["0"] }],
  },
  {
    acao: "bloquear",
    teclas: [["Ctrl", "Shift", "Q"]],
    descricao: "Bloquear o Órbita",
    combinacoes: [{ ctrl: true, shift: true, teclas: ["q", "Q"] }],
  },
];

/** Ações que só fazem sentido com o Órbita aberto. */
export const SO_ABERTO: AcaoAtalho[] = ["irInicio", "irIdeias", "irProjetos", "irAgenda", "irRotinas", "irFoco", "irEnergia", "irAjustes", "bloquear", "capturar", "alternarBaixaEnergia"];

/** Atalhos que não dependem do app, listados só para consulta. */
export const ATALHOS_GERAIS: { teclas: string[][]; descricao: string }[] = [
  { teclas: [["Tab"], ["Shift", "Tab"]], descricao: "Andar entre botões e campos" },
  { teclas: [["Setas"]], descricao: "Escolher entre opções de um grupo" },
  { teclas: [["Espaço"], ["Enter"]], descricao: "Ativar o botão ou a opção em foco" },
  { teclas: [["Esc"]], descricao: "Fechar a janela aberta" },
];

export function acaoDoEvento(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">): AcaoAtalho | null {
  const ctrl = e.ctrlKey || e.metaKey;
  for (const atalho of ATALHOS) {
    for (const c of atalho.combinacoes) {
      if (c.ctrl === ctrl && c.shift === e.shiftKey && !!c.alt === e.altKey && c.teclas.includes(e.key)) return atalho.acao;
    }
  }
  return null;
}
