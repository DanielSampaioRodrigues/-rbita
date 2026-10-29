// "Levar para a terapia": um texto em Markdown simples com as últimas semanas
// de energia. Só é montado quando a pessoa pede; nada sai do aparelho sozinho.
// Ver docs/pesquisa-energia.md (proposta 8).
import { chaveDia, inicioDoDia, somarDias } from "../agenda/datas";
import type { RegistroEnergia } from "../api";
import { textos } from "../textos/pt-BR";
import { CAMUFLAGENS, type DadosEnergia } from "./contasDados";
import { semanaEmSaldo } from "./semanaDados";

const t = textos.energia.terapia;
const tc = textos.energia.camuflagem;
const ts = textos.energia.semana;

export const SEMANAS_TERAPIA = [2, 3, 4] as const;

/** "seg, 26/10" — sem depender do Intl, para o texto sair igual em qualquer lugar. */
function rotuloDia(dia: string): string {
  const d = new Date(`${dia}T00:00`);
  return `${ts.dias[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dataCurta(dia: string): string {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

/** Conta quantas vezes cada chave aparece e devolve na ordem: mais vezes primeiro. */
function contarVezes(chaves: string[]): [string, number][] {
  const mapa = new Map<string, number>();
  for (const c of chaves) mapa.set(c, (mapa.get(c) ?? 0) + 1);
  return [...mapa].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * Monta o texto das últimas `semanas` semanas, terminando em `hoje` (incluso).
 * `registros` são os níveis de energia do período (podem vir mais; o que estiver fora é ignorado).
 */
export function textoParaTerapia(d: DadosEnergia, registros: RegistroEnergia[], hoje: Date, semanas: number): string {
  const totalDias = semanas * 7;
  const dias = semanaEmSaldo(d, hoje, totalDias);
  const de = dias[0].dia;
  const ate = dias[dias.length - 1].dia;
  const inicio = inicioDoDia(new Date(`${de}T00:00`)).getTime();
  const fim = somarDias(inicioDoDia(hoje), 1).getTime();
  const noPeriodo = (m: number) => m >= inicio && m < fim;

  const niveisPorDia = new Map<string, number[]>();
  for (const r of registros) {
    if (!noPeriodo(r.momento)) continue;
    const dia = chaveDia(new Date(r.momento));
    niveisPorDia.set(dia, [...(niveisPorDia.get(dia) ?? []), r.nivel]);
  }

  const linhas: string[] = [t.cabecalho, "", t.periodo(dataCurta(de), dataCurta(ate), semanas), t.origem, ""];

  // Saldo de cada dia
  linhas.push(t.saldoTitulo, "", t.saldoAjuda, "");
  let comRegistro = 0;
  let negativos = 0;
  let maiorSequencia = 0;
  let sequencia = 0;
  let linhasDeDia = 0;
  for (const dia of dias) {
    const niveis = niveisPorDia.get(dia.dia);
    const partes: string[] = [];
    if (dia.balanco !== "vazio") {
      partes.push(`${ts.balanco[dia.balanco]} (${t.detalhe(dia.saldo.gastou, dia.saldo.repos)})`);
      comRegistro++;
    }
    if (dia.balanco === "gastou-mais") {
      negativos++;
      sequencia++;
      maiorSequencia = Math.max(maiorSequencia, sequencia);
    } else sequencia = 0;
    if (niveis?.length) {
      const media = Math.round(niveis.reduce((s, n) => s + n, 0) / niveis.length);
      partes.push(t.energiaMedia(textos.energia.niveis[media - 1]));
    }
    if (dia.camuflagem) partes.push(t.camuflagem(tc.opcoes[dia.camuflagem]));
    if (partes.length) {
      linhas.push(t.linhaDia(rotuloDia(dia.dia), partes.join(" · ")));
      linhasDeDia++;
    }
  }
  if (linhasDeDia === 0) linhas.push(t.saldoNada);
  linhas.push("");

  if (comRegistro > 0) {
    linhas.push(t.resumoTitulo, "", t.negativos(negativos, comRegistro));
    if (maiorSequencia >= 2) linhas.push(t.maiorSequencia(maiorSequencia));
    linhas.push("");
  }

  // Sinais sentidos
  linhas.push(t.sinaisTitulo, "");
  const nomeSinal = new Map(d.sinais.map((s) => [s.id, s.texto]));
  const sinais = contarVezes(d.sentidos.filter((s) => noPeriodo(s.momento)).map((s) => nomeSinal.get(s.sinalId) ?? t.removido));
  if (sinais.length) for (const [texto, n] of sinais) linhas.push(t.sinal(texto, n));
  else linhas.push(t.sinaisNada);
  linhas.push("");

  // Camuflagem
  linhas.push(t.camuflagemTitulo, "");
  const respostas = dias.map((x) => x.camuflagem).filter((c) => c != null);
  if (respostas.length) {
    for (const c of [...CAMUFLAGENS].reverse()) {
      const n = respostas.filter((r) => r === c).length;
      if (n) linhas.push(t.camuflagemLinha(tc.opcoes[c], n));
    }
  } else linhas.push(t.camuflagemNada);
  linhas.push("");

  // Kit usado
  linhas.push(t.kitTitulo, "");
  const nomeKit = new Map(d.kit.map((k) => [k.id, k.nome]));
  const usos = contarVezes(d.usosKit.filter((u) => noPeriodo(u.momento)).map((u) => nomeKit.get(u.itemId) ?? t.removido));
  if (usos.length) for (const [nome, n] of usos) linhas.push(t.kitLinha(nome, n));
  else linhas.push(t.kitNada);

  return linhas.join("\n") + "\n";
}
