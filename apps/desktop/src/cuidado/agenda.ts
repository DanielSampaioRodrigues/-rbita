// A consulta marcada no Cuidado pode virar um compromisso de dia inteiro na
// Agenda. O compromisso leva uma marca nas notas ("[cuidado:<id>]") para que
// mudar ou tirar a data aqui atualize o mesmo compromisso lá, sem duplicar.
import { api, type Evento, type Profissional } from "../api";
import { textos } from "../textos/pt-BR";

const marcaDe = (profId: string) => `[cuidado:${profId}]`;
const UM_DIA = 24 * 60 * 60 * 1000;
const DOIS_ANOS = 730 * UM_DIA;

/** O momento local do início do dia "AAAA-MM-DD". */
export const inicioDoDiaIso = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

/** Compromissos da Agenda que pertencem a este profissional (procura 2 anos para trás e para a frente). */
export async function eventosDaConsulta(profId: string): Promise<Evento[]> {
  const agora = Date.now();
  const lista = await api.listarEventos(agora - DOIS_ANOS, agora + DOIS_ANOS);
  const marca = marcaDe(profId);
  return lista.filter((e) => !e.modelo && e.notas.includes(marca));
}

/**
 * Deixa a Agenda igual à consulta: apaga o compromisso antigo deste profissional
 * e, se houver data, cria um novo de dia inteiro. Erros aqui não impedem guardar
 * a consulta no Cuidado: quem chama decide o que fazer.
 */
export async function sincronizarConsultaNaAgenda(prof: Profissional, naAgenda: boolean): Promise<void> {
  const antigos = await eventosDaConsulta(prof.id);
  await Promise.all(antigos.map((e) => api.excluirEvento(e.id)));
  if (!naAgenda || !prof.proximaConsulta) return;
  const t = textos.cuidado.consulta;
  const inicio = inicioDoDiaIso(prof.proximaConsulta);
  await api.salvarEvento({
    id: "",
    titulo: t.tituloAgenda(prof.nome, prof.especialidade),
    inicio,
    fim: inicio + UM_DIA,
    diaInteiro: true,
    repeticao: null,
    modelo: false,
    notas: `${t.notaAgenda} ${marcaDe(prof.id)}`,
    excecoes: [],
  });
}
