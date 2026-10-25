import { ajustarPaleta, aplicarVariaveis, lerHex, paletaFinal, variaveisDaPaleta, type Modo, type Paleta } from "@orbita/temas";
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

// Tela de desbloqueio: sempre com a trava de contraste, mesmo que a pessoa a tenha liberado.
// O app abre bloqueado, então começa com a trava.
let travaForcada = true;
export function forcarTrava(sim: boolean) {
  travaForcada = sim;
}

/** A trava de contraste vale agora? Só sai se a pessoa liberou, fora do baixo estímulo (a saída rápida) e fora do desbloqueio. */
export function comTrava(prefs: Preferencias): boolean {
  return !prefs.semTrava || prefs.baixoEstimulo || travaForcada;
}

/** Paleta em uso agora (tema, modo e baixo estímulo). Com a trava, o contraste é corrigido se precisar. */
export function paletaAtual(prefs: Preferencias): Paleta {
  const paleta = paletaFinal(temaDasPreferencias(prefs), modoEfetivo(prefs), prefs.baixoEstimulo);
  return comTrava(prefs) ? ajustarPaleta(paleta) : paleta;
}

export function modoEfetivo(prefs: Preferencias): Modo {
  if (prefs.modoCor !== "sistema") return prefs.modoCor;
  return consultaEscuro().matches ? "escuro" : "claro";
}

/** Leva as preferências para a tela: cores, fonte, tamanhos e espaços. */
export function aplicarAparencia(prefs: Preferencias, raiz: HTMLElement = document.documentElement): void {
  const modo = modoEfetivo(prefs);
  const tema = temaDasPreferencias(prefs);
  const paleta = paletaAtual(prefs);
  aplicarVariaveis(raiz, {
    ...variaveisDaPaleta(paleta),
    "--cor-fundo-rgb": lerHex(paleta.fundo).join(" "),
    "--cor-superficie-rgb": lerHex(paleta.superficie).join(" "),
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
    visivel: prefs.fundoVisivel,
    semTrava: !comTrava(prefs),
    natural: !comTrava(prefs) && prefs.fundoNatural,
    // No baixo estímulo, caixas opacas (sem efeito de vidro).
    vidro: prefs.baixoEstimulo ? 0 : prefs.vidro,
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
