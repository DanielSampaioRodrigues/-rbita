import { ArrowLeft, CheckCircle2, Pause, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { api, type EstadoProjeto, type Projeto as TipoProjeto, type Tarefa } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { avisarMudanca, useMudancas } from "../dados";
import { useComLimite } from "../projetos/Limite";
import { CartaoOndeParei, JanelaOndeParei } from "../projetos/OndeParei";
import { ListaTarefas } from "../projetos/ListaTarefas";
import { QuadroTarefas } from "../projetos/QuadroTarefas";
import { textos } from "../textos/pt-BR";
import { EditarTexto } from "./Ideias";

const t = textos.projeto;
type Visao = "lista" | "quadro";
const CHAVE_VISAO = "orbita.visao-tarefas";

function visaoSalva(): Visao {
  try {
    return localStorage.getItem(CHAVE_VISAO) === "quadro" ? "quadro" : "lista";
  } catch {
    return "lista";
  }
}

export function Projeto({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const [projeto, setProjeto] = useState<TipoProjeto | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [visao, setVisao] = useState<Visao>(visaoSalva);
  const [janela, setJanela] = useState<"pausar" | "anotar" | "renomear" | "excluir" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();
  const comLimite = useComLimite();
  const recado = useRecado();

  useEffect(() => {
    Promise.all([api.obterProjeto(id), api.listarTarefas(id)]).then(
      ([p, ts]) => (setProjeto(p), setTarefas(ts)),
      (e) => setErro(String(e?.message ?? e)),
    );
  }, [id, mudancas]);

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

  return (
    <div className="pagina">
      <Button className="link voltar" onPress={aoVoltar}>
        <ArrowLeft aria-hidden="true" size="1em" /> {t.voltar}
      </Button>
      <div className="titulo-projeto">
        <h1 className="quebra">{projeto.titulo}</h1>
        <span className={`etiqueta-estado estado-${projeto.estado}`}>{t.estados[projeto.estado]}</span>
      </div>

      <div className="botoes">
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
        {projeto.estado === "pausado" && (
          <Button className="botao principal" onPress={() => mudarEstado("ativo")}>
            <Play aria-hidden="true" size="1.1em" /> {t.retomar}
          </Button>
        )}
        {projeto.estado === "concluido" && (
          <Button className="botao" onPress={() => mudarEstado("ativo")}>
            <RotateCcw aria-hidden="true" size="1.1em" /> {t.reabrir}
          </Button>
        )}
        <Button className="botao" onPress={() => setJanela("renomear")}>
          <Pencil aria-hidden="true" size="1.1em" /> {t.renomear}
        </Button>
        <Button className="botao" onPress={() => setJanela("excluir")}>
          <Trash2 aria-hidden="true" size="1.1em" /> {t.excluir}
        </Button>
      </div>
      <Aviso>{erro}</Aviso>

      <div className="largura-leitura esticado">
        <CartaoOndeParei projeto={projeto} aoEditar={() => setJanela("anotar")} />
      </div>

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
          </ToggleButtonGroup>
        </div>
        {visao === "lista" ? (
          <ListaTarefas projetoId={id} tarefas={tarefas} executar={executar} />
        ) : (
          <QuadroTarefas projetoId={id} tarefas={tarefas} executar={executar} aoMover={recado} />
        )}
      </section>

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
