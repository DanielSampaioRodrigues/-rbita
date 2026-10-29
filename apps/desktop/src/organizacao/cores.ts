// Cores de "Minha organização": pintam o cartão, a coluna ou o quadro inteiro.
// A cor do texto é escolhida sozinha (claro sobre escuro, escuro sobre claro)
// e sempre passa no contraste mínimo de leitura (WCAG AA, 4,5:1).
import type React from "react";
import { contraste, misturar, type Rgb } from "@orbita/temas";

/** Nomes guardados no banco. Os oito primeiros são os mesmos das etiquetas (cartões antigos continuam iguais). */
export const CORES_ORG = ["musgo", "mar", "ceu", "lavanda", "rosa", "terra", "areia", "cinza", "pessego", "menta"] as const;
export type CorOrg = (typeof CORES_ORG)[number];

/** Tons suaves: pastel no modo claro, fechado e calmo no modo escuro. */
const PALETA: Record<CorOrg, { claro: string; escuro: string }> = {
  musgo: { claro: "#dfe8d3", escuro: "#34432c" },
  mar: { claro: "#cfe7e5", escuro: "#1f4346" },
  ceu: { claro: "#d6e3f3", escuro: "#2a3c56" },
  lavanda: { claro: "#e4ddf2", escuro: "#3c3455" },
  rosa: { claro: "#f3dce6", escuro: "#4d3040" },
  terra: { claro: "#ecdccd", escuro: "#4a3627" },
  areia: { claro: "#f1e7c6", escuro: "#4a4128" },
  cinza: { claro: "#e3e5e8", escuro: "#3a3d42" },
  pessego: { claro: "#f8dfcf", escuro: "#55392b" },
  menta: { claro: "#d5efe1", escuro: "#244639" },
};

const TEXTO_ESCURO = "#1d2024";
const TEXTO_CLARO = "#f4f3ef";
const MINIMO = 4.5;

const hex = ([r, g, b]: Rgb) => "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

export function eCorOrg(cor: string): cor is CorOrg {
  return (CORES_ORG as readonly string[]).includes(cor);
}

/** Cores prontas para um fundo: texto, texto suave, borda e destaque ao passar o mouse. */
export function coresPara(fundo: string) {
  // Texto: o que der mais contraste com o fundo.
  const texto = contraste(fundo, TEXTO_ESCURO) >= contraste(fundo, TEXTO_CLARO) ? TEXTO_ESCURO : TEXTO_CLARO;
  // Texto suave: puxa o texto em direção ao fundo, mas para antes de perder o mínimo de leitura.
  let suave = texto;
  for (let t = 0.35; t > 0; t -= 0.05) {
    const c = hex(misturar(texto, fundo, t));
    if (contraste(c, fundo) >= MINIMO) { suave = c; break; }
  }
  return {
    fundo,
    texto,
    suave,
    borda: hex(misturar(fundo, texto, 0.22)),
    realce: hex(misturar(fundo, texto, 0.08)),
  };
}

/**
 * Variáveis CSS para pintar um elemento com a cor (os dois modos; o CSS escolhe qual vale).
 * Vazio ou cor desconhecida: nada (fica com as cores do tema).
 */
export function estiloCor(cor: string): React.CSSProperties {
  if (!eCorOrg(cor)) return {};
  const c = coresPara(PALETA[cor].claro);
  const e = coresPara(PALETA[cor].escuro);
  return {
    "--org-c-fundo": c.fundo, "--org-c-texto": c.texto, "--org-c-suave": c.suave, "--org-c-borda": c.borda, "--org-c-realce": c.realce,
    "--org-e-fundo": e.fundo, "--org-e-texto": e.texto, "--org-e-suave": e.suave, "--org-e-borda": e.borda, "--org-e-realce": e.realce,
  } as React.CSSProperties;
}

/** Classe que liga a pintura (só quando há cor). */
export const classeCor = (cor: string) => (eCorOrg(cor) ? " org-pintado" : "");

/** Para os testes: as duas versões de cada cor. */
export const PALETA_ORG = PALETA;
