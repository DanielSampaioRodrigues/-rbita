// Vista Lista: tudo um embaixo do outro, agrupado por coluna, com as caixinhas.
import { Button } from "react-aria-components";
import { DndContext, closestCorners, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CartaoOrg, Coluna } from "../api";
import { useRecado } from "../app/Recado";
import { Archive, ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from "../icones";
import { textos } from "../textos/pt-BR";
import { classeCor, estiloCor } from "./cores";
import { CapaCartao, EtiquetasCartao, SinaisCartao } from "./partes";
import { encaixarNaOrdem } from "./regras";
import { NovoCartao, trocar, useSensoresArrastar, type AcoesVista } from "./VistaQuadro";

const t = textos.organizacao;

export function VistaLista({ colunas, cartoes, acoes, aoArquivarFeitos }: { colunas: Coluna[]; cartoes: CartaoOrg[]; acoes: AcoesVista; aoArquivarFeitos: (cs: CartaoOrg[]) => void }) {
  const visiveis = cartoes.filter(acoes.visivel);
  const feitos = visiveis.filter((c) => c.feito);
  // Quadro antigo de lista: uma coluna só, sem nome — sem cabeçalho, como antes.
  const semCabecalho = colunas.length === 1 && !colunas[0].nome;
  return (
    <div className="org-lista largura-leitura">
      {feitos.length > 0 && (
        <div className="linha-ajuste org-lista-topo">
          <Button className="botao pequeno com-icone" onPress={() => aoArquivarFeitos(feitos)}><Archive aria-hidden="true" size="1em" /> {t.lista.arquivarFeitos}</Button>
        </div>
      )}
      {colunas.map((col) => (
        <GrupoLista
          key={col.id}
          coluna={col}
          cartoes={visiveis.filter((c) => c.colunaId === col.id)}
          completa={cartoes.filter((c) => c.colunaId === col.id).map((c) => c.id)}
          semCabecalho={semCabecalho}
          acoes={acoes}
        />
      ))}
      <div>
        <Button className="botao com-icone org-botao-vidro" onPress={acoes.coluna.adicionar}><Plus aria-hidden="true" size="1.1em" /> {t.coluna.adicionar}</Button>
      </div>
    </div>
  );
}

function GrupoLista({ coluna, cartoes, completa, semCabecalho, acoes }: { coluna: Coluna; cartoes: CartaoOrg[]; completa: string[]; semCabecalho: boolean; acoes: AcoesVista }) {
  const recado = useRecado();
  const sensores = useSensoresArrastar(sortableKeyboardCoordinates);
  const ids = cartoes.map((c) => c.id);
  const nome = coluna.nome || t.coluna.semNome;
  const feitos = cartoes.filter((c) => c.feito).length;
  const recolhida = !!coluna.recolhida;
  const reordenar = (novo: string[], id: string) => void acoes.aoPosicionar(id, coluna.id, encaixarNaOrdem(completa, novo, id));
  const mover = (i: number, delta: number) => {
    const novo = trocar(ids, i, delta);
    if (novo) reordenar(novo, ids[i]);
  };
  const soltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const de = ids.indexOf(String(active.id));
    const para = ids.indexOf(String(over.id));
    if (de < 0 || para < 0) return;
    reordenar(arrayMove(ids, de, para), String(active.id));
    const c = cartoes[de];
    if (c) recado(t.arrastar.soltouLista(c.texto, para + 1));
  };
  const cor = coluna.cor ?? "";
  return (
    <section className={"org-grupo" + classeCor(cor)} style={estiloCor(cor)} aria-label={nome}>
      {!semCabecalho && (
        <h2 className="org-grupo-topo">
          <Button className="org-grupo-titulo" onPress={() => acoes.coluna.recolher(coluna, !recolhida)} aria-expanded={!recolhida} aria-label={`${recolhida ? t.coluna.expandir : t.coluna.recolher}: ${nome}`}>
            {recolhida ? <ChevronRight aria-hidden="true" size="1.05em" /> : <ChevronDown aria-hidden="true" size="1.05em" />}
            <span className="quebra">{nome}</span>
          </Button>
          <span className="org-grupo-conta">{t.lista.feitosDe(feitos, cartoes.length)}</span>
        </h2>
      )}
      {!recolhida && (
        <>
          {cartoes.length === 0 ? (
            <p className="texto-suave pequeno org-grupo-vazio">{t.lista.vazia}</p>
          ) : (
            <DndContext
              sensors={sensores}
              collisionDetection={closestCorners}
              onDragEnd={soltar}
              accessibility={{
                screenReaderInstructions: { draggable: t.arrastarInstrucoesLista },
                announcements: {
                  onDragStart: ({ active }) => t.arrastar.pegou(cartoes.find((c) => c.id === active.id)?.texto ?? ""),
                  onDragOver: ({ over }) => (over ? t.arrastar.posicao(ids.indexOf(String(over.id)) + 1) : undefined),
                  onDragEnd: () => undefined,
                  onDragCancel: () => t.arrastar.desistiu,
                },
              }}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ul className="org-itens">
                  {cartoes.map((c, i) => (
                    <ItemLista key={c.id} cartao={c} acoes={acoes} aoSubir={() => mover(i, -1)} aoDescer={() => mover(i, 1)} podeSubir={i > 0} podeDescer={i < cartoes.length - 1} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
          <NovoCartao aoAdicionar={(texto) => acoes.aoAdicionar(coluna.id, texto)} rotulo={semCabecalho ? t.cartao.adicionar : `${t.cartao.adicionar}: ${nome}`} />
        </>
      )}
    </section>
  );
}

function ItemLista({ cartao, acoes, aoSubir, aoDescer, podeSubir, podeDescer }: {
  cartao: CartaoOrg;
  acoes: AcoesVista;
  aoSubir: () => void;
  aoDescer: () => void;
  podeSubir: boolean;
  podeDescer: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: cartao.id });
  const { onKeyDown, ...ponteiro } = listeners ?? {};
  const estilo = { ...estiloCor(cartao.cor), transform: CSS.Translate.toString(transform), transition };
  const temCapa = !!cartao.capa?.tipo;
  return (
    <li ref={setNodeRef} className={"org-item" + classeCor(cartao.cor) + (cartao.feito ? " feito" : "") + (isDragging ? " arrastando" : "")} style={estilo} {...ponteiro}>
      {temCapa && <span className="org-item-capa"><CapaCartao capa={cartao.capa} /></span>}
      <input className="org-item-caixa" type="checkbox" checked={cartao.feito} onChange={(e) => acoes.aoMarcar(cartao, e.target.checked)} aria-label={`${t.cartao.feito}: ${cartao.texto}`} />
      <button type="button" className="org-item-abrir" onClick={() => acoes.aoAbrir(cartao)} aria-label={`${t.cartao.editar}: ${cartao.texto}`}>
        <span className="org-item-titulo quebra">{cartao.texto}</span>
        <EtiquetasCartao ids={cartao.etiquetas} todas={acoes.etiquetas} />
        <SinaisCartao cartao={cartao} agora={acoes.agora} />
      </button>
      <span className="org-item-acoes">
        <span className="org-cartao-teclado">
          <Button className="botao-icone org-icone" onPress={aoSubir} isDisabled={!podeSubir} aria-label={`${t.cartao.subir}: ${cartao.texto}`}><ArrowUp aria-hidden="true" size="1em" /></Button>
          <Button className="botao-icone org-icone" onPress={aoDescer} isDisabled={!podeDescer} aria-label={`${t.cartao.descer}: ${cartao.texto}`}><ArrowDown aria-hidden="true" size="1em" /></Button>
          <Button className="botao-icone org-icone" onPress={() => acoes.aoApagar(cartao)} aria-label={`${t.cartao.excluir}: ${cartao.texto}`}><Trash2 aria-hidden="true" size="1em" /></Button>
        </span>
        <span ref={setActivatorNodeRef} className="org-alca" {...attributes} onKeyDown={onKeyDown as React.KeyboardEventHandler | undefined} aria-roledescription="item arrastável" aria-label={`${t.cartao.mover}: ${cartao.texto}`}>
          <GripVertical aria-hidden="true" size="1em" />
        </span>
      </span>
    </li>
  );
}
