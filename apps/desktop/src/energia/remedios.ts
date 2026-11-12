// Liga os básicos do dia aos remédios cadastrados na Saúde: quando há dose
// marcada para hoje, o básico genérico ("Tomar o remédio") dá lugar às doses
// de verdade, e ele fica marcado sozinho quando todas foram tomadas.
import { api, type Basico, type DoseDoDia } from "../api";

/** O básico fala de remédio? ("Tomar o remédio", "Remédios", "medicação"...) */
export function ehBasicoDeRemedio(texto: string): boolean {
  const s = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /\bremedio|\bmedicac|\bmedicamento/.test(s);
}

/** Os básicos que ficam à mostra quando as doses do dia aparecem no lugar. */
export function basicosSemRemedio(basicos: Basico[], doses: DoseDoDia[]): Basico[] {
  return doses.length ? basicos.filter((b) => !ehBasicoDeRemedio(b.texto)) : basicos;
}

/** Rótulo da dose: "Sertralina (50 mg) · 08:00". */
export function rotuloDaDose(d: DoseDoDia): string {
  return `${d.nome}${d.dose ? ` (${d.dose})` : ""}${d.horario ? ` · ${d.horario}` : ""}`;
}

/** Depois de marcar uma dose: o básico de remédio deve ficar marcado? */
export function todasTomadas(doses: DoseDoDia[]): boolean {
  return doses.length > 0 && doses.every((d) => d.tomada);
}

/** Marca (ou desmarca) o básico de remédio do dia conforme as doses. */
export async function acompanharBasico(dia: string, doses: DoseDoDia[]): Promise<void> {
  const feito = todasTomadas(doses);
  const basicos = await api.basicosDoDia(dia);
  for (const b of basicos.filter((x) => ehBasicoDeRemedio(x.texto) && x.feito !== feito)) await api.marcarBasico(dia, b.texto, feito);
}
