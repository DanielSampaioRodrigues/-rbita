import { useCallback, useEffect, useState } from "react";
import { CriarCofre } from "../acesso/CriarCofre";
import { Desbloquear } from "../acesso/Desbloquear";
import { MolduraAcesso } from "../acesso/Moldura";
import { Aviso } from "../componentes/Campo";
import { textos } from "../textos/pt-BR";
import { modoEfetivo } from "../aparencia";
import { api, type Situacao } from "../api";
import { acaoDoEvento, SO_ABERTO, type AcaoAtalho } from "../atalhos";
import { usePreferencias } from "../estado";
import { Ajustes } from "../paginas/Ajustes";
import { Inicio } from "../paginas/Inicio";
import { TAMANHOS } from "../preferencias";
import { JanelaAtalhos } from "./JanelaAtalhos";
import { Moldura, type Secao } from "./Moldura";

export function App() {
  const { prefs, mudar } = usePreferencias();
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [secao, setSecao] = useState<Secao>("inicio");
  const [atalhosAbertos, setAtalhosAbertos] = useState(false);

  const atualizar = useCallback(() => {
    api.situacao().then(
      (s) => (setSituacao(s), setFalha(null)),
      (e) => setFalha(e instanceof Error ? e.message : String(e)),
    );
  }, []);
  useEffect(atualizar, [atualizar]);

  const aoAbrir = useCallback(() => {
    setSecao("inicio");
    atualizar();
  }, [atualizar]);

  const bloquear = useCallback(async () => {
    await api.bloquear();
    atualizar();
  }, [atualizar]);

  const aberto = situacao?.aberto ?? false;

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
      bloquear: () => void bloquear(),
    };
    const aoTeclar = (e: KeyboardEvent) => {
      const acao = acaoDoEvento(e);
      if (!acao || (!aberto && SO_ABERTO.includes(acao))) return;
      e.preventDefault();
      executar[acao]();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [prefs, mudar, aberto, bloquear]);

  let tela;
  if (falha)
    tela = (
      <MolduraAcesso>
        <h1>{textos.falha.titulo}</h1>
        <p>{textos.falha.texto}</p>
        <Aviso>{falha}</Aviso>
      </MolduraAcesso>
    );
  else if (!situacao) tela = null;
  else if (!situacao.existe) tela = <CriarCofre aoConcluir={aoAbrir} />;
  else if (!situacao.aberto) tela = <Desbloquear key={situacao.modo} situacao={situacao} aoAbrir={aoAbrir} />;
  else
    tela = (
      <Moldura secao={secao} aoEscolherSecao={setSecao} aoVerAtalhos={() => setAtalhosAbertos(true)} aoBloquear={bloquear}>
        {secao === "inicio" ? (
          <Inicio aoIrAjustes={() => setSecao("ajustes")} />
        ) : (
          <Ajustes modo={situacao.modo} aoMudarSeguranca={atualizar} aoRestaurar={aoAbrir} />
        )}
      </Moldura>
    );

  return (
    <>
      {tela}
      <JanelaAtalhos aberta={atalhosAbertos} aoFechar={() => setAtalhosAbertos(false)} />
    </>
  );
}
