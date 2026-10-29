// Extras do módulo de Estudos: o nível escolhido, créditos/semestre da disciplina,
// o tipo de verdade e o bimestre da atividade, e o projeto de pesquisa da pós.
// Enquanto a parte nativa não guarda esses campos, ficam neste computador
// (localStorage), como já acontece com a personalização das rotinas.
// Tudo é lido com cuidado: dado estranho vira o valor padrão, sem quebrar a tela.

import { useCallback, useState } from "react";
import { ehNivel, TIPOS_ATIVIDADE, type NivelOuTodos, type TipoAtividade } from "./nivel";

export interface ExtrasMateria {
  /** Créditos ou carga horária (graduação e pós). */
  creditos?: number | null;
  /** Semestre/período livre: "2026.2", "3º período". */
  periodo?: string;
}

export interface ExtrasAtividade {
  tipo?: TipoAtividade;
  /** 1 a 4 (escola). */
  bimestre?: number | null;
}

export interface PrazoPesquisa {
  id: string;
  nome: string;
  /** "AAAA-MM-DD"; vazio = sem data ainda. */
  data: string;
  feito: boolean;
}

export type StatusLeitura = "aLer" | "lendo" | "lida";

export interface LeituraPesquisa {
  id: string;
  titulo: string;
  /** Autor, ano, onde achar. */
  referencia: string;
  status: StatusLeitura;
}

export interface ReuniaoOrientacao {
  id: string;
  data: string;
  pauta: string;
  combinado: string;
}

export interface Pesquisa {
  titulo: string;
  orientador: string;
  coorientador: string;
  programa: string;
  prazos: PrazoPesquisa[];
  leituras: LeituraPesquisa[];
  reunioes: ReuniaoOrientacao[];
}

export interface ExtrasAcademico {
  /** `undefined` = ainda não escolheu (mostra a tela de escolha). */
  nivel?: NivelOuTodos;
  materias: Record<string, ExtrasMateria>;
  atividades: Record<string, ExtrasAtividade>;
  pesquisa: Pesquisa;
}

export const CHAVE_EXTRAS = "orbita.academico.extras";

export const pesquisaVazia = (): Pesquisa => ({ titulo: "", orientador: "", coorientador: "", programa: "", prazos: [], leituras: [], reunioes: [] });
export const extrasVazios = (): ExtrasAcademico => ({ materias: {}, atividades: {}, pesquisa: pesquisaVazia() });

const texto = (v: unknown) => (typeof v === "string" ? v : "");
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const lista = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(objeto) : []);
const numeroOuNulo = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Confere e limpa o que veio do armazenamento. */
export function normalizarExtras(bruto: unknown): ExtrasAcademico {
  const o = objeto(bruto);
  const saida = extrasVazios();
  if (ehNivel(o.nivel)) saida.nivel = o.nivel;
  for (const [id, v] of Object.entries(objeto(o.materias))) {
    const m = objeto(v);
    saida.materias[id] = { creditos: numeroOuNulo(m.creditos), periodo: texto(m.periodo) };
  }
  for (const [id, v] of Object.entries(objeto(o.atividades))) {
    const a = objeto(v);
    const b = numeroOuNulo(a.bimestre);
    saida.atividades[id] = {
      tipo: TIPOS_ATIVIDADE.includes(a.tipo as TipoAtividade) ? (a.tipo as TipoAtividade) : undefined,
      bimestre: b != null && b >= 1 && b <= 4 ? Math.round(b) : null,
    };
  }
  const p = objeto(o.pesquisa);
  saida.pesquisa = {
    titulo: texto(p.titulo),
    orientador: texto(p.orientador),
    coorientador: texto(p.coorientador),
    programa: texto(p.programa),
    prazos: lista(p.prazos).filter((x) => texto(x.id)).map((x) => ({ id: texto(x.id), nome: texto(x.nome), data: texto(x.data), feito: x.feito === true })),
    leituras: lista(p.leituras).filter((x) => texto(x.id)).map((x) => ({
      id: texto(x.id),
      titulo: texto(x.titulo),
      referencia: texto(x.referencia),
      status: x.status === "lendo" || x.status === "lida" ? x.status : "aLer",
    })),
    reunioes: lista(p.reunioes).filter((x) => texto(x.id)).map((x) => ({ id: texto(x.id), data: texto(x.data), pauta: texto(x.pauta), combinado: texto(x.combinado) })),
  };
  return saida;
}

export function lerExtras(armazenamento?: Storage): ExtrasAcademico {
  try {
    const arm = armazenamento ?? localStorage;
    const t = arm.getItem(CHAVE_EXTRAS);
    return t ? normalizarExtras(JSON.parse(t)) : extrasVazios();
  } catch {
    return extrasVazios();
  }
}

export function gravarExtras(extras: ExtrasAcademico, armazenamento?: Storage): void {
  try {
    (armazenamento ?? localStorage).setItem(CHAVE_EXTRAS, JSON.stringify(extras));
  } catch {
    // Sem armazenamento: a tela segue funcionando, só não lembra.
  }
}

export const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Estado dos extras ligado ao armazenamento. `mudar` recebe o valor atual e devolve o novo. */
export function useExtras(): [ExtrasAcademico, (f: (atual: ExtrasAcademico) => ExtrasAcademico) => void] {
  const [extras, setExtras] = useState<ExtrasAcademico>(() => lerExtras());
  const mudar = useCallback((f: (atual: ExtrasAcademico) => ExtrasAcademico) => {
    // Lê de novo antes de mudar: outra janela/formulário pode ter gravado.
    const novo = f(lerExtras());
    gravarExtras(novo);
    setExtras(novo);
  }, []);
  return [extras, mudar];
}
