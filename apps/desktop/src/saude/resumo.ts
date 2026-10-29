// Monta o "resumo para a consulta" em Markdown, a partir dos remédios e dos
// registros de saúde. Função pura (sem rede, sem relógio): o momento de corte
// e o formatador de data/hora entram de fora, para dar para testar.

import type { Remedio, RegistroSaude } from "../api";
import { contarGatilhos } from "./gatilhos";

const TIPOS = ["sono", "sintoma", "sobrecarga"] as const;
const TIPOS_BONS = ["coisa_boa", "potencialidade", "regulacao"] as const;
type Tipo = (typeof TIPOS)[number] | (typeof TIPOS_BONS)[number];

const NOME_TIPO: Record<Tipo, string> = {
  sono: "Sono",
  sintoma: "Sintoma",
  sobrecarga: "Sobrecarga sensorial",
  coisa_boa: "Coisa boa",
  potencialidade: "Potencialidade",
  regulacao: "Regulação",
};

export interface DadosResumo {
  remedios: Remedio[];
  registros: RegistroSaude[];
  /** Quantos dias o resumo cobre (aparece no cabeçalho). */
  periodoDias: number;
  /** Data do fim do período, "AAAA-MM-DD". */
  ate: string;
  /** Como mostrar o momento de cada registro (injetado para testar). */
  formatarMomento: (ms: number) => string;
  /** Perguntas em aberto para os profissionais (da seção Cuidado). Opcional. */
  perguntas?: { profissional: string; texto: string }[];
}

export function montarResumo({ remedios, registros, periodoDias, ate, formatarMomento, perguntas }: DadosResumo): string {
  const linhas: string[] = [];
  linhas.push("# Resumo para a consulta");
  linhas.push(`Período: últimos ${periodoDias} dias, até ${ate}.`);
  linhas.push("");

  // Remédios em uso (ativos).
  linhas.push("## Remédios em uso");
  const ativos = remedios.filter((r) => r.estado === "ativo");
  if (ativos.length === 0) {
    linhas.push("Nenhum remédio em uso.");
  } else {
    for (const r of ativos) {
      const partes = [r.dose, r.horarios.length ? `às ${r.horarios.join(", ")}` : null].filter(Boolean);
      let linha = `- **${r.nome}**`;
      if (partes.length) linha += ` — ${partes.join(", ")}`;
      if (r.estoque !== null) linha += `. Estoque: ${r.estoque}`;
      if (r.receita) linha += `. Receita até ${r.receita}`;
      linhas.push(`${linha}.`);
    }
  }
  linhas.push("");

  // Como a pessoa vem se sentindo (contagens e médias por tipo).
  linhas.push("## Como venho me sentindo");
  const linhaTipo = (tipo: Tipo) => {
    const doTipo = registros.filter((r) => r.tipo === tipo);
    if (doTipo.length === 0) return;
    const comNivel = doTipo.filter((r) => r.intensidade != null) as (RegistroSaude & { intensidade: number })[];
    const media = comNivel.length ? comNivel.reduce((s, r) => s + r.intensidade, 0) / comNivel.length : null;
    const n = doTipo.length;
    let linha = `- **${NOME_TIPO[tipo]}**: ${n} ${n === 1 ? "registro" : "registros"}`;
    if (media != null) linha += ` (média ${media.toFixed(1).replace(".", ",")} de 5)`;
    linhas.push(`${linha}.`);
  };
  for (const tipo of TIPOS) linhaTipo(tipo);
  if (registros.some((r) => (TIPOS_BONS as readonly string[]).includes(r.tipo))) {
    linhas.push("");
    linhas.push("### O que fez bem");
    for (const tipo of TIPOS_BONS) linhaTipo(tipo);
  }
  if (registros.length === 0) linhas.push("Nenhum registro no período.");
  const gatilhos = contarGatilhos(registros);
  if (gatilhos.length > 0) {
    linhas.push("");
    linhas.push(`Gatilhos de sobrecarga anotados: ${gatilhos.map((g) => (g.vezes > 1 ? `${g.gatilho} (${g.vezes}x)` : g.gatilho)).join(", ")}.`);
  }
  linhas.push("");

  // Lista dos registros, do mais novo ao mais antigo.
  if (registros.length > 0) {
    linhas.push("### Registros");
    const ordenados = [...registros].sort((a, b) => b.momento - a.momento);
    for (const r of ordenados) {
      const nivel = r.intensidade != null ? ` (${r.intensidade}/5)` : "";
      const nota = r.nota ? `: ${r.nota.trim().replace(/\s*\n\s*/g, " · ")}` : "";
      linhas.push(`- ${formatarMomento(r.momento)} — ${NOME_TIPO[r.tipo as Tipo] ?? r.tipo}${nivel}${nota}`);
    }
    linhas.push("");
  }

  // Perguntas em aberto, da seção Cuidado.
  linhas.push("## Perguntas para a consulta");
  if (!perguntas || perguntas.length === 0) {
    linhas.push("Nenhuma pergunta anotada.");
  } else {
    for (const p of perguntas) linhas.push(`- ${p.texto}${p.profissional ? ` (${p.profissional})` : ""}`);
  }

  return linhas.join("\n").trim() + "\n";
}
