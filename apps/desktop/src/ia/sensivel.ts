/**
 * Sinais de que um texto fala de saúde ou terapia. Serve só para avisar antes
 * de enviar a um provedor de fora do computador (princípio da especificação).
 * Não é um diagnóstico do texto: na dúvida, avisa.
 */
const SINAIS = [
  "saude", "medic", "remedio", "receita medica", "consulta", "terapia", "terapeut", "psiquiatr", "psicolog", "psicoterap",
  "neurolog", "diagnost", "laudo", "exame", "hospital", "clinica", "pronto-socorro", "plano de saude", "sintoma",
  "ansiedade", "depress", "crise", "panico", "insonia", "dose", "mg ", "comprimido", "cid ", "autis", "tdah", "bipolar",
  "borderline", "toc ", "suicid", "automutil", "meltdown", "shutdown", "burnout", "luto",
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function pareceSensivel(texto: string): boolean {
  const t = ` ${semAcento(texto)} `;
  return SINAIS.some((s) => t.includes(s));
}
