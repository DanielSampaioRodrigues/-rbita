import { aplicarVariaveis, paletaFinal, papel, variaveisDaPaleta, type Modo } from "@orbita/temas";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  DENSIDADES,
  ESPACO_LETRAS,
  ESPACO_LINHAS,
  FONTES,
  TAMANHOS,
  type Preferencias,
} from "./preferencias";

const consultaEscuro = () => window.matchMedia("(prefers-color-scheme: dark)");

export function modoEfetivo(prefs: Preferencias): Modo {
  if (prefs.modoCor !== "sistema") return prefs.modoCor;
  return consultaEscuro().matches ? "escuro" : "claro";
}

/** Leva as preferências para a tela: cores, fonte, tamanhos e espaços. */
export function aplicarAparencia(prefs: Preferencias, raiz: HTMLElement = document.documentElement): void {
  const modo = modoEfetivo(prefs);
  aplicarVariaveis(raiz, {
    ...variaveisDaPaleta(paletaFinal(papel, modo, prefs.baixoEstimulo)),
    "--fonte-texto": FONTES[prefs.fonte].css,
    "--tamanho-base": `${TAMANHOS[prefs.tamanho]}px`,
    "--densidade": String(DENSIDADES[prefs.densidade]),
    "--espaco-letras": ESPACO_LETRAS[prefs.espacoLetras],
    "--altura-linha": String(ESPACO_LINHAS[prefs.espacoLinhas]),
  });
  raiz.dataset.modo = modo;
  raiz.dataset.baixoEstimulo = String(prefs.baixoEstimulo);
  raiz.style.colorScheme = modo === "escuro" ? "dark" : "light";

  // A barra de título do Windows acompanha o modo escolhido no app.
  if (isTauri()) {
    const tema = prefs.modoCor === "sistema" ? null : modo === "escuro" ? "dark" : "light";
    getCurrentWindow().setTheme(tema).catch(() => {});
  }
}

/** Avisa quando o Windows troca entre claro e escuro. */
export function aoMudarModoDoSistema(callback: () => void): () => void {
  const consulta = consultaEscuro();
  consulta.addEventListener("change", callback);
  return () => consulta.removeEventListener("change", callback);
}
