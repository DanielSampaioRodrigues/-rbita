import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button, Form } from "react-aria-components";
import { Leitor, CONFIG_PADRAO } from "@orbita/leitor";
import { caminhoDeTraco, FERRAMENTAS, fragmentosAoApagar, type Cena, type Ponto, type Traco } from "@orbita/caderno";
import { api, escolherArquivoParaAnexar, escolherOndeSalvarAnexo, type Anexo, type CartaoQuadro, type Hobby, type TipoCartao } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoRico } from "../componentes/CampoRico";
import { TextoRico } from "../componentes/TextoRico";
import { Confirmar, Janela } from "../componentes/Janela";
import { ImagemAnexo } from "../relacoes/Relacoes";
import { Check, ChevronLeft, Download, Eraser, ExternalLink, FileText, FileUp, GripVertical, ImagePlus, LayoutGrid, Link2, Mic, Palette, Pencil, PenLine, Plus, Sparkles, StickyNote, Trash2, Undo2, X } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { PALETA_ORG } from "../organizacao/cores";
import {
  amostraGradiente, aparenciaPadrao, CORES_CARTAO, encaixar, estiloFundo, FONTES_CARTAO, GRADIENTES_QUADRO, LIMITE_FUNDO_BYTES, lerQuadro, PADROES_FUNDO,
  serializarQuadro, TINTAS, TIPOS_FUNDO, visualDoCartao, type AparenciaQuadro, type EstiloCartao, type FundoQuadro,
} from "./aparencia";
import { base64ParaBytes, bytesParaBase64, dadosParaBlobUrl, escolherMimeAudio, extensaoDoMime, mimeDaExtensao, motivoErroMic, reduzirImagem } from "./midia";

const t = textos.hobbies;
const tq = t.quadro;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));
const EXT_AUDIO = ["mp3", "m4a", "wav", "ogg", "oga", "webm", "aac", "flac", "opus"];
const ehNomePdf = (nome: string) => nome.toLowerCase().endsWith(".pdf");
const semExtensao = (nome: string) => nome.replace(/\.[^.]+$/, "").slice(0, 60) || "imagem";

/** O tipo de cartão a partir do anexo: imagem, áudio (pela extensão) ou arquivo. */
function tipoDoAnexo(anexo: Anexo): TipoCartao {
  if (anexo.tipo === "imagem") return "imagem";
  const ext = anexo.nome.split(".").pop()?.toLowerCase() ?? "";
  return EXT_AUDIO.includes(ext) ? "audio" : "arquivo";
}

export function PaginaHobbies() {
  const [hobbies, setHobbies] = useState<Hobby[]>([]);
  const [editando, setEditando] = useState<Hobby | null>(null);
  const [excluindo, setExcluindo] = useState<Hobby | null>(null);
  const [aberto, setAberto] = useState<Hobby | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarHobbies().then(setHobbies, (e) => setErro(mensagem(e)));
  }, [mudancas]);

  const excluir = async () => {
    if (!excluindo) return;
    await api.excluirHobby(excluindo.id);
    setExcluindo(null);
    avisarMudanca();
  };

  const abertoAtual = aberto ? hobbies.find((h) => h.id === aberto.id) ?? aberto : null;
  if (abertoAtual) return <QuadroHobby hobby={abertoAtual} aoFechar={() => setAberto(null)} />;

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <div className="botoes">
        <Button className="botao principal" onPress={() => setEditando({ id: "", nome: "", notas: "", criadoEm: 0 })}>
          <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
        </Button>
      </div>

      {hobbies.length === 0 ? (
        <section className="cartao largura-leitura esticado"><p className="texto-suave">{t.semHobbies}</p></section>
      ) : (
        hobbies.map((h) => (
          <section key={h.id} className="cartao largura-leitura esticado" aria-labelledby={`hobby-${h.id}`}>
            <div className="linha-ajuste">
              <h2 id={`hobby-${h.id}`}>
                <Sparkles aria-hidden="true" size="1em" /> {h.nome}
              </h2>
              <span className="linha-ajuste">
                <Button className="botao" onPress={() => setAberto(h)}>{t.abrirQuadro}</Button>
                <Button className="botao-icone" onPress={() => setEditando(h)} aria-label={`${t.editar}: ${h.nome}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
                <Button className="botao-icone" onPress={() => setExcluindo(h)} aria-label={`${t.excluir}: ${h.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
              </span>
            </div>
            {h.notas && <p className="quebra">{h.notas}</p>}
          </section>
        ))
      )}

      <Aviso>{erro}</Aviso>

      <Janela titulo={editando && editando.id ? t.form.editarTitulo : t.form.novo} aberta={editando !== null} aoFechar={() => setEditando(null)}>
        {editando && <FormHobby key={editando.id || "novo"} inicial={editando} aoFechar={() => setEditando(null)} />}
      </Janela>

      <Confirmar titulo={t.excluir} texto={excluindo ? t.confirmarExcluir(excluindo.nome) : ""} confirmar={t.excluir} aberta={excluindo !== null} aoCancelar={() => setExcluindo(null)} aoConfirmar={() => void excluir()} />
    </div>
  );
}

function FormHobby({ inicial, aoFechar }: { inicial: Hobby; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [notas, setNotas] = useState(inicial.notas);
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarHobby({ ...inicial, nome, notas });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(mensagem(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.form.nome} valor={nome} aoMudar={setNome} autoFocus maximo={120} semDitado />
      <Campo rotulo={t.form.notas} valor={notas} aoMudar={setNotas} multilinha descricao={t.form.notasAjuda} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.form.salvarMudancas : t.form.salvar}</Button>
      </div>
    </Form>
  );
}

const TAMANHO_PADRAO: Record<TipoCartao, { largura: number; altura: number }> = {
  texto: { largura: 240, altura: 168 },
  imagem: { largura: 200, altura: 200 },
  arquivo: { largura: 208, altura: 96 },
  link: { largura: 208, altura: 96 },
  audio: { largura: 264, altura: 96 },
  desenho: { largura: 0, altura: 0 },
};
const CORES_DESENHO = ["#1f2937", "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#ca8a04"];
const REDIMENSIONAVEL: TipoCartao[] = ["texto", "imagem"];
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const limitarZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
/** Lado maior da miniatura das imagens no quadro (o original fica guardado para ampliar). */
const MINI_MAX = 720;
/** Lado maior da imagem de fundo depois de reduzida. */
const FUNDO_MAX = 2400;

// Caches da sessão: miniaturas (pequenas) e áudios (endereços de blob). Fechar e
// abrir o quadro de novo não precisa ler e decodificar tudo outra vez.
const cacheMini = new Map<string, string>();
const guardarNoCache = (id: string, url: string) => {
  if (cacheMini.size > 300) cacheMini.delete(cacheMini.keys().next().value as string);
  cacheMini.set(id, url);
};
const gerandoMini = new Set<string>();
const cacheAudio = new Map<string, string>();
const guardarAudio = (id: string, url: string) => {
  if (cacheAudio.size >= 24) {
    const velho = cacheAudio.keys().next().value as string;
    URL.revokeObjectURL(cacheAudio.get(velho)!);
    cacheAudio.delete(velho);
  }
  cacheAudio.set(id, url);
};

/** O que os cartões pedem ao quadro. Fica numa ref estável: mexer em um cartão não redesenha os outros. */
interface AcoesQuadro {
  zoom: number;
  grade: boolean;
  mover: (id: string, x: number, y: number) => void;
  redimensionar: (id: string, largura: number, altura: number) => void;
  apagar: (id: string) => void;
  abrir: (id: string) => void;
  salvarTexto: (id: string, texto: string) => void;
  personalizar: (id: string) => void;
  guardarMini: (cartaoId: string, reduzida: { base64: string; ext: string; url: string } | null, original: string) => void;
}

/** O quadro livre de um hobby: cartões soltos que a pessoa arrasta e organiza. */
function QuadroHobby({ hobby, aoFechar }: { hobby: Hobby; aoFechar: () => void }) {
  const hobbyId = hobby.id;
  const [cartoes, setCartoes] = useState<CartaoQuadro[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [link, setLink] = useState<{ nome: string; endereco: string } | null>(null);
  const [gravando, setGravando] = useState(false);
  const [prevendo, setPrevendo] = useState<CartaoQuadro | null>(null);
  const [personalizando, setPersonalizando] = useState<string | null>(null);
  const [editandoFundo, setEditandoFundo] = useState(false);
  const [zoom, setZoom] = useState(1);
  // Camada de desenho sobre o quadro todo (rabisco à mão, tipo quadro branco).
  const [cena, setCena] = useState<Cena>({ elementos: [] });
  const [aparencia, setAparencia] = useState<AparenciaQuadro>(aparenciaPadrao);
  const [desenhando, setDesenhando] = useState(false);
  const [ferrD, setFerrD] = useState<"caneta" | "borracha">("caneta");
  const [corD, setCorD] = useState("#1f2937");
  const [tamD, setTamD] = useState(3);
  const [urlFundo, setUrlFundo] = useState<string | null>(null);
  const recado = useRecado();

  const cartoesRef = useRef(cartoes);
  cartoesRef.current = cartoes;
  const cenaRef = useRef(cena);
  const aparenciaRef = useRef(aparencia);
  const zoomRef = useRef(zoom);
  const desenhandoRef = useRef(desenhando);
  desenhandoRef.current = desenhando;
  const cenaId = useRef("");
  const carregado = useRef(false);
  const timerSalvar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filaSalvar = useRef<Promise<unknown>>(Promise.resolve());
  const histCena = useRef<Cena[]>([]);
  const rolagemRef = useRef<HTMLDivElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const ancora = useRef<{ cx: number; cy: number; ax: number; ay: number } | null>(null);

  const carregar = useCallback(
    () =>
      api.listarCartoes(hobbyId).then((cs) => {
        setCartoes(cs.filter((c) => c.tipo !== "desenho"));
        const d = cs.find((c) => c.tipo === "desenho");
        if (d) cenaId.current = d.id;
        // Só na primeira leitura: depois, o que vale é o que está na tela (pode ter
        // traço ainda esperando para ser guardado).
        if (!carregado.current) {
          carregado.current = true;
          if (d) {
            const q = lerQuadro(d.texto);
            cenaRef.current = q.cena;
            aparenciaRef.current = q.aparencia;
            setCena(q.cena);
            setAparencia(q.aparencia);
          }
        }
      }, (e) => setErro(mensagem(e))),
    [hobbyId],
  );
  useEffect(() => void carregar(), [carregar]);

  // Desenho e aparência vão juntos no cartão "desenho". Uma gravação por vez, em fila,
  // para nunca criar dois cartões de desenho.
  const salvarQuadroAgora = useCallback(() => {
    if (timerSalvar.current) clearTimeout(timerSalvar.current);
    timerSalvar.current = null;
    const texto = serializarQuadro(cenaRef.current, aparenciaRef.current);
    filaSalvar.current = filaSalvar.current
      .then(() => api.salvarCartao({ id: cenaId.current, hobbyId, tipo: "desenho", texto, anexoId: "", x: 0, y: 0, largura: 0, altura: 0, criadoEm: 0 }))
      .then((c) => { cenaId.current = c.id; })
      .catch((e) => setErro(mensagem(e)));
  }, [hobbyId]);
  const agendarSalvar = useCallback(() => {
    if (timerSalvar.current) clearTimeout(timerSalvar.current);
    timerSalvar.current = setTimeout(salvarQuadroAgora, 600);
  }, [salvarQuadroAgora]);
  // Ao fechar o quadro, guarda na hora o que ainda estava esperando.
  useEffect(() => () => { if (timerSalvar.current) salvarQuadroAgora(); }, [salvarQuadroAgora]);

  const mudarCena = useCallback((nova: Cena) => {
    histCena.current = [...histCena.current.slice(-30), cenaRef.current];
    cenaRef.current = nova;
    setCena(nova);
    agendarSalvar();
  }, [agendarSalvar]);
  const desfazerCena = () => {
    const ant = histCena.current.pop();
    if (!ant) return;
    cenaRef.current = ant;
    setCena(ant);
    agendarSalvar();
  };
  const limparCena = () => { if (cenaRef.current.elementos.length) mudarCena({ elementos: [] }); };
  const aoDesenhar = useCallback((tr: Traco) => mudarCena({ elementos: [...cenaRef.current.elementos, tr] }), [mudarCena]);

  const mudarAparencia = useCallback((f: (a: AparenciaQuadro) => AparenciaQuadro) => {
    const nova = f(aparenciaRef.current);
    aparenciaRef.current = nova;
    setAparencia(nova);
    agendarSalvar();
  }, [agendarSalvar]);
  const mudarEstiloCartao = useCallback((id: string, mudanca: Partial<EstiloCartao>) => {
    mudarAparencia((a) => {
      const novo: EstiloCartao = { ...a.cartoes[id], ...mudanca };
      for (const k of Object.keys(novo) as (keyof EstiloCartao)[]) if (!novo[k]) delete novo[k];
      const cartoesNovos = { ...a.cartoes };
      if (Object.keys(novo).length) cartoesNovos[id] = novo;
      else delete cartoesNovos[id];
      return { ...a, cartoes: cartoesNovos };
    });
  }, [mudarAparencia]);

  // Imagem de fundo: endereço de blob (leve), liberado ao trocar.
  const idFundo = aparencia.fundo.tipo === "imagem" ? aparencia.fundo.imagem : "";
  useEffect(() => {
    if (!idFundo) { setUrlFundo(null); return; }
    let vivo = true;
    let url: string | null = null;
    api.imagemAnexo(idFundo).then((dados) => {
      if (!vivo) return;
      url = dadosParaBlobUrl(dados);
      setUrlFundo(url);
    }, () => vivo && setUrlFundo(null));
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [idFundo]);

  // ── Zoom (botões, Ctrl + roda do mouse, pinça com dois dedos) ──
  const zoomEm = useCallback((novo: number, ax?: number, ay?: number) => {
    const el = rolagemRef.current;
    const z0 = zoomRef.current;
    const z1 = limitarZoom(novo);
    if (z1 === z0) return;
    if (el) {
      const px = ax ?? el.clientWidth / 2;
      const py = ay ?? el.clientHeight / 2;
      const topo = caixaRef.current?.offsetTop ?? 0;
      ancora.current = { cx: (el.scrollLeft + px) / z0, cy: (el.scrollTop + py - topo) / z0, ax: px, ay: py };
    }
    zoomRef.current = z1;
    setZoom(z1);
  }, []);
  useLayoutEffect(() => {
    const a = ancora.current;
    const el = rolagemRef.current;
    if (!a || !el) return;
    ancora.current = null;
    const topo = caixaRef.current?.offsetTop ?? 0;
    el.scrollLeft = a.cx * zoom - a.ax;
    el.scrollTop = a.cy * zoom + topo - a.ay;
  }, [zoom]);
  useEffect(() => {
    const el = rolagemRef.current;
    if (!el) return;
    const aoRoda = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      zoomEm(zoomRef.current * Math.exp(-delta * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    const toques = new Map<number, { x: number; y: number }>();
    let pinca: { dist: number; zoom: number } | null = null;
    const par = () => [...toques.values()].slice(0, 2);
    const distancia = () => { const [a, b] = par(); return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    const desce = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || desenhandoRef.current) return;
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toques.size === 2) pinca = { dist: distancia(), zoom: zoomRef.current };
    };
    const move = (e: PointerEvent) => {
      if (!toques.has(e.pointerId)) return;
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!pinca || toques.size !== 2) return;
      const [a, b] = par();
      const r = el.getBoundingClientRect();
      zoomEm(pinca.zoom * (distancia() / pinca.dist), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    };
    const sobe = (e: PointerEvent) => {
      toques.delete(e.pointerId);
      if (toques.size < 2) pinca = null;
    };
    // Safari (iPad): impede o zoom da página inteira; o zoom é do quadro.
    const gesto = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", aoRoda, { passive: false });
    el.addEventListener("pointerdown", desce, true);
    el.addEventListener("pointermove", move, true);
    el.addEventListener("pointerup", sobe, true);
    el.addEventListener("pointercancel", sobe, true);
    el.addEventListener("gesturestart", gesto);
    el.addEventListener("gesturechange", gesto);
    return () => {
      el.removeEventListener("wheel", aoRoda);
      el.removeEventListener("pointerdown", desce, true);
      el.removeEventListener("pointermove", move, true);
      el.removeEventListener("pointerup", sobe, true);
      el.removeEventListener("pointercancel", sobe, true);
      el.removeEventListener("gesturestart", gesto);
      el.removeEventListener("gesturechange", gesto);
    };
  }, [zoomEm]);

  /** Novo cartão aparece na parte do quadro que está à vista. */
  const proximaPos = () => {
    const el = rolagemRef.current;
    const z = zoomRef.current;
    const n = cartoesRef.current.length % 6;
    const baseX = el ? el.scrollLeft / z : 0;
    const baseY = el ? el.scrollTop / z : 0;
    const grade = aparenciaRef.current.grade;
    return { x: encaixar(baseX + 40 + n * 32, grade), y: encaixar(baseY + 40 + n * 32, grade) };
  };

  const criarCartao = async (tipo: TipoCartao, extra: Partial<CartaoQuadro>) => {
    const pos = proximaPos();
    const tam = TAMANHO_PADRAO[tipo];
    const novo = await api.salvarCartao({ id: "", hobbyId, tipo, texto: "", anexoId: "", x: pos.x, y: pos.y, largura: tam.largura, altura: tam.altura, criadoEm: 0, ...extra });
    await carregar();
    return novo;
  };

  const comOcupado = async (acao: () => Promise<unknown>) => {
    setErro(null);
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  };

  /** Miniatura da imagem para o quadro; o original fica guardado para ampliar. */
  const prepararMini = async (anexo: Anexo): Promise<string> => {
    try {
      const dados = await api.imagemAnexo(anexo.id);
      const r = await reduzirImagem(dados, MINI_MAX);
      if (!r) {
        guardarNoCache(anexo.id, dados);
        return anexo.id;
      }
      const mini = await api.anexarBytes(hobbyId, `miniatura-${semExtensao(anexo.nome)}.${r.ext}`, r.base64);
      guardarNoCache(mini.id, r.url);
      return mini.id;
    } catch {
      return "";
    }
  };

  const adicionarArquivo = (soImagens: boolean) =>
    comOcupado(async () => {
      const caminho = await escolherArquivoParaAnexar(soImagens);
      if (!caminho) return;
      const anexo = await api.anexarArquivo(hobbyId, caminho);
      const tipo = tipoDoAnexo(anexo);
      const mini = tipo === "imagem" ? await prepararMini(anexo) : "";
      const novo = await criarCartao(tipo, { anexoId: anexo.id, texto: anexo.nome });
      if (mini) mudarEstiloCartao(novo.id, { mini });
    });

  const adicionarAudioExistente = () =>
    comOcupado(async () => {
      const caminho = await escolherArquivoParaAnexar(false);
      if (!caminho) return;
      const anexo = await api.anexarArquivo(hobbyId, caminho);
      await criarCartao("audio", { anexoId: anexo.id, texto: anexo.nome });
      setGravando(false);
    });

  const adicionarLinkConfirmar = (nome: string, endereco: string) =>
    comOcupado(async () => {
      const anexo = await api.anexarLink(hobbyId, nome, endereco);
      await criarCartao("link", { anexoId: anexo.id, texto: anexo.nome });
      setLink(null);
    });

  const adicionarAudioGravado = (anexo: Anexo) =>
    comOcupado(async () => {
      await criarCartao("audio", { anexoId: anexo.id, texto: anexo.nome });
      setGravando(false);
    });

  const escolherImagemFundo = async () => {
    const caminho = await escolherArquivoParaAnexar(true);
    if (!caminho) return;
    const anexo = await api.anexarArquivo(hobbyId, caminho);
    if (anexo.tipo !== "imagem") {
      await api.excluirAnexo(anexo.id).catch(() => {});
      throw new Error(tq.fundo.naoImagem);
    }
    if (anexo.tamanho > LIMITE_FUNDO_BYTES) {
      await api.excluirAnexo(anexo.id).catch(() => {});
      throw new Error(tq.fundo.grande);
    }
    let id = anexo.id;
    const r = await reduzirImagem(await api.imagemAnexo(anexo.id), FUNDO_MAX);
    if (r) {
      const reduzida = await api.anexarBytes(hobbyId, `fundo-${semExtensao(anexo.nome)}.${r.ext}`, r.base64);
      await api.excluirAnexo(anexo.id).catch(() => {});
      id = reduzida.id;
    }
    const antiga = aparenciaRef.current.fundo.imagem;
    mudarAparencia((a) => ({ ...a, fundo: { ...a.fundo, tipo: "imagem", imagem: id } }));
    if (antiga && antiga !== id) api.excluirAnexo(antiga).catch(() => {});
  };

  // Ações dos cartões: a ref sempre aponta para as funções atuais.
  const acoes = useRef<AcoesQuadro>(null!);
  acoes.current = {
    zoom,
    grade: aparencia.grade,
    mover: (id, x, y) => {
      setCartoes((cs) => cs.map((c) => (c.id === id ? { ...c, x, y } : c)));
      api.moverCartao(id, x, y).catch((e) => setErro(mensagem(e)));
    },
    redimensionar: (id, largura, altura) => {
      const c = cartoesRef.current.find((x) => x.id === id);
      if (!c) return;
      setCartoes((cs) => cs.map((x) => (x.id === id ? { ...x, largura, altura } : x)));
      api.salvarCartao({ ...c, largura, altura }).catch((e) => setErro(mensagem(e)));
    },
    apagar: (id) => {
      const c = cartoesRef.current.find((x) => x.id === id);
      if (!c) return;
      void (async () => {
        try {
          await api.excluirCartao(id);
          const mini = aparenciaRef.current.cartoes[id]?.mini;
          if (mini && mini !== c.anexoId) api.excluirAnexo(mini).catch(() => {});
          if (aparenciaRef.current.cartoes[id]) mudarAparencia((a) => { const resto = { ...a.cartoes }; delete resto[id]; return { ...a, cartoes: resto }; });
          setCartoes((cs) => cs.filter((x) => x.id !== id));
          recado(tq.apagado);
        } catch (e) {
          setErro(mensagem(e));
        }
      })();
    },
    abrir: (id) => {
      const c = cartoesRef.current.find((x) => x.id === id);
      if (!c) return;
      if (c.tipo === "link") void api.abrirAnexo(c.anexoId);
      else setPrevendo(c);
    },
    salvarTexto: (id, texto) => {
      const c = cartoesRef.current.find((x) => x.id === id);
      if (!c) return;
      setCartoes((cs) => cs.map((x) => (x.id === id ? { ...x, texto } : x)));
      api.salvarCartao({ ...c, texto }).catch((e) => setErro(mensagem(e)));
    },
    personalizar: (id) => setPersonalizando(id),
    guardarMini: (cartaoId, reduzida, original) => {
      if (!reduzida) {
        mudarEstiloCartao(cartaoId, { mini: original });
        return;
      }
      api.anexarBytes(hobbyId, `miniatura.${reduzida.ext}`, reduzida.base64).then((a) => {
        guardarNoCache(a.id, reduzida.url);
        mudarEstiloCartao(cartaoId, { mini: a.id });
      }, () => {});
    },
  };

  const { largura, altura } = useMemo(() => ({
    largura: Math.max(1200, ...cartoes.map((c) => c.x + c.largura + 80)),
    altura: Math.max(800, ...cartoes.map((c) => c.y + c.altura + 80)),
  }), [cartoes]);

  const estiloDoFundo = useMemo(() => estiloFundo(aparencia.fundo, urlFundo), [aparencia.fundo, urlFundo]);
  const cartaoPersonalizando = personalizando ? cartoes.find((c) => c.id === personalizando) ?? null : null;
  const pct = Math.round(zoom * 100);

  return (
    <div className="quadro-hobby">
      <div className="leitor-barra">
        <Button className="botao-icone" onPress={aoFechar} aria-label={tq.voltar}><ChevronLeft aria-hidden="true" size="1.2em" /></Button>
        <strong className="leitor-titulo quebra"><Sparkles aria-hidden="true" size="1em" /> {hobby.nome}</strong>
        <div className="leitor-controles">
          <Button className="botao pequeno com-icone" onPress={() => void comOcupado(() => criarCartao("texto", {}))} isDisabled={ocupado}><StickyNote aria-hidden="true" size="1em" /> {tq.adicionarTexto}</Button>
          <Button className="botao pequeno com-icone" onPress={() => void adicionarArquivo(false)} isDisabled={ocupado}><FileText aria-hidden="true" size="1em" /> {tq.adicionarArquivo}</Button>
          <Button className="botao pequeno com-icone" onPress={() => void adicionarArquivo(true)} isDisabled={ocupado}><ImagePlus aria-hidden="true" size="1em" /> {tq.adicionarImagem}</Button>
          <Button className="botao pequeno com-icone" onPress={() => (setErro(null), setLink({ nome: "", endereco: "" }))} isDisabled={ocupado}><Link2 aria-hidden="true" size="1em" /> {tq.adicionarLink}</Button>
          <Button className="botao pequeno com-icone" onPress={() => (setErro(null), setGravando(true))} isDisabled={ocupado}><Mic aria-hidden="true" size="1em" /> {tq.adicionarAudio}</Button>
          <Button className={desenhando ? "botao pequeno com-icone principal" : "botao pequeno com-icone"} onPress={() => setDesenhando((v) => !v)} aria-pressed={desenhando}><PenLine aria-hidden="true" size="1em" /> {tq.desenhar}</Button>
          <Button className="botao pequeno com-icone" onPress={() => setEditandoFundo(true)}><Palette aria-hidden="true" size="1em" /> {tq.fundo.botao}</Button>
          <Button className={aparencia.grade ? "botao pequeno com-icone principal" : "botao pequeno com-icone"} onPress={() => mudarAparencia((a) => ({ ...a, grade: !a.grade }))} aria-pressed={aparencia.grade} aria-label={tq.grade.rotulo}>
            <LayoutGrid aria-hidden="true" size="1em" /> {tq.grade.botao}
          </Button>
          <span className="hobby-zoom" role="group" aria-label={tq.zoom.grupo}>
            <Button className="botao-icone pequeno" onPress={() => zoomEm(zoomRef.current / 1.2)} isDisabled={zoom <= ZOOM_MIN} aria-label={tq.zoom.menos}><span aria-hidden="true">−</span></Button>
            <Button className="botao pequeno hobby-zoom-valor" onPress={() => zoomEm(1)} aria-label={tq.zoom.normal(pct)}>{pct}%</Button>
            <Button className="botao-icone pequeno" onPress={() => zoomEm(zoomRef.current * 1.2)} isDisabled={zoom >= ZOOM_MAX} aria-label={tq.zoom.mais}><Plus aria-hidden="true" size="1em" /></Button>
          </span>
        </div>
      </div>

      {desenhando && (
        <div className="quadro-desenho-barra" role="toolbar" aria-label={tq.desenhar}>
          <Button className={ferrD === "caneta" ? "botao-icone ativo" : "botao-icone"} onPress={() => setFerrD("caneta")} aria-label={tq.caneta} aria-pressed={ferrD === "caneta"}><PenLine aria-hidden="true" size="1.1em" /></Button>
          <Button className={ferrD === "borracha" ? "botao-icone ativo" : "botao-icone"} onPress={() => setFerrD("borracha")} aria-label={tq.borracha} aria-pressed={ferrD === "borracha"}><Eraser aria-hidden="true" size="1.1em" /></Button>
          <span className="quadro-desenho-cores" role="group" aria-label={tq.cor}>
            {CORES_DESENHO.map((c) => (
              <button key={c} type="button" className={corD.toLowerCase() === c.toLowerCase() ? "caderno-cor atual" : "caderno-cor"} style={{ background: c }} onClick={() => { setCorD(c); setFerrD("caneta"); }} aria-label={c} aria-pressed={corD.toLowerCase() === c.toLowerCase()} />
            ))}
            <label className="caderno-cor-escolher" title={tq.cor}>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(corD) ? corD : "#000000"} onChange={(e) => { setCorD(e.target.value); setFerrD("caneta"); }} aria-label={tq.cor} />
              <Plus aria-hidden="true" size="1em" />
            </label>
          </span>
          <input type="range" min={1} max={14} step={1} value={tamD} onChange={(e) => setTamD(Number(e.target.value))} aria-label={tq.tamanho} className="quadro-desenho-tam" />
          <Button className="botao-icone" onPress={desfazerCena} aria-label={tq.desfazer}><Undo2 aria-hidden="true" size="1.1em" /></Button>
          <Button className="botao-icone" onPress={limparCena} aria-label={tq.limpar}><Trash2 aria-hidden="true" size="1.1em" /></Button>
          <Button className="botao pequeno com-icone principal" onPress={() => setDesenhando(false)}><Check aria-hidden="true" size="1em" /> {tq.pronto}</Button>
        </div>
      )}

      {erro && <div className="leitor-aviso"><Aviso>{erro}</Aviso></div>}
      {ocupado && <p className="leitor-aviso texto-suave">{tq.anexando}</p>}

      <div className="hobby-palco">
        <div className={`hobby-fundo-camada hobby-fundo-${aparencia.fundo.tipo}`} style={estiloDoFundo} aria-hidden="true" />
        <div className="quadro-rolagem hobby-rolagem" ref={rolagemRef}>
          {cartoes.length === 0 ? (
            <p className="texto-suave quadro-vazio hobby-vazio">{tq.vazio}</p>
          ) : (
            <p className="texto-suave pequeno quadro-dica">{tq.dica}</p>
          )}
          <div className="hobby-zoom-caixa" ref={caixaRef} style={{ width: largura * zoom, height: altura * zoom }}>
            <div
              className={`quadro-chao hobby-chao hobby-padrao-${aparencia.fundo.padrao}${aparencia.grade ? " hobby-com-grade" : ""}${desenhando ? " desenhando" : ""}`}
              style={{ width: largura, height: altura, transform: zoom === 1 ? undefined : `scale(${zoom})` }}
            >
              {cartoes.map((c) => (
                <CartaoView key={c.id} cartao={c} estilo={aparencia.cartoes[c.id]} acoes={acoes} />
              ))}
              <CamadaDesenhoQuadro cena={cena} largura={largura} altura={altura} ativo={desenhando} ferramenta={ferrD} cor={corD} tamanho={tamD}
                aoDesenhar={aoDesenhar} aoApagarCena={mudarCena} />
            </div>
          </div>
        </div>
      </div>

      <Janela titulo={tq.link.titulo} aberta={link !== null} aoFechar={() => setLink(null)}>
        {link && (
          <Form className="formulario" onSubmit={(ev) => { ev.preventDefault(); void adicionarLinkConfirmar(link.nome, link.endereco); }}>
            <Campo rotulo={tq.link.endereco} valor={link.endereco} aoMudar={(v) => setLink({ ...link, endereco: v })} descricao={tq.link.exemplo} autoFocus semDitado />
            <Campo rotulo={tq.link.nome} valor={link.nome} aoMudar={(v) => setLink({ ...link, nome: v })} maximo={120} semDitado />
            <div className="janela-acoes">
              <Button className="botao" onPress={() => setLink(null)}>{textos.comum.cancelar}</Button>
              <Button className="botao principal" type="submit" isDisabled={!link.endereco.trim() || ocupado}>{tq.link.adicionar}</Button>
            </div>
          </Form>
        )}
      </Janela>

      <Janela titulo={tq.audio.titulo} aberta={gravando} aoFechar={() => setGravando(false)}>
        {gravando && <GravadorAudio hobbyId={hobbyId} aoGravado={adicionarAudioGravado} aoAnexarExistente={adicionarAudioExistente} aoFechar={() => setGravando(false)} />}
      </Janela>

      <Janela titulo={tq.fundo.titulo} aberta={editandoFundo} aoFechar={() => setEditandoFundo(false)}>
        {editandoFundo && (
          <EditorFundo fundo={aparencia.fundo} urlImagem={urlFundo}
            aoMudar={(f) => mudarAparencia((a) => ({ ...a, fundo: { ...a.fundo, ...f } }))}
            aoEscolherImagem={escolherImagemFundo} aoFechar={() => setEditandoFundo(false)} />
        )}
      </Janela>

      <Janela titulo={tq.cartao.titulo} aberta={cartaoPersonalizando !== null} aoFechar={() => setPersonalizando(null)}>
        {cartaoPersonalizando && (
          <EditorCartao cartao={cartaoPersonalizando} estilo={aparencia.cartoes[cartaoPersonalizando.id]}
            aoMudar={(m) => mudarEstiloCartao(cartaoPersonalizando.id, m)} aoFechar={() => setPersonalizando(null)} />
        )}
      </Janela>

      {prevendo && <PreviaArquivo cartao={prevendo} aoFechar={() => setPrevendo(null)} />}
    </div>
  );
}

/** Um cartão solto no quadro: arrastável (mouse, toque, caneta e teclado) e redimensionável.
 *  Fica memorizado: arrastar um cartão não redesenha os outros. */
const CartaoView = memo(function CartaoView({ cartao, estilo, acoes }: {
  cartao: CartaoQuadro;
  estilo: EstiloCartao | undefined;
  acoes: React.RefObject<AcoesQuadro>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(cartao.texto);
  // Arraste e redimensionamento mexem direto no DOM (sem re-render a cada quadro).
  const arraste = useRef<{ px: number; py: number; ox: number; oy: number; mexeu: boolean } | null>(null);
  const tamanho = useRef<{ px: number; py: number; w: number; h: number } | null>(null);
  const visual = useMemo(() => visualDoCartao(estilo), [estilo]);

  const aoApontarMover = (e: React.PointerEvent<HTMLElement>) => {
    if (editando || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arraste.current = { px: e.clientX, py: e.clientY, ox: cartao.x, oy: cartao.y, mexeu: false };
    ref.current?.classList.add("hobby-arrastando");
  };
  const aoMoverPonteiro = (e: React.PointerEvent) => {
    const a = arraste.current;
    const el = ref.current;
    if (!a || !el) return;
    const z = acoes.current.zoom || 1;
    a.mexeu = true;
    el.style.left = `${Math.max(0, a.ox + (e.clientX - a.px) / z)}px`;
    el.style.top = `${Math.max(0, a.oy + (e.clientY - a.py) / z)}px`;
  };
  const aoSoltar = () => {
    const a = arraste.current;
    const el = ref.current;
    if (!a || !el) return;
    arraste.current = null;
    el.classList.remove("hobby-arrastando");
    if (!a.mexeu) return;
    const grade = acoes.current.grade;
    const x = encaixar(parseFloat(el.style.left), grade);
    const y = encaixar(parseFloat(el.style.top), grade);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (x !== cartao.x || y !== cartao.y) acoes.current.mover(cartao.id, x, y);
  };

  const aoApontarTamanho = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    tamanho.current = { px: e.clientX, py: e.clientY, w: cartao.largura, h: cartao.altura };
  };
  const aoTamanhoPonteiro = (e: React.PointerEvent) => {
    const r = tamanho.current;
    const el = ref.current;
    if (!r || !el) return;
    const z = acoes.current.zoom || 1;
    el.style.width = `${Math.max(140, r.w + (e.clientX - r.px) / z)}px`;
    el.style.height = `${Math.max(88, r.h + (e.clientY - r.py) / z)}px`;
  };
  const aoTamanhoSoltar = () => {
    const r = tamanho.current;
    const el = ref.current;
    if (!r || !el) return;
    tamanho.current = null;
    const grade = acoes.current.grade;
    const w = Math.max(140, encaixar(parseFloat(el.style.width), grade));
    const h = Math.max(88, encaixar(parseFloat(el.style.height), grade));
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    if (w !== cartao.largura || h !== cartao.altura) acoes.current.redimensionar(cartao.id, w, h);
  };

  const aoTecla = (e: React.KeyboardEvent) => {
    const grade = acoes.current.grade;
    const passo = grade ? (e.shiftKey ? 32 : 8) : e.shiftKey ? 40 : 12;
    const mover = (x: number, y: number) => acoes.current.mover(cartao.id, encaixar(x, grade), encaixar(y, grade));
    if (e.key === "ArrowLeft") mover(cartao.x - passo, cartao.y);
    else if (e.key === "ArrowRight") mover(cartao.x + passo, cartao.y);
    else if (e.key === "ArrowUp") mover(cartao.x, cartao.y - passo);
    else if (e.key === "ArrowDown") mover(cartao.x, cartao.y + passo);
    else if (e.key === "Delete" || e.key === "Backspace") acoes.current.apagar(cartao.id);
    else return;
    e.preventDefault();
  };

  const redimensionavel = REDIMENSIONAVEL.includes(cartao.tipo);
  const estiloPos: React.CSSProperties = { ...visual.estilo, left: cartao.x, top: cartao.y, width: cartao.largura };
  if (redimensionavel) estiloPos.height = cartao.altura;
  const nome = cartao.texto.replace(/[#*_`>[\]]/g, "").slice(0, 60) || tq.tipos[cartao.tipo];

  return (
    <div ref={ref} className={`quadro-cartao-livre hobby-cartao${visual.classe}`} style={estiloPos}>
      <div className="quadro-cartao-barra">
        <span
          className="quadro-alca"
          role="button"
          tabIndex={0}
          aria-label={`${tq.mover}: ${nome}`}
          onPointerDown={aoApontarMover}
          onPointerMove={aoMoverPonteiro}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
          onKeyDown={aoTecla}
        >
          <GripVertical aria-hidden="true" size="1.1em" />
        </span>
        <span className="hobby-cartao-acoes">
          <Button className="botao-icone pequeno" onPress={() => acoes.current.personalizar(cartao.id)} aria-label={`${tq.cartao.botao}: ${nome}`}><Palette aria-hidden="true" size="1em" /></Button>
          <Button className="botao-icone pequeno" onPress={() => acoes.current.apagar(cartao.id)} aria-label={`${tq.apagar}: ${nome}`}><X aria-hidden="true" size="1em" /></Button>
        </span>
      </div>
      <div className="quadro-cartao-corpo">
        {cartao.tipo === "texto" ? (
          editando ? (
            <div className="quadro-texto-editor">
              <CampoRico rotulo={tq.editarTexto} valor={rascunho} aoMudar={setRascunho} autoFocus placeholder={tq.textoVazio} />
              <Button className="botao principal pequeno" onPress={() => { acoes.current.salvarTexto(cartao.id, rascunho); setEditando(false); }}>{tq.salvarTexto}</Button>
            </div>
          ) : (
            <Button className="quadro-texto" onPress={() => { setRascunho(cartao.texto); setEditando(true); }}>
              {cartao.texto ? <TextoRico markdown={cartao.texto} /> : <span className="texto-suave">{tq.textoVazio}</span>}
            </Button>
          )
        ) : cartao.tipo === "imagem" ? (
          <ImagemCartao cartao={cartao} miniId={estilo?.mini ?? ""} acoes={acoes} />
        ) : cartao.tipo === "audio" ? (
          <AudioAnexo id={cartao.anexoId} nome={cartao.texto} />
        ) : (
          <Button className="quadro-arquivo" onPress={() => acoes.current.abrir(cartao.id)}>
            <span className="quadro-arquivo-icone" aria-hidden="true">{cartao.tipo === "link" ? <Link2 size="1.3em" /> : <FileText size="1.3em" />}</span>
            <span className="quebra quadro-arquivo-nome">{cartao.texto || tq.abrir}</span>
            {cartao.tipo === "link" ? <ExternalLink aria-hidden="true" size="1em" /> : <ChevronLeft aria-hidden="true" size="1em" style={{ transform: "rotate(180deg)" }} />}
          </Button>
        )}
      </div>
      {redimensionavel && (
        <span
          className="quadro-redimensiona"
          aria-hidden="true"
          onPointerDown={aoApontarTamanho}
          onPointerMove={aoTamanhoPonteiro}
          onPointerUp={aoTamanhoSoltar}
          onPointerCancel={aoTamanhoSoltar}
        />
      )}
    </div>
  );
});

/** Imagem no quadro: mostra só a miniatura (leve). Cartões antigos, sem miniatura,
 *  ganham uma na primeira vez que aparecem. O original abre ao ampliar. */
function ImagemCartao({ cartao, miniId, acoes }: { cartao: CartaoQuadro; miniId: string; acoes: React.RefObject<AcoesQuadro> }) {
  const [src, setSrc] = useState<string | null>(() => cacheMini.get(miniId || cartao.anexoId) ?? null);
  useEffect(() => {
    const id = miniId || cartao.anexoId;
    const pronto = cacheMini.get(id);
    if (pronto) { setSrc(pronto); return; }
    let vivo = true;
    (async () => {
      try {
        const dados = await api.imagemAnexo(id);
        if (miniId || gerandoMini.has(cartao.id)) {
          if (miniId) guardarNoCache(id, dados);
          if (vivo) setSrc(dados);
          return;
        }
        gerandoMini.add(cartao.id);
        const r = await reduzirImagem(dados, MINI_MAX);
        if (vivo) setSrc(r ? r.url : dados);
        if (!r) guardarNoCache(cartao.anexoId, dados);
        acoes.current.guardarMini(cartao.id, r, cartao.anexoId);
        gerandoMini.delete(cartao.id);
      } catch {
        gerandoMini.delete(cartao.id);
        if (vivo) setSrc(null);
      }
    })();
    return () => void (vivo = false);
  }, [miniId, cartao.anexoId, cartao.id, acoes]);

  return (
    <Button className="quadro-imagem" onPress={() => acoes.current.abrir(cartao.id)} aria-label={cartao.texto ? `${tq.ampliar}: ${cartao.texto}` : tq.ampliar}>
      {src ? <img src={src} alt="" className="quadro-imagem-mini" loading="lazy" decoding="async" draggable={false} /> : <span className="quadro-imagem-mini imagem-carregando" aria-hidden="true" />}
    </Button>
  );
}

/** Escolhas do fundo do quadro: tipo, cor, gradiente, imagem e padrão. */
function EditorFundo({ fundo, urlImagem, aoMudar, aoEscolherImagem, aoFechar }: {
  fundo: FundoQuadro;
  urlImagem: string | null;
  aoMudar: (f: Partial<FundoQuadro>) => void;
  aoEscolherImagem: () => Promise<void>;
  aoFechar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const nomesCor = textos.organizacao.cores as Record<string, string>;

  const escolher = async () => {
    setErro(null);
    setOcupado(true);
    try {
      await aoEscolherImagem();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="formulario">
      <fieldset className="hobby-grupo">
        <legend>{tq.fundo.tipo}</legend>
        <div className="hobby-escolhas" role="group" aria-label={tq.fundo.tipo}>
          {TIPOS_FUNDO.map((tp) => (
            <Button key={tp} className={fundo.tipo === tp ? "botao pequeno principal" : "botao pequeno"} aria-pressed={fundo.tipo === tp} onPress={() => aoMudar({ tipo: tp })}>
              {tq.fundo.tipos[tp]}
            </Button>
          ))}
        </div>
      </fieldset>

      {fundo.tipo === "cor" && (
        <fieldset className="hobby-grupo">
          <legend>{tq.fundo.cor}</legend>
          <div className="hobby-amostras">
            {CORES_CARTAO.map((c) => (
              <Button key={c} className="hobby-amostra-botao" aria-pressed={fundo.cor === c} onPress={() => aoMudar({ cor: c })}>
                <span className="hobby-amostra" style={{ background: PALETA_ORG[c].claro }} aria-hidden="true" />
                <span className="hobby-amostra-nome">{nomesCor[c] ?? c}</span>
              </Button>
            ))}
          </div>
        </fieldset>
      )}

      {fundo.tipo === "gradiente" && (
        <fieldset className="hobby-grupo">
          <legend>{tq.fundo.gradiente}</legend>
          <div className="hobby-amostras">
            {GRADIENTES_QUADRO.map((g) => (
              <Button key={g.id} className="hobby-amostra-botao" aria-pressed={fundo.gradiente === g.id} onPress={() => aoMudar({ gradiente: g.id })}>
                <span className="hobby-amostra" style={{ background: amostraGradiente(g.id) }} aria-hidden="true" />
                <span className="hobby-amostra-nome">{tq.fundo.gradientes[g.id as keyof typeof tq.fundo.gradientes] ?? g.id}</span>
              </Button>
            ))}
          </div>
        </fieldset>
      )}

      {fundo.tipo === "imagem" && (
        <fieldset className="hobby-grupo">
          <legend>{tq.fundo.imagem}</legend>
          {urlImagem && <span className="hobby-fundo-previa" style={{ backgroundImage: `url("${urlImagem}")` }} aria-hidden="true" />}
          <p className="texto-suave pequeno">{tq.fundo.imagemAjuda}</p>
          <Button className="botao com-icone" onPress={() => void escolher()} isDisabled={ocupado}>
            <ImagePlus aria-hidden="true" size="1em" /> {ocupado ? tq.anexando : fundo.imagem ? tq.fundo.trocarImagem : tq.fundo.escolherImagem}
          </Button>
          <Aviso>{erro}</Aviso>
        </fieldset>
      )}

      <fieldset className="hobby-grupo">
        <legend>{tq.fundo.padrao}</legend>
        <div className="hobby-amostras">
          {PADROES_FUNDO.map((p) => (
            <Button key={p} className="hobby-amostra-botao" aria-pressed={fundo.padrao === p} onPress={() => aoMudar({ padrao: p })}>
              <span className={`hobby-amostra hobby-padrao-${p}`} aria-hidden="true" />
              <span className="hobby-amostra-nome">{tq.fundo.padroes[p]}</span>
            </Button>
          ))}
        </div>
      </fieldset>

      <p className="texto-suave pequeno">{tq.fundo.baixoEstimulo}</p>
      <div className="janela-acoes">
        <Button className="botao principal" onPress={aoFechar}>{tq.fundo.pronto}</Button>
      </div>
    </div>
  );
}

/** Aparência de um cartão: cor do cartão, cor e fonte do texto. */
function EditorCartao({ cartao, estilo, aoMudar, aoFechar }: {
  cartao: CartaoQuadro;
  estilo: EstiloCartao | undefined;
  aoMudar: (m: Partial<EstiloCartao>) => void;
  aoFechar: () => void;
}) {
  const nomesCor = textos.organizacao.cores as Record<string, string>;
  const visual = visualDoCartao(estilo);
  const tintaPedida = estilo?.tinta && !visual.classe.includes("hobby-com-tinta");
  return (
    <div className="formulario">
      <div className={`quadro-cartao-livre hobby-cartao hobby-cartao-previa${visual.classe}`} style={visual.estilo} aria-hidden="true">
        <div className="quadro-texto">{cartao.tipo === "texto" && cartao.texto ? cartao.texto.slice(0, 80) : tq.cartao.exemplo}</div>
      </div>

      <fieldset className="hobby-grupo">
        <legend>{tq.cartao.cor}</legend>
        <div className="hobby-amostras">
          <Button className="hobby-amostra-botao" aria-pressed={!estilo?.cor} onPress={() => aoMudar({ cor: undefined })}>
            <span className="hobby-amostra hobby-amostra-vazia" aria-hidden="true" />
            <span className="hobby-amostra-nome">{tq.cartao.semCor}</span>
          </Button>
          {CORES_CARTAO.map((c) => (
            <Button key={c} className="hobby-amostra-botao" aria-pressed={estilo?.cor === c} onPress={() => aoMudar({ cor: c })}>
              <span className="hobby-amostra" style={{ background: PALETA_ORG[c].claro }} aria-hidden="true" />
              <span className="hobby-amostra-nome">{nomesCor[c] ?? c}</span>
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset className="hobby-grupo">
        <legend>{tq.cartao.tinta}</legend>
        <div className="hobby-amostras">
          <Button className="hobby-amostra-botao" aria-pressed={!estilo?.tinta} onPress={() => aoMudar({ tinta: undefined })}>
            <span className="hobby-amostra hobby-amostra-vazia hobby-amostra-letra" aria-hidden="true">Aa</span>
            <span className="hobby-amostra-nome">{tq.cartao.tintas.padrao}</span>
          </Button>
          {TINTAS.map((tt) => (
            <Button key={tt.id} className="hobby-amostra-botao" aria-pressed={estilo?.tinta === tt.id} onPress={() => aoMudar({ tinta: tt.id })}>
              <span className="hobby-amostra hobby-amostra-letra hobby-tinta-amostra" style={{ "--hobby-tinta-c": tt.claro, "--hobby-tinta-e": tt.escuro } as React.CSSProperties} aria-hidden="true">Aa</span>
              <span className="hobby-amostra-nome">{tq.cartao.tintas[tt.id as keyof typeof tq.cartao.tintas] ?? tt.id}</span>
            </Button>
          ))}
        </div>
        {tintaPedida && <p className="texto-suave pequeno">{tq.cartao.contrasteAjuda}</p>}
      </fieldset>

      <fieldset className="hobby-grupo">
        <legend>{tq.cartao.fonte}</legend>
        <div className="hobby-escolhas" role="group" aria-label={tq.cartao.fonte}>
          <Button className={!estilo?.fonte ? "botao pequeno principal" : "botao pequeno"} aria-pressed={!estilo?.fonte} onPress={() => aoMudar({ fonte: undefined })}>{tq.cartao.fontePadrao}</Button>
          {FONTES_CARTAO.map((f) => (
            <Button key={f.id} className={estilo?.fonte === f.id ? "botao pequeno principal" : "botao pequeno"} aria-pressed={estilo?.fonte === f.id} onPress={() => aoMudar({ fonte: f.id })} style={{ fontFamily: f.css }}>
              {f.nome}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="janela-acoes">
        <Button className="botao principal" onPress={aoFechar}>{tq.cartao.pronto}</Button>
      </div>
    </div>
  );
}

/** Pré-visualização dentro do app: imagem ampliada ou PDF rolável; com baixar. */
function PreviaArquivo({ cartao, aoFechar }: { cartao: CartaoQuadro; aoFechar: () => void }) {
  const alvo = useRef<HTMLDivElement>(null);
  const recado = useRecado();
  const ehPdf = ehNomePdf(cartao.texto);
  const ehImagem = cartao.tipo === "imagem";

  useEffect(() => {
    if (!ehPdf) return;
    let vivo = true;
    const cont = alvo.current;
    if (!cont) return;
    const leitor = new Leitor(cont);
    (async () => {
      try {
        const b64 = await api.bytesAnexo(cartao.anexoId);
        if (!vivo || !b64) return;
        await leitor.abrir(base64ParaBytes(b64).buffer, "pdf", CONFIG_PADRAO);
      } catch {
        // Sem prévia; a pessoa abre no programa.
      }
    })();
    return () => {
      vivo = false;
      leitor.destruir();
    };
  }, [cartao.anexoId, ehPdf]);

  // Esc fecha a prévia.
  useEffect(() => {
    const aoTecla = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [aoFechar]);

  const baixar = async () => {
    const caminho = await escolherOndeSalvarAnexo(cartao.texto || "arquivo");
    if (caminho) {
      await api.salvarAnexo(cartao.anexoId, caminho);
      recado(textos.relacoes.salvo);
    }
  };

  return (
    <div className="previa-sobreposicao" role="dialog" aria-modal="true" aria-label={cartao.texto || tq.abrir}>
      <div className="previa-caixa">
        <div className="previa-topo">
          <strong className="quebra">{cartao.texto || tq.abrir}</strong>
          <Button className="botao-icone" onPress={aoFechar} aria-label={tq.fechar} autoFocus><X aria-hidden="true" size="1.2em" /></Button>
        </div>
        <div className="previa-corpo">
          {ehImagem ? (
            <ImagemAnexo id={cartao.anexoId} nome={cartao.texto} className="previa-imagem" />
          ) : ehPdf ? (
            <div className="previa-pdf" ref={alvo} />
          ) : (
            <p className="texto-suave previa-semprevia">{tq.semPrevia}</p>
          )}
        </div>
        <div className="previa-acoes">
          <Button className="botao com-icone" onPress={() => void api.abrirAnexo(cartao.anexoId)}><ExternalLink aria-hidden="true" size="1em" /> {tq.abrirPrograma}</Button>
          <Button className="botao com-icone" onPress={() => void baixar()}><Download aria-hidden="true" size="1em" /> {tq.baixar}</Button>
          <Button className="botao principal" onPress={aoFechar}>{tq.fechar}</Button>
        </div>
      </div>
    </div>
  );
}

/** Tocador de um áudio guardado no cofre. Usa endereço de blob (não um texto
 *  base64 gigante no DOM) e guarda na memória da sessão para não decodificar de novo. */
function AudioAnexo({ id, nome }: { id: string; nome: string }) {
  const [src, setSrc] = useState<string | null>(() => cacheAudio.get(id) ?? null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    const pronto = cacheAudio.get(id);
    if (pronto) { setSrc(pronto); return; }
    let vivo = true;
    api.bytesAnexo(id).then((b64) => {
      if (!b64) { if (vivo) setFalhou(true); return; }
      const url = URL.createObjectURL(new Blob([base64ParaBytes(b64)], { type: mimeDaExtensao(nome) }));
      guardarAudio(id, url);
      if (vivo) setSrc(url);
    }, () => vivo && setFalhou(true));
    return () => void (vivo = false);
  }, [id, nome]);
  if (falhou) return <span className="texto-suave pequeno hobby-audio-aviso">{tq.audio.naoToca}</span>;
  return src ? (
    <audio className="quadro-audio" controls preload="metadata" src={src} aria-label={nome || tq.tipos.audio} onError={() => setFalhou(true)} />
  ) : (
    <span className="texto-suave pequeno hobby-audio-aviso">{tq.audio.carregando}</span>
  );
}

// Caminho SVG de cada traço, calculado uma vez só (traços não mudam depois de prontos).
const cacheCaminhos = new WeakMap<Traco, string>();
const caminhoDe = (tr: Traco) => {
  let d = cacheCaminhos.get(tr);
  if (d === undefined) {
    d = caminhoDeTraco(tr);
    cacheCaminhos.set(tr, d);
  }
  return d;
};

/** Camada de desenho à mão sobre todo o quadro do hobby (tipo quadro branco).
 *  Reaproveita o traço do caderno (perfect-freehand). Quando ativa, captura o
 *  toque e desenha/apaga; quando não, só mostra o desenho (deixa os cartões
 *  funcionarem por baixo). Funciona com mouse, dedo e caneta (Apple Pencil,
 *  caneta do Windows): com caneta, a espessura segue a pressão; o botão de
 *  borracha da caneta apaga. O traço em andamento é desenhado direto no SVG,
 *  sem redesenhar a camada inteira a cada ponto. */
const CamadaDesenhoQuadro = memo(function CamadaDesenhoQuadro({ cena, largura, altura, ativo, ferramenta, cor, tamanho, aoDesenhar, aoApagarCena }: {
  cena: Cena; largura: number; altura: number; ativo: boolean; ferramenta: "caneta" | "borracha"; cor: string; tamanho: number;
  aoDesenhar: (t: Traco) => void; aoApagarCena: (nova: Cena) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const vivoRef = useRef<SVGPathElement>(null);
  const traco = useRef<Traco | null>(null);
  const ponteiro = useRef<number | null>(null);
  const modo = useRef<"caneta" | "borracha">("caneta");
  const caixa = useRef<DOMRect | null>(null);
  const quadroAnim = useRef(0);
  const apagando = useRef<Cena | null>(null);
  const [apagarLocal, setApagarLocal] = useState<Cena | null>(null);
  const raioBorracha = Math.max(7, tamanho * 2);

  useEffect(() => () => cancelAnimationFrame(quadroAnim.current), []);

  const ponto = (e: { clientX: number; clientY: number; pressure: number; pointerType: string }): Ponto => {
    const r = caixa.current ?? ref.current!.getBoundingClientRect();
    const p = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;
    return { x: ((e.clientX - r.left) / r.width) * largura, y: ((e.clientY - r.top) / r.height) * altura, p };
  };
  const apagarEm = (base: Cena, x: number, y: number): Cena => {
    let mudou = false;
    const novos: Cena["elementos"] = [];
    for (const el of base.elementos) {
      if (el.tipo !== "traco") { novos.push(el); continue; }
      const frags = fragmentosAoApagar(el, x, y, raioBorracha);
      if (frags === null) { novos.push(el); continue; }
      mudou = true;
      frags.forEach((pontos, i) => novos.push({ ...el, id: i === 0 ? el.id : crypto.randomUUID(), pontos }));
    }
    return mudou ? { elementos: novos } : base;
  };
  const pintarVivo = () => {
    quadroAnim.current = 0;
    const tr = traco.current;
    if (tr && vivoRef.current) vivoRef.current.setAttribute("d", caminhoDeTraco(tr));
  };

  const inicio = (e: React.PointerEvent) => {
    if (!ativo || ponteiro.current !== null) return; // um dedo/caneta por vez (ignora a palma)
    // Botão de borracha da caneta (Windows) ou botão traseiro: apaga.
    const borrachaDaCaneta = e.pointerType === "pen" && (e.button === 5 || (e.buttons & 32) !== 0);
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    ponteiro.current = e.pointerId;
    caixa.current = ref.current!.getBoundingClientRect();
    modo.current = borrachaDaCaneta ? "borracha" : ferramenta;
    const pt = ponto(e);
    if (modo.current === "borracha") {
      apagando.current = apagarEm(cena, pt.x, pt.y);
      setApagarLocal(apagando.current);
    } else {
      traco.current = { tipo: "traco", id: crypto.randomUUID(), ferramenta: "caneta", cor, espessura: Math.round(tamanho), pressao: e.pointerType === "pen" && e.pressure > 0, pontos: [pt] };
      pintarVivo();
    }
  };
  const mover = (e: React.PointerEvent) => {
    if (e.pointerId !== ponteiro.current) return;
    // A caneta manda muitos pontos entre um quadro e outro: usa todos (traço mais fiel).
    const nativo = e.nativeEvent;
    const eventos = typeof nativo.getCoalescedEvents === "function" ? nativo.getCoalescedEvents() : [];
    const lista = eventos.length ? eventos : [nativo];
    if (modo.current === "borracha") {
      let c = apagando.current ?? cena;
      for (const ev of lista) { const pt = ponto(ev); c = apagarEm(c, pt.x, pt.y); }
      if (c !== apagando.current) { apagando.current = c; setApagarLocal(c); }
    } else if (traco.current) {
      for (const ev of lista) traco.current.pontos.push(ponto(ev));
      if (!quadroAnim.current) quadroAnim.current = requestAnimationFrame(pintarVivo);
    }
  };
  const fim = (e: React.PointerEvent) => {
    if (e.pointerId !== ponteiro.current) return;
    ponteiro.current = null;
    caixa.current = null;
    cancelAnimationFrame(quadroAnim.current);
    quadroAnim.current = 0;
    if (modo.current === "borracha") {
      const c = apagando.current;
      apagando.current = null;
      setApagarLocal(null);
      if (c && c !== cena) aoApagarCena(c);
    } else {
      const tr = traco.current;
      traco.current = null;
      vivoRef.current?.setAttribute("d", "");
      if (tr && tr.pontos.length) aoDesenhar({ ...tr, pontos: [...tr.pontos] });
    }
  };

  const mostra = apagarLocal ?? cena;
  const caminhos = useMemo(
    () => mostra.elementos.map((el) => (el.tipo === "traco" ? <path key={el.id} d={caminhoDe(el)} fill={el.cor} opacity={el.opacidade ?? FERRAMENTAS[el.ferramenta].opacidade} /> : null)),
    [mostra],
  );
  return (
    <svg ref={ref} className="quadro-desenho-svg" viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none"
      style={{ pointerEvents: ativo ? "auto" : "none", cursor: ativo ? "crosshair" : undefined }}
      onPointerDown={inicio} onPointerMove={mover} onPointerUp={fim} onPointerCancel={fim}>
      {caminhos}
      <path ref={vivoRef} fill={cor} opacity={FERRAMENTAS.caneta.opacidade} />
    </svg>
  );
});

type EstadoGravador = "parado" | "pedindo" | "gravando" | "salvando";

/** Grava áudio pelo microfone (MediaRecorder) e guarda como anexo; ou anexa um áudio existente.
 *  Funciona no Windows (WebView2, grava em WebM) e no iPad (Safari, grava em MP4/M4A). */
function GravadorAudio({ hobbyId, aoGravado, aoAnexarExistente, aoFechar }: { hobbyId: string; aoGravado: (a: Anexo) => void; aoAnexarExistente: () => void; aoFechar: () => void }) {
  const [estado, setEstado] = useState<EstadoGravador>("parado");
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const fluxo = useRef<MediaStream | null>(null);
  const montado = useRef(true);

  useEffect(() => {
    if (estado !== "gravando") return;
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [estado]);

  const pararFluxo = () => {
    fluxo.current?.getTracks().forEach((tr) => tr.stop());
    fluxo.current = null;
  };

  // Ao sair (fechar a janela, Esc, trocar de tela): solta o microfone e descarta.
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      const mr = gravador.current;
      if (mr && mr.state !== "inactive") {
        mr.ondataavailable = null;
        mr.onstop = null;
        try { mr.stop(); } catch { /* já parado */ }
      }
      pararFluxo();
    };
  }, []);

  const comecar = async () => {
    setErro(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErro(tq.audio.semSuporte);
      return;
    }
    setEstado("pedindo");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const motivo = motivoErroMic(e);
      setErro(motivo === "negado" ? tq.audio.negado : motivo === "semMic" ? tq.audio.semMic : motivo === "ocupado" ? tq.audio.ocupado : tq.audio.semSuporte);
      setEstado("parado");
      return;
    }
    if (!montado.current) { stream.getTracks().forEach((tr) => tr.stop()); return; }
    fluxo.current = stream;
    pedacos.current = [];
    try {
      const mime = escolherMimeAudio(typeof MediaRecorder.isTypeSupported === "function" ? (m) => MediaRecorder.isTypeSupported(m) : undefined);
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data && e.data.size) pedacos.current.push(e.data); };
      mr.onerror = () => {
        pararFluxo();
        setErro(tq.audio.falhou);
        setEstado("parado");
      };
      mr.start();
      gravador.current = mr;
      setSegundos(0);
      setEstado("gravando");
    } catch {
      pararFluxo();
      setErro(tq.audio.semSuporte);
      setEstado("parado");
    }
  };

  const parar = () => {
    const mr = gravador.current;
    if (!mr) return;
    setEstado("salvando");
    mr.onstop = async () => {
      pararFluxo();
      gravador.current = null;
      try {
        const tipo = mr.mimeType || pedacos.current[0]?.type || "audio/webm";
        const blob = new Blob(pedacos.current, { type: tipo });
        if (!blob.size) throw new Error(tq.audio.vazio);
        const b64 = bytesParaBase64(new Uint8Array(await blob.arrayBuffer()));
        const nome = `audio-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${extensaoDoMime(tipo)}`;
        const anexo = await api.anexarBytes(hobbyId, nome, b64);
        aoGravado(anexo);
      } catch (e) {
        if (!montado.current) return;
        setErro(mensagem(e));
        setEstado("parado");
      }
    };
    mr.stop();
  };

  const mm = String(Math.floor(segundos / 60)).padStart(2, "0");
  const ss = String(segundos % 60).padStart(2, "0");

  return (
    <div className="formulario">
      <p className="texto-suave pequeno">{tq.audio.ajuda}</p>
      {estado === "pedindo" && <p className="texto-suave" aria-live="polite">{tq.audio.pedindo}</p>}
      {estado === "gravando" && <p className="quadro-gravando" aria-live="polite"><Mic aria-hidden="true" size="1.1em" /> {tq.audio.gravando} {mm}:{ss}</p>}
      {estado === "salvando" && <p className="texto-suave" aria-live="polite">{tq.audio.salvando}</p>}
      <Aviso>{erro}</Aviso>
      {(estado === "parado" || estado === "pedindo") && (
        <Button className="botao com-icone" onPress={aoAnexarExistente} isDisabled={estado === "pedindo"}>
          <FileUp aria-hidden="true" size="1em" /> {tq.audio.anexar}
        </Button>
      )}
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{tq.audio.cancelar}</Button>
        {estado === "gravando" ? (
          <Button className="botao principal" onPress={parar}>{tq.audio.parar}</Button>
        ) : (
          <Button className="botao principal" onPress={() => void comecar()} isDisabled={estado !== "parado"}><Mic aria-hidden="true" size="1.1em" /> {tq.audio.comecar}</Button>
        )}
      </div>
    </div>
  );
}
