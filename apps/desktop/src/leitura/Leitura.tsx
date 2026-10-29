import { useEffect, useId, useRef, useState } from "react";
import { Button, Form } from "react-aria-components";
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor,
  useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { lerMetadados } from "@orbita/leitor";
import { api, escolherLivro, type CorEtiqueta, type GrupoLivro, type Livro } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { Confirmar, Janela } from "../componentes/Janela";
import { pularEntreColunas } from "../componentes/tecladoColunas";
import { useRecado } from "../app/Recado";
import { EscolherCor } from "../ideias/etiquetas";
import { ArrowDown, ArrowUp, BookOpen, Check, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { LeitorLivro } from "./Leitor";
import { CapaLivro } from "./CapaLivro";
import { corDaCapa, corDoTitulo } from "./capa";
import {
  gravarOrdem, gravarProgresso, lerOrdem, lerProgresso, lerUltimo, livroParaContinuar,
  marcarUltimo, moverNaOrdem, ordenarPrateleiras,
} from "./estanteLocal";

const SEM = "sem";

const t = textos.leitura;
const ORDEM: Livro["status"][] = ["lendo", "quero", "pausado", "lido"];
const nomeStatus = (s: string) => t.status[s as keyof typeof t.status] ?? s;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));
const temArquivo = (l: Livro) => l.arquivoId !== "" && l.formato !== "";
const ordenarLivros = (a: Livro, b: Livro) =>
  (ORDEM.indexOf(a.status) - ORDEM.indexOf(b.status)) || a.titulo.localeCompare(b.titulo);

function base64ParaBytes(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** Livro novo: cor vazia = automática, tirada do título. */
function livroNovo(grupoId = ""): Livro {
  return { id: "", titulo: "", autor: "", status: "quero", ondeParei: "", impressoes: "", inicio: "", fim: "", formato: "", arquivoId: "", grupoId, cor: "", criadoEm: 0 };
}

export function PaginaLeitura() {
  const [livros, setLivros] = useState<Livro[]>([]);
  const [grupos, setGrupos] = useState<GrupoLivro[]>([]);
  const [ordem, setOrdem] = useState<string[]>(lerOrdem);
  const [editando, setEditando] = useState<Livro | null>(null);
  const [excluindo, setExcluindo] = useState<Livro | null>(null);
  const [excluindoGrupo, setExcluindoGrupo] = useState<GrupoLivro | null>(null);
  const [lendo, setLendo] = useState<Livro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  useEffect(() => {
    Promise.all([api.listarLivros(), api.listarGruposLivro()]).then(
      ([ls, gs]) => {
        setLivros(ls);
        setGrupos(gs);
      },
      (e) => setErro(mensagem(e)),
    );
  }, [mudancas]);

  const ler = (l: Livro) => {
    marcarUltimo(l.id);
    setLendo(l);
  };

  const excluir = async () => {
    if (!excluindo) return;
    await api.excluirLivro(excluindo.id);
    gravarProgresso(excluindo.id, null);
    setExcluindo(null);
    setEditando(null);
    avisarMudanca();
  };

  const excluirGrupo = async () => {
    if (!excluindoGrupo) return;
    await api.excluirGrupoLivro(excluindoGrupo.id);
    setExcluindoGrupo(null);
    avisarMudanca();
  };

  const mudarOrdem = (ids: string[]) => {
    gravarOrdem(ids);
    setOrdem(ids);
  };

  if (lendo) return <LeitorLivro livro={lendo} aoFechar={() => setLendo(null)} />;

  const continuar = livroParaContinuar(livros, lerUltimo()?.id ?? null);

  return (
    <div className="pagina leitura-pagina">
      <div className="leitura-cabecalho">
        <div>
          <h1>{t.titulo}</h1>
          <p className="pagina-intro">{t.intro}</p>
        </div>
        <div className="botoes">
          <Button className="botao principal" onPress={() => setEditando(livroNovo())}>
            <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
          </Button>
        </div>
      </div>

      {continuar && <ContinuarLendo livro={continuar} aoLer={() => ler(continuar)} aoFicha={() => setEditando(continuar)} />}

      {livros.length === 0 && grupos.length === 0 ? (
        <section className="leitura-vazia">
          <p>{t.semLivros}</p>
        </section>
      ) : (
        <Estante
          livros={livros}
          grupos={ordenarPrateleiras(grupos, ordem)}
          aoMudarOrdem={mudarOrdem}
          aoAbrir={(l) => (temArquivo(l) ? ler(l) : setEditando(l))}
          aoFicha={setEditando}
          aoExcluirGrupo={setExcluindoGrupo}
        />
      )}

      <Aviso>{erro}</Aviso>

      <Janela titulo={editando && editando.id ? t.form.editarTitulo : t.form.novo} aberta={editando !== null} aoFechar={() => setEditando(null)}>
        {editando && (
          <FormLivro
            key={editando.id || "novo"}
            inicial={editando}
            grupos={ordenarPrateleiras(grupos, ordem)}
            aoFechar={() => setEditando(null)}
            aoExcluir={editando.id ? () => setExcluindo(editando) : undefined}
          />
        )}
      </Janela>

      <Confirmar titulo={t.excluir} texto={excluindo ? t.confirmarExcluir(excluindo.titulo) : ""} confirmar={t.excluir} aberta={excluindo !== null} aoCancelar={() => setExcluindo(null)} aoConfirmar={() => void excluir()} />
      <Confirmar titulo={t.prateleiras.excluir} texto={excluindoGrupo ? t.prateleiras.confirmarExcluir(excluindoGrupo.nome) : ""} confirmar={t.prateleiras.excluir} aberta={excluindoGrupo !== null} aoCancelar={() => setExcluindoGrupo(null)} aoConfirmar={() => void excluirGrupo()} />
    </div>
  );
}

/** Cartão "Continuar lendo": retomar importa tanto quanto começar. */
function ContinuarLendo({ livro, aoLer, aoFicha }: { livro: Livro; aoLer: () => void; aoFicha: () => void }) {
  const id = useId();
  const progresso = lerProgresso(livro.id);
  const comArquivo = temArquivo(livro);
  return (
    <section className="leitura-continuar" aria-labelledby={id}>
      <div className="leitura-continuar-capa">
        <CapaLivro titulo={livro.titulo} autor={livro.autor} cor={livro.cor} compacta />
      </div>
      <div className="leitura-continuar-texto">
        <p className="leitura-continuar-rotulo" id={id}>{t.continuar.titulo}</p>
        <h2 className="leitura-continuar-livro quebra">{livro.titulo}</h2>
        {livro.autor && <p className="texto-suave quebra">{livro.autor}</p>}
        {livro.ondeParei && <p className="leitura-continuar-onde quebra"><strong>{t.ondeParei}:</strong> {livro.ondeParei}</p>}
        {progresso != null && (
          <div className="leitura-continuar-barra">
            <div className="leitura-progresso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso} aria-label={t.progresso.rotulo}>
              <span style={{ width: `${progresso}%` }} />
            </div>
            <span className="pequeno texto-suave">{t.progresso.valor(progresso)}</span>
          </div>
        )}
        <div className="botoes">
          {comArquivo ? (
            <Button className="botao principal" onPress={aoLer}><BookOpen aria-hidden="true" size="1.1em" /> {t.continuar.ler}</Button>
          ) : null}
          <Button className={comArquivo ? "botao" : "botao principal"} onPress={aoFicha}>
            <Pencil aria-hidden="true" size="1.1em" /> {t.continuar.atualizar}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** A estante: prateleiras com capas; arrastar uma capa leva o livro para outra prateleira. */
function Estante({ livros, grupos, aoMudarOrdem, aoAbrir, aoFicha, aoExcluirGrupo }: {
  livros: Livro[];
  grupos: GrupoLivro[];
  aoMudarOrdem: (ids: string[]) => void;
  aoAbrir: (l: Livro) => void;
  aoFicha: (l: Livro) => void;
  aoExcluirGrupo: (g: GrupoLivro) => void;
}) {
  const recado = useRecado();
  const arrastou = useRef(false);
  const [ativo, setAtivo] = useState<Livro | null>(null);
  const [criando, setCriando] = useState(false);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  // Mouse e caneta começam após 6 px; no toque, segurar um instante (não briga com a rolagem).
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space", "Enter"], cancel: ["Escape"], end: ["Space", "Enter"] }, coordinateGetter: pularEntreColunas }),
  );
  const livroDe = (id: unknown) => livros.find((l) => l.id === String(id));
  const nomePrateleira = (id: unknown) => (id === SEM ? t.semPrateleira : grupos.find((g) => g.id === id)?.nome ?? "");
  const dePrateleira = (l: Livro) => (grupos.some((g) => g.id === l.grupoId) ? l.grupoId : SEM);

  const pegar = ({ active }: DragStartEvent) => {
    arrastou.current = true;
    setAtivo(livroDe(active.id) ?? null);
  };

  const soltar = async ({ active, over }: DragEndEvent) => {
    setAtivo(null);
    setTimeout(() => (arrastou.current = false), 150);
    const livro = livroDe(active.id);
    const destino = over?.id as string | undefined;
    if (!livro || !destino || destino === dePrateleira(livro)) return;
    try {
      await api.salvarLivro({ ...livro, grupoId: destino === SEM ? "" : destino });
      avisarMudanca();
      recado(t.movidoPara(livro.titulo, nomePrateleira(destino)));
    } catch (e) {
      recado(mensagem(e));
    }
  };

  const criar = async (nome: string) => {
    setCriando(false);
    if (!nome.trim()) return;
    try {
      const g = await api.salvarGrupoLivro({ id: "", nome, criadoEm: 0 });
      aoMudarOrdem([...grupos.map((x) => x.id), g.id]);
      avisarMudanca();
      recado(t.prateleiras.criada(g.nome));
    } catch (e) {
      recado(mensagem(e));
    }
  };

  const renomear = async (g: GrupoLivro, nome: string) => {
    setRenomeando(null);
    if (!nome.trim() || nome.trim() === g.nome) return;
    try {
      await api.salvarGrupoLivro({ ...g, nome });
      avisarMudanca();
    } catch (e) {
      recado(mensagem(e));
    }
  };

  const mover = (g: GrupoLivro, delta: -1 | 1) => {
    const ids = grupos.map((x) => x.id);
    const novo = moverNaOrdem(ids, g.id, delta);
    if (novo === ids) return;
    aoMudarOrdem(novo);
    recado(t.prateleiras.movida(g.nome, novo.indexOf(g.id) + 1, novo.length));
  };

  const semGrupo = livros.filter((l) => dePrateleira(l) === SEM).sort(ordenarLivros);

  return (
    <DndContext
      sensors={sensores}
      onDragStart={pegar}
      onDragEnd={soltar}
      onDragCancel={() => { setAtivo(null); arrastou.current = false; }}
      accessibility={{
        screenReaderInstructions: { draggable: t.arrastarInstrucoes },
        announcements: {
          onDragStart: ({ active }) => `Pegou "${livroDe(active.id)?.titulo ?? ""}".`,
          onDragOver: ({ active, over }) => (over ? `"${livroDe(active.id)?.titulo ?? ""}" sobre ${nomePrateleira(over.id)}.` : "Fora das prateleiras."),
          onDragEnd: ({ active, over }) => (over ? `"${livroDe(active.id)?.titulo ?? ""}" solto em ${nomePrateleira(over.id)}.` : "Voltou ao lugar."),
          onDragCancel: () => "Movimento cancelado.",
        },
      }}
    >
      <div className="leitura-estante">
        <div className="leitura-estante-barra">
          <p className="texto-suave pequeno">{grupos.length > 0 ? t.arrastarDica : t.prateleiras.semPrateleiras}</p>
          <Button className="botao" onPress={() => setCriando(true)} isDisabled={criando}>
            <Plus aria-hidden="true" size="1.1em" /> {t.prateleiras.novo}
          </Button>
        </div>

        {grupos.map((g, i) => (
          <Prateleira
            key={g.id}
            dropId={g.id}
            nome={g.nome}
            livros={livros.filter((l) => l.grupoId === g.id).sort(ordenarLivros)}
            cabecalho={
              renomeando === g.id ? (
                <NomeEditavel inicial={g.nome} rotulo={t.prateleiras.nome} aoConfirmar={(n) => void renomear(g, n)} aoCancelar={() => setRenomeando(null)} />
              ) : (
                <button type="button" className="prateleira-nome-botao" onClick={() => setRenomeando(g.id)} aria-label={t.prateleiras.renomear(g.nome)}>
                  <span className="quebra">{g.nome}</span>
                  <Pencil aria-hidden="true" size="0.85em" />
                </button>
              )
            }
            acoes={
              <>
                <Button className="botao-icone" onPress={() => mover(g, -1)} isDisabled={i === 0} aria-label={t.prateleiras.subir(g.nome)}><ArrowUp aria-hidden="true" size="1.1em" /></Button>
                <Button className="botao-icone" onPress={() => mover(g, 1)} isDisabled={i === grupos.length - 1} aria-label={t.prateleiras.descer(g.nome)}><ArrowDown aria-hidden="true" size="1.1em" /></Button>
                <Button className="botao-icone" onPress={() => aoExcluirGrupo(g)} aria-label={`${t.prateleiras.excluir}: ${g.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
              </>
            }
            arrastou={arrastou}
            aoAbrir={aoAbrir}
            aoFicha={aoFicha}
          />
        ))}

        {criando && (
          <section className="prateleira rascunho" aria-label={t.prateleiras.novo}>
            <div className="prateleira-topo">
              <NomeEditavel inicial="" rotulo={t.prateleiras.nome} aoConfirmar={(n) => void criar(n)} aoCancelar={() => setCriando(false)} />
            </div>
            <p className="prateleira-vazia">{t.prateleiras.dicaNome}</p>
          </section>
        )}

        {semGrupo.length > 0 && (
          <Prateleira
            dropId={SEM}
            nome={t.semPrateleira}
            livros={semGrupo}
            cabecalho={<span>{t.semPrateleira}</span>}
            arrastou={arrastou}
            aoAbrir={aoAbrir}
            aoFicha={aoFicha}
          />
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {ativo ? (
          <div className="livro-flutuando">
            <CapaLivro titulo={ativo.titulo} autor={ativo.autor} cor={ativo.cor} status={ativo.status} progresso={lerProgresso(ativo.id)} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Nome da prateleira editável no lugar: Enter grava, Esc cancela, sair do campo grava. */
function NomeEditavel({ inicial, rotulo, aoConfirmar, aoCancelar }: { inicial: string; rotulo: string; aoConfirmar: (nome: string) => void; aoCancelar: () => void }) {
  const feito = useRef(false);
  const fim = (acao: () => void) => {
    if (feito.current) return;
    feito.current = true;
    acao();
  };
  return (
    <input
      className="entrada-texto prateleira-nome-campo"
      defaultValue={inicial}
      placeholder={rotulo}
      aria-label={rotulo}
      maxLength={60}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); const v = e.currentTarget.value; fim(() => aoConfirmar(v)); }
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fim(aoCancelar); }
      }}
      onBlur={(e) => { const v = e.currentTarget.value; fim(() => aoConfirmar(v)); }}
    />
  );
}

/** Uma prateleira: recebe livros arrastados e mostra as capas em grade. */
function Prateleira({ dropId, nome, livros, cabecalho, acoes, arrastou, aoAbrir, aoFicha }: {
  dropId: string;
  nome: string;
  livros: Livro[];
  cabecalho: React.ReactNode;
  acoes?: React.ReactNode;
  arrastou: React.MutableRefObject<boolean>;
  aoAbrir: (l: Livro) => void;
  aoFicha: (l: Livro) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  return (
    <section ref={setNodeRef} className={isOver ? "prateleira sobre" : "prateleira"} aria-label={nome}>
      <div className="prateleira-topo">
        <h2 className="prateleira-nome">{cabecalho}</h2>
        <span className="prateleira-conta">{t.quantos(livros.length)}</span>
        {acoes && <span className="prateleira-acoes">{acoes}</span>}
      </div>
      {livros.length === 0 ? (
        <p className="prateleira-vazia">{t.prateleiraVazia}</p>
      ) : (
        <ul className="prateleira-livros">
          {livros.map((l) => (
            <LivroNaEstante key={l.id} livro={l} arrastou={arrastou} aoAbrir={() => aoAbrir(l)} aoFicha={() => aoFicha(l)} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Um livro na estante. Mouse e toque arrastam pela capa; pelo teclado, a alça
 * aparece ao receber o foco (Tab). Clicar na capa abre o livro (ou a ficha, se não houver arquivo).
 */
function LivroNaEstante({ livro, arrastou, aoAbrir, aoFicha }: { livro: Livro; arrastou: React.MutableRefObject<boolean>; aoAbrir: () => void; aoFicha: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: livro.id });
  const { onKeyDown, ...ponteiro } = listeners ?? {};
  const comArquivo = temArquivo(livro);
  return (
    <li ref={setNodeRef} className={isDragging ? "livro arrastando" : "livro"}>
      <div className="livro-capa-area" {...ponteiro}>
        <button
          type="button"
          className="livro-capa-botao"
          onClick={() => { if (!arrastou.current) aoAbrir(); }}
          aria-label={t.abrirCapa(livro.titulo, livro.autor, nomeStatus(livro.status), comArquivo)}
        >
          <CapaLivro titulo={livro.titulo} autor={livro.autor} cor={livro.cor} status={livro.status} progresso={lerProgresso(livro.id)} />
        </button>
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="livro-alca-teclado"
          {...attributes}
          aria-roledescription="livro arrastável"
          aria-label={t.arrastarAlca(livro.titulo)}
          onKeyDown={onKeyDown as React.KeyboardEventHandler | undefined}
        >
          <GripVertical aria-hidden="true" size="1.1em" />
        </button>
      </div>
      <div className="livro-legenda">
        <span className="livro-legenda-texto">
          <span className="livro-titulo">{livro.titulo}</span>
          {livro.autor && <span className="livro-autor">{livro.autor}</span>}
        </span>
        <Button className="botao-icone livro-ficha" onPress={aoFicha} aria-label={t.ficha(livro.titulo)}>
          <MoreHorizontal aria-hidden="true" size="1.2em" />
        </Button>
      </div>
    </li>
  );
}

function FormLivro({ inicial, grupos, aoFechar, aoExcluir }: { inicial: Livro; grupos: GrupoLivro[]; aoFechar: () => void; aoExcluir?: () => void }) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [autor, setAutor] = useState(inicial.autor);
  const [status, setStatus] = useState(inicial.status);
  const [grupoId, setGrupoId] = useState(inicial.grupoId);
  // Livro novo (ou sem cor guardada): a cor acompanha o título até a pessoa escolher outra.
  const [corEscolhida, setCorEscolhida] = useState<CorEtiqueta | null>(inicial.cor ? corDaCapa(inicial.cor, inicial.titulo) : null);
  const cor = corEscolhida ?? corDoTitulo(titulo || t.capaSemTitulo);
  const [progresso, setProgresso] = useState<number | null>(() => (inicial.id ? lerProgresso(inicial.id) : null));
  const [ondeParei, setOndeParei] = useState(inicial.ondeParei);
  const [impressoes, setImpressoes] = useState(inicial.impressoes);
  const [inicio, setInicio] = useState(inicial.inicio);
  const [fim, setFim] = useState(inicial.fim);
  const [caminho, setCaminho] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [lendoMeta, setLendoMeta] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idStatus = useId();
  const idGrupo = useId();
  const idProgresso = useId();
  const editando = inicial.id !== "";
  const comArquivo = inicial.arquivoId !== "" || caminho !== null;

  const escolher = async () => {
    const c = await escolherLivro();
    if (!c) return;
    setCaminho(c);
    setNomeArquivo(c.split(/[\\/]/).pop() ?? c);
    // Puxa os metadados do arquivo para preencher título e autor (se vazios).
    setLendoMeta(true);
    try {
      const b64 = await api.bytesArquivo(c);
      if (b64) {
        const fmt = c.toLowerCase().endsWith(".pdf") ? "pdf" : "epub";
        const meta = await lerMetadados(base64ParaBytes(b64), fmt);
        if (meta.titulo && !titulo.trim()) setTitulo(meta.titulo);
        if (meta.autor && !autor.trim()) setAutor(meta.autor);
      }
    } catch {
      // Sem metadados: a pessoa preenche à mão.
    } finally {
      setLendoMeta(false);
    }
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      const salvo = await api.salvarLivro({ ...inicial, titulo, autor, status, grupoId, cor, ondeParei, impressoes, inicio, fim });
      gravarProgresso(salvo.id, status === "lido" ? 100 : progresso);
      // Se escolheu um arquivo novo, anexa ao livro e guarda o formato.
      if (caminho) {
        const anexo = await api.anexarArquivo(salvo.id, caminho);
        const formato = caminho.toLowerCase().endsWith(".pdf") ? "pdf" : "epub";
        await api.salvarLivro({ ...salvo, formato, arquivoId: anexo.id });
      }
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(mensagem(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <div className="livro-ficha-topo">
        <div className="livro-ficha-capa" aria-hidden="true">
          <CapaLivro titulo={titulo} autor={autor} cor={cor} compacta />
        </div>
        <div className="livro-ficha-campos">
          <Campo rotulo={t.form.titulo} valor={titulo} aoMudar={setTitulo} autoFocus maximo={160} semDitado />
          <Campo rotulo={t.form.autor} valor={autor} aoMudar={setAutor} maximo={120} semDitado />
        </div>
      </div>
      <div className="livro-ficha-par">
        <div className="campo">
          <label className="campo-rotulo" htmlFor={idStatus}>{t.form.status}</label>
          <select id={idStatus} className="entrada-texto sozinha" value={status} onChange={(e) => setStatus(e.target.value)}>
            {ORDEM.map((st) => (
              <option key={st} value={st}>{nomeStatus(st)}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label className="campo-rotulo" htmlFor={idGrupo}>{t.prateleira}</label>
          <select id={idGrupo} className="entrada-texto sozinha" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
            <option value="">{t.semPrateleira}</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>{g.nome}</option>
            ))}
          </select>
        </div>
      </div>
      {(status === "lendo" || status === "pausado") && (
        <div className="campo">
          <label className="campo-rotulo" htmlFor={idProgresso}>{t.progresso.rotulo}</label>
          <div className="livro-ficha-progresso">
            <input
              id={idProgresso}
              type="range"
              min={0}
              max={100}
              step={5}
              value={progresso ?? 0}
              onChange={(e) => setProgresso(Number(e.target.value))}
              aria-valuetext={progresso == null ? t.progresso.semValor : t.progresso.valor(progresso)}
            />
            <output htmlFor={idProgresso} className="pequeno">{progresso == null ? t.progresso.semValor : t.progresso.valor(progresso)}</output>
            {progresso != null && (
              <Button className="botao" onPress={() => setProgresso(null)}>{t.progresso.limpar}</Button>
            )}
          </div>
          <p className="campo-ajuda">{t.progresso.ajuda}</p>
        </div>
      )}
      <EscolherCor valor={cor} aoMudar={setCorEscolhida} rotulo={t.corLivro} />
      <div className="campo">
        <span className="campo-rotulo">{t.form.arquivo}</span>
        <div className="linha-ajuste">
          <Button className={comArquivo ? "botao principal" : "botao"} onPress={() => void escolher()} isDisabled={lendoMeta}>
            {comArquivo ? (
              <><Check aria-hidden="true" size="1.1em" /> {caminho ? t.form.anexado : t.form.trocarArquivo}</>
            ) : (
              t.form.escolherArquivo
            )}
          </Button>
          <span className="texto-suave quebra">
            {lendoMeta ? t.form.lendoMeta : nomeArquivo || (inicial.arquivoId ? t.form.arquivoEscolhido : t.form.semArquivo)}
          </span>
        </div>
      </div>
      <Campo rotulo={t.ondeParei} valor={ondeParei} aoMudar={setOndeParei} multilinha />
      <Campo rotulo={t.impressoes} valor={impressoes} aoMudar={setImpressoes} multilinha />
      <div className="livro-ficha-par">
        <CampoData rotulo={t.inicio} tipo="date" valor={inicio} aoMudar={setInicio} />
        <CampoData rotulo={t.fim} tipo="date" valor={fim} aoMudar={setFim} />
      </div>
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes livro-ficha-acoes">
        {editando && aoExcluir && (
          <Button className="botao livro-ficha-apagar" onPress={aoExcluir}><Trash2 aria-hidden="true" size="1.1em" /> {t.excluir}</Button>
        )}
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.form.salvarMudancas : t.form.salvar}</Button>
      </div>
    </Form>
  );
}
