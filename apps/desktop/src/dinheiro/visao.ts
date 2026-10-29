// Agregação dos gastos por mês e por grupo, e a geometria da pizza. Tudo puro
// (sem DOM, sem relógio além do que entra por parâmetro), para dar para testar.

import type { Conta, Entrada, Gasto, Grupo } from "../api";

/** "AAAA-MM" do momento (ms), no horário local. */
export function chaveMes(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Os últimos `n` meses até `ate` (inclusive), como "AAAA-MM", do mais antigo ao mais novo. */
export function mesesRecentes(ate: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ate.getFullYear(), ate.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** Lista de meses "YYYY-MM" de `inicio` a `fim` (inclusive); limitada a `max` meses. */
export function mesesEntre(inicio: string, fim: string, max = 24): string[] {
  let [a, b] = inicio <= fim ? [inicio, fim] : [fim, inicio];
  const out: string[] = [];
  const mais = (m: string) => {
    const [y, mm] = m.split("-").map(Number);
    const d = new Date(y, mm, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  while (a <= b && out.length < max) { out.push(a); a = mais(a); }
  return out;
}

const SEM_GRUPO = { id: "", nome: "Sem grupo", cor: "cinza" };

export interface LinhaTabela {
  id: string;
  nome: string;
  cor: string;
  /** Total em centavos por mês ("AAAA-MM" → centavos). */
  porMes: Record<string, number>;
  total: number;
}

export interface Tabela {
  linhas: LinhaTabela[];
  totaisMes: Record<string, number>;
  total: number;
}

/**
 * Monta a tabela: uma linha por grupo (mais "Sem grupo" quando houver), com o
 * total de cada mês da lista `meses`. Entram os gastos esporádicos desses meses
 * e também as contas fixas (cada conta soma o seu valor em todo mês a partir do
 * mês em que foi criada), para a pessoa ver o fixo e o variável juntos.
 */
export function tabelaPorMes(gastos: Gasto[], contas: Conta[], grupos: Grupo[], meses: string[]): Tabela {
  const porId = new Map(grupos.map((g) => [g.id, g]));
  const linhas = new Map<string, LinhaTabela>();
  const totaisMes: Record<string, number> = Object.fromEntries(meses.map((m) => [m, 0]));
  let total = 0;

  const linhaDe = (id: string): LinhaTabela => {
    if (!linhas.has(id)) {
      const g = porId.get(id);
      const base = g ? { id: g.id, nome: g.nome, cor: g.cor } : SEM_GRUPO;
      linhas.set(id, { ...base, porMes: Object.fromEntries(meses.map((m) => [m, 0])), total: 0 });
    }
    return linhas.get(id)!;
  };

  const somar = (grupoId: string, mes: string, centavos: number) => {
    if (!(mes in totaisMes) || centavos <= 0) return;
    const id = porId.has(grupoId) ? grupoId : "";
    const linha = linhaDe(id);
    linha.porMes[mes] += centavos;
    linha.total += centavos;
    totaisMes[mes] += centavos;
    total += centavos;
  };

  for (const gasto of gastos) {
    somar(gasto.grupoId, chaveMes(gasto.momento), gasto.centavos);
  }

  // Contas fixas: repetem todo mês, a partir do mês em que foram criadas.
  for (const conta of contas) {
    const desde = chaveMes(conta.criadoEm);
    for (const mes of meses) {
      if (mes >= desde) somar(conta.grupoId, mes, conta.centavos);
    }
  }

  // Grupos com mais gasto primeiro; "Sem grupo" por último.
  const ordenadas = [...linhas.values()].sort((a, b) => (a.id === "" ? 1 : b.id === "" ? -1 : b.total - a.total));
  return { linhas: ordenadas, totaisMes, total };
}

/**
 * Filtra gastos e contas para a visão, por grupo e por "interesse especial".
 * - `grupoId` "todos" deixa passar tudo; "" (string vazia) filtra o "sem grupo";
 *   qualquer outro valor filtra por aquele grupo.
 * - `soInteresse` deixa passar só os gastos marcados como interesse especial e
 *   descarta as contas fixas (que não têm essa marca).
 */
export function filtrar(
  gastos: Gasto[],
  contas: Conta[],
  { grupoId, soInteresse }: { grupoId: string; soInteresse: boolean },
): { gastos: Gasto[]; contas: Conta[] } {
  const casaGrupo = (id: string) => grupoId === "todos" || id === grupoId;
  const g = gastos.filter((x) => casaGrupo(x.grupoId) && (!soInteresse || x.interesse));
  const c = soInteresse ? [] : contas.filter((x) => casaGrupo(x.grupoId));
  return { gastos: g, contas: c };
}

export interface Ponto {
  mes: string;
  centavos: number;
  /** Coordenadas no viewBox 0..100 (x) × 0..100 (y, topo = 0). */
  x: number;
  y: number;
}

/**
 * Pontos de um gráfico de linha do total por mês, num viewBox 0..100 × 0..100.
 * O y é invertido (valor maior fica mais em cima). Com um mês só, o ponto fica
 * no meio; sem valor nenhum, todos ficam na base.
 */
export function pontosLinha(meses: string[], totaisMes: Record<string, number>): Ponto[] {
  const valores = meses.map((m) => totaisMes[m] ?? 0);
  const max = Math.max(0, ...valores);
  const n = meses.length;
  return meses.map((mes, i) => {
    const centavos = valores[i];
    const x = n <= 1 ? 50 : (i / (n - 1)) * 100;
    const y = max === 0 ? 100 : 100 - (centavos / max) * 100;
    return { mes, centavos, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  });
}

export interface Fatia {
  label: string;
  cor: string;
  centavos: number;
  porcentagem: number;
  /** Caminho SVG da fatia, num círculo de centro (60,60) e raio 50. */
  d: string;
}

/**
 * Fatias da pizza a partir de itens com valor. Sem valor nenhum, lista vazia.
 * Um único item vira o círculo inteiro.
 */
export function fatiasPizza(itens: { label: string; cor: string; centavos: number }[]): Fatia[] {
  const validos = itens.filter((i) => i.centavos > 0);
  const total = validos.reduce((s, i) => s + i.centavos, 0);
  if (total === 0) return [];
  const cx = 60;
  const cy = 60;
  const r = 50;
  let angulo = -Math.PI / 2; // começa no topo
  return validos.map((i) => {
    const fracao = i.centavos / total;
    const fim = angulo + fracao * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angulo);
    const y1 = cy + r * Math.sin(angulo);
    const x2 = cx + r * Math.cos(fim);
    const y2 = cy + r * Math.sin(fim);
    const grande = fim - angulo > Math.PI ? 1 : 0;
    const d =
      fracao >= 0.9999
        ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
        : `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${grande} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
    angulo = fim;
    return { label: i.label, cor: i.cor, centavos: i.centavos, porcentagem: Math.round(fracao * 100), d };
  });
}

/** "AAAA-MM-DD" do momento (ms), no horário local. */
export function chaveDia(ms: number): string {
  const d = new Date(ms);
  return `${chaveMes(ms)}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "AAAA-MM-DD" (de um campo de data) → ms ao meio-dia local, longe da virada do dia. `null` se inválido. */
export function diaParaMomento(dia: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d.getTime();
}

/** O mês anterior (`passo` -1) ou seguinte (+1) de "AAAA-MM". */
export function mesVizinho(mes: string, passo: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + passo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** As contas fixas que contam num mês: as criadas até aquele mês. */
export function contasDoMes(contas: Conta[], mes: string): Conta[] {
  return contas.filter((c) => chaveMes(c.criadoEm) <= mes);
}

export interface ResumoMes {
  /** Quanto entrou. */
  entrou: number;
  /** Gastos registrados no mês. */
  gastos: number;
  /** Contas fixas que contam no mês. */
  contas: number;
  /** gastos + contas. */
  saiu: number;
  /** entrou − saiu (pode ser negativo: faltou). */
  sobra: number;
}

/** Entrou, saiu e sobra de um mês ("AAAA-MM"). As contas fixas entram no "saiu", como na tabela. */
export function resumoDoMes(gastos: Gasto[], contas: Conta[], entradas: Entrada[], mes: string): ResumoMes {
  const soma = (xs: { centavos: number }[]) => xs.reduce((s, x) => s + Math.max(0, x.centavos), 0);
  const entrou = soma(entradas.filter((e) => chaveMes(e.momento) === mes));
  const g = soma(gastos.filter((x) => chaveMes(x.momento) === mes));
  const c = soma(contasDoMes(contas, mes));
  return { entrou, gastos: g, contas: c, saiu: g + c, sobra: entrou - g - c };
}

/** Total que entrou em cada mês da lista. */
export function entradasPorMes(entradas: Entrada[], meses: string[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(meses.map((m) => [m, 0]));
  for (const e of entradas) {
    const m = chaveMes(e.momento);
    if (m in out && e.centavos > 0) out[m] += e.centavos;
  }
  return out;
}

export interface DiaDeGastos {
  /** "AAAA-MM-DD". */
  dia: string;
  total: number;
  gastos: Gasto[];
}

/** Gastos de um mês agrupados por dia, do dia mais recente ao mais antigo. */
export function gastosPorDia(gastos: Gasto[], mes: string): DiaDeGastos[] {
  const dias = new Map<string, DiaDeGastos>();
  for (const g of gastos) {
    if (chaveMes(g.momento) !== mes) continue;
    const k = chaveDia(g.momento);
    if (!dias.has(k)) dias.set(k, { dia: k, total: 0, gastos: [] });
    const d = dias.get(k)!;
    d.gastos.push(g);
    d.total += g.centavos;
  }
  const lista = [...dias.values()].sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : 0));
  for (const d of lista) d.gastos.sort((a, b) => b.momento - a.momento);
  return lista;
}
