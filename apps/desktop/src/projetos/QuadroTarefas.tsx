import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { api, type EstadoTarefa, type Tarefa } from "../api";
import { textos } from "../textos/pt-BR";
import { ESTADOS, EtiquetaPeso, EtiquetasTarefa, MenuTarefa } from "./acoesTarefa";
import { EtiquetaPrazo } from "./prazos";

const t = textos.projeto;

interface Props {
  projetoId: string;
  tarefas: Tarefa[];
  executar: (acao: () => Promise<unknown>) => void;
  aoMover: (texto: string) => void;
  aoDefinirPrazo: (tarefa: Tarefa) => void;
  aoSugerirPassos?: (tarefa: Tarefa) => void;
}

/** Quadro em três colunas. Arrastar com mouse, caneta ou teclado; ou usar o menu de cada tarefa. */
export function QuadroTarefas({ projetoId, tarefas, executar, aoMover, aoDefinirPrazo, aoSugerirPassos }: Props) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const titulo = (id: unknown) => tarefas.find((x) => x.id === id)?.titulo ?? "";
  const coluna = (id: unknown) => t.colunas[id as EstadoTarefa] ?? "";

  const soltar = ({ active, over }: DragEndEvent) => {
    const tarefa = tarefas.find((x) => x.id === active.id);
    const destino = over?.id as EstadoTarefa | undefined;
    if (!tarefa || !destino || tarefa.estado === destino) return;
    executar(async () => (await api.mudarEstadoTarefa(tarefa.id, destino), aoMover(t.movida(tarefa.titulo, t.colunas[destino]))));
  };

  return (
    <DndContext
      sensors={sensores}
      onDragEnd={soltar}
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
      <div className="quadro">
        {ESTADOS.map((e) => (
          <Coluna key={e} estado={e} tarefas={tarefas.filter((x) => x.estado === e)} todas={tarefas} projetoId={projetoId} executar={executar} aoMover={aoMover} aoDefinirPrazo={aoDefinirPrazo} aoSugerirPassos={aoSugerirPassos} />
        ))}
      </div>
    </DndContext>
  );
}

function Coluna({ estado, tarefas, todas, projetoId, executar, aoMover, aoDefinirPrazo, aoSugerirPassos }: { estado: EstadoTarefa; tarefas: Tarefa[]; todas: Tarefa[] } & Omit<Props, "tarefas">) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });
  return (
    <section ref={setNodeRef} className={isOver ? "quadro-coluna sobre" : "quadro-coluna"} aria-labelledby={`coluna-${estado}`}>
      <h3 id={`coluna-${estado}`}>
        {t.colunas[estado]} <span className="texto-suave">({tarefas.length})</span>
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
    </section>
  );
}

function CartaoTarefa({ tarefa, etapa, irmas, executar, aoMover, aoDefinirPrazo, aoSugerirPassos }: { tarefa: Tarefa; etapa?: string; irmas: Tarefa[]; executar: Props["executar"]; aoMover: Props["aoMover"]; aoDefinirPrazo: Props["aoDefinirPrazo"]; aoSugerirPassos?: Props["aoSugerirPassos"] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tarefa.id });
  const estilo = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div className={isDragging ? "quadro-cartao arrastando" : "quadro-cartao"} style={estilo}>
      <div ref={setNodeRef} className="quadro-cartao-alca" {...listeners} {...attributes} aria-roledescription="tarefa arrastável">
        <span className="quebra">{tarefa.titulo}</span>
        {etapa && <span className="texto-suave pequeno quebra">{t.deEtapa(etapa)}</span>}
        {(tarefa.peso || tarefa.prazo || tarefa.etiquetas.length > 0) && (
          <span className="etiquetas">
            <EtiquetaPrazo prazo={tarefa.prazo} />
            <EtiquetaPeso peso={tarefa.peso} />
            <EtiquetasTarefa ids={tarefa.etiquetas} />
          </span>
        )}
      </div>
      <MenuTarefa tarefa={tarefa} irmas={irmas} executar={executar} aoMover={aoMover} aoDefinirPrazo={aoDefinirPrazo} aoSugerirPassos={aoSugerirPassos} />
    </div>
  );
}
