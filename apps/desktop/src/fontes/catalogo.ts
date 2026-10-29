// Fontes da página Aparência, em grupos. Os nomes e o CSS de cada uma ficam em FONTES (preferencias.ts);
// os arquivos das fontes extras, em extras.css (carregado por aparencia.ts).
import type { Fonte } from "../preferencias";

export const GRUPOS_FONTES: { grupo: "leitura" | "dislexia" | "outras"; fontes: Fonte[] }[] = [
  { grupo: "leitura", fontes: ["atkinson", "lexend", "andika"] },
  { grupo: "dislexia", fontes: ["opendyslexic", "comicNeue"] },
  { grupo: "outras", fontes: ["nunito", "inter", "literata", "jetbrainsMono"] },
];
