// Gatilhos sensoriais e agrupamento dos registros de saúde. Funções puras.
//
// Os gatilhos ficam guardados na própria nota do registro, numa primeira linha
// "Gatilhos: barulho, luz". Assim não precisa mudar o banco, a nota continua
// legível em qualquer exportação e os gatilhos que a pessoa cria reaparecem
// sozinhos nas próximas vezes (são lidos dos registros anteriores).

import type { RegistroSaude } from "../api";

const PREFIXO = "Gatilhos:";

const normal = (s: string) => s.trim().replace(/\s+/g, " ");
const chave = (s: string) => normal(s).toLocaleLowerCase("pt-BR");

/** Junta os gatilhos escolhidos e a nota num texto só, para gravar. */
export function juntarNota(gatilhos: string[], nota: string): string {
  const limpos = semRepetidos(gatilhos.map(normal).filter(Boolean));
  const texto = nota.trim();
  if (limpos.length === 0) return texto;
  const linha = `${PREFIXO} ${limpos.join(", ")}`;
  return texto ? `${linha}\n${texto}` : linha;
}

/** Separa a linha de gatilhos (se houver) do resto da nota. */
export function separarNota(nota: string): { gatilhos: string[]; texto: string } {
  const [primeira, ...resto] = nota.split("\n");
  if (!primeira || !primeira.trimStart().startsWith(PREFIXO)) return { gatilhos: [], texto: nota.trim() };
  const gatilhos = semRepetidos(
    primeira.trimStart().slice(PREFIXO.length).split(",").map(normal).filter(Boolean),
  );
  return { gatilhos, texto: resto.join("\n").trim() };
}

function semRepetidos(lista: string[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const g of lista) {
    const k = chave(g);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(g);
  }
  return out;
}

/** Quantas vezes cada gatilho apareceu, do mais frequente ao menos (empate: ordem alfabética). */
export function contarGatilhos(registros: RegistroSaude[]): { gatilho: string; vezes: number }[] {
  const mapa = new Map<string, { gatilho: string; vezes: number }>();
  for (const r of registros) {
    for (const g of separarNota(r.nota).gatilhos) {
      const k = chave(g);
      const atual = mapa.get(k) ?? { gatilho: g, vezes: 0 };
      atual.vezes++;
      mapa.set(k, atual);
    }
  }
  return [...mapa.values()].sort((a, b) => b.vezes - a.vezes || a.gatilho.localeCompare(b.gatilho, "pt-BR"));
}

/** Os gatilhos para oferecer: os padrões primeiro, depois os que a pessoa já criou (mais usados antes). */
export function gatilhosConhecidos(registros: RegistroSaude[], padrao: readonly string[]): string[] {
  const proprios = contarGatilhos(registros).map((c) => c.gatilho);
  return semRepetidos([...padrao, ...proprios]);
}

/** Registros agrupados por dia ("AAAA-MM-DD", horário local), do dia mais novo ao mais antigo. */
export function agruparPorDia(registros: RegistroSaude[]): { dia: string; registros: RegistroSaude[] }[] {
  const mapa = new Map<string, RegistroSaude[]>();
  for (const r of [...registros].sort((a, b) => b.momento - a.momento)) {
    const d = new Date(r.momento);
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const lista = mapa.get(dia) ?? [];
    lista.push(r);
    mapa.set(dia, lista);
  }
  return [...mapa.entries()].map(([dia, rs]) => ({ dia, registros: rs }));
}
