// Contas de datas no horário local. O Brasil não tem horário de verão desde 2019,
// mas as contas abaixo não dependem disso: andam por dia do calendário, não por 24 h.
import type { Evento } from "../api";

export interface Ocorrencia {
  evento: Evento;
  inicio: Date;
  fim: Date | null;
  /** Dia da ocorrência, "AAAA-MM-DD". */
  dia: string;
}

export const chaveDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());

/** Semana começando na segunda-feira. */
export function inicioDaSemana(d: Date): Date {
  const dia = inicioDoDia(d);
  return somarDias(dia, -((dia.getDay() + 6) % 7));
}

export const inicioDoMes = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/** Grade do mês: semanas completas (segunda a domingo) que cobrem o mês. */
export function diasDaGradeDoMes(d: Date): Date[] {
  const primeiro = inicioDaSemana(inicioDoMes(d));
  const ultimoDoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const dias: Date[] = [];
  for (let x = primeiro; x <= ultimoDoMes || dias.length % 7 !== 0; x = somarDias(x, 1)) dias.push(x);
  return dias;
}

function repeteNoDia(e: Evento, base: Date, dia: Date): boolean {
  const r = e.repeticao!;
  if (dia < inicioDoDia(base)) return false;
  if (r.ate != null && dia > inicioDoDia(new Date(r.ate))) return false;
  if (e.excecoes.includes(chaveDia(dia))) return false;
  if (r.frequencia === "diaria") return true;
  if (r.frequencia === "semanal") return r.dias.includes(dia.getDay());
  if (r.frequencia === "mensal") return dia.getDate() === base.getDate();
  return false;
}

/** Todas as ocorrências entre `de` (incluso) e `ate` (excluso), em ordem de horário. */
export function expandir(eventos: Evento[], de: Date, ate: Date): Ocorrencia[] {
  const saida: Ocorrencia[] = [];
  for (const e of eventos) {
    const base = new Date(e.inicio);
    const duracao = e.fim != null ? e.fim - e.inicio : null;
    if (!e.repeticao) {
      const fim = e.fim != null ? new Date(e.fim) : null;
      if (base < ate && (fim ?? base) >= de) saida.push({ evento: e, inicio: base, fim, dia: chaveDia(base) });
      continue;
    }
    for (let dia = inicioDoDia(de); dia < ate; dia = somarDias(dia, 1)) {
      if (!repeteNoDia(e, base, dia)) continue;
      const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), base.getHours(), base.getMinutes());
      saida.push({ evento: e, inicio, fim: duracao != null ? new Date(inicio.getTime() + duracao) : null, dia: chaveDia(dia) });
    }
  }
  return saida.sort((a, b) => Number(b.evento.diaInteiro) - Number(a.evento.diaInteiro) || a.inicio.getTime() - b.inicio.getTime());
}

/** Agrupa por dia ("AAAA-MM-DD"). */
export function porDia(ocorrencias: Ocorrencia[]): Map<string, Ocorrencia[]> {
  const mapa = new Map<string, Ocorrencia[]>();
  for (const o of ocorrencias) mapa.set(o.dia, [...(mapa.get(o.dia) ?? []), o]);
  return mapa;
}
