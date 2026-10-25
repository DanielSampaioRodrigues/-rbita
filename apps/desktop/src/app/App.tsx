import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { CriarCofre } from "../acesso/CriarCofre";
import { Desbloquear } from "../acesso/Desbloquear";
import { MolduraAcesso } from "../acesso/Moldura";
import { modoEfetivo } from "../aparencia";
import { api, noApp, type Situacao } from "../api";
import { acaoDoEvento, SO_ABERTO, type AcaoAtalho } from "../atalhos";
import { Aviso } from "../componentes/Campo";
import { usePreferencias } from "../estado";
import { Agenda } from "../agenda/Agenda";
import { PaginaFoco, ProvedorFoco } from "../foco/Foco";
import { Ajustes } from "../paginas/Ajustes";
import { Rotinas } from "../rotinas/Rotinas";
import { BaixaEnergia } from "../energia/BaixaEnergia";
import { PaginaEnergia } from "../energia/Energia";
import { AvisosDeTransicao } from "./Avisos";
import { Ideias } from "../paginas/Ideias";
import { Inicio } from "../paginas/Inicio";
import { Projeto } from "../paginas/Projeto";
import { Projetos } from "../paginas/Projetos";
import { TAMANHOS } from "../preferencias";
import { ProvedorLimite } from "../projetos/Limite";
import { textos } from "../textos/pt-BR";
import { Captura } from "./Captura";
import { JanelaAtalhos } from "./JanelaAtalhos";
import { Moldura, type Secao } from "./Moldura";
import { ProvedorRecado } from "./Recado";

export function App() {
  const { prefs, mudar } = usePreferencias();
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [secao, setSecao] = useState<Secao>("inicio");
  const [projetoAberto, setProjetoAberto] = useState<string | null>(null);
  const [atalhosAbertos, setAtalhosAbertos] = useState(false);
  const [capturando, setCapturando] = useState(false);
  // Captura pedida com o Órbita bloqueado: abre logo depois de desbloquear.
  const capturaPendente = useRef(false);

  const atualizar = useCallback(() => {
    api.situacao().then(
      (s) => (setSituacao(s), setFalha(null)),
      (e) => setFalha(e instanceof Error ? e.message : String(e)),
    );
  }, []);
  useEffect(atualizar, [atualizar]);

  const aberto = situacao?.aberto ?? false;

  const irPara = useCallback((s: Secao) => {
    setSecao(s);
    setProjetoAberto(null);
  }, []);

  const abrirProjeto = useCallback((id: string) => {
    setSecao("projetos");
    setProjetoAberto(id);
  }, []);

  const pedirCaptura = useCallback(() => {
    if (aberto) setCapturando(true);
    else capturaPendente.current = true;
  }, [aberto]);

  const aoAbrir = useCallback(() => {
    irPara("inicio");
    atualizar();
  }, [atualizar, irPara]);

  useEffect(() => {
    if (aberto && capturaPendente.current) {
      capturaPendente.current = false;
      setCapturando(true);
    }
  }, [aberto]);

  // Atalho global (Ctrl+Alt+Espaço), vindo da parte nativa.
  useEffect(() => {
    if (!noApp) return;
    const parar = listen("capturar", pedirCaptura);
    return () => void parar.then((f) => f());
  }, [pedirCaptura]);

  const bloquear = useCallback(async () => {
    setCapturando(false);
    await api.bloquear();
    atualizar();
  }, [atualizar]);

  useEffect(() => {
    const executar: Record<AcaoAtalho, () => void> = {
      verAtalhos: () => setAtalhosAbertos(true),
      capturar: pedirCaptura,
      irInicio: () => irPara("inicio"),
      irIdeias: () => irPara("ideias"),
      irProjetos: () => irPara("projetos"),
      irAgenda: () => irPara("agenda"),
      irRotinas: () => irPara("rotinas"),
      irFoco: () => irPara("foco"),
      irEnergia: () => irPara("energia"),
      alternarBaixaEnergia: () => mudar({ baixaEnergia: !prefs.baixaEnergia }),
      irAjustes: () => irPara("ajustes"),
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
  }, [prefs, mudar, aberto, bloquear, irPara, pedirCaptura]);

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
  else {
    let pagina;
    if (secao === "ideias") pagina = <Ideias />;
    else if (secao === "agenda") pagina = <Agenda aoAbrirProjeto={abrirProjeto} />;
    else if (secao === "rotinas") pagina = <Rotinas />;
    else if (secao === "foco") pagina = <PaginaFoco />;
    else if (secao === "energia")
      pagina = <PaginaEnergia aoLigarBaixa={() => mudar({ baixaEnergia: true })} aoAbrirProjeto={abrirProjeto} />;
    else if (secao === "projetos")
      pagina = projetoAberto ? (
        <Projeto key={projetoAberto} id={projetoAberto} aoVoltar={() => setProjetoAberto(null)} />
      ) : (
        <Projetos aoAbrir={abrirProjeto} aoMudarLimite={() => irPara("ajustes")} />
      );
    else if (secao === "ajustes") pagina = <Ajustes modo={situacao.modo} aoMudarSeguranca={atualizar} aoRestaurar={aoAbrir} />;
    else pagina = <Inicio aoCapturar={pedirCaptura} aoAbrirProjeto={abrirProjeto} aoIr={irPara} aoLigarBaixa={() => mudar({ baixaEnergia: true })} />;
    tela = (
      <ProvedorLimite>
        <ProvedorFoco>
          {prefs.baixaEnergia ? (
            <>
              <AvisosDeTransicao config={prefs.avisos} aberto={aberto} />
              <BaixaEnergia aoSair={() => mudar({ baixaEnergia: false })} aoCapturar={pedirCaptura} />
            </>
          ) : (
            <Moldura secao={secao} aoEscolherSecao={irPara} aoVerAtalhos={() => setAtalhosAbertos(true)} aoBloquear={bloquear} aoCapturar={pedirCaptura}>
              <AvisosDeTransicao config={prefs.avisos} aberto={aberto} />
              {pagina}
            </Moldura>
          )}
          <Captura aberta={capturando} aoFechar={() => setCapturando(false)} />
        </ProvedorFoco>
      </ProvedorLimite>
    );
  }

  return (
    <ProvedorRecado>
      {tela}
      <JanelaAtalhos aberta={atalhosAbertos} aoFechar={() => setAtalhosAbertos(false)} />
    </ProvedorRecado>
  );
}
