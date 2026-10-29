// Nível de estudo e o que o módulo mostra em cada um. Funções puras e testáveis.
// A pessoa escolhe o nível uma vez; o módulo esconde o que não faz sentido
// (bimestre na faculdade, créditos na escola) sem apagar nada.

export type Nivel = "fundamental" | "medio" | "graduacao" | "pos";
/** "todos" = a pessoa preferiu não escolher: o módulo mostra tudo. */
export type NivelOuTodos = Nivel | "todos";

export const NIVEIS: Nivel[] = ["fundamental", "medio", "graduacao", "pos"];

export interface PerfilNivel {
  /** Como o ano se divide. `null` = não mostra período. */
  periodo: "bimestre" | "semestre" | null;
  /** Mostra notas e média de aprovação. */
  notas: boolean;
  /** Mostra créditos/carga da disciplina. */
  creditos: boolean;
  /** Mostra a aba do projeto de pesquisa (orientação, prazos, leituras). */
  pesquisa: boolean;
  /** Vocabulário: escola fala "matéria"; faculdade e pós, "disciplina". */
  vocabulario: "materia" | "disciplina";
}

export function perfilDoNivel(nivel: NivelOuTodos): PerfilNivel {
  switch (nivel) {
    case "fundamental":
    case "medio":
      return { periodo: "bimestre", notas: true, creditos: false, pesquisa: false, vocabulario: "materia" };
    case "graduacao":
      return { periodo: "semestre", notas: true, creditos: true, pesquisa: false, vocabulario: "disciplina" };
    case "pos":
      return { periodo: "semestre", notas: false, creditos: true, pesquisa: true, vocabulario: "disciplina" };
    default:
      return { periodo: "bimestre", notas: true, creditos: true, pesquisa: true, vocabulario: "materia" };
  }
}

export function ehNivel(v: unknown): v is NivelOuTodos {
  return v === "todos" || NIVEIS.includes(v as Nivel);
}

/** Tipos de atividade que a tela oferece. */
export type TipoAtividade = "prova" | "trabalho" | "dever" | "leitura" | "entrega";
export const TIPOS_ATIVIDADE: TipoAtividade[] = ["prova", "trabalho", "dever", "leitura", "entrega"];

/**
 * A parte nativa só conhece prova, trabalho e dever. Leitura é guardada como
 * dever (sem nota) e entrega como trabalho (pode ter nota); o tipo de verdade
 * fica nos extras do módulo.
 */
export function tipoNativo(tipo: TipoAtividade): "prova" | "trabalho" | "dever" {
  if (tipo === "leitura") return "dever";
  if (tipo === "entrega") return "trabalho";
  return tipo;
}

/** Tipo mostrado: o dos extras quando combina com o nativo; senão, o nativo. */
export function tipoMostrado(nativo: string, extra: TipoAtividade | undefined): TipoAtividade {
  if (extra && tipoNativo(extra) === nativo) return extra;
  return (TIPOS_ATIVIDADE.includes(nativo as TipoAtividade) ? nativo : "dever") as TipoAtividade;
}

/** Só prova, trabalho e entrega entram na média. */
export function aceitaNota(tipo: TipoAtividade): boolean {
  return tipo === "prova" || tipo === "trabalho" || tipo === "entrega";
}

// ---------- Datas ----------

const MS_DIA = 86_400_000;
const diaUTC = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, (m || 1) - 1, d || 1);
};

/** Dias de `hoje` até `data` (ambos "AAAA-MM-DD"). Negativo = já passou. */
export function diasAte(hoje: string, data: string): number {
  return Math.round((diaUTC(data) - diaUTC(hoje)) / MS_DIA);
}

/**
 * Bimestre escolar mais provável para a data (calendário brasileiro comum):
 * fev–abr = 1º, mai–jul = 2º, ago–set = 3º, out–dez = 4º. Janeiro conta como 4º
 * (recuperação/férias do ano anterior). A pessoa pode trocar no formulário.
 */
export function bimestreDaData(iso: string): 1 | 2 | 3 | 4 {
  const mes = Number(iso.slice(5, 7));
  if (mes >= 2 && mes <= 4) return 1;
  if (mes >= 5 && mes <= 7) return 2;
  if (mes >= 8 && mes <= 9) return 3;
  return 4;
}

/** Dia da semana (0 = domingo) de uma data "AAAA-MM-DD". */
export function diaDaSemana(iso: string): number {
  return new Date(diaUTC(iso)).getUTCDay();
}

/** Ordem da grade: segunda primeiro, domingo no fim. */
export const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];
