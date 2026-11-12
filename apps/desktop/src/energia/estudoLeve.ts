// Modo baixa energia: além das tarefas de projetos, "uma tarefa, se der" pode ser uma
// atividade leve dos Estudos (dever, leitura, trabalho ou entrega que está chegando).
// Prova fica de fora: marcar "feito" numa prova quer dizer que ela já aconteceu.
import type { Atividade } from "../api";

const LEVES = ["dever", "leitura", "trabalho", "entrega"];

/** As atividades para sugerir: não feitas, sem data ou dentro dos próximos dias, a mais próxima primeiro. */
export function estudosLeves(atividades: Atividade[], hoje: string, dias = 14): Atividade[] {
  const [a, m, d] = hoje.split("-").map(Number);
  const lim = new Date(a, m - 1, d + dias);
  const limite = `${lim.getFullYear()}-${String(lim.getMonth() + 1).padStart(2, "0")}-${String(lim.getDate()).padStart(2, "0")}`;
  return atividades
    .filter((x) => !x.feita && LEVES.includes(x.tipo) && (x.data === "" || (x.data >= hoje && x.data <= limite)))
    .sort((x, y) => (x.data || "9999").localeCompare(y.data || "9999") || x.titulo.localeCompare(y.titulo, "pt-BR"));
}
