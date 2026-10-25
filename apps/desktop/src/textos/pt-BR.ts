// Todas as frases da interface ficam aqui, em linguagem simples e literal.
export const textos = {
  boasVindas: {
    titulo: "Órbita",
    subtitulo: "Organizador de vida",
    mensagem: "O programa está instalado e abrindo normalmente.",
    proximo: "Próximo passo: a base visual, com fontes, modo claro e escuro e o botão de baixo estímulo.",
    versao: (versao: string) => `Versão ${versao}`,
  },
} as const;
