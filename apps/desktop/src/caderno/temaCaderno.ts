// Tema próprio do caderno (pedido de Dan): por padrão o caderno segue o tema do
// Órbita; quem quiser escolhe outro tema e/ou outro modo de cor só para o caderno.
// As cores valem só dentro da tela do caderno (variáveis CSS no elemento dela).
// Fica no aparelho, como as outras preferências do caderno.
import { ajustarPaleta, lerHex, paletaFinal, TEMAS, variaveisDaPaleta, type Tema } from "@orbita/temas";
import { useState } from "react";
import { comTrava, modoEfetivo } from "../aparencia";
import { usePreferencias } from "../estado";

export interface EscolhaTemaCaderno {
  /** "" = o mesmo tema do Órbita. */
  tema: string;
  modo: "igual" | "claro" | "escuro";
}
const CHAVE = "caderno-tema";
const PADRAO: EscolhaTemaCaderno = { tema: "", modo: "igual" };

function ler(): EscolhaTemaCaderno {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || "null");
    if (v && typeof v.tema === "string" && ["igual", "claro", "escuro"].includes(v.modo)) return v;
  } catch { /* padrão */ }
  return PADRAO;
}

export function useTemaCaderno() {
  const { prefs } = usePreferencias();
  const [escolha, setEscolha] = useState<EscolhaTemaCaderno>(ler);
  const mudar = (e: EscolhaTemaCaderno) => {
    setEscolha(e);
    try { localStorage.setItem(CHAVE, JSON.stringify(e)); } catch { /* ignora */ }
  };
  const temas: Tema[] = [...TEMAS, ...prefs.temasProprios];
  let estilo: React.CSSProperties | undefined;
  if (escolha.tema || escolha.modo !== "igual") {
    const tema = temas.find((t) => t.id === (escolha.tema || prefs.tema)) ?? temas[0];
    const modo = escolha.modo === "igual" ? modoEfetivo(prefs) : escolha.modo;
    let paleta = paletaFinal(tema, modo, prefs.baixoEstimulo);
    if (comTrava(prefs)) paleta = ajustarPaleta(paleta);
    estilo = {
      ...(variaveisDaPaleta(paleta) as React.CSSProperties),
      ["--cor-fundo-rgb" as string]: lerHex(paleta.fundo).join(" "),
      ["--cor-superficie-rgb" as string]: lerHex(paleta.superficie).join(" "),
      background: "var(--cor-fundo)",
      color: "var(--cor-texto)",
      colorScheme: modo === "escuro" ? "dark" : "light",
    };
  }
  return { escolha, mudar, estilo, temas };
}
