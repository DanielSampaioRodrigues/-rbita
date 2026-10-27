import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Form, Label, Radio, RadioGroup } from "react-aria-components";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { caminhoDeForma, caminhoDeTraco, cenaVazia, elementoDentro, escalar, FERRAMENTAS, formaAtingida, fragmentosAoApagar, lerCena, limitesDe, MODELOS_PAPEL, papelDataUri, papelPadrao, rotacionar, serializarCena, TAMANHOS, TIPOS_FORMA, transladar, type AlinharTexto, type Cena, type CoresPapel, type Elemento, type Ferramenta, type Forma, type Imagem, type ModeloPapel, type Papel, type Ponto2, type Texto, type TipoForma, type Traco } from "@orbita/caderno";
import { api, CORES_ETIQUETA, type Capa, type Caderno, type EstadoIa, type PaginaCaderno, type PastaCaderno } from "../api";
import { reduzirImagem } from "../fundo";
import { useReescrever } from "../ia/Reescrever";
import { useDitar } from "../ditado/Ditar";
import { CriarImagemIa } from "./CriarImagemIa";
import { Aviso, Campo } from "../componentes/Campo";
import { Interruptor } from "../componentes/Interruptor";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bold, Bookmark, ChevronLeft, Eraser, FolderOpen, FolderPlus, GripVertical, Highlighter, ImagePlus, Italic, Lasso, LayoutGrid, List, ListOrdered, Palette, Pencil, PenLine, Plus, Redo2, Ruler, Shapes, SlidersHorizontal, Sparkles, Sticker, StickyNote, Trash2, Type, Underline, Undo2, Wand2 } from "../icones";
import { ADESIVOS, CAPAS_ARTE, urlAdesivo, urlCapaArte } from "./galeria";
import { CapaEditor, RenderCapaCena } from "./CapaEditor";
import { lerCenaCapa, serializarCenaCapa, temCapaCena, type CenaCapa } from "./capa";
import { FONTES } from "../preferencias";
import { avisarMudanca, useMudancas } from "../dados";
import { useEntrarImersivo } from "../app/Imersivo";
import { textos } from "../textos/pt-BR";

const t = textos.caderno;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Capas prontas da galeria (gradientes). Ids guardados no dado do caderno. */
const CAPAS_GALERIA: { id: string; nome: string; css: string }[] = [
  { id: "noite", nome: "Noite", css: "linear-gradient(135deg, #2b3a55, #44709f)" },
  { id: "bosque", nome: "Bosque", css: "linear-gradient(135deg, #3f5e34, #5b7a4c)" },
  { id: "poente", nome: "Poente", css: "linear-gradient(135deg, #a95b7f, #94603d)" },
  { id: "areia", nome: "Areia", css: "linear-gradient(135deg, #8f7738, #dcc48c)" },
  { id: "lavanda", nome: "Lavanda", css: "linear-gradient(135deg, #7c68a8, #b9a6e0)" },
  { id: "carvao", nome: "Carvão", css: "linear-gradient(135deg, #2a2d33, #4a4f58)" },
  { id: "oceano", nome: "Oceano", css: "linear-gradient(135deg, #1b4a5a, #2e8a99)" },
  { id: "cereja", nome: "Cereja", css: "linear-gradient(135deg, #7a2746, #c05d7e)" },
  { id: "menta", nome: "Menta", css: "linear-gradient(135deg, #2f6b57, #7fc4a8)" },
  { id: "grafite", nome: "Grafite", css: "linear-gradient(135deg, #3a3f47, #6f747c)" },
  { id: "amanhecer", nome: "Amanhecer", css: "linear-gradient(135deg, #b2533e, #e0a56a)" },
  { id: "indigo", nome: "Índigo", css: "linear-gradient(135deg, #3a3a7a, #6f68c0)" },
  { id: "floresta", nome: "Floresta", css: "linear-gradient(160deg, #22402e, #4a7a52 70%, #86b06a)" },
  { id: "uva", nome: "Uva", css: "linear-gradient(135deg, #4a2a63, #8a5fa8)" },
];

function estiloCapa(capa: Capa): React.CSSProperties {
  if (capa.tipo === "imagem") {
    return capa.valor ? { backgroundImage: `url("${capa.valor}")`, backgroundSize: "cover", backgroundPosition: "center" } : { background: "var(--cor-superficie-alternativa)" };
  }
  if (capa.tipo === "galeria") {
    return { background: CAPAS_GALERIA.find((x) => x.id === capa.valor)?.css ?? "var(--cor-superficie-alternativa)" };
  }
  if (capa.tipo === "arte") {
    return { backgroundImage: `url("${urlCapaArte(capa.valor)}")`, backgroundSize: "cover", backgroundPosition: "center" };
  }
  return { background: `var(--etq-${capa.valor || "mar"})` };
}

export function PaginaCaderno() {
  const [cadernos, setCadernos] = useState<Caderno[]>([]);
  const [pastas, setPastas] = useState<PastaCaderno[]>([]);
  const [editando, setEditando] = useState<Caderno | null>(null);
  const [excluindo, setExcluindo] = useState<Caderno | null>(null);
  const [editandoPasta, setEditandoPasta] = useState<PastaCaderno | null>(null);
  const [excluindoPasta, setExcluindoPasta] = useState<PastaCaderno | null>(null);
  const [pastaAberta, setPastaAberta] = useState<PastaCaderno | null>(null);
  const [aberto, setAberto] = useState<Caderno | null>(null);
  const [recentes, setRecentes] = useState<string[]>(() => {
    try { const s = localStorage.getItem("caderno-recentes"); if (s) { const v = JSON.parse(s); if (Array.isArray(v)) return v; } } catch { /* ignora */ }
    return [];
  });
  const [erro, setErro] = useState<string | null>(null);
  const [ia, setIa] = useState<EstadoIa | null>(null);
  useEffect(() => { api.estadoIa().then(setIa, () => {}); }, []);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarCadernos().then(setCadernos, (e) => setErro(mensagem(e)));
    api.listarPastasCaderno().then(setPastas, () => {});
  }, [mudancas]);

  const excluir = async () => {
    if (!excluindo) return;
    await api.excluirCaderno(excluindo.id);
    setExcluindo(null);
    avisarMudanca();
  };
  const excluirPasta = async () => {
    if (!excluindoPasta) return;
    await api.excluirPastaCaderno(excluindoPasta.id);
    setExcluindoPasta(null);
    avisarMudanca();
  };

  const abrir = (c: Caderno) => {
    setRecentes((r) => {
      const novo = [c.id, ...r.filter((x) => x !== c.id)].slice(0, 8);
      try { localStorage.setItem("caderno-recentes", JSON.stringify(novo)); } catch { /* ignora */ }
      return novo;
    });
    setAberto(c);
  };

  const atual = aberto ? cadernos.find((c) => c.id === aberto.id) ?? aberto : null;
  if (atual) {
    const abas = recentes.map((id) => cadernos.find((c) => c.id === id)).filter((c): c is Caderno => !!c);
    return <CadernoAberto key={atual.id} caderno={atual} abas={abas} aoTrocar={abrir} aoFechar={() => setAberto(null)} />;
  }

  const porPasta = (pastaId: string) => cadernos.filter((c) => c.pastaId === pastaId);
  const semPasta = cadernos.filter((c) => !c.pastaId || !pastas.some((p) => p.id === c.pastaId));
  const novo = (pastaId: string): Caderno => ({ id: "", nome: "", modo: "caderno", capa: { tipo: "cor", valor: "mar" }, pastaId, criadoEm: 0 });

  // Mantém a pasta aberta em dia (some se for apagada).
  const dentro = pastaAberta ? pastas.find((p) => p.id === pastaAberta.id) ?? null : null;
  const moverParaPasta = async (c: Caderno, pastaId: string) => {
    try {
      await api.salvarCaderno({ ...c, pastaId });
      avisarMudanca();
    } catch (e) {
      setErro(mensagem(e));
    }
  };

  return (
    <div className="pagina">
      {dentro ? (
        <>
          <div className="linha-ajuste">
            <Button className="botao com-icone" onPress={() => setPastaAberta(null)}><ChevronLeft aria-hidden="true" size="1.1em" /> {t.voltarEstante}</Button>
            <span className="linha-ajuste">
              <Button className="botao-icone" onPress={() => setEditandoPasta(dentro)} aria-label={`${t.pasta.editar}: ${dentro.nome}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
              <Button className="botao-icone" onPress={() => setExcluindoPasta(dentro)} aria-label={`${t.pasta.excluir}: ${dentro.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
            </span>
          </div>
          <h1><FolderOpen aria-hidden="true" size="1em" /> {dentro.nome}</h1>
          <div className="botoes">
            <Button className="botao principal" onPress={() => setEditando(novo(dentro.id))}><Plus aria-hidden="true" size="1.1em" /> {t.novo}</Button>
          </div>
          <GradeCadernos cadernos={porPasta(dentro.id)} aoAbrir={abrir} aoEditar={setEditando} aoExcluir={setExcluindo} pastas={pastas} aoMover={moverParaPasta} />
        </>
      ) : (
        <>
          <h1>{t.titulo}</h1>
          <p className="pagina-intro">{t.intro}</p>
          <div className="botoes">
            <Button className="botao principal" onPress={() => setEditando(novo(""))}><Plus aria-hidden="true" size="1.1em" /> {t.novo}</Button>
            <Button className="botao" onPress={() => setEditandoPasta({ id: "", nome: "", criadoEm: 0 })}><Plus aria-hidden="true" size="1.1em" /> {t.novaPasta}</Button>
          </div>

          {pastas.length > 0 && (
            <ul className="caderno-pastas">
              {pastas.map((p) => (
                <li key={p.id}>
                  <CartaoPasta pasta={p} quantidade={porPasta(p.id).length} aoAbrir={() => setPastaAberta(p)} aoEditar={() => setEditandoPasta(p)} aoExcluir={() => setExcluindoPasta(p)} />
                </li>
              ))}
            </ul>
          )}

          {cadernos.length === 0 ? (
            <section className="cartao largura-leitura esticado"><p className="texto-suave">{t.vazio}</p></section>
          ) : (
            <section className="caderno-grupo">
              {pastas.length > 0 && <h2 className="caderno-grupo-titulo">{t.semPasta} <span className="texto-suave">({semPasta.length})</span></h2>}
              <GradeCadernos cadernos={semPasta} aoAbrir={abrir} aoEditar={setEditando} aoExcluir={setExcluindo} pastas={pastas} aoMover={moverParaPasta} />
            </section>
          )}
        </>
      )}

      <Aviso>{erro}</Aviso>

      <Janela titulo={editando && editando.id ? t.form.editarTitulo : t.form.novoTitulo} aberta={editando !== null} aoFechar={() => setEditando(null)}>
        {editando && <FormCaderno key={editando.id || "novo"} inicial={editando} pastas={pastas} ia={ia} aoMudarIa={setIa} aoFechar={() => setEditando(null)} />}
      </Janela>
      <Janela titulo={editandoPasta && editandoPasta.id ? t.pasta.editar : t.pasta.nova} aberta={editandoPasta !== null} aoFechar={() => setEditandoPasta(null)}>
        {editandoPasta && <FormPasta key={editandoPasta.id || "novo"} inicial={editandoPasta} aoFechar={() => setEditandoPasta(null)} />}
      </Janela>
      <Confirmar titulo={t.excluir} texto={excluindo ? t.confirmarExcluir(excluindo.nome) : ""} confirmar={t.excluir} aberta={excluindo !== null} aoCancelar={() => setExcluindo(null)} aoConfirmar={() => void excluir()} />
      <Confirmar titulo={t.pasta.excluir} texto={excluindoPasta ? t.pasta.confirmarExcluir(excluindoPasta.nome) : ""} confirmar={t.pasta.excluir} aberta={excluindoPasta !== null} aoCancelar={() => setExcluindoPasta(null)} aoConfirmar={() => void excluirPasta()} />
    </div>
  );
}

function CartaoPasta({ pasta, quantidade, aoAbrir, aoEditar, aoExcluir }: { pasta: PastaCaderno; quantidade: number; aoAbrir: () => void; aoEditar: () => void; aoExcluir: () => void }) {
  return (
    <div className="caderno-pasta">
      <button className="caderno-pasta-fig" onClick={aoAbrir} aria-label={`${t.abrir}: ${pasta.nome}`}>
        <span className="caderno-pasta-qtd">{quantidade}</span>
      </button>
      <div className="caderno-item-pe">
        <strong className="quebra">{pasta.nome}</strong>
        <span className="linha-ajuste">
          <Button className="botao-icone pequeno" onPress={aoEditar} aria-label={`${t.pasta.editar}: ${pasta.nome}`}><Pencil aria-hidden="true" size="1em" /></Button>
          <Button className="botao-icone pequeno" onPress={aoExcluir} aria-label={`${t.pasta.excluir}: ${pasta.nome}`}><Trash2 aria-hidden="true" size="1em" /></Button>
        </span>
      </div>
    </div>
  );
}

function GradeCadernos({ cadernos, aoAbrir, aoEditar, aoExcluir, pastas, aoMover }: { cadernos: Caderno[]; aoAbrir: (c: Caderno) => void; aoEditar: (c: Caderno) => void; aoExcluir: (c: Caderno) => void; pastas: PastaCaderno[]; aoMover: (c: Caderno, pastaId: string) => void }) {
  if (cadernos.length === 0) return <p className="texto-suave pequeno">{t.vazio}</p>;
  return (
    <ul className="caderno-grade">
      {cadernos.map((c) => (
        <li key={c.id} className="caderno-item">
          <button className="caderno-capa" style={estiloCapa(c.capa)} onClick={() => aoAbrir(c)} aria-label={`${t.abrir}: ${c.nome}`}>
            <span className="caderno-capa-modo">{c.modo === "infinito" ? <LayoutGrid aria-hidden="true" size="1em" /> : <PenLine aria-hidden="true" size="1em" />}</span>
            {temCapaCena(c.capaCena) ? <RenderCapaCena cena={lerCenaCapa(c.capaCena)} /> : <span className="caderno-capa-nome">{c.nome}</span>}
          </button>
          <div className="caderno-item-pe">
            <span className="livro-selo">{t.modos[c.modo]}</span>
            <span className="linha-ajuste">
              <Button className="botao-icone pequeno" onPress={() => aoEditar(c)} aria-label={`${t.editar}: ${c.nome}`}><Pencil aria-hidden="true" size="1em" /></Button>
              <Button className="botao-icone pequeno" onPress={() => aoExcluir(c)} aria-label={`${t.excluir}: ${c.nome}`}><Trash2 aria-hidden="true" size="1em" /></Button>
            </span>
          </div>
          <label className="caderno-mover">
            <FolderPlus aria-hidden="true" size="0.95em" />
            <select className="caderno-mover-select" value={c.pastaId} onChange={(e) => aoMover(c, e.target.value)} aria-label={`${t.moverPara}: ${c.nome}`}>
              <option value="">{t.semPasta}</option>
              {pastas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
        </li>
      ))}
    </ul>
  );
}

function EscolherCapa({ capa, aoMudar, ia, aoMudarIa }: { capa: Capa; aoMudar: (c: Capa) => void; ia: EstadoIa | null; aoMudarIa: (e: EstadoIa) => void }) {
  const [modo, setModo] = useState<"cor" | "galeria" | "imagem">(capa.tipo === "arte" ? "galeria" : capa.tipo);
  const [iaAberta, setIaAberta] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);

  const usarImagem = async (origem: string | File) => {
    setOcupado(true);
    const u = typeof origem === "string" ? origem : URL.createObjectURL(origem);
    try {
      const red = await reduzirImagem(u, 700);
      aoMudar({ tipo: "imagem", valor: red });
    } catch { /* ignora imagem inválida */ } finally {
      if (typeof origem !== "string") URL.revokeObjectURL(u);
      setOcupado(false);
    }
  };

  return (
    <div className="campo">
      <span className="campo-rotulo">{t.form.capa}</span>
      <Segmentado<"cor" | "galeria" | "imagem"> rotulo={t.capas.tipo} rotuloOculto valor={modo} aoMudar={setModo}
        opcoes={[{ valor: "cor", nome: t.capas.cores }, { valor: "galeria", nome: t.capas.galeria }, { valor: "imagem", nome: t.capas.imagem }]} />

      {modo === "cor" && (
        <RadioGroup className="campo" value={capa.tipo === "cor" ? capa.valor : ""} onChange={(v) => aoMudar({ tipo: "cor", valor: v })} orientation="horizontal" aria-label={t.capas.cores}>
          <div className="cores-etiqueta">
            {CORES_ETIQUETA.map((c) => (
              <Radio key={c} value={c} className="cor-opcao" aria-label={textos.ideias.cores[c]}>
                <span className={`etiqueta-cor grande cor-${c}`} aria-hidden="true" />
              </Radio>
            ))}
          </div>
        </RadioGroup>
      )}

      {modo === "galeria" && (
        <RadioGroup className="campo"
          value={capa.tipo === "arte" ? `a:${capa.valor}` : capa.tipo === "galeria" ? `g:${capa.valor}` : ""}
          onChange={(v) => { const i = v.indexOf(":"); const k = v.slice(0, i); const id = v.slice(i + 1); aoMudar(k === "a" ? { tipo: "arte", valor: id } : { tipo: "galeria", valor: id }); }}
          aria-label={t.capas.galeria}>
          <div className="caderno-galeria">
            {CAPAS_ARTE.map((g) => (
              <Radio key={g.id} value={`a:${g.id}`} className="caderno-galeria-opcao" aria-label={g.nome}>
                <span className="caderno-galeria-amostra" style={{ backgroundImage: `url("${urlCapaArte(g.id)}")`, backgroundSize: "cover", backgroundPosition: "center" }} aria-hidden="true" />
                <span className="pequeno">{g.nome}</span>
              </Radio>
            ))}
            {CAPAS_GALERIA.map((g) => (
              <Radio key={g.id} value={`g:${g.id}`} className="caderno-galeria-opcao" aria-label={g.nome}>
                <span className="caderno-galeria-amostra" style={{ background: g.css }} aria-hidden="true" />
                <span className="pequeno">{g.nome}</span>
              </Radio>
            ))}
          </div>
        </RadioGroup>
      )}

      {modo === "imagem" && (
        <div className="caderno-capa-imagem">
          {capa.tipo === "imagem" && capa.valor
            ? <div className="caderno-capa-previa" role="img" aria-label={t.capas.preview} style={estiloCapa(capa)} />
            : <p className="campo-ajuda">{t.capas.semImagem}</p>}
          <div className="botoes">
            <Button className="botao com-icone" isDisabled={ocupado} onPress={() => fileRef.current?.click()}><ImagePlus aria-hidden="true" size="1em" /> {capa.tipo === "imagem" && capa.valor ? t.capas.trocar : t.capas.enviar}</Button>
            <Button className="botao com-icone" isDisabled={ocupado} onPress={() => setIaAberta(true)}><Sparkles aria-hidden="true" size="1em" /> {t.capas.criarIa}</Button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void usarImagem(f); e.target.value = ""; }} />
          <Janela titulo={t.imagemIa.titulo} aberta={iaAberta} aoFechar={() => setIaAberta(false)}>
            {iaAberta && <CriarImagemIa ia={ia} aoMudarIa={aoMudarIa} aoInserir={async (dataUrl) => { await usarImagem(dataUrl); setIaAberta(false); }} />}
          </Janela>
        </div>
      )}
    </div>
  );
}

function FormCaderno({ inicial, pastas, ia, aoMudarIa, aoFechar }: { inicial: Caderno; pastas: PastaCaderno[]; ia: EstadoIa | null; aoMudarIa: (e: EstadoIa) => void; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [modo, setModo] = useState<Caderno["modo"]>(inicial.modo);
  const [capa, setCapa] = useState<Capa>(inicial.capa);
  const [cena, setCena] = useState<CenaCapa>(lerCenaCapa(inicial.capaCena));
  const [pastaId, setPastaId] = useState(inicial.pastaId);
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarCaderno({ ...inicial, nome, modo, capa, capaCena: serializarCenaCapa(cena), pastaId });
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
          <Segmentado rotulo={t.form.modo} valor={modo} aoMudar={(v) => setModo(v as Caderno["modo"])} opcoes={[{ valor: "caderno", nome: t.modos.caderno }, { valor: "infinito", nome: t.modos.infinito }]} />
          <p className="campo-ajuda">{t.modoAjuda[modo]}</p>
        </>
      )}
      <EscolherCapa capa={capa} aoMudar={setCapa} ia={ia} aoMudarIa={aoMudarIa} />
      <CapaEditor nome={nome} cena={cena} aoMudar={setCena} previa={<div className="capa-editor-fundo" style={estiloCapa(capa)} />} />
      {pastas.length > 0 && (
        <div className="campo">
          <label className="campo-rotulo" htmlFor="caderno-pasta">{t.form.pasta}</label>
          <select id="caderno-pasta" className="entrada-texto sozinha" value={pastaId} onChange={(e) => setPastaId(e.target.value)}>
            <option value="">{t.form.semPasta}</option>
            {pastas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      )}
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.form.salvarMudancas : t.form.salvar}</Button>
      </div>
    </Form>
  );
}

function FormPasta({ inicial, aoFechar }: { inicial: PastaCaderno; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarPastaCaderno({ ...inicial, nome });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(mensagem(err));
    }
  };
  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.pasta.nome} valor={nome} aoMudar={setNome} autoFocus maximo={60} semDitado />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.pasta.salvarMudancas : t.pasta.salvar}</Button>
      </div>
    </Form>
  );
}

// ---------- Caderno aberto: visor do modo caderno com as folhas ----------
// (As folhas — pautado, quadriculado... — são reais; o desenho à mão com
// caneta chega na etapa seguinte.)

/** Cor de paleta → hex (tema claro). Papel/linha sem cor usam o padrão. */
const HEX_ETIQUETA: Record<string, string> = {
  musgo: "#5b7a4c", mar: "#2e7a80", ceu: "#44709f", lavanda: "#7c68a8",
  rosa: "#a95b7f", terra: "#94603d", areia: "#8f7738", cinza: "#6f747c",
};
/** Resolve uma cor da folha: hex livre (#rrggbb), nome da paleta, ou padrão. */
function resolverCorFolha(valor: string, padrao: string): string {
  if (!valor) return padrao;
  if (valor.startsWith("#")) return valor;
  return HEX_ETIQUETA[valor] ?? padrao;
}
/** Aplica opacidade a uma cor #rrggbb, virando rgba(); 1 mantém como está. */
function corComAlfa(base: string, alfa: number): string {
  if (alfa >= 1) return base;
  const m = /^#([0-9a-fA-F]{6})$/.exec(base);
  if (!m) return base;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, alfa).toFixed(2)})`;
}
function coresDaFolha(papel: Papel): CoresPapel {
  return {
    fundo: corComAlfa(resolverCorFolha(papel.corPapel, "#ffffff"), papel.opacPapel ?? 1),
    linha: corComAlfa(resolverCorFolha(papel.corLinha, "#c9ccd4"), papel.opacLinha ?? 1),
  };
}
function folhaDe(pagina: PaginaCaderno): Papel {
  return { ...papelPadrao(), ...((pagina.papel as Partial<Papel>) || {}) };
}
/** Limites do tamanho personalizado, em px de referência (96 dpi). */
const CUSTOM_MIN = 300, CUSTOM_MAX_LARG = 1360, CUSTOM_MAX_ALT = 1900;
function medidaDe(tamanho: string) {
  if (tamanho.startsWith("custom:")) {
    const m = /^custom:(\d+)x(\d+)$/.exec(tamanho);
    if (m) return {
      largura: Math.min(CUSTOM_MAX_LARG, Math.max(CUSTOM_MIN, +m[1])),
      altura: Math.min(CUSTOM_MAX_ALT, Math.max(CUSTOM_MIN, +m[2])),
    };
  }
  return TAMANHOS[tamanho as keyof typeof TAMANHOS] ?? TAMANHOS.a4;
}

/** Cores favoritas que já vêm marcadas (a pessoa troca e adiciona as suas). */
const CORES_PADRAO = ["#1f2937", "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#ca8a04"];
function lerFavoritos(): string[] {
  try {
    const s = localStorage.getItem("caderno-cores-favoritas");
    if (s) { const v = JSON.parse(s); if (Array.isArray(v) && v.length) return v; }
  } catch { /* usa o padrão */ }
  return CORES_PADRAO;
}

type PosBarra = "baixo" | "cima" | "direita" | "esquerda";
const POS_BARRA: PosBarra[] = ["baixo", "cima", "direita", "esquerda"];

/** Cor de ícone que contrasta com um fundo hex (claro → escuro, escuro → claro). */
function corContraste(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#1f2937";
  const n = parseInt(m[1], 16);
  const canal = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
  return lum > 0.4 ? "#1f2937" : "#f5f3ee";
}
function lerCorBarra(): string {
  try { const s = localStorage.getItem("caderno-cor-barra"); if (s && /^#[0-9a-fA-F]{6}$/.test(s)) return s; } catch { /* padrão */ }
  return "";
}

/** Ferramentas da barra: as de traço (do motor) mais texto, nota adesiva,
 *  formas e o laço. */
type FerramentaUI = Ferramenta | "texto" | "nota" | "forma" | "laco";
/** Cores pastel das notas adesivas (a primeira é o padrão). */
const FUNDOS_NOTA = ["#fff3b0", "#ffd6e0", "#d9f2d0", "#cfe8ff", "#e6d9ff", "#ffe0c2"];

/** Régua: uma guia (segmento) para desenhar reto. Em px de referência. */
type Regua = { x1: number; y1: number; x2: number; y2: number; op?: number };
/** Pixels por centímetro (as medidas da página são px a 96 dpi). */
const PX_CM = 96 / 2.54;
const LIMIAR_REGUA = 46; // px de referência: perto da régua, o traço gruda nela
function projetarNaRegua(px: number, py: number, r: Regua): { x: number; y: number } {
  const dx = r.x2 - r.x1, dy = r.y2 - r.y1;
  const comp = dx * dx + dy * dy || 1;
  const t = ((px - r.x1) * dx + (py - r.y1) * dy) / comp;
  return { x: r.x1 + t * dx, y: r.y1 + t * dy };
}
function distDaRegua(px: number, py: number, r: Regua): number {
  const p = projetarNaRegua(px, py, r);
  return Math.hypot(px - p.x, py - p.y);
}

/** Número aproximado de linhas de um conteúdo HTML (parágrafos e quebras). */
const linhasDeHtml = (html: string) => Math.max(1, (html.match(/<(p|br|div)\b/gi)?.length ?? 1));
/** Altura estimada de uma caixa de texto (em px de referência), pelas linhas. */
const alturaTextoEstim = (t: Texto) => linhasDeHtml(t.texto) * t.tamanho * 1.4;
/** O conteúdo HTML está vazio (só tags, sem texto)? */
const textoVazio = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";

/** Extensões do editor da caixa: só marcas em linha (negrito, itálico,
 *  sublinhado) e parágrafos — nada de título, lista ou citação (é um rótulo). */
const extensoesCaderno = [
  StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false, strike: false, link: false }),
];

/** Fontes oferecidas na caixa ("" = padrão do app). */
const FONTES_CADERNO: (keyof typeof FONTES | "")[] = ["", "atkinson", "lexend", "opendyslexic"];
const fonteCss = (f?: string) => (f && f in FONTES ? FONTES[f as keyof typeof FONTES].css : "var(--fonte-texto)");
const ALINHAR: AlinharTexto[] = ["esquerda", "centro", "direita"];
const ALINHAR_CSS: Record<AlinharTexto, "left" | "center" | "right"> = { esquerda: "left", centro: "center", direita: "right" };

/** Lista vazia estável (evita re-render das páginas sem seleção). */
const vazio: string[] = [];

/** Lê um arquivo/blob como base64 (sem o prefixo data:). */
const blobParaBase64 = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1] ?? "");
  r.onerror = () => rej(r.error);
  r.readAsDataURL(b);
});
/** Descobre o tamanho natural (px) de uma imagem em blob. */
const tamanhoImagem = (b: Blob) => new Promise<{ w: number; h: number }>((res) => {
  const u = URL.createObjectURL(b);
  const im = new Image();
  im.onload = () => { res({ w: im.naturalWidth || 4, h: im.naturalHeight || 3 }); URL.revokeObjectURL(u); };
  im.onerror = () => { res({ w: 4, h: 3 }); URL.revokeObjectURL(u); };
  im.src = u;
});
const extDeMime = (t: string) => (t.includes("png") ? "png" : t.includes("gif") ? "gif" : t.includes("webp") ? "webp" : t.includes("svg") ? "svg" : "jpg");
const TAM_TEXTO_PADRAO = 28; // px de referência
const LARGURA_TEXTO_PADRAO = 300; // px de referência
function lerTamTexto(): number {
  try { const s = localStorage.getItem("caderno-tam-texto"); if (s) { const n = Number(s); if (n >= 12 && n <= 80) return n; } } catch { /* padrão */ }
  return TAM_TEXTO_PADRAO;
}

type AjusteForma = { tipo: TipoForma; espessura: number };
function lerAjusteForma(): AjusteForma {
  try {
    const s = localStorage.getItem("caderno-forma");
    if (s) { const v = JSON.parse(s); if (v && TIPOS_FORMA.includes(v.tipo) && typeof v.espessura === "number") return v; }
  } catch { /* padrão */ }
  return { tipo: "reta", espessura: 3 };
}

type AjusteTraco = { tamanho: number; afinar: number; alisar: number; opacidade: number };
function ajustesPadrao(): Record<Ferramenta, AjusteTraco> {
  const o = {} as Record<Ferramenta, AjusteTraco>;
  (Object.keys(FERRAMENTAS) as Ferramenta[]).forEach((f) => (o[f] = { tamanho: FERRAMENTAS[f].tamanho, afinar: FERRAMENTAS[f].afinar, alisar: FERRAMENTAS[f].alisar, opacidade: FERRAMENTAS[f].opacidade }));
  return o;
}
/** Lê os ajustes salvos (estabilização e pressão por ferramenta). */
function lerAjustes(): Record<Ferramenta, AjusteTraco> {
  try {
    const s = localStorage.getItem("caderno-ajustes-traco");
    if (s) return { ...ajustesPadrao(), ...JSON.parse(s) };
  } catch { /* sem armazenamento: usa o padrão */ }
  return ajustesPadrao();
}

/** Desenha a folha (o papel) num tamanho dado, pela SVG do pacote. */
function Folha({ papel, tamanho, className }: { papel: Papel; tamanho: string; className?: string }) {
  const med = medidaDe(tamanho);
  const uri = papelDataUri(papel, med.largura, med.altura, coresDaFolha(papel));
  return <div className={className} style={{ aspectRatio: `${med.largura} / ${med.altura}`, backgroundImage: `url("${uri}")`, backgroundSize: "100% 100%", backgroundColor: coresDaFolha(papel).fundo }} />;
}

function CadernoAberto({ caderno, abas, aoTrocar, aoFechar }: { caderno: Caderno; abas: Caderno[]; aoTrocar: (c: Caderno) => void; aoFechar: () => void }) {
  useEntrarImersivo();
  const [paginas, setPaginas] = useState<PaginaCaderno[]>([]);
  const [tamanho, setTamanho] = useState<string>("a4");
  // Tamanho personalizado, em centímetros (com limites para não exagerar).
  const [custLarg, setCustLarg] = useState(16);
  const [custAlt, setCustAlt] = useState(22);
  const tamanhoParaCriar = () => (tamanho === "personalizado" ? `custom:${Math.round(custLarg * PX_CM)}x${Math.round(custAlt * PX_CM)}` : tamanho);
  const [selId, setSelId] = useState<string>("");
  const [painel, setPainel] = useState(false);
  const [editor, setEditor] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null);
  // Desenho: ferramenta, cor e grossura ativas; cenas e histórico por página.
  const [ferramenta, setFerramenta] = useState<FerramentaUI>("caneta");
  const ehTexto = ferramenta === "texto" || ferramenta === "nota";
  const fTraco: Ferramenta = ehTexto || ferramenta === "forma" || ferramenta === "laco" ? "caneta" : ferramenta;
  const [tamTexto, setTamTexto] = useState<number>(lerTamTexto);
  const [editandoTexto, setEditandoTexto] = useState("");
  const mudarTamTexto = (n: number) => {
    setTamTexto(n);
    try { localStorage.setItem("caderno-tam-texto", String(n)); } catch { /* ignora */ }
  };
  const [ajusteForma, setAjusteForma] = useState<AjusteForma>(lerAjusteForma);
  const mudarForma = (patch: Partial<AjusteForma>) => {
    setAjusteForma((a) => {
      const novo = { ...a, ...patch };
      try { localStorage.setItem("caderno-forma", JSON.stringify(novo)); } catch { /* ignora */ }
      return novo;
    });
  };
  // Seleção por laço: ids selecionados e em qual página.
  const [selIds, setSelIds] = useState<string[]>([]);
  const [selPid, setSelPid] = useState("");
  const limparSelecao = () => { setSelIds([]); setSelPid(""); };
  const [cor, setCor] = useState(CORES_PADRAO[0]);
  const [favoritos, setFavoritos] = useState<string[]>(lerFavoritos);
  const usarCor = (c: string) => {
    setCor(c);
    setFavoritos((f) => {
      if (f.includes(c)) return f;
      const novo = [c, ...f].slice(0, 14);
      try { localStorage.setItem("caderno-cores-favoritas", JSON.stringify(novo)); } catch { /* ignora */ }
      return novo;
    });
  };
  const [ajustes, setAjustes] = useState<Record<Ferramenta, AjusteTraco>>(lerAjustes);
  const [ajustando, setAjustando] = useState<FerramentaUI | null>(null);
  const [posBarra, setPosBarra] = useState<PosBarra>(() => {
    try { const p = localStorage.getItem("caderno-pos-barra") as PosBarra; if (p && POS_BARRA.includes(p)) return p; } catch { /* padrão */ }
    return "baixo";
  });
  const ciclarBarra = () => {
    const prox = POS_BARRA[(POS_BARRA.indexOf(posBarra) + 1) % POS_BARRA.length];
    setPosBarra(prox);
    try { localStorage.setItem("caderno-pos-barra", prox); } catch { /* ignora */ }
  };
  const [corBarra, setCorBarra] = useState<string>(lerCorBarra);
  const [corBarraAberta, setCorBarraAberta] = useState(false);
  const [regua, setRegua] = useState<Regua | null>(null);
  const alternarRegua = () => setRegua((r) => {
    if (r) return null;
    const pg = paginas.find((p) => p.id === selId);
    const m = medidaDe(pg?.tamanho ?? "a4");
    return { x1: m.largura * 0.12, y1: m.altura * 0.22, x2: m.largura * 0.88, y2: m.altura * 0.22, op: 0.5 };
  });
  const mudarCorBarra = (c: string) => {
    setCorBarra(c);
    try { if (c) localStorage.setItem("caderno-cor-barra", c); else localStorage.removeItem("caderno-cor-barra"); } catch { /* ignora */ }
  };
  const mudarAjuste = (f: Ferramenta, patch: Partial<AjusteTraco>) =>
    setAjustes((a) => {
      const novo = { ...a, [f]: { ...a[f], ...patch } };
      try { localStorage.setItem("caderno-ajustes-traco", JSON.stringify(novo)); } catch { /* ignora */ }
      return novo;
    });
  const [cenas, setCenas] = useState<Record<string, Cena>>({});
  const cenasRef = useRef(cenas);
  cenasRef.current = cenas;
  const [imagemUrls, setImagemUrls] = useState<Record<string, string>>({});
  const carregandoImg = useRef<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const [ia, setIa] = useState<EstadoIa | null>(null);
  const [iaAberta, setIaAberta] = useState(false);
  const [adesivosAberto, setAdesivosAberto] = useState(false);
  useEffect(() => { api.estadoIa().then(setIa, () => {}); }, []);
  const [historia, setHistoria] = useState<Record<string, { pilha: Cena[]; i: number }>>({});
  const carregadas = useRef<Set<string>>(new Set());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const carregar = useCallback(async () => {
    try {
      const pgs = await api.listarPaginasCaderno(caderno.id);
      setPaginas(pgs);
      setSelId((s) => (pgs.some((p) => p.id === s) ? s : pgs[0]?.id ?? ""));
    } catch (e) {
      setErro(mensagem(e));
    }
  }, [caderno.id]);
  useEffect(() => void carregar(), [carregar]);

  // Carrega a cena (os traços) de cada página uma vez.
  useEffect(() => {
    let vivo = true;
    for (const p of paginas) {
      if (carregadas.current.has(p.id)) continue;
      carregadas.current.add(p.id);
      api.carregarCenaCaderno(p.id).then((txt) => {
        if (!vivo) return;
        const c = lerCena(txt);
        setCenas((m) => ({ ...m, [p.id]: c }));
        setHistoria((h) => ({ ...h, [p.id]: { pilha: [c], i: 0 } }));
      }, () => carregadas.current.delete(p.id));
    }
    return () => { vivo = false; };
  }, [paginas]);

  const infinito = caderno.modo === "infinito";
  const sel = paginas.find((p) => p.id === selId) ?? paginas[0];

  const agendarSalvarCena = (id: string, nova: Cena) => {
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => void api.salvarCenaCaderno(id, serializarCena(nova)).catch((e) => setErro(mensagem(e))), 700);
  };
  const mudarCena = (id: string, nova: Cena) => {
    setCenas((m) => ({ ...m, [id]: nova }));
    setHistoria((h) => {
      const at = h[id] ?? { pilha: [cenaVazia()], i: 0 };
      const pilha = [...at.pilha.slice(0, at.i + 1), nova];
      const corte = Math.max(0, pilha.length - 50); // guarda até 50 passos
      return { ...h, [id]: { pilha: pilha.slice(corte), i: pilha.length - 1 - corte } };
    });
    agendarSalvarCena(id, nova);
  };
  const aoDesenhar = (id: string, traco: Traco) => mudarCena(id, { elementos: [...(cenas[id]?.elementos ?? []), traco] });
  const aoNovaForma = (id: string, forma: Forma) => mudarCena(id, { elementos: [...(cenas[id]?.elementos ?? []), forma] });
  // Borracha "de verdade": apaga o pedaço do traço por onde passa (parte os
  // traços em fragmentos) e apaga formas por inteiro ao encostar. Ao vivo não
  // mexe no histórico; registra um passo quando a pessoa solta.
  const apagarParcial = (pid: string, x: number, y: number, raio: number) =>
    setCenas((m) => {
      const c = m[pid] ?? cenaVazia();
      const novos: Elemento[] = [];
      let mudou = false;
      for (const el of c.elementos) {
        if (el.tipo === "traco") {
          const frags = fragmentosAoApagar(el, x, y, raio);
          if (frags === null) { novos.push(el); continue; }
          mudou = true;
          frags.forEach((pontos, i) => novos.push({ ...el, id: i === 0 ? el.id : crypto.randomUUID(), pontos }));
        } else if (el.tipo === "forma") {
          if (formaAtingida(el, x, y, raio)) mudou = true; else novos.push(el);
        } else novos.push(el); // imagem e texto não são apagados pela borracha
      }
      if (!mudou) return m;
      const nova: Cena = { elementos: novos };
      agendarSalvarCena(pid, nova);
      return { ...m, [pid]: nova };
    });
  const apagarParcialFim = (pid: string) => registrarCena(pid, cenasRef.current[pid] ?? cenaVazia());

  // Caixas de texto. Criar e apagar são um passo de desfazer; digitar e mover
  // atualizam a cena ao vivo (sem encher o histórico) e registram um passo ao
  // terminar. Caixa deixada vazia some sozinha.
  const registrarCena = (pid: string, nova: Cena) =>
    setHistoria((h) => {
      const at = h[pid] ?? { pilha: [cenaVazia()], i: 0 };
      const topo = at.pilha[at.i];
      if (topo && serializarCena(topo) === serializarCena(nova)) return h;
      const pilha = [...at.pilha.slice(0, at.i + 1), nova];
      const corte = Math.max(0, pilha.length - 50);
      return { ...h, [pid]: { pilha: pilha.slice(corte), i: pilha.length - 1 - corte } };
    });
  const aoNovoTexto = (pid: string, x: number, y: number, nota = false) => {
    const largura = nota ? 240 : LARGURA_TEXTO_PADRAO;
    const novo: Texto = nota
      ? { tipo: "texto", id: crypto.randomUUID(), x, y, largura, texto: "", cor: "#1f2937", tamanho: tamTexto, fundo: FUNDOS_NOTA[0] }
      : { tipo: "texto", id: crypto.randomUUID(), x, y, largura, texto: "", cor, tamanho: tamTexto };
    mudarCena(pid, { elementos: [...(cenas[pid]?.elementos ?? []), novo] });
    setEditandoTexto(novo.id);
  };
  const atualizarTexto = (pid: string, id: string, patch: Partial<Texto>) =>
    setCenas((m) => {
      const c = m[pid] ?? cenaVazia();
      const nova: Cena = { elementos: c.elementos.map((e) => (e.id === id && e.tipo === "texto" ? { ...e, ...patch } : e)) };
      agendarSalvarCena(pid, nova);
      return { ...m, [pid]: nova };
    });
  const aoFimTexto = (pid: string, id: string) => {
    setEditandoTexto((a) => (a === id ? "" : a));
    const c = cenasRef.current[pid];
    if (!c) return;
    const el = c.elementos.find((e) => e.id === id);
    if (el && el.tipo === "texto" && textoVazio(el.texto)) {
      const nova: Cena = { elementos: c.elementos.filter((e) => e.id !== id) };
      setCenas((m) => ({ ...m, [pid]: nova }));
      registrarCena(pid, nova);
      agendarSalvarCena(pid, nova);
    } else {
      registrarCena(pid, c);
    }
  };
  const aoMoverFimTexto = (pid: string) => registrarCena(pid, cenasRef.current[pid] ?? cenaVazia());
  const apagarElemento = (pid: string, id: string) => mudarCena(pid, { elementos: (cenas[pid]?.elementos ?? []).filter((e) => e.id !== id) });
  // Recolore a caixa de texto em edição (tocar numa cor com a caixa aberta).
  const recolorTextoEditando = (c: string) => {
    if (!editandoTexto) return;
    for (const [pid, cena] of Object.entries(cenasRef.current)) {
      if (cena.elementos.some((e) => e.id === editandoTexto && e.tipo === "texto")) {
        mudarCena(pid, { elementos: cena.elementos.map((e) => (e.id === editandoTexto ? { ...e, cor: c } : e)) });
        return;
      }
    }
  };
  // Ao sair das ferramentas de texto/nota, fecha a edição (caixa vazia some).
  useEffect(() => { if (!ehTexto) setEditandoTexto(""); }, [ehTexto]);
  // Quando a caixa em edição muda, finaliza a anterior (vazia some; senão vira
  // um passo de desfazer). Assim o menu da IA não encerra a edição ao abrir.
  const anteriorEdit = useRef("");
  useEffect(() => {
    const ant = anteriorEdit.current;
    anteriorEdit.current = editandoTexto;
    if (!ant || ant === editandoTexto) return;
    for (const [pid, c] of Object.entries(cenasRef.current)) {
      if (c.elementos.some((e) => e.id === ant)) { aoFimTexto(pid, ant); break; }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editandoTexto]);
  // Ao sair do laço, limpa a seleção.
  useEffect(() => { if (ferramenta !== "laco") limparSelecao(); }, [ferramenta]);

  // Laço de seleção: seleciona, move, escala, recolore e apaga em bloco.
  const selecionarLaco = (pid: string, ids: string[]) => { setSelPid(pid); setSelIds(ids); };
  const transformarSelecao = (pid: string, ids: string[], fn: (el: Elemento) => Elemento) =>
    setCenas((m) => {
      const c = m[pid] ?? cenaVazia();
      const nova: Cena = { elementos: c.elementos.map((e) => (ids.includes(e.id) ? fn(e) : e)) };
      agendarSalvarCena(pid, nova);
      return { ...m, [pid]: nova };
    });
  const moverSelecao = (pid: string, ids: string[], dx: number, dy: number) => transformarSelecao(pid, ids, (el) => transladar(el, dx, dy));
  const escalarSelecao = (pid: string, ids: string[], ax: number, ay: number, fator: number) => transformarSelecao(pid, ids, (el) => escalar(el, ax, ay, fator));
  const rotacionarSelecao = (pid: string, ids: string[], ax: number, ay: number, graus: number) => transformarSelecao(pid, ids, (el) => rotacionar(el, ax, ay, graus));
  // Ordenar camadas: leva os selecionados para a frente (fim) ou para trás
  // (início) da lista de elementos, preservando a ordem entre eles.
  const ordenarSelecao = (pid: string, ids: string[], frente: boolean) =>
    mudarCena(pid, (() => {
      const els = cenas[pid]?.elementos ?? [];
      const sel = els.filter((e) => ids.includes(e.id));
      const resto = els.filter((e) => !ids.includes(e.id));
      return { elementos: frente ? [...resto, ...sel] : [...sel, ...resto] };
    })());
  const fimGestoSelecao = (pid: string) => registrarCena(pid, cenasRef.current[pid] ?? cenaVazia());
  const recolorirSelecao = (c: string) => {
    if (!selPid || !selIds.length) return;
    mudarCena(selPid, { elementos: (cenas[selPid]?.elementos ?? []).map((e) => (selIds.includes(e.id) ? { ...e, cor: c } : e)) });
  };
  const apagarSelecao = () => {
    if (!selPid || !selIds.length) return;
    mudarCena(selPid, { elementos: (cenas[selPid]?.elementos ?? []).filter((e) => !selIds.includes(e.id)) });
    limparSelecao();
  };

  // Imagens: carrega os bytes do cofre (data URL) de cada imagem das cenas.
  useEffect(() => {
    const ids = new Set<string>();
    for (const c of Object.values(cenas)) for (const el of c.elementos) if (el.tipo === "imagem") ids.add(el.anexoId);
    for (const id of ids) {
      if (!id || imagemUrls[id] || carregandoImg.current.has(id)) continue;
      carregandoImg.current.add(id);
      api.imagemAnexo(id).then((url) => setImagemUrls((u) => ({ ...u, [id]: url })), () => carregandoImg.current.delete(id));
    }
  }, [cenas, imagemUrls]);

  const inserirImagem = async (b: Blob, nome: string, fracao = 0.5) => {
    const pid = selId || paginas[0]?.id;
    if (!pid) return;
    try {
      const base64 = await blobParaBase64(b);
      if (!base64) return;
      const { w, h } = await tamanhoImagem(b);
      const anexo = await api.anexarBytes(pid, nome, base64);
      const pg = paginas.find((p) => p.id === pid);
      const m = medidaDe(pg?.tamanho ?? "a4");
      let largura = m.largura * fracao;
      let altura = largura * (h / w);
      const maxAlt = m.altura * 0.6;
      if (altura > maxAlt) { altura = maxAlt; largura = altura * (w / h); }
      const img: Imagem = { tipo: "imagem", id: crypto.randomUUID(), x: (m.largura - largura) / 2, y: 90, largura, altura, anexoId: anexo.id };
      setImagemUrls((u) => ({ ...u, [anexo.id]: `data:${b.type || "image/png"};base64,${base64}` }));
      mudarCena(pid, { elementos: [...(cenasRef.current[pid]?.elementos ?? []), img] });
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  // Insere o que a IA criou: imagem normal é reduzida (JPEG); adesivo mantém o
  // PNG original para preservar a transparência, e entra menor.
  const inserirDaIa = async (dataUrl: string, tipo: "imagem" | "adesivo") => {
    const url = tipo === "imagem" ? await reduzirImagem(dataUrl, 1280) : dataUrl;
    const blob = await (await fetch(url)).blob();
    await inserirImagem(blob, tipo === "adesivo" ? "adesivo.png" : "imagem.jpg", tipo === "adesivo" ? 0.28 : 0.5);
    setIaAberta(false);
  };
  // Adesivo pronto da galeria: busca o PNG empacotado e insere como figura
  // (pequeno, com a transparência preservada). Vai para o cofre como as demais.
  const inserirAdesivo = async (id: string) => {
    try {
      const blob = await (await fetch(urlAdesivo(id))).blob();
      await inserirImagem(blob, `${id}.png`, 0.22);
      setAdesivosAberto(false);
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  const inserirRef = useRef(inserirImagem);
  inserirRef.current = inserirImagem;
  // Colar imagem (Ctrl + V) com o caderno aberto.
  useEffect(() => {
    const aoColar = (e: ClipboardEvent) => {
      const it = [...(e.clipboardData?.items ?? [])].find((x) => x.type.startsWith("image/"));
      const b = it?.getAsFile();
      if (b) { e.preventDefault(); void inserirRef.current(b, `colado.${extDeMime(b.type)}`); }
    };
    document.addEventListener("paste", aoColar);
    return () => document.removeEventListener("paste", aoColar);
  }, []);

  const andar = (passo: number) => {
    const h = historia[selId];
    if (!h) return;
    const i = h.i + passo;
    if (i < 0 || i >= h.pilha.length) return;
    const nova = h.pilha[i];
    setHistoria((hs) => ({ ...hs, [selId]: { ...h, i } }));
    setCenas((m) => ({ ...m, [selId]: nova }));
    agendarSalvarCena(selId, nova);
  };
  const podeDesfazer = (historia[selId]?.i ?? 0) > 0;
  const podeRefazer = !!historia[selId] && historia[selId].i < historia[selId].pilha.length - 1;

  const salvar = async (pg: PaginaCaderno) => {
    setPaginas((ps) => ps.map((x) => (x.id === pg.id ? pg : x)));
    try {
      await api.salvarPaginaCaderno(pg);
    } catch (e) {
      setErro(mensagem(e));
      await carregar();
    }
  };
  const adicionar = async () => {
    try {
      // Nova página herda a folha da última (mantém o estilo do caderno).
      const papel = paginas.length ? folhaDe(paginas[paginas.length - 1]) : papelPadrao();
      await api.salvarPaginaCaderno({ id: "", cadernoId: caderno.id, ordem: 0, tamanho: tamanhoParaCriar(), papel, titulo: "", marcado: false, criadoEm: 0 });
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  const apagar = async (id: string) => {
    try {
      await api.excluirPaginaCaderno(id);
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  const aplicarFolha = async (papel: Papel, alvo: AlvoFolha) => {
    setEditor(false);
    let alvos: PaginaCaderno[];
    if (alvo === "todas") alvos = paginas;
    else if (alvo === "atual") alvos = sel ? [sel] : [];
    else alvos = paginas.slice(Math.max(0, alvo.de - 1), alvo.ate); // intervalo (1-based, inclusivo)
    try {
      for (const pg of alvos) await api.salvarPaginaCaderno({ ...pg, papel });
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  const irPara = (id: string) => {
    setSelId(id);
    area.current?.querySelector(`#pg-${id}`)?.scrollIntoView({ block: "start" });
  };

  return (
    <div className="caderno-tela">
      <div className="leitor-barra">
        <Button className="botao-icone" onPress={aoFechar} aria-label={t.voltarEstante}><ChevronLeft aria-hidden="true" size="1.2em" /></Button>
        <strong className="leitor-titulo quebra">
          {infinito ? <LayoutGrid aria-hidden="true" size="1em" /> : <PenLine aria-hidden="true" size="1em" />} {caderno.nome}
        </strong>
        <span className="linha-ajuste">
          {!infinito && <Button className={painel ? "botao-icone ativo" : "botao-icone"} onPress={() => setPainel((v) => !v)} aria-label={t.indice.titulo} aria-pressed={painel}><List aria-hidden="true" size="1.1em" /></Button>}
          <Button className="botao-icone" onPress={() => setEditor(true)} aria-label={t.folha.abrir}><SlidersHorizontal aria-hidden="true" size="1.1em" /></Button>
        </span>
      </div>

      {abas.length > 1 && (
        <div className="caderno-abas" role="tablist" aria-label={t.abas}>
          {abas.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === caderno.id}
              className={c.id === caderno.id ? "caderno-aba atual" : "caderno-aba"}
              onClick={() => c.id !== caderno.id && aoTrocar(c)}>
              {c.modo === "infinito" ? <LayoutGrid aria-hidden="true" size="0.9em" /> : <PenLine aria-hidden="true" size="0.9em" />}
              <span className="quebra">{c.nome}</span>
            </button>
          ))}
        </div>
      )}

      {erro && <div className="leitor-aviso"><Aviso>{erro}</Aviso></div>}

      <div className={`caderno-miolo pos-${posBarra}`}>
      <div className="caderno-area">
        {painel && !infinito && (
          <aside className="caderno-indice">
            <h2 className="campo-rotulo">{t.indice.titulo}</h2>
            {paginas.length === 0 ? (
              <p className="texto-suave pequeno">{t.indice.vazio}</p>
            ) : (
              <ul className="lista-simples sem-marcador">
                {paginas.map((p, i) => (
                  <li key={p.id}>
                    <button className={p.id === selId ? "caderno-indice-item atual" : "caderno-indice-item"} onClick={() => irPara(p.id)}>
                      <Folha papel={folhaDe(p)} tamanho={p.tamanho} className="caderno-indice-mini" />
                      <span className="quebra">
                        {p.marcado && <Bookmark aria-hidden="true" size="0.9em" />} {p.titulo || t.indice.semTitulo(i + 1)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        <div className="caderno-rolagem" ref={area}>
          {infinito ? (
            <div className="caderno-aviso-breve"><LayoutGrid aria-hidden="true" size="1.1em" /> {t.infinitoEmBreve}</div>
          ) : (
            <>
              {paginas.map((p, i) => (
                <PaginaView key={p.id} id={`pg-${p.id}`} pagina={p} numero={i + 1} selecionada={p.id === selId} podeApagar={paginas.length > 1}
                  cena={cenas[p.id] ?? cenaVazia()} ferramenta={ferramenta} cor={cor} ajuste={ajustes[fTraco]}
                  forma={ajusteForma} editandoTexto={editandoTexto} selecionados={p.id === selPid ? selIds : vazio} imagemUrl={(id) => imagemUrls[id]}
                  regua={p.id === selId ? regua : null} aoMudarRegua={setRegua}
                  aoSelecionar={() => setSelId(p.id)}
                  aoDesenhar={(tr) => aoDesenhar(p.id, tr)}
                  aoNovaForma={(fm) => aoNovaForma(p.id, fm)}
                  aoApagarParcial={(x, y, raio) => apagarParcial(p.id, x, y, raio)}
                  aoApagarFim={() => apagarParcialFim(p.id)}
                  aoSelecionarLaco={(ids) => selecionarLaco(p.id, ids)}
                  aoMoverSelecao={(dx, dy) => moverSelecao(p.id, selIds, dx, dy)}
                  aoEscalarSelecao={(ax, ay, fa) => escalarSelecao(p.id, selIds, ax, ay, fa)}
                  aoRotacionarSelecao={(ax, ay, g) => rotacionarSelecao(p.id, selIds, ax, ay, g)}
                  aoOrdenarSelecao={(frente) => ordenarSelecao(p.id, selIds, frente)}
                  aoFimSelecao={() => fimGestoSelecao(p.id)}
                  aoApagarSelecao={apagarSelecao}
                  aoNovoTexto={(x, y) => aoNovoTexto(p.id, x, y, ferramenta === "nota")}
                  aoPatchTexto={(id, patch) => atualizarTexto(p.id, id, patch)}
                  aoMoverTexto={(id, x, y) => atualizarTexto(p.id, id, { x, y })}
                  aoMoverFimTexto={() => aoMoverFimTexto(p.id)}
                  aoFimTexto={(id) => aoFimTexto(p.id, id)}
                  aoApagarTexto={(id) => apagarElemento(p.id, id)}
                  aoSelecionarTexto={setEditandoTexto}
                  aoTitulo={(titulo) => salvar({ ...p, titulo })}
                  aoMarcar={() => salvar({ ...p, marcado: !p.marcado })}
                  aoApagar={() => void apagar(p.id)} />
              ))}
              <div className="caderno-adicionar">
                <Segmentado rotulo={t.paginas.tamanho} valor={tamanho} aoMudar={setTamanho} opcoes={[{ valor: "a4", nome: t.paginas.tamanhos.a4 }, { valor: "a5", nome: t.paginas.tamanhos.a5 }, { valor: "carta", nome: t.paginas.tamanhos.carta }, { valor: "personalizado", nome: t.paginas.tamanhos.personalizado }]} />
                {tamanho === "personalizado" && (
                  <div className="caderno-custom-tam">
                    <label className="caderno-intervalo-campo">{t.paginas.largura}
                      <input type="number" min={8} max={36} value={custLarg} onChange={(e) => setCustLarg(Math.min(36, Math.max(8, Number(e.target.value) || 8)))} aria-label={t.paginas.largura} /> cm
                    </label>
                    <label className="caderno-intervalo-campo">{t.paginas.altura}
                      <input type="number" min={8} max={50} value={custAlt} onChange={(e) => setCustAlt(Math.min(50, Math.max(8, Number(e.target.value) || 8)))} aria-label={t.paginas.altura} /> cm
                    </label>
                  </div>
                )}
                <Button className="botao com-icone" onPress={() => void adicionar()}><Plus aria-hidden="true" size="1.1em" /> {t.paginas.adicionar}</Button>
              </div>
            </>
          )}
        </div>
      </div>

      {!infinito && (
        <BarraFerramentas
          ferramenta={ferramenta} aoFerramenta={setFerramenta} aoAjustar={setAjustando}
          cor={cor} aoCor={(c) => { usarCor(c); if (ferramenta === "laco" && selIds.length) recolorirSelecao(c); if ((ferramenta === "texto" || ferramenta === "nota") && editandoTexto) recolorTextoEditando(c); }} favoritos={favoritos}
          corBarra={corBarra} aoAbrirCorBarra={() => setCorBarraAberta(true)}
          aoInserirImagem={() => fileRef.current?.click()} aoCriarIa={() => setIaAberta(true)} aoAdesivos={() => setAdesivosAberto(true)}
          reguaLigada={regua !== null} aoRegua={alternarRegua}
          vertical={posBarra === "direita" || posBarra === "esquerda"} aoMover={ciclarBarra}
          aoDesfazer={() => andar(-1)} aoRefazer={() => andar(1)} podeDesfazer={podeDesfazer} podeRefazer={podeRefazer}
        />
      )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void inserirImagem(f, f.name); e.target.value = ""; }} />

      <Janela titulo={t.imagemIa.titulo} aberta={iaAberta} aoFechar={() => setIaAberta(false)}>
        {iaAberta && <CriarImagemIa ia={ia} aoMudarIa={setIa} aoInserir={inserirDaIa} />}
      </Janela>

      <Janela titulo={t.adesivos.titulo} aberta={adesivosAberto} aoFechar={() => setAdesivosAberto(false)}>
        {adesivosAberto && <AdesivosPainel aoInserir={inserirAdesivo} />}
      </Janela>

      <Janela titulo={ajustando ? t.ferramentas.ajustesDe(t.ferramentas.nomes[ajustando]) : ""} aberta={ajustando !== null} aoFechar={() => setAjustando(null)} pequena>
        {ajustando && (ajustando === "texto" || ajustando === "nota"
          ? <AjustesTexto tamanho={tamTexto} cor={cor} aoMudar={mudarTamTexto} aoFechar={() => setAjustando(null)} />
          : ajustando === "forma"
          ? <AjustesForma ajuste={ajusteForma} cor={cor} aoMudar={mudarForma} aoFechar={() => setAjustando(null)} />
          : ajustando === "borracha"
          ? <AjustesBorracha tamanho={ajustes.borracha.tamanho} aoMudar={(n) => mudarAjuste("borracha", { tamanho: n })} aoFechar={() => setAjustando(null)} />
          : ajustando === "laco"
          ? null
          : <AjustesFerramenta ferramenta={ajustando} ajuste={ajustes[ajustando]} aoMudar={(patch) => mudarAjuste(ajustando, patch)} aoFechar={() => setAjustando(null)} />)}
      </Janela>

      <Janela titulo={t.folha.titulo} aberta={editor} aoFechar={() => setEditor(false)}>
        {editor && <EditorFolha inicial={sel ? folhaDe(sel) : papelPadrao()} tamanho={sel?.tamanho ?? "a4"} total={paginas.length} atual={Math.max(1, paginas.findIndex((p) => p.id === selId) + 1)} aoAplicar={aplicarFolha} aoFechar={() => setEditor(false)} />}
      </Janela>

      <Janela titulo={t.barraCor.titulo} aberta={corBarraAberta} aoFechar={() => setCorBarraAberta(false)} pequena>
        <div className="formulario">
          <label className="caderno-cor-barra-escolher">
            <input type="color" value={corBarra || "#2e2f33"} onChange={(e) => mudarCorBarra(e.target.value)} aria-label={t.barraCor.escolher} />
            <span>{t.barraCor.escolher}</span>
          </label>
          <p className="campo-ajuda">{t.barraCor.ajuda}</p>
          <div className="janela-acoes">
            <Button className="botao" onPress={() => mudarCorBarra("")}>{t.barraCor.padrao}</Button>
            <Button className="botao principal" onPress={() => setCorBarraAberta(false)}>{textos.comum.fechar}</Button>
          </div>
        </div>
      </Janela>
    </div>
  );
}

function PaginaView({ id, pagina, numero, selecionada, podeApagar, cena, ferramenta, cor, ajuste, forma, editandoTexto, selecionados, imagemUrl, regua, aoMudarRegua, aoSelecionar, aoDesenhar, aoNovaForma, aoApagarParcial, aoApagarFim, aoNovoTexto, aoPatchTexto, aoMoverTexto, aoMoverFimTexto, aoFimTexto, aoApagarTexto, aoSelecionarTexto, aoSelecionarLaco, aoMoverSelecao, aoEscalarSelecao, aoRotacionarSelecao, aoOrdenarSelecao, aoFimSelecao, aoApagarSelecao, aoTitulo, aoMarcar, aoApagar }: {
  id: string; pagina: PaginaCaderno; numero: number; selecionada: boolean; podeApagar: boolean;
  cena: Cena; ferramenta: FerramentaUI; cor: string; ajuste: AjusteTraco; forma: AjusteForma; editandoTexto: string; selecionados: string[]; imagemUrl: (id: string) => string | undefined;
  regua: Regua | null; aoMudarRegua: (r: Regua) => void;
  aoSelecionar: () => void; aoDesenhar: (t: Traco) => void; aoNovaForma: (f: Forma) => void;
  aoApagarParcial: (x: number, y: number, raio: number) => void; aoApagarFim: () => void;
  aoNovoTexto: (x: number, y: number) => void; aoPatchTexto: (id: string, patch: Partial<Texto>) => void;
  aoMoverTexto: (id: string, x: number, y: number) => void; aoMoverFimTexto: () => void;
  aoFimTexto: (id: string) => void; aoApagarTexto: (id: string) => void; aoSelecionarTexto: (id: string) => void;
  aoSelecionarLaco: (ids: string[]) => void; aoMoverSelecao: (dx: number, dy: number) => void;
  aoEscalarSelecao: (ax: number, ay: number, fator: number) => void;
  aoRotacionarSelecao: (ax: number, ay: number, graus: number) => void; aoOrdenarSelecao: (frente: boolean) => void;
  aoFimSelecao: () => void; aoApagarSelecao: () => void;
  aoTitulo: (t: string) => void; aoMarcar: () => void; aoApagar: () => void;
}) {
  const [titulo, setTitulo] = useState(pagina.titulo);
  useEffect(() => setTitulo(pagina.titulo), [pagina.titulo]);
  const med = medidaDe(pagina.tamanho);
  const areaRef = useRef<HTMLDivElement>(null);
  const [larguraPx, setLarguraPx] = useState(0);
  useEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setLarguraPx(el.clientWidth));
    ro.observe(el);
    setLarguraPx(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const escala = larguraPx ? larguraPx / med.largura : 0;
  const caixas = cena.elementos.filter((e): e is Texto => e.tipo === "texto");
  return (
    <section id={id} className={selecionada ? "caderno-folha-bloco atual" : "caderno-folha-bloco"}>
      <div className="caderno-folha-topo">
        <span className="texto-suave pequeno">{t.paginas.numero(numero)}</span>
        <input className="entrada-texto sozinha caderno-folha-titulo" value={titulo} placeholder={t.paginas.semTitulo} onChange={(e) => setTitulo(e.target.value)} onBlur={() => titulo !== pagina.titulo && aoTitulo(titulo)} aria-label={t.paginas.tituloCampo} maxLength={80} />
        <Button className={pagina.marcado ? "botao-icone pequeno ativo" : "botao-icone pequeno"} onPress={aoMarcar} aria-label={pagina.marcado ? t.paginas.desmarcar : t.paginas.marcar} aria-pressed={pagina.marcado}><Bookmark aria-hidden="true" size="1em" /></Button>
        {podeApagar && <Button className="botao-icone pequeno" onPress={aoApagar} aria-label={t.paginas.excluir}><Trash2 aria-hidden="true" size="1em" /></Button>}
      </div>
      <div ref={areaRef} className="caderno-folha-area" style={{ aspectRatio: `${med.largura} / ${med.altura}` }} onPointerDownCapture={aoSelecionar}>
        <Folha papel={folhaDe(pagina)} tamanho={pagina.tamanho} className="caderno-folha caderno-folha-fundo" />
        <SuperficieDesenho cena={cena} ferramenta={ferramenta} cor={cor} ajuste={ajuste} forma={forma} regua={regua} largura={med.largura} altura={med.altura} imagemUrl={imagemUrl} aoDesenhar={aoDesenhar} aoNovaForma={aoNovaForma} aoApagarParcial={aoApagarParcial} aoApagarFim={aoApagarFim} />
        <CamadaTexto caixas={caixas} ativa={ferramenta === "texto" || ferramenta === "nota"} escala={escala} editandoId={editandoTexto}
          aoNovo={aoNovoTexto} aoPatch={aoPatchTexto} aoMover={aoMoverTexto} aoMoverFim={aoMoverFimTexto}
          aoFim={aoFimTexto} aoApagar={aoApagarTexto} aoSelecionar={aoSelecionarTexto} />
        <CamadaSelecao elementos={cena.elementos} selecionados={selecionados} ativa={ferramenta === "laco"} escala={escala} largura={med.largura} altura={med.altura}
          aoSelecionar={aoSelecionarLaco} aoMover={aoMoverSelecao} aoEscalar={aoEscalarSelecao} aoRotacionar={aoRotacionarSelecao} aoOrdenar={aoOrdenarSelecao} aoFim={aoFimSelecao} aoApagar={aoApagarSelecao} />
        {regua && <CamadaRegua regua={regua} escala={escala} largura={med.largura} altura={med.altura} aoMudar={aoMudarRegua} />}
      </div>
    </section>
  );
}

/** A camada das caixas de texto, por cima do desenho. Só interage quando a
 *  ferramenta de texto está ativa; nas outras, fica só mostrando (sem toque). */
function CamadaTexto({ caixas, ativa, escala, editandoId, aoNovo, aoPatch, aoMover, aoMoverFim, aoFim, aoApagar, aoSelecionar }: {
  caixas: Texto[]; ativa: boolean; escala: number; editandoId: string;
  aoNovo: (x: number, y: number) => void; aoPatch: (id: string, patch: Partial<Texto>) => void;
  aoMover: (id: string, x: number, y: number) => void; aoMoverFim: () => void;
  aoFim: (id: string) => void; aoApagar: (id: string) => void; aoSelecionar: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const criarNoPonto = (e: React.PointerEvent) => {
    if (e.target !== ref.current || escala <= 0) return; // só no fundo vazio
    e.preventDefault(); // não deixa o clique roubar o foco da nova caixa
    const r = ref.current.getBoundingClientRect();
    aoNovo((e.clientX - r.left) / escala, (e.clientY - r.top) / escala);
  };
  return (
    <div ref={ref} className={ativa ? "caderno-textos ativa" : "caderno-textos"} onPointerDown={ativa ? criarNoPonto : undefined}>
      {caixas.map((tx) => (
        <CaixaTexto key={tx.id} caixa={tx} escala={escala} editando={tx.id === editandoId} ativa={ativa}
          aoPatch={(patch) => aoPatch(tx.id, patch)} aoMover={(x, y) => aoMover(tx.id, x, y)} aoMoverFim={aoMoverFim}
          aoFim={() => aoFim(tx.id)} aoApagar={() => aoApagar(tx.id)} aoSelecionar={() => aoSelecionar(tx.id)} />
      ))}
    </div>
  );
}

function CaixaTexto({ caixa: tx, escala, editando, ativa, aoPatch, aoMover, aoMoverFim, aoFim, aoApagar, aoSelecionar }: {
  caixa: Texto; escala: number; editando: boolean; ativa: boolean;
  aoPatch: (patch: Partial<Texto>) => void; aoMover: (x: number, y: number) => void; aoMoverFim: () => void;
  aoFim: () => void; aoApagar: () => void; aoSelecionar: () => void;
}) {
  const arrastar = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const alvo = e.currentTarget as HTMLElement;
    alvo.setPointerCapture(e.pointerId);
    const x0 = e.clientX, y0 = e.clientY, px = tx.x, py = tx.y;
    const mover = (ev: PointerEvent) => aoMover(px + (ev.clientX - x0) / escala, py + (ev.clientY - y0) / escala);
    const fim = () => { alvo.removeEventListener("pointermove", mover); alvo.removeEventListener("pointerup", fim); aoMoverFim(); };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", fim);
  };
  const ehNota = !!tx.fundo;
  // A caixa abraça o texto (largura automática), com um limite para quebrar a
  // linha e um mínimo para caber o cursor. Antes era sempre larga e parecia uma
  // "caixa em volta" grande demais, com muito vazio.
  const estiloCaixa: React.CSSProperties = {
    left: tx.x * escala, top: tx.y * escala, width: "max-content",
    maxWidth: tx.largura * escala, minWidth: Math.max(40, tx.tamanho * escala * 2.5),
    ...(ehNota ? { background: tx.fundo, padding: `${7 * escala}px ${9 * escala}px`, borderRadius: `${5 * escala}px`, boxShadow: "0 2px 8px rgba(0, 0, 0, 0.18)" } : {}),
  };
  const estiloTexto: React.CSSProperties = { color: tx.cor, fontSize: `${tx.tamanho * escala}px`, fontFamily: fonteCss(tx.fonte), textAlign: ALINHAR_CSS[tx.alinhamento ?? "esquerda"] };
  const classeCaixa = ehNota ? "caderno-caixa nota" : "caderno-caixa";

  if (editando && ativa) {
    return (
      <div className={`${classeCaixa} editando`} style={estiloCaixa}>
        <CaixaEditor tx={tx} estilo={estiloTexto} aoPatch={aoPatch} aoFim={aoFim} aoArrastar={arrastar} aoApagar={aoApagar} />
      </div>
    );
  }
  const miolo = textoVazio(tx.texto) ? `<span class="caderno-caixa-vazio">${t.texto.vazio}</span>` : tx.texto;
  return (
    <div className={classeCaixa} style={estiloCaixa} onPointerDown={ativa ? (e) => { e.stopPropagation(); aoSelecionar(); } : undefined}>
      {ativa && (
        <div className="caderno-caixa-barra">
          <button type="button" className="caderno-caixa-alca" onPointerDown={arrastar} aria-label={t.texto.mover}><GripVertical size="1em" aria-hidden="true" /></button>
          <button type="button" className="botao-icone pequeno" onPointerDown={(e) => e.preventDefault()} onClick={aoApagar} aria-label={t.texto.apagar}><Trash2 size="1em" aria-hidden="true" /></button>
        </div>
      )}
      <div className="caderno-caixa-area" style={estiloTexto} dangerouslySetInnerHTML={{ __html: miolo }} />
    </div>
  );
}

/** A caixa em edição: mini-editor (negrito/itálico/sublinhado por trecho) com a
 *  barra de formatação (fonte, tamanho, cor pela barra de cores, alinhamento). */
function CaixaEditor({ tx, estilo, aoPatch, aoFim, aoArrastar, aoApagar }: {
  tx: Texto; estilo: React.CSSProperties; aoPatch: (patch: Partial<Texto>) => void;
  aoFim: () => void; aoArrastar: (e: React.PointerEvent) => void; aoApagar: () => void;
}) {
  const editor = useEditor({
    extensions: extensoesCaderno,
    content: tx.texto || "",
    autofocus: "end",
    editorProps: {
      attributes: { class: "caderno-caixa-area", "aria-label": t.texto.campo },
      handleKeyDown: (_v, ev) => { if (ev.key === "Escape") { aoFim(); return true; } return false; },
    },
    onUpdate: ({ editor: e }) => aoPatch({ texto: e.getHTML() }),
  });
  const [marcas, setMarcas] = useState({ b: false, i: false, u: false, lista: false, numerada: false });
  useEffect(() => {
    if (!editor) return;
    const ler = () => setMarcas({ b: editor.isActive("bold"), i: editor.isActive("italic"), u: editor.isActive("underline"), lista: editor.isActive("bulletList"), numerada: editor.isActive("orderedList") });
    editor.on("selectionUpdate", ler);
    editor.on("transaction", ler);
    return () => { editor.off("selectionUpdate", ler); editor.off("transaction", ler); };
  }, [editor]);
  // Ditado por voz: insere o texto falado no ponto do cursor (só aparece com a
  // transcrição local instalada).
  const ditado = useDitar("", (texto) => editor?.chain().focus().insertContent(texto).run(), true);
  // ✨ Revisão de texto por IA (só aparece com uma IA de revisão configurada).
  const revisar = useReescrever(
    editor?.getText() ?? "",
    (novo) => { if (editor) { editor.chain().focus().setContent(novo.replace(/\n/g, "<br>")).run(); aoPatch({ texto: editor.getHTML() }); } },
    true,
    () => editor?.commands.focus(),
  );
  if (!editor) return null;
  const fonteAtual = tx.fonte ?? "";
  const ciclarFonte = () => { const i = FONTES_CADERNO.indexOf(fonteAtual as (typeof FONTES_CADERNO)[number]); aoPatch({ fonte: FONTES_CADERNO[(i + 1) % FONTES_CADERNO.length] }); };
  const mudarTam = (d: number) => aoPatch({ tamanho: Math.min(80, Math.max(12, tx.tamanho + d)) });
  const alinhoAtual = tx.alinhamento ?? "esquerda";
  const ciclarAlinho = () => aoPatch({ alinhamento: ALINHAR[(ALINHAR.indexOf(alinhoAtual) + 1) % ALINHAR.length] });
  const IconeAlinho = alinhoAtual === "centro" ? AlignCenter : alinhoAtual === "direita" ? AlignRight : AlignLeft;
  const nomeFonte = fonteAtual && fonteAtual in FONTES ? FONTES[fonteAtual as keyof typeof FONTES].nome : t.texto.fontePadrao;
  return (
    <>
      <div className="caderno-caixa-barra formatar">
        <button type="button" className="caderno-caixa-alca" onPointerDown={aoArrastar} aria-label={t.texto.mover}><GripVertical size="1em" aria-hidden="true" /></button>
        <span className="caderno-fmt-grupo">
          <button type="button" className={marcas.b ? "caderno-fmt ativo" : "caderno-fmt"} onClick={() => editor.chain().focus().toggleBold().run()} aria-label={textos.rico.negrito} aria-pressed={marcas.b}><Bold size="1em" aria-hidden="true" /></button>
          <button type="button" className={marcas.i ? "caderno-fmt ativo" : "caderno-fmt"} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label={textos.rico.italico} aria-pressed={marcas.i}><Italic size="1em" aria-hidden="true" /></button>
          <button type="button" className={marcas.u ? "caderno-fmt ativo" : "caderno-fmt"} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label={textos.rico.sublinhado} aria-pressed={marcas.u}><Underline size="1em" aria-hidden="true" /></button>
        </span>
        <button type="button" className="caderno-fmt fonte" style={{ fontFamily: fonteCss(fonteAtual) }} onClick={ciclarFonte} aria-label={`${t.texto.fonte}: ${nomeFonte}`} title={nomeFonte}>Aa</button>
        <span className="caderno-fmt-grupo">
          <button type="button" className="caderno-fmt" onClick={() => mudarTam(-2)} aria-label={t.texto.diminuir}>A−</button>
          <button type="button" className="caderno-fmt" onClick={() => mudarTam(2)} aria-label={t.texto.aumentar}>A+</button>
        </span>
        <button type="button" className="caderno-fmt" onClick={ciclarAlinho} aria-label={t.texto.alinhar[alinhoAtual]}><IconeAlinho size="1em" aria-hidden="true" /></button>
        <span className="caderno-fmt-grupo">
          <button type="button" className={marcas.lista ? "caderno-fmt ativo" : "caderno-fmt"} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label={textos.rico.lista} aria-pressed={marcas.lista}><List size="1em" aria-hidden="true" /></button>
          <button type="button" className={marcas.numerada ? "caderno-fmt ativo" : "caderno-fmt"} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label={textos.rico.numerada} aria-pressed={marcas.numerada}><ListOrdered size="1em" aria-hidden="true" /></button>
        </span>
        {ditado.botao && <span className="caderno-fmt-grupo caderno-fmt-ditado">{ditado.botao}</span>}
        {tx.fundo && (
          <button type="button" className="caderno-fmt" onClick={() => aoPatch({ fundo: FUNDOS_NOTA[(FUNDOS_NOTA.indexOf(tx.fundo!) + 1) % FUNDOS_NOTA.length] })} aria-label={t.texto.fundo}>
            <span className="caderno-fmt-fundo" style={{ background: tx.fundo }} aria-hidden="true" />
          </button>
        )}
        {revisar.botao && <span className="caderno-fmt-grupo">{revisar.botao}</span>}
        <button type="button" className="botao-icone pequeno" onClick={aoApagar} aria-label={t.texto.apagar}><Trash2 size="1em" aria-hidden="true" /></button>
      </div>
      <div style={estilo} className="caderno-caixa-editor"><EditorContent editor={editor} /></div>
      {ditado.situacao}
      {revisar.janelas}
    </>
  );
}

/** A camada do laço de seleção, por cima de tudo. Desenha o laço, seleciona o
 *  que está inteiro dentro, e deixa mover, redimensionar e apagar em bloco. */
function CamadaSelecao({ elementos, selecionados, ativa, escala, largura, altura, aoSelecionar, aoMover, aoEscalar, aoRotacionar, aoOrdenar, aoFim, aoApagar }: {
  elementos: Elemento[]; selecionados: string[]; ativa: boolean; escala: number; largura: number; altura: number;
  aoSelecionar: (ids: string[]) => void; aoMover: (dx: number, dy: number) => void;
  aoEscalar: (ax: number, ay: number, fator: number) => void;
  aoRotacionar: (ax: number, ay: number, graus: number) => void; aoOrdenar: (frente: boolean) => void;
  aoFim: () => void; aoApagar: () => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [laco, setLaco] = useState<Ponto2[] | null>(null);
  const gesto = useRef<{ modo: "laco" | "mover" | "escala" | "girar"; ax: number; ay: number; ux: number; uy: number; d0: number; fAplic: number } | null>(null);

  const sel = elementos.filter((e) => selecionados.includes(e.id));
  const lim = limitesDe(sel, alturaTextoEstim);
  const centro: Ponto2 | null = lim ? [lim.x + lim.largura / 2, lim.y + lim.altura / 2] : null;
  const pGirar: Ponto2 | null = lim ? [lim.x + lim.largura / 2, lim.y - (escala ? 34 / escala : 34)] : null;

  const pt = (e: React.PointerEvent): Ponto2 => {
    const r = ref.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * largura, ((e.clientY - r.top) / r.height) * altura];
  };
  const raioAlca = escala ? 11 / escala : 11;
  const cantos = (): Ponto2[] => (lim ? [[lim.x, lim.y], [lim.x + lim.largura, lim.y], [lim.x + lim.largura, lim.y + lim.altura], [lim.x, lim.y + lim.altura]] : []);

  const inicio = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    const [x, y] = pt(e);
    // Perto da alça de girar? Começa a rotação em torno do centro.
    if (pGirar && centro && (x - pGirar[0]) ** 2 + (y - pGirar[1]) ** 2 <= (raioAlca * 1.6) ** 2) {
      gesto.current = { modo: "girar", ax: centro[0], ay: centro[1], ux: x, uy: y, d0: Math.atan2(y - centro[1], x - centro[0]), fAplic: 0 };
      return;
    }
    const cs = cantos();
    // Perto de um canto? Então redimensiona em torno do canto oposto.
    for (let i = 0; i < cs.length; i++) {
      if ((x - cs[i][0]) ** 2 + (y - cs[i][1]) ** 2 <= (raioAlca * 1.5) ** 2) {
        const op = cs[(i + 2) % 4];
        gesto.current = { modo: "escala", ax: op[0], ay: op[1], ux: x, uy: y, d0: Math.hypot(x - op[0], y - op[1]) || 1, fAplic: 1 };
        return;
      }
    }
    // Dentro da seleção? Move. Senão, começa um laço novo.
    if (lim && x >= lim.x && x <= lim.x + lim.largura && y >= lim.y && y <= lim.y + lim.altura) {
      gesto.current = { modo: "mover", ax: 0, ay: 0, ux: x, uy: y, d0: 0, fAplic: 1 };
    } else {
      gesto.current = { modo: "laco", ax: 0, ay: 0, ux: x, uy: y, d0: 0, fAplic: 1 };
      setLaco([[x, y]]);
    }
  };
  const mover = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g) return;
    const [x, y] = pt(e);
    if (g.modo === "laco") setLaco((l) => (l ? [...l, [x, y]] : l));
    else if (g.modo === "mover") { aoMover(x - g.ux, y - g.uy); g.ux = x; g.uy = y; }
    else if (g.modo === "girar") {
      const ang = Math.atan2(y - g.ay, x - g.ax);
      const d = ((ang - g.d0) * 180) / Math.PI;
      aoRotacionar(g.ax, g.ay, d);
      g.d0 = ang;
    } else {
      const d = Math.hypot(x - g.ax, y - g.ay);
      const fTotal = Math.max(0.1, d / g.d0);
      aoEscalar(g.ax, g.ay, fTotal / g.fAplic);
      g.fAplic = fTotal;
    }
  };
  const fim = () => {
    const g = gesto.current;
    gesto.current = null;
    if (!g) return;
    if (g.modo === "laco") {
      setLaco((l) => {
        if (l && l.length >= 3) {
          let ids = elementos.filter((el) => elementoDentro(el, l, alturaTextoEstim)).map((el) => el.id);
          // Nada ficou inteiro dentro: "pega" o elemento sob o centro do laço
          // (útil para imagens grandes, que seriam difíceis de contornar todas).
          if (!ids.length) {
            const cx = l.reduce((s, p) => s + p[0], 0) / l.length;
            const cy = l.reduce((s, p) => s + p[1], 0) / l.length;
            const sob = [...elementos].reverse().find((el) => {
              const b = limitesDe([el], alturaTextoEstim);
              return b && cx >= b.x && cx <= b.x + b.largura && cy >= b.y && cy <= b.y + b.altura;
            });
            if (sob) ids = [sob.id];
          }
          aoSelecionar(ids);
        } else {
          // Toque simples (sem contornar): seleciona o objeto que está embaixo
          // do dedo. É o jeito natural — tocar numa imagem, figurinha ou traço
          // já a seleciona, sem precisar desenhar um laço em volta.
          const tap = l && l.length ? l[l.length - 1] : null;
          const sob = tap
            ? [...elementos].reverse().find((el) => {
                const b = limitesDe([el], alturaTextoEstim);
                return b && tap[0] >= b.x && tap[0] <= b.x + b.largura && tap[1] >= b.y && tap[1] <= b.y + b.altura;
              })
            : undefined;
          aoSelecionar(sob ? [sob.id] : []);
        }
        return null;
      });
    } else {
      aoFim();
    }
  };

  const dLaco = laco && laco.length ? `M ${laco.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")} Z` : "";
  return (
    <div className={ativa ? "caderno-selecao ativa" : "caderno-selecao"}>
      <svg ref={ref} className="caderno-selecao-svg" viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none"
        onPointerDown={ativa ? inicio : undefined} onPointerMove={ativa ? mover : undefined} onPointerUp={ativa ? fim : undefined} onPointerCancel={ativa ? fim : undefined}>
        {laco && <path d={dLaco} className="caderno-laco" vectorEffect="non-scaling-stroke" />}
        {lim && (
          <>
            <rect x={lim.x} y={lim.y} width={lim.largura} height={lim.altura} className="caderno-sel-caixa" vectorEffect="non-scaling-stroke" />
            {cantos().map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={raioAlca} className="caderno-sel-alca" vectorEffect="non-scaling-stroke" />)}
            {pGirar && (
              <>
                <line x1={lim.x + lim.largura / 2} y1={lim.y} x2={pGirar[0]} y2={pGirar[1]} className="caderno-sel-haste" vectorEffect="non-scaling-stroke" />
                <circle cx={pGirar[0]} cy={pGirar[1]} r={raioAlca} className="caderno-sel-girar" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </>
        )}
      </svg>
      {ativa && lim && (
        <div className="caderno-sel-acoes" style={{ left: (lim.x + lim.largura) * escala, top: lim.y * escala }}>
          <button type="button" className="botao-icone pequeno" onClick={() => aoOrdenar(true)} aria-label={t.laco.paraFrente} title={t.laco.paraFrente}><ArrowUp size="1em" aria-hidden="true" /></button>
          <button type="button" className="botao-icone pequeno" onClick={() => aoOrdenar(false)} aria-label={t.laco.paraTras} title={t.laco.paraTras}><ArrowDown size="1em" aria-hidden="true" /></button>
          <button type="button" className="botao-icone pequeno" onClick={aoApagar} aria-label={t.laco.apagar} title={t.laco.apagar}><Trash2 size="1em" aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}

/** A régua: uma guia translúcida com traços e números (em cm) que a pessoa
 *  arrasta e gira. Desenhar perto da borda de cima faz o traço sair reto (o
 *  encaixe fica na SuperficieDesenho). A opacidade é ajustável. */
function CamadaRegua({ regua, escala, largura, altura, aoMudar }: {
  regua: Regua; escala: number; largura: number; altura: number; aoMudar: (r: Regua) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const gesto = useRef<{ modo: "mover" | "a" | "b"; ux: number; uy: number } | null>(null);
  const pt = (e: React.PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * largura, ((e.clientY - r.top) / r.height) * altura];
  };
  const inicio = (modo: "mover" | "a" | "b") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    ref.current?.setPointerCapture(e.pointerId);
    const [x, y] = pt(e);
    gesto.current = { modo, ux: x, uy: y };
  };
  const mover = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g) return;
    const [x, y] = pt(e);
    if (g.modo === "mover") { const dx = x - g.ux, dy = y - g.uy; aoMudar({ ...regua, x1: regua.x1 + dx, y1: regua.y1 + dy, x2: regua.x2 + dx, y2: regua.y2 + dy }); g.ux = x; g.uy = y; }
    else if (g.modo === "a") aoMudar({ ...regua, x1: x, y1: y });
    else aoMudar({ ...regua, x2: x, y2: y });
  };
  const fim = () => { gesto.current = null; };
  const raio = escala ? 12 / escala : 12;

  // Geometria: comprimento, ângulo e corpo da régua (uma faixa de largura L).
  const dx = regua.x2 - regua.x1, dy = regua.y2 - regua.y1;
  const comp = Math.hypot(dx, dy) || 1;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const L = 58; // largura da faixa (px de referência)
  const op = regua.op ?? 0.5;
  // Traços: a cada 1 mm um risco curtinho, a cada 0,5 cm médio, a cada 1 cm
  // longo + número. Fica igual a uma régua de verdade.
  const passoMm = PX_CM / 10;
  const marcas: React.ReactNode[] = [];
  for (let i = 0, x = 0; x <= comp + 0.1; i++, x = i * passoMm) {
    const cm = i % 10 === 0, meio = i % 5 === 0;
    const h = cm ? 17 : meio ? 11 : 6;
    marcas.push(<line key={`m${i}`} x1={x} y1={0} x2={x} y2={h} className="caderno-regua-traco" vectorEffect="non-scaling-stroke" />);
    if (cm && i > 0) marcas.push(<text key={`t${i}`} x={x} y={30} className="caderno-regua-num" textAnchor="middle">{i / 10}</text>);
  }

  // Posição do controle de opacidade: meio da régua, deslocado para o lado do corpo.
  const mx = (regua.x1 + regua.x2) / 2, my = (regua.y1 + regua.y2) / 2;
  const nx = -dy / comp, ny = dx / comp; // perpendicular (lado do corpo)
  const cx = (mx + nx * (L + 16)) * escala, cy = (my + ny * (L + 16)) * escala;

  return (
    <div className="caderno-regua-camada">
      <svg ref={ref} className="caderno-regua-svg" viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none"
        onPointerMove={mover} onPointerUp={fim} onPointerCancel={fim}>
        <g transform={`translate(${regua.x1} ${regua.y1}) rotate(${ang})`}>
          <rect x={0} y={0} width={comp} height={L} className="caderno-regua-corpo" fillOpacity={op} onPointerDown={inicio("mover")} />
          <g className="caderno-regua-marcas" style={{ opacity: Math.min(1, op + 0.35) }}>{marcas}</g>
          <line x1={0} y1={0} x2={comp} y2={0} className="caderno-regua-linha" vectorEffect="non-scaling-stroke" />
        </g>
        <circle cx={regua.x1} cy={regua.y1} r={raio} className="caderno-regua-alca" vectorEffect="non-scaling-stroke" onPointerDown={inicio("a")} />
        <circle cx={regua.x2} cy={regua.y2} r={raio} className="caderno-regua-alca" vectorEffect="non-scaling-stroke" onPointerDown={inicio("b")} />
      </svg>
      <label className="caderno-regua-opac" style={{ left: cx, top: cy }} title={t.regua.opacidade}>
        <Ruler aria-hidden="true" size="0.9em" />
        <input type="range" min={0.15} max={0.85} step={0.05} value={op} aria-label={t.regua.opacidade}
          onChange={(e) => aoMudar({ ...regua, op: Number(e.target.value) })} />
      </label>
    </div>
  );
}

/** A camada onde a pessoa escreve/desenha, por cima da folha. */
function SuperficieDesenho({ cena, ferramenta, cor, ajuste, forma, regua, largura, altura, imagemUrl, aoDesenhar, aoNovaForma, aoApagarParcial, aoApagarFim }: {
  cena: Cena; ferramenta: FerramentaUI; cor: string; ajuste: AjusteTraco; forma: AjusteForma; regua: Regua | null; largura: number; altura: number;
  imagemUrl: (id: string) => string | undefined;
  aoDesenhar: (t: Traco) => void; aoNovaForma: (f: Forma) => void;
  aoApagarParcial: (x: number, y: number, raio: number) => void; aoApagarFim: () => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [vivo, setVivo] = useState<Traco | null>(null);
  const [formaViva, setFormaViva] = useState<Forma | null>(null);
  const [apagador, setApagador] = useState<{ x: number; y: number } | null>(null);
  const desenhando = useRef(false);
  const apagouAlgo = useRef(false);
  const naRegua = useRef(false);
  const raioApagador = Math.max(4, ajuste.tamanho / 2);
  const comRegua = (p: { x: number; y: number; p: number }) => (naRegua.current && regua ? { ...p, ...projetarNaRegua(p.x, p.y, regua) } : p);

  const ponto = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * largura, y: ((e.clientY - r.top) / r.height) * altura, p: e.pressure > 0 ? e.pressure : 0.5 };
  };
  const inicio = (e: React.PointerEvent) => {
    if (ferramenta === "texto" || ferramenta === "nota" || ferramenta === "laco") return; // tratados nas camadas por cima
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const pt = ponto(e);
    if (ferramenta === "borracha") { apagouAlgo.current = false; setApagador({ x: pt.x, y: pt.y }); aoApagarParcial(pt.x, pt.y, raioApagador); apagouAlgo.current = true; }
    else if (ferramenta === "forma") setFormaViva({ tipo: "forma", id: crypto.randomUUID(), forma: forma.tipo, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, cor, espessura: forma.espessura });
    else {
      naRegua.current = regua != null && distDaRegua(pt.x, pt.y, regua) <= LIMIAR_REGUA;
      setVivo({ tipo: "traco", id: crypto.randomUUID(), ferramenta, cor, espessura: Math.round(ajuste.tamanho), afinar: ajuste.afinar, alisar: ajuste.alisar, opacidade: ajuste.opacidade, pontos: [comRegua(pt)] });
    }
  };
  const mover = (e: React.PointerEvent) => {
    if (!desenhando.current) return;
    const pt = ponto(e);
    if (ferramenta === "borracha") { setApagador({ x: pt.x, y: pt.y }); aoApagarParcial(pt.x, pt.y, raioApagador); }
    else if (ferramenta === "forma") setFormaViva((v) => (v ? { ...v, x2: pt.x, y2: pt.y } : v));
    else setVivo((v) => (v ? { ...v, pontos: [...v.pontos, comRegua(pt)] } : v));
  };
  const fim = () => {
    if (!desenhando.current) return;
    desenhando.current = false;
    if (ferramenta === "borracha") {
      setApagador(null);
      if (apagouAlgo.current) aoApagarFim();
    } else if (ferramenta === "forma") {
      setFormaViva((v) => { if (v && (Math.abs(v.x2 - v.x1) > 3 || Math.abs(v.y2 - v.y1) > 3)) aoNovaForma(v); return null; });
    } else {
      naRegua.current = false;
      setVivo((v) => { if (v && v.pontos.length) aoDesenhar(v); return null; });
    }
  };

  const classe = ferramenta === "texto" || ferramenta === "nota" || ferramenta === "laco" ? "caderno-desenho sem-toque" : ferramenta === "borracha" ? "caderno-desenho borracha" : "caderno-desenho";
  return (
    <svg ref={ref} className={classe} viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none"
      onPointerDown={inicio} onPointerMove={mover} onPointerUp={fim} onPointerCancel={fim}>
      {cena.elementos.map((el) => {
        if (el.tipo === "traco") return <path key={el.id} d={caminhoDeTraco(el)} fill={el.cor} opacity={el.opacidade ?? FERRAMENTAS[el.ferramenta].opacidade} />;
        if (el.tipo === "forma") return <path key={el.id} d={caminhoDeForma(el)} fill="none" stroke={el.cor} strokeWidth={el.espessura} strokeLinecap="round" strokeLinejoin="round" />;
        if (el.tipo === "imagem") {
          const u = imagemUrl(el.anexoId);
          if (!u) return null;
          const giro = el.rot ? `rotate(${el.rot} ${el.x + el.largura / 2} ${el.y + el.altura / 2})` : undefined;
          return <image key={el.id} href={u} x={el.x} y={el.y} width={el.largura} height={el.altura} preserveAspectRatio="none" transform={giro} />;
        }
        return null;
      })}
      {vivo && <path d={caminhoDeTraco(vivo)} fill={vivo.cor} opacity={vivo.opacidade ?? FERRAMENTAS[vivo.ferramenta].opacidade} />}
      {formaViva && <path d={caminhoDeForma(formaViva)} fill="none" stroke={formaViva.cor} strokeWidth={formaViva.espessura} strokeLinecap="round" strokeLinejoin="round" />}
      {apagador && <circle cx={apagador.x} cy={apagador.y} r={raioApagador} className="caderno-apagador" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

const FERRAMENTAS_UI: { id: FerramentaUI; icone: typeof PenLine }[] = [
  { id: "caneta", icone: PenLine }, { id: "lapis", icone: Pencil }, { id: "pincel", icone: Wand2 }, { id: "marcatexto", icone: Highlighter }, { id: "borracha", icone: Eraser }, { id: "texto", icone: Type }, { id: "nota", icone: StickyNote }, { id: "forma", icone: Shapes }, { id: "laco", icone: Lasso },
];

/** Painel de adesivos prontos, por grupo. Clicar insere o adesivo na página. */
function AdesivosPainel({ aoInserir }: { aoInserir: (id: string) => void }) {
  return (
    <div className="caderno-adesivos">
      {ADESIVOS.map((g) => (
        <div key={g.grupo} className="caderno-adesivos-grupo">
          <span className="campo-rotulo">{g.grupo}</span>
          <div className="caderno-adesivos-grade">
            {g.itens.map((a) => (
              <button key={a.id} type="button" className="caderno-adesivo" onClick={() => aoInserir(a.id)} aria-label={a.nome} title={a.nome}>
                <img src={urlAdesivo(a.id)} alt="" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BarraFerramentas({ ferramenta, aoFerramenta, aoAjustar, cor, aoCor, favoritos, corBarra, aoAbrirCorBarra, aoInserirImagem, aoCriarIa, aoAdesivos, reguaLigada, aoRegua, vertical, aoMover, aoDesfazer, aoRefazer, podeDesfazer, podeRefazer }: {
  ferramenta: FerramentaUI; aoFerramenta: (f: FerramentaUI) => void; aoAjustar: (f: FerramentaUI) => void;
  cor: string; aoCor: (c: string) => void; favoritos: string[];
  corBarra: string; aoAbrirCorBarra: () => void; aoInserirImagem: () => void; aoCriarIa: () => void; aoAdesivos: () => void;
  reguaLigada: boolean; aoRegua: () => void;
  vertical: boolean; aoMover: () => void;
  aoDesfazer: () => void; aoRefazer: () => void; podeDesfazer: boolean; podeRefazer: boolean;
}) {
  const estilo = corBarra ? ({ background: corBarra, "--barra-fg": corContraste(corBarra) } as React.CSSProperties) : undefined;
  const classe = `${vertical ? "caderno-barra vertical" : "caderno-barra"}${corBarra ? " tintada" : ""}`;
  return (
    <div className={classe} style={estilo} role="toolbar" aria-label={t.ferramentas.titulo}>
      <Button className="botao-icone caderno-mover-barra" onPress={aoMover} aria-label={t.ferramentas.moverBarra}><GripVertical aria-hidden="true" size="1.1em" /></Button>
      <span className="caderno-barra-grupo">
        {FERRAMENTAS_UI.map(({ id, icone: Icone }) => (
          <Button key={id} className={ferramenta === id ? "caderno-ferramenta ativa" : "caderno-ferramenta"}
            onPress={() => (ferramenta === id && id !== "laco" ? aoAjustar(id) : aoFerramenta(id))}
            aria-label={ferramenta === id && id !== "laco" ? t.ferramentas.ajustesDe(t.ferramentas.nomes[id]) : t.ferramentas.nomes[id]} aria-pressed={ferramenta === id}>
            <Icone aria-hidden="true" size="1.2em" />
          </Button>
        ))}
      </span>
      <span className="caderno-barra-grupo caderno-cores" role="group" aria-label={t.ferramentas.cor}>
        {favoritos.map((c) => (
          <button key={c} type="button" className={cor.toLowerCase() === c.toLowerCase() ? "caderno-cor atual" : "caderno-cor"} style={{ background: c }} onClick={() => aoCor(c)} aria-label={c} aria-pressed={cor.toLowerCase() === c.toLowerCase()} />
        ))}
        <label className="caderno-cor-escolher" title={t.ferramentas.escolherCor}>
          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#000000"} onChange={(e) => aoCor(e.target.value)} aria-label={t.ferramentas.escolherCor} />
          <Plus aria-hidden="true" size="1em" />
        </label>
      </span>
      <span className="caderno-barra-grupo">
        <Button className="botao-icone" onPress={aoDesfazer} isDisabled={!podeDesfazer} aria-label={t.ferramentas.desfazer}><Undo2 aria-hidden="true" size="1.1em" /></Button>
        <Button className="botao-icone" onPress={aoRefazer} isDisabled={!podeRefazer} aria-label={t.ferramentas.refazer}><Redo2 aria-hidden="true" size="1.1em" /></Button>
        <Button className={reguaLigada ? "botao-icone ativo" : "botao-icone"} onPress={aoRegua} aria-label={t.regua.titulo} aria-pressed={reguaLigada}><Ruler aria-hidden="true" size="1.1em" /></Button>
        <Button className="botao-icone" onPress={aoInserirImagem} aria-label={t.imagem.inserir}><ImagePlus aria-hidden="true" size="1.1em" /></Button>
        <Button className="botao-icone" onPress={aoAdesivos} aria-label={t.adesivos.abrir}><Sticker aria-hidden="true" size="1.1em" /></Button>
        <Button className="botao-icone" onPress={aoCriarIa} aria-label={t.imagemIa.abrir}><Sparkles aria-hidden="true" size="1.1em" /></Button>
        <Button className="botao-icone" onPress={aoAbrirCorBarra} aria-label={t.barraCor.abrir}><Palette aria-hidden="true" size="1.1em" /></Button>
      </span>
    </div>
  );
}

/** Barra deslizante com rótulo e valor mostrado. */
function Deslizante({ rotulo, valor, min, max, passo, aoMudar, mostrar }: { rotulo: string; valor: number; min: number; max: number; passo: number; aoMudar: (n: number) => void; mostrar?: (n: number) => string }) {
  const id = useId();
  return (
    <div className="campo">
      <label className="campo-rotulo deslizante-rotulo" htmlFor={id}>{rotulo} <span className="texto-suave">{mostrar ? mostrar(valor) : valor}</span></label>
      <input id={id} type="range" className="deslizante" min={min} max={max} step={passo} value={valor} onChange={(e) => aoMudar(Number(e.target.value))} />
    </div>
  );
}

/** Ajustes da ferramenta: tamanho, estabilização e pressão (sliders), com prévia. */
function AjustesFerramenta({ ferramenta, ajuste, aoMudar, aoFechar }: { ferramenta: Ferramenta; ajuste: AjusteTraco; aoMudar: (p: Partial<AjusteTraco>) => void; aoFechar: () => void }) {
  const amostra: Traco = {
    tipo: "traco", id: "amostra", ferramenta, cor: "#1f2937", espessura: Math.round(ajuste.tamanho * 1.15), afinar: ajuste.afinar, alisar: ajuste.alisar, opacidade: ajuste.opacidade,
    pontos: Array.from({ length: 44 }, (_x, i) => ({ x: 12 + i * 6.3, y: 40 + Math.sin(i / 5) * 16, p: 0.15 + 0.85 * Math.sin((i / 43) * Math.PI) })),
  };
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div className="formulario">
      <div className="caderno-previa-traco">
        <svg viewBox="0 0 300 80" preserveAspectRatio="xMidYMid meet" aria-label={t.ferramentas.previa}>
          <path d={caminhoDeTraco(amostra)} fill={amostra.cor} opacity={ajuste.opacidade} />
        </svg>
      </div>
      <Deslizante rotulo={t.ferramentas.tamanho} valor={ajuste.tamanho} min={1} max={30} passo={0.5} aoMudar={(n) => aoMudar({ tamanho: n })} mostrar={(n) => `${n.toFixed(1)} px`} />
      <Deslizante rotulo={t.ferramentas.opacidade} valor={ajuste.opacidade} min={0.1} max={1} passo={0.05} aoMudar={(n) => aoMudar({ opacidade: n })} mostrar={pct} />
      <Deslizante rotulo={t.ferramentas.estabilizacao} valor={ajuste.alisar} min={0} max={0.9} passo={0.05} aoMudar={(n) => aoMudar({ alisar: n })} mostrar={pct} />
      <p className="campo-ajuda">{t.ferramentas.estabilizacaoAjuda}</p>
      <Deslizante rotulo={t.ferramentas.pressao} valor={ajuste.afinar} min={0} max={0.9} passo={0.05} aoMudar={(n) => aoMudar({ afinar: n })} mostrar={pct} />
      <p className="campo-ajuda">{t.ferramentas.pressaoAjuda}</p>
      <div className="janela-acoes">
        <Button className="botao principal" onPress={aoFechar}>{textos.comum.fechar}</Button>
      </div>
    </div>
  );
}

/** Ajustes da caixa de texto: por ora, o tamanho da letra das novas caixas. */
function AjustesTexto({ tamanho, cor, aoMudar, aoFechar }: { tamanho: number; cor: string; aoMudar: (n: number) => void; aoFechar: () => void }) {
  return (
    <div className="formulario">
      <div className="caderno-previa-traco">
        <span style={{ color: /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#1f2937", fontSize: `${Math.min(tamanho, 40)}px`, lineHeight: 1.2 }}>Aa Bb</span>
      </div>
      <Deslizante rotulo={t.texto.tamanho} valor={tamanho} min={12} max={80} passo={2} aoMudar={aoMudar} mostrar={(n) => `${n} px`} />
      <p className="campo-ajuda">{t.texto.novoAjuda}</p>
      <div className="janela-acoes">
        <Button className="botao principal" onPress={aoFechar}>{textos.comum.fechar}</Button>
      </div>
    </div>
  );
}

/** Ajustes das formas: qual forma e a espessura da linha, com prévia. */
function AjustesForma({ ajuste, cor, aoMudar, aoFechar }: { ajuste: AjusteForma; cor: string; aoMudar: (p: Partial<AjusteForma>) => void; aoFechar: () => void }) {
  const corValida = /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#1f2937";
  const previa: Forma = { tipo: "forma", id: "p", forma: ajuste.tipo, x1: 40, y1: 24, x2: 260, y2: 56, cor: corValida, espessura: ajuste.espessura };
  return (
    <div className="formulario">
      <div className="caderno-previa-traco">
        <svg viewBox="0 0 300 80" preserveAspectRatio="xMidYMid meet" aria-label={t.ferramentas.previa}>
          <path d={caminhoDeForma(previa)} fill="none" stroke={corValida} strokeWidth={ajuste.espessura} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <Segmentado rotulo={t.forma.qual} valor={ajuste.tipo} aoMudar={(v) => aoMudar({ tipo: v as TipoForma })} opcoes={TIPOS_FORMA.map((tf) => ({ valor: tf, nome: t.forma.nomes[tf] }))} />
      <Deslizante rotulo={t.forma.espessura} valor={ajuste.espessura} min={1} max={16} passo={0.5} aoMudar={(n) => aoMudar({ espessura: n })} mostrar={(n) => `${n.toFixed(1)} px`} />
      <p className="campo-ajuda">{t.forma.ajuda}</p>
      <div className="janela-acoes">
        <Button className="botao principal" onPress={aoFechar}>{textos.comum.fechar}</Button>
      </div>
    </div>
  );
}

/** Ajustes da borracha: só o tamanho (a área que apaga), com prévia do círculo. */
function AjustesBorracha({ tamanho, aoMudar, aoFechar }: { tamanho: number; aoMudar: (n: number) => void; aoFechar: () => void }) {
  return (
    <div className="formulario">
      <div className="caderno-previa-traco">
        <svg viewBox="0 0 300 80" preserveAspectRatio="xMidYMid meet" aria-label={t.ferramentas.previa}>
          <circle cx="150" cy="40" r={Math.min(tamanho / 2, 38)} fill="none" stroke="#6f747c" strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
      </div>
      <Deslizante rotulo={t.ferramentas.tamanho} valor={tamanho} min={8} max={60} passo={2} aoMudar={aoMudar} mostrar={(n) => `${n} px`} />
      <p className="campo-ajuda">{t.ferramentas.borrachaAjuda}</p>
      <div className="janela-acoes">
        <Button className="botao principal" onPress={aoFechar}>{textos.comum.fechar}</Button>
      </div>
    </div>
  );
}

function PickCor({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (c: string) => void }) {
  const livre = valor.startsWith("#");
  return (
    <RadioGroup className="campo" value={livre ? "" : valor} onChange={aoMudar} orientation="horizontal">
      <Label className="campo-rotulo">{rotulo}</Label>
      <div className="cores-etiqueta">
        <Radio value="" className="cor-opcao" aria-label={t.folha.padraoCor}>
          <span className="etiqueta-cor grande cor-nenhuma" aria-hidden="true" />
        </Radio>
        {CORES_ETIQUETA.map((c) => (
          <Radio key={c} value={c} className="cor-opcao" aria-label={textos.ideias.cores[c]}>
            <span className={`etiqueta-cor grande cor-${c}`} aria-hidden="true" />
          </Radio>
        ))}
        <label className={livre ? "cor-opcao cor-livre atual" : "cor-opcao cor-livre"} title={t.folha.corLivre}>
          <input type="color" value={livre ? valor : "#000000"} onChange={(e) => aoMudar(e.target.value)} aria-label={t.folha.corLivre} />
          <span className="etiqueta-cor grande" style={{ background: livre ? valor : undefined }} aria-hidden="true">{!livre && <Plus size="0.9em" aria-hidden="true" />}</span>
        </label>
      </div>
    </RadioGroup>
  );
}

type AlvoFolha = "atual" | "todas" | { de: number; ate: number };
function EditorFolha({ inicial, tamanho, total, atual, aoAplicar, aoFechar }: { inicial: Papel; tamanho: string; total: number; atual: number; aoAplicar: (p: Papel, alvo: AlvoFolha) => void; aoFechar: () => void }) {
  const [papel, setPapel] = useState<Papel>(inicial);
  const varias = total > 1;
  const [alvo, setAlvo] = useState<"atual" | "intervalo" | "todas">("atual");
  const [de, setDe] = useState(atual);
  const [ate, setAte] = useState(total);
  const mudar = (campo: Partial<Papel>) => setPapel((p) => ({ ...p, ...campo }));
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const aplicar = () => {
    if (!varias || alvo === "atual") return aoAplicar(papel, "atual");
    if (alvo === "todas") return aoAplicar(papel, "todas");
    const d = Math.min(de, ate), a = Math.max(de, ate);
    aoAplicar(papel, { de: Math.max(1, d), ate: Math.min(total, a) });
  };
  return (
    <div className="formulario">
      <div className="caderno-folha-previa"><Folha papel={papel} tamanho={tamanho} className="caderno-folha" /></div>

      <div className="campo">
        <span className="campo-rotulo">{t.folha.modelo}</span>
        <div className="caderno-modelos">
          {MODELOS_PAPEL.map((m) => (
            <button key={m} type="button" className={papel.modelo === m ? "caderno-modelo atual" : "caderno-modelo"} onClick={() => mudar({ modelo: m as ModeloPapel })} aria-pressed={papel.modelo === m}>
              <Folha papel={{ ...papel, modelo: m as ModeloPapel }} tamanho="a5" className="caderno-modelo-mini" />
              <span className="pequeno">{t.folha.modelos[m as keyof typeof t.folha.modelos]}</span>
            </button>
          ))}
        </div>
      </div>

      <PickCor rotulo={t.folha.corPapel} valor={papel.corPapel} aoMudar={(corPapel) => mudar({ corPapel })} />
      <Deslizante rotulo={t.folha.opacPapel} valor={papel.opacPapel ?? 1} min={0.1} max={1} passo={0.05} aoMudar={(n) => mudar({ opacPapel: n })} mostrar={pct} />
      {papel.modelo !== "liso" && (
        <>
          <PickCor rotulo={t.folha.corLinha} valor={papel.corLinha} aoMudar={(corLinha) => mudar({ corLinha })} />
          <Deslizante rotulo={t.folha.opacLinha} valor={papel.opacLinha ?? 1} min={0.1} max={1} passo={0.05} aoMudar={(n) => mudar({ opacLinha: n })} mostrar={pct} />
          <Segmentado rotulo={t.folha.espacamento} valor={String(papel.espacamento)} aoMudar={(v) => mudar({ espacamento: Number(v) })} opcoes={[{ valor: "24", nome: t.folha.espacamentos.apertado }, { valor: "32", nome: t.folha.espacamentos.normal }, { valor: "44", nome: t.folha.espacamentos.largo }]} />
          <Segmentado rotulo={t.folha.espessura} valor={String(papel.espessura)} aoMudar={(v) => mudar({ espessura: Number(v) })} opcoes={[{ valor: "0.6", nome: t.folha.espessuras.fina }, { valor: "1", nome: t.folha.espessuras.media }, { valor: "2", nome: t.folha.espessuras.grossa }]} />
        </>
      )}
      <Interruptor rotulo={t.folha.margem} ligado={papel.margem} aoMudar={(margem) => mudar({ margem })} />
      <Interruptor rotulo={t.folha.cabecalho} ligado={papel.cabecalho} aoMudar={(cabecalho) => mudar({ cabecalho })} />

      {varias && (
        <>
          <Segmentado rotulo={t.folha.aplicarEm} valor={alvo} aoMudar={(v) => setAlvo(v as typeof alvo)}
            opcoes={[{ valor: "atual", nome: t.folha.alvos.atual }, { valor: "intervalo", nome: t.folha.alvos.intervalo }, { valor: "todas", nome: t.folha.alvos.todas }]} />
          {alvo === "intervalo" && (
            <div className="caderno-intervalo">
              <label className="caderno-intervalo-campo">{t.folha.intervaloDe}
                <input type="number" min={1} max={total} value={de} onChange={(e) => setDe(Number(e.target.value))} aria-label={t.folha.intervaloDe} />
              </label>
              <label className="caderno-intervalo-campo">{t.folha.intervaloAte}
                <input type="number" min={1} max={total} value={ate} onChange={(e) => setAte(Number(e.target.value))} aria-label={t.folha.intervaloAte} />
              </label>
            </div>
          )}
        </>
      )}

      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" onPress={aplicar}>{t.folha.aplicar}</Button>
      </div>
    </div>
  );
}
