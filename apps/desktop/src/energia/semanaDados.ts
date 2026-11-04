// Regras puras da "semana em saldo" e dos "dias pesados à vista".
// Ver docs/pesquisa-energia.md (propostas 4 e 7). O perigo é o acúmulo de dias
// no negativo, não um dia ruim; e dá para se preparar para dias cheios.
import { chaveDia, inicioDoDia, somarDias, type Ocorrencia } from "../agenda/datas";
import { textos } from "../textos/pt-BR";
import { balanco, saldoDoDia, type Balanco, type Camuflagem, type DadosEnergia, type Saldo } from "./contasDados";

export interface DiaEmSaldo {
  /** "AAAA-MM-DD" */
  dia: string;
  saldo: Saldo;
  balanco: Balanco;
  camuflagem: Camuflagem | null;
}

/** Os `n` dias que terminam em `hoje` (hoje incluso), do mais antigo para o mais novo. */
export function semanaEmSaldo(d: DadosEnergia, hoje: Date, n = 7): DiaEmSaldo[] {
  const base = inicioDoDia(hoje);
  return Array.from({ length: n }, (_, i) => {
    const dia = chaveDia(somarDias(base, i - (n - 1)));
    const saldo = saldoDoDia(d.atividades, d.feitos[dia] ?? [], d.camuflagem[dia]);
    return { dia, saldo, balanco: balanco(saldo), camuflagem: d.camuflagem[dia] ?? null };
  });
}

/**
 * Quantos dias seguidos, contando para trás a partir do mais recente, ficaram em
 * "gastou mais". Hoje sem nada marcado não quebra a sequência (o dia ainda não acabou).
 */
export function negativosSeguidos(semana: DiaEmSaldo[]): number {
  let i = semana.length - 1;
  if (i >= 0 && semana[i].balanco === "vazio") i--;
  let n = 0;
  for (; i >= 0 && semana[i].balanco === "gastou-mais"; i--) n++;
  return n;
}

/** A partir de quantos dias seguidos no negativo aparece a frase de descanso. */
export const NEGATIVOS_PARA_AVISO = 3;

/** Dia com tantos compromissos ou mais fica "pesado" sozinho. */
export const PESADO = 3;
/** Dias "cheios" (com tantos ou mais) um atrás do outro também pedem cuidado. */
export const CHEIO = 2;

export type AvisoPesado =
  | { tipo: "dia"; dia: string; quantos: number }
  | { tipo: "seguidos"; dias: { dia: string; quantos: number }[] };

/**
 * Olha os próximos `n` dias (hoje incluso) e devolve avisos neutros:
 * um dia com PESADO+ compromissos, ou dois ou mais dias seguidos com CHEIO+.
 * Blocos fixos da semana-modelo não contam (são a rotina, não compromissos).
 */
export function diasPesados(ocorrencias: Ocorrencia[], hoje: Date, n = 7): AvisoPesado[] {
  const base = inicioDoDia(hoje);
  const dias = Array.from({ length: n }, (_, i) => chaveDia(somarDias(base, i)));
  const contagem = new Map<string, number>();
  for (const o of ocorrencias) {
    if (o.evento.modelo) continue;
    contagem.set(o.dia, (contagem.get(o.dia) ?? 0) + 1);
  }
  const avisos: AvisoPesado[] = [];
  let sequencia: { dia: string; quantos: number }[] = [];
  const fechar = () => {
    if (sequencia.length >= 2) avisos.push({ tipo: "seguidos", dias: sequencia });
    else if (sequencia.length === 1 && sequencia[0].quantos >= PESADO) avisos.push({ tipo: "dia", ...sequencia[0] });
    sequencia = [];
  };
  for (const dia of dias) {
    const quantos = contagem.get(dia) ?? 0;
    if (quantos >= CHEIO) sequencia.push({ dia, quantos });
    else fechar();
  }
  fechar();
  return avisos;
}

const tp = textos.energia.pesados;
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "hoje", "amanhã" ou o nome do dia da semana ("quinta"). Serve para os próximos 7 dias. */
export function nomeDoDia(dia: string, hoje: Date): string {
  const base = inicioDoDia(hoje);
  if (dia === chaveDia(base)) return tp.hoje;
  if (dia === chaveDia(somarDias(base, 1))) return tp.amanha;
  return tp.diasLongos[new Date(`${dia}T00:00`).getDay()];
}

/** Junta com vírgulas e "e": "a, b e c". */
export function juntar(partes: string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} ${tp.e} ${partes[partes.length - 1]}`;
}

/** A frase do aviso, neutra e literal. */
export function fraseAviso(a: AvisoPesado, hoje: Date): string {
  if (a.tipo === "dia") return tp.dia(maiuscula(nomeDoDia(a.dia, hoje)), a.quantos);
  return tp.seguidos(juntar(a.dias.map((d) => `${nomeDoDia(d.dia, hoje)} (${d.quantos})`)));
}
