import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Form, Label, Radio, RadioGroup } from "react-aria-components";
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
import { api, type Coluna, type CartaoOrg, type Quadro } from "../api";
import { useRecado } from "../app/Recado";
import { pularEntreColunas } from "../componentes/tecladoColunas";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronLeft, GripVertical, LayoutGrid, ListChecks, Palette, Pencil, Plus, Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { CORES_ORG, classeCor, estiloCor } from "./cores";

const t = textos.organizacao;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Arrastar: mouse e caneta começam após 6 px; no toque, segurar um instante (não briga com a rolagem). */
function useSensoresArrastar(teclado: KeyboardCoordinateGetter) {
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

// ---------- Página principal ----------

export function PaginaOrganizacao() {
  const [quadros, setQuadros] = useState<Quadro[]>([]);
  const [editando, setEditando] = useState<Quadro | null>(null);
  const [excluindo, setExcluindo] = useState<Quadro | null>(null);
  const [aberto, setAberto] = useState<Quadro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarQuadros().then(setQuadros, (e) => setErro(mensagem(e)));
  }, [mudancas]);

  const excluir = async () => {
    if (!excluindo) return;
    await api.excluirQuadro(excluindo.id);
    setExcluindo(null);
    avisarMudanca();
  };

  const abertoAtual = aberto ? quadros.find((q) => q.id === aberto.id) ?? aberto : null;
  if (abertoAtual) return <QuadroAberto quadro={abertoAtual} aoFechar={() => setAberto(null)} />;

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <div className="botoes">
        <Button className="botao principal" onPress={() => setEditando({ id: "", nome: "", estilo: "lista", criadoEm: 0, cor: "" })}>
          <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
        </Button>
      </div>

      {quadros.length === 0 ? (
        <section className="cartao largura-leitura esticado"><p className="texto-suave">{t.vazio}</p></section>
      ) : (
        <ul className="org-paineis">
          {quadros.map((q) => (
            <li key={q.id} className={"org-painel" + classeCor(q.cor ?? "")} style={estiloCor(q.cor ?? "")}>
              <button type="button" className="org-painel-abrir" onClick={() => setAberto(q)} aria-label={`${t.abrir}: ${q.nome} (${t.selo[q.estilo]})`}>
                <span className="org-painel-icone" aria-hidden="true">
                  {q.estilo === "quadro" ? <LayoutGrid size="1.15em" /> : <ListChecks size="1.15em" />}
                </span>
                <span className="org-painel-nome quebra">{q.nome}</span>
                <span className="org-painel-tipo">{t.selo[q.estilo]}</span>
              </button>
              <span className="org-painel-acoes">
                <Button className="botao-icone org-icone" onPress={() => setEditando(q)} aria-label={`${t.editar}: ${q.nome}`}><Pencil aria-hidden="true" size="1em" /></Button>
                <Button className="botao-icone org-icone" onPress={() => setExcluindo(q)} aria-label={`${t.excluir}: ${q.nome}`}><Trash2 aria-hidden="true" size="1em" /></Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Aviso>{erro}</Aviso>

      <Janela titulo={editando && editando.id ? t.form.editarTitulo : t.form.novo} aberta={editando !== null} aoFechar={() => setEditando(null)}>
        {editando && <FormQuadro key={editando.id || "novo"} inicial={editando} aoFechar={() => setEditando(null)} />}
      </Janela>

      <Confirmar titulo={t.excluir} texto={excluindo ? t.confirmarExcluir(excluindo.nome) : ""} confirmar={t.excluir} aberta={excluindo !== null} aoCancelar={() => setExcluindo(null)} aoConfirmar={() => void excluir()} />
    </div>
  );
}

function FormQuadro({ inicial, aoFechar }: { inicial: Quadro; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [estilo, setEstilo] = useState<Quadro["estilo"]>(inicial.estilo);
  const [cor, setCor] = useState(inicial.cor ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarQuadro({ ...inicial, nome, estilo, cor });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(mensagem(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.form.nome} valor={nome} aoMudar={setNome} autoFocus maximo={80} semDitado />
      {!editando && (
        <>
          <Segmentado
            rotulo={t.estilo}
            valor={estilo}
            aoMudar={(v) => setEstilo(v as Quadro["estilo"])}
            opcoes={[
              { valor: "lista", nome: t.estilos.lista },
              { valor: "quadro", nome: t.estilos.quadro },
            ]}
          />
          <p className="campo-ajuda">{t.estiloAjuda[estilo]}</p>
        </>
      )}
      <EscolherCor rotulo={t.cor} valor={cor} aoMudar={setCor} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.form.salvarMudancas : t.form.salvar}</Button>
      </div>
    </Form>
  );
}

/** Escolha de cor com amostras que já mostram o fundo e o texto como vão ficar. */
function EscolherCor({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (c: string) => void }) {
  return (
    <RadioGroup className="campo" value={valor} onChange={aoMudar} orientation="horizontal">
      <Label className="campo-rotulo">{rotulo}</Label>
      <div className="org-cores">
        <Radio value="" className="org-cor-opcao" aria-label={t.semCor}>
          <span className="org-amostra org-amostra-vazia" aria-hidden="true">{t.amostra}</span>
          <span className="org-cor-nome">{t.semCor}</span>
        </Radio>
        {CORES_ORG.map((c) => (
          <Radio key={c} value={c} className="org-cor-opcao" aria-label={t.cores[c]}>
            <span className={"org-amostra" + classeCor(c)} style={estiloCor(c)} aria-hidden="true">{t.amostra}</span>
            <span className="org-cor-nome">{t.cores[c]}</span>
          </Radio>
        ))}
      </div>
      <p className="campo-ajuda">{t.corAjuda}</p>
    </RadioGroup>
  );
}

// ---------- Quadro ou lista aberta ----------

function QuadroAberto({ quadro, aoFechar }: { quadro: Quadro; aoFechar: () => void }) {
  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [cartoes, setCartoes] = useState<CartaoOrg[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [cols, cards] = await Promise.all([api.listarColunas(quadro.id), api.listarCartoesOrg(quadro.id)]);
      setColunas(cols);
      setCartoes(cards);
    } catch (e) {
      setErro(mensagem(e));
    }
  }, [quadro.id]);
  useEffect(() => void carregar(), [carregar]);

  const [editandoCartao, setEditandoCartao] = useState<CartaoOrg | null>(null);

  const adicionarCartao = async (colunaId: string, texto: string) => {
    await api.salvarCartaoOrg({ id: "", colunaId, texto, feito: false, cor: "", prazo: "", ordem: 0, criadoEm: 0 });
    await carregar();
  };
  const marcar = async (c: CartaoOrg, feito: boolean) => {
    setCartoes((cs) => cs.map((x) => (x.id === c.id ? { ...x, feito } : x)));
    await api.marcarCartaoOrg(c.id, feito);
  };
  const salvarCartao = async (c: CartaoOrg) => {
    await api.salvarCartaoOrg(c);
    setEditandoCartao(null);
    await carregar();
  };
  const apagarCartao = async (c: CartaoOrg) => {
    await api.excluirCartaoOrg(c.id);
    setEditandoCartao(null);
    await carregar();
  };
  /**
   * Guarda a nova posição: `id` passa para a coluna `colunaId`, e `ids` é a ordem final dessa coluna.
   * A tela muda na hora; se o banco recusar, volta ao que está guardado.
   */
  const posicionar = async (id: string, colunaId: string, ids: string[]) => {
    const antes = cartoes.find((c) => c.id === id);
    const posicao = new Map(ids.map((x, i) => [x, i + 1]));
    setCartoes((cs) =>
      cs.map((c) => (c.id === id ? { ...c, colunaId } : c)).map((c) => (posicao.has(c.id) ? { ...c, ordem: posicao.get(c.id)! } : c)).sort((a, b) => a.ordem - b.ordem),
    );
    try {
      if (antes && antes.colunaId !== colunaId) await api.moverCartaoOrg(id, colunaId, posicao.get(id) ?? 1);
      await api.reordenarCartoesOrg(ids);
    } catch (e) {
      setErro(mensagem(e));
      await carregar();
    }
  };

  return (
    <div className="org-tela">
      <div className="leitor-barra">
        <Button className="botao-icone" onPress={aoFechar} aria-label={t.voltar}><ChevronLeft aria-hidden="true" size="1.2em" /></Button>
        <strong className="leitor-titulo quebra">
          {quadro.estilo === "quadro" ? <LayoutGrid aria-hidden="true" size="1em" /> : <ListChecks aria-hidden="true" size="1em" />} {quadro.nome}
        </strong>
      </div>

      {erro && <div className="leitor-aviso"><Aviso>{erro}</Aviso></div>}

      <div className="org-corpo">
        {quadro.estilo === "quadro" ? (
          <VisaoQuadro quadro={quadro} colunas={colunas} cartoes={cartoes} aoRecarregar={carregar} aoAdicionar={adicionarCartao} aoMarcar={marcar} aoEditar={setEditandoCartao} aoApagar={apagarCartao} aoPosicionar={posicionar} aoErro={setErro} />
        ) : (
          <VisaoLista coluna={colunas[0]} cartoes={cartoes} aoAdicionar={adicionarCartao} aoMarcar={marcar} aoEditar={setEditandoCartao} aoApagar={apagarCartao} aoPosicionar={posicionar} aoRecarregar={carregar} />
        )}
      </div>

      <Janela titulo={t.cartao.editar} aberta={editandoCartao !== null} aoFechar={() => setEditandoCartao(null)}>
        {editandoCartao && <FormCartao key={editandoCartao.id} inicial={editandoCartao} aoSalvar={salvarCartao} aoApagar={apagarCartao} aoFechar={() => setEditandoCartao(null)} />}
      </Janela>
    </div>
  );
}

/** Selo do prazo: dia/mês a partir de "AAAA-MM-DD". */
function PrazoSelo({ prazo }: { prazo: string }) {
  const [, m, d] = prazo.split("-");
  if (!d || !m) return null;
  return <span className="org-cartao-prazo" title={t.cartao.prazo}><CalendarDays aria-hidden="true" size="0.9em" /> {d}/{m}</span>;
}

/** Troca dois vizinhos de lugar (botões de subir/descer, a alternativa ao arrastar). */
function trocar(ids: string[], i: number, delta: number): string[] | null {
  const j = i + delta;
  if (j < 0 || j >= ids.length) return null;
  const novo = [...ids];
  [novo[i], novo[j]] = [novo[j], novo[i]];
  return novo;
}

// ---------- Estilo quadro (colunas + arrastar) ----------

type Grupos = Record<string, string[]>;

function VisaoQuadro({ quadro, colunas, cartoes, aoRecarregar, aoAdicionar, aoMarcar, aoEditar, aoApagar, aoPosicionar, aoErro }: {
  quadro: Quadro;
  colunas: Coluna[];
  cartoes: CartaoOrg[];
  aoRecarregar: () => Promise<void>;
  aoAdicionar: (colunaId: string, texto: string) => Promise<void>;
  aoMarcar: (c: CartaoOrg, feito: boolean) => void;
  aoEditar: (c: CartaoOrg) => void;
  aoApagar: (c: CartaoOrg) => void;
  aoPosicionar: (id: string, colunaId: string, ids: string[]) => Promise<void>;
  aoErro: (m: string) => void;
}) {
  const recado = useRecado();
  const arrastou = useRef(false);
  const [excluindoColuna, setExcluindoColuna] = useState<Coluna | null>(null);
  const [pintandoColuna, setPintandoColuna] = useState<Coluna | null>(null);
  // Durante o arrasto, a ordem fica num rascunho; ao soltar, é guardada.
  const [rascunho, setRascunhoEstado] = useState<{ id: string; origem: string; grupos: Grupos } | null>(null);
  // Cópia em ref: ao soltar, vale a última ordem, mesmo antes de a tela redesenhar.
  const rascunhoRef = useRef(rascunho);
  const setRascunho = (r: typeof rascunho) => { rascunhoRef.current = r; setRascunhoEstado(r); };

  const idsColunas = useMemo(() => new Set(colunas.map((c) => c.id)), [colunas]);
  const guardados = useMemo(() => {
    const g: Grupos = Object.fromEntries(colunas.map((c) => [c.id, [] as string[]]));
    for (const c of cartoes) g[c.colunaId]?.push(c.id);
    return g;
  }, [colunas, cartoes]);
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
    const origem = colunaDe(guardados, active.id) ?? "";
    setRascunho({ id: String(active.id), origem, grupos: guardados });
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
    await aoPosicionar(id, coluna, ids);
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

  const adicionarColuna = async () => {
    await api.salvarColuna({ id: "", quadroId: quadro.id, nome: t.coluna.semNome, ordem: 0 });
    await aoRecarregar();
  };
  const salvarColuna = async (col: Coluna) => {
    try {
      await api.salvarColuna(col);
      await aoRecarregar();
    } catch (e) {
      aoErro(mensagem(e));
    }
  };
  const renomearColuna = async (col: Coluna, nome: string) => {
    const n = nome.trim();
    if (!n || n === col.nome) return;
    await salvarColuna({ ...col, nome: n });
  };
  const pintarColuna = async (cor: string) => {
    if (!pintandoColuna) return;
    const col = { ...pintandoColuna, cor };
    setPintandoColuna(col);
    await salvarColuna(col);
  };
  const excluirColuna = async () => {
    if (!excluindoColuna) return;
    await api.excluirColuna(excluindoColuna.id);
    setExcluindoColuna(null);
    await aoRecarregar();
  };

  const emArrasto = rascunho ? porId.get(rascunho.id) : undefined;

  return (
    <>
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
          {colunas.map((col) => (
            <ColunaQuadro
              key={col.id}
              coluna={col}
              cartoes={(grupos[col.id] ?? []).map((id) => porId.get(id)).filter((c): c is CartaoOrg => !!c)}
              arrastou={arrastou}
              aoAdicionar={(texto) => aoAdicionar(col.id, texto)}
              aoMarcar={aoMarcar}
              aoEditar={aoEditar}
              aoApagar={aoApagar}
              aoReordenar={(ids) => void aoPosicionar(ids[0], col.id, ids)}
              aoRenomear={(nome) => void renomearColuna(col, nome)}
              aoPintar={() => setPintandoColuna(col)}
              aoExcluir={() => setExcluindoColuna(col)}
            />
          ))}
          <div className="org-coluna-nova">
            <Button className="botao com-icone" onPress={() => void adicionarColuna()}><Plus aria-hidden="true" size="1.1em" /> {t.coluna.adicionar}</Button>
          </div>
        </div>
        {/* Sem animação ao soltar: o cartão vai direto para o lugar. */}
        <DragOverlay dropAnimation={null}>{emArrasto ? <CartaoVisual cartao={emArrasto} flutuando /> : null}</DragOverlay>
      </DndContext>

      <Janela titulo={t.coluna.cor} aberta={pintandoColuna !== null} aoFechar={() => setPintandoColuna(null)} pequena>
        {pintandoColuna && (
          <div className="formulario">
            <EscolherCor rotulo={pintandoColuna.nome || t.coluna.semNome} valor={pintandoColuna.cor ?? ""} aoMudar={(c) => void pintarColuna(c)} />
            <div className="janela-acoes">
              <Button className="botao principal" onPress={() => setPintandoColuna(null)}>{t.coluna.pronto}</Button>
            </div>
          </div>
        )}
      </Janela>

      <Confirmar titulo={t.coluna.excluir} texto={excluindoColuna ? t.coluna.confirmarExcluir(excluindoColuna.nome || t.coluna.semNome) : ""} confirmar={t.coluna.excluir} aberta={excluindoColuna !== null} aoCancelar={() => setExcluindoColuna(null)} aoConfirmar={() => void excluirColuna()} />
    </>
  );
}

function ColunaQuadro({ coluna, cartoes, arrastou, aoAdicionar, aoMarcar, aoEditar, aoApagar, aoReordenar, aoRenomear, aoPintar, aoExcluir }: {
  coluna: Coluna;
  cartoes: CartaoOrg[];
  arrastou: React.MutableRefObject<boolean>;
  aoAdicionar: (texto: string) => Promise<void>;
  aoMarcar: (c: CartaoOrg, feito: boolean) => void;
  aoEditar: (c: CartaoOrg) => void;
  aoApagar: (c: CartaoOrg) => void;
  aoReordenar: (ids: string[]) => void;
  aoRenomear: (nome: string) => void;
  aoPintar: () => void;
  aoExcluir: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(coluna.nome);
  const confirmar = () => { setEditando(false); aoRenomear(nome); };
  const ids = cartoes.map((c) => c.id);
  const mover = (i: number, delta: number) => {
    const novo = trocar(ids, i, delta);
    if (novo) aoReordenar(novo);
  };
  const nomeVisivel = coluna.nome || t.coluna.semNome;
  const cor = coluna.cor ?? "";
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
              else if (e.key === "Escape") { setNome(coluna.nome); setEditando(false); }
            }}
            aria-label={t.coluna.nome}
            maxLength={60}
          />
        ) : (
          <button type="button" className="org-coluna-titulo quebra" onClick={() => { setNome(coluna.nome); setEditando(true); }} aria-label={`${t.coluna.renomear}: ${nomeVisivel}`}>
            {nomeVisivel} <span className="org-coluna-conta">{cartoes.length}</span>
          </button>
        )}
        <span className="org-coluna-acoes">
          <Button className="botao-icone org-icone" onPress={aoPintar} aria-label={`${t.coluna.cor}: ${nomeVisivel}`}><Palette aria-hidden="true" size="1em" /></Button>
          <Button className="botao-icone org-icone" onPress={aoExcluir} aria-label={`${t.coluna.excluir}: ${nomeVisivel}`}><Trash2 aria-hidden="true" size="1em" /></Button>
        </span>
      </div>
      <SortableContext id={coluna.id} items={ids} strategy={verticalListSortingStrategy}>
        <ul className="org-cartoes">
          {cartoes.map((c, i) => (
            <li key={c.id}>
              <CartaoArrastavel
                cartao={c}
                arrastou={arrastou}
                aoMarcar={aoMarcar}
                aoEditar={aoEditar}
                aoApagar={aoApagar}
                aoSubir={() => mover(i, -1)}
                aoDescer={() => mover(i, 1)}
                podeSubir={i > 0}
                podeDescer={i < cartoes.length - 1}
              />
            </li>
          ))}
        </ul>
      </SortableContext>
      <NovoCartao aoAdicionar={aoAdicionar} />
    </section>
  );
}

/** O cartão como aparece (também usado na cópia que segue o dedo durante o arrasto). */
function CartaoVisual({ cartao, flutuando }: { cartao: CartaoOrg; flutuando?: boolean }) {
  return (
    <div className={"org-cartao" + classeCor(cartao.cor) + (cartao.feito ? " feito" : "") + (flutuando ? " flutuando" : "")} style={estiloCor(cartao.cor)}>
      <div className="org-cartao-topo">
        <input type="checkbox" checked={cartao.feito} readOnly tabIndex={-1} aria-hidden="true" />
        <span className="org-cartao-texto quebra"><span>{cartao.texto}</span>{cartao.prazo && <PrazoSelo prazo={cartao.prazo} />}</span>
        <span className="org-alca" aria-hidden="true"><GripVertical size="1em" /></span>
      </div>
    </div>
  );
}

function CartaoArrastavel({ cartao, arrastou, aoMarcar, aoEditar, aoApagar, aoSubir, aoDescer, podeSubir, podeDescer }: {
  cartao: CartaoOrg;
  arrastou: React.MutableRefObject<boolean>;
  aoMarcar: (c: CartaoOrg, feito: boolean) => void;
  aoEditar: (c: CartaoOrg) => void;
  aoApagar: (c: CartaoOrg) => void;
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
      <div className="org-cartao-topo">
        <input type="checkbox" checked={cartao.feito} onChange={(e) => aoMarcar(cartao, e.target.checked)} aria-label={`${t.cartao.feito}: ${cartao.texto}`} />
        <button type="button" className="org-cartao-texto quebra" onClick={(e) => { if (arrastou.current) { e.preventDefault(); return; } aoEditar(cartao); }} aria-label={`${t.cartao.editar}: ${cartao.texto}`}>
          <span>{cartao.texto}</span>
          {cartao.prazo && <PrazoSelo prazo={cartao.prazo} />}
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
      {/* Alternativa ao arrastar: aparece quando se chega aqui pelo teclado. */}
      <div className="org-cartao-teclado">
        <Button className="botao-icone org-icone" onPress={aoSubir} isDisabled={!podeSubir} aria-label={`${t.cartao.subir}: ${cartao.texto}`}><ArrowUp aria-hidden="true" size="1em" /></Button>
        <Button className="botao-icone org-icone" onPress={aoDescer} isDisabled={!podeDescer} aria-label={`${t.cartao.descer}: ${cartao.texto}`}><ArrowDown aria-hidden="true" size="1em" /></Button>
        <Button className="botao-icone org-icone" onPress={() => aoApagar(cartao)} aria-label={`${t.cartao.excluir}: ${cartao.texto}`}><Trash2 aria-hidden="true" size="1em" /></Button>
      </div>
    </div>
  );
}

function FormCartao({ inicial, aoSalvar, aoApagar, aoFechar }: { inicial: CartaoOrg; aoSalvar: (c: CartaoOrg) => Promise<void>; aoApagar: (c: CartaoOrg) => Promise<void>; aoFechar: () => void }) {
  const [texto, setTexto] = useState(inicial.texto);
  const [cor, setCor] = useState(inicial.cor);
  const [prazo, setPrazo] = useState(inicial.prazo);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const txt = texto.trim();
    if (!txt) { setErro(t.cartao.vazio); return; }
    try {
      await aoSalvar({ ...inicial, texto: txt, cor, prazo });
    } catch (err) {
      setErro(mensagem(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.cartao.texto} valor={texto} aoMudar={setTexto} autoFocus maximo={200} />
      <EscolherCor rotulo={t.cartao.cor} valor={cor} aoMudar={setCor} />
      <CampoData rotulo={t.cartao.prazo} tipo="date" valor={prazo} aoMudar={setPrazo} />
      {prazo && <Button className="botao pequeno com-icone" onPress={() => setPrazo("")}><Trash2 aria-hidden="true" size="1em" /> {t.cartao.semPrazo}</Button>}
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes org-form-acoes">
        <Button className="botao com-icone org-apagar" onPress={() => void aoApagar(inicial)}><Trash2 aria-hidden="true" size="1em" /> {t.cartao.excluir}</Button>
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{t.cartao.salvar}</Button>
      </div>
    </Form>
  );
}

function NovoCartao({ aoAdicionar }: { aoAdicionar: (texto: string) => Promise<void> }) {
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
      <input className="entrada-texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t.cartao.novo} aria-label={t.cartao.adicionar} />
    </Form>
  );
}

// ---------- Estilo lista (caixinhas) ----------

function VisaoLista({ coluna, cartoes, aoAdicionar, aoMarcar, aoEditar, aoApagar, aoPosicionar, aoRecarregar }: {
  coluna: Coluna | undefined;
  cartoes: CartaoOrg[];
  aoAdicionar: (colunaId: string, texto: string) => Promise<void>;
  aoMarcar: (c: CartaoOrg, feito: boolean) => void;
  aoEditar: (c: CartaoOrg) => void;
  aoApagar: (c: CartaoOrg) => void;
  aoPosicionar: (id: string, colunaId: string, ids: string[]) => Promise<void>;
  aoRecarregar: () => Promise<void>;
}) {
  const recado = useRecado();
  const [texto, setTexto] = useState("");
  const sensores = useSensoresArrastar(sortableKeyboardCoordinates);
  if (!coluna) return null;
  const feitos = cartoes.filter((c) => c.feito).length;
  const ids = cartoes.map((c) => c.id);
  const reordenar = (novo: string[], id: string) => void aoPosicionar(id, coluna.id, novo);
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

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = texto.trim();
    if (!v) return;
    setTexto("");
    await aoAdicionar(coluna.id, v);
  };
  const limparFeitos = async () => {
    for (const c of cartoes.filter((x) => x.feito)) await api.excluirCartaoOrg(c.id);
    await aoRecarregar();
  };

  return (
    <div className="org-lista largura-leitura">
      <Form className="org-lista-nova" onSubmit={adicionar}>
        <input className="entrada-texto sozinha" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t.lista.novo} aria-label={t.lista.adicionar} />
        <Button className="botao principal" type="submit"><Plus aria-hidden="true" size="1.1em" /> {t.lista.adicionar}</Button>
      </Form>

      {cartoes.length === 0 ? (
        <p className="texto-suave">{t.lista.vazia}</p>
      ) : (
        <>
          <div className="linha-ajuste">
            <span className="texto-suave pequeno">{t.lista.feitosDe(feitos, cartoes.length)}</span>
            {feitos > 0 && <Button className="botao pequeno com-icone" onPress={() => void limparFeitos()}><Check aria-hidden="true" size="1em" /> {t.lista.limparFeitos}</Button>}
          </div>
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
                  <ItemLista
                    key={c.id}
                    cartao={c}
                    aoMarcar={aoMarcar}
                    aoEditar={aoEditar}
                    aoApagar={aoApagar}
                    aoSubir={() => mover(i, -1)}
                    aoDescer={() => mover(i, 1)}
                    podeSubir={i > 0}
                    podeDescer={i < cartoes.length - 1}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}

function ItemLista({ cartao, aoMarcar, aoEditar, aoApagar, aoSubir, aoDescer, podeSubir, podeDescer }: {
  cartao: CartaoOrg;
  aoMarcar: (c: CartaoOrg, feito: boolean) => void;
  aoEditar: (c: CartaoOrg) => void;
  aoApagar: (c: CartaoOrg) => void;
  aoSubir: () => void;
  aoDescer: () => void;
  podeSubir: boolean;
  podeDescer: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: cartao.id });
  const { onKeyDown, ...ponteiro } = listeners ?? {};
  const estilo = { ...estiloCor(cartao.cor), transform: CSS.Translate.toString(transform), transition };
  return (
    <li ref={setNodeRef} className={"org-item" + classeCor(cartao.cor) + (cartao.feito ? " feito" : "") + (isDragging ? " arrastando" : "")} style={estilo} {...ponteiro}>
      <label className="org-item-check">
        <input type="checkbox" checked={cartao.feito} onChange={(e) => aoMarcar(cartao, e.target.checked)} aria-label={cartao.texto} />
        <span className="quebra">{cartao.texto}{cartao.prazo && <PrazoSelo prazo={cartao.prazo} />}</span>
      </label>
      <span className="org-item-acoes">
        <span className="org-cartao-teclado">
          <Button className="botao-icone org-icone" onPress={aoSubir} isDisabled={!podeSubir} aria-label={`${t.cartao.subir}: ${cartao.texto}`}><ArrowUp aria-hidden="true" size="1em" /></Button>
          <Button className="botao-icone org-icone" onPress={aoDescer} isDisabled={!podeDescer} aria-label={`${t.cartao.descer}: ${cartao.texto}`}><ArrowDown aria-hidden="true" size="1em" /></Button>
          <Button className="botao-icone org-icone" onPress={() => aoApagar(cartao)} aria-label={`${t.cartao.excluir}: ${cartao.texto}`}><Trash2 aria-hidden="true" size="1em" /></Button>
        </span>
        <Button className="botao-icone org-icone" onPress={() => aoEditar(cartao)} aria-label={`${t.cartao.editar}: ${cartao.texto}`}><Pencil aria-hidden="true" size="1em" /></Button>
        <span ref={setActivatorNodeRef} className="org-alca" {...attributes} onKeyDown={onKeyDown as React.KeyboardEventHandler | undefined} aria-roledescription="item arrastável" aria-label={`${t.cartao.mover}: ${cartao.texto}`}>
          <GripVertical aria-hidden="true" size="1em" />
        </span>
      </span>
    </li>
  );
}
