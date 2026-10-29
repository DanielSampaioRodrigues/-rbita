// Personalização das rotinas (cor, símbolo, dias, horário) e o "feito hoje".
// Enquanto a parte nativa não guarda esses campos, ficam neste computador (localStorage);
// se a rotina vier com os campos preenchidos, eles valem mais.
import { contraste } from "@orbita/temas";
import type { Rotina } from "../api";

/** Cores suaves. Nome literal sempre ao lado; nunca a cor sozinha. */
export const PALETA = [
  { id: "rosa", nome: "Rosa", hex: "#F4B8C8" },
  { id: "terracota", nome: "Terracota", hex: "#E3AE9C" },
  { id: "laranja", nome: "Laranja", hex: "#F6C59A" },
  { id: "amarelo", nome: "Amarelo", hex: "#F3E19A" },
  { id: "verde", nome: "Verde", hex: "#B9DDB0" },
  { id: "menta", nome: "Menta", hex: "#A8DCCB" },
  { id: "celeste", nome: "Celeste", hex: "#A9D4F0" },
  { id: "azul", nome: "Azul", hex: "#B2BDF0" },
  { id: "lilas", nome: "Lilás", hex: "#D0B8EC" },
  { id: "cinza", nome: "Cinza", hex: "#CBD0D6" },
] as const;

export interface Personalizacao {
  /** Id da cor da paleta; vazio = sem cor. */
  cor?: string | null;
  /** Nome de um ícone da lista ou um emoji; vazio = nenhum. */
  icone?: string | null;
  /** Dias em que vale (0 = domingo … 6 = sábado). Vazio = todos os dias. */
  dias?: number[];
  /** "HH:MM" */
  horario?: string | null;
}

export function hexDaCor(id: string | null | undefined): string | null {
  return PALETA.find((c) => c.id === id)?.hex ?? null;
}

/** Texto escuro ou claro, o que tiver mais contraste sobre a cor. */
export function textoSobre(hex: string): string {
  const escuro = "#1b1b1f";
  const claro = "#ffffff";
  return contraste(hex, escuro) >= contraste(hex, claro) ? escuro : claro;
}

const CHAVE = "orbita.rotinas.personalizacao";
const CHAVE_FEITOS = "orbita.rotinas.feitos";

function ler<T>(chave: string, padrao: T): T {
  try {
    const texto = localStorage.getItem(chave);
    return texto ? (JSON.parse(texto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento: a tela segue funcionando, só não lembra.
  }
}

export function lerPersonalizacoes(): Record<string, Personalizacao> {
  return ler<Record<string, Personalizacao>>(CHAVE, {});
}

export function salvarPersonalizacao(rotinaId: string, p: Personalizacao) {
  gravar(CHAVE, { ...lerPersonalizacoes(), [rotinaId]: p });
}

/** Junta o que veio da rotina com o que está guardado aqui (o da rotina vale mais). */
export function personalizacaoDe(r: Rotina, guardadas = lerPersonalizacoes()): Personalizacao {
  const g = guardadas[r.id] ?? {};
  return {
    cor: r.cor ?? g.cor ?? null,
    icone: r.icone ?? g.icone ?? null,
    dias: r.dias ?? g.dias ?? [],
    horario: r.horario ?? g.horario ?? null,
  };
}

/** Só um emoji (ou símbolo curto): corta no primeiro "caractere" visível. */
export function limparEmoji(texto: string): string {
  const t = texto.trim();
  if (!t) return "";
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return [...new Seg(undefined, { granularity: "grapheme" }).segment(t)][0]?.segment ?? "";
  return [...t][0] ?? "";
}

const NOMES_DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "Todos os dias", "Seg, qua e sex" ou "Fins de semana"… sempre literal. */
export function resumoDeDias(dias: number[]): string {
  const d = [...new Set(dias)].filter((x) => x >= 0 && x <= 6).sort();
  if (d.length === 0 || d.length === 7) return "Todos os dias";
  if (d.join() === "1,2,3,4,5") return "Dias úteis";
  if (d.join() === "0,6") return "Fins de semana";
  const nomes = d.map((x) => NOMES_DIAS[x]);
  const texto = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function valeNoDia(dias: number[] | undefined, dia: number): boolean {
  return !dias || dias.length === 0 || dias.includes(dia);
}

export function hojeTexto(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface Feitos {
  dia: string;
  /** rotina -> ids dos passos feitos hoje */
  passos: Record<string, string[]>;
}

/** Passos feitos hoje. De um dia para o outro tudo recomeça limpo, sem registro de falha. */
export function passosFeitosHoje(rotinaId: string): string[] {
  const f = ler<Feitos>(CHAVE_FEITOS, { dia: "", passos: {} });
  return f.dia === hojeTexto() ? (f.passos[rotinaId] ?? []) : [];
}

export function marcarPasso(rotinaId: string, passoId: string, feito: boolean) {
  const f = ler<Feitos>(CHAVE_FEITOS, { dia: "", passos: {} });
  const hoje = hojeTexto();
  const passos = f.dia === hoje ? f.passos : {};
  const atuais = new Set(passos[rotinaId] ?? []);
  if (feito) atuais.add(passoId);
  else atuais.delete(passoId);
  gravar(CHAVE_FEITOS, { dia: hoje, passos: { ...passos, [rotinaId]: [...atuais] } });
}
