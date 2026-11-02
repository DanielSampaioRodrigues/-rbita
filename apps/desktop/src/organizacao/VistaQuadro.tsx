// Vista Quadro: colunas lado a lado, cartões que se arrastam (mouse, caneta, dedo e teclado).
import { useCallback, useMemo, useRef, useState } from "react";
import { Button, Form, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DroppableContainer,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CartaoOrg, Coluna, EtiquetaOrg } from "../api";
import { useRecado } from "../app/Recado";
import { pularEntreColunas } from "../componentes/tecladoColunas";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, GripVertical, MoreHorizontal, Plus, Trash2 } from "../icones";
import { textos } from "../textos/pt-BR";
import { classeCor, estiloCor } from "./cores";
import { CapaCartao, EtiquetasCartao, SinaisCartao } from "./partes";
import { encaixarNaOrdem } from "./regras";

const t = textos.organizacao;

/** O que as vistas recebem do quadro aberto. */
export interface AcoesVista {
  etiquetas: EtiquetaOrg[];
  agora: Date;
  /** O cartão aparece (não arquivado e passa no filtro)? */
  visivel: (c: CartaoOrg) => boolean;
  aoAdicionar: (colunaId: string, texto: string) => Promise<void>;
  aoMarcar: (c: CartaoOrg, feito: boolean) => void;
  aoAbrir: (c: CartaoOrg) => void;
  aoApagar: (c: CartaoOrg) => void;
  /** `ids`: a ordem completa final da coluna `colunaId` (inclusive cartões escondidos). */
  aoPosicionar: (id: string, colunaId: string, ids: string[]) => Promise<void>;
  coluna: {
    renomear: (col: Coluna, nome: string) => void;
    mover: (col: Coluna, delta: number) => void;
    pintar: (col: Coluna) => void;
    recolher: (col: Coluna, recolhida: boolean) => void;
    arquivar: (col: Coluna) => void;
    excluir: (col: Coluna) => void;
    adicionar: () => void;
  };
}

/** Arrastar: mouse e caneta começam após 6 px; no toque, segurar um instante (não briga com a rolagem). */
export function useSensoresArrastar(teclado: KeyboardCoordinateGetter) {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] }, coordinateGetter: teclado }),
  );
}

/** Os mesmos alvos do dnd-kit, mas só os que passam no filtro (para o teclado não pular para onde não deve). */
function soAlvos(alvos: { getEnabled(): DroppableContainer[] }, aceita: (c: DroppableContainer) => boolean) {
  return new Proxy(alvos, {
    get(obj, chave) {
      if (chave === "getEnabled") return () => obj.getEnabled().filter(aceita);
      const v = Reflect.get(obj, chave, obj);
      return typeof v === "function" ? v.bind(obj) : v;
    },
  });
}

/** Troca dois vizinhos de lugar (botões de subir/descer, a alternativa ao arrastar). */
export function trocar(ids: string[], i: number, delta: number): string[] | null {
  const j = i + delta;
  if (j < 0 || j >= ids.length) return null;
  const novo = [...ids];
  [novo[i], novo[j]] = [novo[j], novo[i]];
  return novo;
}

type Grupos = Record<string, string[]>;

export function VistaQuadro({ colunas, cartoes, acoes }: { colunas: Coluna[]; cartoes: CartaoOrg[]; acoes: AcoesVista }) {
  const recado = useRecado();
  const arrastou = useRef(false);
  // Durante o arrasto, a ordem fica num rascunho; ao soltar, é guardada.
  const [rascunho, setRascunhoEstado] = useState<{ id: string; origem: string; grupos: Grupos } | null>(null);
  const rascunhoRef = useRef(rascunho);
  const setRascunho = (r: typeof rascunho) => { rascunhoRef.current = r; setRascunhoEstado(r); };

  const idsColunas = useMemo(() => new Set(colunas.map((c) => c.id)), [colunas]);
  // Todos os cartões de cada coluna (para guardar a ordem completa) e só os visíveis (para mostrar).
  const todos = useMemo(() => {
    const g: Grupos = Object.fromEntries(colunas.map((c) => [c.id, [] as string[]]));
    for (const c of cartoes) g[c.colunaId]?.push(c.id);
    return g;
  }, [colunas, cartoes]);
  const guardados = useMemo(() => {
    const g: Grupos = Object.fromEntries(colunas.map((c) => [c.id, [] as string[]]));
    for (const c of cartoes) if (acoes.visivel(c)) g[c.colunaId]?.push(c.id);
    return g;
  }, [colunas, cartoes, acoes]);
  const grupos = rascunho?.grupos ?? guardados;
  const porId = useMemo(() => new Map(cartoes.map((c) => [c.id, c])), [cartoes]);
  const nomeColuna = (id: string) => colunas.find((c) => c.id === id)?.nome || t.coluna.semNome;
  const colunaDe = (g: Grupos, id: UniqueIdentifier): string | undefined => {
    const s = String(id);
    if (idsColunas.has(s)) return s;
    return Object.keys(g).find((k) => g[k].includes(s));
  };

  // Teclado: para cima/baixo anda dentro da coluna; para os lados pula de coluna.
  const teclado: KeyboardCoordinateGetter = useCallback(
    (evento, args) => {
      const ativo = args.active ? String(args.active) : "";
      if (evento.code === "ArrowLeft" || evento.code === "ArrowRight") {
        return pularEntreColunas(evento, { ...args, context: { ...args.context, droppableContainers: soAlvos(args.context.droppableContainers, (c) => idsColunas.has(String(c.id))) as typeof args.context.droppableContainers } });
      }
      const atual = Object.keys(grupos).find((k) => grupos[k].includes(ativo));
      return sortableKeyboardCoordinates(evento, { ...args, context: { ...args.context, droppableContainers: soAlvos(args.context.droppableContainers, (c) => !!atual && grupos[atual].includes(String(c.id))) as typeof args.context.droppableContainers } });
    },
    [grupos, idsColunas],
  );
  const sensores = useSensoresArrastar(teclado);

  // Com o ponteiro: prefere o cartão sob o dedo/mouse; senão, a coluna; sem ponteiro (teclado), o mais próximo.
  const colisao: CollisionDetection = useCallback(
    (args) => {
      const sob = pointerWithin(args);
      if (sob.length) return [sob.find((c) => !idsColunas.has(String(c.id))) ?? sob[0]];
      return closestCorners(args);
    },
    [idsColunas],
  );

  const comecar = ({ active }: DragStartEvent) => {
    arrastou.current = true;
    setRascunho({ id: String(active.id), origem: colunaDe(guardados, active.id) ?? "", grupos: guardados });
  };

  // Passando sobre outra coluna: o cartão já aparece lá, no lugar onde vai cair.
  const passar = ({ active, over }: DragOverEvent) => {
    const r = rascunhoRef.current;
    if (!over || !r) return;
    const de = colunaDe(r.grupos, active.id);
    const para = colunaDe(r.grupos, over.id);
    if (!de || !para || de === para) return;
    const id = String(active.id);
    const destino = r.grupos[para].filter((x) => x !== id);
    const i = destino.indexOf(String(over.id));
    destino.splice(i < 0 ? destino.length : i, 0, id);
    setRascunho({ ...r, grupos: { ...r.grupos, [de]: r.grupos[de].filter((x) => x !== id), [para]: destino } });
  };

  const soltar = async ({ active, over }: DragEndEvent) => {
    setTimeout(() => (arrastou.current = false), 150);
    const r = rascunhoRef.current;
    setRascunho(null);
    if (!r || !over) return;
    const id = String(active.id);
    const coluna = colunaDe(r.grupos, id);
    if (!coluna) return;
    let ids = r.grupos[coluna];
    const alvo = ids.indexOf(String(over.id));
    const daqui = ids.indexOf(id);
    if (alvo >= 0 && alvo !== daqui) ids = arrayMove(ids, daqui, alvo);
    if (coluna === r.origem && ids.join() === guardados[coluna]?.join()) return;
    await acoes.aoPosicionar(id, coluna, encaixarNaOrdem(todos[coluna] ?? [], ids, id));
    const cartao = porId.get(id);
    if (cartao) recado(t.arrastar.soltou(cartao.texto, nomeColuna(coluna), ids.indexOf(id) + 1));
  };

  const desistir = () => {
    arrastou.current = false;
    setRascunho(null);
  };

  const anuncios: Announcements = {
    onDragStart: ({ active }) => t.arrastar.pegou(porId.get(String(active.id))?.texto ?? ""),
    onDragOver: ({ active, over }) => {
      if (!over || !rascunho) return undefined;
      const col = colunaDe(rascunho.grupos, active.id);
      return col ? t.arrastar.sobre(nomeColuna(col), rascunho.grupos[col].indexOf(String(active.id)) + 1) : undefined;
    },
    onDragEnd: ({ active }) => {
      const c = porId.get(String(active.id));
      return c ? t.arrastar.largou(c.texto) : undefined;
    },
    onDragCancel: () => t.arrastar.desistiu,
  };

  const emArrasto = rascunho ? porId.get(rascunho.id) : undefined;

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={colisao}
      onDragStart={comecar}
      onDragOver={passar}
      onDragEnd={(e) => void soltar(e)}
      onDragCancel={desistir}
      accessibility={{ screenReaderInstructions: { draggable: t.arrastarInstrucoes }, announcements: anuncios }}
    >
      <div className="org-quadro">
        {colunas.map((col, i) => {
          const visiveis = (grupos[col.id] ?? []).map((id) => porId.get(id)).filter((c): c is CartaoOrg => !!c);
          return col.recolhida ? (
            <ColunaRecolhida key={col.id} coluna={col} total={visiveis.length} acoes={acoes} />
          ) : (
            <ColunaQuadro
              key={col.id}
              coluna={col}
              primeira={i === 0}
              ultima={i === colunas.length - 1}
              cartoes={visiveis}
              completa={todos[col.id] ?? []}
              arrastou={arrastou}
              acoes={acoes}
            />
          );
        })}
        <div className="org-coluna-nova">
          <Button className="botao com-icone org-botao-vidro" onPress={acoes.coluna.adicionar}><Plus aria-hidden="true" size="1.1em" /> {t.coluna.adicionar}</Button>
        </div>
      </div>
      {/* Sem animação ao soltar: o cartão vai direto para o lugar. */}
      <DragOverlay dropAnimation={null}>{emArrasto ? <CartaoVisual cartao={emArrasto} etiquetas={acoes.etiquetas} agora={acoes.agora} /> : null}</DragOverlay>
    </DndContext>
  );
}

/** Coluna recolhida: uma faixa fina com o nome e quantos cartões tem. Ainda recebe cartões arrastados. */
function ColunaRecolhida({ coluna, total, acoes }: { coluna: Coluna; total: number; acoes: AcoesVista }) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const nome = coluna.nome || t.coluna.semNome;
  const cor = coluna.cor ?? "";
  return (
    <section ref={setNodeRef} className={"org-coluna recolhida" + classeCor(cor) + (isOver ? " sobre" : "")} style={estiloCor(cor)} aria-label={nome}>
      <Button className="org-recolhida-botao" onPress={() => acoes.coluna.recolher(coluna, false)} aria-label={`${t.coluna.expandir}: ${nome} (${t.coluna.conta(total)})`}>
        <ChevronRight aria-hidden="true" size="1.1em" />
        <span className="org-recolhida-nome quebra" aria-hidden="true">{nome}</span>
        <span className="org-coluna-conta" aria-hidden="true">{total}</span>
      </Button>
    </section>
  );
}

function ColunaQuadro({ coluna, cartoes, completa, primeira, ultima, arrastou, acoes }: {
  coluna: Coluna;
  cartoes: CartaoOrg[];
  completa: string[];
  primeira: boolean;
  ultima: boolean;
  arrastou: React.MutableRefObject<boolean>;
  acoes: AcoesVista;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(coluna.nome);
  const confirmar = () => { setEditando(false); acoes.coluna.renomear(coluna, nome); };
  const ids = cartoes.map((c) => c.id);
  const mover = (i: number, delta: number) => {
    const novo = trocar(ids, i, delta);
    if (novo) void acoes.aoPosicionar(ids[i], coluna.id, encaixarNaOrdem(completa, novo, ids[i]));
  };
  const nomeVisivel = coluna.nome || t.coluna.semNome;
  const cor = coluna.cor ?? "";
  const menu = (k: React.Key) => {
    if (k === "recolher") acoes.coluna.recolher(coluna, true);
    else if (k === "cor") acoes.coluna.pintar(coluna);
    else if (k === "arquivar") acoes.coluna.arquivar(coluna);
    else if (k === "apagar") acoes.coluna.excluir(coluna);
  };
  return (
    <section ref={setNodeRef} className={"org-coluna" + classeCor(cor) + (isOver ? " sobre" : "")} style={estiloCor(cor)} aria-label={nomeVisivel}>
      <div className="org-coluna-topo">
        {editando ? (
          <input
            className="entrada-texto sozinha org-coluna-editar"
            value={nome}
            autoFocus
            onChange={(e) => setNome(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); confirmar(); }
              else if (e.key === "Escape") { e.stopPropagation(); setNome(coluna.nome); setEditando(false); }
            }}
            aria-label={t.coluna.nome}
            maxLength={60}
          />
        ) : (
          <button type="button" className="org-coluna-titulo quebra" onClick={() => { setNome(coluna.nome); setEditando(true); }} aria-label={`${t.coluna.renomear}: ${nomeVisivel}`}>
            <span className="quebra">{nomeVisivel}</span> <span className="org-coluna-conta">{cartoes.length}</span>
          </button>
        )}
        <span className="org-coluna-acoes">
          <Button className="botao-icone org-icone" onPress={() => acoes.coluna.mover(coluna, -1)} isDisabled={primeira} aria-label={`${t.coluna.esquerda}: ${nomeVisivel}`}><ArrowLeft aria-hidden="true" size="1em" /></Button>
          <Button className="botao-icone org-icone" onPress={() => acoes.coluna.mover(coluna, 1)} isDisabled={ultima} aria-label={`${t.coluna.direita}: ${nomeVisivel}`}><ArrowRight aria-hidden="true" size="1em" /></Button>
          <MenuTrigger>
            <Button className="botao-icone org-icone" aria-label={`${t.coluna.mais}: ${nomeVisivel}`}><MoreHorizontal aria-hidden="true" size="1.05em" /></Button>
            <Popover className="menu-popover org-menu" placement="bottom end">
              <Menu className="menu" aria-label={`${t.coluna.mais}: ${nomeVisivel}`} onAction={menu}>
                <MenuItem id="recolher" className="menu-item">{t.coluna.recolher}</MenuItem>
                <MenuItem id="cor" className="menu-item">{t.coluna.cor}</MenuItem>
                <MenuItem id="arquivar" className="menu-item">{t.coluna.arquivar}</MenuItem>
                <MenuItem id="apagar" className="menu-item">{t.coluna.excluir}</MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </span>
      </div>
      <SortableContext id={coluna.id} items={ids} strategy={verticalListSortingStrategy}>
        <ul className="org-cartoes">
          {cartoes.map((c, i) => (
            <li key={c.id}>
              <CartaoArrastavel
                cartao={c}
                arrastou={arrastou}
                acoes={acoes}
                aoSubir={() => mover(i, -1)}
                aoDescer={() => mover(i, 1)}
                podeSubir={i > 0}
                podeDescer={i < cartoes.length - 1}
              />
            </li>
          ))}
        </ul>
      </SortableContext>
      <NovoCartao aoAdicionar={(texto) => acoes.aoAdicionar(coluna.id, texto)} />
    </section>
  );
}

/** O cartão como aparece (também usado na cópia que segue o dedo durante o arrasto). */
function CartaoVisual({ cartao, etiquetas, agora }: { cartao: CartaoOrg; etiquetas: EtiquetaOrg[]; agora: Date }) {
  return (
    <div className={"org-cartao flutuando" + classeCor(cartao.cor) + (cartao.feito ? " feito" : "")} style={estiloCor(cartao.cor)}>
      <CapaCartao capa={cartao.capa} />
      <div className="org-cartao-corpo">
        <EtiquetasCartao ids={cartao.etiquetas} todas={etiquetas} />
        <div className="org-cartao-topo">
          <input type="checkbox" checked={cartao.feito} readOnly tabIndex={-1} aria-hidden="true" />
          <span className="org-cartao-texto quebra"><span className="org-cartao-titulo">{cartao.texto}</span></span>
          <span className="org-alca" aria-hidden="true"><GripVertical size="1em" /></span>
        </div>
        <SinaisCartao cartao={cartao} agora={agora} />
      </div>
    </div>
  );
}

function CartaoArrastavel({ cartao, arrastou, acoes, aoSubir, aoDescer, podeSubir, podeDescer }: {
  cartao: CartaoOrg;
  arrastou: React.MutableRefObject<boolean>;
  acoes: AcoesVista;
  aoSubir: () => void;
  aoDescer: () => void;
  podeSubir: boolean;
  podeDescer: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: cartao.id });
  // Mouse, caneta e dedo pegam o cartão em qualquer ponto; o teclado usa a alça (espaço).
  const { onKeyDown, ...ponteiro } = listeners ?? {};
  const estilo = { ...estiloCor(cartao.cor), transform: CSS.Translate.toString(transform), transition };
  const evitarCliqueAposArrastar = (e: React.MouseEvent) => { if (arrastou.current) e.preventDefault(); };

  return (
    <div
      ref={setNodeRef}
      className={"org-cartao" + classeCor(cartao.cor) + (cartao.feito ? " feito" : "") + (isDragging ? " fantasma" : "")}
      style={estilo}
      {...ponteiro}
    >
      <CapaCartao capa={cartao.capa} />
      <div className="org-cartao-corpo">
        <EtiquetasCartao ids={cartao.etiquetas} todas={acoes.etiquetas} />
        <div className="org-cartao-topo">
          <input type="checkbox" checked={cartao.feito} onChange={(e) => acoes.aoMarcar(cartao, e.target.checked)} aria-label={`${t.cartao.feito}: ${cartao.texto}`} />
          <button type="button" className="org-cartao-texto quebra" onClick={(e) => { if (arrastou.current) { e.preventDefault(); return; } acoes.aoAbrir(cartao); }} aria-label={`${t.cartao.editar}: ${cartao.texto}`}>
            <span className="org-cartao-titulo">{cartao.texto}</span>
          </button>
          <span
            ref={setActivatorNodeRef}
            className="org-alca"
            {...attributes}
            onKeyDown={onKeyDown as React.KeyboardEventHandler | undefined}
            aria-roledescription="cartão arrastável"
            aria-label={`${t.cartao.mover}: ${cartao.texto}`}
            onClick={evitarCliqueAposArrastar}
          >
            <GripVertical aria-hidden="true" size="1em" />
          </span>
        </div>
        <SinaisCartao cartao={cartao} agora={acoes.agora} />
      </div>
      {/* Alternativa ao arrastar: aparece quando se chega aqui pelo teclado. */}
      <div className="org-cartao-teclado">
        <Button className="botao-icone org-icone" onPress={aoSubir} isDisabled={!podeSubir} aria-label={`${t.cartao.subir}: ${cartao.texto}`}><ArrowUp aria-hidden="true" size="1em" /></Button>
        <Button className="botao-icone org-icone" onPress={aoDescer} isDisabled={!podeDescer} aria-label={`${t.cartao.descer}: ${cartao.texto}`}><ArrowDown aria-hidden="true" size="1em" /></Button>
        <Button className="botao-icone org-icone" onPress={() => acoes.aoApagar(cartao)} aria-label={`${t.cartao.excluir}: ${cartao.texto}`}><Trash2 aria-hidden="true" size="1em" /></Button>
      </div>
    </div>
  );
}

export function NovoCartao({ aoAdicionar, dica = t.cartao.novo, rotulo = t.cartao.adicionar }: { aoAdicionar: (texto: string) => Promise<void>; dica?: string; rotulo?: string }) {
  const [texto, setTexto] = useState("");
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = texto.trim();
    if (!v) return;
    setTexto("");
    await aoAdicionar(v);
  };
  return (
    <Form className="org-novo-cartao" onSubmit={enviar}>
      <Plus aria-hidden="true" size="1em" className="org-novo-icone" />
      <input className="entrada-texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={dica} aria-label={rotulo} />
    </Form>
  );
}
