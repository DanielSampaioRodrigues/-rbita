import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { recarregarRecursos } from "../ditado/recursos";
import { BloqueioAutomatico } from "./BloqueioAutomatico";
import { CriarCofre } from "../acesso/CriarCofre";
import { Desbloquear } from "../acesso/Desbloquear";
import { MolduraAcesso } from "../acesso/Moldura";
import { aplicarAparencia, forcarTrava, modoEfetivo } from "../aparencia";
import { api, noApp, type Situacao } from "../api";
import { acaoDoEvento, SO_ABERTO, type AcaoAtalho } from "../atalhos";
import { Aviso } from "../componentes/Campo";
import { usePreferencias } from "../estado";
import { Agenda } from "../agenda/Agenda";
import { PaginaFoco, ProvedorFoco } from "../foco/Foco";
import { Ajustes } from "../paginas/Ajustes";
import { Aparencia } from "../paginas/Aparencia";
import { Rotinas } from "../rotinas/Rotinas";
import { BaixaEnergia } from "../energia/BaixaEnergia";
import { PaginaEnergia } from "../energia/Energia";
import { LembreteCorpo } from "../energia/LembreteCorpo";
import { PaginaSaude } from "../saude/Saude";
import { LembretesRemedio } from "../saude/LembretesRemedio";
import { JanelaPlanoDeCrise } from "../saude/PlanoDeCrise";
import { PaginaCuidado } from "../cuidado/Cuidado";
import { PaginaEstudos } from "../academico/Estudos";
import { PaginaDinheiro } from "../dinheiro/Dinheiro";
import { PaginaHobbies } from "../hobbies/Hobbies";
import { PaginaOrganizacao } from "../organizacao/Organizacao";
import { PaginaCaderno } from "../caderno/Caderno";
import { ProvedorImersivo } from "./Imersivo";
import { PaginaLeitura } from "../leitura/Leitura";
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
import { InstalarCartao } from "./InstalarCartao";
import { Moldura, type Lugar, type Secao } from "./Moldura";
import { ProvedorRecado } from "./Recado";
import { ProvedorAtualizacao } from "../atualizacao/atualizacao";
import { AvisoAtualizacao } from "../atualizacao/TelasAtualizacao";

export function App() {
  const { prefs, mudar } = usePreferencias();
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  // Histórico de lugares, para as setas de voltar e avançar (como num navegador).
  const [historico, setHistorico] = useState<{ lugares: Lugar[]; posicao: number }>({ lugares: [{ secao: "inicio", projeto: null }], posicao: 0 });
  const { secao, projeto: projetoAberto } = historico.lugares[historico.posicao];
  const [atalhosAbertos, setAtalhosAbertos] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [planoCrise, setPlanoCrise] = useState(false);
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
  // Bloqueado, a tela de entrada fica sempre legível (com a trava de contraste).
  useEffect(() => {
    forcarTrava(!aberto);
    aplicarAparencia(prefs);
  }, [aberto, prefs]);
  // Microfone e revisão nos campos dependem de dados que só abrem com o cofre.
  useEffect(() => {
    if (aberto) void recarregarRecursos();
  }, [aberto]);

  // Conta Google ou Microsoft ligada: uma cópia por dia, quietinho. Falha fica anotada em Ajustes.
  useEffect(() => {
    if (!aberto) return;
    const id = setTimeout(() => void api.nuvemEnviar(true).catch(() => undefined), 15_000);
    return () => clearTimeout(id);
  }, [aberto]);

  const navegar = useCallback((lugar: Lugar) => {
    setHistorico(({ lugares, posicao }) => {
      const atual = lugares[posicao];
      if (atual.secao === lugar.secao && atual.projeto === lugar.projeto) return { lugares, posicao };
      // Ir para um lugar novo descarta o "avançar", como num navegador. Guarda no máximo 50.
      const novos = [...lugares.slice(0, posicao + 1), lugar].slice(-50);
      return { lugares: novos, posicao: novos.length - 1 };
    });
  }, []);
  const irPara = useCallback((s: Secao) => navegar({ secao: s, projeto: null }), [navegar]);
  const abrirProjeto = useCallback((id: string) => navegar({ secao: "projetos", projeto: id }), [navegar]);
  const voltar = useCallback(() => setHistorico((h) => ({ ...h, posicao: Math.max(0, h.posicao - 1) })), []);
  const avancar = useCallback(() => setHistorico((h) => ({ ...h, posicao: Math.min(h.lugares.length - 1, h.posicao + 1) })), []);
  // Pular direto para uma das últimas telas (pela lista entre as setas).
  const irParaPosicao = useCallback((i: number) => setHistorico((h) => ({ ...h, posicao: Math.max(0, Math.min(h.lugares.length - 1, i)) })), []);

  // Botões de voltar e avançar do mouse.
  useEffect(() => {
    const aoClicar = (e: MouseEvent) => {
      if (e.button === 3) (e.preventDefault(), voltar());
      if (e.button === 4) (e.preventDefault(), avancar());
    };
    window.addEventListener("mouseup", aoClicar);
    return () => window.removeEventListener("mouseup", aoClicar);
  }, [voltar, avancar]);

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
      irSaude: () => irPara("saude"),
      planoDeCrise: () => setPlanoCrise(true),
      alternarBaixaEnergia: () => mudar({ baixaEnergia: !prefs.baixaEnergia }),
      irAparencia: () => irPara("aparencia"),
      irAjustes: () => irPara("ajustes"),
      voltar,
      avancar,
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
  }, [prefs, mudar, aberto, bloquear, irPara, pedirCaptura, voltar, avancar]);

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
    if (secao === "organizacao") pagina = <PaginaOrganizacao />;
    else if (secao === "ideias") pagina = <Ideias />;
    else if (secao === "agenda") pagina = <Agenda aoAbrirProjeto={abrirProjeto} />;
    else if (secao === "rotinas") pagina = <Rotinas />;
    else if (secao === "foco") pagina = <PaginaFoco />;
    else if (secao === "energia")
      pagina = <PaginaEnergia aoLigarBaixa={() => mudar({ baixaEnergia: true })} aoAbrirProjeto={abrirProjeto} />;
    else if (secao === "projetos")
      pagina = projetoAberto ? (
        <Projeto key={projetoAberto} id={projetoAberto} aoVoltar={() => irPara("projetos")} />
      ) : (
        <Projetos aoAbrir={abrirProjeto} aoMudarLimite={() => irPara("ajustes")} />
      );
    else if (secao === "saude") pagina = <PaginaSaude aoAbrirPlanoDeCrise={() => setPlanoCrise(true)} />;
    else if (secao === "cuidado") pagina = <PaginaCuidado />;
    else if (secao === "estudos") pagina = <PaginaEstudos />;
    else if (secao === "dinheiro") pagina = <PaginaDinheiro />;
    else if (secao === "hobbies") pagina = <PaginaHobbies />;
    else if (secao === "leitura") pagina = <PaginaLeitura />;
    else if (secao === "caderno") pagina = <PaginaCaderno />;
    else if (secao === "aparencia") pagina = <Aparencia />;
    else if (secao === "ajustes") pagina = <Ajustes modo={situacao.modo} temSenha={situacao.temSenha} aoMudarSeguranca={atualizar} aoRestaurar={aoAbrir} />;
    else pagina = <Inicio aoCapturar={pedirCaptura} aoAbrirProjeto={abrirProjeto} aoIr={irPara} aoLigarBaixa={() => mudar({ baixaEnergia: true })} />;
    tela = (
      <ProvedorAtualizacao procurarAoAbrir={prefs.procurarAtualizacao}>
        <ProvedorLimite>
          <ProvedorFoco>
           <ProvedorImersivo>
            <BloqueioAutomatico minutos={prefs.bloqueioAuto} aoBloquear={bloquear} />
            <LembretesRemedio aberto={aberto} />
            <LembreteCorpo aberto={aberto} />
            {prefs.baixaEnergia ? (
              <>
                <AvisosDeTransicao config={prefs.avisos} aberto={aberto} />
                <BaixaEnergia aoSair={() => mudar({ baixaEnergia: false })} aoCapturar={pedirCaptura} />
              </>
            ) : (
              <Moldura
                secao={secao}
                aoEscolherSecao={irPara}
                navegacao={{ podeVoltar: historico.posicao > 0, podeAvancar: historico.posicao < historico.lugares.length - 1, voltar, avancar, lugares: historico.lugares, posicao: historico.posicao, irParaPosicao }} aoVerAtalhos={() => setAtalhosAbertos(true)} aoBloquear={bloquear} aoCapturar={pedirCaptura}>
                <AvisosDeTransicao config={prefs.avisos} aberto={aberto} />
                <AvisoAtualizacao />
                <InstalarCartao />
                {pagina}
              </Moldura>
            )}
            <Captura aberta={capturando} aoFechar={() => setCapturando(false)} />
           </ProvedorImersivo>
          </ProvedorFoco>
        </ProvedorLimite>
      </ProvedorAtualizacao>
    );
  }

  return (
    <ProvedorRecado>
      {tela}
      <JanelaAtalhos aberta={atalhosAbertos} aoFechar={() => setAtalhosAbertos(false)} />
      <JanelaPlanoDeCrise aberta={planoCrise && aberto} aoFechar={() => setPlanoCrise(false)} />
    </ProvedorRecado>
  );
}
