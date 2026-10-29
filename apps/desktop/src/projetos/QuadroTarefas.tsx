import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { GripVertical } from "../icones";
import { api, type EstadoTarefa, type Tarefa } from "../api";
import { Campo } from "../componentes/Campo";
import { pularEntreColunas } from "../componentes/tecladoColunas";
import { textos } from "../textos/pt-BR";
import { ESTADOS, EtiquetaPeso, EtiquetasTarefa, MenuTarefa } from "./acoesTarefa";
import { EtiquetaPrazo } from "./prazos";
import { useSensoresArrastar } from "./sensores";

const t = textos.projeto;

interface Props {
  projetoId: string;
  tarefas: Tarefa[];
  executar: (acao: () => Promise<unknown>) => void;
  aoMover: (texto: string) => void;
  aoDefinirPrazo: (tarefa: Tarefa) => void;
  aoSugerirPassos?: (tarefa: Tarefa) => void;
}

/**
 * Quadro em três colunas. Arrastar com mouse, caneta, dedo (segurando um instante) ou teclado;
 * ou usar o menu de cada tarefa.
 */
export function QuadroTarefas({ projetoId, tarefas, executar, aoMover, aoDefinirPrazo, aoSugerirPassos }: Props) {
  const sensores = useSensoresArrastar({ coordinateGetter: pularEntreColunas });
  const [pegando, setPegando] = useState<string | null>(null);
  const titulo = (id: unknown) => tarefas.find((x) => x.id === id)?.titulo ?? "";
  const coluna = (id: unknown) => t.colunas[id as EstadoTarefa] ?? "";
  const pega = tarefas.find((x) => x.id === pegando) ?? null;

  const soltar = ({ active, over }: DragEndEvent) => {
    setPegando(null);
    const tarefa = tarefas.find((x) => x.id === active.id);
    const destino = over?.id as EstadoTarefa | undefined;
    if (!tarefa || !destino || tarefa.estado === destino) return;
    executar(async () => (await api.mudarEstadoTarefa(tarefa.id, destino), aoMover(t.movida(tarefa.titulo, t.colunas[destino]))));
  };

  return (
    <DndContext
      sensors={sensores}
      onDragStart={({ active }) => setPegando(String(active.id))}
      onDragEnd={soltar}
      onDragCancel={() => setPegando(null)}
      accessibility={{
        screenReaderInstructions: { draggable: t.instrucoesArrastar },
        announcements: {
          onDragStart: ({ active }) => `Pegou "${titulo(active.id)}".`,
          onDragOver: ({ active, over }) => (over ? `"${titulo(active.id)}" sobre ${coluna(over.id)}.` : `"${titulo(active.id)}" fora das colunas.`),
          onDragEnd: ({ active, over }) => (over ? `"${titulo(active.id)}" solto em ${coluna(over.id)}.` : `"${titulo(active.id)}" voltou ao lugar.`),
          onDragCancel: ({ active }) => `Movimento cancelado. "${titulo(active.id)}" voltou ao lugar.`,
        },
      }}
    >
      <p className="texto-suave pequeno">{t.arrastar}</p>
      <div className="quadro kanban">
        {ESTADOS.map((e) => (
          <Coluna key={e} estado={e} tarefas={tarefas.filter((x) => x.estado === e)} todas={tarefas} projetoId={projetoId} executar={executar} aoMover={aoMover} aoDefinirPrazo={aoDefinirPrazo} aoSugerirPassos={aoSugerirPassos} />
        ))}
      </div>
      {/* A cópia que acompanha o ponteiro. Sem animação de volta (baixo estímulo). */}
      <DragOverlay dropAnimation={null}>
        {pega && (
          <div className="quadro-cartao kanban-cartao flutuando" aria-hidden="true">
            <span className="kanban-pegador"><GripVertical size="1.1em" /></span>
            <ConteudoCartao tarefa={pega} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Coluna({ estado, tarefas, todas, projetoId, executar, aoMover, aoDefinirPrazo, aoSugerirPassos }: { estado: EstadoTarefa; tarefas: Tarefa[]; todas: Tarefa[] } & Omit<Props, "tarefas">) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });
  return (
    <section ref={setNodeRef} className={isOver ? "quadro-coluna kanban-coluna sobre" : "quadro-coluna kanban-coluna"} aria-labelledby={`coluna-${estado}`}>
      <h3 id={`coluna-${estado}`} className="kanban-coluna-titulo">
        {t.colunas[estado]} <span className="kanban-contagem">{tarefas.length}</span>
      </h3>
      <ul className="quadro-cartoes">
        {tarefas.map((tarefa) => {
          const etapa = todas.find((x) => x.id === tarefa.paiId && x.paiId === projetoId);
          const irmas = todas.filter((x) => x.paiId === tarefa.paiId);
          return (
            <li key={tarefa.id}>
              <CartaoTarefa tarefa={tarefa} etapa={etapa?.titulo} irmas={irmas} executar={executar} aoMover={aoMover} aoDefinirPrazo={aoDefinirPrazo} aoSugerirPassos={etapa ? undefined : aoSugerirPassos} />
            </li>
          );
        })}
      </ul>
      {estado === "a_fazer" && <NovaNoQuadro projetoId={projetoId} executar={executar} />}
    </section>
  );
}

/** Criar uma tarefa direto na coluna "A fazer", sem trocar de visão. */
function NovaNoQuadro({ projetoId, executar }: { projetoId: string; executar: Props["executar"] }) {
  const [titulo, setTitulo] = useState("");
  return (
    <Form className="kanban-nova" onSubmit={(e) => (e.preventDefault(), titulo.trim() && executar(async () => (await api.criarTarefa(projetoId, titulo), setTitulo(""))))}>
      <Campo rotulo={t.novaTarefa} valor={titulo} aoMudar={setTitulo} />
      <Button className="botao" type="submit" isDisabled={!titulo.trim()}>{t.adicionar}</Button>
    </Form>
  );
}

function ConteudoCartao({ tarefa, etapa }: { tarefa: Tarefa; etapa?: string }) {
  return (
    <span className="kanban-texto">
      <span className={tarefa.estado === "feita" ? "quebra feita-texto" : "quebra"}>{tarefa.titulo}</span>
      {etapa && <span className="texto-suave pequeno quebra">{t.deEtapa(etapa)}</span>}
      {(tarefa.peso || tarefa.prazo || tarefa.etiquetas.length > 0) && (
        <span className="etiquetas">
          <EtiquetaPrazo prazo={tarefa.prazo} />
          <EtiquetaPeso peso={tarefa.peso} />
          <EtiquetasTarefa ids={tarefa.etiquetas} />
        </span>
      )}
    </span>
  );
}

function CartaoTarefa({ tarefa, etapa, irmas, executar, aoMover, aoDefinirPrazo, aoSugerirPassos }: { tarefa: Tarefa; etapa?: string; irmas: Tarefa[]; executar: Props["executar"]; aoMover: Props["aoMover"]; aoDefinirPrazo: Props["aoDefinirPrazo"]; aoSugerirPassos?: Props["aoSugerirPassos"] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: tarefa.id });
  return (
    <div className={isDragging ? "quadro-cartao kanban-cartao fantasma" : "quadro-cartao kanban-cartao"}>
      {/* A área que arrasta é o pegador e o texto; o menu fica de fora para Espaço e Enter abrirem o menu. */}
      <div ref={setNodeRef} className="quadro-cartao-alca kanban-alca" {...listeners} {...attributes} aria-roledescription="tarefa arrastável">
        <span className="kanban-pegador" aria-hidden="true"><GripVertical size="1.1em" /></span>
        <ConteudoCartao tarefa={tarefa} etapa={etapa} />
      </div>
      <MenuTarefa tarefa={tarefa} irmas={irmas} executar={executar} aoMover={aoMover} aoDefinirPrazo={aoDefinirPrazo} aoSugerirPassos={aoSugerirPassos} />
    </div>
  );
}
