// Personalização das rotinas (cor, símbolo, dias, horário) e o "feito hoje".
// Ficam no cofre de valores (banco criptografado, entra no backup), chaves
// "rotinas.personalizacao" e "rotinas.feitos". Antes ficavam no localStorage e
// migram sozinhos. Se a rotina vier com os campos preenchidos, eles valem mais.
import { contraste } from "@orbita/temas";
import type { Rotina } from "../api";
import { criarLoja, useLoja } from "../valores";

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

/** Onde ficavam antes (localStorage). */
export const CHAVE_ANTIGA = "orbita.rotinas.personalizacao";
export const CHAVE_FEITOS_ANTIGA = "orbita.rotinas.feitos";

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const textoOuNulo = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Aceita qualquer coisa vinda do armazenamento e devolve personalizações válidas. */
export function validarPersonalizacoes(bruto: unknown): Record<string, Personalizacao> {
  if (!ehObjeto(bruto)) return {};
  const saida: Record<string, Personalizacao> = {};
  for (const [id, v] of Object.entries(bruto)) {
    if (!ehObjeto(v)) continue;
    saida[id] = {
      cor: textoOuNulo(v.cor),
      icone: textoOuNulo(v.icone),
      dias: Array.isArray(v.dias) ? v.dias.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6) : [],
      horario: typeof v.horario === "string" && /^\d{2}:\d{2}$/.test(v.horario) ? v.horario : null,
    };
  }
  return saida;
}

export function validarFeitos(bruto: unknown): Feitos {
  if (!ehObjeto(bruto) || typeof bruto.dia !== "string" || !ehObjeto(bruto.passos)) return { dia: "", passos: {} };
  const passos: Record<string, string[]> = {};
  for (const [id, lista] of Object.entries(bruto.passos)) {
    if (Array.isArray(lista)) passos[id] = lista.filter((x): x is string => typeof x === "string");
  }
  return { dia: bruto.dia, passos };
}

export const lojaPersonalizacoes = criarLoja<Record<string, Personalizacao>>({
  chave: "rotinas.personalizacao",
  antiga: CHAVE_ANTIGA,
  vazio: () => ({}),
  validar: validarPersonalizacoes,
});

export const lojaFeitos = criarLoja<Feitos>({
  chave: "rotinas.feitos",
  antiga: CHAVE_FEITOS_ANTIGA,
  vazio: () => ({ dia: "", passos: {} }),
  validar: validarFeitos,
});

/** Lê do cofre ao montar e redesenha a tela quando a personalização ou o "feito hoje" mudam. */
export function useRotinasGuardadas() {
  useLoja(lojaPersonalizacoes);
  useLoja(lojaFeitos);
}

export function lerPersonalizacoes(): Record<string, Personalizacao> {
  return lojaPersonalizacoes.obter();
}

export function salvarPersonalizacao(rotinaId: string, p: Personalizacao) {
  lojaPersonalizacoes.mudar((atuais) => ({ ...atuais, [rotinaId]: p }));
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

export interface Feitos {
  dia: string;
  /** rotina -> ids dos passos feitos hoje */
  passos: Record<string, string[]>;
}

/** Passos feitos hoje. De um dia para o outro tudo recomeça limpo, sem registro de falha. */
export function passosFeitosHoje(rotinaId: string): string[] {
  const f = lojaFeitos.obter();
  return f.dia === hojeTexto() ? (f.passos[rotinaId] ?? []) : [];
}

/** Marca ou desmarca um passo hoje (função pura, para testar). */
export function comPasso(f: Feitos, rotinaId: string, passoId: string, feito: boolean, hoje = hojeTexto()): Feitos {
  const passos = f.dia === hoje ? f.passos : {};
  const atuais = new Set(passos[rotinaId] ?? []);
  if (feito) atuais.add(passoId);
  else atuais.delete(passoId);
  return { dia: hoje, passos: { ...passos, [rotinaId]: [...atuais] } };
}

export function marcarPasso(rotinaId: string, passoId: string, feito: boolean) {
  lojaFeitos.mudar((f) => comPasso(f, rotinaId, passoId, feito));
}
