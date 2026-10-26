// Agregação dos registros de saúde ao longo do tempo, para o painel holístico.
// Tudo puro (sem DOM, sem relógio além do que entra por parâmetro), para testar.

import type { RegistroSaude } from "../api";
import { TIPOS_SAUDE_POSITIVOS } from "../api";

const DIA = 86_400_000;

/** Tipos difíceis e bons, na ordem de exibição. */
export const TIPOS_DIFICEIS = ["sono", "sintoma", "sobrecarga"] as const;
export const TIPOS_BONS = ["coisa_boa", "potencialidade", "regulacao"] as const;

/** Cor de cada tipo (paleta de etiquetas). Nada de vermelho: é percepção, não alarme. */
export const COR_TIPO: Record<string, string> = {
  sono: "ceu",
  sintoma: "terra",
  sobrecarga: "areia",
  coisa_boa: "musgo",
  potencialidade: "lavanda",
  regulacao: "mar",
};

const ehPositivo = (tipo: string) => (TIPOS_SAUDE_POSITIVOS as string[]).includes(tipo);

export interface Janela {
  inicio: number;
  fim: number;
}

/**
 * As janelas de tempo do período: `n` dias até o fim de hoje. Até 31 dias, uma
 * janela por dia; acima disso, por semana. Da mais antiga à mais nova.
 */
export function janelas(ate: Date, n: number): Janela[] {
  const porJanela = n <= 31 ? 1 : 7;
  const qtd = Math.ceil(n / porJanela);
  const fimHoje = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate() + 1).getTime();
  const out: Janela[] = [];
  for (let i = qtd - 1; i >= 0; i--) {
    const fim = fimHoje - i * porJanela * DIA;
    out.push({ inicio: fim - porJanela * DIA, fim });
  }
  return out;
}

export interface BarraEquilibrio {
  inicio: number;
  fim: number;
  bons: number;
  dificeis: number;
}

/** Quantos registros bons e difíceis caíram em cada janela. */
export function equilibrio(registros: RegistroSaude[], js: Janela[]): BarraEquilibrio[] {
  return js.map((j) => {
    let bons = 0;
    let dificeis = 0;
    for (const r of registros) {
      if (r.momento >= j.inicio && r.momento < j.fim) {
        if (ehPositivo(r.tipo)) bons++;
        else dificeis++;
      }
    }
    return { inicio: j.inicio, fim: j.fim, bons, dificeis };
  });
}

export interface ResumoTipo {
  tipo: string;
  total: number;
  /** Média da intensidade (1 a 5) dos que têm intensidade; null se nenhum tiver. */
  media: number | null;
}

/** Total e média de intensidade por tipo, no período (do mais frequente ao menos). */
export function resumoPorTipo(registros: RegistroSaude[], de: number, ate: number): ResumoTipo[] {
  const mapa = new Map<string, { total: number; soma: number; comIntensidade: number }>();
  for (const r of registros) {
    if (r.momento < de || r.momento >= ate) continue;
    const m = mapa.get(r.tipo) ?? { total: 0, soma: 0, comIntensidade: 0 };
    m.total++;
    if (r.intensidade != null) {
      m.soma += r.intensidade;
      m.comIntensidade++;
    }
    mapa.set(r.tipo, m);
  }
  return [...mapa.entries()]
    .map(([tipo, m]) => ({ tipo, total: m.total, media: m.comIntensidade ? m.soma / m.comIntensidade : null }))
    .sort((a, b) => b.total - a.total);
}
