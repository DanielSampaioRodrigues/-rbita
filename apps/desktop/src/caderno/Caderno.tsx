import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Button, Form, Label, Radio, RadioGroup } from "react-aria-components";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { caminhoDeForma, cenaVazia, desenhoDeTraco, MODELOS_PINCEL, novaSemente, elementoDentro, escalar, FERRAMENTAS, formaAtingida, fragmentosAoApagar, lerCena, limitesDe, MODELOS_PAPEL, papelDataUri, papelPadrao, rotacionar, serializarCena, TAMANHOS, TIPOS_FORMA, transladar, type AlinharTexto, type Cena, type CoresPapel, type Elemento, type Ferramenta, type Forma, type Imagem, type ModeloPapel, type ModeloPincel, type Papel, type Ponto, type Ponto2, type Texto, type TipoForma, type Traco } from "@orbita/caderno";
import { agrupar, ajustarConectores, desagrupar, elementoNoPonto, expandirGrupos, idsNoRetangulo, imagemAtingida, moverUmNivel, objetoNoPonto, ordenarTudo, soltarSetasMovidas, temGrupo, type MedidaTexto } from "./edicao";
import { ICONES_FORMA, IconeAgrupar, IconeAlca, IconeCadeado, IconeCadeadoAberto, IconeCursor, IconeDesagrupar, IconeEngrenagem, IconeNivelFrente, IconeNivelTras, IconeSeta, IconeTudoFrente, IconeTudoTras } from "./iconesCaderno";
import { api, CORES_ETIQUETA, type Capa, type Caderno, type EstadoIa, type PaginaCaderno, type PastaCaderno } from "../api";
import { reduzirImagem } from "../fundo";
import { useReescrever } from "../ia/Reescrever";
import { useDitar } from "../ditado/Ditar";
import { CriarImagemIa } from "./CriarImagemIa";
import { Aviso, Campo } from "../componentes/Campo";
import { Interruptor } from "../componentes/Interruptor";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { AlignCenter, AlignLeft, AlignRight, Bold, Bookmark, ChevronLeft, ChevronRight, Eraser, FolderOpen, FolderPlus, Highlighter, ImagePlus, Italic, Lasso, LayoutGrid, List, ListOrdered, Palette, Pencil, PenLine, Plus, Redo2, Ruler, Shapes, SlidersHorizontal, Sparkles, Sticker, StickyNote, Trash2, Type, Underline, Undo2, Wand2, X } from "../icones";
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

/** Cores das pastas: dez tons suaves. O nome da pasta fica embaixo do
 *  desenho, na cor de texto do tema, então o contraste não depende da cor. */
const CORES_PASTA = {
  areia: "#e2c27d", pessego: "#f0b48c", rosa: "#eaa8bd", lavanda: "#b9a8e3", ceu: "#9cc0ea",
  mar: "#86c9c4", menta: "#a7d8b2", musgo: "#b5c47a", terra: "#cfa182", cinza: "#b9bec7",
} as const;
type CorPasta = keyof typeof CORES_PASTA;
const NOMES_COR_PASTA = Object.keys(CORES_PASTA) as CorPasta[];
const corDaPasta = (c?: string) => CORES_PASTA[(c && c in CORES_PASTA ? c : "areia") as CorPasta];
/** Mistura um hex com preto (f < 0) ou branco (f > 0). */
function misturar(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const alvo = f < 0 ? 0 : 255, k = Math.abs(f);
  const c = (v: number) => Math.round(v + (alvo - v) * k).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** Desenho da pasta com cara de 3D: o fundo com a aba, folhas de papel
 *  aparecendo e a frente levemente inclinada, com gradiente e sombra suaves.
 *  No baixo estímulo, o CSS tira gradiente, brilho e sombra (fica chapada). */
function IconePasta({ cor, quantidade }: { cor?: string; quantidade: number }) {
  const base = corDaPasta(cor);
  const escura = misturar(base, -0.22);
  const clara = misturar(base, 0.28);
  const id = useId().replace(/:/g, "");
  const estilo = { "--pasta-cor": base, "--pasta-escura": escura } as React.CSSProperties;
  return (
    <svg className="pasta3d" viewBox="0 0 120 100" style={estilo} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clara} />
          <stop offset="1" stopColor={base} />
        </linearGradient>
        <linearGradient id={`${id}-t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={base} />
          <stop offset="1" stopColor={escura} />
        </linearGradient>
      </defs>
      <ellipse className="pasta3d-sombra" cx="60" cy="93" rx="50" ry="5" />
      <path className="pasta3d-fundo" fill={`url(#${id}-t)`} d="M8 24 Q8 14 18 14 H42 Q48 14 51 19 L54 24 H102 Q112 24 112 34 V80 Q112 88 104 88 H16 Q8 88 8 80 Z" />
      <rect className="pasta3d-papel" x="18" y="22" width="80" height="52" rx="2" transform="rotate(-3 58 48)" />
      <rect className="pasta3d-papel claro" x="22" y="27" width="78" height="50" rx="2" transform="rotate(2 61 52)" />
      <path className="pasta3d-frente" fill={`url(#${id}-f)`} d="M5 44 Q5 38 11 38 H109 Q115 38 115 44 L109 84 Q108 91 100 91 H20 Q12 91 11 84 Z" />
      <path className="pasta3d-brilho" d="M12 40.5 H108" />
      <text className="pasta3d-qtd" x="101" y="83" textAnchor="end" fill={corContraste(base)}>{quantidade}</text>
    </svg>
  );
}

function CartaoPasta({ pasta, quantidade, aoAbrir, aoEditar, aoExcluir }: { pasta: PastaCaderno; quantidade: number; aoAbrir: () => void; aoEditar: () => void; aoExcluir: () => void }) {
  return (
    <div className="caderno-pasta">
      <button className="caderno-pasta-fig" onClick={aoAbrir} aria-label={`${t.abrir}: ${pasta.nome} (${t.pasta.quantos(quantidade)})`}>
        <IconePasta cor={pasta.cor} quantidade={quantidade} />
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
  const [cor, setCor] = useState<string>(inicial.cor && inicial.cor in CORES_PASTA ? inicial.cor : "areia");
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarPastaCaderno({ ...inicial, nome, cor });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(mensagem(err));
    }
  };
  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.pasta.nome} valor={nome} aoMudar={setNome} autoFocus maximo={60} semDitado />
      <RadioGroup className="campo" value={cor} onChange={setCor} orientation="horizontal">
        <Label className="campo-rotulo">{t.pasta.cor}</Label>
        <div className="caderno-pasta-cores">
          {NOMES_COR_PASTA.map((c) => (
            <Radio key={c} value={c} className="cor-opcao" aria-label={t.pasta.cores[c]}>
              <span className="etiqueta-cor grande" style={{ background: CORES_PASTA[c] }} aria-hidden="true" />
            </Radio>
          ))}
        </div>
      </RadioGroup>
      <div className="caderno-pasta-previa"><IconePasta cor={cor} quantidade={0} /><span className="quebra">{nome || t.pasta.nova}</span></div>
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
/** Preferências do caderno no armazenamento local (sem quebrar se faltar). */
function lerPref(chave: string): string | null {
  try { return localStorage.getItem(chave); } catch { return null; }
}
function gravarPref(chave: string, valor: string) {
  try { localStorage.setItem(chave, valor); } catch { /* ignora */ }
}
/** Limites do zoom das páginas (pinça com dois dedos ou Ctrl + roda). */
const ZOOM_MIN = 0.5, ZOOM_MAX = 4;
const limitarZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

function lerCorBarra(): string {
  try { const s = localStorage.getItem("caderno-cor-barra"); if (s && /^#[0-9a-fA-F]{6}$/.test(s)) return s; } catch { /* padrão */ }
  return "";
}

/** Ferramentas da barra: as de traço (do motor) mais texto, nota adesiva,
 *  formas, seta, o laço e a seleção (cursor). */
type FerramentaUI = Ferramenta | "texto" | "nota" | "forma" | "seta" | "laco" | "selecao";
const FERRAMENTAS_TRACO: FerramentaUI[] = ["caneta", "lapis", "pincel", "marcatexto", "borracha"];
/** Modo da borracha: come só o pedaço tocado, ou apaga o objeto inteiro. */
type ModoBorracha = "pedaco" | "objeto";
/** Formas oferecidas na barra (a seta virou ferramenta própria). */
const FORMAS_BARRA = ["retangulo", "elipse", "triangulo", "reta", "losango", "estrela"] as const;
/** Cores pastel das notas adesivas (a primeira é o padrão). */
const FUNDOS_NOTA = ["#fff3b0", "#ffd6e0", "#d9f2d0", "#cfe8ff", "#e6d9ff", "#ffe0c2"];

/** Régua: uma guia (segmento) para desenhar reto. Em px de referência. */
type Regua = { x1: number; y1: number; x2: number; y2: number; op?: number };
type UnidadeRegua = "cm" | "mm";
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
/** Tamanho real de cada caixa de texto, medido na tela (px de referência). A
 *  seleção usa isso para a borda tracejada abraçar o texto, não a largura máxima. */
const medidasTexto = new Map<string, { l: number; a: number }>();
const MEDIDA: MedidaTexto = {
  altura: (t) => medidasTexto.get(t.id)?.a ?? alturaTextoEstim(t),
  largura: (t) => medidasTexto.get(t.id)?.l ?? t.largura,
};
/** O conteúdo HTML está vazio (só tags, sem texto)? */
const textoVazio = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";

/** Extensões do editor da caixa: só marcas em linha (negrito, itálico,
 *  sublinhado) e parágrafos — nada de título, lista ou citação (é um rótulo). */
const extensoesCaderno = [
  StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false, strike: false, link: false }),
];

/** Fontes oferecidas na caixa ("" = padrão do app). */
// Padrão do tema primeiro; depois todas as fontes do app (as mesmas da Aparência).
const FONTES_CADERNO: (keyof typeof FONTES | "")[] = ["", ...(Object.keys(FONTES) as (keyof typeof FONTES)[])];
const fonteCss = (f?: string) => (f && f in FONTES ? FONTES[f as keyof typeof FONTES].css : "var(--fonte-texto)");
const ALINHAR: AlinharTexto[] = ["esquerda", "centro", "direita"];
const ALINHAR_CSS: Record<AlinharTexto, "left" | "center" | "right"> = { esquerda: "left", centro: "center", direita: "right" };

/** Lista vazia estável (evita re-render das páginas sem seleção). */
const vazio: string[] = [];
/** Cena vazia estável (página ainda carregando): não refaz o desenho à toa. */
const CENA_VAZIA: Cena = cenaVazia();

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
    if (s) { const v = JSON.parse(s); if (v && TIPOS_FORMA.includes(v.tipo) && typeof v.espessura === "number") return v.tipo === "seta" ? { ...v, tipo: "reta" } : v; }
  } catch { /* padrão */ }
  return { tipo: "retangulo", espessura: 3 };
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
  // A imagem da folha só é refeita quando o papel ou o tamanho mudam de
  // verdade (a chave em texto evita refazer a cada re-render, ex.: trocar a cor).
  const chave = `${tamanho}|${JSON.stringify(papel)}`;
  const { uri, fundo, med } = useMemo(() => {
    const m = medidaDe(tamanho);
    const cores = coresDaFolha(papel);
    return { uri: papelDataUri(papel, m.largura, m.altura, cores), fundo: cores.fundo, med: m };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return <div className={className} style={{ aspectRatio: `${med.largura} / ${med.altura}`, backgroundImage: `url("${uri}")`, backgroundSize: "100% 100%", backgroundColor: fundo }} />;
}

/** Safari do iPad/iPhone: só ele informa se o toque é da Apple Pencil
 *  (Touch.touchType). Lá, o dedo rola o caderno e a caneta escreve. */
const TOQUE_SABE_CANETA = typeof Touch !== "undefined" && "touchType" in Touch.prototype;

/** Tablet ou celular (iPad inclusive, que se apresenta como Mac com toque).
 *  Neles, "escrever só com a caneta" já começa ligado. Notebook com tela de
 *  toque (Windows) não entra: lá o dedo pode continuar riscando. */
function ehTabletOuCelular(): boolean {
  if (typeof navigator === "undefined" || !(navigator.maxTouchPoints > 0)) return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod|Android|Mobile|Tablet/i.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/** Toque "de palma": área de contato grande (px). Nunca rola nem dá zoom. */
const PALMA_PX = 30;
/** Depois que a caneta levanta, o dedo continua ignorado por este tempo (ms). */
const CANETA_PAUSA_MS = 600;
/** Quanto do espaço depois da última página é preciso puxar para criar outra. */
const LIMIAR_PUXAR = 0.85;
const tamanhoDoToque = (tq: Touch) => Math.max(tq.radiusX || 0, tq.radiusY || 0) * 2;
const ehCanetaToque = (tq: Touch) => (tq as Touch & { touchType?: string }).touchType === "stylus";

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
  const ehSelecao = ferramenta === "laco" || ferramenta === "selecao";
  const fTraco: Ferramenta = FERRAMENTAS_TRACO.includes(ferramenta) ? (ferramenta as Ferramenta) : "caneta";
  // Texto: negrito já ligado nas caixas novas (escolha da barra de texto).
  const [negritoTexto, setNegritoTexto] = useState(() => lerPref("caderno-texto-negrito") === "1");
  const mudarNegritoTexto = (v: boolean) => { setNegritoTexto(v); gravarPref("caderno-texto-negrito", v ? "1" : "0"); };
  // Onde a barra de formatação do texto em edição aparece (dentro da barra de ferramentas).
  const [slotTexto, setSlotTexto] = useState<HTMLDivElement | null>(null);
  const [modoBorracha, setModoBorracha] = useState<ModoBorracha>(() => (lerPref("caderno-borracha-modo") === "objeto" ? "objeto" : "pedaco"));
  const mudarModoBorracha = (m: ModoBorracha) => { setModoBorracha(m); gravarPref("caderno-borracha-modo", m); };
  // Seleção: "acrescentar" faz cada toque somar à seleção (o Shift do toque).
  const [acrescentar, setAcrescentar] = useState(false);
  // Configurações do caderno (engrenagem).
  const [configAberta, setConfigAberta] = useState(false);
  const [lateral, setLateral] = useState(() => lerPref("caderno-rolagem") === "lateral");
  const mudarLateral = (v: boolean) => { setLateral(v); gravarPref("caderno-rolagem", v ? "lateral" : "vertical"); };
  const [unidadeRegua, setUnidadeRegua] = useState<UnidadeRegua>(() => (lerPref("caderno-regua-unidade") === "mm" ? "mm" : "cm"));
  const mudarUnidadeRegua = (u: UnidadeRegua) => { setUnidadeRegua(u); gravarPref("caderno-regua-unidade", u); };
  const [zoom, setZoom] = useState(1);
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
  // "Escrever só com a caneta" (rejeição da palma): com ela ligada, o dedo
  // nunca risca — um dedo rola, dois dedos fazem pinça. Liga sozinha na
  // primeira vez que uma caneta aparece (em qualquer aparelho); a pessoa pode
  // desligar nas configurações, e aí fica desligada. (Quem já tinha usado a
  // Apple Pencil antes desta opção existir começa com ela ligada.)
  const [soCaneta, setSoCaneta] = useState<boolean>(() => {
    const v = lerPref("caderno-so-caneta");
    if (v === "1" || v === "0") return v === "1";
    return lerPref("caderno-caneta-vista") === "1" || ehTabletOuCelular();
  });
  // Cadeado "Travar a folha": o toque não rola nem dá zoom (só a caneta escreve).
  const [travada, setTravada] = useState(() => lerPref("caderno-trava") === "1");
  const mudarTravada = (v: boolean) => { setTravada(v); gravarPref("caderno-trava", v ? "1" : "0"); };
  const soCanetaEfetivo = soCaneta || travada;
  const mudarSoCaneta = (v: boolean) => { setSoCaneta(v); gravarPref("caderno-so-caneta", v ? "1" : "0"); };
  const marcarCaneta = useCallback(() => {
    setSoCaneta((atual) => {
      if (atual || lerPref("caderno-so-caneta") !== null) return atual; // a pessoa já escolheu
      gravarPref("caderno-so-caneta", "1");
      return true;
    });
  }, []);
  // No Safari (iPad), o próprio navegador rola com o dedo (mais macio). Nos
  // outros, o caderno rola na mão (ver o efeito dos toques, mais abaixo).
  const dedoRola = TOQUE_SABE_CANETA && soCanetaEfetivo && !travada;
  // Dois dedos na tela (pinça) ou mais: ninguém desenha até todos saírem.
  const multiToque = useRef(false);
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
  const mudarPosBarra = (p: PosBarra) => { setPosBarra(p); gravarPref("caderno-pos-barra", p); };
  const ciclarBarra = () => mudarPosBarra(POS_BARRA[(POS_BARRA.indexOf(posBarra) + 1) % POS_BARRA.length]);
  const mioloRef = useRef<HTMLDivElement>(null);
  // Painel de opções da ferramenta (flutua ao lado da barra). Abre ao escolher
  // a ferramenta; tocar de novo nela fecha e abre.
  const [painelFerr, setPainelFerr] = useState(true);
  // Dica da primeira vez (alça e ▸), lembrada depois do "Entendi".
  const [dicaBarra, setDicaBarra] = useState(() => lerPref("caderno-dica-barra") !== "1");
  const fecharDicaBarra = () => { setDicaBarra(false); gravarPref("caderno-dica-barra", "1"); };
  // Modelo do pincel (redondo, giz, spray...).
  const [modeloPincel, setModeloPincel] = useState<ModeloPincel>(() => {
    const v = lerPref("caderno-pincel-modelo");
    return v && (MODELOS_PINCEL as string[]).includes(v) ? (v as ModeloPincel) : "redondo";
  });
  const mudarModeloPincel = (m: ModeloPincel) => { setModeloPincel(m); gravarPref("caderno-pincel-modelo", m); };
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
  // Função estável: só muda quando chega imagem nova (deixa o desenho memorizado).
  const imagemUrl = useCallback((id: string) => imagemUrls[id], [imagemUrls]);
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
  // Forma nova (a seta pode nascer presa a objetos: acerta as pontas na borda deles).
  const aoNovaForma = (id: string, forma: Forma) => mudarCena(id, { elementos: ajustarConectores([...(cenas[id]?.elementos ?? []), forma], MEDIDA) });
  // Borracha com dois modos. "Por pedaço": apaga o pedaço do traço por onde
  // passa (parte os traços em fragmentos), apaga formas por inteiro ao encostar
  // e tira a figura/imagem que a borracha cruzar. "Objeto inteiro": apaga
  // qualquer objeto que encostar (traço, forma, imagem ou texto). Ao vivo não
  // mexe no histórico; registra um passo quando a pessoa solta.
  const apagarParcial = (pid: string, x: number, y: number, raio: number) =>
    setCenas((m) => {
      const c = m[pid] ?? cenaVazia();
      const novos: Elemento[] = [];
      let mudou = false;
      for (const el of c.elementos) {
        if (modoBorracha === "objeto") {
          if (elementoNoPonto(el, x, y, raio, MEDIDA)) mudou = true; else novos.push(el);
          continue;
        }
        if (el.tipo === "traco") {
          const frags = fragmentosAoApagar(el, x, y, raio);
          if (frags === null) { novos.push(el); continue; }
          mudou = true;
          frags.forEach((pontos, i) => novos.push({ ...el, id: i === 0 ? el.id : crypto.randomUUID(), pontos }));
        } else if (el.tipo === "forma") {
          if (formaAtingida(el, x, y, raio)) mudou = true; else novos.push(el);
        } else if (el.tipo === "imagem") {
          if (imagemAtingida(el, x, y, raio * 0.5)) mudou = true; else novos.push(el);
        } else novos.push(el); // o texto só sai no modo "objeto inteiro"
      }
      if (!mudou) return m;
      const nova: Cena = { elementos: ajustarConectores(novos, MEDIDA) };
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
    // Com uma caixa aberta, tocar fora só confirma o texto (não abre outra).
    if (editandoTexto) { setEditandoTexto(""); return; }
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
  // Ao sair da seleção (laço ou cursor), limpa a seleção.
  useEffect(() => { if (!ehSelecao) { limparSelecao(); setAcrescentar(false); } }, [ehSelecao]);

  // Seleção (laço ou cursor): seleciona, move, escala, recolore e apaga em bloco.
  const selecionarLaco = (pid: string, ids: string[]) => { setSelPid(pid); setSelIds(ids); };
  // Ao mover/girar/escalar, as setas presas aos objetos acompanham; seta
  // movida sozinha se solta do objeto.
  const transformarSelecao = (pid: string, ids: string[], fn: (el: Elemento) => Elemento) =>
    setCenas((m) => {
      const c = m[pid] ?? cenaVazia();
      const movidos = c.elementos.map((e) => (ids.includes(e.id) ? fn(e) : e));
      const nova: Cena = { elementos: ajustarConectores(soltarSetasMovidas(movidos, ids), MEDIDA) };
      agendarSalvarCena(pid, nova);
      return { ...m, [pid]: nova };
    });
  const moverSelecao = (pid: string, ids: string[], dx: number, dy: number) => transformarSelecao(pid, ids, (el) => transladar(el, dx, dy));
  const escalarSelecao = (pid: string, ids: string[], ax: number, ay: number, fator: number) => transformarSelecao(pid, ids, (el) => escalar(el, ax, ay, fator));
  const rotacionarSelecao = (pid: string, ids: string[], ax: number, ay: number, graus: number) => transformarSelecao(pid, ids, (el) => rotacionar(el, ax, ay, graus));
  // Camadas: para a frente/trás de tudo, ou um nível (passa pelo objeto que
  // encosta). Preserva a ordem entre os selecionados.
  const ordenarSelecao = (pid: string, ids: string[], frente: boolean) =>
    mudarCena(pid, { elementos: ordenarTudo(cenas[pid]?.elementos ?? [], ids, frente) });
  const nivelSelecao = (pid: string, ids: string[], frente: boolean) => {
    const els = cenas[pid]?.elementos ?? [];
    const novos = moverUmNivel(els, ids, frente, MEDIDA);
    if (novos !== els) mudarCena(pid, { elementos: novos });
  };
  // Grupos: objetos agrupados se selecionam e se movem juntos.
  const agruparSelecao = () => {
    if (!selPid || selIds.length < 2) return;
    mudarCena(selPid, { elementos: agrupar(cenas[selPid]?.elementos ?? [], selIds, crypto.randomUUID()) });
  };
  const desagruparSelecao = () => {
    if (!selPid || !selIds.length) return;
    mudarCena(selPid, { elementos: desagrupar(cenas[selPid]?.elementos ?? [], selIds) });
  };
  const fimGestoSelecao = (pid: string) => registrarCena(pid, cenasRef.current[pid] ?? cenaVazia());
  const recolorirSelecao = (c: string) => {
    if (!selPid || !selIds.length) return;
    mudarCena(selPid, { elementos: (cenas[selPid]?.elementos ?? []).map((e) => (selIds.includes(e.id) ? { ...e, cor: c } : e)) });
  };
  const apagarSelecao = () => {
    if (!selPid || !selIds.length) return;
    mudarCena(selPid, { elementos: ajustarConectores((cenas[selPid]?.elementos ?? []).filter((e) => !selIds.includes(e.id)), MEDIDA) });
    limparSelecao();
  };

  // Teclado com a seleção ativa: Delete apaga, setas movem (Shift = passo
  // maior), Esc solta, Ctrl+A seleciona a página toda, Ctrl+G agrupa,
  // Ctrl+Shift+G desagrupa, Ctrl+] / Ctrl+[ um nível para a frente/trás
  // (com Shift: para a frente/trás de tudo).
  const fimTeclaTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const aoTeclaRef = useRef<(e: KeyboardEvent) => void>(() => {});
  aoTeclaRef.current = (e: KeyboardEvent) => {
    if (!ehSelecao) return;
    const alvo = e.target as HTMLElement | null;
    if (alvo?.closest?.("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const tecla = e.key.toLowerCase();
    if (ctrl && !e.shiftKey && tecla === "a") {
      const pid = selId || paginas[0]?.id;
      if (!pid) return;
      e.preventDefault();
      setSelPid(pid);
      setSelIds((cenas[pid]?.elementos ?? []).map((el) => el.id));
      return;
    }
    if (!selPid || !selIds.length) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); apagarSelecao(); return; }
    if (e.key === "Escape") { limparSelecao(); return; }
    if (ctrl && tecla === "g") { e.preventDefault(); if (e.shiftKey) desagruparSelecao(); else agruparSelecao(); return; }
    if (ctrl && ["]", "[", "}", "{"].includes(e.key)) {
      e.preventDefault();
      const frente = e.key === "]" || e.key === "}";
      if (e.shiftKey) ordenarSelecao(selPid, selIds, frente); else nivelSelecao(selPid, selIds, frente);
      return;
    }
    const setas: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (setas[e.key] && !ctrl && !e.altKey) {
      e.preventDefault();
      const passo = e.shiftKey ? 10 : 1;
      const pid = selPid;
      moverSelecao(pid, selIds, setas[e.key][0] * passo, setas[e.key][1] * passo);
      // Um passo de desfazer por "rajada" de setas, não por tecla.
      clearTimeout(fimTeclaTimer.current);
      fimTeclaTimer.current = setTimeout(() => fimGestoSelecao(pid), 450);
    }
  };
  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => aoTeclaRef.current(e);
    window.addEventListener("keydown", ouvir);
    return () => window.removeEventListener("keydown", ouvir);
  }, []);

  // Zoom das páginas: pinça com dois dedos ou Ctrl + roda do mouse, sempre
  // centrado no ponto do gesto, sem animação. O ponto sob os dedos fica parado.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const ancoraZoom = useRef<{ cx: number; cy: number; px: number; py: number; fator: number } | null>(null);
  const aplicarZoom = (novo: number, px: number, py: number) => {
    const el = area.current;
    const z0 = zoomRef.current, z1 = limitarZoom(novo);
    if (!el || Math.abs(z1 - z0) < 0.001) return;
    ancoraZoom.current = { cx: el.scrollLeft + px, cy: el.scrollTop + py, px, py, fator: z1 / z0 };
    zoomRef.current = z1;
    flushSync(() => setZoom(z1));
  };
  const aplicarZoomRef = useRef(aplicarZoom);
  aplicarZoomRef.current = aplicarZoom;
  useLayoutEffect(() => {
    const a = ancoraZoom.current, el = area.current;
    if (!a || !el) return;
    ancoraZoom.current = null;
    el.scrollLeft = a.cx * a.fator - a.px;
    el.scrollTop = a.cy * a.fator - a.py;
  }, [zoom]);
  const voltarZoom = () => {
    const el = area.current;
    if (el) aplicarZoom(1, el.clientWidth / 2, el.clientHeight / 2); else setZoom(1);
  };
  const soCanetaRef = useRef(soCanetaEfetivo);
  soCanetaRef.current = soCanetaEfetivo;
  const travadaRef = useRef(travada);
  travadaRef.current = travada;
  // A caneta está encostada agora? Quando levantou pela última vez?
  const caneta = useRef({ encostada: new Set<number>(), levantou: -1e9 });
  useEffect(() => {
    const el = area.current;
    if (!el || infinito) return;
    // Rejeição da palma (com "só caneta" ligado): toques que nunca rolam nem
    // dão zoom — mão apoiada (área de contato grande), qualquer toque enquanto
    // a caneta encosta e logo depois que ela levanta, e tudo com a folha travada.
    const ignorados = new Set<number>();
    const canetaRecente = () => caneta.current.encostada.size > 0 || performance.now() - caneta.current.levantou < CANETA_PAUSA_MS;
    const temCaneta = (ev: TouchEvent) => [...ev.touches].some(ehCanetaToque);
    // Dedos de verdade (a Apple Pencil, no Safari, também gera "toques": fica de fora).
    const dedos = (ev: TouchEvent) => [...ev.touches].filter((tq) => !ehCanetaToque(tq) && !ignorados.has(tq.identifier));
    // Segurar o toque só em cima da folha (botões e campos continuam tocáveis).
    const podeSegurar = (ev: TouchEvent) => {
      const alvo = ev.target as Element | null;
      return ev.cancelable && !!alvo?.closest?.(".caderno-folha-area") && !alvo.closest("input, textarea, select, button, [contenteditable='true']");
    };
    let pinca: { d0: number; z0: number; mx: number; my: number } | null = null;
    let arrasto: { x: number; y: number } | null = null;
    const meio = (a: Touch, b: Touch) => {
      const r = el.getBoundingClientRect();
      return { mx: (a.clientX + b.clientX) / 2 - r.left, my: (a.clientY + b.clientY) / 2 - r.top, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1 };
    };
    /** Marca os toques a ignorar; diz se agora o toque deve ficar parado. */
    const filtrar = (ev: TouchEvent, novos: Iterable<Touch>) => {
      if (!soCanetaRef.current) return false;
      const recente = canetaRecente() || temCaneta(ev);
      for (const tq of novos) {
        if (ehCanetaToque(tq) || ignorados.has(tq.identifier)) continue;
        if (travadaRef.current || recente || tamanhoDoToque(tq) > PALMA_PX) ignorados.add(tq.identifier);
      }
      return travadaRef.current || recente || [...ev.touches].some((tq) => ignorados.has(tq.identifier));
    };
    const inicio = (ev: TouchEvent) => {
      if (filtrar(ev, ev.changedTouches)) {
        // Mão apoiada, caneta em uso ou folha travada: nada rola nem dá zoom.
        if ([...ev.changedTouches].some((tq) => !ehCanetaToque(tq)) && podeSegurar(ev)) ev.preventDefault();
        pinca = null;
        arrasto = null;
        if (dedos(ev).length >= 2) multiToque.current = true;
        return;
      }
      const ds = dedos(ev);
      if (ds.length >= 2) {
        multiToque.current = true; // dois dedos nunca desenham
        const m = meio(ds[0], ds[1]);
        pinca = { d0: m.d, z0: zoomRef.current, mx: m.mx, my: m.my };
        arrasto = null;
        if (ev.cancelable) ev.preventDefault();
      } else if (ds.length === 1 && soCanetaRef.current && !TOQUE_SABE_CANETA && (ev.target as Element | null)?.closest?.(".caderno-folha-area")) {
        // "Só caneta" fora do Safari: o dedo rola o caderno na mão.
        arrasto = { x: ds[0].clientX, y: ds[0].clientY };
      }
    };
    const mover = (ev: TouchEvent) => {
      // A mão pode encostar de leve e só depois espalhar: confere de novo o tamanho.
      if (filtrar(ev, ev.touches)) {
        if (podeSegurar(ev)) ev.preventDefault();
        pinca = null;
        arrasto = null;
        return;
      }
      const ds = dedos(ev);
      if (pinca && ds.length >= 2) {
        if (ev.cancelable) ev.preventDefault();
        const m = meio(ds[0], ds[1]);
        el.scrollLeft -= m.mx - pinca.mx; // dois dedos também arrastam
        el.scrollTop -= m.my - pinca.my;
        pinca.mx = m.mx; pinca.my = m.my;
        aplicarZoomRef.current(pinca.z0 * (m.d / pinca.d0), m.mx, m.my);
      } else if (arrasto && ds.length === 1) {
        if (ev.cancelable) ev.preventDefault();
        el.scrollLeft -= ds[0].clientX - arrasto.x;
        el.scrollTop -= ds[0].clientY - arrasto.y;
        arrasto = { x: ds[0].clientX, y: ds[0].clientY };
      }
    };
    const fim = (ev: TouchEvent) => {
      for (const tq of ev.changedTouches) {
        ignorados.delete(tq.identifier);
        if (ehCanetaToque(tq)) caneta.current.levantou = performance.now();
      }
      const ds = dedos(ev);
      if (ds.length < 2) pinca = null;
      if (ev.touches.length === 0) { multiToque.current = false; arrasto = null; ignorados.clear(); }
    };
    // A caneta por eventos de ponteiro (vale em qualquer navegador).
    const canetaDesce = (ev: PointerEvent) => { if (ev.pointerType === "pen") caneta.current.encostada.add(ev.pointerId); };
    const canetaSobe = (ev: PointerEvent) => {
      if (ev.pointerType !== "pen" || !caneta.current.encostada.delete(ev.pointerId)) return;
      caneta.current.levantou = performance.now();
    };
    // Ctrl + roda (e a pinça do touchpad, que chega assim): zoom no cursor.
    const roda = (ev: WheelEvent) => {
      if (!ev.ctrlKey) return;
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      aplicarZoomRef.current(zoomRef.current * Math.exp(-ev.deltaY * 0.0025), ev.clientX - r.left, ev.clientY - r.top);
    };
    // Safari: sem isto, a pinça aumentaria a página inteira do app.
    const gesto = (ev: Event) => ev.preventDefault();
    el.addEventListener("pointerdown", canetaDesce, true);
    // Levantar a caneta é ouvido na janela inteira (ela pode sair da área).
    window.addEventListener("pointerup", canetaSobe, true);
    window.addEventListener("pointercancel", canetaSobe, true);
    el.addEventListener("touchstart", inicio, { passive: false });
    el.addEventListener("touchmove", mover, { passive: false });
    el.addEventListener("touchend", fim);
    el.addEventListener("touchcancel", fim);
    el.addEventListener("wheel", roda, { passive: false });
    el.addEventListener("gesturestart", gesto);
    el.addEventListener("gesturechange", gesto);
    return () => {
      el.removeEventListener("pointerdown", canetaDesce, true);
      window.removeEventListener("pointerup", canetaSobe, true);
      window.removeEventListener("pointercancel", canetaSobe, true);
      el.removeEventListener("touchstart", inicio);
      el.removeEventListener("touchmove", mover);
      el.removeEventListener("touchend", fim);
      el.removeEventListener("touchcancel", fim);
      el.removeEventListener("wheel", roda);
      el.removeEventListener("gesturestart", gesto);
      el.removeEventListener("gesturechange", gesto);
    };
  }, [infinito]);
  // Altura útil da área (para o tamanho das páginas na rolagem lateral).
  const [alturaArea, setAlturaArea] = useState(0);
  useEffect(() => {
    const el = area.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setAlturaArea(el.clientHeight));
    ro.observe(el);
    setAlturaArea(el.clientHeight);
    return () => ro.disconnect();
  }, [infinito]);

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
  // Página a mostrar assim que aparecer na lista (depois de criada).
  const rolarPara = useRef("");
  const criando = useRef(false);
  const adicionar = async (rolar = true) => {
    if (criando.current) return; // evita criar duas de uma vez (toque duplo, rolagem)
    criando.current = true;
    try {
      // Nova página herda a folha da última (mantém o estilo do caderno).
      const papel = paginas.length ? folhaDe(paginas[paginas.length - 1]) : papelPadrao();
      const nova = await api.salvarPaginaCaderno({ id: "", cadernoId: caderno.id, ordem: 0, tamanho: tamanhoParaCriar(), papel, titulo: "", marcado: false, criadoEm: 0 });
      if (nova?.id && rolar) { setSelId(nova.id); rolarPara.current = nova.id; }
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      criando.current = false;
    }
  };
  useEffect(() => {
    const id = rolarPara.current;
    if (!id || !paginas.some((p) => p.id === id)) return;
    rolarPara.current = "";
    area.current?.querySelector(`#pg-${id}`)?.scrollIntoView({ block: "start", inline: "start" });
  }, [paginas]);
  // Puxar além da última página cria uma nova (como no GoodNotes), mas só se a
  // última já tem algo: se ela está vazia, não cria outra (sem duplicar).
  const ultimaVazia = (() => {
    const ult = paginas[paginas.length - 1];
    if (!ult) return false;
    const c = cenas[ult.id];
    return !ult.titulo && !!c && c.elementos.length === 0;
  })();
  // Enquanto a pessoa puxa, um "fantasma" da página nova cresce junto com o
  // dedo (sem animação: só o tamanho acompanha). Passou do limiar e soltou,
  // cria; voltou antes de soltar, não cria. Mexe direto no DOM (sem re-render
  // a cada quadro da rolagem, que no iPad pesaria).
  const puxarRef = useRef<HTMLDivElement>(null);
  const fantasmaRef = useRef<HTMLDivElement>(null);
  const puxado = useRef(0);
  const dedosNaTela = useRef(0);
  const ociosoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const podePuxar = () => !infinito && paginas.length > 0 && !ultimaVazia && !!cenas[paginas[paginas.length - 1].id];
  const medirPuxado = () => {
    const el = area.current, sp = puxarRef.current;
    if (!el || !sp) return 0;
    const rEl = el.getBoundingClientRect(), rSp = sp.getBoundingClientRect();
    const total = lateral ? sp.offsetWidth : sp.offsetHeight;
    const visivel = Math.min(total, Math.max(0, lateral ? rEl.right - rSp.left : rEl.bottom - rSp.top));
    const frac = total > 0 ? visivel / total : 0;
    puxado.current = frac;
    const g = fantasmaRef.current;
    if (g) {
      if (lateral) { g.style.width = `${Math.round(visivel)}px`; g.style.height = ""; }
      else { g.style.height = `${Math.round(visivel)}px`; g.style.width = ""; }
      g.dataset.pronto = frac >= LIMIAR_PUXAR ? "1" : "0";
    }
    return frac;
  };
  const soltarPuxado = () => {
    if (medirPuxado() >= LIMIAR_PUXAR && podePuxar() && !criando.current) void adicionar(false);
  };
  const soltarRef = useRef(soltarPuxado);
  soltarRef.current = soltarPuxado;
  const aoRolar = () => {
    medirPuxado();
    clearTimeout(ociosoTimer.current);
    // Roda do mouse, teclado ou rolagem que segue depois de soltar: decide
    // quando a rolagem para. Com o dedo na tela, espera ele sair.
    if (dedosNaTela.current === 0) ociosoTimer.current = setTimeout(() => soltarRef.current(), 280);
  };
  useEffect(() => {
    const el = area.current;
    if (!el || infinito) return;
    const conta = (ev: TouchEvent) => { dedosNaTela.current = ev.touches.length; };
    const solta = (ev: TouchEvent) => {
      dedosNaTela.current = ev.touches.length;
      if (ev.touches.length === 0) soltarRef.current();
    };
    el.addEventListener("touchstart", conta, { passive: true });
    el.addEventListener("touchend", solta, { passive: true });
    el.addEventListener("touchcancel", solta, { passive: true });
    return () => {
      el.removeEventListener("touchstart", conta);
      el.removeEventListener("touchend", solta);
      el.removeEventListener("touchcancel", solta);
      clearTimeout(ociosoTimer.current);
    };
  }, [infinito]);
  // Página nova (ou mudança de modo): o fantasma volta a medir do zero.
  useLayoutEffect(() => { medirPuxado(); });
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
    area.current?.querySelector(`#pg-${id}`)?.scrollIntoView({ block: "start", inline: "start" });
  };
  // Com a folha travada, troca de página pelos botões (ou pelo índice).
  const indiceSel = Math.max(0, paginas.findIndex((p) => p.id === selId));
  const irRelativo = (passo: number) => {
    const alvo = paginas[indiceSel + passo];
    if (alvo) irPara(alvo.id);
  };

  return (
    <div className="caderno-tela">
      <div className="leitor-barra">
        <Button className="botao-icone" onPress={aoFechar} aria-label={t.voltarEstante}><ChevronLeft aria-hidden="true" size="1.2em" /></Button>
        <strong className="leitor-titulo quebra">
          {infinito ? <LayoutGrid aria-hidden="true" size="1em" /> : <PenLine aria-hidden="true" size="1em" />} {caderno.nome}
        </strong>
        <span className="linha-ajuste">
          {!infinito && zoom !== 1 && (
            <Button className="botao pequeno caderno-zoom" onPress={voltarZoom} aria-label={t.zoom.voltar(Math.round(zoom * 100))}>{Math.round(zoom * 100)}%</Button>
          )}
          {!infinito && travada && (
            <>
              <Button className="botao-icone" onPress={() => irRelativo(-1)} isDisabled={indiceSel <= 0} aria-label={t.trava.anterior}><ChevronLeft aria-hidden="true" size="1.1em" /></Button>
              <span className="texto-suave pequeno caderno-pagina-atual" aria-live="polite">{t.paginas.numero(indiceSel + 1)}</span>
              <Button className="botao-icone" onPress={() => irRelativo(1)} isDisabled={indiceSel >= paginas.length - 1} aria-label={t.trava.proxima}><ChevronRight aria-hidden="true" size="1.1em" /></Button>
            </>
          )}
          {!infinito && <Button className={painel ? "botao-icone ativo" : "botao-icone"} onPress={() => setPainel((v) => !v)} aria-label={t.indice.titulo} aria-pressed={painel}><List aria-hidden="true" size="1.1em" /></Button>}
          <Button className="botao-icone" onPress={() => setEditor(true)} aria-label={t.folha.abrir}><SlidersHorizontal aria-hidden="true" size="1.1em" /></Button>
          <Button className="botao-icone" onPress={() => setConfigAberta(true)} aria-label={t.config.abrir}><IconeEngrenagem aria-hidden="true" size="1.1em" /></Button>
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

      <div className={`caderno-miolo pos-${posBarra}`} ref={mioloRef}>
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

        <div className={`caderno-rolagem${lateral && !infinito ? " lateral" : ""}${travada ? " travada" : ""}`} ref={area} onScroll={aoRolar}>
          {infinito ? (
            <div className="caderno-aviso-breve"><LayoutGrid aria-hidden="true" size="1.1em" /> {t.infinitoEmBreve}</div>
          ) : (
            <>
              {paginas.map((p, i) => (
                <PaginaView key={p.id} id={`pg-${p.id}`} pagina={p} numero={i + 1} selecionada={p.id === selId} podeApagar={paginas.length > 1}
                  cena={cenas[p.id] ?? CENA_VAZIA} ferramenta={ferramenta} cor={cor} ajuste={ajustes[fTraco]} modeloPincel={modeloPincel}
                  forma={ajusteForma} editandoTexto={editandoTexto} selecionados={p.id === selPid ? selIds : vazio} imagemUrl={imagemUrl}
                  dedoRola={dedoRola} soCaneta={soCanetaEfetivo} multiToque={multiToque} aoCaneta={marcarCaneta}
                  zoom={zoom} alturaLateral={lateral ? alturaArea : 0} acrescentar={acrescentar}
                  negritoTexto={negritoTexto} slotTexto={slotTexto} aoTamTexto={mudarTamTexto}
                  regua={p.id === selId ? regua : null} unidadeRegua={unidadeRegua} aoMudarRegua={setRegua} aoUnidadeRegua={mudarUnidadeRegua}
                  aoSelecionar={() => setSelId(p.id)}
                  aoDesenhar={(tr) => aoDesenhar(p.id, tr)}
                  aoNovaForma={(fm) => aoNovaForma(p.id, fm)}
                  aoApagarParcial={(x, y, raio) => apagarParcial(p.id, x, y, raio)}
                  aoApagarFim={() => apagarParcialFim(p.id)}
                  aoSelecionarLaco={(ids) => selecionarLaco(p.id, ids)}
                  aoMoverSelecao={(ids, dx, dy) => moverSelecao(p.id, ids, dx, dy)}
                  aoEscalarSelecao={(ids, ax, ay, fa) => escalarSelecao(p.id, ids, ax, ay, fa)}
                  aoRotacionarSelecao={(ids, ax, ay, g) => rotacionarSelecao(p.id, ids, ax, ay, g)}
                  aoOrdenarSelecao={(frente) => ordenarSelecao(p.id, selIds, frente)}
                  aoNivelSelecao={(frente) => nivelSelecao(p.id, selIds, frente)}
                  aoAgrupar={agruparSelecao} aoDesagrupar={desagruparSelecao}
                  aoFimSelecao={() => fimGestoSelecao(p.id)}
                  aoApagarSelecao={apagarSelecao}
                  aoEditarTexto={(id) => { setFerramenta("texto"); setEditandoTexto(id); }}
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
              {paginas.length > 0 && (
                <div className="caderno-puxar" ref={puxarRef} aria-hidden="true"
                  style={lateral ? undefined : { width: `calc(min(100%, 1500px) * ${zoom})` }}>
                  {ultimaVazia ? <p className="caderno-puxar-vazia">{t.paginas.puxarVazia}</p> : (
                    <div className="caderno-fantasma" ref={fantasmaRef} data-pronto="0"
                      style={lateral ? { height: `${Math.max(240, alturaArea - 90) * zoom}px` } : undefined}>
                      <span className="caderno-fantasma-texto puxe">{t.paginas.puxar}</span>
                      <span className="caderno-fantasma-texto solte">{t.paginas.solte}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!infinito && (
        <BarraFerramentas
          ferramenta={ferramenta} aoFerramenta={(f) => { setFerramenta(f); setPainelFerr(true); }} aoAjustar={setAjustando}
          painelAberto={painelFerr || !!editandoTexto} aoPainel={setPainelFerr}
          cor={cor} aoCor={(c) => { usarCor(c); if (ehSelecao && selIds.length) recolorirSelecao(c); if (ehTexto && editandoTexto) recolorTextoEditando(c); }}
          aoCorPrevia={setCor} favoritos={favoritos}
          corBarra={corBarra} aoAbrirCorBarra={() => setCorBarraAberta(true)}
          aoInserirImagem={() => fileRef.current?.click()} aoCriarIa={() => setIaAberta(true)} aoAdesivos={() => setAdesivosAberto(true)}
          reguaLigada={regua !== null} aoRegua={alternarRegua}
          travada={travada} aoTravar={() => mudarTravada(!travada)}
          pos={posBarra} aoPos={mudarPosBarra} aoCiclar={ciclarBarra} miolo={mioloRef}
          dica={dicaBarra} aoFecharDica={fecharDicaBarra}
          aoDesfazer={() => andar(-1)} aoRefazer={() => andar(1)} podeDesfazer={podeDesfazer} podeRefazer={podeRefazer}
          aoNovaPagina={() => void adicionar()}
          subbarra={
            ferramenta === "forma" ? <SubFormas tipo={ajusteForma.tipo} aoMudar={(tipo) => mudarForma({ tipo })} />
            : ferramenta === "pincel" ? <SubPincel modelo={modeloPincel} cor={cor} ajuste={ajustes.pincel} aoMudar={mudarModeloPincel} />
            : ferramenta === "seta" ? <p className="caderno-subbarra-dica">{t.seta.ajuda}</p>
            : ferramenta === "borracha" ? <SubBorracha modo={modoBorracha} aoMudar={mudarModoBorracha} />
            : ehSelecao ? <SubSelecao acrescentar={acrescentar} aoAcrescentar={setAcrescentar} laco={ferramenta === "laco"} />
            : ehTexto ? (
              <>
                {!editandoTexto && <SubTextoPadrao tamanho={tamTexto} aoTamanho={mudarTamTexto} negrito={negritoTexto} aoNegrito={mudarNegritoTexto} nota={ferramenta === "nota"} />}
                <div ref={setSlotTexto} className="caderno-subbarra-slot" />
              </>
            ) : null
          }
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
          : ajustando === "forma" || ajustando === "seta"
          ? <AjustesForma ajuste={ajusteForma} seta={ajustando === "seta"} cor={cor} aoMudar={mudarForma} aoFechar={() => setAjustando(null)} />
          : ajustando === "borracha"
          ? <AjustesBorracha tamanho={ajustes.borracha.tamanho} modo={modoBorracha} aoModo={mudarModoBorracha} aoMudar={(n) => mudarAjuste("borracha", { tamanho: n })} aoFechar={() => setAjustando(null)} />
          : ajustando === "laco" || ajustando === "selecao"
          ? null
          : <AjustesFerramenta ferramenta={ajustando} ajuste={ajustes[ajustando]} modeloPincel={modeloPincel} aoMudar={(patch) => mudarAjuste(ajustando, patch)} aoFechar={() => setAjustando(null)} />)}
      </Janela>

      <Janela titulo={t.folha.titulo} aberta={editor} aoFechar={() => setEditor(false)}>
        {editor && <EditorFolha inicial={sel ? folhaDe(sel) : papelPadrao()} tamanho={sel?.tamanho ?? "a4"} total={paginas.length} atual={Math.max(1, paginas.findIndex((p) => p.id === selId) + 1)} aoAplicar={aplicarFolha} aoFechar={() => setEditor(false)} />}
      </Janela>

      <Janela titulo={t.config.titulo} aberta={configAberta} aoFechar={() => setConfigAberta(false)} pequena>
        <div className="formulario">
          <Interruptor rotulo={t.config.soCaneta} ligado={soCaneta} aoMudar={mudarSoCaneta} />
          <p className="campo-ajuda">{t.config.soCanetaAjuda}</p>
          <Interruptor rotulo={t.config.trava} ligado={travada} aoMudar={mudarTravada} />
          <p className="campo-ajuda">{t.config.travaAjuda}</p>
          <Segmentado rotulo={t.config.rolagem} valor={lateral ? "lateral" : "vertical"} aoMudar={(v) => mudarLateral(v === "lateral")}
            opcoes={[{ valor: "vertical", nome: t.config.rolagens.vertical }, { valor: "lateral", nome: t.config.rolagens.lateral }]} />
          <Segmentado rotulo={t.config.unidadeRegua} valor={unidadeRegua} aoMudar={(v) => mudarUnidadeRegua(v as UnidadeRegua)}
            opcoes={[{ valor: "cm", nome: t.regua.unidades.cm }, { valor: "mm", nome: t.regua.unidades.mm }]} />
          <Segmentado rotulo={t.config.borracha} valor={modoBorracha} aoMudar={(v) => mudarModoBorracha(v as ModoBorracha)}
            opcoes={[{ valor: "pedaco", nome: t.borracha.modos.pedaco }, { valor: "objeto", nome: t.borracha.modos.objeto }]} />
          <Segmentado rotulo={t.config.posBarra} valor={posBarra} aoMudar={(v) => mudarPosBarra(v as PosBarra)}
            opcoes={POS_BARRA.map((p) => ({ valor: p, nome: t.config.posicoes[p] }))} />
          <div className="campo">
            <span className="campo-rotulo">{t.config.zoom} <span className="texto-suave">{Math.round(zoom * 100)}%</span></span>
            <div className="botoes">
              <Button className="botao" onPress={() => setZoom((z) => limitarZoom(Math.round((z - 0.25) * 4) / 4))} aria-label={t.config.zoomMenos}>−</Button>
              <Button className="botao" onPress={() => setZoom(1)}>{t.config.zoomPadrao}</Button>
              <Button className="botao" onPress={() => setZoom((z) => limitarZoom(Math.round((z + 0.25) * 4) / 4))} aria-label={t.config.zoomMais}>+</Button>
            </div>
            <p className="campo-ajuda">{t.config.zoomAjuda}</p>
          </div>
          <div className="janela-acoes">
            <Button className="botao" onPress={() => { setConfigAberta(false); setCorBarraAberta(true); }}>{t.barraCor.abrir}</Button>
            <Button className="botao principal" onPress={() => setConfigAberta(false)}>{textos.comum.fechar}</Button>
          </div>
        </div>
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

function PaginaView({ id, pagina, numero, selecionada, podeApagar, cena, ferramenta, cor, ajuste, modeloPincel, forma, editandoTexto, selecionados, imagemUrl, dedoRola, soCaneta, multiToque, aoCaneta, zoom, alturaLateral, acrescentar, negritoTexto, slotTexto, aoTamTexto, regua, unidadeRegua, aoMudarRegua, aoUnidadeRegua, aoSelecionar, aoDesenhar, aoNovaForma, aoApagarParcial, aoApagarFim, aoNovoTexto, aoPatchTexto, aoFimTexto, aoApagarTexto, aoSelecionarTexto, aoSelecionarLaco, aoMoverSelecao, aoEscalarSelecao, aoRotacionarSelecao, aoOrdenarSelecao, aoNivelSelecao, aoAgrupar, aoDesagrupar, aoFimSelecao, aoApagarSelecao, aoEditarTexto, aoTitulo, aoMarcar, aoApagar }: {
  id: string; pagina: PaginaCaderno; numero: number; selecionada: boolean; podeApagar: boolean;
  cena: Cena; ferramenta: FerramentaUI; cor: string; ajuste: AjusteTraco; modeloPincel: ModeloPincel; forma: AjusteForma; editandoTexto: string; selecionados: string[]; imagemUrl: (id: string) => string | undefined;
  dedoRola: boolean; soCaneta: boolean; multiToque: React.RefObject<boolean>; aoCaneta: () => void;
  /** Zoom das páginas (1 = normal) e, na rolagem lateral, a altura da área. */
  zoom: number; alturaLateral: number; acrescentar: boolean;
  negritoTexto: boolean; slotTexto: HTMLElement | null; aoTamTexto: (n: number) => void;
  regua: Regua | null; unidadeRegua: UnidadeRegua; aoMudarRegua: (r: Regua) => void; aoUnidadeRegua: (u: UnidadeRegua) => void;
  aoSelecionar: () => void; aoDesenhar: (t: Traco) => void; aoNovaForma: (f: Forma) => void;
  aoApagarParcial: (x: number, y: number, raio: number) => void; aoApagarFim: () => void;
  aoNovoTexto: (x: number, y: number) => void; aoPatchTexto: (id: string, patch: Partial<Texto>) => void;
  aoMoverTexto: (id: string, x: number, y: number) => void; aoMoverFimTexto: () => void;
  aoFimTexto: (id: string) => void; aoApagarTexto: (id: string) => void; aoSelecionarTexto: (id: string) => void;
  aoSelecionarLaco: (ids: string[]) => void; aoMoverSelecao: (ids: string[], dx: number, dy: number) => void;
  aoEscalarSelecao: (ids: string[], ax: number, ay: number, fator: number) => void;
  aoRotacionarSelecao: (ids: string[], ax: number, ay: number, graus: number) => void; aoOrdenarSelecao: (frente: boolean) => void;
  aoNivelSelecao: (frente: boolean) => void; aoAgrupar: () => void; aoDesagrupar: () => void;
  aoFimSelecao: () => void; aoApagarSelecao: () => void; aoEditarTexto: (id: string) => void;
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
  // Largura do bloco: na rolagem vertical, a largura da área (com o zoom); na
  // lateral, a página cabe na altura da área (descontando o título).
  const largura = alturaLateral
    ? `${Math.round((Math.max(240, alturaLateral - 90) * med.largura / med.altura) * zoom)}px`
    : `calc(min(100%, 1500px) * ${zoom})`;
  const modoSel = ferramenta === "laco" ? "laco" : ferramenta === "selecao" ? "selecao" : null;
  return (
    <section id={id} className={selecionada ? "caderno-folha-bloco atual" : "caderno-folha-bloco"} style={{ width: largura }}>
      <div className="caderno-folha-topo">
        <span className="texto-suave pequeno">{t.paginas.numero(numero)}</span>
        <input className="entrada-texto sozinha caderno-folha-titulo" value={titulo} placeholder={t.paginas.semTitulo} onChange={(e) => setTitulo(e.target.value)} onBlur={() => titulo !== pagina.titulo && aoTitulo(titulo)} aria-label={t.paginas.tituloCampo} maxLength={80} />
        <Button className={pagina.marcado ? "botao-icone pequeno ativo" : "botao-icone pequeno"} onPress={aoMarcar} aria-label={pagina.marcado ? t.paginas.desmarcar : t.paginas.marcar} aria-pressed={pagina.marcado}><Bookmark aria-hidden="true" size="1em" /></Button>
        {podeApagar && <Button className="botao-icone pequeno" onPress={aoApagar} aria-label={t.paginas.excluir}><Trash2 aria-hidden="true" size="1em" /></Button>}
      </div>
      <div ref={areaRef} className={dedoRola ? "caderno-folha-area dedo-rola" : "caderno-folha-area"} style={{ aspectRatio: `${med.largura} / ${med.altura}` }}
        onPointerDownCapture={aoSelecionar} onContextMenu={(e) => e.preventDefault()}>
        <Folha papel={folhaDe(pagina)} tamanho={pagina.tamanho} className="caderno-folha caderno-folha-fundo" />
        <SuperficieDesenho cena={cena} ferramenta={ferramenta} cor={cor} ajuste={ajuste} modeloPincel={modeloPincel} forma={forma} regua={regua} largura={med.largura} altura={med.altura} imagemUrl={imagemUrl}
          dedoRola={dedoRola} soCaneta={soCaneta} multiToque={multiToque} aoCaneta={aoCaneta} aoDesenhar={aoDesenhar} aoNovaForma={aoNovaForma} aoApagarParcial={aoApagarParcial} aoApagarFim={aoApagarFim} />
        <CamadaTexto caixas={caixas} ativa={ferramenta === "texto" || ferramenta === "nota"} escala={escala} editandoId={editandoTexto}
          negritoPadrao={negritoTexto} slot={slotTexto} aoTamPadrao={aoTamTexto}
          aoNovo={aoNovoTexto} aoPatch={aoPatchTexto} aoFim={aoFimTexto} aoApagar={aoApagarTexto} aoSelecionar={aoSelecionarTexto} />
        <CamadaSelecao elementos={cena.elementos} selecionados={selecionados} modo={modoSel} acrescentar={acrescentar} escala={escala} largura={med.largura} altura={med.altura}
          aoSelecionar={aoSelecionarLaco} aoMover={aoMoverSelecao} aoEscalar={aoEscalarSelecao} aoRotacionar={aoRotacionarSelecao} aoOrdenar={aoOrdenarSelecao} aoNivel={aoNivelSelecao}
          aoAgrupar={aoAgrupar} aoDesagrupar={aoDesagrupar} aoFim={aoFimSelecao} aoApagar={aoApagarSelecao} aoEditarTexto={aoEditarTexto} />
        {regua && <CamadaRegua regua={regua} unidade={unidadeRegua} escala={escala} largura={med.largura} altura={med.altura} aoMudar={aoMudarRegua} aoUnidade={aoUnidadeRegua} />}
      </div>
    </section>
  );
}

/** A camada das caixas de texto, por cima do desenho. Só interage quando a
 *  ferramenta de texto está ativa; nas outras, fica só mostrando (sem toque).
 *  Tocar na área vazia abre um campo novo (ou, com um campo aberto, confirma). */
function CamadaTexto({ caixas, ativa, escala, editandoId, negritoPadrao, slot, aoTamPadrao, aoNovo, aoPatch, aoFim, aoApagar, aoSelecionar }: {
  caixas: Texto[]; ativa: boolean; escala: number; editandoId: string;
  negritoPadrao: boolean; slot: HTMLElement | null; aoTamPadrao: (n: number) => void;
  aoNovo: (x: number, y: number) => void; aoPatch: (id: string, patch: Partial<Texto>) => void;
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
          negritoPadrao={negritoPadrao} slot={slot} aoTamPadrao={aoTamPadrao}
          aoPatch={(patch) => aoPatch(tx.id, patch)} aoFim={() => aoFim(tx.id)} aoApagar={() => aoApagar(tx.id)} aoSelecionar={() => aoSelecionar(tx.id)} />
      ))}
    </div>
  );
}

/** Um texto na página. Pronto, é só o texto (sem caixa nem borda). Em edição,
 *  é um campo transparente com a fonte, o tamanho e a cor do próprio texto; os
 *  botões de formatação aparecem na barra de ferramentas. */
function CaixaTexto({ caixa: tx, escala, editando, ativa, negritoPadrao, slot, aoTamPadrao, aoPatch, aoFim, aoApagar, aoSelecionar }: {
  caixa: Texto; escala: number; editando: boolean; ativa: boolean;
  negritoPadrao: boolean; slot: HTMLElement | null; aoTamPadrao: (n: number) => void;
  aoPatch: (patch: Partial<Texto>) => void; aoFim: () => void; aoApagar: () => void; aoSelecionar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Mede o tamanho real (para a seleção abraçar o texto).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || escala <= 0) return;
    const medir = () => medidasTexto.set(tx.id, { l: el.offsetWidth / escala, a: el.offsetHeight / escala });
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tx.id, escala]);
  const ehNota = !!tx.fundo;
  const emEdicao = editando && ativa;
  // A caixa abraça o texto (largura automática), com um limite para quebrar a
  // linha. Em edição, um mínimo para caber o cursor.
  const estiloCaixa: React.CSSProperties = {
    left: tx.x * escala, top: tx.y * escala, width: "max-content",
    maxWidth: tx.largura * escala, minWidth: emEdicao ? Math.max(40, tx.tamanho * escala * 2.5) : undefined,
    ...(ehNota ? { background: tx.fundo, padding: `${7 * escala}px ${9 * escala}px`, borderRadius: `${5 * escala}px`, boxShadow: "0 2px 8px rgba(0, 0, 0, 0.18)" } : {}),
  };
  const estiloTexto: React.CSSProperties = { color: tx.cor, fontSize: `${tx.tamanho * escala}px`, fontFamily: fonteCss(tx.fonte), textAlign: ALINHAR_CSS[tx.alinhamento ?? "esquerda"] };
  const classeCaixa = ehNota ? "caderno-caixa nota" : "caderno-caixa";

  if (emEdicao) {
    return (
      <div ref={ref} className={`${classeCaixa} editando`} style={estiloCaixa}>
        <CaixaEditor tx={tx} estilo={estiloTexto} slot={slot} negritoPadrao={negritoPadrao} aoTamPadrao={aoTamPadrao} aoPatch={aoPatch} aoFim={aoFim} aoApagar={aoApagar} />
      </div>
    );
  }
  const miolo = textoVazio(tx.texto) ? `<span class="caderno-caixa-vazio">${t.texto.vazio}</span>` : tx.texto;
  return (
    <div ref={ref} className={classeCaixa} style={estiloCaixa}
      onPointerDown={ativa ? (e) => { e.stopPropagation(); e.preventDefault(); aoSelecionar(); } : undefined}>
      <div className="caderno-caixa-area" style={estiloTexto} dangerouslySetInnerHTML={{ __html: miolo }} />
    </div>
  );
}

/** O texto em edição: mini-editor (negrito/itálico/sublinhado por trecho). A
 *  formatação (fonte, tamanho, alinhamento, listas, ditado, revisão) vai para a
 *  barra de ferramentas, por um portal. Esc ou Ctrl+Enter confirmam. */
function CaixaEditor({ tx, estilo, slot, negritoPadrao, aoTamPadrao, aoPatch, aoFim, aoApagar }: {
  tx: Texto; estilo: React.CSSProperties; slot: HTMLElement | null; negritoPadrao: boolean; aoTamPadrao: (n: number) => void;
  aoPatch: (patch: Partial<Texto>) => void; aoFim: () => void; aoApagar: () => void;
}) {
  const vazioAoAbrir = useRef(textoVazio(tx.texto));
  const editor = useEditor({
    extensions: extensoesCaderno,
    content: tx.texto || "",
    autofocus: "end",
    editorProps: {
      attributes: { class: "caderno-caixa-area", "aria-label": t.texto.campo },
      handleKeyDown: (_v, ev) => {
        if (ev.key === "Escape" || (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey))) { ev.preventDefault(); aoFim(); return true; }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => aoPatch({ texto: e.getHTML() }),
  });
  // Texto novo com "negrito" ligado na barra: já começa em negrito.
  useEffect(() => {
    if (!editor || !vazioAoAbrir.current || !negritoPadrao) return;
    const id = setTimeout(() => editor.chain().focus("end").setBold().run(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);
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
  const mudarTam = (d: number) => { const n = Math.min(80, Math.max(12, tx.tamanho + d)); aoPatch({ tamanho: n }); aoTamPadrao(n); };
  const alinhoAtual = tx.alinhamento ?? "esquerda";
  const ciclarAlinho = () => aoPatch({ alinhamento: ALINHAR[(ALINHAR.indexOf(alinhoAtual) + 1) % ALINHAR.length] });
  const IconeAlinho = alinhoAtual === "centro" ? AlignCenter : alinhoAtual === "direita" ? AlignRight : AlignLeft;
  const nomeFonte = fonteAtual && fonteAtual in FONTES ? FONTES[fonteAtual as keyof typeof FONTES].nome : t.texto.fontePadrao;
  // Tocar nos botões não tira o cursor do texto.
  const segurarFoco = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();
  const controles = (
    <div className="caderno-fmt-barra" role="group" aria-label={t.texto.formatar} onPointerDown={segurarFoco} onMouseDown={segurarFoco}>
      <span className="caderno-fmt-grupo">
        <button type="button" className={marcas.b ? "caderno-fmt ativo" : "caderno-fmt"} onClick={() => editor.chain().focus().toggleBold().run()} aria-label={textos.rico.negrito} aria-pressed={marcas.b}><Bold size="1em" aria-hidden="true" /></button>
        <button type="button" className={marcas.i ? "caderno-fmt ativo" : "caderno-fmt"} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label={textos.rico.italico} aria-pressed={marcas.i}><Italic size="1em" aria-hidden="true" /></button>
        <button type="button" className={marcas.u ? "caderno-fmt ativo" : "caderno-fmt"} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label={textos.rico.sublinhado} aria-pressed={marcas.u}><Underline size="1em" aria-hidden="true" /></button>
      </span>
      <span className="caderno-fmt-grupo">
        <button type="button" className="caderno-fmt" onClick={() => mudarTam(-2)} aria-label={t.texto.diminuir}>A−</button>
        <span className="caderno-fmt-valor" aria-live="polite">{t.texto.tamanhoAtual(tx.tamanho)}</span>
        <button type="button" className="caderno-fmt" onClick={() => mudarTam(2)} aria-label={t.texto.aumentar}>A+</button>
      </span>
      <button type="button" className="caderno-fmt fonte" style={{ fontFamily: fonteCss(fonteAtual) }} onClick={ciclarFonte} aria-label={`${t.texto.fonte}: ${nomeFonte}`} title={nomeFonte}>Aa</button>
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
      <button type="button" className="caderno-fmt" onClick={aoApagar} aria-label={t.texto.apagar}><Trash2 size="1em" aria-hidden="true" /></button>
      <button type="button" className="caderno-fmt caderno-fmt-pronto" onClick={aoFim}>{t.texto.pronto}</button>
    </div>
  );
  return (
    <>
      {slot && createPortal(controles, slot)}
      <div style={estilo} className="caderno-caixa-editor"><EditorContent editor={editor} /></div>
      {ditado.situacao}
      {revisar.janelas}
    </>
  );
}

/** A camada da seleção, por cima de tudo. Dois jeitos de selecionar:
 *  - cursor ("selecao"): tocar num objeto seleciona; arrastar na área vazia faz
 *    um retângulo e seleciona o que fica inteiro dentro;
 *  - laço ("laco"): contorna à mão livre o que quer selecionar.
 *  Com Shift (ou "acrescentar" ligado), cada toque soma ou tira da seleção.
 *  Selecionado: arrastar move, os cantos redimensionam, a alça de cima gira. */
function CamadaSelecao({ elementos, selecionados, modo, acrescentar, escala, largura, altura, aoSelecionar, aoMover, aoEscalar, aoRotacionar, aoOrdenar, aoNivel, aoAgrupar, aoDesagrupar, aoFim, aoApagar, aoEditarTexto }: {
  elementos: Elemento[]; selecionados: string[]; modo: "laco" | "selecao" | null; acrescentar: boolean; escala: number; largura: number; altura: number;
  aoSelecionar: (ids: string[]) => void; aoMover: (ids: string[], dx: number, dy: number) => void;
  aoEscalar: (ids: string[], ax: number, ay: number, fator: number) => void;
  aoRotacionar: (ids: string[], ax: number, ay: number, graus: number) => void; aoOrdenar: (frente: boolean) => void;
  aoNivel: (frente: boolean) => void; aoAgrupar: () => void; aoDesagrupar: () => void;
  aoFim: () => void; aoApagar: () => void; aoEditarTexto: (id: string) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [laco, setLacoEstado] = useState<Ponto2[] | null>(null);
  const [retangulo, setRetanguloEstado] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // Espelhos em ref: o fim do gesto lê daqui (sem chamar o pai de dentro de um setState).
  const lacoRef = useRef<Ponto2[] | null>(null);
  const retRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const setLaco = (l: Ponto2[] | null) => { lacoRef.current = l; setLacoEstado(l); };
  const setRetangulo = (r: { x0: number; y0: number; x1: number; y1: number } | null) => { retRef.current = r; setRetanguloEstado(r); };
  const gesto = useRef<{ modo: "laco" | "retangulo" | "mover" | "escala" | "girar"; ids: string[]; somar: boolean; ax: number; ay: number; ux: number; uy: number; d0: number; fAplic: number } | null>(null);
  const ultimoToque = useRef<{ id: string; t: number } | null>(null);
  const ativa = modo !== null;

  const sel = elementos.filter((e) => selecionados.includes(e.id));
  const limReal = limitesDe(sel, MEDIDA.altura, MEDIDA.largura);
  // Uma folguinha em volta, para a borda tracejada não encostar no objeto.
  const folga = escala ? 5 / escala : 5;
  const lim = limReal ? { x: limReal.x - folga, y: limReal.y - folga, largura: limReal.largura + folga * 2, altura: limReal.altura + folga * 2 } : null;
  const centro: Ponto2 | null = lim ? [lim.x + lim.largura / 2, lim.y + lim.altura / 2] : null;
  const pGirar: Ponto2 | null = lim ? [lim.x + lim.largura / 2, lim.y - (escala ? 34 / escala : 34)] : null;

  const pt = (e: React.PointerEvent): Ponto2 => {
    const r = ref.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * largura, ((e.clientY - r.top) / r.height) * altura];
  };
  const raioAlca = escala ? 11 / escala : 11;
  const tolToque = escala ? 10 / escala : 10;
  const cantos = (): Ponto2[] => (lim ? [[lim.x, lim.y], [lim.x + lim.largura, lim.y], [lim.x + lim.largura, lim.y + lim.altura], [lim.x, lim.y + lim.altura]] : []);
  const dentroDaSelecao = (x: number, y: number) => !!lim && x >= lim.x && x <= lim.x + lim.largura && y >= lim.y && y <= lim.y + lim.altura;
  const comGrupo = (ids: string[]) => expandirGrupos(elementos, ids);
  const unir = (a: string[], b: string[]) => [...a, ...b.filter((id) => !a.includes(id))];
  const novoGesto = (modoG: "laco" | "retangulo" | "mover" | "escala" | "girar", x: number, y: number, extra: Partial<NonNullable<typeof gesto.current>> = {}) => {
    gesto.current = { modo: modoG, ids: selecionados, somar: false, ax: 0, ay: 0, ux: x, uy: y, d0: 0, fAplic: 1, ...extra };
  };

  const inicio = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    const [x, y] = pt(e);
    const somar = acrescentar || e.shiftKey;
    if (!somar && selecionados.length) {
      // Perto da alça de girar? Começa a rotação em torno do centro.
      if (pGirar && centro && (x - pGirar[0]) ** 2 + (y - pGirar[1]) ** 2 <= (raioAlca * 1.6) ** 2) {
        novoGesto("girar", x, y, { ax: centro[0], ay: centro[1], d0: Math.atan2(y - centro[1], x - centro[0]), fAplic: 0 });
        return;
      }
      // Perto de um canto? Então redimensiona em torno do canto oposto.
      const cs = cantos();
      for (let i = 0; i < cs.length; i++) {
        if ((x - cs[i][0]) ** 2 + (y - cs[i][1]) ** 2 <= (raioAlca * 1.5) ** 2) {
          const op = cs[(i + 2) % 4];
          novoGesto("escala", x, y, { ax: op[0], ay: op[1], d0: Math.hypot(x - op[0], y - op[1]) || 1 });
          return;
        }
      }
    }
    if (modo === "selecao") {
      const obj = objetoNoPonto(elementos, x, y, tolToque, MEDIDA);
      if (obj) {
        // Toque duplo num texto: abre para editar.
        const agora = Date.now();
        if (obj.tipo === "texto" && !somar && ultimoToque.current?.id === obj.id && agora - ultimoToque.current.t < 450) {
          ultimoToque.current = null;
          gesto.current = null;
          aoEditarTexto(obj.id);
          return;
        }
        ultimoToque.current = { id: obj.id, t: agora };
        const doObj = comGrupo([obj.id]);
        if (somar) {
          // Soma ou tira da seleção (com o grupo inteiro).
          aoSelecionar(selecionados.includes(obj.id) ? selecionados.filter((id) => !doObj.includes(id)) : unir(selecionados, doObj));
          gesto.current = null;
          return;
        }
        const ids = selecionados.includes(obj.id) ? selecionados : doObj;
        if (!selecionados.includes(obj.id)) aoSelecionar(ids);
        novoGesto("mover", x, y, { ids }); // já dá para arrastar no mesmo toque
        return;
      }
      if (!somar && dentroDaSelecao(x, y)) { novoGesto("mover", x, y); return; }
      novoGesto("retangulo", x, y, { somar });
      setRetangulo({ x0: x, y0: y, x1: x, y1: y });
      return;
    }
    // Laço: dentro da seleção move; senão, começa um laço novo.
    if (!somar && dentroDaSelecao(x, y)) novoGesto("mover", x, y);
    else {
      novoGesto("laco", x, y, { somar });
      setLaco([[x, y]]);
    }
  };
  const mover = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g) return;
    const [x, y] = pt(e);
    if (g.modo === "laco") { const l = lacoRef.current; if (l) setLaco([...l, [x, y]]); }
    else if (g.modo === "retangulo") { const r = retRef.current; if (r) setRetangulo({ ...r, x1: x, y1: y }); }
    else if (g.modo === "mover") { aoMover(g.ids, x - g.ux, y - g.uy); g.ux = x; g.uy = y; }
    else if (g.modo === "girar") {
      const ang = Math.atan2(y - g.ay, x - g.ax);
      aoRotacionar(g.ids, g.ax, g.ay, ((ang - g.d0) * 180) / Math.PI);
      g.d0 = ang;
    } else {
      const fTotal = Math.max(0.1, Math.hypot(x - g.ax, y - g.ay) / g.d0);
      aoEscalar(g.ids, g.ax, g.ay, fTotal / g.fAplic);
      g.fAplic = fTotal;
    }
  };
  const fim = () => {
    const g = gesto.current;
    gesto.current = null;
    if (!g) return;
    if (g.modo === "retangulo") {
      const r = retRef.current;
      setRetangulo(null);
      if (r) {
        const x = Math.min(r.x0, r.x1), y = Math.min(r.y0, r.y1), w = Math.abs(r.x1 - r.x0), h = Math.abs(r.y1 - r.y0);
        if (w < tolToque / 2 && h < tolToque / 2) aoSelecionar(g.somar ? selecionados : []); // toque no vazio: solta
        else {
          const ids = comGrupo(idsNoRetangulo(elementos, { x, y, largura: w, altura: h }, MEDIDA));
          aoSelecionar(g.somar ? unir(selecionados, ids) : ids);
        }
      }
    } else if (g.modo === "laco") {
      const l = lacoRef.current;
      setLaco(null);
      {
        let ids: string[] = [];
        if (l && l.length >= 3) {
          ids = elementos.filter((el) => elementoDentro(el, l, MEDIDA.altura, MEDIDA.largura)).map((el) => el.id);
          // Nada ficou inteiro dentro: "pega" o objeto sob o centro do laço
          // (útil para imagens grandes, difíceis de contornar inteiras).
          if (!ids.length) {
            const cx = l.reduce((s, p) => s + p[0], 0) / l.length;
            const cy = l.reduce((s, p) => s + p[1], 0) / l.length;
            const sob = objetoNoPonto(elementos, cx, cy, tolToque, MEDIDA);
            if (sob) ids = [sob.id];
          }
        } else {
          // Toque simples: seleciona o objeto que está embaixo do dedo.
          const tap = l && l.length ? l[l.length - 1] : null;
          const sob = tap ? objetoNoPonto(elementos, tap[0], tap[1], tolToque, MEDIDA) : undefined;
          if (sob) ids = [sob.id];
        }
        ids = comGrupo(ids);
        aoSelecionar(g.somar ? unir(selecionados, ids) : ids);
      }
    } else {
      aoFim();
    }
  };

  const dLaco = laco && laco.length ? `M ${laco.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")} Z` : "";
  // Botões da seleção: embaixo da caixa (ou em cima, se não couber).
  let acoes: React.CSSProperties | null = null;
  if (ativa && lim && escala) {
    const meioX = Math.min(Math.max((lim.x + lim.largura / 2) * escala, 150), largura * escala - 150);
    const embaixo = (lim.y + lim.altura) * escala + 10;
    acoes = embaixo < altura * escala - 48 ? { left: meioX, top: embaixo } : { left: meioX, top: Math.max(4, lim.y * escala - 90) };
  }
  const podeAgrupar = selecionados.length > 1 && new Set(sel.map((e) => e.grupo ?? e.id)).size > 1;
  const podeDesagrupar = temGrupo(elementos, selecionados);
  return (
    <div className={ativa ? "caderno-selecao ativa" : "caderno-selecao"}>
      <svg ref={ref} className="caderno-selecao-svg" viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none"
        onPointerDown={ativa ? inicio : undefined} onPointerMove={ativa ? mover : undefined} onPointerUp={ativa ? fim : undefined} onPointerCancel={ativa ? fim : undefined}>
        {laco && <path d={dLaco} className="caderno-laco" vectorEffect="non-scaling-stroke" />}
        {retangulo && (
          <rect x={Math.min(retangulo.x0, retangulo.x1)} y={Math.min(retangulo.y0, retangulo.y1)} width={Math.abs(retangulo.x1 - retangulo.x0)} height={Math.abs(retangulo.y1 - retangulo.y0)} className="caderno-laco" vectorEffect="non-scaling-stroke" />
        )}
        {lim && ativa && (
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
      {acoes && (
        <div className="caderno-sel-acoes" style={acoes} role="toolbar" aria-label={t.selecao.acoes}>
          <button type="button" className="botao-icone pequeno" onClick={() => aoOrdenar(true)} aria-label={t.laco.paraFrente} title={t.laco.paraFrente}><IconeTudoFrente size="1em" aria-hidden="true" /></button>
          <button type="button" className="botao-icone pequeno" onClick={() => aoNivel(true)} aria-label={t.selecao.umNivelFrente} title={t.selecao.umNivelFrente}><IconeNivelFrente size="1em" aria-hidden="true" /></button>
          <button type="button" className="botao-icone pequeno" onClick={() => aoNivel(false)} aria-label={t.selecao.umNivelTras} title={t.selecao.umNivelTras}><IconeNivelTras size="1em" aria-hidden="true" /></button>
          <button type="button" className="botao-icone pequeno" onClick={() => aoOrdenar(false)} aria-label={t.laco.paraTras} title={t.laco.paraTras}><IconeTudoTras size="1em" aria-hidden="true" /></button>
          {podeAgrupar && <button type="button" className="botao-icone pequeno" onClick={aoAgrupar} aria-label={t.selecao.agrupar} title={t.selecao.agrupar}><IconeAgrupar size="1em" aria-hidden="true" /></button>}
          {podeDesagrupar && <button type="button" className="botao-icone pequeno" onClick={aoDesagrupar} aria-label={t.selecao.desagrupar} title={t.selecao.desagrupar}><IconeDesagrupar size="1em" aria-hidden="true" /></button>}
          <button type="button" className="botao-icone pequeno" onClick={aoApagar} aria-label={t.laco.apagar} title={t.laco.apagar}><Trash2 size="1em" aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}

/** Ângulo da régua como a pessoa lê (0° deitada, 90° em pé, sentido anti-horário). */
const grausDaRegua = (r: Regua) => {
  const g = Math.round((-Math.atan2(r.y2 - r.y1, r.x2 - r.x1) * 180) / Math.PI);
  return ((g % 360) + 360) % 360;
};
/** Gira a régua para `graus`, em torno do meio, mantendo o comprimento. */
function reguaNoAngulo(r: Regua, graus: number): Regua {
  const mx = (r.x1 + r.x2) / 2, my = (r.y1 + r.y2) / 2;
  const meio = Math.hypot(r.x2 - r.x1, r.y2 - r.y1) / 2;
  const a = (-graus * Math.PI) / 180;
  return { ...r, x1: mx - Math.cos(a) * meio, y1: my - Math.sin(a) * meio, x2: mx + Math.cos(a) * meio, y2: my + Math.sin(a) * meio };
}

/** A régua: uma guia translúcida com traços e números (em cm ou mm) que a
 *  pessoa arrasta e gira. Desenhar perto da borda de cima faz o traço sair reto
 *  (o encaixe fica na SuperficieDesenho). Mostra o ângulo, que também dá para
 *  digitar; ao girar pelas pontas, gruda de 15° em 15°. */
function CamadaRegua({ regua, unidade, escala, largura, altura, aoMudar, aoUnidade }: {
  regua: Regua; unidade: UnidadeRegua; escala: number; largura: number; altura: number; aoMudar: (r: Regua) => void; aoUnidade: (u: UnidadeRegua) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const gesto = useRef<{ modo: "mover" | "a" | "b"; ux: number; uy: number } | null>(null);
  const [rascunho, setRascunho] = useState<string | null>(null);
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
  // Gira pela ponta, grudando nos múltiplos de 15° (0°, 45°, 90°…) quando perto.
  const pontaComIma = (fx: number, fy: number, x: number, y: number): [number, number] => {
    const ang = Math.atan2(y - fy, x - fx), comp = Math.hypot(x - fx, y - fy);
    const passo = Math.PI / 12;
    const perto = Math.round(ang / passo) * passo;
    if (Math.abs(ang - perto) > (2 * Math.PI) / 180) return [x, y];
    return [fx + Math.cos(perto) * comp, fy + Math.sin(perto) * comp];
  };
  const mover = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g) return;
    const [x, y] = pt(e);
    if (g.modo === "mover") { const dx = x - g.ux, dy = y - g.uy; aoMudar({ ...regua, x1: regua.x1 + dx, y1: regua.y1 + dy, x2: regua.x2 + dx, y2: regua.y2 + dy }); g.ux = x; g.uy = y; }
    else if (g.modo === "a") { const [nx, ny] = pontaComIma(regua.x2, regua.y2, x, y); aoMudar({ ...regua, x1: nx, y1: ny }); }
    else { const [nx, ny] = pontaComIma(regua.x1, regua.y1, x, y); aoMudar({ ...regua, x2: nx, y2: ny }); }
  };
  const fim = () => { gesto.current = null; };
  const raio = escala ? 12 / escala : 12;

  // Geometria: comprimento, ângulo e corpo da régua (uma faixa de largura L).
  const dx = regua.x2 - regua.x1, dy = regua.y2 - regua.y1;
  const comp = Math.hypot(dx, dy) || 1;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const L = 58; // largura da faixa (px de referência)
  const op = regua.op ?? 0.5;
  const graus = grausDaRegua(regua);
  // Traços: a cada 1 mm um risco curtinho, a cada 0,5 cm médio, a cada 1 cm
  // longo + número (em cm ou em mm). Fica igual a uma régua de verdade.
  const passoMm = PX_CM / 10;
  const marcas: React.ReactNode[] = [];
  for (let i = 0, x = 0; x <= comp + 0.1; i++, x = i * passoMm) {
    const cm = i % 10 === 0, meio = i % 5 === 0;
    const h = cm ? 17 : meio ? 11 : 6;
    marcas.push(<line key={`m${i}`} x1={x} y1={0} x2={x} y2={h} className="caderno-regua-traco" vectorEffect="non-scaling-stroke" />);
    if (cm && i > 0) marcas.push(<text key={`t${i}`} x={x} y={30} className="caderno-regua-num" textAnchor="middle">{unidade === "mm" ? i : i / 10}</text>);
  }

  // Posição dos controles: meio da régua, deslocado para o lado do corpo.
  const mx = (regua.x1 + regua.x2) / 2, my = (regua.y1 + regua.y2) / 2;
  const nx = -dy / comp, ny = dx / comp; // perpendicular (lado do corpo)
  const cx = (mx + nx * (L + 22)) * escala, cy = (my + ny * (L + 22)) * escala;
  const confirmarAngulo = () => {
    if (rascunho === null) return;
    const n = Number(rascunho.replace(",", "."));
    if (rascunho.trim() !== "" && Number.isFinite(n)) aoMudar(reguaNoAngulo(regua, ((n % 360) + 360) % 360));
    setRascunho(null);
  };

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
      <div className="caderno-regua-opac" style={{ left: cx, top: cy }}>
        <label className="caderno-regua-angulo" title={t.regua.angulo}>
          <input type="text" inputMode="numeric" value={rascunho ?? String(graus)} aria-label={t.regua.angulo}
            onChange={(e) => setRascunho(e.target.value.replace(/[^\d.,-]/g, "").slice(0, 6))}
            onBlur={confirmarAngulo}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); confirmarAngulo(); }
              else if (e.key === "Escape") setRascunho(null);
              else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); aoMudar(reguaNoAngulo(regua, graus + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 15 : 1))); }
            }} />
          <span aria-hidden="true">°</span>
        </label>
        <button type="button" className="caderno-regua-unidade" onClick={() => aoUnidade(unidade === "cm" ? "mm" : "cm")} aria-label={t.regua.trocarUnidade(t.regua.unidades[unidade])} title={t.regua.trocarUnidade(t.regua.unidades[unidade])}>{unidade}</button>
        <Ruler aria-hidden="true" size="0.9em" />
        <input type="range" min={0.15} max={0.85} step={0.05} value={op} aria-label={t.regua.opacidade} title={t.regua.opacidade}
          onChange={(e) => aoMudar({ ...regua, op: Number(e.target.value) })} />
      </div>
    </div>
  );
}

/** A camada onde a pessoa escreve/desenha, por cima da folha. */
/** Desenha um traço com as camadas do motor (pincel redondo, giz, spray,
 *  aquarela, lápis...). A opacidade do traço vale para o grupo inteiro: assim
 *  as camadas de um traço se combinam, e traços diferentes se acumulam. */
const TracoSvg = memo(function TracoSvg({ traco }: { traco: Traco }) {
  const camadas = desenhoDeTraco(traco);
  const op = traco.opacidade ?? FERRAMENTAS[traco.ferramenta]?.opacidade ?? 1;
  if (camadas.length === 1 && camadas[0].modo === "preencher" && !camadas[0].parImpar && camadas[0].opacidade === 1) {
    return <path d={camadas[0].d} fill={traco.cor} opacity={op} />;
  }
  return (
    <g opacity={op}>
      {camadas.map((c, i) => (c.modo === "preencher"
        ? <path key={i} d={c.d} fill={traco.cor} fillRule={c.parImpar ? "evenodd" : undefined} opacity={c.opacidade} />
        : <path key={i} d={c.d} fill="none" stroke={traco.cor} strokeWidth={c.largura} strokeLinecap="round" strokeLinejoin="round" opacity={c.opacidade} />))}
    </g>
  );
});

function SuperficieDesenho({ cena, ferramenta, cor, ajuste, modeloPincel, forma, regua, largura, altura, imagemUrl, dedoRola, soCaneta, multiToque, aoCaneta, aoDesenhar, aoNovaForma, aoApagarParcial, aoApagarFim }: {
  cena: Cena; ferramenta: FerramentaUI; cor: string; ajuste: AjusteTraco; modeloPincel: ModeloPincel; forma: AjusteForma; regua: Regua | null; largura: number; altura: number;
  imagemUrl: (id: string) => string | undefined;
  /** iPad com "só caneta": o navegador rola a página com o dedo. */
  dedoRola: boolean;
  /** "Escrever só com a caneta": o dedo nunca risca (só caneta e mouse). */
  soCaneta: boolean;
  /** Dois dedos ou mais na tela (pinça): ninguém desenha. */
  multiToque: React.RefObject<boolean>;
  aoCaneta: () => void;
  aoDesenhar: (t: Traco) => void; aoNovaForma: (f: Forma) => void;
  aoApagarParcial: (x: number, y: number, raio: number) => void; aoApagarFim: () => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [vivo, setVivoEstado] = useState<Traco | null>(null);
  const [formaViva, setFormaVivaEstado] = useState<Forma | null>(null);
  // Espelhos em ref: o fim do gesto lê daqui (sem chamar o pai de dentro de um setState).
  const vivoRef = useRef<Traco | null>(null);
  const formaRef = useRef<Forma | null>(null);
  const setVivo = (v: Traco | null) => { vivoRef.current = v; setVivoEstado(v); };
  const setFormaViva = (f: Forma | null) => { formaRef.current = f; setFormaVivaEstado(f); };
  const [apagador, setApagador] = useState<{ x: number; y: number } | null>(null);
  const desenhando = useRef(false);
  const apagouAlgo = useRef(false);
  const naRegua = useRef(false);
  const comCaneta = useRef(false);
  const pressaoAnterior = useRef(0.5);
  const toques = useRef(new Set<number>());
  const raioApagador = Math.max(4, ajuste.tamanho / 2);
  const comRegua = (p: Ponto) => (naRegua.current && regua ? { ...p, ...projetarNaRegua(p.x, p.y, regua) } : p);
  const ehSeta = ferramenta === "seta";
  const ehForma = ferramenta === "forma" || ehSeta;

  // Ponto em px de referência, com a pressão. Só a caneta tem pressão de
  // verdade (Apple Pencil: 0..1); mouse (0,5 fixo) e dedo (0 ou 1) ficam com
  // espessura fixa. A pressão é suavizada entre pontos, para não "tremer".
  const ponto = (e: { clientX: number; clientY: number; pressure: number }): Ponto => {
    const r = ref.current!.getBoundingClientRect();
    let p = 0.5;
    if (comCaneta.current) {
      const bruta = e.pressure > 0 ? e.pressure : pressaoAnterior.current;
      p = pressaoAnterior.current + (bruta - pressaoAnterior.current) * 0.35;
      pressaoAnterior.current = p;
    }
    return { x: ((e.clientX - r.left) / r.width) * largura, y: ((e.clientY - r.top) / r.height) * altura, p };
  };
  // Com o dedo rolando, a caneta não pode rolar junto: no Safari, cancelar o
  // toque da Apple Pencil (touchType "stylus") segura a página parada.
  useEffect(() => {
    const el = ref.current;
    if (!el || !dedoRola) return;
    const segurar = (ev: TouchEvent) => {
      if ([...ev.changedTouches].some((tq) => (tq as Touch & { touchType?: string }).touchType === "stylus")) ev.preventDefault();
    };
    el.addEventListener("touchstart", segurar, { passive: false });
    el.addEventListener("touchmove", segurar, { passive: false });
    return () => { el.removeEventListener("touchstart", segurar); el.removeEventListener("touchmove", segurar); };
  }, [dedoRola]);

  // Desiste do que está sendo desenhado (ex.: entrou o segundo dedo da pinça).
  const cancelar = () => {
    if (!desenhando.current) return;
    desenhando.current = false;
    naRegua.current = false;
    setVivo(null);
    setFormaViva(null);
    if (ferramenta === "borracha") { setApagador(null); if (apagouAlgo.current) aoApagarFim(); }
  };
  // Objeto sob a ponta da seta (para prendê-la). Setas não servem de alvo.
  const alvoDaSeta = (x: number, y: number) =>
    objetoNoPonto(cena.elementos.filter((el) => !(el.tipo === "forma" && el.forma === "seta")), x, y, 6, MEDIDA)?.id;

  const inicio = (e: React.PointerEvent) => {
    if (ferramenta === "texto" || ferramenta === "nota" || ferramenta === "laco" || ferramenta === "selecao") return; // tratados nas camadas por cima
    if (e.pointerType === "pen") aoCaneta();
    if (e.pointerType === "touch") {
      toques.current.add(e.pointerId);
      // Dedo não risca com "só caneta"; dois dedos (pinça) nunca riscam.
      if (soCaneta || toques.current.size > 1 || multiToque.current) { cancelar(); return; }
    }
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    desenhando.current = true;
    comCaneta.current = e.pointerType === "pen";
    pressaoAnterior.current = e.pressure > 0 ? e.pressure : 0.5;
    const pt = ponto(e);
    if (ferramenta === "borracha") { apagouAlgo.current = false; setApagador({ x: pt.x, y: pt.y }); aoApagarParcial(pt.x, pt.y, raioApagador); apagouAlgo.current = true; }
    else if (ehForma) {
      const nova: Forma = { tipo: "forma", id: crypto.randomUUID(), forma: ehSeta ? "seta" : forma.tipo, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, cor, espessura: forma.espessura };
      if (ehSeta) { const alvo = alvoDaSeta(pt.x, pt.y); if (alvo) nova.ligaInicio = alvo; }
      setFormaViva(nova);
    } else {
      naRegua.current = regua != null && distDaRegua(pt.x, pt.y, regua) <= LIMIAR_REGUA;
      // pressao: true → a espessura segue a pressão gravada (fixa para mouse e dedo).
      const novo: Traco = { tipo: "traco", id: crypto.randomUUID(), ferramenta: ferramenta as Ferramenta, cor, espessura: Math.round(ajuste.tamanho), afinar: ajuste.afinar, alisar: ajuste.alisar, opacidade: ajuste.opacidade, pressao: true, pontos: [comRegua(pt)] };
      // Pincel com modelo (giz, spray...): guarda o modelo e a semente das texturas.
      if (ferramenta === "pincel" && modeloPincel !== "redondo") { novo.pincel = modeloPincel; novo.semente = novaSemente(); }
      setVivo(novo);
    }
  };
  const mover = (e: React.PointerEvent) => {
    if (!desenhando.current) return;
    if (e.pointerType === "touch" && (toques.current.size > 1 || multiToque.current)) { cancelar(); return; }
    if (ferramenta === "borracha") { const pt = ponto(e); setApagador({ x: pt.x, y: pt.y }); aoApagarParcial(pt.x, pt.y, raioApagador); }
    else if (ehForma) { const pt = ponto(e); const v = formaRef.current; if (v) setFormaViva({ ...v, x2: pt.x, y2: pt.y }); }
    else {
      // Todos os pontos que a caneta mandou desde o último quadro (mais suave no iPad).
      const nativo = e.nativeEvent as PointerEvent;
      const lista = typeof nativo.getCoalescedEvents === "function" ? nativo.getCoalescedEvents() : [];
      const pts = (lista.length ? lista : [nativo]).map((ev) => comRegua(ponto(ev)));
      const v = vivoRef.current;
      if (v) setVivo({ ...v, pontos: [...v.pontos, ...pts] });
    }
  };
  const fim = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") toques.current.delete(e.pointerId);
    if (!desenhando.current) return;
    desenhando.current = false;
    if (ferramenta === "borracha") {
      setApagador(null);
      if (apagouAlgo.current) aoApagarFim();
    } else if (ehForma) {
      const v = formaRef.current;
      setFormaViva(null);
      if (v && (Math.abs(v.x2 - v.x1) > 3 || Math.abs(v.y2 - v.y1) > 3)) {
        const nova = { ...v };
        if (ehSeta) { const alvo = alvoDaSeta(v.x2, v.y2); if (alvo && alvo !== v.ligaInicio) nova.ligaFim = alvo; }
        aoNovaForma(nova);
      }
    } else {
      naRegua.current = false;
      const v = vivoRef.current;
      setVivo(null);
      if (v && v.pontos.length) aoDesenhar(v);
    }
  };

  const semToque = ferramenta === "texto" || ferramenta === "nota" || ferramenta === "laco" || ferramenta === "selecao";
  const classe = (semToque ? "caderno-desenho sem-toque" : ferramenta === "borracha" ? "caderno-desenho borracha" : "caderno-desenho") + (dedoRola ? " dedo-rola" : "");
  // Os traços já gravados só são recalculados quando a cena muda. Antes, trocar
  // a cor refazia o contorno de todos os traços de todas as páginas — no iPad
  // isso travava a tela e a cor escolhida demorava a aparecer marcada.
  const gravados = useMemo(() => cena.elementos.map((el) => {
        if (el.tipo === "traco") return <TracoSvg key={el.id} traco={el} />;
        if (el.tipo === "forma") return <path key={el.id} d={caminhoDeForma(el)} fill="none" stroke={el.cor} strokeWidth={el.espessura} strokeLinecap="round" strokeLinejoin="round" />;
        if (el.tipo === "imagem") {
          const u = imagemUrl(el.anexoId);
          if (!u) return null;
          const giro = el.rot ? `rotate(${el.rot} ${el.x + el.largura / 2} ${el.y + el.altura / 2})` : undefined;
          return <image key={el.id} href={u} x={el.x} y={el.y} width={el.largura} height={el.altura} preserveAspectRatio="none" transform={giro} />;
        }
        return null;
      }), [cena.elementos, imagemUrl]);
  return (
    <svg ref={ref} className={classe} viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none"
      onPointerDown={inicio} onPointerMove={mover} onPointerUp={fim} onPointerCancel={fim}>
      {gravados}
      {vivo && <TracoSvg traco={vivo} />}
      {formaViva && <path d={caminhoDeForma(formaViva)} fill="none" stroke={formaViva.cor} strokeWidth={formaViva.espessura} strokeLinecap="round" strokeLinejoin="round" />}
      {apagador && <circle cx={apagador.x} cy={apagador.y} r={raioApagador} className="caderno-apagador" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

type IconeUI = React.ComponentType<{ size?: string; "aria-hidden"?: "true" }>;
const FERRAMENTAS_UI: { id: FerramentaUI; icone: IconeUI }[] = [
  { id: "selecao", icone: IconeCursor }, { id: "caneta", icone: PenLine }, { id: "lapis", icone: Pencil }, { id: "pincel", icone: Wand2 }, { id: "marcatexto", icone: Highlighter },
  { id: "borracha", icone: Eraser }, { id: "texto", icone: Type }, { id: "nota", icone: StickyNote }, { id: "forma", icone: Shapes }, { id: "seta", icone: IconeSeta }, { id: "laco", icone: Lasso },
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

/** Formas na barra (aparece com a ferramenta de formas ativa). */
function SubFormas({ tipo, aoMudar }: { tipo: TipoForma; aoMudar: (t: TipoForma) => void }) {
  return (
    <span className="caderno-barra-grupo" role="group" aria-label={t.forma.qual}>
      {FORMAS_BARRA.map((f) => {
        const Icone = ICONES_FORMA[f];
        return (
          <button key={f} type="button" className={tipo === f ? "caderno-sub-botao ativo" : "caderno-sub-botao"} onClick={() => aoMudar(f)} aria-pressed={tipo === f} aria-label={t.forma.nomes[f]} title={t.forma.nomes[f]}>
            <Icone size="1.15em" aria-hidden="true" />
          </button>
        );
      })}
    </span>
  );
}

/** Modo da borracha na barra (aparece com a borracha ativa). */
function SubBorracha({ modo, aoMudar }: { modo: ModoBorracha; aoMudar: (m: ModoBorracha) => void }) {
  return (
    <span className="caderno-barra-grupo" role="group" aria-label={t.borracha.modo}>
      {(["pedaco", "objeto"] as const).map((m) => (
        <button key={m} type="button" className={modo === m ? "caderno-sub-botao texto ativo" : "caderno-sub-botao texto"} onClick={() => aoMudar(m)} aria-pressed={modo === m}>{t.borracha.modos[m]}</button>
      ))}
    </span>
  );
}

/** Opções da seleção (cursor e laço): "acrescentar" é o Shift do toque. */
function SubSelecao({ acrescentar, aoAcrescentar, laco }: { acrescentar: boolean; aoAcrescentar: (v: boolean) => void; laco: boolean }) {
  return (
    <>
      <button type="button" className={acrescentar ? "caderno-sub-botao texto ativo" : "caderno-sub-botao texto"} onClick={() => aoAcrescentar(!acrescentar)} aria-pressed={acrescentar}>
        <Plus size="1em" aria-hidden="true" /> {t.selecao.acrescentar}
      </button>
      <p className="caderno-subbarra-dica">{laco ? t.laco.dicaCurta : t.selecao.dica}</p>
    </>
  );
}

/** Texto sem caixa aberta: tamanho e negrito das próximas caixas. */
function SubTextoPadrao({ tamanho, aoTamanho, negrito, aoNegrito, nota }: { tamanho: number; aoTamanho: (n: number) => void; negrito: boolean; aoNegrito: (v: boolean) => void; nota: boolean }) {
  return (
    <>
      <span className="caderno-fmt-barra" role="group" aria-label={t.texto.formatar}>
        <button type="button" className={negrito ? "caderno-fmt ativo" : "caderno-fmt"} onClick={() => aoNegrito(!negrito)} aria-pressed={negrito} aria-label={textos.rico.negrito}><Bold size="1em" aria-hidden="true" /></button>
        <span className="caderno-fmt-grupo">
          <button type="button" className="caderno-fmt" onClick={() => aoTamanho(Math.max(12, tamanho - 2))} aria-label={t.texto.diminuir}>A−</button>
          <span className="caderno-fmt-valor" aria-live="polite">{t.texto.tamanhoAtual(tamanho)}</span>
          <button type="button" className="caderno-fmt" onClick={() => aoTamanho(Math.min(80, tamanho + 2))} aria-label={t.texto.aumentar}>A+</button>
        </span>
      </span>
      <p className="caderno-subbarra-dica">{nota ? t.texto.dicaNota : t.texto.dica}</p>
    </>
  );
}

/** Ferramentas com painel de opções ao lado da barra (marcadas com ▸). As
 *  outras (caneta, lápis, marca-texto) abrem os ajustes ao tocar de novo. */
const COM_PAINEL: FerramentaUI[] = ["pincel", "borracha", "texto", "nota", "forma", "seta", "laco", "selecao"];
const SEM_AJUSTES: FerramentaUI[] = ["laco", "selecao"];

/** Modelos do pincel, cada um com a sua prévia (na cor e no tamanho atuais). */
function SubPincel({ modelo, cor, ajuste, aoMudar }: { modelo: ModeloPincel; cor: string; ajuste: AjusteTraco; aoMudar: (m: ModeloPincel) => void }) {
  const corValida = /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#1f2937";
  return (
    <div className="caderno-pinceis" role="radiogroup" aria-label={t.pincel.modelo}>
      {MODELOS_PINCEL.map((m) => {
        const amostra: Traco = {
          tipo: "traco", id: `amostra-${m}`, ferramenta: "pincel", cor: corValida, espessura: Math.max(5, Math.min(12, Math.round(ajuste.tamanho))),
          afinar: ajuste.afinar, alisar: ajuste.alisar, opacidade: 1, pressao: true, pontos: PONTOS_AMOSTRA,
          ...(m !== "redondo" ? { pincel: m, semente: 2024 } : {}),
        };
        return (
          <button key={m} type="button" role="radio" aria-checked={modelo === m} className={modelo === m ? "caderno-pincel ativo" : "caderno-pincel"} onClick={() => aoMudar(m)}>
            <svg viewBox="0 0 300 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><TracoSvg traco={amostra} /></svg>
            <span>{t.pincel.modelos[m]}</span>
          </button>
        );
      })}
    </div>
  );
}

function BarraFerramentas({ ferramenta, aoFerramenta, aoAjustar, painelAberto, aoPainel, cor, aoCor, aoCorPrevia, favoritos, corBarra, aoAbrirCorBarra, aoInserirImagem, aoCriarIa, aoAdesivos, reguaLigada, aoRegua, travada, aoTravar, pos, aoPos, aoCiclar, miolo, dica, aoFecharDica, aoDesfazer, aoRefazer, podeDesfazer, podeRefazer, aoNovaPagina, subbarra }: {
  ferramenta: FerramentaUI; aoFerramenta: (f: FerramentaUI) => void; aoAjustar: (f: FerramentaUI) => void;
  painelAberto: boolean; aoPainel: (v: boolean) => void;
  /** aoCor: escolha final (entra nas favoritas); aoCorPrevia: só mostra a cor
   *  enquanto a pessoa ainda mexe no seletor personalizado. */
  cor: string; aoCor: (c: string) => void; aoCorPrevia: (c: string) => void; favoritos: string[];
  corBarra: string; aoAbrirCorBarra: () => void; aoInserirImagem: () => void; aoCriarIa: () => void; aoAdesivos: () => void;
  reguaLigada: boolean; aoRegua: () => void;
  travada: boolean; aoTravar: () => void;
  /** Lado da tela onde a barra fica; arrastar pela alça muda o lado. */
  pos: PosBarra; aoPos: (p: PosBarra) => void; aoCiclar: () => void; miolo: React.RefObject<HTMLDivElement | null>;
  dica: boolean; aoFecharDica: () => void;
  aoDesfazer: () => void; aoRefazer: () => void; podeDesfazer: boolean; podeRefazer: boolean;
  aoNovaPagina: () => void;
  /** Opções da ferramenta ativa (formas, pincéis, borracha, texto…): vão num painel ao lado da barra. */
  subbarra: React.ReactNode;
}) {
  // Seletor personalizado: enquanto arrasta, só pré-visualiza (evento input);
  // ao confirmar (evento change nativo), grava a cor de vez. Antes, cada tom
  // intermediário virava uma favorita nova e a barra se reorganizava sozinha.
  const seletorRef = useRef<HTMLInputElement>(null);
  const aoCorRef = useRef(aoCor);
  aoCorRef.current = aoCor;
  useEffect(() => {
    const el = seletorRef.current;
    if (!el) return;
    const confirmar = () => aoCorRef.current(el.value);
    el.addEventListener("change", confirmar);
    return () => el.removeEventListener("change", confirmar);
  }, []);
  const vertical = pos === "direita" || pos === "esquerda";
  // Arrastar pela alça: ao soltar, a barra vai para o lado mais perto do dedo.
  // Enquanto arrasta, uma faixa tracejada mostra onde ela vai ficar.
  const arrasto = useRef<{ id: number; x: number; y: number; ativo: boolean } | null>(null);
  const [alvo, setAlvo] = useState<PosBarra | null>(null);
  const ladoMaisPerto = (x: number, y: number): PosBarra => {
    const r = miolo.current?.getBoundingClientRect();
    if (!r) return pos;
    const d: [PosBarra, number][] = [["esquerda", x - r.left], ["direita", r.right - x], ["cima", y - r.top], ["baixo", r.bottom - y]];
    return d.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
  };
  const alcaDesce = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ativo: false };
  };
  const alcaMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const a = arrasto.current;
    if (!a || a.id !== e.pointerId) return;
    if (!a.ativo && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 12) return;
    a.ativo = true;
    setAlvo(ladoMaisPerto(e.clientX, e.clientY));
  };
  const alcaSobe = (e: React.PointerEvent<HTMLButtonElement>) => {
    const a = arrasto.current;
    arrasto.current = null;
    setAlvo(null);
    if (!a || a.id !== e.pointerId) return;
    if (a.ativo) aoPos(ladoMaisPerto(e.clientX, e.clientY));
    else aoCiclar(); // um toque simples passa para o próximo lado
  };
  const alcaTecla = (e: React.KeyboardEvent) => {
    const lados: Record<string, PosBarra> = { ArrowUp: "cima", ArrowDown: "baixo", ArrowLeft: "esquerda", ArrowRight: "direita" };
    if (lados[e.key]) { e.preventDefault(); aoPos(lados[e.key]); }
  };
  const corMinuscula = cor.toLowerCase();
  const corLivre = !favoritos.some((c) => c.toLowerCase() === corMinuscula);
  const estilo = corBarra ? ({ background: corBarra, "--barra-fg": corContraste(corBarra) } as React.CSSProperties) : undefined;
  const classe = `${vertical ? "caderno-barra vertical" : "caderno-barra"}${corBarra ? " tintada" : ""}`;
  const temPainel = !!subbarra;
  const mostrarPainel = temPainel && painelAberto;
  const mostrarDica = dica && !mostrarPainel;
  const tocarFerramenta = (id: FerramentaUI) => {
    if (ferramenta !== id) return aoFerramenta(id);
    if (COM_PAINEL.includes(id)) aoPainel(!painelAberto);
    else if (!SEM_AJUSTES.includes(id)) aoAjustar(id);
  };
  const rotuloFerramenta = (id: FerramentaUI) => {
    const nome = t.ferramentas.nomes[id];
    if (COM_PAINEL.includes(id)) return `${nome} (${t.ferramentas.temOpcoes})`;
    if (ferramenta === id && !SEM_AJUSTES.includes(id)) return t.ferramentas.ajustesDe(nome);
    return nome;
  };
  const podeAjustar = !SEM_AJUSTES.includes(ferramenta);
  return (
    <div className={`caderno-barra-caixa pos-${pos}`}>
      <div className={classe} style={estilo} role="toolbar" aria-label={t.ferramentas.titulo} aria-orientation={vertical ? "vertical" : "horizontal"}>
        <button type="button" className="caderno-mover-barra" aria-label={t.ferramentas.moverBarra} title={t.ferramentas.moverBarra} aria-describedby="caderno-alca-ajuda"
          onPointerDown={alcaDesce} onPointerMove={alcaMove} onPointerUp={alcaSobe} onPointerCancel={() => { arrasto.current = null; setAlvo(null); }}
          onClick={(e) => { if (e.detail === 0) aoCiclar(); /* teclado: Enter/Espaço */ }} onKeyDown={alcaTecla}>
          <IconeAlca deitada={vertical} aria-hidden="true" size="1.2em" />
        </button>
        <span id="caderno-alca-ajuda" hidden>{t.ferramentas.moverBarraAjuda}</span>
        <span className="caderno-barra-grupo">
          {FERRAMENTAS_UI.map(({ id, icone: Icone }) => {
            const painel = COM_PAINEL.includes(id);
            return (
              <Button key={id} className={`caderno-ferramenta${ferramenta === id ? " ativa" : ""}${painel ? " com-painel" : ""}`}
                onPress={() => tocarFerramenta(id)}
                aria-label={rotuloFerramenta(id)} aria-pressed={ferramenta === id}
                aria-expanded={painel && ferramenta === id ? mostrarPainel : undefined}>
                <Icone aria-hidden="true" size="1.2em" />
                {painel && <span className="caderno-ferramenta-mais" aria-hidden="true" />}
              </Button>
            );
          })}
        </span>
        <span className="caderno-barra-sep" aria-hidden="true" />
        <span className="caderno-barra-grupo caderno-cores" role="group" aria-label={t.ferramentas.cor}>
          {favoritos.map((c) => (
            <button key={c} type="button" className={corMinuscula === c.toLowerCase() ? "caderno-cor atual" : "caderno-cor"} style={{ background: c }}
              // Marca a cor já no toque (pointerdown), sem esperar o "click" do
              // Safari, que chega só depois de levantar o dedo/caneta.
              onPointerDown={(e) => { if (e.button === 0 && corMinuscula !== c.toLowerCase()) aoCorPrevia(c); }}
              onMouseDown={(e) => e.preventDefault() /* não tira o cursor do texto em edição */}
              onClick={() => aoCor(c)} aria-label={c} aria-pressed={corMinuscula === c.toLowerCase()} />
          ))}
          <label className={corLivre ? "caderno-cor-escolher atual" : "caderno-cor-escolher"} title={t.ferramentas.escolherCor} style={corLivre ? { background: cor } : undefined}>
            <input ref={seletorRef} type="color" value={/^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#000000"} onChange={(e) => aoCorPrevia(e.target.value)} aria-label={t.ferramentas.escolherCor} />
            {!corLivre && <Plus aria-hidden="true" size="1em" />}
          </label>
        </span>
        <span className="caderno-barra-sep" aria-hidden="true" />
        <span className="caderno-barra-grupo">
          <Button className="botao-icone" onPress={aoDesfazer} isDisabled={!podeDesfazer} aria-label={t.ferramentas.desfazer}><Undo2 aria-hidden="true" size="1.1em" /></Button>
          <Button className="botao-icone" onPress={aoRefazer} isDisabled={!podeRefazer} aria-label={t.ferramentas.refazer}><Redo2 aria-hidden="true" size="1.1em" /></Button>
          <Button className={reguaLigada ? "botao-icone ativo" : "botao-icone"} onPress={aoRegua} aria-label={t.regua.titulo} aria-pressed={reguaLigada}><Ruler aria-hidden="true" size="1.1em" /></Button>
          <Button className="botao-icone" onPress={aoInserirImagem} aria-label={t.imagem.inserir}><ImagePlus aria-hidden="true" size="1.1em" /></Button>
          <Button className="botao-icone" onPress={aoAdesivos} aria-label={t.adesivos.abrir}><Sticker aria-hidden="true" size="1.1em" /></Button>
          <Button className="botao-icone" onPress={aoCriarIa} aria-label={t.imagemIa.abrir}><Sparkles aria-hidden="true" size="1.1em" /></Button>
          <Button className="botao-icone" onPress={aoAbrirCorBarra} aria-label={t.barraCor.abrir}><Palette aria-hidden="true" size="1.1em" /></Button>
          <Button className={travada ? "botao-icone ativo" : "botao-icone"} onPress={aoTravar} aria-pressed={travada} aria-label={t.trava.travar}>
            {travada ? <IconeCadeado aria-hidden="true" size="1.1em" /> : <IconeCadeadoAberto aria-hidden="true" size="1.1em" />}
          </Button>
          <Button className="caderno-nova-pagina" onPress={aoNovaPagina} aria-label={t.paginas.nova}><Plus aria-hidden="true" size="1.1em" /><span className="caderno-nova-pagina-texto" aria-hidden="true">{t.paginas.novaCurta}</span></Button>
        </span>
      </div>
      {mostrarPainel && (
        <div className="caderno-flutuante caderno-subbarra" role="group" aria-label={t.ferramentas.opcoesDe(t.ferramentas.nomes[ferramenta])}>
          {subbarra}
          <span className="caderno-painel-pe">
            {podeAjustar && <button type="button" className="caderno-sub-botao texto" onClick={() => aoAjustar(ferramenta)}>{t.ferramentas.ajustes}</button>}
            <button type="button" className="caderno-sub-botao" onClick={() => aoPainel(false)} aria-label={t.ferramentas.fecharOpcoes} title={t.ferramentas.fecharOpcoes}><X aria-hidden="true" size="1em" /></button>
          </span>
        </div>
      )}
      {mostrarDica && (
        <div className="caderno-flutuante caderno-dica" role="note">
          <p>{t.dicaBarra.texto}</p>
          <button type="button" className="botao pequeno" onClick={aoFecharDica}>{t.dicaBarra.entendi}</button>
        </div>
      )}
      {alvo && miolo.current && createPortal(<div className={`caderno-alvo-barra pos-${alvo}`} aria-hidden="true"><span>{t.ferramentas.soltarAqui}</span></div>, miolo.current)}
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
/** Pontos da amostra das prévias: uma onda com a pressão subindo e descendo. */
const PONTOS_AMOSTRA: Ponto[] = Array.from({ length: 44 }, (_x, i) => ({ x: 12 + i * 6.3, y: 40 + Math.sin(i / 5) * 16, p: 0.15 + 0.85 * Math.sin((i / 43) * Math.PI) }));

function AjustesFerramenta({ ferramenta, ajuste, modeloPincel, aoMudar, aoFechar }: { ferramenta: Ferramenta; ajuste: AjusteTraco; modeloPincel: ModeloPincel; aoMudar: (p: Partial<AjusteTraco>) => void; aoFechar: () => void }) {
  const amostra: Traco = {
    tipo: "traco", id: "amostra", ferramenta, cor: "#1f2937", espessura: Math.round(ajuste.tamanho * 1.15), afinar: ajuste.afinar, alisar: ajuste.alisar, opacidade: ajuste.opacidade, pressao: true,
    ...(ferramenta === "pincel" && modeloPincel !== "redondo" ? { pincel: modeloPincel, semente: 12345 } : {}),
    pontos: PONTOS_AMOSTRA,
  };
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div className="formulario">
      <div className="caderno-previa-traco">
        <svg viewBox="0 0 300 80" preserveAspectRatio="xMidYMid meet" aria-label={t.ferramentas.previa}>
          <TracoSvg traco={amostra} />
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

/** Ajustes das formas e da seta: a espessura da linha, com prévia (a forma em
 *  si se escolhe na barra, que se estende ao tocar na ferramenta). */
function AjustesForma({ ajuste, seta, cor, aoMudar, aoFechar }: { ajuste: AjusteForma; seta: boolean; cor: string; aoMudar: (p: Partial<AjusteForma>) => void; aoFechar: () => void }) {
  const corValida = /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#1f2937";
  const previa: Forma = seta
    ? { tipo: "forma", id: "p", forma: "seta", x1: 40, y1: 56, x2: 260, y2: 24, cor: corValida, espessura: ajuste.espessura }
    : { tipo: "forma", id: "p", forma: ajuste.tipo, x1: 110, y1: 10, x2: 190, y2: 70, cor: corValida, espessura: ajuste.espessura };
  return (
    <div className="formulario">
      <div className="caderno-previa-traco">
        <svg viewBox="0 0 300 80" preserveAspectRatio="xMidYMid meet" aria-label={t.ferramentas.previa}>
          <path d={caminhoDeForma(previa)} fill="none" stroke={corValida} strokeWidth={ajuste.espessura} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <Deslizante rotulo={t.forma.espessura} valor={ajuste.espessura} min={1} max={16} passo={0.5} aoMudar={(n) => aoMudar({ espessura: n })} mostrar={(n) => `${n.toFixed(1)} px`} />
      <p className="campo-ajuda">{seta ? t.seta.ajuda : t.forma.ajuda}</p>
      <div className="janela-acoes">
        <Button className="botao principal" onPress={aoFechar}>{textos.comum.fechar}</Button>
      </div>
    </div>
  );
}

/** Ajustes da borracha: o modo (pedaço ou objeto inteiro) e o tamanho, com prévia. */
function AjustesBorracha({ tamanho, modo, aoModo, aoMudar, aoFechar }: { tamanho: number; modo: ModoBorracha; aoModo: (m: ModoBorracha) => void; aoMudar: (n: number) => void; aoFechar: () => void }) {
  return (
    <div className="formulario">
      <div className="caderno-previa-traco">
        <svg viewBox="0 0 300 80" preserveAspectRatio="xMidYMid meet" aria-label={t.ferramentas.previa}>
          <circle cx="150" cy="40" r={Math.min(tamanho / 2, 38)} fill="none" stroke="#6f747c" strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
      </div>
      <Segmentado rotulo={t.borracha.modo} valor={modo} aoMudar={(v) => aoModo(v as ModoBorracha)}
        opcoes={[{ valor: "pedaco", nome: t.borracha.modos.pedaco }, { valor: "objeto", nome: t.borracha.modos.objeto }]} />
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
