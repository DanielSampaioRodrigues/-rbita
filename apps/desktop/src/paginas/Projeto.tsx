import { ArrowLeft, CheckCircle2, Eye, Pause, Pencil, Play, RefreshCw, RotateCcw, Sparkles, Trash2 } from "../icones";
import { useEffect, useState } from "react";
import { Button, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { api, type Etiqueta, type EstadoProjeto, type ProvedorVisivel, type Projeto as TipoProjeto, type Tarefa } from "../api";
import { JanelaPlanejar } from "../ia/JanelaPlanejar";
import { useRecado } from "../app/Recado";
import { Aviso } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { avisarMudanca, useMudancas } from "../dados";
import { useComLimite } from "../projetos/Limite";
import { CartaoOndeParei, JanelaOndeParei } from "../projetos/OndeParei";
import { AnotacoesProjeto } from "../projetos/Anotacoes";
import { PastasDoProjeto } from "../projetos/Pastas";
import { ListaTarefas } from "../projetos/ListaTarefas";
import { QuadroTarefas } from "../projetos/QuadroTarefas";
import { MapaMental } from "../projetos/MapaMental";
import { CalendarioTarefas, LinhaTarefas } from "../projetos/TempoTarefas";
import { JanelaPrazo } from "../projetos/prazos";
import { ContextoTarefas } from "../projetos/acoesTarefa";
import { Relacoes } from "../relacoes/Relacoes";
import { CampoData } from "../componentes/CampoData";
import { Escolha } from "../componentes/Escolha";
import { horaDeOlhar, proximaRevisao } from "../projetos/tempo";
import { textos } from "../textos/pt-BR";
import { EditarTexto } from "./Ideias";

const t = textos.projeto;
type Visao = "lista" | "quadro" | "mapa" | "linha" | "calendario";
const VISOES: Visao[] = ["lista", "quadro", "mapa", "linha", "calendario"];
const CHAVE_VISAO = "orbita.visao-tarefas";

function visaoSalva(): Visao {
  try {
    const v = localStorage.getItem(CHAVE_VISAO);
    return VISOES.includes(v as Visao) ? (v as Visao) : "lista";
  } catch {
    return "lista";
  }
}

const MESES_REVISAO = [1, 2, 3, 6, 12];
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });

export function Projeto({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const [projeto, setProjeto] = useState<TipoProjeto | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [visao, setVisao] = useState<Visao>(visaoSalva);
  const [janela, setJanela] = useState<"pausar" | "anotar" | "renomear" | "excluir" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [prazoDe, setPrazoDe] = useState<Tarefa | null>(null);
  const [passosDe, setPassosDe] = useState<{ id: string; titulo: string; projeto: boolean } | null>(null);
  const [provedorIa, setProvedorIa] = useState<ProvedorVisivel | null>(null);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [detalhesDe, setDetalhesDe] = useState<string | null>(null);
  const mudancas = useMudancas();
  const comLimite = useComLimite();
  const recado = useRecado();

  useEffect(() => {
    Promise.all([api.obterProjeto(id), api.listarTarefas(id)]).then(
      ([p, ts]) => (setProjeto(p), setTarefas(ts)),
      (e) => setErro(String(e?.message ?? e)),
    );
  }, [id, mudancas]);

  useEffect(() => {
    api.listarEtiquetas().then(setEtiquetas, () => setEtiquetas([]));
  }, [mudancas]);

  // A IA só aparece se a pessoa escolheu um provedor para "quebrar".
  useEffect(() => {
    api.estadoIa().then((e) => setProvedorIa(e.provedores.find((p) => p.id === e.funcoes.quebrar) ?? null), () => setProvedorIa(null));
  }, [mudancas]);
  const sugerir = provedorIa ? (alvo: { id: string; titulo: string }) => setPassosDe({ id: alvo.id, titulo: alvo.titulo, projeto: alvo.id === id }) : undefined;

  const executar = async (acao: () => Promise<unknown>) => {
    setErro(null);
    try {
      await acao();
      avisarMudanca();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  const mudarEstado = (novo: EstadoProjeto) =>
    executar(() => comLimite(async () => void (await api.mudarEstadoProjeto(id, novo), avisarMudanca())));

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    try {
      localStorage.setItem(CHAVE_VISAO, v);
    } catch {
      // Sem armazenamento: só não lembra da escolha.
    }
  };

  if (!projeto) return <div className="pagina"><Aviso>{erro}</Aviso></div>;
  const tarefaDetalhes = tarefas.find((x) => x.id === detalhesDe) ?? null;

  return (
    <div className="pagina">
      <Button className="link voltar" onPress={aoVoltar}>
        <ArrowLeft aria-hidden="true" size="1em" /> {t.voltar}
      </Button>
      <div className="titulo-projeto">
        <h1 className="quebra">{projeto.titulo}</h1>
        <span className={`etiqueta-estado estado-${projeto.estado}`}>{t.estados[projeto.estado]}</span>
      </div>
      <p className="texto-suave projeto-resumo">{textos.projetos.progresso(projeto.tarefasFeitas, projeto.tarefasTotal)}</p>
      <PastasDoProjeto projeto={projeto} />

      {/* "Sobre o projeto" primeiro (o que ele é), depois "Onde parei" (o momento atual). */}
      <AnotacoesProjeto key={projeto.id} projeto={projeto} />

      {/* "Onde parei" em destaque, logo no alto: retomar importa tanto quanto começar. */}
      <div className="largura-leitura esticado">
        <CartaoOndeParei
          projeto={projeto}
          tarefas={tarefas}
          aoEditar={() => setJanela("anotar")}
          aoRetomar={projeto.estado === "pausado" ? () => mudarEstado("ativo") : undefined}
        />
      </div>

      <div className="botoes projeto-acoes">
        {projeto.estado === "ativo" && (
          <>
            <Button className="botao" onPress={() => setJanela("pausar")}>
              <Pause aria-hidden="true" size="1.1em" /> {t.pausar}
            </Button>
            <Button className="botao" onPress={() => mudarEstado("concluido")}>
              <CheckCircle2 aria-hidden="true" size="1.1em" /> {t.concluir}
            </Button>
          </>
        )}
        {projeto.estado === "concluido" && (
          <Button className="botao" onPress={() => mudarEstado("ativo")}>
            <RotateCcw aria-hidden="true" size="1.1em" /> {t.reabrir}
          </Button>
        )}
        {projeto.estado === "em_uso" ? (
          <Button className="botao" onPress={() => mudarEstado("ativo")}>
            <Play aria-hidden="true" size="1.1em" /> {t.moverAtivo}
          </Button>
        ) : (
          <Button className="botao" onPress={() => mudarEstado("em_uso")}>
            <RefreshCw aria-hidden="true" size="1.1em" /> {t.moverEmUso}
          </Button>
        )}
        <Button className="botao" onPress={() => setJanela("renomear")}>
          <Pencil aria-hidden="true" size="1.1em" /> {t.renomear}
        </Button>
        <Button className="botao" onPress={() => setJanela("excluir")}>
          <Trash2 aria-hidden="true" size="1.1em" /> {t.excluir}
        </Button>
      </div>
      <p className="campo-ajuda largura-leitura">{projeto.estado === "em_uso" ? t.ajudaEmUso : t.ajudaMoverEmUso}</p>
      <Aviso>{erro}</Aviso>

      {projeto.estado === "em_uso" && <RevisaoProjeto projeto={projeto} executar={executar} />}

      <div className="linha-campos largura-leitura" role="group" aria-label={t.datas}>
        <CampoData
          rotulo={t.comeco}
          tipo="date"
          valor={projeto.inicio ?? ""}
          aoMudar={(v) => executar(() => api.definirDatasProjeto(id, v || null, projeto.prazo))}
        />
        <CampoData
          rotulo={t.prazo}
          tipo="date"
          valor={projeto.prazo ?? ""}
          aoMudar={(v) => executar(() => api.definirDatasProjeto(id, projeto.inicio, v || null))}
        />
      </div>


      <section className="secao-relacoes" aria-labelledby="titulo-relacoes">
        <h2 id="titulo-relacoes">{textos.relacoes.titulo}</h2>
        <Relacoes id={id} etiquetas={projeto.etiquetas} />
      </section>

      <ContextoTarefas.Provider value={{ etiquetas, aoDetalhes: (x) => setDetalhesDe(x.id) }}>
        <section className="secao-tarefas" aria-labelledby="titulo-tarefas">
          <div className="linha-ajuste">
            <h2 id="titulo-tarefas">{t.tarefas}</h2>
            <ToggleButtonGroup
              aria-label={t.visualizacao}
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[visao]}
              onSelectionChange={(k) => trocarVisao([...k][0] as Visao)}
              className="segmentado"
            >
              <ToggleButton id="lista" className="segmentado-opcao">{t.lista}</ToggleButton>
              <ToggleButton id="quadro" className="segmentado-opcao">{t.quadro}</ToggleButton>
              <ToggleButton id="mapa" className="segmentado-opcao">{t.mapa}</ToggleButton>
              <ToggleButton id="linha" className="segmentado-opcao">{t.linhaTempo}</ToggleButton>
              <ToggleButton id="calendario" className="segmentado-opcao">{t.calendario}</ToggleButton>
            </ToggleButtonGroup>
          </div>
          {sugerir && visao !== "mapa" && (
            <div className="botoes">
              <Button className="botao com-icone" onPress={() => sugerir({ id, titulo: projeto.titulo })}>
                <Sparkles aria-hidden="true" size="1em" /> {textos.ia.sugerirEtapas}
              </Button>
            </div>
          )}
          {visao === "lista" && <ListaTarefas projetoId={id} tarefas={tarefas} executar={executar} aoDefinirPrazo={setPrazoDe} aoSugerirPassos={sugerir} />}
          {visao === "quadro" && <QuadroTarefas projetoId={id} tarefas={tarefas} executar={executar} aoMover={recado} aoDefinirPrazo={setPrazoDe} aoSugerirPassos={sugerir} />}
          {visao === "linha" && <LinhaTarefas projeto={projeto} tarefas={tarefas} aoDefinirPrazo={setPrazoDe} />}
          {visao === "calendario" && <CalendarioTarefas projeto={projeto} tarefas={tarefas} aoDefinirPrazo={setPrazoDe} />}
          {visao === "mapa" && <MapaMental projetoId={id} titulo={projeto.titulo} tarefas={tarefas} executar={executar} aoSugerirPassos={sugerir} />}
        </section>
      </ContextoTarefas.Provider>

      <Janela titulo={tarefaDetalhes ? `${textos.relacoes.tituloCurto}: ${tarefaDetalhes.titulo}` : ""} aberta={tarefaDetalhes !== null} aoFechar={() => setDetalhesDe(null)}>
        {tarefaDetalhes && (
          <div className="formulario">
            <Relacoes id={tarefaDetalhes.id} etiquetas={tarefaDetalhes.etiquetas} />
            <div className="janela-acoes">
              <Button className="botao principal" onPress={() => setDetalhesDe(null)}>{textos.atalhos.fechar}</Button>
            </div>
          </div>
        )}
      </Janela>
      <JanelaPrazo tarefa={prazoDe} aoFechar={() => setPrazoDe(null)} />
      {provedorIa && (
        <JanelaPlanejar alvo={passosDe} projeto={projeto} tarefas={tarefas} provedor={provedorIa} aoFechar={() => setPassosDe(null)} />
      )}
      <JanelaOndeParei
        projeto={janela === "pausar" || janela === "anotar" ? projeto : null}
        modo={janela === "pausar" ? "pausar" : "editar"}
        aoFechar={() => setJanela(null)}
        aoConcluir={() => setJanela(null)}
      />
      <Janela titulo={t.renomear} aberta={janela === "renomear"} aoFechar={() => setJanela(null)}>
        <EditarTexto
          inicial={projeto.titulo}
          rotulo={textos.projetos.nomeDoProjeto}
          aoCancelar={() => setJanela(null)}
          aoSalvar={(titulo) => executar(async () => (await api.renomear(id, titulo), setJanela(null)))}
        />
      </Janela>
      <Confirmar
        titulo={t.excluirTitulo}
        texto={t.excluirTexto}
        confirmar={t.excluir}
        aberta={janela === "excluir"}
        aoCancelar={() => setJanela(null)}
        aoConfirmar={() => executar(async () => (await api.excluirItem(id), setJanela(null), aoVoltar()))}
      />
    </div>
  );
}

/** Lembrete opcional "rever a cada N meses" de um projeto em uso, com o botão "Olhei". */
function RevisaoProjeto({ projeto, executar }: { projeto: TipoProjeto; executar: (acao: () => Promise<unknown>) => Promise<void> }) {
  const recado = useRecado();
  const olhar = horaDeOlhar(projeto);
  const proxima = proximaRevisao(projeto);
  const opcoes = [
    { valor: "0", nome: t.revisaoDesligado },
    ...MESES_REVISAO.map((n) => ({ valor: String(n), nome: t.revisaoMeses(n) })),
  ];
  return (
    <section className={`cartao revisao-projeto largura-leitura${olhar ? " hora-de-olhar" : ""}`} aria-label={t.revisao}>
      <Escolha
        rotulo={t.revisao}
        descricao={t.revisaoAjuda}
        valor={String(projeto.revisarMeses ?? 0)}
        opcoes={opcoes}
        aoMudar={(v) => executar(() => api.definirRevisaoProjeto(projeto.id, v === "0" ? null : Number(v)))}
      />
      {proxima !== null && (
        <div className="revisao-linha">
          {olhar ? (
            <span className="aviso-olhar">
              <Eye aria-hidden="true" size="1em" /> {t.horaDeOlhar}
            </span>
          ) : (
            <span className="texto-suave">{t.proximaOlhada(fmtData.format(proxima))}</span>
          )}
          <Button
            className="botao"
            onPress={() => executar(async () => (await api.marcarProjetoRevisado(projeto.id), recado(t.olheiFeito)))}
          >
            <Eye aria-hidden="true" size="1.1em" /> {t.olhei}
          </Button>
        </div>
      )}
    </section>
  );
}
