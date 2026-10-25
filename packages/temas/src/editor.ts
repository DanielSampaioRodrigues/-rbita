// Peças do editor de tema: conferir o contraste de todos os pares, ajustar uma
// cor até passar, e ler/gravar o arquivo de tema (.orbita-tema).
import { contraste, lerHex, MINIMO } from "./contraste";
import { limparSvg } from "./svg";
import type { Fundo, Paleta, Tema } from "./tipos";

export const CHAVES_PALETA: (keyof Paleta)[] = [
  "fundo", "superficie", "superficieAlternativa", "texto", "textoSuave", "borda",
  "bordaControle", "destaque", "textoSobreDestaque", "foco", "atencao",
];

export interface Par {
  /** Cor que precisa se destacar (é a que o ajuste automático muda). */
  frente: keyof Paleta;
  fundo: keyof Paleta;
  minimo: number;
}

/** Todos os pares de cor que aparecem na interface, com o contraste exigido. */
export const PARES: Par[] = [
  ...(["fundo", "superficie", "superficieAlternativa"] as const).flatMap((fundo): Par[] => [
    { frente: "texto", fundo, minimo: 7 },
    { frente: "textoSuave", fundo, minimo: MINIMO.texto },
    { frente: "destaque", fundo, minimo: MINIMO.texto },
    { frente: "atencao", fundo, minimo: MINIMO.texto },
    { frente: "bordaControle", fundo, minimo: MINIMO.controle },
    { frente: "foco", fundo, minimo: MINIMO.controle },
  ]),
  { frente: "textoSobreDestaque", fundo: "destaque", minimo: MINIMO.texto },
];

export interface ResultadoPar extends Par {
  valor: number;
  passa: boolean;
}

export function conferirPaleta(p: Paleta): ResultadoPar[] {
  return PARES.map((par) => {
    const valor = contraste(p[par.frente], p[par.fundo]);
    return { ...par, valor, passa: valor >= par.minimo };
  });
}

const paraHex = (rgb: number[]) => "#" + rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("");

/**
 * Escurece ou clareia `cor` (o que estiver mais perto) até ter `minimo` de
 * contraste com todas as cores de `contra`. Mantém o tom o máximo possível.
 */
export function ajustarCor(cor: string, contra: string[], minimo: number): string {
  const passa = (c: string) => contra.every((f) => contraste(c, f) >= minimo);
  if (passa(cor)) return cor;
  const base = lerHex(cor);
  for (let passo = 1; passo <= 100; passo++) {
    const t = passo / 100;
    const escura = paraHex(base.map((c) => c * (1 - t)));
    const clara = paraHex(base.map((c) => c + (255 - c) * t));
    if (passa(escura)) return escura;
    if (passa(clara)) return clara;
  }
  return contra.every((f) => contraste("#000000", f) >= contraste("#ffffff", f)) ? "#000000" : "#ffffff";
}

/** Corrige a paleta inteira mexendo só nas cores de frente (texto, destaque...). */
export function ajustarPaleta(p: Paleta): Paleta {
  const nova = { ...p };
  for (const frente of new Set(PARES.map((x) => x.frente))) {
    const pares = PARES.filter((x) => x.frente === frente);
    const minimo = Math.max(...pares.map((x) => x.minimo));
    nova[frente] = ajustarCor(nova[frente], pares.map((x) => nova[x.fundo]), minimo);
  }
  return nova;
}

// ---------- Arquivo de tema ----------

export const FORMATO_TEMA = "orbita-tema";

export class TemaInvalido extends Error {}

const ehHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

function lerPaleta(bruto: unknown, nome: string): Paleta {
  if (typeof bruto !== "object" || bruto === null) throw new TemaInvalido(`Falta a paleta ${nome}.`);
  const r = bruto as Record<string, unknown>;
  const p = {} as Paleta;
  for (const k of CHAVES_PALETA) {
    if (!ehHex(r[k])) throw new TemaInvalido(`A cor "${k}" do modo ${nome} não é uma cor válida (#rrggbb).`);
    p[k] = (r[k] as string).toLowerCase();
  }
  return p;
}

function lerFundo(bruto: unknown): Fundo | undefined {
  if (typeof bruto !== "object" || bruto === null) return undefined;
  const f = bruto as Record<string, unknown>;
  if (f.tipo === "cor") return { tipo: "cor" };
  if ((f.tipo === "gradiente" || f.tipo === "padrao") && typeof f.nome === "string") return { tipo: f.tipo, nome: f.nome };
  // SVG de arquivo de outra pessoa: limpa de novo, sempre.
  if (f.tipo === "svg" && typeof f.conteudo === "string")
    return { tipo: "svg", conteudo: limparSvg(f.conteudo), repetir: f.repetir !== false, animar: false };
  return undefined; // Fotos não viajam no arquivo de tema.
}

/** Lê um arquivo de tema de outra pessoa. Recusa o que estiver errado e corrige o contraste, se precisar. */
export function lerArquivoTema(texto: string): { tema: Tema; ajustado: boolean } {
  let bruto: Record<string, unknown>;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new TemaInvalido("Este arquivo não é um tema do Órbita.");
  }
  if (bruto?.formato !== FORMATO_TEMA) throw new TemaInvalido("Este arquivo não é um tema do Órbita.");
  const nome = typeof bruto.nome === "string" && bruto.nome.trim() ? bruto.nome.trim().slice(0, 40) : "Tema importado";
  const claro = lerPaleta(bruto.claro, "claro");
  const escuro = lerPaleta(bruto.escuro, "escuro");
  const claroOk = ajustarPaleta(claro);
  const escuroOk = ajustarPaleta(escuro);
  const ajustado = JSON.stringify([claro, escuro]) !== JSON.stringify([claroOk, escuroOk]);
  const cantos = typeof bruto.cantos === "number" ? Math.max(0, Math.min(2, bruto.cantos)) : 1;
  const ic = (typeof bruto.icones === "object" && bruto.icones !== null ? bruto.icones : {}) as Record<string, unknown>;
  const icones = {
    traco: typeof ic.traco === "number" ? Math.max(1, Math.min(3, ic.traco)) : 2,
    pontas: ic.pontas === "retas" ? ("retas" as const) : ("redondas" as const),
  };
  return {
    ajustado,
    tema: {
      id: `proprio-${Date.now().toString(36)}`,
      nome,
      cantos,
      icones,
      sombra: bruto.sombra !== false,
      claro: claroOk,
      escuro: escuroOk,
      baixoEstimulo: {
        claro: { destaque: ajustarCor("#575c63", [claroOk.fundo, claroOk.superficie, claroOk.superficieAlternativa], 4.5) },
        escuro: { destaque: ajustarCor("#b3b6bb", [escuroOk.fundo, escuroOk.superficie, escuroOk.superficieAlternativa], 4.5), textoSobreDestaque: escuroOk.fundo },
      },
      fundoPadrao: lerFundo(bruto.fundo),
    },
  };
}

export function gravarArquivoTema(tema: Tema): string {
  return JSON.stringify(
    { formato: FORMATO_TEMA, versao: 1, nome: tema.nome, cantos: tema.cantos ?? 1, icones: tema.icones, sombra: tema.sombra !== false, claro: tema.claro, escuro: tema.escuro, fundo: tema.fundoPadrao },
    null,
    2,
  );
}

/**
 * Lê o tema que uma IA escreveu (JSON, às vezes com texto em volta). Passa
 * pelas mesmas conferências de um arquivo de outra pessoa: cores válidas,
 * contraste corrigido se precisar e SVG limpo.
 */
export function temaDaIa(resposta: string): { tema: Tema; ajustado: boolean } {
  const i = resposta.indexOf("{");
  const j = resposta.lastIndexOf("}");
  if (i < 0 || j <= i) throw new TemaInvalido("A IA não mandou um tema. Tente de novo, talvez descrevendo de outro jeito.");
  let bruto: Record<string, unknown>;
  try {
    bruto = JSON.parse(resposta.slice(i, j + 1));
  } catch {
    throw new TemaInvalido("A IA mandou um tema com erro de formato. Tente de novo.");
  }
  const svg = typeof bruto.fundoSvg === "string" && bruto.fundoSvg.includes("<svg") ? bruto.fundoSvg : null;
  try {
    return lerArquivoTema(
      JSON.stringify({ ...bruto, formato: FORMATO_TEMA, fundo: svg ? { tipo: "svg", conteudo: svg, repetir: true } : bruto.fundo }),
    );
  } catch {
    throw new TemaInvalido("A IA mandou um tema incompleto (faltou alguma cor). Tente de novo.");
  }
}
