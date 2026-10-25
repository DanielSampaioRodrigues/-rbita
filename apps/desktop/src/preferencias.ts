import { gravarArquivoTema, lerArquivoTema, TEMAS, type Fundo, type Tema } from "@orbita/temas";

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
  /** Modo baixa energia: o app mostra só o essencial. */
  baixaEnergia: boolean;
  /** Bloquear sozinho depois de tantos minutos sem uso (0 = nunca). */
  bloqueioAuto: number;
  /** Ao abrir, consultar se há versão nova (só avisa; nada é baixado sem a pessoa mandar). */
  procurarAtualizacao: boolean;
  /** Id de um tema pronto. */
  tema: string;
  /** null = o fundo sugerido pelo tema. */
  fundo: Fundo | null;
  /** Temas criados no editor ou importados. */
  temasProprios: Tema[];
  /** Tela inicial montável: ordem dos blocos, escondidos e largos. */
  inicio: { ordem: string[]; ocultos: string[]; largos: string[] };
}

export const BLOCOS_INICIO = ["capturar", "energia", "hoje", "continuar", "ideias", "novidades"] as const;

export const PADRAO: Preferencias = {
  fonte: "atkinson",
  tamanho: 2,
  densidade: "confortavel",
  espacoLetras: "normal",
  espacoLinhas: "normal",
  modoCor: "sistema",
  baixoEstimulo: false,
  avisos: { ligado: true, minutos: 10, notificacao: true },
  baixaEnergia: false,
  bloqueioAuto: 0,
  procurarAtualizacao: true,
  tema: "papel",
  fundo: null,
  temasProprios: [],
  inicio: { ordem: [...BLOCOS_INICIO], ocultos: [], largos: ["energia", "hoje", "continuar", "novidades"] },
};

export const ANTECEDENCIAS = [5, 10, 15, 30] as const;
/** Opções de bloqueio automático, em minutos (0 = nunca). */
export const BLOQUEIOS = [0, 5, 15, 30, 60] as const;

const CHAVE = "orbita.preferencias.v1";

const dentro = <T extends string>(valor: unknown, opcoes: Record<T, unknown> | readonly T[]): valor is T =>
  typeof valor === "string" && (Array.isArray(opcoes) ? opcoes.includes(valor as T) : valor in opcoes);

/** Aceita só valores conhecidos; o que vier estranho volta ao padrão. */
export function validar(bruto: unknown): Preferencias {
  const p = (typeof bruto === "object" && bruto !== null ? bruto : {}) as Record<string, unknown>;
  const temasProprios = validarTemasProprios(p.temasProprios);
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
    baixaEnergia: typeof p.baixaEnergia === "boolean" ? p.baixaEnergia : PADRAO.baixaEnergia,
    procurarAtualizacao: typeof p.procurarAtualizacao === "boolean" ? p.procurarAtualizacao : PADRAO.procurarAtualizacao,
    bloqueioAuto: BLOQUEIOS.includes(p.bloqueioAuto as (typeof BLOQUEIOS)[number]) ? (p.bloqueioAuto as number) : PADRAO.bloqueioAuto,
    temasProprios,
    tema: [...TEMAS, ...temasProprios].some((t) => t.id === p.tema) ? (p.tema as string) : PADRAO.tema,
    fundo: validarFundo(p.fundo),
    inicio: validarInicio(p.inicio),
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

/** Confere a forma do fundo salvo; qualquer coisa estranha volta ao fundo do tema. */
function validarFundo(bruto: unknown): Fundo | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const f = bruto as Record<string, unknown>;
  const num = (v: unknown, padrao: number) => (typeof v === "number" && Number.isFinite(v) ? v : padrao);
  switch (f.tipo) {
    case "cor":
      return { tipo: "cor" };
    case "gradiente":
    case "padrao":
      return typeof f.nome === "string" ? { tipo: f.tipo, nome: f.nome } : null;
    case "imagem":
      return typeof f.dados === "string" && f.dados.startsWith("data:image/")
        ? { tipo: "imagem", dados: f.dados, desfoque: num(f.desfoque, 0), escurecimento: num(f.escurecimento, 0) }
        : null;
    case "svg":
      // O conteúdo já foi limpo ao importar; só confere o tipo.
      return typeof f.conteudo === "string" && f.conteudo.startsWith("<svg")
        ? { tipo: "svg", conteudo: f.conteudo, repetir: f.repetir !== false, animar: f.animar === true }
        : null;
    default:
      return null;
  }
}

/** Temas próprios passam pela mesma conferência de um arquivo importado (cores, contraste, SVG). */
function validarTemasProprios(bruto: unknown): Tema[] {
  if (!Array.isArray(bruto)) return [];
  const temas: Tema[] = [];
  for (const t of bruto.slice(0, 30)) {
    try {
      const lido = lerArquivoTema(gravarArquivoTema(t as Tema)).tema;
      if (typeof (t as Tema).id === "string" && (t as Tema).id.startsWith("proprio-")) temas.push({ ...lido, id: (t as Tema).id });
    } catch {
      // Tema estragado fica de fora.
    }
  }
  return temas;
}

function validarInicio(bruto: unknown): Preferencias["inicio"] {
  const b = (typeof bruto === "object" && bruto !== null ? bruto : {}) as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => (BLOCOS_INICIO as readonly string[]).includes(x as string)) : []);
  const ordem = [...new Set(lista(b.ordem))];
  // Blocos novos (de versões futuras) entram no fim.
  for (const bloco of BLOCOS_INICIO) if (!ordem.includes(bloco)) ordem.push(bloco);
  return { ordem, ocultos: lista(b.ocultos), largos: Array.isArray(b.largos) ? lista(b.largos) : [...PADRAO.inicio.largos] };
}

/** Tema em uso: um pronto ou um próprio. */
export function temaDasPreferencias(p: Preferencias): Tema {
  return p.temasProprios.find((t) => t.id === p.tema) ?? TEMAS.find((t) => t.id === p.tema) ?? TEMAS[0];
}
