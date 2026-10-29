// Aparência do quadro de um hobby: fundo (cor, gradiente suave, padrão sutil ou
// imagem da pessoa), grade de alinhamento e o estilo de cada cartão (cor do
// cartão, cor e fonte do texto, miniatura da imagem).
//
// Onde fica guardada: junto do desenho do quadro (o cartão "desenho", que já
// existe e guarda um JSON). Assim não precisa mudar o banco nem a parte nativa:
// o campo `aparencia` é opcional e quadros antigos continuam abrindo iguais.
import type React from "react";
import { cenaVazia, lerCena, type Cena } from "@orbita/caderno";
import { contraste } from "@orbita/temas";
import { CORES_ORG, eCorOrg, estiloCor, classeCor, PALETA_ORG, type CorOrg } from "../organizacao/cores";
import { FONTES } from "../preferencias";

export type TipoFundo = "tema" | "cor" | "gradiente" | "imagem";
export type PadraoFundo = "nenhum" | "pontos" | "linhas" | "quadriculado";

export const TIPOS_FUNDO: TipoFundo[] = ["tema", "cor", "gradiente", "imagem"];
export const PADROES_FUNDO: PadraoFundo[] = ["nenhum", "pontos", "linhas", "quadriculado"];

export interface FundoQuadro {
  tipo: TipoFundo;
  /** Cor da paleta usada no tipo "cor". */
  cor: string;
  /** Id do gradiente usado no tipo "gradiente". */
  gradiente: string;
  /** Id do anexo (já reduzido) usado no tipo "imagem". Fica guardado ao trocar de tipo. */
  imagem: string;
  /** Padrão sutil desenhado por cima do fundo (anda junto com os cartões). */
  padrao: PadraoFundo;
}

export interface EstiloCartao {
  /** Cor do cartão (nome da paleta). Ausente = cor do tema. */
  cor?: string;
  /** Cor do texto (id de TINTAS). Ausente = do tema. */
  tinta?: string;
  /** Fonte do texto (chave de FONTES). Ausente = a do app. */
  fonte?: string;
  /** Imagem: id do anexo com a miniatura (pode ser o próprio original, se já for pequeno). */
  mini?: string;
}

export interface AparenciaQuadro {
  fundo: FundoQuadro;
  /** Grade de alinhamento: os cartões encaixam de 8 em 8 px. */
  grade: boolean;
  /** Estilo por cartão, pelo id do cartão. */
  cartoes: Record<string, EstiloCartao>;
}

export const PASSO_GRADE = 8;
export const LIMITE_FUNDO_MB = 8;
export const LIMITE_FUNDO_BYTES = LIMITE_FUNDO_MB * 1024 * 1024;

export function aparenciaPadrao(): AparenciaQuadro {
  return { fundo: { tipo: "tema", cor: "mar", gradiente: "aurora", imagem: "", padrao: "nenhum" }, grade: false, cartoes: {} };
}

/** Gradientes suaves feitos com duas cores da paleta (versões clara e escura). */
export const GRADIENTES_QUADRO: { id: string; de: CorOrg; para: CorOrg }[] = [
  { id: "aurora", de: "mar", para: "lavanda" },
  { id: "entardecer", de: "pessego", para: "rosa" },
  { id: "campo", de: "musgo", para: "areia" },
  { id: "brisa", de: "ceu", para: "menta" },
  { id: "nevoa", de: "cinza", para: "ceu" },
];

/** Cores de texto: uma versão para o modo claro e outra para o escuro, as duas legíveis. */
export const TINTAS: { id: string; claro: string; escuro: string }[] = [
  { id: "grafite", claro: "#2b2f36", escuro: "#e6e8eb" },
  { id: "azul", claro: "#1e4fa8", escuro: "#a9c7f7" },
  { id: "verde", claro: "#1f6b3a", escuro: "#a6dbb5" },
  { id: "vinho", claro: "#8a1f3d", escuro: "#f2b0c3" },
  { id: "roxo", claro: "#5b2a9e", escuro: "#d2bdf6" },
  { id: "marrom", claro: "#6b4423", escuro: "#e6c7a6" },
];

/** Superfícies de referência dos temas (para checar o contraste da tinta sem cor de cartão). */
const SUPERFICIE = { claro: "#ffffff", escuro: "#202226" };
const MINIMO = 4.5;

const texto = (v: unknown, padrao = "") => (typeof v === "string" ? v : padrao);

/** Lê o JSON guardado no cartão "desenho": a cena e, se houver, a aparência. Nunca quebra. */
export function lerQuadro(guardado: string): { cena: Cena; aparencia: AparenciaQuadro } {
  const cena = lerCena(guardado);
  const bruto = (cena as Cena & { aparencia?: unknown }).aparencia;
  const aparencia = aparenciaPadrao();
  if (bruto && typeof bruto === "object") {
    const b = bruto as Partial<AparenciaQuadro>;
    const f = (b.fundo ?? {}) as Partial<FundoQuadro>;
    aparencia.fundo = {
      tipo: TIPOS_FUNDO.includes(f.tipo as TipoFundo) ? (f.tipo as TipoFundo) : "tema",
      cor: eCorOrg(texto(f.cor)) ? texto(f.cor) : aparencia.fundo.cor,
      gradiente: GRADIENTES_QUADRO.some((g) => g.id === f.gradiente) ? texto(f.gradiente) : aparencia.fundo.gradiente,
      imagem: texto(f.imagem),
      padrao: PADROES_FUNDO.includes(f.padrao as PadraoFundo) ? (f.padrao as PadraoFundo) : "nenhum",
    };
    aparencia.grade = b.grade === true;
    if (b.cartoes && typeof b.cartoes === "object") {
      for (const [id, e] of Object.entries(b.cartoes)) {
        if (!e || typeof e !== "object") continue;
        const limpo: EstiloCartao = {};
        if (texto(e.cor)) limpo.cor = e.cor;
        if (texto(e.tinta)) limpo.tinta = e.tinta;
        if (texto(e.fonte)) limpo.fonte = e.fonte;
        if (texto(e.mini)) limpo.mini = e.mini;
        aparencia.cartoes[id] = limpo;
      }
    }
  }
  return { cena: { elementos: Array.isArray(cena.elementos) ? cena.elementos : cenaVazia().elementos }, aparencia };
}

/** O JSON do cartão "desenho": cena + aparência (só quando foge do padrão). */
export function serializarQuadro(cena: Cena, aparencia: AparenciaQuadro): string {
  const padrao = aparencia.fundo.tipo === "tema" && aparencia.fundo.padrao === "nenhum" && !aparencia.fundo.imagem && !aparencia.grade && Object.keys(aparencia.cartoes).length === 0;
  return JSON.stringify(padrao ? { elementos: cena.elementos } : { elementos: cena.elementos, aparencia });
}

/** Encaixa na grade (quando ligada); nunca deixa sair para coordenada negativa. */
export function encaixar(v: number, grade: boolean): number {
  const n = Math.max(0, v);
  return grade ? Math.round(n / PASSO_GRADE) * PASSO_GRADE : Math.round(n);
}

/** Variáveis CSS do fundo do quadro (o CSS escolhe a versão clara ou escura). */
export function estiloFundo(fundo: FundoQuadro, urlImagem: string | null): React.CSSProperties {
  const vars: Record<string, string> = {};
  if (fundo.tipo === "cor" && eCorOrg(fundo.cor)) {
    vars["--hobby-fundo-c"] = PALETA_ORG[fundo.cor].claro;
    vars["--hobby-fundo-e"] = PALETA_ORG[fundo.cor].escuro;
  } else if (fundo.tipo === "gradiente") {
    const g = GRADIENTES_QUADRO.find((x) => x.id === fundo.gradiente);
    if (g) {
      vars["--hobby-fundo-c"] = `linear-gradient(160deg, ${PALETA_ORG[g.de].claro}, ${PALETA_ORG[g.para].claro})`;
      vars["--hobby-fundo-e"] = `linear-gradient(160deg, ${PALETA_ORG[g.de].escuro}, ${PALETA_ORG[g.para].escuro})`;
    }
  } else if (fundo.tipo === "imagem" && urlImagem) {
    vars["--hobby-fundo-c"] = `center / cover no-repeat url("${urlImagem}")`;
    vars["--hobby-fundo-e"] = vars["--hobby-fundo-c"];
  }
  return vars as React.CSSProperties;
}

/** Amostra (para os botões de escolha) de um gradiente, na versão clara. */
export function amostraGradiente(id: string): string {
  const g = GRADIENTES_QUADRO.find((x) => x.id === id);
  return g ? `linear-gradient(160deg, ${PALETA_ORG[g.de].claro}, ${PALETA_ORG[g.para].claro})` : "transparent";
}

/** A tinta só vale se passar no contraste mínimo nos dois modos; senão, fica a cor automática. */
export function tintaLegivel(tinta: string | undefined, cor: string | undefined): { claro: string; escuro: string } | null {
  const t = TINTAS.find((x) => x.id === tinta);
  if (!t) return null;
  const fundoC = cor && eCorOrg(cor) ? PALETA_ORG[cor].claro : SUPERFICIE.claro;
  const fundoE = cor && eCorOrg(cor) ? PALETA_ORG[cor].escuro : SUPERFICIE.escuro;
  return contraste(t.claro, fundoC) >= MINIMO && contraste(t.escuro, fundoE) >= MINIMO ? { claro: t.claro, escuro: t.escuro } : null;
}

/** Classe e estilo de um cartão a partir do seu estilo guardado. */
export function visualDoCartao(e: EstiloCartao | undefined): { classe: string; estilo: React.CSSProperties } {
  if (!e) return { classe: "", estilo: {} };
  const estilo: Record<string, string> = { ...(e.cor ? (estiloCor(e.cor) as Record<string, string>) : {}) };
  let classe = e.cor ? classeCor(e.cor) : "";
  const tinta = tintaLegivel(e.tinta, e.cor);
  if (tinta) {
    estilo["--hobby-tinta-c"] = tinta.claro;
    estilo["--hobby-tinta-e"] = tinta.escuro;
    classe += " hobby-com-tinta";
  }
  const fonte = e.fonte && e.fonte in FONTES ? FONTES[e.fonte as keyof typeof FONTES] : null;
  if (fonte) estilo.fontFamily = fonte.css;
  return { classe, estilo: estilo as React.CSSProperties };
}

export const CORES_CARTAO = CORES_ORG;
export const FONTES_CARTAO = Object.entries(FONTES).map(([id, f]) => ({ id, nome: f.nome, css: f.css }));
