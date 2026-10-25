// Preferências visuais. Ficam fora do cofre criptografado de propósito:
// a tela de senha precisa abrir já com a fonte e o contraste da pessoa.

export const FONTES = {
  atkinson: { nome: "Atkinson Hyperlegible", css: '"Atkinson Hyperlegible Next Variable", "Segoe UI", sans-serif' },
  lexend: { nome: "Lexend", css: '"Lexend Variable", "Segoe UI", sans-serif' },
  opendyslexic: { nome: "OpenDyslexic", css: '"OpenDyslexic", "Segoe UI", sans-serif' },
} as const;

/** Tamanho da letra base, em pixels, para cada um dos 5 níveis. */
export const TAMANHOS = [15, 16.5, 18, 20, 22.5] as const;

export const DENSIDADES = { espacosa: 1.25, confortavel: 1, compacta: 0.8 } as const;

export const ESPACO_LETRAS = { normal: "0em", maior: "0.03em", muitoMaior: "0.07em" } as const;

export const ESPACO_LINHAS = { normal: 1.5, maior: 1.7, muitoMaior: 1.9 } as const;

export type Fonte = keyof typeof FONTES;
export type Densidade = keyof typeof DENSIDADES;
export type EspacoLetras = keyof typeof ESPACO_LETRAS;
export type EspacoLinhas = keyof typeof ESPACO_LINHAS;
export type ModoCor = "sistema" | "claro" | "escuro";

export interface Preferencias {
  fonte: Fonte;
  /** Índice em TAMANHOS, de 0 a 4. */
  tamanho: number;
  densidade: Densidade;
  espacoLetras: EspacoLetras;
  espacoLinhas: EspacoLinhas;
  modoCor: ModoCor;
  baixoEstimulo: boolean;
  avisos: { ligado: boolean; minutos: number; notificacao: boolean };
}

export const PADRAO: Preferencias = {
  fonte: "atkinson",
  tamanho: 2,
  densidade: "confortavel",
  espacoLetras: "normal",
  espacoLinhas: "normal",
  modoCor: "sistema",
  baixoEstimulo: false,
  avisos: { ligado: true, minutos: 10, notificacao: true },
};

export const ANTECEDENCIAS = [5, 10, 15, 30] as const;

const CHAVE = "orbita.preferencias.v1";

const dentro = <T extends string>(valor: unknown, opcoes: Record<T, unknown> | readonly T[]): valor is T =>
  typeof valor === "string" && (Array.isArray(opcoes) ? opcoes.includes(valor as T) : valor in opcoes);

/** Aceita só valores conhecidos; o que vier estranho volta ao padrão. */
export function validar(bruto: unknown): Preferencias {
  const p = (typeof bruto === "object" && bruto !== null ? bruto : {}) as Record<string, unknown>;
  const tamanho = Number.isInteger(p.tamanho) && (p.tamanho as number) >= 0 && (p.tamanho as number) < TAMANHOS.length;
  return {
    fonte: dentro(p.fonte, FONTES) ? p.fonte : PADRAO.fonte,
    tamanho: tamanho ? (p.tamanho as number) : PADRAO.tamanho,
    densidade: dentro(p.densidade, DENSIDADES) ? p.densidade : PADRAO.densidade,
    espacoLetras: dentro(p.espacoLetras, ESPACO_LETRAS) ? p.espacoLetras : PADRAO.espacoLetras,
    espacoLinhas: dentro(p.espacoLinhas, ESPACO_LINHAS) ? p.espacoLinhas : PADRAO.espacoLinhas,
    modoCor: dentro(p.modoCor, ["sistema", "claro", "escuro"] as const) ? p.modoCor : PADRAO.modoCor,
    baixoEstimulo: typeof p.baixoEstimulo === "boolean" ? p.baixoEstimulo : PADRAO.baixoEstimulo,
    avisos: validarAvisos(p.avisos),
  };
}

export function carregar(armazenamento: Storage = localStorage): Preferencias {
  try {
    const texto = armazenamento.getItem(CHAVE);
    return texto ? validar(JSON.parse(texto)) : PADRAO;
  } catch {
    return PADRAO;
  }
}

export function salvar(prefs: Preferencias, armazenamento: Storage = localStorage): void {
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(prefs));
  } catch {
    // Sem espaço ou sem acesso: o app segue funcionando com o que está na tela.
  }
}

function validarAvisos(bruto: unknown): Preferencias["avisos"] {
  const a = (typeof bruto === "object" && bruto !== null ? bruto : {}) as Record<string, unknown>;
  return {
    ligado: typeof a.ligado === "boolean" ? a.ligado : PADRAO.avisos.ligado,
    minutos: ANTECEDENCIAS.includes(a.minutos as never) ? (a.minutos as number) : PADRAO.avisos.minutos,
    notificacao: typeof a.notificacao === "boolean" ? a.notificacao : PADRAO.avisos.notificacao,
  };
}
