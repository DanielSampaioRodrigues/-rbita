// Contas da próxima consulta. Funções puras (o "hoje" entra de fora).

/** Dias de `hoje` até `alvo` (ambos "AAAA-MM-DD"). Negativo = já passou. null = sem data válida. */
export function diasAte(hoje: string, alvo: string): number | null {
  const a = paraDia(hoje);
  const b = paraDia(alvo);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86_400_000);
}

function paraDia(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  // Meio-dia UTC: a diferença não sofre com fuso nem horário de verão.
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

export interface ComConsulta {
  proximaConsulta: string;
  nome: string;
}

/** Ordena: consultas de hoje em diante primeiro (a mais perto antes), depois as sem data, por último as que já passaram. */
export function ordenarPorConsulta<T extends ComConsulta>(lista: T[], hoje: string): T[] {
  const grupo = (p: T) => {
    const d = diasAte(hoje, p.proximaConsulta);
    return d === null ? 1 : d >= 0 ? 0 : 2;
  };
  return [...lista].sort((a, b) => {
    const ga = grupo(a);
    const gb = grupo(b);
    if (ga !== gb) return ga - gb;
    if (ga === 0) return a.proximaConsulta.localeCompare(b.proximaConsulta);
    if (ga === 2) return b.proximaConsulta.localeCompare(a.proximaConsulta);
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}
