import { aplicarVariaveis, lerHex, paletaFinal, variaveisDaPaleta, type Modo, type Paleta } from "@orbita/temas";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { aplicarFundo } from "./fundo";
import { definirEstiloIcones } from "./icones";
import {
  DENSIDADES,
  ESPACO_LETRAS,
  ESPACO_LINHAS,
  FONTES,
  TAMANHOS,
  temaDasPreferencias,
  type Preferencias,
} from "./preferencias";

const consultaEscuro = () => window.matchMedia("(prefers-color-scheme: dark)");
const consultaMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)");

/** Paleta em uso agora (tema, modo e baixo estímulo). */
export function paletaAtual(prefs: Preferencias): Paleta {
  return paletaFinal(temaDasPreferencias(prefs), modoEfetivo(prefs), prefs.baixoEstimulo);
}

export function modoEfetivo(prefs: Preferencias): Modo {
  if (prefs.modoCor !== "sistema") return prefs.modoCor;
  return consultaEscuro().matches ? "escuro" : "claro";
}

/** Leva as preferências para a tela: cores, fonte, tamanhos e espaços. */
export function aplicarAparencia(prefs: Preferencias, raiz: HTMLElement = document.documentElement): void {
  const modo = modoEfetivo(prefs);
  const tema = temaDasPreferencias(prefs);
  const paleta = paletaFinal(tema, modo, prefs.baixoEstimulo);
  aplicarVariaveis(raiz, {
    ...variaveisDaPaleta(paleta),
    "--cor-fundo-rgb": lerHex(paleta.fundo).join(" "),
    "--multiplicador-cantos": String(tema.cantos ?? 1),
    "--traco-icone": String(tema.icones?.traco ?? 2),
    "--pontas-icone": tema.icones?.pontas === "retas" ? "square" : "round",
    "--juncao-icone": tema.icones?.pontas === "retas" ? "miter" : "round",
    "--fonte-texto": FONTES[prefs.fonte].css,
    "--tamanho-base": `${TAMANHOS[prefs.tamanho]}px`,
    "--densidade": String(DENSIDADES[prefs.densidade]),
    "--espaco-letras": ESPACO_LETRAS[prefs.espacoLetras],
    "--altura-linha": String(ESPACO_LINHAS[prefs.espacoLinhas]),
  });
  raiz.dataset.modo = modo;
  raiz.dataset.baixoEstimulo = String(prefs.baixoEstimulo);
  raiz.dataset.semSombra = String(tema.sombra === false);
  // Ícones: família, preenchimento e desenhos próprios vêm do tema; o efeito vai para o CSS.
  definirEstiloIcones(tema.icones);
  raiz.dataset.iconesEfeito = tema.icones?.efeito ?? "nenhum";
  void aplicarFundo(raiz, prefs.fundo ?? tema.fundoPadrao ?? { tipo: "cor" }, paleta, {
    baixoEstimulo: prefs.baixoEstimulo,
    reduzirAnimacao: consultaMovimento().matches,
  });
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
