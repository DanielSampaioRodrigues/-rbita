import { useState } from "react";
import { CampoRico } from "../componentes/CampoRico";
import { TextoRico } from "../componentes/TextoRico";
import { Button, Form } from "react-aria-components";
import { api, type Projeto, type Tarefa } from "../api";
import { Play } from "../icones";
import { haQuanto } from "./tempo";
import { Aviso, Campo } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";

const t = textos.projeto;
const tt = textos.projetos.tempo;
export const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" });
export const formatoDia = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });

interface Props {
  projeto: Projeto | null;
  /** "pausar" guarda a anotação e pausa; "editar" só guarda. */
  modo: "pausar" | "editar";
  aoFechar: () => void;
  aoConcluir: () => void;
}

/** Cartão "onde parei": em que ponto estava, próximo passo e links. Tudo opcional. */
export function JanelaOndeParei({ projeto, modo, aoFechar, aoConcluir }: Props) {
  return (
    <Janela titulo={modo === "pausar" ? t.pausarTitulo : t.ondeParei} aberta={!!projeto} aoFechar={aoFechar}>
      {projeto && <Formulario key={projeto.id} projeto={projeto} modo={modo} aoFechar={aoFechar} aoConcluir={aoConcluir} />}
    </Janela>
  );
}

function Formulario({ projeto, modo, aoFechar, aoConcluir }: Props & { projeto: Projeto }) {
  const o = projeto.ondeParei;
  const [texto, setTexto] = useState(o?.texto ?? "");
  const [proximo, setProximo] = useState(o?.proximoPasso ?? "");
  const [links, setLinks] = useState((o?.links ?? []).join("\n"));
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const salvar = async () => {
    setOcupado(true);
    setErro(null);
    const anotacao = { texto: texto.trim(), proximoPasso: proximo.trim(), links: links.split("\n").map((l) => l.trim()).filter(Boolean) };
    try {
      if (modo === "pausar") await api.mudarEstadoProjeto(projeto.id, "pausado", anotacao);
      else await api.salvarOndeParei(projeto.id, anotacao);
      avisarMudanca();
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Form className="formulario" onSubmit={(e) => (e.preventDefault(), salvar())}>
      {modo === "pausar" && <p>{t.pausarTexto}</p>}
      <p className="campo-rotulo">{projeto.titulo}</p>
      <CampoRico rotulo={t.emQuePonto} valor={texto} aoMudar={setTexto} autoFocus />
      <Campo rotulo={t.proximoPasso} valor={proximo} aoMudar={setProximo} descricao={t.proximoDica} />
      <Campo rotulo={t.links} valor={links} aoMudar={setLinks} multilinha descricao={t.linksDica} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={ocupado}>
          {ocupado ? textos.comum.aguarde : modo === "pausar" ? t.pausar : t.salvarAnotacao}
        </Button>
      </div>
    </Form>
  );
}

/**
 * O cartão "onde parei", em destaque no alto do projeto: o próximo passo (ou a próxima tarefa da lista),
 * a última anotação, os links e quando foi anotado. Se o projeto está pausado, diz há quanto tempo
 * e oferece retomar dali.
 */
export function CartaoOndeParei({ projeto, aoEditar, tarefas = [], aoRetomar }: { projeto: Projeto; aoEditar: () => void; tarefas?: Tarefa[]; aoRetomar?: () => void }) {
  const o = projeto.ondeParei;
  const vazio = !o || (!o.texto && !o.proximoPasso && o.links.length === 0);
  // Sem próximo passo anotado, a próxima tarefa da lista serve de ponto de partida.
  const proximaTarefa = o?.proximoPasso ? null : (tarefas.find((x) => x.estado === "fazendo") ?? tarefas.find((x) => x.estado === "a_fazer") ?? null);
  const pausa = projeto.estado === "pausado" ? (projeto.pausadoEm ? tt.pausadoHa(haQuanto(projeto.pausadoEm)) : tt.pausado) : null;
  return (
    <section className={pausa ? "cartao onde-parei onde-parei-destaque pausado" : "cartao onde-parei onde-parei-destaque"} aria-labelledby={`onde-${projeto.id}`}>
      <div className="linha-ajuste">
        <h2 id={`onde-${projeto.id}`}>{t.ondeParei}</h2>
        <Button className="botao" onPress={aoEditar}>{vazio ? t.anotar : t.editar}</Button>
      </div>
      {pausa && <p className="onde-parei-pausa">{pausa}</p>}
      {o?.proximoPasso ? (
        <p className="proximo-passo">
          <span className="proximo-passo-rotulo">{t.proximoRotulo}</span>
          <span className="quebra proximo-passo-texto">{o.proximoPasso}</span>
        </p>
      ) : proximaTarefa ? (
        <p className="proximo-passo">
          <span className="proximo-passo-rotulo">{t.proximaDaLista}</span>
          <span className="quebra proximo-passo-texto">{proximaTarefa.titulo}</span>
        </p>
      ) : null}
      {o?.texto ? (
        <div className="onde-parei-nota">
          <span className="proximo-passo-rotulo">{t.ultimaAnotacao}</span>
          <TextoRico markdown={o.texto} className="quebra" />
        </div>
      ) : (
        vazio && <p className="texto-suave">{t.ondePareiVazio}</p>
      )}
      {o && o.links.length > 0 && (
        <ul className="lista-links">
          {o.links.map((l) => (
            <li key={l} className="quebra">{l}</li>
          ))}
        </ul>
      )}
      {o && o.atualizadoEm > 0 && (
        <p className="texto-suave pequeno">
          {t.atualizadoEm(formatoData.format(o.atualizadoEm))} ({haQuanto(o.atualizadoEm)})
        </p>
      )}
      {aoRetomar && (
        <div className="botoes">
          <Button className="botao principal" onPress={aoRetomar}>
            <Play aria-hidden="true" size="1.1em" /> {t.retomarDaqui}
          </Button>
        </div>
      )}
    </section>
  );
}
