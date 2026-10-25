import { useEffect, useState } from "react";
import { modoEfetivo } from "../aparencia";
import { acaoDoEvento, type AcaoAtalho } from "../atalhos";
import { usePreferencias } from "../estado";
import { Ajustes } from "../paginas/Ajustes";
import { Inicio } from "../paginas/Inicio";
import { TAMANHOS } from "../preferencias";
import { JanelaAtalhos } from "./JanelaAtalhos";
import { Moldura, type Secao } from "./Moldura";

export function App() {
  const { prefs, mudar } = usePreferencias();
  const [secao, setSecao] = useState<Secao>("inicio");
  const [atalhosAbertos, setAtalhosAbertos] = useState(false);

  useEffect(() => {
    const executar: Record<AcaoAtalho, () => void> = {
      verAtalhos: () => setAtalhosAbertos(true),
      irInicio: () => setSecao("inicio"),
      irAjustes: () => setSecao("ajustes"),
      alternarBaixoEstimulo: () => mudar({ baixoEstimulo: !prefs.baixoEstimulo }),
      alternarClaroEscuro: () => mudar({ modoCor: modoEfetivo(prefs) === "escuro" ? "claro" : "escuro" }),
      aumentarLetra: () => mudar({ tamanho: Math.min(prefs.tamanho + 1, TAMANHOS.length - 1) }),
      diminuirLetra: () => mudar({ tamanho: Math.max(prefs.tamanho - 1, 0) }),
      letraPadrao: () => mudar({ tamanho: 2 }),
    };
    const aoTeclar = (e: KeyboardEvent) => {
      const acao = acaoDoEvento(e);
      if (!acao) return;
      e.preventDefault();
      executar[acao]();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [prefs, mudar]);

  return (
    <>
      <Moldura secao={secao} aoEscolherSecao={setSecao} aoVerAtalhos={() => setAtalhosAbertos(true)}>
        {secao === "inicio" ? <Inicio aoIrAjustes={() => setSecao("ajustes")} /> : <Ajustes />}
      </Moldura>
      <JanelaAtalhos aberta={atalhosAbertos} aoFechar={() => setAtalhosAbertos(false)} />
    </>
  );
}
