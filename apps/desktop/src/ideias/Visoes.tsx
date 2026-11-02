import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { FolderPlus, Link2, StickyNote } from "../icones";
import { useRef, type ReactNode } from "react";
import { textoSimples } from "../componentes/textoSimples";
import { Button } from "react-aria-components";
import { api, type Etiqueta, type Ideia } from "../api";
import { useRecado } from "../app/Recado";
import { pularEntreColunas } from "../componentes/tecladoColunas";
import { avisarMudanca } from "../dados";
import { formatoDia } from "../projetos/OndeParei";
import { useSensoresArrastar } from "../projetos/sensores";
import { textos } from "../textos/pt-BR";
import { ChipEtiqueta } from "./etiquetas";

const t = textos.ideias;

export type VisaoIdeias = "lista" | "mural" | "quadro" | "mapa";
export const VISOES_IDEIAS: VisaoIdeias[] = ["lista", "mural", "quadro", "mapa"];

interface Props {
  ideias: Ideia[];
  etiquetas: Etiqueta[];
  aoAbrir: (i: Ideia) => void;
  /** Só a lista mostra o botão; as outras visões fazem isso pela janela da ideia. */
  aoVirarProjeto?: (i: Ideia) => void;
}

const etiquetasDe = (i: Ideia, todas: Etiqueta[]) => i.etiquetas.map((id) => todas.find((e) => e.id === id)).filter((e): e is Etiqueta => !!e);

/** A cor da ideia: a própria, se a pessoa escolheu; senão, a da primeira etiqueta. */
export const corDaIdeia = (i: Ideia, todas: Etiqueta[]) => i.cor ?? etiquetasDe(i, todas)[0]?.cor;

/** Sinais pequenos e escritos: etiquetas, nota e ligações. */
function Detalhes({ ideia, etiquetas }: { ideia: Ideia; etiquetas: Etiqueta[] }) {
  const minhas = etiquetasDe(ideia, etiquetas);
  if (!minhas.length && !ideia.nota && !ideia.ligadas.length) return null;
  return (
    <div className="ideia-detalhes">
      {minhas.map((e) => <ChipEtiqueta key={e.id} etiqueta={e} />)}
      {ideia.nota && <span className="texto-suave pequeno com-icone"><StickyNote aria-hidden="true" size="0.9em" /> {t.temNota}</span>}
      {ideia.ligadas.length > 0 && <span className="texto-suave pequeno com-icone"><Link2 aria-hidden="true" size="0.9em" /> {t.ligadasA(ideia.ligadas.length)}</span>}
    </div>
  );
}

/** Lista compacta: a cor da ideia (a própria ou a da primeira etiqueta) na borda, o texto, os sinais e "virar projeto" num toque. */
export function ListaIdeias({ ideias, etiquetas, aoAbrir, aoVirarProjeto }: Props) {
  return (
    <ul className="lista-cartoes ideias-lista largura-leitura">
      {ideias.map((i) => {
        const cor = corDaIdeia(i, etiquetas);
        return (
          <li key={i.id} className={cor ? `ideia-item borda-${cor}` : "ideia-item"}>
            <Button className="ideia-abrir" onPress={() => aoAbrir(i)} aria-label={t.abrir(i.texto)}>
              <span className="quebra ideia-texto">{i.texto}</span>
              <Detalhes ideia={i} etiquetas={etiquetas} />
              <span className="texto-suave pequeno">{t.guardadaEm(formatoDia.format(i.criadoEm))}</span>
            </Button>
            {aoVirarProjeto && (
              <Button className="botao-icone ideia-virar" onPress={() => aoVirarProjeto(i)} aria-label={t.virarProjetoDe(i.texto)}>
                <FolderPlus aria-hidden="true" size="1.15em" />
                <span className="ideia-virar-texto" aria-hidden="true">{t.virarProjeto}</span>
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Cartões em grade, com o começo da nota: bom para ver tudo de uma vez. */
export function MuralIdeias({ ideias, etiquetas, aoAbrir }: Props) {
  return (
    <ul className="mural">
      {ideias.map((i) => {
        const cor = corDaIdeia(i, etiquetas);
        return (
          <li key={i.id}>
            <Button className={cor ? `cartao mural-cartao borda-${cor}` : "cartao mural-cartao"} onPress={() => aoAbrir(i)} aria-label={t.abrir(i.texto)}>
              <span className="quebra ideia-texto">{i.texto}</span>
              {i.nota && <span className="texto-suave pequeno mural-nota">{textoSimples(i.nota)}</span>}
              <Detalhes ideia={{ ...i, nota: "" }} etiquetas={etiquetas} />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** Grupos por etiqueta (e "Sem etiqueta"). Uma ideia pode estar em mais de um.
 * `todos`: mostra também os vazios (no quadro, para poder soltar neles). */
function grupos(ideias: Ideia[], etiquetas: Etiqueta[], todos = false) {
  const lista = etiquetas
    .map((e) => ({ id: e.id, etiqueta: e as Etiqueta | null, ideias: ideias.filter((i) => i.etiquetas.includes(e.id)) }))
    .filter((g) => todos || g.ideias.length > 0);
  const sem = ideias.filter((i) => !i.etiquetas.some((id) => etiquetas.some((e) => e.id === id)));
  if (sem.length || todos) lista.push({ id: "sem", etiqueta: null, ideias: sem });
  return lista;
}

const SEM = "sem";

export function QuadroIdeias({ ideias, etiquetas, aoAbrir }: Props) {
  // Enter fica para abrir a ideia; Espaço pega e solta. No dedo, segurar um instante antes de arrastar.
  const sensores = useSensoresArrastar({ keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] }, coordinateGetter: pularEntreColunas });
  const recado = useRecado();
  // Depois de arrastar com o mouse, o clique que vem junto não deve abrir a ideia.
  const arrastou = useRef(false);
  const colunas = grupos(ideias, etiquetas, true);
  const nomeColuna = (id: unknown) => (id === SEM ? t.semEtiqueta : etiquetas.find((e) => e.id === id)?.nome ?? "");
  const ideiaDe = (id: unknown) => ideias.find((i) => i.id === String(id).split("|")[1]);

  const soltar = async ({ active, over }: DragEndEvent) => {
    setTimeout(() => (arrastou.current = false), 150);
    const ideia = ideiaDe(active.id);
    const origem = String(active.id).split("|")[0];
    const destino = over?.id as string | undefined;
    if (!ideia || !destino || destino === origem) return;
    // Trocar de coluna = trocar a etiqueta de origem pela de destino. "Sem etiqueta" tira todas.
    const novas = destino === SEM ? [] : [...new Set([...ideia.etiquetas.filter((e) => e !== origem), destino])];
    try {
      await api.definirEtiquetasItem(ideia.id, novas);
      avisarMudanca();
      recado(destino === SEM ? t.semEtiquetaAgora(ideia.texto) : t.movidaPara(ideia.texto, nomeColuna(destino)));
    } catch (e) {
      recado(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <DndContext
      sensors={sensores}
      onDragStart={() => (arrastou.current = true)}
      onDragEnd={soltar}
      onDragCancel={() => (arrastou.current = false)}
      accessibility={{
        screenReaderInstructions: { draggable: t.instrucoesArrastar },
        announcements: {
          onDragStart: ({ active }) => `Pegou "${ideiaDe(active.id)?.texto ?? ""}".`,
          onDragOver: ({ active, over }) => (over ? `"${ideiaDe(active.id)?.texto ?? ""}" sobre ${nomeColuna(over.id)}.` : "Fora das colunas."),
          onDragEnd: ({ active, over }) => (over ? `"${ideiaDe(active.id)?.texto ?? ""}" solta em ${nomeColuna(over.id)}.` : "Voltou ao lugar."),
          onDragCancel: () => "Movimento cancelado.",
        },
      }}
    >
      <p className="texto-suave pequeno">{t.quadroExplicacao}</p>
      <div className="quadro quadro-ideias">
        {colunas.map((g) => (
          <ColunaIdeias key={g.id} id={g.id} titulo={g.etiqueta ? <ChipEtiqueta etiqueta={g.etiqueta} /> : t.semEtiqueta} nome={g.etiqueta?.nome ?? t.semEtiqueta}>
            {g.ideias.map((i) => (
              <li key={i.id}>
                <CartaoIdeia coluna={g.id} ideia={i} aoAbrir={() => !arrastou.current && aoAbrir(i)} />
              </li>
            ))}
          </ColunaIdeias>
        ))}
      </div>
    </DndContext>
  );
}

function ColunaIdeias({ id, titulo, nome, children }: { id: string; titulo: ReactNode; nome: string; children: ReactNode[] }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} className={isOver ? "quadro-coluna sobre" : "quadro-coluna"} aria-label={nome}>
      <h2 className="quadro-coluna-titulo">{titulo} <span className="texto-suave">({children.length})</span></h2>
      <ul className="quadro-cartoes">{children}</ul>
    </section>
  );
}

function CartaoIdeia({ coluna, ideia, aoAbrir }: { coluna: string; ideia: Ideia; aoAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `${coluna}|${ideia.id}` });
  const estilo = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div className={isDragging ? "quadro-cartao ideia-cartao-quadro arrastando" : "quadro-cartao ideia-cartao-quadro"} style={estilo}>
      <div
        ref={setNodeRef}
        className="quadro-cartao-alca"
        {...attributes}
        {...listeners}
        aria-roledescription="ideia arrastável"
        aria-label={t.abrir(ideia.texto)}
        onClick={aoAbrir}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isDragging) return aoAbrir();
          listeners?.onKeyDown?.(e);
        }}
      >
        <span className="quebra">{ideia.texto}</span>
      </div>
    </div>
  );
}

/** Mapa: "Ideias" no centro, etiquetas em volta e as ideias de cada uma. */
export function MapaIdeias({ ideias, etiquetas, aoAbrir }: Props) {
  return (
    <div className="mapa-area">
      <p className="texto-suave pequeno">{t.mapaExplicacao}</p>
      <div className="mapa">
        <ul className="mapa-raiz">
          <li className="mapa-ramo">
            <span className="mapa-no nivel-0">{t.mapaRaiz}</span>
            <ul className="mapa-filhos">
              {grupos(ideias, etiquetas).map((g) => (
                <li key={g.id} className="mapa-ramo">
                  <span className="mapa-no nivel-1">{g.etiqueta ? <ChipEtiqueta etiqueta={g.etiqueta} /> : t.semEtiqueta}</span>
                  <ul className="mapa-filhos">
                    {g.ideias.map((i) => (
                      <li key={i.id} className="mapa-ramo">
                        <Button className="mapa-no" onPress={() => aoAbrir(i)} aria-label={t.abrir(i.texto)}>
                          <span className="quebra">{i.texto}</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
}
