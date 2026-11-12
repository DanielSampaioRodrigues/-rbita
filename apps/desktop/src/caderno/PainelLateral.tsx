// Painel ao lado da folha (como no Goodnotes), com abas: Páginas (miniaturas para ir
// direto a uma página, todas ou só as marcadas), IA, Fontes e Biblioteca. Abre e fecha pela
// barra de cima; o lado (esquerda ou direita) fica nas configurações do caderno.
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "react-aria-components";
import type { PaginaCaderno } from "../api";
import { Segmentado } from "../componentes/Segmentado";
import { Bookmark, GripVertical, Plus, X } from "../icones";
import { textos } from "../textos/pt-BR";

const t = textos.caderno.painel;
const semMovimento = () => document.documentElement.dataset.baixoEstimulo === "true" || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

/** Uma miniatura do painel que dá para arrastar: a miniatura inteira com o mouse,
 *  a caneta ou o dedo (segurando um instante); a alça, pelo teclado. */
function PaginaArrastavel({ id, desligado, rotuloAlca, children }: { id: string; desligado: boolean; rotuloAlca: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: desligado });
  const { onKeyDown, ...doPonteiro } = (listeners ?? {}) as Record<string, (e: unknown) => void>;
  const estilo: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition: semMovimento() ? undefined : transition, zIndex: isDragging ? 5 : undefined, opacity: isDragging ? 0.85 : undefined, position: "relative" };
  return (
    <li ref={setNodeRef} style={estilo} {...(desligado ? {} : doPonteiro)}>
      {children}
      {!desligado && (
        <button type="button" ref={setActivatorNodeRef} className="botao-icone pequeno caderno-painel-alca" aria-label={rotuloAlca} title={rotuloAlca} {...attributes} onKeyDown={onKeyDown}>
          <GripVertical aria-hidden="true" size="1em" />
        </button>
      )}
    </li>
  );
}

export type AbaPainel = "paginas" | "ia" | "fontes" | "biblioteca";

export function PainelLateral({ aba, aoAba, aoFechar, paginas, atualId, miniatura, aoIr, aoMoverPara, aoAdicionar, aoVerGrade, ia, fontes, biblioteca }: {
  aba: AbaPainel;
  aoAba: (a: AbaPainel) => void;
  aoFechar: () => void;
  paginas: PaginaCaderno[];
  atualId: string | null;
  /** Desenha a miniatura de uma página (vem do caderno). */
  miniatura: (p: PaginaCaderno, largura: number) => ReactNode;
  aoIr: (id: string) => void;
  /** Leva a página para a posição `indice` (arrastando). */
  aoMoverPara?: (id: string, indice: number) => void;
  aoAdicionar: () => void;
  aoVerGrade: () => void;
  ia: ReactNode;
  fontes: ReactNode;
  biblioteca: ReactNode;
}) {
  const [filtro, setFiltro] = useState<"todas" | "marcadas">("todas");
  const lista = useRef<HTMLOListElement>(null);
  const mostradas = paginas.map((p, i) => ({ p, n: i + 1 })).filter(({ p }) => filtro === "todas" || p.marcado);
  // A página atual fica sempre à vista na lista.
  useEffect(() => {
    if (aba !== "paginas" || !atualId) return;
    lista.current?.querySelector(`[data-pagina="${atualId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [aba, atualId, filtro]);
  const abas: AbaPainel[] = ["paginas", "ia", "fontes", "biblioteca"];
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const soltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !aoMoverPara) return;
    const para = paginas.findIndex((p) => p.id === over.id);
    if (para >= 0) aoMoverPara(String(active.id), para);
  };
  const arrastavel = !!aoMoverPara && filtro === "todas" && paginas.length > 1;
  return (
    <aside className="caderno-painel" aria-label={t.titulo}>
      <div className="caderno-painel-topo">
        <div className="caderno-painel-abas" role="tablist" aria-label={t.titulo}>
          {abas.map((a) => (
            <button key={a} type="button" role="tab" aria-selected={aba === a} className={aba === a ? "caderno-painel-aba ativa" : "caderno-painel-aba"} onClick={() => aoAba(a)}>{t.abas[a]}</button>
          ))}
        </div>
        <Button className="botao-icone" onPress={aoFechar} aria-label={t.fechar}><X aria-hidden="true" size="1.05em" /></Button>
      </div>
      <div className="caderno-painel-miolo" role="tabpanel" aria-label={t.abas[aba]}>
        {aba === "paginas" && (
          <>
            <div className="caderno-painel-filtro">
              <Segmentado rotulo={t.mostrar} rotuloOculto valor={filtro} aoMudar={(v) => setFiltro(v as "todas" | "marcadas")}
                opcoes={[{ valor: "todas", nome: t.todas }, { valor: "marcadas", nome: t.marcadas }]} />
            </div>
            {filtro === "marcadas" && !mostradas.length && <p className="texto-suave pequeno caderno-painel-vazio">{t.nenhumaMarcada}</p>}
            <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltar}
              accessibility={{ screenReaderInstructions: { draggable: textos.caderno.visao.arrastarInstrucoes } }}>
            <SortableContext items={mostradas.map(({ p }) => p.id)} strategy={verticalListSortingStrategy}>
            <ol className="caderno-painel-paginas" ref={lista}>
              {mostradas.map(({ p, n }) => (
                <PaginaArrastavel key={p.id} id={p.id} desligado={!arrastavel} rotuloAlca={t.arrastar(n, p.titulo)}>
                  <button type="button" data-pagina={p.id} className={p.id === atualId ? "caderno-painel-pagina atual" : "caderno-painel-pagina"}
                    aria-current={p.id === atualId ? "page" : undefined} aria-label={t.irPara(n, p.titulo)} onClick={() => aoIr(p.id)}>
                    {miniatura(p, 150)}
                    <span className="caderno-painel-numero">{p.marcado && <Bookmark aria-hidden="true" size="0.85em" />}{n}</span>
                  </button>
                </PaginaArrastavel>
              ))}
            </ol>
            </SortableContext>
            </DndContext>
            <div className="caderno-painel-acoes">
              <Button className="botao pequeno com-icone" onPress={aoAdicionar}><Plus aria-hidden="true" size="1em" /> {t.adicionar}</Button>
              <Button className="botao pequeno" onPress={aoVerGrade}>{t.verGrade}</Button>
            </div>
          </>
        )}
        {aba === "ia" && ia}
        {aba === "fontes" && fontes}
        {aba === "biblioteca" && biblioteca}
      </div>
    </aside>
  );
}
