import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, escolherArquivoParaAnexar, type Anexo, type CartaoQuadro, type Hobby, type TipoCartao } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { ImagemAnexo } from "../relacoes/Relacoes";
import { ChevronLeft, Download, ExternalLink, FileText, GripVertical, ImagePlus, Link2, Mic, Pencil, Plus, Sparkles, StickyNote, Trash2, X } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";

const t = textos.hobbies;
const tq = t.quadro;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

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

  // Mantém o hobby aberto em sincronia com a lista (nome editado etc.).
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
  texto: { largura: 220, altura: 150 },
  imagem: { largura: 200, altura: 200 },
  arquivo: { largura: 210, altura: 92 },
  link: { largura: 210, altura: 92 },
  audio: { largura: 260, altura: 96 },
};

/** O quadro livre de um hobby: cartões soltos que a pessoa arrasta e organiza. */
function QuadroHobby({ hobby, aoFechar }: { hobby: Hobby; aoFechar: () => void }) {
  const [cartoes, setCartoes] = useState<CartaoQuadro[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [link, setLink] = useState<{ nome: string; endereco: string } | null>(null);
  const [gravando, setGravando] = useState(false);
  const [ampliando, setAmpliando] = useState<CartaoQuadro | null>(null);
  const recado = useRecado();

  const carregar = useCallback(() => api.listarCartoes(hobby.id).then(setCartoes, (e) => setErro(mensagem(e))), [hobby.id]);
  useEffect(() => void carregar(), [carregar]);

  // Posição escalonada para o próximo cartão, para não nascerem todos em cima.
  const proximaPos = () => {
    const n = cartoes.length;
    return { x: 40 + (n % 6) * 36, y: 40 + (n % 6) * 36 };
  };

  const criarCartao = async (tipo: TipoCartao, extra: Partial<CartaoQuadro>) => {
    const pos = proximaPos();
    const tam = TAMANHO_PADRAO[tipo];
    const novo = await api.salvarCartao({
      id: "", hobbyId: hobby.id, tipo, texto: "", anexoId: "", x: pos.x, y: pos.y, largura: tam.largura, altura: tam.altura, criadoEm: 0, ...extra,
    });
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

  const adicionarArquivo = (soImagens: boolean) =>
    comOcupado(async () => {
      const caminho = await escolherArquivoParaAnexar(soImagens);
      if (!caminho) return;
      const anexo = await api.anexarArquivo(hobby.id, caminho);
      await criarCartao(anexo.tipo === "imagem" ? "imagem" : "arquivo", { anexoId: anexo.id, texto: anexo.nome });
    });

  const adicionarLinkConfirmar = (nome: string, endereco: string) =>
    comOcupado(async () => {
      const anexo = await api.anexarLink(hobby.id, nome, endereco);
      await criarCartao("link", { anexoId: anexo.id, texto: anexo.nome });
      setLink(null);
    });

  const adicionarAudio = (anexo: Anexo) =>
    comOcupado(async () => {
      await criarCartao("audio", { anexoId: anexo.id, texto: anexo.nome });
      setGravando(false);
    });

  const mover = async (id: string, x: number, y: number) => {
    setCartoes((cs) => cs.map((c) => (c.id === id ? { ...c, x, y } : c)));
    try {
      await api.moverCartao(id, x, y);
    } catch (e) {
      setErro(mensagem(e));
    }
  };

  const salvarTexto = async (c: CartaoQuadro, texto: string) => {
    await api.salvarCartao({ ...c, texto });
    await carregar();
  };

  const apagar = async (c: CartaoQuadro) => {
    await api.excluirCartao(c.id);
    await carregar();
    recado(tq.apagar);
  };

  // O "chão" do quadro cresce com os cartões, para sempre caber e poder rolar.
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
        </div>
      </div>

      {erro && <div className="leitor-aviso"><Aviso>{erro}</Aviso></div>}
      {ocupado && <p className="leitor-aviso texto-suave">{tq.anexando}</p>}

      <div className="quadro-rolagem">
        {cartoes.length === 0 ? (
          <p className="texto-suave quadro-vazio">{tq.vazio}</p>
        ) : (
          <p className="texto-suave pequeno quadro-dica">{tq.dica}</p>
        )}
        <div className="quadro-chao" style={{ width: largura, height: altura }}>
          {cartoes.map((c) => (
            <CartaoView key={c.id} cartao={c} aoMover={mover} aoApagar={() => void apagar(c)} aoAmpliar={() => setAmpliando(c)} aoSalvarTexto={(txt) => void salvarTexto(c, txt)} />
          ))}
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
        {gravando && <GravadorAudio hobbyId={hobby.id} aoGravado={adicionarAudio} aoFechar={() => setGravando(false)} />}
      </Janela>

      <Janela titulo={ampliando?.texto || ""} aberta={ampliando !== null} aoFechar={() => setAmpliando(null)} larga>
        {ampliando && <ImagemAnexo id={ampliando.anexoId} nome="" className="anexo-grande" />}
      </Janela>
    </div>
  );
}

/** Um cartão solto no quadro: arrastável pelo mouse e pelo teclado. */
function CartaoView({ cartao, aoMover, aoApagar, aoAmpliar, aoSalvarTexto }: {
  cartao: CartaoQuadro;
  aoMover: (id: string, x: number, y: number) => void;
  aoApagar: () => void;
  aoAmpliar: () => void;
  aoSalvarTexto: (texto: string) => void;
}) {
  const [pos, setPos] = useState({ x: cartao.x, y: cartao.y });
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(cartao.texto);
  const arrasteRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  useEffect(() => setPos({ x: cartao.x, y: cartao.y }), [cartao.x, cartao.y]);

  const aoApontar = (e: React.PointerEvent) => {
    if (editando) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arrasteRef.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
  };
  const aoMoverPonteiro = (e: React.PointerEvent) => {
    const a = arrasteRef.current;
    if (!a) return;
    setPos({ x: Math.max(0, a.ox + (e.clientX - a.px)), y: Math.max(0, a.oy + (e.clientY - a.py)) });
  };
  const aoSoltar = () => {
    if (!arrasteRef.current) return;
    arrasteRef.current = null;
    aoMover(cartao.id, pos.x, pos.y);
  };
  const aoTecla = (e: React.KeyboardEvent) => {
    const passo = e.shiftKey ? 40 : 12;
    const nova = { ...pos };
    if (e.key === "ArrowLeft") nova.x = Math.max(0, pos.x - passo);
    else if (e.key === "ArrowRight") nova.x = pos.x + passo;
    else if (e.key === "ArrowUp") nova.y = Math.max(0, pos.y - passo);
    else if (e.key === "ArrowDown") nova.y = pos.y + passo;
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); aoApagar(); return; }
    else return;
    e.preventDefault();
    setPos(nova);
    aoMover(cartao.id, nova.x, nova.y);
  };

  return (
    <div className="quadro-cartao-livre" style={{ left: pos.x, top: pos.y, width: cartao.largura }}>
      <div className="quadro-cartao-barra">
        <span
          className="quadro-alca"
          role="button"
          tabIndex={0}
          aria-label={`${tq.mover}: ${cartao.texto || cartao.tipo}`}
          onPointerDown={aoApontar}
          onPointerMove={aoMoverPonteiro}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
          onKeyDown={aoTecla}
        >
          <GripVertical aria-hidden="true" size="1.1em" />
        </span>
        <Button className="botao-icone pequeno" onPress={aoApagar} aria-label={tq.apagar}><X aria-hidden="true" size="1em" /></Button>
      </div>
      <ConteudoCartao cartao={cartao} editando={editando} rascunho={rascunho} setEditando={setEditando} setRascunho={setRascunho} aoAmpliar={aoAmpliar} aoSalvarTexto={aoSalvarTexto} />
    </div>
  );
}

function ConteudoCartao({ cartao, editando, rascunho, setEditando, setRascunho, aoAmpliar, aoSalvarTexto }: {
  cartao: CartaoQuadro;
  editando: boolean;
  rascunho: string;
  setEditando: (v: boolean) => void;
  setRascunho: (v: string) => void;
  aoAmpliar: () => void;
  aoSalvarTexto: (texto: string) => void;
}) {
  if (cartao.tipo === "texto") {
    if (editando) {
      return (
        <div className="quadro-texto-editor">
          <textarea className="entrada-texto" value={rascunho} onChange={(e) => setRascunho(e.target.value)} aria-label={tq.editarTexto} autoFocus rows={4} />
          <Button className="botao principal pequeno" onPress={() => { aoSalvarTexto(rascunho); setEditando(false); }}>{tq.salvarTexto}</Button>
        </div>
      );
    }
    return (
      <Button className="quadro-texto" onPress={() => setEditando(true)}>
        <span className="quebra">{cartao.texto || <span className="texto-suave">{tq.textoVazio}</span>}</span>
      </Button>
    );
  }
  if (cartao.tipo === "imagem") {
    return (
      <Button className="quadro-imagem" onPress={aoAmpliar} aria-label={tq.ampliar}>
        <ImagemAnexo id={cartao.anexoId} nome="" className="quadro-imagem-mini" />
      </Button>
    );
  }
  if (cartao.tipo === "audio") {
    return <AudioAnexo id={cartao.anexoId} />;
  }
  // arquivo ou link.
  return (
    <Button className="quadro-arquivo" onPress={() => void api.abrirAnexo(cartao.anexoId)}>
      <span className="quadro-arquivo-icone" aria-hidden="true">{cartao.tipo === "link" ? <Link2 size="1.3em" /> : <FileText size="1.3em" />}</span>
      <span className="quebra quadro-arquivo-nome">{cartao.texto || tq.abrir}</span>
      {cartao.tipo === "link" ? <ExternalLink aria-hidden="true" size="1em" /> : <Download aria-hidden="true" size="1em" />}
    </Button>
  );
}

/** Tocador de um áudio guardado no cofre. */
function AudioAnexo({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    api.bytesAnexo(id).then((b64) => vivo && b64 && setSrc(`data:audio/webm;base64,${b64}`), () => {});
    return () => void (vivo = false);
  }, [id]);
  return src ? <audio className="quadro-audio" controls src={src} /> : <span className="texto-suave pequeno">{tq.audio.salvando}</span>;
}

/** Grava áudio pelo microfone (MediaRecorder) e guarda como anexo. */
function GravadorAudio({ hobbyId, aoGravado, aoFechar }: { hobbyId: string; aoGravado: (a: Anexo) => void; aoFechar: () => void }) {
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
