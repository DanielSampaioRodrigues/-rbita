import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Form, Label, Radio, RadioGroup } from "react-aria-components";
import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { api, CORES_ETIQUETA, type Coluna, type CartaoOrg, type Quadro } from "../api";
import { useRecado } from "../app/Recado";
import { pularEntreColunas } from "../componentes/tecladoColunas";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronLeft, GripVertical, LayoutGrid, ListChecks, Pencil, Plus, Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";

const t = textos.organizacao;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

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
        <Button className="botao principal" onPress={() => setEditando({ id: "", nome: "", estilo: "lista", criadoEm: 0 })}>
          <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
        </Button>
      </div>

      {quadros.length === 0 ? (
        <section className="cartao largura-leitura esticado"><p className="texto-suave">{t.vazio}</p></section>
      ) : (
        <ul className="lista-cartoes largura-leitura">
          {quadros.map((q) => (
            <li key={q.id}>
              <div className="cartao compacto linha-ajuste">
                <button className="org-abrir" onClick={() => setAberto(q)} aria-label={`${t.abrir}: ${q.nome}`}>
                  {q.estilo === "quadro" ? <LayoutGrid aria-hidden="true" size="1.2em" /> : <ListChecks aria-hidden="true" size="1.2em" />}
                  <span className="quebra"><strong>{q.nome}</strong></span>
                  <span className="livro-selo">{t.selo[q.estilo]}</span>
                </button>
                <span className="linha-ajuste">
                  <Button className="botao-icone" onPress={() => setEditando(q)} aria-label={`${t.editar}: ${q.nome}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
                  <Button className="botao-icone" onPress={() => setExcluindo(q)} aria-label={`${t.excluir}: ${q.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
                </span>
              </div>
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
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarQuadro({ ...inicial, nome, estilo });
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
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.form.salvarMudancas : t.form.salvar}</Button>
      </div>
    </Form>
  );
}

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
    await carregar();
  };
  const reordenar = async (ids: string[]) => {
    // Atualiza a ordem E reordena o array (a lista é desenhada na ordem do array).
    const posicao = new Map(ids.map((id, i) => [id, i + 1]));
    setCartoes((cs) => cs.map((c) => (posicao.has(c.id) ? { ...c, ordem: posicao.get(c.id)! } : c)).sort((a, b) => a.ordem - b.ordem));
    try {
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
          <VisaoQuadro quadro={quadro} colunas={colunas} cartoes={cartoes} aoRecarregar={carregar} aoAdicionar={adicionarCartao} aoMarcar={marcar} aoEditar={setEditandoCartao} aoApagar={apagarCartao} aoReordenar={reordenar} aoErro={setErro} />
        ) : (
          <VisaoLista coluna={colunas[0]} cartoes={cartoes} aoAdicionar={adicionarCartao} aoMarcar={marcar} aoEditar={setEditandoCartao} aoApagar={apagarCartao} aoReordenar={reordenar} aoRecarregar={carregar} />
        )}
      </div>

      <Janela titulo={t.cartao.editar} aberta={editandoCartao !== null} aoFechar={() => setEditandoCartao(null)}>
        {editandoCartao && <FormCartao key={editandoCartao.id} inicial={editandoCartao} aoSalvar={salvarCartao} aoFechar={() => setEditandoCartao(null)} />}
      </Janela>
    </div>
  );
}

/** Estilo da faixa de cor na lateral do cartão (vazio = sem faixa). */
function corEstilo(cor: string): React.CSSProperties {
  return cor ? { borderLeftColor: `var(--etq-${cor})`, borderLeftWidth: "4px", borderLeftStyle: "solid" } : {};
}

/** Selo do prazo: dia/mês a partir de "AAAA-MM-DD". */
function PrazoSelo({ prazo }: { prazo: string }) {
  const [, m, d] = prazo.split("-");
  if (!d || !m) return null;
  return <span className="org-cartao-prazo" title={t.cartao.prazo}><CalendarDays aria-hidden="true" size="0.9em" /> {d}/{m}</span>;
}

// ---------- Estilo quadro (colunas + arrastar) ----------

function VisaoQuadro({ quadro, colunas, cartoes, aoRecarregar, aoAdicionar, aoMarcar, aoEditar, aoApagar, aoReordenar, aoErro }: {
  quadro: Quadro;
  colunas: Coluna[];
  cartoes: CartaoOrg[];
  aoRecarregar: () => Promise<void>;
  aoAdicionar: (colunaId: string, texto: string) => Promise<void>;
  aoMarcar: (c: CartaoOrg, feito: boolean) => void;
  aoEditar: (c: CartaoOrg) => void;
  aoApagar: (c: CartaoOrg) => void;
  aoReordenar: (ids: string[]) => void;
  aoErro: (m: string) => void;
}) {
  const recado = useRecado();
  const arrastou = useRef(false);
  const [excluindoColuna, setExcluindoColuna] = useState<Coluna | null>(null);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] }, coordinateGetter: pularEntreColunas }),
  );
  const cartaoDe = (id: unknown) => cartoes.find((c) => c.id === String(id).split("|")[1]);
  const nomeColuna = (id: unknown) => colunas.find((c) => c.id === id)?.nome || t.coluna.semNome;

  const soltar = async ({ active, over }: DragEndEvent) => {
    setTimeout(() => (arrastou.current = false), 150);
    const cartao = cartaoDe(active.id);
    const destino = over?.id as string | undefined;
    if (!cartao || !destino || destino === cartao.colunaId) return;
    const ordem = Math.max(0, ...cartoes.filter((c) => c.colunaId === destino).map((c) => c.ordem)) + 1;
    try {
      await api.moverCartaoOrg(cartao.id, destino, ordem);
      await aoRecarregar();
      recado(`"${cartao.texto}" → ${nomeColuna(destino)}.`);
    } catch (e) {
      aoErro(mensagem(e));
    }
  };

  const adicionarColuna = async () => {
    await api.salvarColuna({ id: "", quadroId: quadro.id, nome: t.coluna.semNome, ordem: 0 });
    await aoRecarregar();
  };
  const renomearColuna = async (col: Coluna, nome: string) => {
    const n = nome.trim();
    if (!n || n === col.nome) return;
    try {
      await api.salvarColuna({ ...col, nome: n });
      await aoRecarregar();
    } catch (e) {
      aoErro(mensagem(e));
    }
  };
  const excluirColuna = async () => {
    if (!excluindoColuna) return;
    await api.excluirColuna(excluindoColuna.id);
    setExcluindoColuna(null);
    await aoRecarregar();
  };

  return (
    <>
    <DndContext
      sensors={sensores}
      onDragStart={() => (arrastou.current = true)}
      onDragEnd={soltar}
      onDragCancel={() => (arrastou.current = false)}
      accessibility={{ screenReaderInstructions: { draggable: t.arrastarInstrucoes } }}
    >
      <div className="org-quadro">
        {colunas.map((col) => (
          <ColunaQuadro
            key={col.id}
            coluna={col}
            cartoes={cartoes.filter((c) => c.colunaId === col.id)}
            arrastou={arrastou}
            aoAdicionar={(texto) => aoAdicionar(col.id, texto)}
            aoMarcar={aoMarcar}
            aoEditar={aoEditar}
            aoApagar={aoApagar}
            aoReordenar={aoReordenar}
            aoRenomear={(nome) => renomearColuna(col, nome)}
            aoExcluir={() => setExcluindoColuna(col)}
          />
        ))}
        <div className="org-coluna-nova">
          <Button className="botao com-icone" onPress={() => void adicionarColuna()}><Plus aria-hidden="true" size="1.1em" /> {t.coluna.adicionar}</Button>
        </div>
      </div>
    </DndContext>

    <Confirmar titulo={t.coluna.excluir} texto={excluindoColuna ? t.coluna.confirmarExcluir(excluindoColuna.nome || t.coluna.semNome) : ""} confirmar={t.coluna.excluir} aberta={excluindoColuna !== null} aoCancelar={() => setExcluindoColuna(null)} aoConfirmar={() => void excluirColuna()} />
    </>
  );
}

function ColunaQuadro({ coluna, cartoes, arrastou, aoAdicionar, aoMarcar, aoEditar, aoApagar, aoReordenar, aoRenomear, aoExcluir }: {
  coluna: Coluna;
  cartoes: CartaoOrg[];
  arrastou: React.MutableRefObject<boolean>;
  aoAdicionar: (texto: string) => Promise<void>;
  aoMarcar: (c: CartaoOrg, feito: boolean) => void;
  aoEditar: (c: CartaoOrg) => void;
  aoApagar: (c: CartaoOrg) => void;
  aoReordenar: (ids: string[]) => void;
  aoRenomear: (nome: string) => void;
  aoExcluir: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(coluna.nome);
  const confirmar = () => { setEditando(false); aoRenomear(nome); };
  const ids = cartoes.map((c) => c.id);
  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    const novo = [...ids];
    [novo[i], novo[j]] = [novo[j], novo[i]];
    aoReordenar(novo);
  };
  return (
    <section ref={setNodeRef} className={isOver ? "org-coluna sobre" : "org-coluna"} aria-label={coluna.nome || t.coluna.semNome}>
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
          <button type="button" className="org-coluna-titulo" onClick={() => { setNome(coluna.nome); setEditando(true); }} aria-label={`${t.coluna.renomear}: ${coluna.nome || t.coluna.semNome}`}>
            {coluna.nome || t.coluna.semNome} <span className="texto-suave">({cartoes.length})</span>
          </button>
        )}
        <span className="linha-ajuste">
          {!editando && <Button className="botao-icone pequeno" onPress={() => { setNome(coluna.nome); setEditando(true); }} aria-label={`${t.coluna.renomear}: ${coluna.nome}`}><Pencil aria-hidden="true" size="1em" /></Button>}
          <Button className="botao-icone pequeno" onPress={aoExcluir} aria-label={`${t.coluna.excluir}: ${coluna.nome}`}><Trash2 aria-hidden="true" size="1em" /></Button>
        </span>
      </div>
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
      <NovoCartao aoAdicionar={aoAdicionar} />
    </section>
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `${cartao.colunaId}|${cartao.id}` });
  const estilo = { ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}), ...corEstilo(cartao.cor) };

  return (
    <div ref={setNodeRef} className={isDragging ? "org-cartao arrastando" : cartao.feito ? "org-cartao feito" : "org-cartao"} style={estilo}>
      <span className="org-alca" {...attributes} {...listeners} role="button" tabIndex={0} aria-roledescription="cartão arrastável" aria-label={`${t.cartao.mover}: ${cartao.texto}`} onClick={(e) => { if (arrastou.current) e.preventDefault(); }}>
        <GripVertical aria-hidden="true" size="1em" />
      </span>
      <label className="org-cartao-check">
        <input type="checkbox" checked={cartao.feito} onChange={(e) => aoMarcar(cartao, e.target.checked)} aria-label={t.cartao.feito} />
      </label>
      <button type="button" className="org-cartao-texto quebra" onClick={() => aoEditar(cartao)} aria-label={`${t.cartao.editar}: ${cartao.texto}`}>
        <span>{cartao.texto}</span>
        {cartao.prazo && <PrazoSelo prazo={cartao.prazo} />}
      </button>
      <span className="org-cartao-ordenar">
        <Button className="botao-icone pequeno" onPress={aoSubir} isDisabled={!podeSubir} aria-label={`${t.cartao.subir}: ${cartao.texto}`}><ArrowUp aria-hidden="true" size="1em" /></Button>
        <Button className="botao-icone pequeno" onPress={aoDescer} isDisabled={!podeDescer} aria-label={`${t.cartao.descer}: ${cartao.texto}`}><ArrowDown aria-hidden="true" size="1em" /></Button>
      </span>
      <Button className="botao-icone pequeno" onPress={() => aoEditar(cartao)} aria-label={`${t.cartao.editar}: ${cartao.texto}`}><Pencil aria-hidden="true" size="1em" /></Button>
      <Button className="botao-icone pequeno" onPress={() => aoApagar(cartao)} aria-label={`${t.cartao.excluir}: ${cartao.texto}`}><Trash2 aria-hidden="true" size="1em" /></Button>
    </div>
  );
}

function EscolherCorCartao({ valor, aoMudar }: { valor: string; aoMudar: (c: string) => void }) {
  return (
    <RadioGroup className="campo" value={valor} onChange={aoMudar} orientation="horizontal">
      <Label className="campo-rotulo">{t.cartao.cor}</Label>
      <div className="cores-etiqueta">
        <Radio value="" className="cor-opcao" aria-label={t.cartao.semCor}>
          <span className="etiqueta-cor grande cor-nenhuma" aria-hidden="true" />
          <span className="pequeno">{t.cartao.semCor}</span>
        </Radio>
        {CORES_ETIQUETA.map((c) => (
          <Radio key={c} value={c} className="cor-opcao" aria-label={textos.ideias.cores[c]}>
            <span className={`etiqueta-cor grande cor-${c}`} aria-hidden="true" />
            <span className="pequeno">{textos.ideias.cores[c]}</span>
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}

function FormCartao({ inicial, aoSalvar, aoFechar }: { inicial: CartaoOrg; aoSalvar: (c: CartaoOrg) => Promise<void>; aoFechar: () => void }) {
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
      <EscolherCorCartao valor={cor} aoMudar={setCor} />
      <CampoData rotulo={t.cartao.prazo} tipo="date" valor={prazo} aoMudar={setPrazo} />
      {prazo && <Button className="botao pequeno com-icone" onPress={() => setPrazo("")}><Trash2 aria-hidden="true" size="1em" /> {t.cartao.semPrazo}</Button>}
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
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
      <input className="entrada-texto sozinha" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t.cartao.novo} aria-label={t.cartao.adicionar} />
    </Form>
  );
}

// ---------- Estilo lista (caixinhas) ----------

function VisaoLista({ coluna, cartoes, aoAdicionar, aoMarcar, aoEditar, aoApagar, aoReordenar, aoRecarregar }: {
  coluna: Coluna | undefined;
  cartoes: CartaoOrg[];
  aoAdicionar: (colunaId: string, texto: string) => Promise<void>;
  aoMarcar: (c: CartaoOrg, feito: boolean) => void;
  aoEditar: (c: CartaoOrg) => void;
  aoApagar: (c: CartaoOrg) => void;
  aoReordenar: (ids: string[]) => void;
  aoRecarregar: () => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  if (!coluna) return null;
  const feitos = cartoes.filter((c) => c.feito).length;
  const ids = cartoes.map((c) => c.id);
  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    const novo = [...ids];
    [novo[i], novo[j]] = [novo[j], novo[i]];
    aoReordenar(novo);
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
          <ul className="lista-simples sem-marcador org-itens">
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
  return (
    <li className={cartao.feito ? "org-item feito" : "org-item"} style={corEstilo(cartao.cor)}>
      <label className="org-item-check">
        <input type="checkbox" checked={cartao.feito} onChange={(e) => aoMarcar(cartao, e.target.checked)} aria-label={cartao.texto} />
        <span className="quebra">{cartao.texto}{cartao.prazo && <PrazoSelo prazo={cartao.prazo} />}</span>
      </label>
      <span className="linha-ajuste">
        <Button className="botao-icone" onPress={aoSubir} isDisabled={!podeSubir} aria-label={`${t.cartao.subir}: ${cartao.texto}`}><ArrowUp aria-hidden="true" size="1.1em" /></Button>
        <Button className="botao-icone" onPress={aoDescer} isDisabled={!podeDescer} aria-label={`${t.cartao.descer}: ${cartao.texto}`}><ArrowDown aria-hidden="true" size="1.1em" /></Button>
        <Button className="botao-icone" onPress={() => aoEditar(cartao)} aria-label={`${t.cartao.editar}: ${cartao.texto}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
        <Button className="botao-icone" onPress={() => aoApagar(cartao)} aria-label={`${t.cartao.excluir}: ${cartao.texto}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
      </span>
    </li>
  );
}
