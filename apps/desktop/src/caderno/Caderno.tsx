import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Form, Label, Radio, RadioGroup } from "react-aria-components";
import { caminhoDeForma, caminhoDeTraco, cenaVazia, FERRAMENTAS, formaAtingida, lerCena, MODELOS_PAPEL, papelDataUri, papelPadrao, serializarCena, TAMANHOS, TIPOS_FORMA, tracoAtingido, type Cena, type CoresPapel, type Ferramenta, type Forma, type ModeloPapel, type Papel, type Texto, type TipoForma, type Traco } from "@orbita/caderno";
import { api, CORES_ETIQUETA, type Capa, type Caderno, type PaginaCaderno, type PastaCaderno } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Interruptor } from "../componentes/Interruptor";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { Bookmark, ChevronLeft, Eraser, FolderOpen, FolderPlus, GripVertical, Highlighter, LayoutGrid, List, Pencil, PenLine, Plus, Redo2, Shapes, SlidersHorizontal, Trash2, Type, Undo2, Wand2 } from "../icones";
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
];

function estiloCapa(capa: Capa): React.CSSProperties {
  if (capa.tipo === "galeria") {
    return { background: CAPAS_GALERIA.find((x) => x.id === capa.valor)?.css ?? "var(--cor-superficie-alternativa)" };
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
  const [erro, setErro] = useState<string | null>(null);
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

  const atual = aberto ? cadernos.find((c) => c.id === aberto.id) ?? aberto : null;
  if (atual) return <CadernoAberto caderno={atual} aoFechar={() => setAberto(null)} />;

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
          <GradeCadernos cadernos={porPasta(dentro.id)} aoAbrir={setAberto} aoEditar={setEditando} aoExcluir={setExcluindo} pastas={pastas} aoMover={moverParaPasta} />
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
              <GradeCadernos cadernos={semPasta} aoAbrir={setAberto} aoEditar={setEditando} aoExcluir={setExcluindo} pastas={pastas} aoMover={moverParaPasta} />
            </section>
          )}
        </>
      )}

      <Aviso>{erro}</Aviso>

      <Janela titulo={editando && editando.id ? t.form.editarTitulo : t.form.novoTitulo} aberta={editando !== null} aoFechar={() => setEditando(null)}>
        {editando && <FormCaderno key={editando.id || "novo"} inicial={editando} pastas={pastas} aoFechar={() => setEditando(null)} />}
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
            <span className="caderno-capa-nome">{c.nome}</span>
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

function EscolherCapa({ capa, aoMudar }: { capa: Capa; aoMudar: (c: Capa) => void }) {
  const valor = `${capa.tipo}:${capa.valor}`;
  const mudar = (v: string) => {
    const [tipo, val] = v.split(":");
    aoMudar({ tipo: tipo as Capa["tipo"], valor: val });
  };
  return (
    <RadioGroup className="campo" value={valor} onChange={mudar}>
      <Label className="campo-rotulo">{t.form.capa}</Label>
      <span className="campo-rotulo pequeno texto-suave">{t.capas.cores}</span>
      <div className="cores-etiqueta">
        {CORES_ETIQUETA.map((c) => (
          <Radio key={c} value={`cor:${c}`} className="cor-opcao" aria-label={textos.ideias.cores[c]}>
            <span className={`etiqueta-cor grande cor-${c}`} aria-hidden="true" />
          </Radio>
        ))}
      </div>
      <span className="campo-rotulo pequeno texto-suave">{t.capas.galeria}</span>
      <div className="caderno-galeria">
        {CAPAS_GALERIA.map((g) => (
          <Radio key={g.id} value={`galeria:${g.id}`} className="caderno-galeria-opcao" aria-label={g.nome}>
            <span className="caderno-galeria-amostra" style={{ background: g.css }} aria-hidden="true" />
            <span className="pequeno">{g.nome}</span>
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}

function FormCaderno({ inicial, pastas, aoFechar }: { inicial: Caderno; pastas: PastaCaderno[]; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [modo, setModo] = useState<Caderno["modo"]>(inicial.modo);
  const [capa, setCapa] = useState<Capa>(inicial.capa);
  const [pastaId, setPastaId] = useState(inicial.pastaId);
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarCaderno({ ...inicial, nome, modo, capa, pastaId });
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
      <EscolherCapa capa={capa} aoMudar={setCapa} />
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
function coresDaFolha(papel: Papel): CoresPapel {
  return {
    fundo: papel.corPapel ? HEX_ETIQUETA[papel.corPapel] ?? "#ffffff" : "#ffffff",
    linha: papel.corLinha ? HEX_ETIQUETA[papel.corLinha] ?? "#c9ccd4" : "#c9ccd4",
  };
}
function folhaDe(pagina: PaginaCaderno): Papel {
  return { ...papelPadrao(), ...((pagina.papel as Partial<Papel>) || {}) };
}
function medidaDe(tamanho: string) {
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

/** Ferramentas da barra: as de traço (do motor) mais a caixa de texto e as formas. */
type FerramentaUI = Ferramenta | "texto" | "forma";
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

function CadernoAberto({ caderno, aoFechar }: { caderno: Caderno; aoFechar: () => void }) {
  useEntrarImersivo();
  const [paginas, setPaginas] = useState<PaginaCaderno[]>([]);
  const [tamanho, setTamanho] = useState<"a4" | "a5" | "carta">("a4");
  const [selId, setSelId] = useState<string>("");
  const [painel, setPainel] = useState(false);
  const [editor, setEditor] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null);
  // Desenho: ferramenta, cor e grossura ativas; cenas e histórico por página.
  const [ferramenta, setFerramenta] = useState<FerramentaUI>("caneta");
  const fTraco: Ferramenta = ferramenta === "texto" || ferramenta === "forma" ? "caneta" : ferramenta;
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
  const mudarAjuste = (f: Ferramenta, patch: Partial<AjusteTraco>) =>
    setAjustes((a) => {
      const novo = { ...a, [f]: { ...a[f], ...patch } };
      try { localStorage.setItem("caderno-ajustes-traco", JSON.stringify(novo)); } catch { /* ignora */ }
      return novo;
    });
  const [cenas, setCenas] = useState<Record<string, Cena>>({});
  const cenasRef = useRef(cenas);
  cenasRef.current = cenas;
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
  const aoApagarTracos = (id: string, ids: string[]) => mudarCena(id, { elementos: (cenas[id]?.elementos ?? []).filter((e) => !ids.includes(e.id)) });

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
  const aoNovoTexto = (pid: string, x: number, y: number) => {
    const novo: Texto = { tipo: "texto", id: crypto.randomUUID(), x, y, largura: LARGURA_TEXTO_PADRAO, texto: "", cor, tamanho: tamTexto };
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
    if (el && el.tipo === "texto" && el.texto.trim() === "") {
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
  // Ao sair da ferramenta de texto, tira o foco (fecha a edição; caixa vazia some).
  useEffect(() => { if (ferramenta !== "texto") (document.activeElement as HTMLElement | null)?.blur?.(); }, [ferramenta]);
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
      await api.salvarPaginaCaderno({ id: "", cadernoId: caderno.id, ordem: 0, tamanho, papel, titulo: "", marcado: false, criadoEm: 0 });
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
  const aplicarFolha = async (papel: Papel, todas: boolean) => {
    setEditor(false);
    const alvos = todas ? paginas : sel ? [sel] : [];
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
                  forma={ajusteForma} editandoTexto={editandoTexto}
                  aoSelecionar={() => setSelId(p.id)}
                  aoDesenhar={(tr) => aoDesenhar(p.id, tr)}
                  aoNovaForma={(fm) => aoNovaForma(p.id, fm)}
                  aoApagarTracos={(ids) => aoApagarTracos(p.id, ids)}
                  aoNovoTexto={(x, y) => aoNovoTexto(p.id, x, y)}
                  aoEditarTexto={(id, txt) => atualizarTexto(p.id, id, { texto: txt })}
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
                <Segmentado rotulo={t.paginas.tamanho} valor={tamanho} aoMudar={(v) => setTamanho(v as typeof tamanho)} opcoes={[{ valor: "a4", nome: t.paginas.tamanhos.a4 }, { valor: "a5", nome: t.paginas.tamanhos.a5 }, { valor: "carta", nome: t.paginas.tamanhos.carta }]} />
                <Button className="botao com-icone" onPress={() => void adicionar()}><Plus aria-hidden="true" size="1.1em" /> {t.paginas.adicionar}</Button>
              </div>
            </>
          )}
        </div>
      </div>

      {!infinito && (
        <BarraFerramentas
          ferramenta={ferramenta} aoFerramenta={setFerramenta} aoAjustar={setAjustando}
          cor={cor} aoCor={usarCor} favoritos={favoritos}
          vertical={posBarra === "direita" || posBarra === "esquerda"} aoMover={ciclarBarra}
          aoDesfazer={() => andar(-1)} aoRefazer={() => andar(1)} podeDesfazer={podeDesfazer} podeRefazer={podeRefazer}
        />
      )}
      </div>

      <Janela titulo={ajustando ? t.ferramentas.ajustesDe(t.ferramentas.nomes[ajustando]) : ""} aberta={ajustando !== null} aoFechar={() => setAjustando(null)} pequena>
        {ajustando && (ajustando === "texto"
          ? <AjustesTexto tamanho={tamTexto} cor={cor} aoMudar={mudarTamTexto} aoFechar={() => setAjustando(null)} />
          : ajustando === "forma"
          ? <AjustesForma ajuste={ajusteForma} cor={cor} aoMudar={mudarForma} aoFechar={() => setAjustando(null)} />
          : <AjustesFerramenta ferramenta={ajustando} ajuste={ajustes[ajustando]} aoMudar={(patch) => mudarAjuste(ajustando, patch)} aoFechar={() => setAjustando(null)} />)}
      </Janela>

      <Janela titulo={t.folha.titulo} aberta={editor} aoFechar={() => setEditor(false)}>
        {editor && <EditorFolha inicial={sel ? folhaDe(sel) : papelPadrao()} tamanho={sel?.tamanho ?? "a4"} varias={paginas.length > 1} aoAplicar={aplicarFolha} aoFechar={() => setEditor(false)} />}
      </Janela>
    </div>
  );
}

function PaginaView({ id, pagina, numero, selecionada, podeApagar, cena, ferramenta, cor, ajuste, forma, editandoTexto, aoSelecionar, aoDesenhar, aoNovaForma, aoApagarTracos, aoNovoTexto, aoEditarTexto, aoMoverTexto, aoMoverFimTexto, aoFimTexto, aoApagarTexto, aoSelecionarTexto, aoTitulo, aoMarcar, aoApagar }: {
  id: string; pagina: PaginaCaderno; numero: number; selecionada: boolean; podeApagar: boolean;
  cena: Cena; ferramenta: FerramentaUI; cor: string; ajuste: AjusteTraco; forma: AjusteForma; editandoTexto: string;
  aoSelecionar: () => void; aoDesenhar: (t: Traco) => void; aoNovaForma: (f: Forma) => void; aoApagarTracos: (ids: string[]) => void;
  aoNovoTexto: (x: number, y: number) => void; aoEditarTexto: (id: string, txt: string) => void;
  aoMoverTexto: (id: string, x: number, y: number) => void; aoMoverFimTexto: () => void;
  aoFimTexto: (id: string) => void; aoApagarTexto: (id: string) => void; aoSelecionarTexto: (id: string) => void;
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
        <SuperficieDesenho cena={cena} ferramenta={ferramenta} cor={cor} ajuste={ajuste} forma={forma} largura={med.largura} altura={med.altura} aoDesenhar={aoDesenhar} aoNovaForma={aoNovaForma} aoApagarTracos={aoApagarTracos} />
        <CamadaTexto caixas={caixas} ativa={ferramenta === "texto"} escala={escala} editandoId={editandoTexto}
          aoNovo={aoNovoTexto} aoEditar={aoEditarTexto} aoMover={aoMoverTexto} aoMoverFim={aoMoverFimTexto}
          aoFim={aoFimTexto} aoApagar={aoApagarTexto} aoSelecionar={aoSelecionarTexto} />
      </div>
    </section>
  );
}

/** A camada das caixas de texto, por cima do desenho. Só interage quando a
 *  ferramenta de texto está ativa; nas outras, fica só mostrando (sem toque). */
function CamadaTexto({ caixas, ativa, escala, editandoId, aoNovo, aoEditar, aoMover, aoMoverFim, aoFim, aoApagar, aoSelecionar }: {
  caixas: Texto[]; ativa: boolean; escala: number; editandoId: string;
  aoNovo: (x: number, y: number) => void; aoEditar: (id: string, txt: string) => void;
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
          aoEditar={(v) => aoEditar(tx.id, v)} aoMover={(x, y) => aoMover(tx.id, x, y)} aoMoverFim={aoMoverFim}
          aoFim={() => aoFim(tx.id)} aoApagar={() => aoApagar(tx.id)} aoSelecionar={() => aoSelecionar(tx.id)} />
      ))}
    </div>
  );
}

function CaixaTexto({ caixa: tx, escala, editando, ativa, aoEditar, aoMover, aoMoverFim, aoFim, aoApagar, aoSelecionar }: {
  caixa: Texto; escala: number; editando: boolean; ativa: boolean;
  aoEditar: (v: string) => void; aoMover: (x: number, y: number) => void; aoMoverFim: () => void;
  aoFim: () => void; aoApagar: () => void; aoSelecionar: () => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const ajustarAltura = () => { const el = area.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } };
  useEffect(ajustarAltura, [tx.texto, tx.tamanho, escala]);
  useEffect(() => {
    if (!editando) return;
    // Foco adiado para depois do clique que criou a caixa (senão o clique rouba o foco).
    const r = requestAnimationFrame(() => {
      const el = area.current;
      if (el) { el.focus(); const n = el.value.length; el.setSelectionRange(n, n); }
    });
    return () => cancelAnimationFrame(r);
  }, [editando]);

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

  return (
    <div className={editando ? "caderno-caixa editando" : "caderno-caixa"} style={{ left: tx.x * escala, top: tx.y * escala, width: tx.largura * escala }}
      onPointerDown={ativa ? (e) => { e.stopPropagation(); aoSelecionar(); } : undefined}>
      {ativa && (
        <div className="caderno-caixa-barra">
          <button type="button" className="caderno-caixa-alca" onPointerDown={arrastar} aria-label={t.texto.mover}><GripVertical size="1em" aria-hidden="true" /></button>
          <button type="button" className="botao-icone pequeno" onClick={aoApagar} aria-label={t.texto.apagar}><Trash2 size="1em" aria-hidden="true" /></button>
        </div>
      )}
      <textarea ref={area} className="caderno-caixa-area" style={{ color: tx.cor, fontSize: `${tx.tamanho * escala}px` }}
        value={tx.texto} placeholder={t.texto.vazio} aria-label={t.texto.campo} readOnly={!ativa} rows={1}
        onPointerDown={(e) => e.stopPropagation()} onChange={(e) => aoEditar(e.target.value)} onBlur={aoFim} />
    </div>
  );
}

/** A camada onde a pessoa escreve/desenha, por cima da folha. */
function SuperficieDesenho({ cena, ferramenta, cor, ajuste, forma, largura, altura, aoDesenhar, aoNovaForma, aoApagarTracos }: {
  cena: Cena; ferramenta: FerramentaUI; cor: string; ajuste: AjusteTraco; forma: AjusteForma; largura: number; altura: number;
  aoDesenhar: (t: Traco) => void; aoNovaForma: (f: Forma) => void; aoApagarTracos: (ids: string[]) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [vivo, setVivo] = useState<Traco | null>(null);
  const [formaViva, setFormaViva] = useState<Forma | null>(null);
  const [escondidos, setEscondidos] = useState<Set<string>>(new Set());
  const desenhando = useRef(false);
  const apagados = useRef<Set<string>>(new Set());

  const ponto = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * largura, y: ((e.clientY - r.top) / r.height) * altura, p: e.pressure > 0 ? e.pressure : 0.5 };
  };
  const apagarEm = (x: number, y: number) => {
    const raio = FERRAMENTAS.borracha.tamanho / 2;
    let mudou = false;
    for (const el of cena.elementos) {
      if (apagados.current.has(el.id)) continue;
      const acerta = (el.tipo === "traco" && tracoAtingido(el, x, y, raio)) || (el.tipo === "forma" && formaAtingida(el, x, y, raio));
      if (acerta) { apagados.current.add(el.id); mudou = true; }
    }
    if (mudou) setEscondidos(new Set(apagados.current));
  };
  const inicio = (e: React.PointerEvent) => {
    if (ferramenta === "texto") return; // texto é tratado na camada por cima
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const pt = ponto(e);
    if (ferramenta === "borracha") { apagados.current = new Set(); setEscondidos(new Set()); apagarEm(pt.x, pt.y); }
    else if (ferramenta === "forma") setFormaViva({ tipo: "forma", id: crypto.randomUUID(), forma: forma.tipo, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, cor, espessura: forma.espessura });
    else setVivo({ tipo: "traco", id: crypto.randomUUID(), ferramenta, cor, espessura: Math.round(ajuste.tamanho), afinar: ajuste.afinar, alisar: ajuste.alisar, opacidade: ajuste.opacidade, pontos: [pt] });
  };
  const mover = (e: React.PointerEvent) => {
    if (!desenhando.current) return;
    const pt = ponto(e);
    if (ferramenta === "borracha") apagarEm(pt.x, pt.y);
    else if (ferramenta === "forma") setFormaViva((v) => (v ? { ...v, x2: pt.x, y2: pt.y } : v));
    else setVivo((v) => (v ? { ...v, pontos: [...v.pontos, pt] } : v));
  };
  const fim = () => {
    if (!desenhando.current) return;
    desenhando.current = false;
    if (ferramenta === "borracha") {
      const ids = [...apagados.current];
      apagados.current = new Set();
      setEscondidos(new Set());
      if (ids.length) aoApagarTracos(ids);
    } else if (ferramenta === "forma") {
      setFormaViva((v) => { if (v && (Math.abs(v.x2 - v.x1) > 3 || Math.abs(v.y2 - v.y1) > 3)) aoNovaForma(v); return null; });
    } else {
      setVivo((v) => { if (v && v.pontos.length) aoDesenhar(v); return null; });
    }
  };

  const classe = ferramenta === "texto" ? "caderno-desenho sem-toque" : ferramenta === "borracha" ? "caderno-desenho borracha" : "caderno-desenho";
  return (
    <svg ref={ref} className={classe} viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none"
      onPointerDown={inicio} onPointerMove={mover} onPointerUp={fim} onPointerCancel={fim}>
      {cena.elementos.map((el) => {
        if (escondidos.has(el.id)) return null;
        if (el.tipo === "traco") return <path key={el.id} d={caminhoDeTraco(el)} fill={el.cor} opacity={el.opacidade ?? FERRAMENTAS[el.ferramenta].opacidade} />;
        if (el.tipo === "forma") return <path key={el.id} d={caminhoDeForma(el)} fill="none" stroke={el.cor} strokeWidth={el.espessura} strokeLinecap="round" strokeLinejoin="round" />;
        return null;
      })}
      {vivo && <path d={caminhoDeTraco(vivo)} fill={vivo.cor} opacity={vivo.opacidade ?? FERRAMENTAS[vivo.ferramenta].opacidade} />}
      {formaViva && <path d={caminhoDeForma(formaViva)} fill="none" stroke={formaViva.cor} strokeWidth={formaViva.espessura} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

const FERRAMENTAS_UI: { id: FerramentaUI; icone: typeof PenLine }[] = [
  { id: "caneta", icone: PenLine }, { id: "lapis", icone: Pencil }, { id: "pincel", icone: Wand2 }, { id: "marcatexto", icone: Highlighter }, { id: "borracha", icone: Eraser }, { id: "texto", icone: Type }, { id: "forma", icone: Shapes },
];

function BarraFerramentas({ ferramenta, aoFerramenta, aoAjustar, cor, aoCor, favoritos, vertical, aoMover, aoDesfazer, aoRefazer, podeDesfazer, podeRefazer }: {
  ferramenta: FerramentaUI; aoFerramenta: (f: FerramentaUI) => void; aoAjustar: (f: FerramentaUI) => void;
  cor: string; aoCor: (c: string) => void; favoritos: string[];
  vertical: boolean; aoMover: () => void;
  aoDesfazer: () => void; aoRefazer: () => void; podeDesfazer: boolean; podeRefazer: boolean;
}) {
  return (
    <div className={vertical ? "caderno-barra vertical" : "caderno-barra"} role="toolbar" aria-label={t.ferramentas.titulo}>
      <Button className="botao-icone caderno-mover-barra" onPress={aoMover} aria-label={t.ferramentas.moverBarra}><GripVertical aria-hidden="true" size="1.1em" /></Button>
      <span className="caderno-barra-grupo">
        {FERRAMENTAS_UI.map(({ id, icone: Icone }) => (
          <Button key={id} className={ferramenta === id ? "caderno-ferramenta ativa" : "caderno-ferramenta"}
            onPress={() => (ferramenta === id && id !== "borracha" ? aoAjustar(id) : aoFerramenta(id))}
            aria-label={ferramenta === id && id !== "borracha" ? t.ferramentas.ajustesDe(t.ferramentas.nomes[id]) : t.ferramentas.nomes[id]} aria-pressed={ferramenta === id}>
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

function PickCor({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (c: string) => void }) {
  return (
    <RadioGroup className="campo" value={valor} onChange={aoMudar} orientation="horizontal">
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
      </div>
    </RadioGroup>
  );
}

function EditorFolha({ inicial, tamanho, varias, aoAplicar, aoFechar }: { inicial: Papel; tamanho: string; varias: boolean; aoAplicar: (p: Papel, todas: boolean) => void; aoFechar: () => void }) {
  const [papel, setPapel] = useState<Papel>(inicial);
  const mudar = (campo: Partial<Papel>) => setPapel((p) => ({ ...p, ...campo }));
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
      {papel.modelo !== "liso" && <PickCor rotulo={t.folha.corLinha} valor={papel.corLinha} aoMudar={(corLinha) => mudar({ corLinha })} />}

      {papel.modelo !== "liso" && (
        <>
          <Segmentado rotulo={t.folha.espacamento} valor={String(papel.espacamento)} aoMudar={(v) => mudar({ espacamento: Number(v) })} opcoes={[{ valor: "24", nome: t.folha.espacamentos.apertado }, { valor: "32", nome: t.folha.espacamentos.normal }, { valor: "44", nome: t.folha.espacamentos.largo }]} />
          <Segmentado rotulo={t.folha.espessura} valor={String(papel.espessura)} aoMudar={(v) => mudar({ espessura: Number(v) })} opcoes={[{ valor: "0.6", nome: t.folha.espessuras.fina }, { valor: "1", nome: t.folha.espessuras.media }, { valor: "2", nome: t.folha.espessuras.grossa }]} />
        </>
      )}
      <Interruptor rotulo={t.folha.margem} ligado={papel.margem} aoMudar={(margem) => mudar({ margem })} />
      <Interruptor rotulo={t.folha.cabecalho} ligado={papel.cabecalho} aoMudar={(cabecalho) => mudar({ cabecalho })} />

      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        {varias && <Button className="botao" onPress={() => aoAplicar(papel, true)}>{t.folha.aplicarTodas}</Button>}
        <Button className="botao principal" onPress={() => aoAplicar(papel, false)}>{t.folha.aplicar}</Button>
      </div>
    </div>
  );
}
