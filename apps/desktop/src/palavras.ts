// Mesmas regras da parte nativa (src-tauri/src/cofre/palavras.rs), para a tela
// avisar na hora se uma palavra da chave de recuperação foi reconhecida.
import texto from "../src-tauri/src/cofre/palavras-pt.txt?raw";

export const LISTA = texto.split(/\s+/).filter(Boolean);
export const QUANTIDADE = 6;

export function simplificar(palavra: string): string {
  return palavra.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Reconhece a palavra inteira ou pelas 4 primeiras letras. */
export function reconhecer(digitada: string): string | null {
  const d = simplificar(digitada);
  if (d.length < 4) return null;
  if (LISTA.includes(d)) return d;
  const candidata = LISTA.find((p) => p.startsWith(d.slice(0, 4)));
  return candidata && (d.length === 4 || candidata.startsWith(d)) ? candidata : null;
}

/** Separa um texto colado em palavras, ignorando números e pontuação. */
export function separar(texto: string): string[] {
  return texto
    .split(/[\s,.;-]+/)
    .filter((p) => p && !/^\d+$/.test(p));
}

/** Texto para copiar ou imprimir. */
export function textoDaChave(palavras: string[]): string {
  return [
    "ÓRBITA · CHAVE DE RECUPERAÇÃO",
    "",
    "Estas 6 palavras abrem os seus dados se você esquecer a senha.",
    "Quem tiver estas palavras e uma cópia dos seus dados consegue abri-los.",
    "",
    ...palavras.map((p, i) => `${i + 1}. ${p}`),
  ].join("\n");
}
