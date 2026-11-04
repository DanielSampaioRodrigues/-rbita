// Tarefas do Classroom: o que falta (pelo prazo) e o que já foi entregue. Cada tarefa
// pode ir para a agenda do Órbita e, quando a janela abre pelo "Enviar", o trabalho
// aberto pode ser entregue: o PDF vai para o Drive e a tarefa abre no Classroom, com
// os passos que faltam (o Google não deixa apps de fora entregarem por conta própria).
import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { api } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { CalendarDays, Check, ExternalLink } from "../icones";
import { textos } from "../textos/pt-BR";
import { listarTarefas, listarTurmas, porNaAgenda, tarefasNaAgenda, type TarefaClassroom } from "./classroom";
import { salvarNoDrive } from "./drive";

const t = textos.conectores.classroom;
const formato = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface ArquivoParaEntregar { nome: string; tipo: string; dados: Blob | Uint8Array }

export function JanelaClassroom({ aberta, aoFechar, fazerArquivo }: {
  aberta: boolean;
  aoFechar: () => void;
  /** Quando vem do "Enviar": prepara o PDF do trabalho aberto. */
  fazerArquivo?: () => Promise<ArquivoParaEntregar | null>;
}) {
  const recado = useRecado();
  const [tarefas, setTarefas] = useState<TarefaClassroom[] | null>(null);
  const [agenda, setAgenda] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [entregando, setEntregando] = useState<{ tarefa: TarefaClassroom; nome: string } | null>(null);
  const carregar = async () => {
    setErro(null);
    setTarefas(null);
    try {
      setTarefas(await listarTarefas(await listarTurmas()));
      setAgenda(await tarefasNaAgenda());
    } catch (e) {
      setErro(mensagem(e));
      setTarefas([]);
    }
  };
  useEffect(() => { if (aberta) { setEntregando(null); void carregar(); } }, [aberta]);

  const entregar = async (tarefa: TarefaClassroom) => {
    if (!fazerArquivo) return;
    setOcupado(tarefa.id);
    setErro(null);
    try {
      const a = await fazerArquivo();
      if (!a) return;
      const salvo = await salvarNoDrive(a.nome, a.tipo, a.dados);
      setEntregando({ tarefa, nome: salvo.nome });
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(null);
    }
  };
  const agendar = async (tarefa: TarefaClassroom) => {
    try {
      if (await porNaAgenda(tarefa)) recado(t.postoAgenda);
      setAgenda(await tarefasNaAgenda());
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  const abrir = (url: string) => void api.abrirEndereco(url).catch((e) => setErro(mensagem(e)));

  const faltam = (tarefas ?? []).filter((x) => x.estado === "pendente");
  const feitas = (tarefas ?? []).filter((x) => x.estado !== "pendente");
  const cartao = (x: TarefaClassroom) => (
    <li key={x.id} className="classroom-tarefa">
      <div className="classroom-sobre">
        <span className="classroom-titulo">{x.titulo}</span>
        <span className="texto-suave pequeno">{x.turma}</span>
        <span className="pequeno">
          {x.estado === "entregue" ? <><Check aria-hidden="true" size="0.9em" /> {t.entregue}</> : x.estado === "devolvida" ? t.devolvida
            : x.prazo === null ? t.semPrazo : x.atrasada ? t.passou(formato.format(x.prazo)) : t.prazo(formato.format(x.prazo))}
        </span>
      </div>
      <div className="painel-ia-linha">
        {fazerArquivo && x.estado === "pendente" && <Button className="botao pequeno principal" isDisabled={!!ocupado} onPress={() => void entregar(x)}>{ocupado === x.id ? t.gerando : t.entregar}</Button>}
        {x.estado === "pendente" && x.prazo !== null && (agenda[x.id]
          ? <span className="texto-suave pequeno com-icone"><CalendarDays aria-hidden="true" size="0.95em" /> {t.naAgenda}</span>
          : <Button className="botao pequeno com-icone" onPress={() => void agendar(x)}><CalendarDays aria-hidden="true" size="1em" /> {t.agenda}</Button>)}
        <Button className="botao pequeno com-icone" onPress={() => abrir(x.link)}><ExternalLink aria-hidden="true" size="1em" /> {t.abrir}</Button>
      </div>
    </li>
  );

  return (
    <Janela titulo={entregando ? t.passosTitulo : t.titulo} aberta={aberta} aoFechar={aoFechar}>
      {entregando ? (
        <div className="classroom-passos">
          <ol>{t.passos(entregando.nome).map((p, i) => <li key={i}>{p}</li>)}</ol>
          <p className="texto-suave pequeno">{t.porque}</p>
          <div className="janela-acoes">
            <Button className="botao" onPress={() => setEntregando(null)}>{textos.comum.voltar}</Button>
            <Button className="botao principal com-icone" autoFocus onPress={() => abrir(entregando.tarefa.link)}><ExternalLink aria-hidden="true" size="1em" /> {t.abrirTarefa}</Button>
          </div>
        </div>
      ) : (
        <>
          {tarefas === null && <p role="status" className="texto-suave">{t.carregando}</p>}
          {erro && <Aviso>{erro}</Aviso>}
          {tarefas && tarefas.length === 0 && !erro && <p className="texto-suave">{t.nenhuma}</p>}
          {faltam.length > 0 && (<><h3 className="classroom-grupo">{t.faltam}</h3><ul className="classroom-lista">{faltam.map(cartao)}</ul></>)}
          {feitas.length > 0 && (<><h3 className="classroom-grupo">{t.feitas}</h3><ul className="classroom-lista">{feitas.map(cartao)}</ul></>)}
          <div className="janela-acoes">
            <Button className="botao" onPress={() => void carregar()}>{t.atualizar}</Button>
            <Button className="botao principal" onPress={aoFechar}>{t.fechar}</Button>
          </div>
        </>
      )}
    </Janela>
  );
}
