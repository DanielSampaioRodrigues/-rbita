import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Form } from "react-aria-components";
import { Leitor, CONFIG_PADRAO } from "@orbita/leitor";
import { caminhoDeTraco, cenaVazia, FERRAMENTAS, fragmentosAoApagar, lerCena, serializarCena, type Cena, type Ponto, type Traco } from "@orbita/caderno";
import { api, escolherArquivoParaAnexar, escolherOndeSalvarAnexo, type Anexo, type CartaoQuadro, type Hobby, type TipoCartao } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoRico } from "../componentes/CampoRico";
import { TextoRico } from "../componentes/TextoRico";
import { Confirmar, Janela } from "../componentes/Janela";
import { ImagemAnexo } from "../relacoes/Relacoes";
import { Check, ChevronLeft, Download, Eraser, ExternalLink, FileText, FileUp, GripVertical, ImagePlus, Link2, Mic, Pencil, PenLine, Plus, Sparkles, StickyNote, Trash2, Undo2, X } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";

const t = textos.hobbies;
const tq = t.quadro;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));
const EXT_AUDIO = ["mp3", "m4a", "wav", "ogg", "oga", "webm", "aac", "flac", "opus"];
const ehNomePdf = (nome: string) => nome.toLowerCase().endsWith(".pdf");

function base64ParaBytes(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

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
  texto: { largura: 240, altura: 170 },
  imagem: { largura: 200, altura: 200 },
  arquivo: { largura: 210, altura: 92 },
  link: { largura: 210, altura: 92 },
  audio: { largura: 260, altura: 96 },
  desenho: { largura: 0, altura: 0 },
};
const CORES_DESENHO = ["#1f2937", "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#ca8a04"];
const REDIMENSIONAVEL: TipoCartao[] = ["texto", "imagem"];

/** O quadro livre de um hobby: cartões soltos que a pessoa arrasta e organiza. */
function QuadroHobby({ hobby, aoFechar }: { hobby: Hobby; aoFechar: () => void }) {
  const [cartoes, setCartoes] = useState<CartaoQuadro[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [link, setLink] = useState<{ nome: string; endereco: string } | null>(null);
  const [gravando, setGravando] = useState(false);
  const [prevendo, setPrevendo] = useState<CartaoQuadro | null>(null);
  // Camada de desenho sobre o quadro todo (rabisco à mão, tipo quadro branco).
  const [cena, setCena] = useState<Cena>(cenaVazia());
  const [desenhando, setDesenhando] = useState(false);
  const [ferrD, setFerrD] = useState<"caneta" | "borracha">("caneta");
  const [corD, setCorD] = useState("#1f2937");
  const [tamD, setTamD] = useState(3);
  const cenaId = useRef("");
  const cenaCarregada = useRef(false);
  const timerCena = useRef<ReturnType<typeof setTimeout> | null>(null);
  const histCena = useRef<Cena[]>([]);
  const recado = useRecado();

  const carregar = useCallback(
    () =>
      api.listarCartoes(hobby.id).then((cs) => {
        setCartoes(cs.filter((c) => c.tipo !== "desenho"));
        const d = cs.find((c) => c.tipo === "desenho");
        if (d) {
          cenaId.current = d.id;
          if (!cenaCarregada.current) { setCena(lerCena(d.texto)); cenaCarregada.current = true; }
        }
      }, (e) => setErro(mensagem(e))),
    [hobby.id],
  );
  useEffect(() => void carregar(), [carregar]);

  const persistirCena = (nova: Cena) => {
    if (timerCena.current) clearTimeout(timerCena.current);
    timerCena.current = setTimeout(() => {
      api.salvarCartao({ id: cenaId.current, hobbyId: hobby.id, tipo: "desenho", texto: serializarCena(nova), anexoId: "", x: 0, y: 0, largura: 0, altura: 0, criadoEm: 0 })
        .then((c) => { cenaId.current = c.id; })
        .catch((e) => setErro(mensagem(e)));
    }, 600);
  };
  const mudarCena = (nova: Cena) => {
    histCena.current = [...histCena.current.slice(-30), cena];
    setCena(nova);
    persistirCena(nova);
  };
  const desfazerCena = () => {
    const ant = histCena.current.pop();
    if (!ant) return;
    setCena(ant);
    persistirCena(ant);
  };
  const limparCena = () => { if (cena.elementos.length) mudarCena(cenaVazia()); };

  const proximaPos = () => {
    const n = cartoes.length;
    return { x: 40 + (n % 6) * 36, y: 40 + (n % 6) * 36 };
  };

  const criarCartao = async (tipo: TipoCartao, extra: Partial<CartaoQuadro>) => {
    const pos = proximaPos();
    const tam = TAMANHO_PADRAO[tipo];
    await api.salvarCartao({ id: "", hobbyId: hobby.id, tipo, texto: "", anexoId: "", x: pos.x, y: pos.y, largura: tam.largura, altura: tam.altura, criadoEm: 0, ...extra });
    await carregar();
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

  const adicionarArquivo = (soImagens: boolean) =>
    comOcupado(async () => {
      const caminho = await escolherArquivoParaAnexar(soImagens);
      if (!caminho) return;
      const anexo = await api.anexarArquivo(hobby.id, caminho);
      await criarCartao(tipoDoAnexo(anexo), { anexoId: anexo.id, texto: anexo.nome });
    });

  const adicionarAudioExistente = () =>
    comOcupado(async () => {
      const caminho = await escolherArquivoParaAnexar(false);
      if (!caminho) return;
      const anexo = await api.anexarArquivo(hobby.id, caminho);
      await criarCartao("audio", { anexoId: anexo.id, texto: anexo.nome });
      setGravando(false);
    });

  const adicionarLinkConfirmar = (nome: string, endereco: string) =>
    comOcupado(async () => {
      const anexo = await api.anexarLink(hobby.id, nome, endereco);
      await criarCartao("link", { anexoId: anexo.id, texto: anexo.nome });
      setLink(null);
    });

  const adicionarAudioGravado = (anexo: Anexo) =>
    comOcupado(async () => {
      await criarCartao("audio", { anexoId: anexo.id, texto: anexo.nome });
      setGravando(false);
    });

  const mover = (id: string, x: number, y: number) => {
    setCartoes((cs) => cs.map((c) => (c.id === id ? { ...c, x, y } : c)));
    api.moverCartao(id, x, y).catch((e) => setErro(mensagem(e)));
  };

  const redimensionar = (c: CartaoQuadro, largura: number, altura: number) => {
    setCartoes((cs) => cs.map((x) => (x.id === c.id ? { ...x, largura, altura } : x)));
    api.salvarCartao({ ...c, largura, altura }).catch((e) => setErro(mensagem(e)));
  };

  const salvarTexto = async (c: CartaoQuadro, texto: string) => {
    setCartoes((cs) => cs.map((x) => (x.id === c.id ? { ...x, texto } : x)));
    await api.salvarCartao({ ...c, texto });
  };

  const abrirCartao = (c: CartaoQuadro) => {
    if (c.tipo === "link") void api.abrirAnexo(c.anexoId);
    else setPrevendo(c);
  };

  const apagar = async (c: CartaoQuadro) => {
    await api.excluirCartao(c.id);
    await carregar();
    recado(tq.apagar);
  };

  const largura = Math.max(1200, ...cartoes.map((c) => c.x + c.largura + 80), 0);
  const altura = Math.max(800, ...cartoes.map((c) => c.y + c.altura + 80), 0);

  return (
    <div className="quadro-hobby">
      <div className="leitor-barra">
        <Button className="botao-icone" onPress={aoFechar} aria-label={tq.voltar}><ChevronLeft aria-hidden="true" size="1.2em" /></Button>
        <strong className="leitor-titulo quebra"><Sparkles aria-hidden="true" size="1em" /> {hobby.nome}</strong>
        <div className="leitor-controles">
          <Button className="botao pequeno com-icone" onPress={() => void criarCartao("texto", {})} isDisabled={ocupado}><StickyNote aria-hidden="true" size="1em" /> {tq.adicionarTexto}</Button>
          <Button className="botao pequeno com-icone" onPress={() => void adicionarArquivo(false)} isDisabled={ocupado}><FileText aria-hidden="true" size="1em" /> {tq.adicionarArquivo}</Button>
          <Button className="botao pequeno com-icone" onPress={() => void adicionarArquivo(true)} isDisabled={ocupado}><ImagePlus aria-hidden="true" size="1em" /> {tq.adicionarImagem}</Button>
          <Button className="botao pequeno com-icone" onPress={() => (setErro(null), setLink({ nome: "", endereco: "" }))} isDisabled={ocupado}><Link2 aria-hidden="true" size="1em" /> {tq.adicionarLink}</Button>
          <Button className="botao pequeno com-icone" onPress={() => (setErro(null), setGravando(true))} isDisabled={ocupado}><Mic aria-hidden="true" size="1em" /> {tq.adicionarAudio}</Button>
          <Button className={desenhando ? "botao pequeno com-icone principal" : "botao pequeno com-icone"} onPress={() => setDesenhando((v) => !v)} aria-pressed={desenhando}><PenLine aria-hidden="true" size="1em" /> {tq.desenhar}</Button>
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

      <div className="quadro-rolagem">
        {cartoes.length === 0 ? (
          <p className="texto-suave quadro-vazio">{tq.vazio}</p>
        ) : (
          <p className="texto-suave pequeno quadro-dica">{tq.dica}</p>
        )}
        <div className={desenhando ? "quadro-chao desenhando" : "quadro-chao"} style={{ width: largura, height: altura }}>
          {cartoes.map((c) => (
            <CartaoView key={c.id} cartao={c} aoMover={mover} aoRedimensionar={redimensionar} aoApagar={() => void apagar(c)} aoAbrir={() => abrirCartao(c)} aoSalvarTexto={(txt) => void salvarTexto(c, txt)} />
          ))}
          <CamadaDesenhoQuadro cena={cena} largura={largura} altura={altura} ativo={desenhando} ferramenta={ferrD} cor={corD} tamanho={tamD}
            aoDesenhar={(tr) => mudarCena({ elementos: [...cena.elementos, tr] })}
            aoApagarCena={(nova) => mudarCena(nova)} />
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
        {gravando && <GravadorAudio hobbyId={hobby.id} aoGravado={adicionarAudioGravado} aoAnexarExistente={adicionarAudioExistente} aoFechar={() => setGravando(false)} />}
      </Janela>

      {prevendo && <PreviaArquivo cartao={prevendo} aoFechar={() => setPrevendo(null)} />}
    </div>
  );
}

/** Um cartão solto no quadro: arrastável (mouse/teclado) e redimensionável. */
function CartaoView({ cartao, aoMover, aoRedimensionar, aoApagar, aoAbrir, aoSalvarTexto }: {
  cartao: CartaoQuadro;
  aoMover: (id: string, x: number, y: number) => void;
  aoRedimensionar: (c: CartaoQuadro, largura: number, altura: number) => void;
  aoApagar: () => void;
  aoAbrir: () => void;
  aoSalvarTexto: (texto: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(cartao.texto);
  // Arraste e redimensionamento mexem direto no DOM (sem re-render a cada quadro).
  const arraste = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const tamanho = useRef<{ px: number; py: number; w: number; h: number } | null>(null);

  const aoApontarMover = (e: React.PointerEvent) => {
    if (editando) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arraste.current = { px: e.clientX, py: e.clientY, ox: cartao.x, oy: cartao.y };
  };
  const aoMoverPonteiro = (e: React.PointerEvent) => {
    const a = arraste.current;
    const el = ref.current;
    if (!a || !el) return;
    el.style.left = `${Math.max(0, a.ox + (e.clientX - a.px))}px`;
    el.style.top = `${Math.max(0, a.oy + (e.clientY - a.py))}px`;
  };
  const aoSoltar = () => {
    const a = arraste.current;
    const el = ref.current;
    if (!a || !el) return;
    arraste.current = null;
    aoMover(cartao.id, parseFloat(el.style.left), parseFloat(el.style.top));
  };

  const aoApontarTamanho = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    tamanho.current = { px: e.clientX, py: e.clientY, w: cartao.largura, h: cartao.altura };
  };
  const aoTamanhoPonteiro = (e: React.PointerEvent) => {
    const r = tamanho.current;
    const el = ref.current;
    if (!r || !el) return;
    el.style.width = `${Math.max(140, r.w + (e.clientX - r.px))}px`;
    el.style.height = `${Math.max(90, r.h + (e.clientY - r.py))}px`;
  };
  const aoTamanhoSoltar = () => {
    const r = tamanho.current;
    const el = ref.current;
    if (!r || !el) return;
    tamanho.current = null;
    aoRedimensionar(cartao, el.offsetWidth, el.offsetHeight);
  };

  const aoTecla = (e: React.KeyboardEvent) => {
    const passo = e.shiftKey ? 40 : 12;
    if (e.key === "ArrowLeft") aoMover(cartao.id, Math.max(0, cartao.x - passo), cartao.y);
    else if (e.key === "ArrowRight") aoMover(cartao.id, cartao.x + passo, cartao.y);
    else if (e.key === "ArrowUp") aoMover(cartao.id, cartao.x, Math.max(0, cartao.y - passo));
    else if (e.key === "ArrowDown") aoMover(cartao.id, cartao.x, cartao.y + passo);
    else if (e.key === "Delete" || e.key === "Backspace") aoApagar();
    else return;
    e.preventDefault();
  };

  const redimensionavel = REDIMENSIONAVEL.includes(cartao.tipo);
  const estilo: React.CSSProperties = { left: cartao.x, top: cartao.y, width: cartao.largura };
  if (redimensionavel) estilo.height = cartao.altura;

  return (
    <div ref={ref} className="quadro-cartao-livre" style={estilo}>
      <div className="quadro-cartao-barra">
        <span
          className="quadro-alca"
          role="button"
          tabIndex={0}
          aria-label={`${tq.mover}: ${cartao.texto || cartao.tipo}`}
          onPointerDown={aoApontarMover}
          onPointerMove={aoMoverPonteiro}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
          onKeyDown={aoTecla}
        >
          <GripVertical aria-hidden="true" size="1.1em" />
        </span>
        <Button className="botao-icone pequeno" onPress={aoApagar} aria-label={tq.apagar}><X aria-hidden="true" size="1em" /></Button>
      </div>
      <div className="quadro-cartao-corpo">
        <ConteudoCartao cartao={cartao} editando={editando} rascunho={rascunho} setEditando={setEditando} setRascunho={setRascunho} aoAbrir={aoAbrir} aoSalvarTexto={aoSalvarTexto} />
      </div>
      {redimensionavel && (
        <span
          className="quadro-redimensiona"
          role="button"
          tabIndex={-1}
          aria-hidden="true"
          onPointerDown={aoApontarTamanho}
          onPointerMove={aoTamanhoPonteiro}
          onPointerUp={aoTamanhoSoltar}
          onPointerCancel={aoTamanhoSoltar}
        />
      )}
    </div>
  );
}

function ConteudoCartao({ cartao, editando, rascunho, setEditando, setRascunho, aoAbrir, aoSalvarTexto }: {
  cartao: CartaoQuadro;
  editando: boolean;
  rascunho: string;
  setEditando: (v: boolean) => void;
  setRascunho: (v: string) => void;
  aoAbrir: () => void;
  aoSalvarTexto: (texto: string) => void;
}) {
  if (cartao.tipo === "texto") {
    if (editando) {
      return (
        <div className="quadro-texto-editor">
          <CampoRico rotulo={tq.editarTexto} valor={rascunho} aoMudar={setRascunho} autoFocus placeholder={tq.textoVazio} />
          <Button className="botao principal pequeno" onPress={() => { aoSalvarTexto(rascunho); setEditando(false); }}>{tq.salvarTexto}</Button>
        </div>
      );
    }
    return (
      <Button className="quadro-texto" onPress={() => { setRascunho(cartao.texto); setEditando(true); }}>
        {cartao.texto ? <TextoRico markdown={cartao.texto} /> : <span className="texto-suave">{tq.textoVazio}</span>}
      </Button>
    );
  }
  if (cartao.tipo === "imagem") {
    return (
      <Button className="quadro-imagem" onPress={aoAbrir} aria-label={tq.ampliar}>
        <ImagemAnexo id={cartao.anexoId} nome="" className="quadro-imagem-mini" />
      </Button>
    );
  }
  if (cartao.tipo === "audio") {
    return <AudioAnexo id={cartao.anexoId} nome={cartao.texto} />;
  }
  // arquivo ou link.
  return (
    <Button className="quadro-arquivo" onPress={aoAbrir}>
      <span className="quadro-arquivo-icone" aria-hidden="true">{cartao.tipo === "link" ? <Link2 size="1.3em" /> : <FileText size="1.3em" />}</span>
      <span className="quebra quadro-arquivo-nome">{cartao.texto || tq.abrir}</span>
      {cartao.tipo === "link" ? <ExternalLink aria-hidden="true" size="1em" /> : <ChevronLeft aria-hidden="true" size="1em" style={{ transform: "rotate(180deg)" }} />}
    </Button>
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
        await leitor.abrir(base64ParaBytes(b64), "pdf", CONFIG_PADRAO);
      } catch {
        // Sem prévia; a pessoa abre no programa.
      }
    })();
    return () => {
      vivo = false;
      leitor.destruir();
    };
  }, [cartao.anexoId, ehPdf]);

  const baixar = async () => {
    const caminho = await escolherOndeSalvarAnexo(cartao.texto || "arquivo");
    if (caminho) {
      await api.salvarAnexo(cartao.anexoId, caminho);
      recado(textos.relacoes.salvo);
    }
  };

  return (
    <div className="previa-sobreposicao" role="dialog" aria-label={cartao.texto || tq.abrir}>
      <div className="previa-caixa">
        <div className="previa-topo">
          <strong className="quebra">{cartao.texto || tq.abrir}</strong>
          <Button className="botao-icone" onPress={aoFechar} aria-label={tq.fechar}><X aria-hidden="true" size="1.2em" /></Button>
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

/** Tocador de um áudio guardado no cofre. */
function AudioAnexo({ id, nome }: { id: string; nome: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const ext = (nome.split(".").pop() ?? "webm").toLowerCase();
  const mime = ext === "mp3" ? "audio/mpeg" : ext === "m4a" || ext === "aac" ? "audio/mp4" : ext === "wav" ? "audio/wav" : ext === "ogg" || ext === "oga" || ext === "opus" ? "audio/ogg" : "audio/webm";
  useEffect(() => {
    let vivo = true;
    api.bytesAnexo(id).then((b64) => vivo && b64 && setSrc(`data:${mime};base64,${b64}`), () => {});
    return () => void (vivo = false);
  }, [id, mime]);
  return src ? <audio className="quadro-audio" controls src={src} /> : <span className="texto-suave pequeno">{tq.audio.salvando}</span>;
}

/** Camada de desenho à mão sobre todo o quadro do hobby (tipo quadro branco).
 *  Reaproveita o traço do caderno (perfect-freehand). Quando ativa, captura o
 *  toque e desenha/apaga; quando não, só mostra o desenho (deixa os cartões
 *  funcionarem por baixo). */
function CamadaDesenhoQuadro({ cena, largura, altura, ativo, ferramenta, cor, tamanho, aoDesenhar, aoApagarCena }: {
  cena: Cena; largura: number; altura: number; ativo: boolean; ferramenta: "caneta" | "borracha"; cor: string; tamanho: number;
  aoDesenhar: (t: Traco) => void; aoApagarCena: (nova: Cena) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [vivo, setVivo] = useState<Traco | null>(null);
  const [apagarLocal, setApagarLocal] = useState<Cena | null>(null);
  const desenhando = useRef(false);
  const raioBorracha = Math.max(7, tamanho * 2);

  const ponto = (e: React.PointerEvent): Ponto => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * largura, y: ((e.clientY - r.top) / r.height) * altura, p: e.pressure > 0 ? e.pressure : 0.5 };
  };
  const apagarEm = (base: Cena, x: number, y: number): Cena => {
    const novos = [];
    for (const el of base.elementos) {
      if (el.tipo !== "traco") { novos.push(el); continue; }
      const frags = fragmentosAoApagar(el, x, y, raioBorracha);
      if (frags === null) { novos.push(el); continue; }
      frags.forEach((pontos, i) => novos.push({ ...el, id: i === 0 ? el.id : crypto.randomUUID(), pontos }));
    }
    return { elementos: novos };
  };
  const inicio = (e: React.PointerEvent) => {
    if (!ativo || (e.button != null && e.button !== 0)) return;
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const pt = ponto(e);
    if (ferramenta === "borracha") setApagarLocal(apagarEm(cena, pt.x, pt.y));
    else setVivo({ tipo: "traco", id: crypto.randomUUID(), ferramenta: "caneta", cor, espessura: Math.round(tamanho), pontos: [pt] });
  };
  const mover = (e: React.PointerEvent) => {
    if (!desenhando.current) return;
    const pt = ponto(e);
    if (ferramenta === "borracha") setApagarLocal((c) => apagarEm(c ?? cena, pt.x, pt.y));
    else setVivo((v) => (v ? { ...v, pontos: [...v.pontos, pt] } : v));
  };
  const fim = () => {
    if (!desenhando.current) return;
    desenhando.current = false;
    if (ferramenta === "borracha") { setApagarLocal((c) => { if (c) aoApagarCena(c); return null; }); }
    else setVivo((v) => { if (v && v.pontos.length) aoDesenhar(v); return null; });
  };

  const mostra = apagarLocal ?? cena;
  return (
    <svg ref={ref} className="quadro-desenho-svg" viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none"
      style={{ pointerEvents: ativo ? "auto" : "none", cursor: ativo ? "crosshair" : undefined }}
      onPointerDown={inicio} onPointerMove={mover} onPointerUp={fim} onPointerCancel={fim}>
      {mostra.elementos.map((el) => (el.tipo === "traco" ? <path key={el.id} d={caminhoDeTraco(el)} fill={el.cor} opacity={el.opacidade ?? FERRAMENTAS[el.ferramenta].opacidade} /> : null))}
      {vivo && <path d={caminhoDeTraco(vivo)} fill={vivo.cor} opacity={FERRAMENTAS.caneta.opacidade} />}
    </svg>
  );
}

/** Grava áudio pelo microfone (MediaRecorder) e guarda como anexo; ou anexa um áudio existente. */
function GravadorAudio({ hobbyId, aoGravado, aoAnexarExistente, aoFechar }: { hobbyId: string; aoGravado: (a: Anexo) => void; aoAnexarExistente: () => void; aoFechar: () => void }) {
  const [estado, setEstado] = useState<"parado" | "gravando" | "salvando">("parado");
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const fluxo = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (estado !== "gravando") return;
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [estado]);

  const pararFluxo = () => {
    fluxo.current?.getTracks().forEach((tr) => tr.stop());
    fluxo.current = null;
  };

  const comecar = async () => {
    setErro(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setErro(tq.audio.semMic);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      fluxo.current = stream;
      pedacos.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => e.data.size && pedacos.current.push(e.data);
      mr.start();
      gravador.current = mr;
      setSegundos(0);
      setEstado("gravando");
    } catch {
      pararFluxo();
      setErro(tq.audio.semMic);
    }
  };

  const parar = () => {
    const mr = gravador.current;
    if (!mr) return;
    setEstado("salvando");
    mr.onstop = async () => {
      pararFluxo();
      try {
        const blob = new Blob(pedacos.current, { type: "audio/webm" });
        const buf = await blob.arrayBuffer();
        let bin = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const b64 = btoa(bin);
        const nome = `audio-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.webm`;
        const anexo = await api.anexarBytes(hobbyId, nome, b64);
        aoGravado(anexo);
      } catch (e) {
        setErro(mensagem(e));
        setEstado("parado");
      }
    };
    mr.stop();
  };

  const cancelar = () => {
    if (gravador.current && estado === "gravando") {
      gravador.current.onstop = () => pararFluxo();
      gravador.current.stop();
    } else {
      pararFluxo();
    }
    aoFechar();
  };

  useEffect(() => () => pararFluxo(), []);

  const mm = String(Math.floor(segundos / 60)).padStart(2, "0");
  const ss = String(segundos % 60).padStart(2, "0");

  return (
    <div className="formulario">
      <p className="texto-suave pequeno">{tq.audio.ajuda}</p>
      {estado === "gravando" && <p className="quadro-gravando" aria-live="polite"><Mic aria-hidden="true" size="1.1em" /> {tq.audio.gravando} {mm}:{ss}</p>}
      {estado === "salvando" && <p className="texto-suave" aria-live="polite">{tq.audio.salvando}</p>}
      <Aviso>{erro}</Aviso>
      {estado !== "gravando" && (
        <Button className="botao com-icone" onPress={aoAnexarExistente} isDisabled={estado === "salvando"}>
          <FileUp aria-hidden="true" size="1em" /> {tq.audio.anexar}
        </Button>
      )}
      <div className="janela-acoes">
        <Button className="botao" onPress={cancelar}>{tq.audio.cancelar}</Button>
        {estado === "gravando" ? (
          <Button className="botao principal" onPress={parar}>{tq.audio.parar}</Button>
        ) : (
          <Button className="botao principal" onPress={() => void comecar()} isDisabled={estado === "salvando"}><Mic aria-hidden="true" size="1.1em" /> {tq.audio.comecar}</Button>
        )}
      </div>
    </div>
  );
}
