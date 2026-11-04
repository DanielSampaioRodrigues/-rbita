import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Button, Dialog, DialogTrigger, Form, Label, Menu, MenuItem, MenuTrigger, Popover, Radio, RadioGroup } from "react-aria-components";
import { EditorContent, useEditor } from "@tiptap/react";
import { caminhoDeForma, reconhecerForma, cenaVazia, desenhoDeTraco, MODELOS_PINCEL, novaSemente, elementoDentro, escalar, FERRAMENTAS, formaAtingida, fragmentosAoApagar, lerCena, limitesDe, MODELOS_PAPEL, papelDataUri, papelPadrao, rotacionar, serializarCena, TAMANHOS, TIPOS_FORMA, transladar, type AlinharTexto, type Cena, type CoresPapel, type Elemento, type Ferramenta, type Forma, type Imagem, type ModeloPapel, type ModeloPincel, type Papel, type Ponto, type Ponto2, type Texto, type TipoForma, type Traco } from "@orbita/caderno";
import { agrupar, ajustarConectores, desagrupar, elementoNoPonto, expandirGrupos, idsNoRetangulo, imagemAtingida, moverUmNivel, objetoNoPonto, ordenarTudo, soltarSetasMovidas, temGrupo, type MedidaTexto } from "./edicao";
import { ICONES_FORMA, IconeAgrupar, IconeAlca, IconeLaser, IconeCadeado, IconeCadeadoAberto, IconeCursor, IconeDesagrupar, IconeEngrenagem, IconeNivelFrente, IconeNivelTras, IconeSeta, IconeTudoFrente, IconeTudoTras } from "./iconesCaderno";
import { api, CORES_ETIQUETA, type Capa, type Caderno, type EstadoIa, type PaginaCaderno, type PastaCaderno } from "../api";
import { reduzirImagem } from "../fundo";
import { useReescrever } from "../ia/Reescrever";
import { useDitar } from "../ditado/Ditar";
import { CriarImagemIa } from "./CriarImagemIa";
import { Aviso, Campo } from "../componentes/Campo";
import { Interruptor } from "../componentes/Interruptor";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { Bold, Bookmark, Check, ChevronDown, Eye, FilePlus, FileText, MoreHorizontal, ChevronLeft, ChevronRight, Eraser, FolderOpen, FolderPlus, Highlighter, ImagePlus, LayoutGrid, Pencil, PenLine, Plus, Redo2, Ruler, Shapes, SlidersHorizontal, PainelLateral as IconePainel, Sparkles, Trash2, Type, Undo2, Wand2, X } from "../icones";
import { ADESIVOS, CAPAS_ARTE, urlAdesivo, urlCapaArte } from "./galeria";
import { RenderCapaCena } from "./CapaEditor";
import { CORES_LINHA, CORES_PAPEL, SeletorCor } from "./SeletorCor";
import { CamadaDocumento, DocumentoEstatico } from "./Documento";
import { DocumentoAberto } from "./DocumentoAberto";
import { useMeusEstilos } from "./editor/meusEstilos";
import { PainelLateral, type AbaPainel } from "./PainelLateral";
import { PainelIa, type Alcance, type ContextoIa } from "./PainelIa";
import { elementosDoMapa, lerMapa } from "./mapaMental";
import { aplicarNasCenas, arranjoDasPaginas, descreverCaderno, lerMudancas, lerReversoes, marcaDaCena, trocarIdsDaReversao, type Mudanca, type PaginaParaIa, type ReversaoIa } from "./agenteIa";
import { PainelBiblioteca } from "./PainelBiblioteca";
import { PainelFontes } from "./PainelFontes";
import { amostrar, buscar, lerFontes, lerTrechos, montarTrechos } from "./fontes";
import { CamadaCorrecao, type MarcaEscrita } from "./CorrecaoEscrita";
import { imagemComCaixas, palavrasDaPagina } from "./escrita";
import { cenaParaGuardar, copiarElementos, guardarNaBiblioteca, normalizarObjetos, type DadosBiblioteca, type ItemBiblioteca } from "./biblioteca";
import { MenuEnviar, type ArquivoPronto } from "../exportar/MenuEnviar";
import { nomeDeArquivo } from "../exportar/entregar";
import { medir, type PaginaMedida } from "../exportar/medir";
import { useTemaCaderno } from "./temaCaderno";
import { FitaTexto } from "./editor/Fita";
import { extensoesBase } from "./editor/extensoes";
import { acaoDoGesto, criarDetectorDeToques, type AcaoGesto } from "./gestos";
import { larguraDaPagina, paginaAoSoltar, paginaNaPosicao, type Encaixe } from "./visor";
import { CAPA_NA_PAGINA, capaJaDecidida, capaNaPagina, SEM_CAPA, cenaDaCapaAntiga, lerCenaCapa, temCapaCena, tituloDaCapa } from "./capa";
import { FONTES } from "../preferencias";
import { avisarMudanca, useMudancas } from "../dados";
import { CORES_PASTA, corContraste, IconePasta, NOMES_COR_PASTA } from "../componentes/Pasta3D";
import { useEntrarImersivo } from "../app/Imersivo";
import { useRecado } from "../app/Recado";
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
  // Os estilos da pessoa (o CSS deles) valem na estante, nas miniaturas e nas páginas.
  useMeusEstilos();
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
    if (atual.modo === "documento") return <DocumentoAberto key={atual.id} caderno={atual} aoFechar={() => setAberto(null)} />;
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
          {capaNaPagina(c.capaCena) ? (
            <button className="caderno-capa caderno-capa-com-pagina" onClick={() => aoAbrir(c)} aria-label={`${t.abrir}: ${c.nome}`}>
              <CapaDaEstante caderno={c} />
            </button>
          ) : (
            <button className="caderno-capa" style={estiloCapa(c.capa)} onClick={() => aoAbrir(c)} aria-label={`${t.abrir}: ${c.nome}`}>
              <span className="caderno-capa-modo">{c.modo === "infinito" ? <LayoutGrid aria-hidden="true" size="1em" /> : c.modo === "documento" ? <FileText aria-hidden="true" size="1em" /> : <PenLine aria-hidden="true" size="1em" />}</span>
              {temCapaCena(c.capaCena) ? <RenderCapaCena cena={lerCenaCapa(c.capaCena)} /> : <span className="caderno-capa-nome">{c.nome}</span>}
            </button>
          )}
          <div className="caderno-item-pe">
            <strong className="caderno-item-nome quebra">{c.nome}</strong>
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
  const [comCapa, setComCapa] = useState(true);
  const [pastaId, setPastaId] = useState(inicial.pastaId);
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";
  const naPagina = capaNaPagina(inicial.capaCena);
  const mostrarCapa = editando ? inicial.modo === "caderno" : comCapa && modo === "caderno";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      if (!editando) {
        // A capa é a primeira página: entra antes da página que o caderno já traz.
        const cad = await api.salvarCaderno({ ...inicial, nome, modo, capa, capaCena: modo === "infinito" ? "" : modo === "documento" ? CAPA_NA_PAGINA : comCapa ? CAPA_NA_PAGINA : SEM_CAPA, pastaId });
        if (comCapa && modo === "caderno") await criarPaginaCapa(cad, capa, nome, 0.5);
        // Documento de texto: a primeira página já é de texto.
        if (modo === "documento") {
          const [pg] = await api.listarPaginasCaderno(cad.id);
          if (pg) await api.salvarPaginaCaderno({ ...pg, papel: { ...papelPadrao(), texto: true } });
        }
      } else {
        await api.salvarCaderno({ ...inicial, nome, capa, pastaId });
        // Capa já na página: troca o modelo da capa lá também.
        if (naPagina) {
          const pgs = await api.listarPaginasCaderno(inicial.id);
          const pg = pgs.find((p) => capaDaPagina(p));
          if (pg) await api.salvarPaginaCaderno({ ...pg, papel: { ...(pg.papel as object), capa } });
        }
      }
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
          <Segmentado rotulo={t.form.modo} valor={modo} aoMudar={(v) => setModo(v as Caderno["modo"])} opcoes={[{ valor: "caderno", nome: t.modos.caderno }, { valor: "documento", nome: t.modos.documento }, { valor: "infinito", nome: t.modos.infinito }]} />
          <p className="campo-ajuda">{t.modoAjuda[modo]}</p>
          {modo === "caderno" && <Interruptor rotulo={t.form.comCapa} ligado={comCapa} aoMudar={setComCapa} />}
        </>
      )}
      {mostrarCapa && (
        <>
          <EscolherCapa capa={capa} aoMudar={setCapa} ia={ia} aoMudarIa={aoMudarIa} />
          <div className="caderno-capa-previa-nova" style={estiloCapa(capa)} aria-hidden="true">
            {editando && !naPagina && temCapaCena(inicial.capaCena) ? <RenderCapaCena cena={lerCenaCapa(inicial.capaCena)} /> : <span>{nome.trim() || t.form.nome}</span>}
          </div>
          <p className="campo-ajuda">{editando && naPagina ? t.form.capaEditarAjuda : t.form.capaAjuda}</p>
        </>
      )}
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

/** Cria a página-capa (folha com o modelo da capa e o nome escrito nela). */
async function criarPaginaCapa(cad: Caderno, capa: Capa, nome: string, ordem: number, cena?: Cena): Promise<PaginaCaderno> {
  const med = TAMANHOS.a4;
  const pg = await api.salvarPaginaCaderno({ id: "", cadernoId: cad.id, ordem, tamanho: "a4", papel: { ...papelPadrao(), capa }, titulo: "", marcado: false, criadoEm: 0 });
  await api.salvarCenaCaderno(pg.id, serializarCena(cena ?? { elementos: [tituloDaCapa(nome, med.largura, med.altura)] }));
  return pg;
}

/** Na estante, o caderno com a capa na página mostra a própria página 1. */
function CapaDaEstante({ caderno }: { caderno: Caderno }) {
  const [pg, setPg] = useState<PaginaCaderno | null>(null);
  const [cena, setCena] = useState<Cena | undefined>(undefined);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const mudancas = useMudancas();
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    let vivo = true;
    api.listarPaginasCaderno(caderno.id).then(async (pgs) => {
      const p = pgs[0];
      if (!vivo || !p) return;
      setPg(p);
      const c = lerCena(await api.carregarCenaCaderno(p.id));
      if (!vivo) return;
      setCena(c);
      for (const el of c.elementos) if (el.tipo === "imagem") api.imagemAnexo(el.anexoId).then((u) => vivo && setUrls((m) => ({ ...m, [el.anexoId]: u })), () => {});
    }, () => {});
    return () => { vivo = false; };
  }, [caderno.id, mudancas]);
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setLargura(el.clientWidth));
    ro.observe(el);
    setLargura(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const imagemUrl = useCallback((id: string) => urls[id], [urls]);
  return (
    <div ref={caixa} className="caderno-capa-pagina">
      {pg && largura > 0 ? <MiniaturaPagina pagina={pg} cena={cena} imagemUrl={imagemUrl} largura={largura} /> : <div className="caderno-capa-pagina-vazia" style={estiloCapa(caderno.capa)} />}
    </div>
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
type FerramentaUI = Ferramenta | "texto" | "nota" | "forma" | "seta" | "laco" | "selecao" | "laser";

/** Opções das ferramentas (barra de contexto), guardadas no aparelho. */
interface OpcoesCaderno {
  /** Desenhar e segurar parado no fim: o traço vira forma perfeita. */
  segurarForma: boolean;
  /** Marca-texto sai sempre reto (do começo ao fim do traço). */
  marcaReto: boolean;
  /** A borracha só apaga o marca-texto. */
  borrachaSoMarca: boolean;
  /** Depois de apagar, volta para a ferramenta de antes. */
  borrachaVolta: boolean;
  corLaser: string;
}
const CORES_LASER = ["#ef4444", "#2563eb", "#16a34a", "#f59e0b"];
const OPCOES_PADRAO: OpcoesCaderno = { segurarForma: true, marcaReto: false, borrachaSoMarca: false, borrachaVolta: false, corLaser: CORES_LASER[0] };
function lerOpcoes(): OpcoesCaderno {
  try { const s = localStorage.getItem("caderno-opcoes"); if (s) return { ...OPCOES_PADRAO, ...JSON.parse(s) }; } catch { /* padrão */ }
  return OPCOES_PADRAO;
}
/** Três espessuras salvas por ferramenta (fina, média, grossa), em px de referência. */
const ESPESSURAS_PADRAO: Record<Ferramenta, number[]> = {
  caneta: [2, 3.5, 6], lapis: [1.6, 2.6, 4.5], pincel: [4, 7, 13], marcatexto: [10, 16, 26], borracha: [10, 18, 36],
};
const ESPESSURAS_FORMA = [2, 3, 6];
function lerEspessuras(): Record<string, number[]> {
  try {
    const s = localStorage.getItem("caderno-espessuras");
    if (s) { const v = JSON.parse(s); if (v && typeof v === "object") return { ...ESPESSURAS_PADRAO, forma: ESPESSURAS_FORMA, ...v }; }
  } catch { /* padrão */ }
  return { ...ESPESSURAS_PADRAO, forma: ESPESSURAS_FORMA };
}
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

/** Extensões do editor da caixa: as mesmas do editor completo de texto. */
const extensoesCaixa = extensoesBase();

/** Fontes oferecidas na caixa ("" = padrão do app). */
// Padrão do tema primeiro; depois todas as fontes do app (as mesmas da Aparência).
/** Fonte da caixa de texto. "cursiva": a da palavra corrigida pelo corretor da escrita à mão. */
const fonteCss = (f?: string) => (f === "cursiva" ? '"Caveat Variable", Caveat, cursive' : f && f in FONTES ? FONTES[f as keyof typeof FONTES].css : "var(--fonte-texto)");
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
/** A folha de uma página; a página-capa guarda o modelo da capa em `capa`. */
type PapelPagina = Papel & { capa?: Capa; texto?: boolean };
/** Página de texto (editor no estilo do Pages/Word, com o desenho por cima). */
const ehPaginaTexto = (pg: PaginaCaderno | undefined) => !!(pg?.papel as PapelPagina | null | undefined)?.texto;
const capaDaPagina = (pg: PaginaCaderno | undefined): Capa | undefined => (pg?.papel as PapelPagina | null | undefined)?.capa;

/** O texto de um HTML simples, com uma quebra por parágrafo, item e título. */
function textoDeHtml(html: string): string {
  const semMarcas = html.replace(/<(br|\/p|\/li|\/h[1-6]|\/div|\/tr|\/blockquote)[^>]*>/gi, "\n").replace(/<[^>]+>/g, "");
  const t = document.createElement("textarea");
  t.innerHTML = semMarcas;
  return t.value.replace(/\n{3,}/g, "\n\n").trim();
}
/** Todo o texto digitado de uma página: o texto da página e as caixas, de cima para baixo. */
function textoDaCena(c: Cena | undefined): string {
  const partes: string[] = [];
  if (c?.documento) partes.push(textoDeHtml(c.documento));
  const caixas = (c?.elementos ?? []).filter((e): e is Texto => e.tipo === "texto").sort((a, b) => a.y - b.y || a.x - b.x);
  for (const tx of caixas) { const v = textoDeHtml(tx.texto); if (v) partes.push(v); }
  return partes.filter(Boolean).join("\n\n");
}
const blobParaDataUrl = (b: Blob) => new Promise<string>((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => erro(r.error); r.readAsDataURL(b); });

function Folha({ papel, tamanho, className }: { papel: Papel; tamanho: string; className?: string }) {
  const capa = (papel as PapelPagina).capa;
  // A imagem da folha só é refeita quando o papel ou o tamanho mudam de
  // verdade (a chave em texto evita refazer a cada re-render, ex.: trocar a cor).
  const chave = `${tamanho}|${JSON.stringify(papel)}`;
  const { uri, fundo, med } = useMemo(() => {
    const m = medidaDe(tamanho);
    const cores = coresDaFolha(papel);
    return { uri: papelDataUri(papel, m.largura, m.altura, cores), fundo: cores.fundo, med: m };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  if (capa) return <div className={className} style={{ aspectRatio: `${med.largura} / ${med.altura}`, ...estiloCapa(capa) }} />;
  return <div className={className} style={{ aspectRatio: `${med.largura} / ${med.altura}`, backgroundImage: `url("${uri}")`, backgroundSize: "100% 100%", backgroundColor: fundo }} />;
}

/** Tablet ou celular (iPad inclusive, que se apresenta como Mac com toque).
 *  Neles, "escrever só com a caneta" já começa ligado. Notebook com tela de
 *  toque (Windows) não entra: lá o dedo pode continuar riscando. */
function ehTabletOuCelular(): boolean {
  if (typeof navigator === "undefined" || !(navigator.maxTouchPoints > 0)) return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod|Android|Mobile|Tablet/i.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/** Onde entra a página nova. */
type OndeNova = "antes" | "depois" | "fim";
/** A folha sem a capa (a página nova nunca herda a capa da primeira página). */
function semCapa(p: Papel): Papel {
  const { capa: _capa, ...resto } = p as Papel & { capa?: unknown };
  return resto as Papel;
}

/** Toque "de palma": área de contato grande (diâmetro, px). Nunca rola nem dá zoom.
 *  Era 30, e o dedo de muita gente no iPad passava disso: a pinça não funcionava. */
const PALMA_PX = 130;
/** Logo depois de escrever com a caneta (mão apoiada), um toque já conta como palma a
 *  partir deste tamanho. Fora disso, o polegar (que encosta mais que os outros dedos)
 *  continua valendo para a pinça. */
const PALMA_ESCREVENDO_PX = 70;
const ESCREVENDO_MS = 4000;
/** Sem movimento suave: baixo estímulo ligado ou "reduzir movimento" no sistema. */
const semMovimento = () =>
  document.documentElement.dataset.baixoEstimulo === "true" ||
  (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
/** Depois que a caneta levanta, o dedo continua ignorado por este tempo (ms). */
const CANETA_PAUSA_MS = 600;
/** Quanto do espaço depois da última página é preciso puxar para criar outra. */
const LIMIAR_PUXAR = 0.85;
const tamanhoDoToque = (tq: Touch) => Math.max(tq.radiusX || 0, tq.radiusY || 0) * 2;
const ehCanetaToque = (tq: Touch) => (tq as Touch & { touchType?: string }).touchType === "stylus";

function CadernoAberto({ caderno, abas, aoTrocar, aoFechar }: { caderno: Caderno; abas: Caderno[]; aoTrocar: (c: Caderno) => void; aoFechar: () => void }) {
  useEntrarImersivo();
  const [paginas, setPaginas] = useState<PaginaCaderno[]>([]);
  const [selId, setSelId] = useState<string>("");
  // Visão das páginas (miniaturas, marcadores, nomes) e o menu de adicionar página.
  const [visaoPaginas, setVisaoPaginas] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [editor, setEditor] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null);
  // Desenho: ferramenta, cor e grossura ativas; cenas e histórico por página.
  const [ferramenta, setFerramenta] = useState<FerramentaUI>(caderno.modo === "documento" ? "texto" : "caneta");
  const ehTexto = ferramenta === "texto" || ferramenta === "nota";
  const ehSelecao = ferramenta === "laco" || ferramenta === "selecao";
  const fTraco: Ferramenta = FERRAMENTAS_TRACO.includes(ferramenta) ? (ferramenta as Ferramenta) : "caneta";
  // Texto: negrito já ligado nas caixas novas (escolha da barra de texto).
  const [negritoTexto, setNegritoTexto] = useState(() => lerPref("caderno-texto-negrito") === "1");
  const mudarNegritoTexto = (v: boolean) => { setNegritoTexto(v); gravarPref("caderno-texto-negrito", v ? "1" : "0"); };
  // Onde a barra de formatação do texto em edição aparece (dentro da barra de ferramentas).
  const [slotTexto, setSlotTexto] = useState<HTMLDivElement | null>(null);
  // Painel lateral (Páginas, IA, Biblioteca): fica lembrado neste aparelho.
  const [painel, setPainelBruto] = useState<AbaPainel | null>(() => { const v = lerPref("caderno-painel"); return v === "paginas" || v === "ia" || v === "fontes" || v === "biblioteca" ? v : null; });
  const setPainel = (p: AbaPainel | null) => { setPainelBruto(p); gravarPref("caderno-painel", p ?? ""); };
  const [ladoPainel, setLadoPainelBruto] = useState<"esquerda" | "direita">(() => (lerPref("caderno-painel-lado") === "direita" ? "direita" : "esquerda"));
  const setLadoPainel = (l: "esquerda" | "direita") => { setLadoPainelBruto(l); gravarPref("caderno-painel-lado", l); };
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
  const [encaixe, setEncaixe] = useState<Encaixe>(() => (lerPref("caderno-encaixe") === "largura" ? "largura" : "pagina"));
  const mudarEncaixe = (v: Encaixe) => { setEncaixe(v); gravarPref("caderno-encaixe", v); };
  const [gestosLigados, setGestosLigados] = useState(() => lerPref("caderno-gestos") !== "0");
  const mudarGestos = (v: boolean) => { setGestosLigados(v); gravarPref("caderno-gestos", v ? "1" : "0"); };
  // Tela limpa: esconde as barras (quatro dedos ou o botão; Esc volta).
  const [telaLimpa, setTelaLimpa] = useState(false);
  const recado = useRecado();
  // Tema próprio do caderno (opcional): as cores valem só dentro desta tela.
  const temaCaderno = useTemaCaderno();
  // Exportar: as páginas pedidas são desenhadas fora da tela, no tamanho real, e medidas.
  const [exportando, setExportando] = useState<{ ids: string[]; pronto: (p: PaginaMedida[]) => void; erro: (e: unknown) => void } | null>(null);
  const caixaExportar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!exportando) return;
    let vivo = true;
    void (async () => {
      try {
        await document.fonts.ready;
        const raiz = caixaExportar.current;
        if (!raiz) throw new Error("exportar");
        // Espera as imagens (fotos, capas de arte) ficarem prontas para desenhar.
        const fontes = Array.from(raiz.querySelectorAll("image, img")).map((el) => el.getAttribute("href") ?? (el as HTMLImageElement).currentSrc ?? "").filter(Boolean);
        await Promise.all(fontes.map((src) => { const i = new Image(); i.src = src; return i.decode().catch(() => undefined); }));
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
        if (!vivo) return;
        const medidas: PaginaMedida[] = [];
        for (const el of Array.from(raiz.querySelectorAll<HTMLElement>(".caderno-mini-miolo"))) {
          const r = el.getBoundingClientRect();
          const w = Number(el.dataset.largura), h = Number(el.dataset.altura);
          medidas.push(medir(el, { x: r.left, y: r.top, largura: r.width, altura: r.height }, r.width / w || 1, w, h));
        }
        exportando.pronto(medidas);
      } catch (e) {
        exportando.erro(e);
      } finally {
        if (vivo) setExportando(null);
      }
    })();
    return () => { vivo = false; };
  }, [exportando]);
  const medirParaExportar = (ids: string[]) => new Promise<PaginaMedida[]>((pronto, erro) => setExportando({ ids, pronto, erro }));
  const [tamTexto, setTamTexto] = useState<number>(lerTamTexto);
  const [editandoTexto, setEditandoTexto] = useState("");
  const mudarTamTexto = (n: number) => {
    setTamTexto(n);
    try { localStorage.setItem("caderno-tam-texto", String(n)); } catch { /* ignora */ }
  };
  const [ajusteForma, setAjusteForma] = useState<AjusteForma>(lerAjusteForma);
  const mudarForma = (patch: Partial<AjusteForma>) => {
    if (patch.espessura != null && Math.abs(patch.espessura - ajusteForma.espessura) > 0.01) trocarEspessuraSalva("forma", ajusteForma.espessura, patch.espessura);
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
  const [opcoes, setOpcoes] = useState<OpcoesCaderno>(lerOpcoes);
  const mudarOpcoes = (p: Partial<OpcoesCaderno>) => setOpcoes((o) => { const n = { ...o, ...p }; gravarPref("caderno-opcoes", JSON.stringify(n)); return n; });
  const [espessuras, setEspessuras] = useState<Record<string, number[]>>(lerEspessuras);
  /** Troca uma das três espessuras salvas: a mais perto do valor antigo vira o novo. */
  const trocarEspessuraSalva = (f: string, antigo: number, novo: number) => setEspessuras((e) => {
    const lista = [...(e[f] ?? [])];
    if (!lista.length || lista.some((v) => Math.abs(v - novo) < 0.01)) return e;
    let i = 0;
    lista.forEach((v, k) => { if (Math.abs(v - antigo) < Math.abs(lista[i] - antigo)) i = k; });
    lista[i] = novo;
    const n = { ...e, [f]: lista };
    gravarPref("caderno-espessuras", JSON.stringify(n));
    return n;
  });
  // A ferramenta de antes da borracha (para "voltar à ferramenta" depois de apagar).
  const antesDaBorracha = useRef<FerramentaUI>("caneta");
  const escolherFerramenta = (f: FerramentaUI) => {
    if (f === "borracha" && ferramenta !== "borracha") antesDaBorracha.current = ferramenta;
    setFerramenta(f);
  };
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
  const mudarAjuste = (f: Ferramenta, patch: Partial<AjusteTraco>) => {
    if (patch.tamanho != null && Math.abs(patch.tamanho - ajustes[f].tamanho) > 0.01) trocarEspessuraSalva(f, ajustes[f].tamanho, patch.tamanho);
    gravarAjuste(f, patch);
  };
  const gravarAjuste = (f: Ferramenta, patch: Partial<AjusteTraco>) =>
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
  // Cadernos de antes da capa na página: na primeira vez que abrem, a capa antiga
  // (modelo, nome e desenho) vira a página 1, editável como as outras. Só uma vez:
  // se a pessoa apagar essa página depois, ela não volta.
  const migrando = useRef(false);
  useEffect(() => {
    if (migrando.current || caderno.modo !== "caderno" || capaJaDecidida(caderno.capaCena) || !paginas.length) return;
    if (paginas.some((p) => capaDaPagina(p))) return;
    migrando.current = true;
    void (async () => {
      try {
        const med = TAMANHOS.a4;
        const cena = cenaDaCapaAntiga(lerCenaCapa(caderno.capaCena), caderno.nome, med.largura, med.altura);
        const primeira = paginas[0].ordem;
        const pg = await criarPaginaCapa(caderno, caderno.capa, caderno.nome, primeira > 0 ? primeira / 2 : primeira - 1, cena);
        await api.salvarCaderno({ ...caderno, capaCena: CAPA_NA_PAGINA });
        rolarPara.current = pg.id;
        await carregar();
        avisarMudanca();
      } catch (e) {
        setErro(mensagem(e));
      }
    })();
  }, [paginas, caderno, carregar]);

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
  // Documento de texto: abre na ferramenta Texto e com a página na largura toda (letra maior).
  const documento = caderno.modo === "documento";
  const sel = paginas.find((p) => p.id === selId) ?? paginas[0];

  const agendarSalvarCena = (id: string, nova: Cena) => {
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => void api.salvarCenaCaderno(id, serializarCena(nova)).catch((e) => setErro(mensagem(e))), 700);
  };
  /** A cena com o texto da página de texto preservado (o desenho não mexe nele). */
  const comDocumento = (id: string, nova: Cena): Cena => {
    const doc = cenasRef.current[id]?.documento;
    return doc === undefined ? { elementos: nova.elementos } : { elementos: nova.elementos, documento: doc };
  };
  const mudarCena = (id: string, novaSo: Cena) => {
    const nova = comDocumento(id, novaSo);
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
        // "Só o marca-texto": o resto fica como está.
        if (opcoes.borrachaSoMarca && !(el.tipo === "traco" && el.ferramenta === "marcatexto")) { novos.push(el); continue; }
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
      const nova: Cena = { ...c, elementos: ajustarConectores(novos, MEDIDA) };
      agendarSalvarCena(pid, nova);
      return { ...m, [pid]: nova };
    });
  const apagarParcialFim = (pid: string) => {
    registrarCena(pid, cenasRef.current[pid] ?? cenaVazia());
    if (opcoes.borrachaVolta && antesDaBorracha.current !== "borracha") setFerramenta(antesDaBorracha.current);
  };

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
  const aoNovoTexto = (pid: string, x: number, y: number, nota = false, larguraArrastada?: number) => {
    // Com uma caixa aberta, tocar fora só confirma o texto (não abre outra).
    if (editandoTexto) { setEditandoTexto(""); return; }
    const largura = larguraArrastada ?? (nota ? 240 : LARGURA_TEXTO_PADRAO);
    const novo: Texto = nota
      ? { tipo: "texto", id: crypto.randomUUID(), x, y, largura, texto: "", cor: "#1f2937", tamanho: tamTexto, fundo: FUNDOS_NOTA[0] }
      : { tipo: "texto", id: crypto.randomUUID(), x, y, largura, texto: "", cor, tamanho: tamTexto };
    mudarCena(pid, { elementos: [...(cenas[pid]?.elementos ?? []), novo] });
    setEditandoTexto(novo.id);
  };
  const atualizarTexto = (pid: string, id: string, patch: Partial<Texto>) =>
    setCenas((m) => {
      const c = m[pid] ?? cenaVazia();
      const nova: Cena = { ...c, elementos: c.elementos.map((e) => (e.id === id && e.tipo === "texto" ? { ...e, ...patch } : e)) };
      agendarSalvarCena(pid, nova);
      return { ...m, [pid]: nova };
    });
  const aoFimTexto = (pid: string, id: string) => {
    setEditandoTexto((a) => (a === id ? "" : a));
    const c = cenasRef.current[pid];
    if (!c) return;
    const el = c.elementos.find((e) => e.id === id);
    if (el && el.tipo === "texto" && textoVazio(el.texto)) {
      const nova: Cena = { ...c, elementos: c.elementos.filter((e) => e.id !== id) };
      setCenas((m) => ({ ...m, [pid]: nova }));
      registrarCena(pid, nova);
      agendarSalvarCena(pid, nova);
    } else {
      registrarCena(pid, c);
    }
  };
  // Página de texto: o editor tem o próprio desfazer; aqui só guarda (sem encher o histórico do desenho).
  const atualizarDocumento = (pid: string, html: string) =>
    setCenas((m) => {
      const c = m[pid] ?? cenaVazia();
      if ((c.documento ?? "") === html) return m;
      const nova: Cena = { ...c, documento: html };
      agendarSalvarCena(pid, nova);
      return { ...m, [pid]: nova };
    });
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
      const nova: Cena = { ...c, elementos: ajustarConectores(soltarSetasMovidas(movidos, ids), MEDIDA) };
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
  // ---------- Toque: rolar, virar a página, pinça e gestos ----------
  // O caderno cuida sozinho do dedo (o navegador não rola a folha): assim a caneta
  // nunca é interrompida porque o Safari resolveu rolar no meio do traço, e os
  // gestos (dois toques com dois dedos etc.) funcionam igual em qualquer aparelho.
  const soCanetaRef = useRef(soCanetaEfetivo);
  soCanetaRef.current = soCanetaEfetivo;
  const travadaRef = useRef(travada);
  travadaRef.current = travada;
  const lateralRef = useRef(lateral);
  lateralRef.current = lateral;
  const paginandoRef = useRef(false);
  const gestosRef = useRef(gestosLigados);
  gestosRef.current = gestosLigados;
  const gestoRef = useRef<(a: AcaoGesto, x: number, y: number) => void>(() => {});
  // A caneta está encostada agora? Quando levantou pela última vez?
  const caneta = useRef({ encostada: new Set<number>(), levantou: -1e9 });
  const anim = useRef(0);
  const pararAnim = () => { cancelAnimationFrame(anim.current); anim.current = 0; };
  /** Onde cada página começa, no eixo da rolagem (px). */
  const iniciosPaginas = () => {
    const el = area.current;
    if (!el) return [] as number[];
    return [...el.querySelectorAll<HTMLElement>(".caderno-folha-bloco")].map((b) => (lateralRef.current ? b.offsetLeft : b.offsetTop));
  };
  const posicaoRolagem = () => { const el = area.current; return el ? (lateralRef.current ? el.scrollLeft : el.scrollTop) : 0; };
  /** Rola até a posição: suave e curto (200 ms); no baixo estímulo, na hora. */
  const rolarAte = (pos: number, suave: boolean) => {
    const el = area.current;
    if (!el) return;
    pararAnim();
    const lat = lateralRef.current;
    const ini = lat ? el.scrollLeft : el.scrollTop;
    const por = (v: number) => { if (lat) el.scrollLeft = v; else el.scrollTop = v; };
    if (!suave || semMovimento() || Math.abs(pos - ini) < 2) { por(pos); return; }
    const t0 = performance.now();
    const passo = (agora: number) => {
      const k = Math.min(1, (agora - t0) / 200);
      por(ini + (pos - ini) * (1 - (1 - k) ** 3));
      anim.current = k < 1 ? requestAnimationFrame(passo) : 0;
    };
    anim.current = requestAnimationFrame(passo);
  };
  /** Continua rolando um pouco depois de soltar o dedo (como no resto do sistema). */
  const inercia = (vx: number, vy: number) => {
    const el = area.current;
    if (!el || semMovimento()) return;
    pararAnim();
    let ux = vx, uy = vy, antes = performance.now();
    const passo = (agora: number) => {
      const dt = Math.min(40, agora - antes);
      antes = agora;
      el.scrollLeft += ux * dt;
      el.scrollTop += uy * dt;
      const f = Math.pow(0.94, dt / 16);
      ux *= f; uy *= f;
      anim.current = Math.hypot(ux, uy) > 0.03 ? requestAnimationFrame(passo) : 0;
    };
    anim.current = requestAnimationFrame(passo);
  };
  /** Modo "página inteira": ao soltar, encaixa numa página (vira a folha). */
  const alinharPagina = (velocidade: number, origem: number) => {
    const el = area.current;
    const ini = iniciosPaginas();
    if (!el || !ini.length) return;
    const tam = lateralRef.current ? el.clientWidth : el.clientHeight;
    rolarAte(ini[paginaAoSoltar(posicaoRolagem(), ini, velocidade, tam, origem)], true);
  };
  const alinharAoMaisPerto = () => {
    const ini = iniciosPaginas();
    if (!ini.length) return;
    const pos = posicaoRolagem();
    const i = ini.reduce((m, v, k) => (Math.abs(v - pos) < Math.abs(ini[m] - pos) ? k : m), 0);
    if (Math.abs(ini[i] - pos) > 1) rolarAte(ini[i], true);
  };
  const alinharRef = useRef({ alinharPagina, alinharAoMaisPerto, inercia, pararAnim });
  alinharRef.current = { alinharPagina, alinharAoMaisPerto, inercia, pararAnim };

  useEffect(() => {
    const el = area.current;
    if (!el || infinito) return;
    const det = criarDetectorDeToques();
    // Toques que nunca rolam nem dão zoom: a mão apoiada (área de contato grande)
    // e, com "só caneta", qualquer toque enquanto a caneta encosta e logo depois.
    const ignorados = new Set<number>();
    const canetaRecente = () => caneta.current.encostada.size > 0 || performance.now() - caneta.current.levantou < CANETA_PAUSA_MS;
    const temCaneta = (ev: TouchEvent) => [...ev.touches].some(ehCanetaToque);
    const ehPalma = (tq: Touch) => {
      const d = tamanhoDoToque(tq);
      if (d > PALMA_PX) return true;
      const escrevendo = caneta.current.encostada.size > 0 || performance.now() - caneta.current.levantou < ESCREVENDO_MS;
      return soCanetaRef.current && escrevendo && d > PALMA_ESCREVENDO_PX;
    };
    // Dedos de verdade (a Apple Pencil, no Safari, também gera "toques": fica de fora).
    const dedos = (ev: TouchEvent) => [...ev.touches].filter((tq) => !ehCanetaToque(tq) && !ignorados.has(tq.identifier));
    let pinca: { d0: number; z0: number; mx: number; my: number } | null = null;
    let arrasto: { x: number; y: number; origem: number; amostras: { t: number; x: number; y: number }[] } | null = null;
    const meio = (a: Touch, b: Touch) => {
      const r = el.getBoundingClientRect();
      return { mx: (a.clientX + b.clientX) / 2 - r.left, my: (a.clientY + b.clientY) / 2 - r.top, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1 };
    };
    /** Marca os toques a ignorar; diz se agora nada pode rolar (folha travada). */
    const filtrar = (ev: TouchEvent, novos: Iterable<Touch>) => {
      const recente = soCanetaRef.current && (canetaRecente() || temCaneta(ev));
      for (const tq of novos) {
        if (ehCanetaToque(tq) || ignorados.has(tq.identifier)) continue;
        if (ehPalma(tq) || recente) ignorados.add(tq.identifier);
      }
      return travadaRef.current;
    };
    const comecarArrasto = (tq: Touch) => {
      const agora = performance.now();
      arrasto = { x: tq.clientX, y: tq.clientY, origem: paginaNaPosicao(posicaoRolagem() + 1, iniciosPaginas()), amostras: [{ t: agora, x: tq.clientX, y: tq.clientY }] };
    };
    const inicio = (ev: TouchEvent) => {
      alinharRef.current.pararAnim();
      const agora = performance.now();
      for (const tq of ev.changedTouches) {
        if (ehCanetaToque(tq)) det.cancelar();
        else if (!ehPalma(tq)) det.descer(tq.identifier, tq.clientX, tq.clientY, agora);
      }
      const parado = filtrar(ev, ev.changedTouches);
      const ds = dedos(ev);
      if (ds.length >= 2) multiToque.current = true; // dois dedos nunca desenham
      if (parado) { pinca = null; arrasto = null; return; }
      if (ds.length >= 2) {
        const m = meio(ds[0], ds[1]);
        pinca = { d0: m.d, z0: zoomRef.current, mx: m.mx, my: m.my };
        arrasto = null;
      } else if (ds.length === 1) {
        const alvo = ev.target as Element | null;
        if (alvo?.closest?.("input, textarea, select, button, a, [contenteditable='true'], .caderno-caixa.editando, .caderno-regua-camada, .caderno-sel-acoes")) return;
        // Com "só caneta", o dedo arrasta a folha; sem ela, o dedo risca na folha
        // e só arrasta fora dela (nas margens).
        const naFolha = !!alvo?.closest?.(".caderno-folha-area");
        if (soCanetaRef.current || !naFolha) comecarArrasto(ds[0]);
      }
    };
    const mover = (ev: TouchEvent) => {
      for (const tq of ev.changedTouches) det.mover(tq.identifier, tq.clientX, tq.clientY);
      // Durante a pinça, os dedos não viram "palma" no meio do gesto (o polegar,
      // apertando, aumenta a área de contato e a pinça parava).
      if (!pinca && filtrar(ev, ev.touches)) { pinca = null; arrasto = null; return; }
      if (pinca && travadaRef.current) { pinca = null; return; }
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
        const tq = ds[0];
        el.scrollLeft -= tq.clientX - arrasto.x;
        el.scrollTop -= tq.clientY - arrasto.y;
        arrasto.x = tq.clientX; arrasto.y = tq.clientY;
        const agora = performance.now();
        arrasto.amostras.push({ t: agora, x: tq.clientX, y: tq.clientY });
        while (arrasto.amostras.length > 2 && agora - arrasto.amostras[0].t > 120) arrasto.amostras.shift();
      }
    };
    const fim = (ev: TouchEvent) => {
      const agora = performance.now();
      for (const tq of ev.changedTouches) {
        ignorados.delete(tq.identifier);
        if (ehCanetaToque(tq)) { caneta.current.levantou = agora; continue; }
        const g = det.subir(tq.identifier, agora);
        if (g && gestosRef.current) {
          const a = acaoDoGesto(g, soCanetaRef.current);
          if (a) gestoRef.current(a, g.x, g.y);
        }
      }
      const ds = dedos(ev);
      if (pinca && ds.length < 2) {
        pinca = null;
        // Soltou perto de 100%: volta exatamente para a página inteira.
        if (Math.abs(zoomRef.current - 1) < 0.12 && zoomRef.current !== 1) aplicarZoomRef.current(1, el.clientWidth / 2, el.clientHeight / 2);
        if (ds.length === 1) comecarArrasto(ds[0]);
        if (ev.touches.length === 0 && paginandoRef.current) setTimeout(() => alinharRef.current.alinharAoMaisPerto(), 0);
      } else if (arrasto && ds.length === 0) {
        const a = arrasto;
        arrasto = null;
        const am = a.amostras.filter((x) => agora - x.t < 120);
        let vx = 0, vy = 0;
        if (am.length >= 2) {
          const p0 = am[0], p1 = am[am.length - 1], dt = Math.max(8, p1.t - p0.t);
          vx = -(p1.x - p0.x) / dt; vy = -(p1.y - p0.y) / dt;
        }
        // Puxou além da última página o bastante: cria a página nova (e vai para ela).
        if (soltarRef.current()) return;
        if (paginandoRef.current) alinharRef.current.alinharPagina(lateralRef.current ? vx : vy, a.origem);
        else alinharRef.current.inercia(vx, vy);
      }
      if (ev.touches.length === 0) { multiToque.current = false; ignorados.clear(); }
    };
    // A caneta por eventos de ponteiro (vale em qualquer navegador).
    const canetaDesce = (ev: PointerEvent) => { if (ev.pointerType === "pen") { caneta.current.encostada.add(ev.pointerId); det.cancelar(); } };
    const canetaSobe = (ev: PointerEvent) => {
      if (ev.pointerType !== "pen" || !caneta.current.encostada.delete(ev.pointerId)) return;
      caneta.current.levantou = performance.now();
    };
    // Ctrl + roda (e a pinça do touchpad, que chega assim): zoom no cursor.
    const roda = (ev: WheelEvent) => {
      alinharRef.current.pararAnim();
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
      cancelAnimationFrame(anim.current);
    };
  }, [infinito]);
  // Tamanho útil da área (para a página caber inteira na tela).
  const [alturaArea, setAlturaArea] = useState(0);
  const [larguraArea, setLarguraArea] = useState(0);
  useEffect(() => {
    const el = area.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => { setAlturaArea(el.clientHeight); setLarguraArea(el.clientWidth); };
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    medir();
    return () => ro.disconnect();
  }, [infinito]);
  // "Página inteira" (ou rolagem lateral): cada página ocupa a área toda; no zoom
  // 100%, soltar a rolagem vira a página. "Largura toda": rola livre.
  const modoPagina = lateral || (encaixe === "pagina" && !documento);
  const paginando = modoPagina && Math.abs(zoom - 1) < 0.02;
  paginandoRef.current = paginando;
  const larguraNaTela = (pg: PaginaCaderno) => (larguraArea && alturaArea
    ? larguraDaPagina({ largura: larguraArea, altura: alturaArea }, medidaDe(pg.tamanho), lateral ? "pagina" : encaixe, lateral) * zoom
    : 0);
  const blocoNaTela = modoPagina && larguraArea && alturaArea ? { largura: larguraArea * zoom, altura: alturaArea * zoom } : null;
  // Ao mudar o tamanho da área, a rotação do iPad ou o modo, volta a encaixar na página atual.
  const selIdRef = useRef(selId);
  selIdRef.current = selId;
  useLayoutEffect(() => {
    if (!paginando) return;
    const el = area.current;
    const b = el?.querySelector<HTMLElement>(`#pg-${selIdRef.current}`);
    if (!el || !b) return;
    if (lateral) el.scrollLeft = b.offsetLeft; else el.scrollTop = b.offsetTop;
  }, [larguraArea, alturaArea, paginando, lateral, encaixe]);

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
    const nova = comDocumento(selId, h.pilha[i]);
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
  /** Ordem de uma página nova (antes ou depois de `ref`, ou no fim = 0, que o banco resolve). */
  const ordemPara = (onde: OndeNova, ref: PaginaCaderno | undefined): number => {
    const i = ref ? paginas.findIndex((p) => p.id === ref.id) : -1;
    if (onde === "fim" || i < 0) return 0;
    const os = paginas.map((p) => p.ordem);
    if (onde === "depois") return i + 1 < os.length ? (os[i] + os[i + 1]) / 2 : 0;
    if (i > 0) return (os[i - 1] + os[i]) / 2;
    const v = os[0] > 0 ? os[0] / 2 : os[0] - 1;
    return v === 0 ? -1 : v;
  };
  const adicionar = async (rolar = true, onde: OndeNova = "fim", tamanhoNovo?: string, papelNovo?: Papel) => {
    if (criando.current) return; // evita criar duas de uma vez (toque duplo, rolagem)
    criando.current = true;
    try {
      // A página nova herda a folha e o tamanho da página de referência (a atual, ou a
      // última quando vai no fim): mantém o estilo do caderno. A capa nunca é herdada.
      const base = onde === "fim" ? paginas[paginas.length - 1] : sel;
      const papel = papelNovo ?? (base ? semCapa(folhaDe(base)) : papelPadrao());
      const tam = tamanhoNovo ?? (base && base.tamanho !== "infinito" ? base.tamanho : "a4");
      const nova = await api.salvarPaginaCaderno({ id: "", cadernoId: caderno.id, ordem: ordemPara(onde, base), tamanho: tam, papel, titulo: "", marcado: false, criadoEm: 0 });
      if (nova?.id && rolar) { setSelId(nova.id); rolarPara.current = nova.id; }
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      criando.current = false;
    }
  };
  /** Duplica a página logo depois dela (com tudo o que tem). */
  const duplicar = async (id: string) => {
    const pg = paginas.find((p) => p.id === id);
    if (!pg) return;
    try {
      const nova = await api.salvarPaginaCaderno({ ...pg, id: "", ordem: ordemPara("depois", pg), titulo: pg.titulo, marcado: false, criadoEm: 0 });
      const cena = cenasRef.current[id];
      if (cena) await api.salvarCenaCaderno(nova.id, serializarCena(cena));
      if (pg.titulo) await api.salvarPaginaCaderno({ ...nova, titulo: pg.titulo });
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  /** Passa a página uma posição para trás (−1) ou para a frente (+1). */
  const moverPagina = async (id: string, passo: -1 | 1) => {
    const i = paginas.findIndex((p) => p.id === id);
    const j = i + passo;
    if (i < 0 || j < 0 || j >= paginas.length) return;
    const os = paginas.map((p) => p.ordem);
    let nova: number;
    if (passo < 0) nova = j > 0 ? (os[j - 1] + os[j]) / 2 : os[j] > 0 ? os[j] / 2 : os[j] - 1;
    else nova = j + 1 < os.length ? (os[j] + os[j + 1]) / 2 : os[j] + 1;
    if (nova === 0) nova = -1;
    await salvar({ ...paginas[i], ordem: nova });
    await carregar();
  };
  useEffect(() => {
    const id = rolarPara.current;
    if (!id || !paginas.some((p) => p.id === id)) return;
    rolarPara.current = "";
    irParaRef.current(id);
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
  /** Soltou depois de puxar o bastante: cria a página nova e vai para ela. */
  const soltarPuxado = () => {
    if (medirPuxado() >= LIMIAR_PUXAR && podePuxar() && !criando.current) { void adicionar(); return true; }
    return false;
  };
  const soltarRef = useRef(soltarPuxado);
  soltarRef.current = soltarPuxado;
  // A página que está na tela vira a "atual": é nela que a folha, o desfazer e
  // a régua agem (antes ficava presa à primeira página tocada).
  const quadroRolar = useRef(0);
  const marcarPaginaVisivel = () => {
    const el = area.current;
    if (!el) return;
    const ini = iniciosPaginas();
    if (!ini.length) return;
    const meio = posicaoRolagem() + (lateral ? el.clientWidth : el.clientHeight) / 2;
    const pg = paginas[paginaNaPosicao(meio, ini)];
    if (pg && pg.id !== selIdRef.current) setSelId(pg.id);
  };
  const aoRolar = () => {
    medirPuxado();
    if (!quadroRolar.current) quadroRolar.current = requestAnimationFrame(() => { quadroRolar.current = 0; marcarPaginaVisivel(); });
    clearTimeout(ociosoTimer.current);
    // Roda do mouse, teclado ou rolagem que segue depois de soltar: decide
    // quando a rolagem para. Com o dedo na tela, espera ele sair.
    if (dedosNaTela.current === 0) ociosoTimer.current = setTimeout(() => {
      if (soltarRef.current()) return;
      if (paginandoRef.current && !anim.current) alinharRef.current.alinharAoMaisPerto();
    }, 280);
  };
  useEffect(() => {
    const el = area.current;
    if (!el || infinito) return;
    const conta = (ev: TouchEvent) => { dedosNaTela.current = ev.touches.length; };
    const solta = (ev: TouchEvent) => { dedosNaTela.current = ev.touches.length; };
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
      // Folha aplicada a várias páginas nunca leva a capa; a página-capa mantém a dela.
      for (const pg of alvos) {
        const capa = alvo === "atual" ? (papel as PapelPagina).capa : capaDaPagina(pg);
        await api.salvarPaginaCaderno({ ...pg, papel: capa ? { ...semCapa(papel), capa } : semCapa(papel) });
      }
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  const irPara = (id: string, suave = false) => {
    setSelId(id);
    const el = area.current;
    const b = el?.querySelector<HTMLElement>(`#pg-${id}`);
    if (!el || !b) return;
    // No modo "largura toda", a página começa um pouco abaixo do topo (com folga).
    const folga = paginandoRef.current || modoPagina ? 0 : 12;
    rolarAte(Math.max(0, (lateral ? b.offsetLeft : b.offsetTop) - folga), suave);
  };
  const irParaRef = useRef(irPara);
  irParaRef.current = irPara;
  // Com a folha travada, troca de página pelos botões (ou pelo índice).
  const indiceSel = Math.max(0, paginas.findIndex((p) => p.id === selId));
  const irRelativo = (passo: number) => {
    const alvo = paginas[indiceSel + passo];
    if (alvo) irPara(alvo.id, true);
  };

  // Gestos (dois dedos desfazem, três refazem…) e atalhos de teclado.
  gestoRef.current = (a, x, y) => {
    if (a === "desfazer") { if (podeDesfazer) { andar(-1); recado(t.gestos.desfeito); } else recado(t.gestos.nadaDesfazer); }
    else if (a === "refazer") { if (podeRefazer) { andar(1); recado(t.gestos.refeito); } else recado(t.gestos.nadaRefazer); }
    else if (a === "tela-limpa") { if (!telaLimpa) recado(t.gestos.telaLimpa); setTelaLimpa(!telaLimpa); }
    else if (a === "zoom") {
      const el = area.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (zoomRef.current > 1.05) aplicarZoom(1, el.clientWidth / 2, el.clientHeight / 2);
      else aplicarZoom(2, x - r.left, y - r.top);
    }
  };
  const tecladoRef = useRef<(e: KeyboardEvent) => void>(() => {});
  tecladoRef.current = (e: KeyboardEvent) => {
    const alvo = e.target as HTMLElement | null;
    if (alvo?.closest?.("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (e.key === "Escape" && telaLimpa) { setTelaLimpa(false); return; }
    if (ctrl && k === "z" && !e.shiftKey) { e.preventDefault(); andar(-1); return; }
    if (ctrl && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); andar(1); return; }
    const el = area.current;
    if (ctrl && (e.key === "=" || e.key === "+") && el) { e.preventDefault(); aplicarZoom(zoomRef.current * 1.25, el.clientWidth / 2, el.clientHeight / 2); return; }
    if (ctrl && e.key === "-" && el) { e.preventDefault(); aplicarZoom(zoomRef.current / 1.25, el.clientWidth / 2, el.clientHeight / 2); return; }
    if (ctrl && e.key === "0") { e.preventDefault(); voltarZoom(); return; }
    if (!ctrl && !e.altKey && (e.key === "PageDown" || e.key === "PageUp")) { e.preventDefault(); irRelativo(e.key === "PageDown" ? 1 : -1); }
  };
  useEffect(() => {
    if (infinito) return;
    const ouvir = (e: KeyboardEvent) => tecladoRef.current(e);
    window.addEventListener("keydown", ouvir);
    return () => window.removeEventListener("keydown", ouvir);
  }, [infinito]);

  // IA do caderno: o que vai junto do pedido e onde pôr a resposta.
  const obterContextoIa = async (alcance: Alcance, comImagem: boolean): Promise<ContextoIa> => {
    if (alcance === "caderno") {
      const texto = paginas.map((p, i) => { const v = textoDaCena(cenas[p.id]); return v ? `--- Página ${i + 1} ---\n${v}` : ""; }).filter(Boolean).join("\n\n");
      return { texto, imagens: [] };
    }
    if (!sel) return { texto: "", imagens: [] };
    const texto = textoDaCena(cenas[sel.id]);
    if (!comImagem) return { texto, imagens: [] };
    const [medida] = await medirParaExportar([sel.id]);
    const { gerarPng } = await import("../exportar/imagem");
    return { texto, imagens: [await blobParaDataUrl(await gerarPng(medida, 1.25))] };
  };
  const temDesenhoNaPagina = !!sel && (cenas[sel.id]?.elementos ?? []).some((e) => e.tipo !== "texto");
  const porEmPaginaNova = async (html: string) => {
    const base = sel ?? paginas[paginas.length - 1];
    try {
      const nova = await api.salvarPaginaCaderno({
        id: "", cadernoId: caderno.id, ordem: ordemPara("depois", base), tamanho: base && base.tamanho !== "infinito" ? base.tamanho : "a4",
        papel: { ...semCapa(base ? folhaDe(base) : papelPadrao()), texto: true } as Papel, titulo: "", marcado: false, criadoEm: 0,
      });
      await api.salvarCenaCaderno(nova.id, serializarCena({ ...cenaVazia(), documento: html }));
      setSelId(nova.id); rolarPara.current = nova.id;
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  // Mapa mental: numa página nova deitada (A4 de lado), lisa, com caixas e linhas presas.
  const desenharMapaMental = async (html: string) => {
    const mapa = lerMapa(html);
    if (!mapa) { recado(t.ia.semMapa); return; }
    const base = sel ?? paginas[paginas.length - 1];
    const larg = 1123, alt = 794;
    try {
      const nova = await api.salvarPaginaCaderno({
        id: "", cadernoId: caderno.id, ordem: ordemPara("depois", base), tamanho: `custom:${larg}x${alt}`,
        papel: { ...semCapa(base ? folhaDe(base) : papelPadrao()), modelo: "liso", texto: false } as Papel, titulo: mapa.texto.slice(0, 60), marcado: false, criadoEm: 0,
      });
      await api.salvarCenaCaderno(nova.id, serializarCena({ ...cenaVazia(), elementos: ajustarConectores(elementosDoMapa(mapa, larg, alt), MEDIDA) }));
      // Ao criar, o banco não grava o título: grava depois.
      if (mapa.texto) await api.salvarPaginaCaderno({ ...nova, titulo: mapa.texto.slice(0, 60) });
      setSelId(nova.id); rolarPara.current = nova.id;
      await carregar();
      recado(t.ia.postoMapa);
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  // Biblioteca: guardar a seleção ou a página; pôr de volta.
  const tb = t.biblioteca;
  const dataCurta = () => new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  const guardarSelecaoNaBiblioteca = async () => {
    const els = (cenas[selPid]?.elementos ?? []).filter((e) => selIds.includes(e.id));
    const lim = limitesDe(els, MEDIDA.altura, MEDIDA.largura);
    if (!els.length || !lim) return;
    const pad = 8;
    const caixa = { x: lim.x - pad, y: lim.y - pad, largura: lim.largura + pad * 2, altura: lim.altura + pad * 2 };
    await guardarNaBiblioteca(tb.nomeSelecao(dataCurta()), "objetos", { cena: cenaParaGuardar(normalizarObjetos(els, caixa)), largura: Math.round(caixa.largura), altura: Math.round(caixa.altura) });
  };
  const guardarPaginaNaBiblioteca = async () => {
    if (!sel) return;
    const c = cenas[sel.id] ?? cenaVazia();
    await guardarNaBiblioteca(tb.nomePagina(sel.titulo || t.posicao(indiceSel + 1, paginas.length)), "pagina", { cena: cenaParaGuardar(c), tamanho: sel.tamanho, papel: sel.papel });
  };
  const usarDaBiblioteca = async (item: ItemBiblioteca, d: DadosBiblioteca) => {
    if (item.tipo === "trecho") { if (d.html) porNaPagina(d.html); return; }
    const c = d.cena ? lerCena(d.cena) : null;
    if (!c) return;
    if (item.tipo === "objetos") {
      if (!sel) return;
      const med = medidaDe(sel.tamanho);
      const dx = Math.max(20, Math.round((med.largura - (d.largura ?? 0)) / 2));
      const novos = copiarElementos(c.elementos, dx, 60);
      mudarCena(sel.id, { elementos: ajustarConectores([...(cenas[sel.id]?.elementos ?? []), ...novos], MEDIDA) });
      // Já fica selecionado, para mover para o lugar certo.
      setFerramenta("selecao"); setSelPid(sel.id); setSelIds(novos.map((e) => e.id));
      return;
    }
    const base = sel ?? paginas[paginas.length - 1];
    try {
      const nova = await api.salvarPaginaCaderno({ id: "", cadernoId: caderno.id, ordem: ordemPara("depois", base), tamanho: d.tamanho || "a4", papel: d.papel ?? papelPadrao(), titulo: "", marcado: false, criadoEm: 0 });
      await api.salvarCenaCaderno(nova.id, serializarCena({ ...c, elementos: copiarElementos(c.elementos, 0, 0) }));
      setSelId(nova.id); rolarPara.current = nova.id;
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  // Corretor da escrita à mão: as palavras erradas ficam sublinhadas na página.
  const [correcao, setCorrecao] = useState<{ pid: string; marcas: MarcaEscrita[] } | null>(null);
  const conferirEscrita = async (sensivel: boolean) => {
    if (!sel) return;
    const palavras = palavrasDaPagina(cenas[sel.id]?.elementos ?? []);
    if (!palavras.length) { recado(t.correcao.semEscrita); return; }
    if (palavras.length > 400) { recado(t.correcao.demais); return; }
    const [medida] = await medirParaExportar([sel.id]);
    const { gerarPng } = await import("../exportar/imagem");
    const esc = 1.5;
    const imagem = await imagemComCaixas(await gerarPng(medida, esc), palavras, esc);
    const r = await api.conferirEscritaIa(imagem, palavras.length, sensivel);
    const marcas = r.flatMap((c) => { const p = palavras[c.n - 1]; return p ? [{ ...p, lido: c.lido, sugestoes: c.sugestoes }] : []; });
    setCorrecao({ pid: sel.id, marcas });
    recado(marcas.length ? t.correcao.achou(marcas.length) : t.correcao.nada);
  };
  const corrigirPalavra = (m: MarcaEscrita, palavra: string) => {
    if (!correcao) return;
    const pid = correcao.pid;
    // A letra cursiva (Caveat) tem o "miolo" baixo: um tamanho um pouco maior que a altura da palavra escrita.
    const tamanho = Math.max(14, Math.round(m.h * 1.35));
    const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const novo: Texto = { tipo: "texto", id: crypto.randomUUID(), x: Math.round(m.x), y: Math.round(m.y - tamanho * 0.25), largura: Math.round(Math.max(m.w + 24, palavra.length * tamanho * 0.45)), texto: `<p>${esc(palavra)}</p>`, cor: m.cor, tamanho, fonte: "cursiva" };
    mudarCena(pid, { elementos: [...(cenas[pid]?.elementos ?? []).filter((e) => !m.ids.includes(e.id)), novo] });
    setCorrecao((c) => (c ? { ...c, marcas: c.marcas.filter((x) => x.n !== m.n) } : c));
  };
  // As marcas só valem enquanto os traços da palavra continuam na página.
  const marcasVivas = correcao ? correcao.marcas.filter((m) => { const ids = new Set((cenas[correcao.pid]?.elementos ?? []).map((e) => e.id)); return m.ids.every((id) => ids.has(id)); }) : [];

  const porNaPagina = (html: string) => {
    if (!sel) return;
    const med = medidaDe(sel.tamanho);
    const novo: Texto = { tipo: "texto", id: crypto.randomUUID(), x: 60, y: 60, largura: Math.max(240, med.largura - 120), texto: html, cor: "#1f2937", tamanho: tamTexto };
    mudarCena(sel.id, { elementos: [...(cenas[sel.id]?.elementos ?? []), novo] });
  };

  // IA com liberdade total (decisão de Dan, 04/11/2026): a IA muda o caderno direto.
  // Antes, o Órbita guarda uma cópia do que ela vai mexer (gravada junto com o caderno);
  // "Desfazer tudo o que a IA fez" volta ao que era.
  const chaveReversao = `caderno.ia.desfazer.${caderno.id}`;
  const [reversoes, setReversoes] = useState<ReversaoIa<PaginaCaderno>[]>([]);
  const [confirmarDesfazer, setConfirmarDesfazer] = useState(false);
  useEffect(() => { api.lerValor(chaveReversao).then((v) => setReversoes(lerReversoes<PaginaCaderno>(v)), () => {}); }, [chaveReversao]);
  const guardarReversoes = (lista: ReversaoIa<PaginaCaderno>[]) => {
    setReversoes(lista);
    // Cabe no valor guardado (até 2 MB): as mais antigas saem primeiro.
    let l = lista.slice(0, 5);
    while (l.length > 1 && JSON.stringify(l).length > 1_800_000) l = l.slice(0, -1);
    if (JSON.stringify(l).length > 1_800_000) l = [];
    void (l.length ? api.gravarValor(chaveReversao, l) : api.apagarValor(chaveReversao)).catch(() => {});
  };
  /** A cena da página, carregando do banco se ainda não veio. */
  const cenaCarregada = async (pid: string): Promise<Cena> => {
    const c = cenasRef.current[pid];
    if (c) return c;
    const lida = lerCena(await api.carregarCenaCaderno(pid));
    carregadas.current.add(pid);
    cenasRef.current = { ...cenasRef.current, [pid]: lida };
    setCenas((m) => ({ ...m, [pid]: lida }));
    setHistoria((h) => ({ ...h, [pid]: { pilha: [lida], i: 0 } }));
    return lida;
  };
  /** Troca a cena inteira (com o texto da página) e grava já. */
  const trocarCena = async (pid: string, nova: Cena) => {
    cenasRef.current = { ...cenasRef.current, [pid]: nova };
    setCenas((m) => ({ ...m, [pid]: nova }));
    registrarCena(pid, nova);
    clearTimeout(timers.current[pid]);
    await api.salvarCenaCaderno(pid, serializarCena(nova));
  };
  const criarPaginaDaIa = async (m: Extract<Mudanca, { op: "nova_pagina" | "mapa" }>, base: PaginaCaderno | undefined, ordem: number): Promise<string> => {
    const folha = semCapa(base ? folhaDe(base) : papelPadrao());
    const mm = m.op === "mapa" ? lerMapa(m.html) : null;
    if (mm) {
      const larg = 1123, alt = 794;
      const nova = await api.salvarPaginaCaderno({ id: "", cadernoId: caderno.id, ordem, tamanho: `custom:${larg}x${alt}`, papel: { ...folha, modelo: "liso", texto: false } as Papel, titulo: "", marcado: false, criadoEm: 0 });
      await api.salvarCenaCaderno(nova.id, serializarCena({ ...cenaVazia(), elementos: ajustarConectores(elementosDoMapa(mm, larg, alt), MEDIDA) }));
      await api.salvarPaginaCaderno({ ...nova, titulo: (m.titulo || mm.texto).slice(0, 60) });
      return nova.id;
    }
    const nova = await api.salvarPaginaCaderno({ id: "", cadernoId: caderno.id, ordem, tamanho: base && base.tamanho !== "infinito" ? base.tamanho : "a4", papel: { ...folha, texto: true } as Papel, titulo: "", marcado: false, criadoEm: 0 });
    await api.salvarCenaCaderno(nova.id, serializarCena({ ...cenaVazia(), documento: m.html }));
    if (m.titulo) await api.salvarPaginaCaderno({ ...nova, titulo: m.titulo });
    return nova.id;
  };
  const meusEstilosAgora = useMeusEstilos();
  // Fontes do caderno (aba Fontes): a aba IA pode usar os trechos que importam.
  const [temFontes, setTemFontes] = useState(false);
  useEffect(() => { void lerFontes(caderno.id).then((l) => setTemFontes(l.some((f) => f.ligada && !f.semTexto))); }, [caderno.id, painel]);
  const trechosDasFontes = async (pedido: string): Promise<string> => {
    const lista = await lerFontes(caderno.id);
    const usaveis = lista.map((f) => f.ligada && !f.semTexto);
    if (!usaveis.some(Boolean)) return "";
    const listas = await Promise.all(lista.map((f, i) => (usaveis[i] ? lerTrechos(f) : Promise.resolve([]))));
    let achados = buscar(listas, pedido, 10, 5);
    if (!achados.length) achados = amostrar(listas, 30_000);
    return montarTrechos(achados, lista.map((f) => f.nome), 40_000);
  };
  const agirComIa = async (pedido: string, alcance: Alcance, imagens: string[], sensivel: boolean, usarFontes = false) => {
    const atual = sel ?? paginas[0];
    if (!atual) return { resposta: "", feitas: 0 };
    const todas = alcance === "caderno";
    for (const p of todas ? paginas : [atual]) await cenaCarregada(p.id);
    const lista: PaginaParaIa[] = paginas.map((p) => ({ id: p.id, titulo: p.titulo, texto: ehPaginaTexto(p), modelo: folhaDe(p).modelo, ...medidaDe(p.tamanho), marcada: p.marcado }));
    const { descricao, mapa } = descreverCaderno(lista, cenasRef.current, atual.id, todas, meusEstilosAgora, caderno.nome);
    const plano = await api.iaCadernoAgir(pedido, descricao, imagens, sensivel, usarFontes ? await trechosDasFontes(pedido) : "");
    const mudancas = lerMudancas(plano.mudancas, paginas.length, mapa);
    if (!mudancas.length) return { resposta: plano.resposta, feitas: 0 };
    // Toda página que a IA vai mexer precisa estar carregada (senão a cópia sairia vazia).
    for (const n of new Set(mudancas.flatMap((m) => ("pagina" in m ? [m.pagina] : [])))) await cenaCarregada(paginas[n - 1].id);
    const { cenas: novas, viraTexto } = aplicarNasCenas(mudancas, lista, cenasRef.current, mapa, undefined, tamTexto);
    const arranjo = arranjoDasPaginas(paginas, mudancas);
    const apagadas = new Set(arranjo.apagadas);
    // O que muda em cada página (título, marcador, folha, lugar).
    const meta = new Map<string, PaginaCaderno>();
    const mexer = (pg: PaginaCaderno) => { const at = meta.get(pg.id) ?? { ...pg }; meta.set(pg.id, at); return at; };
    for (const m of mudancas) {
      const pg = "pagina" in m ? paginas[m.pagina - 1] : undefined;
      if (!pg) continue;
      if (m.op === "titulo_pagina") mexer(pg).titulo = m.titulo;
      else if (m.op === "marcar_pagina") mexer(pg).marcado = m.marcada;
      else if (m.op === "folha") { const at = mexer(pg); at.papel = { ...folhaDe(at), ...(m.modelo ? { modelo: m.modelo as ModeloPapel } : {}), ...(m.corPapel ? { corPapel: m.corPapel } : {}), ...(m.corLinha ? { corLinha: m.corLinha } : {}) } as Papel; }
    }
    for (const pid of viraTexto) { const pg = paginas.find((p) => p.id === pid); if (pg) { const at = mexer(pg); at.papel = { ...folhaDe(at), texto: true } as Papel; } }
    for (const [id, ordem] of arranjo.ordens) { const pg = paginas.find((p) => p.id === id); if (pg) mexer(pg).ordem = ordem; }
    // A cópia de antes.
    const rev: ReversaoIa<PaginaCaderno> = { resumo: pedido.trim().slice(0, 80), quando: Date.now(), paginas: [], cenas: {}, depois: {}, criadas: [], apagadas: [...apagadas] };
    for (const id of new Set([...meta.keys(), ...apagadas])) { const pg = paginas.find((p) => p.id === id); if (pg) rev.paginas.push({ ...pg }); }
    for (const pid of new Set([...Object.keys(novas), ...apagadas])) rev.cenas[pid] = serializarCena(cenasRef.current[pid] ?? cenaVazia());
    let primeiraNova = "";
    try {
      for (const [pid, nova] of Object.entries(novas)) {
        if (apagadas.has(pid)) continue;
        await trocarCena(pid, nova);
        rev.depois[pid] = marcaDaCena(nova);
      }
      for (const pg of meta.values()) if (!apagadas.has(pg.id)) await api.salvarPaginaCaderno(pg);
      for (const id of apagadas) await api.excluirPaginaCaderno(id);
      for (const [i, ordem] of [...arranjo.novas].sort((a, b) => a[0] - b[0])) {
        const m = mudancas[i] as Extract<Mudanca, { op: "nova_pagina" | "mapa" }>;
        const id = await criarPaginaDaIa(m, m.depois > 0 ? paginas[m.depois - 1] : atual, ordem);
        rev.criadas.push(id);
        primeiraNova ||= id;
      }
    } finally {
      guardarReversoes([rev, ...reversoes]);
      if (primeiraNova) { setSelId(primeiraNova); rolarPara.current = primeiraNova; }
      await carregar();
      avisarMudanca();
    }
    return { resposta: plano.resposta, feitas: mudancas.length };
  };
  /** A pessoa mexeu depois da IA nalguma página que ela mudou? */
  const mexeuDepoisDaIa = (r: ReversaoIa<PaginaCaderno>) =>
    Object.entries(r.depois).some(([pid, marca]) => { const c = cenasRef.current[pid]; return !!c && marcaDaCena(c) !== marca; });
  const desfazerIa = async () => {
    const [r, ...resto] = reversoes;
    if (!r) return;
    const trocas = new Map<string, string>();
    try {
      for (const id of r.criadas) await api.excluirPaginaCaderno(id).catch(() => {});
      for (const orig of r.paginas) {
        if (r.apagadas.includes(orig.id)) {
          // Volta a página apagada (com outro id), no mesmo lugar e com tudo o que tinha.
          const nova = await api.salvarPaginaCaderno({ ...orig, id: "", criadoEm: 0 });
          await api.salvarPaginaCaderno({ ...nova, titulo: orig.titulo, marcado: orig.marcado, papel: orig.papel, ordem: orig.ordem });
          const c = r.cenas[orig.id];
          if (c) await api.salvarCenaCaderno(nova.id, c);
          trocas.set(orig.id, nova.id);
        } else if (paginas.some((p) => p.id === orig.id)) {
          await api.salvarPaginaCaderno(orig);
        }
      }
      for (const [pid, txt] of Object.entries(r.cenas)) {
        if (r.apagadas.includes(pid) || !paginas.some((p) => p.id === pid)) continue;
        await trocarCena(pid, lerCena(txt));
      }
      guardarReversoes(resto.map((x) => trocarIdsDaReversao(x, trocas)));
      recado(t.ia.desfeito);
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      await carregar();
      avisarMudanca();
    }
  };
  const pedirDesfazerIa = () => {
    const r = reversoes[0];
    if (!r) return;
    if (mexeuDepoisDaIa(r)) setConfirmarDesfazer(true);
    else void desfazerIa();
  };

  const te = t.enviar;
  const exportarCaderno = async (id: string): Promise<ArquivoPronto | null> => {
    const alvo = id === "cadernoPdf" ? paginas : sel ? [sel] : [];
    if (!alvo.length) return null;
    // Tudo carregado? (cenas e imagens de cada página)
    const faltaImagem = alvo.some((p) => (cenas[p.id]?.elementos ?? []).some((e) => e.tipo === "imagem" && !imagemUrl(e.anexoId)));
    if (alvo.some((p) => !cenas[p.id]) || faltaImagem) { recado(te.carregando); return null; }
    const medidas = await medirParaExportar(alvo.map((p) => p.id));
    const sufixo = id === "cadernoPdf" ? "" : ` - ${t.posicao(indiceSel + 1, paginas.length)}`;
    if (id === "paginaPng") {
      const { gerarPng } = await import("../exportar/imagem");
      const png = await gerarPng(medidas[0], 2);
      return { nome: nomeDeArquivo(`${caderno.nome}${sufixo}`, "png"), tipo: "image/png", dados: png, filtro: { nome: "PNG", extensao: "png" } };
    }
    const { gerarPdf } = await import("../exportar/pdf");
    const r = await gerarPdf(medidas, { titulo: caderno.nome });
    return {
      nome: nomeDeArquivo(`${caderno.nome}${sufixo}`, "pdf"), tipo: "application/pdf", dados: r.bytes, filtro: { nome: "PDF", extensao: "pdf" },
      aviso: r.aproximadas.length ? te.aproximadas(r.aproximadas.join(", ")) : undefined,
    };
  };

  return (
    <div className="caderno-tela" style={temaCaderno.estilo}>
      {exportando && (
        <div ref={caixaExportar} className="caderno-exportar" aria-hidden="true">
          {exportando.ids.map((id) => {
            const p = paginas.find((x) => x.id === id);
            return p ? <MiniaturaPagina key={id} pagina={p} cena={cenas[id]} imagemUrl={imagemUrl} largura={medidaDe(p.tamanho).largura} /> : null;
          })}
        </div>
      )}
      {!telaLimpa && (
      <div className="leitor-barra caderno-barra-topo">
        <Button className="botao-icone" onPress={aoFechar} aria-label={t.voltarEstante}><ChevronLeft aria-hidden="true" size="1.2em" /></Button>
        {!infinito && <Button className={painel ? "botao-icone ativo" : "botao-icone"} onPress={() => setPainel(painel ? null : "paginas")} aria-label={t.painel.alternar} aria-pressed={!!painel}><IconePainel aria-hidden="true" size="1.1em" /></Button>}
        {!infinito && <Button className={visaoPaginas ? "botao-icone ativo" : "botao-icone"} onPress={() => setVisaoPaginas((v) => !v)} aria-label={t.visao.abrir} aria-pressed={visaoPaginas}><LayoutGrid aria-hidden="true" size="1.1em" /></Button>}
        <strong className="leitor-titulo quebra">
          {infinito ? <LayoutGrid aria-hidden="true" size="1em" /> : documento ? <FileText aria-hidden="true" size="1em" /> : <PenLine aria-hidden="true" size="1em" />} {caderno.nome}
        </strong>
        <span className="linha-ajuste">
          {!infinito && zoom !== 1 && (
            <Button className="botao pequeno caderno-zoom" onPress={voltarZoom} aria-label={t.zoom.voltar(Math.round(zoom * 100))}>{Math.round(zoom * 100)}%</Button>
          )}
          {!infinito && paginas.length > 0 && (
            <span className="caderno-paginador">
              <Button className="botao-icone" onPress={() => irRelativo(-1)} isDisabled={indiceSel <= 0} aria-label={t.trava.anterior}><ChevronLeft aria-hidden="true" size="1.1em" /></Button>
              <Button className="caderno-pagina-atual" onPress={() => setVisaoPaginas(true)} aria-label={`${t.posicaoRotulo(indiceSel + 1, paginas.length)}. ${t.visao.abrir}`}>
                {paginas[indiceSel]?.marcado && <Bookmark aria-hidden="true" size="0.85em" />}{t.posicao(indiceSel + 1, paginas.length)}
              </Button>
              <Button className="botao-icone" onPress={() => irRelativo(1)} isDisabled={indiceSel >= paginas.length - 1} aria-label={t.trava.proxima}><ChevronRight aria-hidden="true" size="1.1em" /></Button>
            </span>
          )}
          {!infinito && sel && (
            <Button className={sel.marcado ? "botao-icone ativo" : "botao-icone"} onPress={() => void salvar({ ...sel, marcado: !sel.marcado })} aria-pressed={sel.marcado} aria-label={sel.marcado ? t.paginas.desmarcar : t.paginas.marcar}><Bookmark aria-hidden="true" size="1.1em" /></Button>
          )}
          {!infinito && <Button className="botao-icone" onPress={() => setAdicionando(true)} aria-label={t.adicionar.abrir}><FilePlus aria-hidden="true" size="1.1em" /></Button>}
          {!infinito && <Button className={painel === "ia" ? "botao-icone ativo" : "botao-icone"} onPress={() => setPainel(painel === "ia" ? null : "ia")} aria-label={t.painel.abrirIa} aria-pressed={painel === "ia"}><Sparkles aria-hidden="true" size="1.1em" /></Button>}
          {!infinito && paginas.length > 0 && <MenuEnviar opcoes={[{ id: "cadernoPdf", nome: te.cadernoPdf }, { id: "paginaPdf", nome: te.paginaPdf }, { id: "paginaPng", nome: te.paginaPng }]} aoEscolher={exportarCaderno} />}
          <Button className="botao-icone" onPress={() => setEditor(true)} aria-label={t.folha.abrir}><SlidersHorizontal aria-hidden="true" size="1.1em" /></Button>
          <Button className="botao-icone" onPress={() => setConfigAberta(true)} aria-label={t.config.abrir}><IconeEngrenagem aria-hidden="true" size="1.1em" /></Button>
        </span>
      </div>
      )}

      {abas.length > 1 && !telaLimpa && (
        <div className="caderno-abas" role="tablist" aria-label={t.abas}>
          {abas.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === caderno.id}
              className={c.id === caderno.id ? "caderno-aba atual" : "caderno-aba"}
              onClick={() => c.id !== caderno.id && aoTrocar(c)}>
              {c.modo === "infinito" ? <LayoutGrid aria-hidden="true" size="0.9em" /> : c.modo === "documento" ? <FileText aria-hidden="true" size="0.9em" /> : <PenLine aria-hidden="true" size="0.9em" />}
              <span className="quebra">{c.nome}</span>
            </button>
          ))}
        </div>
      )}

      {erro && <div className="leitor-aviso"><Aviso>{erro}</Aviso></div>}
      <Confirmar titulo={t.ia.desfazerTitulo} texto={t.ia.desfazerDepois} confirmar={t.ia.desfazerMesmo} aberta={confirmarDesfazer}
        aoCancelar={() => setConfirmarDesfazer(false)} aoConfirmar={() => { setConfirmarDesfazer(false); void desfazerIa(); }} />

      <div className={`caderno-miolo pos-${posBarra}`} ref={mioloRef}>
      <div className={painel && !infinito ? `caderno-area com-painel painel-${ladoPainel}` : "caderno-area"}>
        {painel && !infinito && (
          <PainelLateral aba={painel} aoAba={setPainel} aoFechar={() => setPainel(null)} paginas={paginas} atualId={selId}
            miniatura={(p, largura) => <MiniaturaPagina pagina={p} cena={cenas[p.id]} imagemUrl={imagemUrl} largura={largura} />}
            aoIr={(id) => { setVisaoPaginas(false); requestAnimationFrame(() => irPara(id)); }}
            aoAdicionar={() => setAdicionando(true)} aoVerGrade={() => setVisaoPaginas(true)}
            ia={<PainelIa obterContexto={obterContextoIa} temDesenho={temDesenhoNaPagina} aoPorNaPagina={porNaPagina}
              aoPorEmPaginaNova={(html) => void porEmPaginaNova(html)} aoCriarImagem={() => setIaAberta(true)} aoMapaMental={(html) => void desenharMapaMental(html)}
              aoConferirEscrita={conferirEscrita} marcasAtivas={marcasVivas.length} aoTirarMarcas={() => setCorrecao(null)}
              aoAgir={agirComIa} temFontes={temFontes} desfazer={reversoes[0] ? { resumo: reversoes[0].resumo, quando: reversoes[0].quando } : null} aoDesfazer={pedirDesfazerIa} />}
            fontes={<PainelFontes cadernoId={caderno.id} aoPorEmPaginaNova={(html) => void porEmPaginaNova(html)} aoMapaMental={(html) => void desenharMapaMental(html)} />}
            biblioteca={<PainelBiblioteca podeGuardarSelecao={!!selPid && selIds.length > 0} aoGuardarSelecao={guardarSelecaoNaBiblioteca} aoGuardarPagina={guardarPaginaNaBiblioteca}
              aoUsar={(i, d) => void usarDaBiblioteca(i, d)}
              previa={(i, d, c) => {
                const pg: PaginaCaderno = { id: i.id, cadernoId: caderno.id, ordem: 0, tamanho: i.tipo === "pagina" ? d.tamanho || "a4" : `custom:${Math.max(CUSTOM_MIN, d.largura ?? 300)}x${Math.max(CUSTOM_MIN, d.altura ?? 300)}`, papel: i.tipo === "pagina" ? d.papel : papelPadrao(), titulo: "", marcado: false, criadoEm: 0 };
                return <MiniaturaPagina pagina={pg} cena={c} imagemUrl={imagemUrl} largura={i.tipo === "pagina" ? 120 : 200} />;
              }} />} />
        )}
        {visaoPaginas && !infinito && (
          <VisaoPaginas paginas={paginas} cenas={cenas} imagemUrl={imagemUrl} atualId={selId}
            aoIr={(id) => { setVisaoPaginas(false); requestAnimationFrame(() => irPara(id)); }}
            aoFechar={() => setVisaoPaginas(false)}
            aoSalvar={(pg) => void salvar(pg)} aoApagar={(id) => void apagar(id)} aoDuplicar={(id) => void duplicar(id)}
            aoMover={(id, para) => void moverPagina(id, para)} aoAdicionar={() => setAdicionando(true)} />
        )}
        <div className={`caderno-rolagem${lateral && !infinito ? " lateral" : ""}${travada ? " travada" : ""}${modoPagina && !infinito ? " modo-pagina" : ""}`} ref={area} onScroll={aoRolar} hidden={visaoPaginas && !infinito}>
          {infinito ? (
            <div className="caderno-aviso-breve"><LayoutGrid aria-hidden="true" size="1.1em" /> {t.infinitoEmBreve}</div>
          ) : (
            <>
              {paginas.map((p, i) => (
                <PaginaView key={p.id} id={`pg-${p.id}`} pagina={p} numero={i + 1} selecionada={p.id === selId}
                  sobre={correcao?.pid === p.id && marcasVivas.length ? (esc) => (
                    <CamadaCorrecao marcas={marcasVivas} escala={esc} largura={medidaDe(p.tamanho).largura} altura={medidaDe(p.tamanho).altura}
                      aoEscolher={corrigirPalavra} aoIgnorar={(m) => setCorrecao((c) => (c ? { ...c, marcas: c.marcas.filter((x) => x.n !== m.n) } : c))} />
                  ) : undefined}
                  cena={cenas[p.id] ?? CENA_VAZIA} ferramenta={ferramenta} cor={cor} ajuste={ajustes[fTraco]} modeloPincel={modeloPincel}
                  forma={ajusteForma} editandoTexto={editandoTexto} selecionados={p.id === selPid ? selIds : vazio} imagemUrl={imagemUrl}
                  soCaneta={soCanetaEfetivo} multiToque={multiToque} aoCaneta={marcarCaneta} opcoes={opcoes}
                  larguraTela={larguraNaTela(p)} bloco={blocoNaTela} acrescentar={acrescentar}
                  negritoTexto={negritoTexto} slotTexto={slotTexto} aoTamTexto={mudarTamTexto}
                  regua={p.id === selId ? regua : null} unidadeRegua={unidadeRegua} aoMudarRegua={setRegua} aoUnidadeRegua={mudarUnidadeRegua}
                  aoSelecionar={() => setSelId(p.id)}
                  aoDocumento={(html) => atualizarDocumento(p.id, html)}
                  aoContinuarTexto={() => { setSelId(p.id); void adicionar(true, "depois", p.tamanho, { ...semCapa(folhaDe(p)), texto: true } as Papel); }}
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
                  aoNovoTexto={(x, y, largura) => aoNovoTexto(p.id, x, y, ferramenta === "nota", largura)}
                  aoPatchTexto={(id, patch) => atualizarTexto(p.id, id, patch)}
                  aoMoverTexto={(id, x, y) => atualizarTexto(p.id, id, { x, y })}
                  aoMoverFimTexto={() => aoMoverFimTexto(p.id)}
                  aoFimTexto={(id) => aoFimTexto(p.id, id)}
                  aoApagarTexto={(id) => apagarElemento(p.id, id)}
                  aoSelecionarTexto={setEditandoTexto}
                  />
              ))}
              {paginas.length > 0 && (
                <div className="caderno-puxar" ref={puxarRef} aria-hidden="true"
                  style={(() => {
                    const ult = paginas[paginas.length - 1];
                    const lg = larguraNaTela(ult);
                    if (lateral) return { width: Math.max(160, larguraArea * 0.6) };
                    return { width: lg ? `${Math.round(lg)}px` : undefined, minHeight: modoPagina ? Math.max(200, alturaArea * 0.6) : undefined };
                  })()}>
                  {ultimaVazia ? <p className="caderno-puxar-vazia">{t.paginas.puxarVazia}</p> : (
                    <div className="caderno-fantasma" ref={fantasmaRef} data-pronto="0"
                      style={lateral ? { height: `${Math.max(240, alturaArea - 24) * zoom}px` } : undefined}>
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

      {!infinito && !telaLimpa && (
        <BarraFerramentas
          ferramenta={ferramenta} aoFerramenta={(f) => { escolherFerramenta(f); setPainelFerr(true); }} aoAjustar={setAjustando}
          painelAberto={painelFerr || !!editandoTexto} aoPainel={setPainelFerr}
          corBarra={corBarra}
          aoInserirImagem={() => fileRef.current?.click()} aoCriarIa={() => setIaAberta(true)} aoAdesivos={() => setAdesivosAberto(true)}
          reguaLigada={regua !== null} aoRegua={alternarRegua}
          travada={travada} aoTravar={() => mudarTravada(!travada)}
          pos={posBarra} aoPos={mudarPosBarra} aoCiclar={ciclarBarra} miolo={mioloRef}
          dica={dicaBarra} aoFecharDica={fecharDicaBarra}
          aoDesfazer={() => andar(-1)} aoRefazer={() => andar(1)} podeDesfazer={podeDesfazer} podeRefazer={podeRefazer}
          contexto={
            <BarraContexto ferramenta={ferramenta} aoFerramenta={escolherFerramenta}
              cor={cor} favoritos={favoritos} aoCorPrevia={setCor}
              aoCor={(c) => { usarCor(c); if (ehSelecao && selIds.length) recolorirSelecao(c); if (ehTexto && editandoTexto) recolorTextoEditando(c); }}
              ajustes={ajustes} espessuras={espessuras} aoAjuste={gravarAjuste} aoAjustar={setAjustando}
              aoEspessura={(f, n) => (f === "forma" ? mudarForma({ espessura: n }) : gravarAjuste(f, { tamanho: n }))}
              forma={ajusteForma} aoForma={mudarForma} modeloPincel={modeloPincel} aoModeloPincel={mudarModeloPincel}
              modoBorracha={modoBorracha} aoModoBorracha={mudarModoBorracha} opcoes={opcoes} aoOpcoes={mudarOpcoes}
              acrescentar={acrescentar} aoAcrescentar={setAcrescentar}
              editandoTexto={!!editandoTexto} tamTexto={tamTexto} aoTamTexto={mudarTamTexto} negritoTexto={negritoTexto} aoNegritoTexto={mudarNegritoTexto}
              slotTexto={setSlotTexto} paginaTexto={ehPaginaTexto(sel)} />
          }
        />
      )}
      </div>

      {telaLimpa && (
        <Button className="caderno-mostrar-barras" onPress={() => setTelaLimpa(false)} aria-label={t.gestos.mostrarBarras}><Eye aria-hidden="true" size="1.1em" /></Button>
      )}

      <Janela titulo={t.adicionar.titulo} aberta={adicionando} aoFechar={() => setAdicionando(false)}>
        {adicionando && (
          <AdicionarPagina atual={sel} total={paginas.length}
            aoAdicionar={(onde, tamanhoNovo, papel) => { setAdicionando(false); void adicionar(true, onde, tamanhoNovo, papel); }}
            aoCancelar={() => setAdicionando(false)} />
        )}
      </Janela>

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
          : ajustando === "laco" || ajustando === "selecao" || ajustando === "laser"
          ? null
          : <AjustesFerramenta ferramenta={ajustando} ajuste={ajustes[ajustando]} modeloPincel={modeloPincel} aoMudar={(patch) => mudarAjuste(ajustando, patch)} aoFechar={() => setAjustando(null)} />)}
      </Janela>

      <Janela titulo={t.folha.titulo} aberta={editor} aoFechar={() => setEditor(false)}>
        {editor && <EditorFolha ia={ia} aoMudarIa={setIa} inicial={sel ? folhaDe(sel) : papelPadrao()} tamanho={sel?.tamanho ?? "a4"} total={paginas.length} atual={Math.max(1, paginas.findIndex((p) => p.id === selId) + 1)} aoAplicar={aplicarFolha} aoFechar={() => setEditor(false)} />}
      </Janela>

      <Janela titulo={t.config.titulo} aberta={configAberta} aoFechar={() => setConfigAberta(false)} pequena>
        <div className="formulario">
          <Interruptor rotulo={t.config.soCaneta} ligado={soCaneta} aoMudar={mudarSoCaneta} />
          <p className="campo-ajuda">{t.config.soCanetaAjuda}</p>
          <Interruptor rotulo={t.config.trava} ligado={travada} aoMudar={mudarTravada} />
          <p className="campo-ajuda">{t.config.travaAjuda}</p>
          <Segmentado rotulo={t.config.rolagem} valor={lateral ? "lateral" : "vertical"} aoMudar={(v) => mudarLateral(v === "lateral")}
            opcoes={[{ valor: "vertical", nome: t.config.rolagens.vertical }, { valor: "lateral", nome: t.config.rolagens.lateral }]} />
          {!lateral && (
            <>
              <Segmentado rotulo={t.encaixe.rotulo} valor={encaixe} aoMudar={(v) => mudarEncaixe(v as Encaixe)}
                opcoes={[{ valor: "pagina", nome: t.encaixe.opcoes.pagina }, { valor: "largura", nome: t.encaixe.opcoes.largura }]} />
              <p className="campo-ajuda">{t.encaixe.ajuda}</p>
            </>
          )}
          <Segmentado rotulo={t.painel.lado} valor={ladoPainel} aoMudar={(v) => setLadoPainel(v as "esquerda" | "direita")}
            opcoes={[{ valor: "esquerda", nome: t.painel.esquerda }, { valor: "direita", nome: t.painel.direita }]} />
          <div className="campo">
            <label className="campo-rotulo" htmlFor="caderno-tema">{t.temaCaderno.tema}</label>
            <select id="caderno-tema" className="entrada-texto sozinha" value={temaCaderno.escolha.tema} onChange={(e) => temaCaderno.mudar({ ...temaCaderno.escolha, tema: e.target.value })}>
              <option value="">{t.temaCaderno.igual}</option>
              {temaCaderno.temas.map((tm) => <option key={tm.id} value={tm.id}>{tm.nome}</option>)}
            </select>
          </div>
          <Segmentado rotulo={t.temaCaderno.modo} valor={temaCaderno.escolha.modo} aoMudar={(v) => temaCaderno.mudar({ ...temaCaderno.escolha, modo: v as "igual" | "claro" | "escuro" })}
            opcoes={[{ valor: "igual", nome: t.temaCaderno.igualModo }, { valor: "claro", nome: t.temaCaderno.claro }, { valor: "escuro", nome: t.temaCaderno.escuro }]} />
          <p className="campo-ajuda">{t.temaCaderno.ajuda}</p>
          <Interruptor rotulo={t.gestos.ligar} ligado={gestosLigados} aoMudar={mudarGestos} />
          <ul className="campo-ajuda caderno-lista-gestos">{t.gestos.lista.map((g) => <li key={g}>{g}</li>)}</ul>
          <Segmentado rotulo={t.config.unidadeRegua} valor={unidadeRegua} aoMudar={(v) => mudarUnidadeRegua(v as UnidadeRegua)}
            opcoes={[{ valor: "cm", nome: t.regua.unidades.cm }, { valor: "mm", nome: t.regua.unidades.mm }]} />
          <Segmentado rotulo={t.config.borracha} valor={modoBorracha} aoMudar={(v) => mudarModoBorracha(v as ModoBorracha)}
            opcoes={[{ valor: "pedaco", nome: t.borracha.modos.pedaco }, { valor: "objeto", nome: t.borracha.modos.objeto }]} />
          <Segmentado rotulo={t.config.posBarra} valor={posBarra} aoMudar={(v) => mudarPosBarra(v as PosBarra)}
            opcoes={POS_BARRA.map((p) => ({ valor: p, nome: t.config.posicoes[p] }))} />
          <div className="campo">
            <span className="campo-rotulo">{t.config.zoom} <span className="texto-suave">{Math.round(zoom * 100)}%</span></span>
            <div className="botoes">
              <Button className="botao" onPress={() => { const el = area.current; if (el) aplicarZoom(Math.round((zoom - 0.25) * 4) / 4, el.clientWidth / 2, el.clientHeight / 2); }} aria-label={t.config.zoomMenos}>−</Button>
              <Button className="botao" onPress={voltarZoom}>{t.config.zoomPadrao}</Button>
              <Button className="botao" onPress={() => { const el = area.current; if (el) aplicarZoom(Math.round((zoom + 0.25) * 4) / 4, el.clientWidth / 2, el.clientHeight / 2); }} aria-label={t.config.zoomMais}>+</Button>
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

/** Os elementos desenhados de uma cena (traços, formas e imagens), em SVG. */
const DesenhoEstatico = memo(function DesenhoEstatico({ elementos, imagemUrl }: { elementos: Elemento[]; imagemUrl: (id: string) => string | undefined }) {
  return (
    <>
      {elementos.map((el) => {
        if (el.tipo === "traco") return <TracoSvg key={el.id} traco={el} />;
        if (el.tipo === "forma") return <path key={el.id} d={caminhoDeForma(el)} fill="none" stroke={el.cor} strokeWidth={el.espessura} strokeLinecap="round" strokeLinejoin="round" />;
        if (el.tipo === "imagem") {
          const u = imagemUrl(el.anexoId);
          if (!u) return null;
          const giro = el.rot ? `rotate(${el.rot} ${el.x + el.largura / 2} ${el.y + el.altura / 2})` : undefined;
          return <image key={el.id} href={u} x={el.x} y={el.y} width={el.largura} height={el.altura} preserveAspectRatio="none" transform={giro} />;
        }
        return null;
      })}
    </>
  );
});

/** Miniatura da página com o que está nela (folha, desenho e textos), para a
 *  visão de páginas. Desenha no tamanho real e reduz (fica fiel ao original). */
const MiniaturaPagina = memo(function MiniaturaPagina({ pagina, cena, imagemUrl, largura }: { pagina: PaginaCaderno; cena: Cena | undefined; imagemUrl: (id: string) => string | undefined; largura: number }) {
  const med = medidaDe(pagina.tamanho);
  const k = largura / med.largura;
  const els = cena?.elementos ?? [];
  return (
    <div className="caderno-mini" style={{ width: largura, height: Math.round(med.altura * k) }} aria-hidden="true">
      <div className="caderno-mini-miolo" data-largura={med.largura} data-altura={med.altura} style={{ width: med.largura, height: med.altura, transform: `scale(${k})` }}>
        <Folha papel={folhaDe(pagina)} tamanho={pagina.tamanho} className="caderno-mini-folha" />
        {cena?.documento && <DocumentoEstatico html={cena.documento} largura={med.largura} altura={med.altura} />}
        <svg className="caderno-mini-desenho" viewBox={`0 0 ${med.largura} ${med.altura}`} preserveAspectRatio="none">
          <DesenhoEstatico elementos={els} imagemUrl={imagemUrl} />
        </svg>
        {els.filter((e): e is Texto => e.tipo === "texto").map((tx) => (
          <div key={tx.id} className="caderno-mini-texto" style={{ left: tx.x, top: tx.y, maxWidth: tx.largura, ...((tx.alinhamento ?? "esquerda") !== "esquerda" ? { width: tx.largura } : {}), color: tx.cor, fontSize: tx.tamanho, fontFamily: fonteCss(tx.fonte), textAlign: ALINHAR_CSS[tx.alinhamento ?? "esquerda"], ...(tx.fundo ? { background: tx.fundo, padding: "7px 9px", borderRadius: 5 } : {}) }}
            dangerouslySetInnerHTML={{ __html: tx.texto }} />
        ))}
      </div>
    </div>
  );
});

/** Visão das páginas (como as miniaturas do Goodnotes): ir para uma página, dar
 *  nome, marcar, duplicar, mudar de lugar e apagar. Filtra as marcadas. */
function VisaoPaginas({ paginas, cenas, imagemUrl, atualId, aoIr, aoFechar, aoSalvar, aoApagar, aoDuplicar, aoMover, aoAdicionar }: {
  paginas: PaginaCaderno[]; cenas: Record<string, Cena>; imagemUrl: (id: string) => string | undefined; atualId: string;
  aoIr: (id: string) => void; aoFechar: () => void; aoSalvar: (p: PaginaCaderno) => void; aoApagar: (id: string) => void;
  aoDuplicar: (id: string) => void; aoMover: (id: string, passo: -1 | 1) => void; aoAdicionar: () => void;
}) {
  const tv = t.visao;
  const [filtro, setFiltro] = useState<"todas" | "marcadas">("todas");
  const [nomeando, setNomeando] = useState<PaginaCaderno | null>(null);
  const [nome, setNome] = useState("");
  const [apagando, setApagando] = useState<PaginaCaderno | null>(null);
  const lista = paginas.map((p, i) => ({ p, n: i + 1 })).filter(({ p }) => filtro === "todas" || p.marcado);
  const atualRef = useRef<HTMLLIElement>(null);
  useEffect(() => { atualRef.current?.scrollIntoView({ block: "nearest" }); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !nomeando && !apagando) aoFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aoFechar, nomeando, apagando]);
  return (
    <section className="caderno-visao" aria-labelledby="caderno-visao-titulo">
      <div className="caderno-visao-cabeca">
        <h2 id="caderno-visao-titulo">{tv.titulo}</h2>
        <Segmentado rotulo={tv.filtro} rotuloOculto valor={filtro} aoMudar={(v) => setFiltro(v as typeof filtro)}
          opcoes={[{ valor: "todas", nome: tv.todas(paginas.length) }, { valor: "marcadas", nome: tv.marcadas(paginas.filter((p) => p.marcado).length) }]} />
        <span className="linha-ajuste">
          <Button className="botao com-icone" onPress={aoAdicionar}><Plus aria-hidden="true" size="1em" /> {t.paginas.adicionar}</Button>
          <Button className="botao principal" onPress={aoFechar}>{tv.voltar}</Button>
        </span>
      </div>
      {lista.length === 0 ? <p className="texto-suave">{tv.nenhumaMarcada}</p> : (
        <ul className="caderno-visao-grade">
          {lista.map(({ p, n }) => {
            const atual = p.id === atualId;
            const rotulo = p.titulo ? `${t.paginas.numero(n)}: ${p.titulo}` : t.paginas.numero(n);
            return (
              <li key={p.id} ref={atual ? atualRef : undefined} className={atual ? "caderno-visao-item atual" : "caderno-visao-item"}>
                <button type="button" className="caderno-visao-mini" onClick={() => aoIr(p.id)} aria-label={tv.ir(rotulo)} aria-current={atual ? "page" : undefined}>
                  <MiniaturaPagina pagina={p} cena={cenas[p.id]} imagemUrl={imagemUrl} largura={150} />
                  {p.marcado && <span className="caderno-visao-marca" aria-hidden="true"><Bookmark size="0.95em" /></span>}
                </button>
                <div className="caderno-visao-pe">
                  <span className="caderno-visao-num">{n}</span>
                  <span className="caderno-visao-nome quebra">{p.titulo || <span className="texto-suave">{tv.semNome}</span>}</span>
                  <MenuTrigger>
                    <Button className="botao-icone pequeno" aria-label={tv.acoes(rotulo)}><MoreHorizontal aria-hidden="true" size="1.1em" /></Button>
                    <Popover className="menu-popover" placement="bottom end">
                      <Menu className="menu-lista" aria-label={tv.acoes(rotulo)} onAction={(k) => {
                        if (k === "nome") { setNome(p.titulo); setNomeando(p); }
                        else if (k === "marcar") aoSalvar({ ...p, marcado: !p.marcado });
                        else if (k === "duplicar") aoDuplicar(p.id);
                        else if (k === "antes") aoMover(p.id, -1);
                        else if (k === "depois") aoMover(p.id, 1);
                        else if (k === "apagar") setApagando(p);
                      }}>
                        <MenuItem id="nome" className="menu-item">{p.titulo ? tv.renomear : tv.darNome}</MenuItem>
                        <MenuItem id="marcar" className="menu-item">{p.marcado ? t.paginas.desmarcar : t.paginas.marcar}</MenuItem>
                        <MenuItem id="duplicar" className="menu-item">{tv.duplicar}</MenuItem>
                        {n > 1 && <MenuItem id="antes" className="menu-item">{tv.paraAntes}</MenuItem>}
                        {n < paginas.length && <MenuItem id="depois" className="menu-item">{tv.paraDepois}</MenuItem>}
                        {paginas.length > 1 && <MenuItem id="apagar" className="menu-item perigo">{t.paginas.excluir}</MenuItem>}
                      </Menu>
                    </Popover>
                  </MenuTrigger>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Janela titulo={tv.nomeTitulo} aberta={nomeando !== null} aoFechar={() => setNomeando(null)} pequena>
        {nomeando && (
          <Form className="formulario" onSubmit={(e) => { e.preventDefault(); aoSalvar({ ...nomeando, titulo: nome.trim() }); setNomeando(null); }}>
            <Campo rotulo={t.paginas.tituloCampo} valor={nome} aoMudar={setNome} autoFocus maximo={80} semDitado />
            <p className="campo-ajuda">{tv.nomeAjuda}</p>
            <div className="janela-acoes">
              <Button className="botao" onPress={() => setNomeando(null)}>{textos.comum.cancelar}</Button>
              <Button className="botao principal" type="submit">{textos.comum.salvar}</Button>
            </div>
          </Form>
        )}
      </Janela>
      <Confirmar titulo={t.paginas.excluir} texto={apagando ? tv.confirmarApagar(paginas.indexOf(apagando) + 1) : ""} confirmar={t.paginas.excluir}
        aberta={apagando !== null} aoCancelar={() => setApagando(null)} aoConfirmar={() => { if (apagando) aoApagar(apagando.id); setApagando(null); }} />
    </section>
  );
}

/** Janela "Adicionar página": onde (antes, depois, no fim), o tamanho e o modelo da folha. */
function AdicionarPagina({ atual, total, aoAdicionar, aoCancelar }: {
  atual: PaginaCaderno | undefined; total: number;
  aoAdicionar: (onde: OndeNova, tamanho: string | undefined, papel: Papel | undefined) => void; aoCancelar: () => void;
}) {
  const ta = t.adicionar;
  const [onde, setOnde] = useState<OndeNova>(total > 0 ? "depois" : "fim");
  const [tamanho, setTamanho] = useState<string>("igual");
  const [larg, setLarg] = useState(16);
  const [alt, setAlt] = useState(22);
  const [modelo, setModelo] = useState<ModeloPapel | "igual">("igual");
  const [tipo, setTipo] = useState<"mao" | "texto">(ehPaginaTexto(atual) ? "texto" : "mao");
  const base = atual ? semCapa(folhaDe(atual)) : papelPadrao();
  const confirmar = () => {
    const tam = tamanho === "igual" ? undefined : tamanho === "personalizado" ? `custom:${Math.round(larg * PX_CM)}x${Math.round(alt * PX_CM)}` : tamanho;
    const folha: PapelPagina = { ...base, ...(modelo === "igual" ? {} : { modelo }) };
    if (tipo === "texto") folha.texto = true; else delete folha.texto;
    aoAdicionar(onde, tam, folha);
  };
  return (
    <div className="formulario">
      {total > 0 && (
        <Segmentado rotulo={ta.onde} valor={onde} aoMudar={(v) => setOnde(v as OndeNova)}
          opcoes={[{ valor: "antes", nome: ta.antes }, { valor: "depois", nome: ta.depois }, { valor: "fim", nome: ta.fim }]} />
      )}
      <Segmentado rotulo={ta.tipo} valor={tipo} aoMudar={(v) => setTipo(v as typeof tipo)}
        opcoes={[{ valor: "mao", nome: ta.tipos.mao }, { valor: "texto", nome: ta.tipos.texto }]} />
      <p className="campo-ajuda">{ta.tiposAjuda[tipo]}</p>
      <div className="campo">
        <span className="campo-rotulo">{t.folha.modelo}</span>
        <div className="caderno-modelos">
          <button type="button" className={modelo === "igual" ? "caderno-modelo atual" : "caderno-modelo"} onClick={() => setModelo("igual")} aria-pressed={modelo === "igual"}>
            <Folha papel={base} tamanho="a5" className="caderno-modelo-mini" />
            <span className="pequeno">{ta.igual}</span>
          </button>
          {MODELOS_PAPEL.map((m) => (
            <button key={m} type="button" className={modelo === m ? "caderno-modelo atual" : "caderno-modelo"} onClick={() => setModelo(m as ModeloPapel)} aria-pressed={modelo === m}>
              <Folha papel={{ ...base, modelo: m as ModeloPapel }} tamanho="a5" className="caderno-modelo-mini" />
              <span className="pequeno">{t.folha.modelos[m as keyof typeof t.folha.modelos]}</span>
            </button>
          ))}
        </div>
      </div>
      <Segmentado rotulo={t.paginas.tamanho} valor={tamanho} aoMudar={setTamanho}
        opcoes={[{ valor: "igual", nome: ta.igual }, { valor: "a4", nome: t.paginas.tamanhos.a4 }, { valor: "a5", nome: t.paginas.tamanhos.a5 }, { valor: "carta", nome: t.paginas.tamanhos.carta }, { valor: "personalizado", nome: t.paginas.tamanhos.personalizado }]} />
      {tamanho === "personalizado" && (
        <div className="caderno-custom-tam">
          <label className="caderno-intervalo-campo">{t.paginas.largura}
            <input type="number" min={8} max={36} value={larg} onChange={(e) => setLarg(Math.min(36, Math.max(8, Number(e.target.value) || 8)))} aria-label={t.paginas.largura} /> cm
          </label>
          <label className="caderno-intervalo-campo">{t.paginas.altura}
            <input type="number" min={8} max={50} value={alt} onChange={(e) => setAlt(Math.min(50, Math.max(8, Number(e.target.value) || 8)))} aria-label={t.paginas.altura} /> cm
          </label>
        </div>
      )}
      <p className="campo-ajuda">{ta.ajuda}</p>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoCancelar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" onPress={confirmar}>{t.paginas.adicionar}</Button>
      </div>
    </div>
  );
}

function PaginaView({ id, pagina, numero, selecionada, aoDocumento, aoContinuarTexto, cena, ferramenta, cor, ajuste, modeloPincel, forma, editandoTexto, selecionados, imagemUrl, soCaneta, multiToque, aoCaneta, opcoes, larguraTela, bloco, acrescentar, negritoTexto, slotTexto, aoTamTexto, regua, unidadeRegua, aoMudarRegua, aoUnidadeRegua, aoSelecionar, aoDesenhar, aoNovaForma, aoApagarParcial, aoApagarFim, aoNovoTexto, aoPatchTexto, aoFimTexto, aoApagarTexto, aoSelecionarTexto, aoSelecionarLaco, aoMoverSelecao, aoEscalarSelecao, aoRotacionarSelecao, aoOrdenarSelecao, aoNivelSelecao, aoAgrupar, aoDesagrupar, aoFimSelecao, aoApagarSelecao, aoEditarTexto, sobre }: {
  id: string; pagina: PaginaCaderno; numero?: number; selecionada?: boolean;
  /** Página de texto: o texto digitado mudou; e "continuar numa página nova". */
  aoDocumento: (html: string) => void; aoContinuarTexto: () => void;
  cena: Cena; ferramenta: FerramentaUI; cor: string; ajuste: AjusteTraco; modeloPincel: ModeloPincel; forma: AjusteForma; editandoTexto: string; selecionados: string[]; imagemUrl: (id: string) => string | undefined;
  soCaneta: boolean; multiToque: React.RefObject<boolean>; aoCaneta: () => void; opcoes: OpcoesCaderno;
  /** Largura da página na tela (px, já com o zoom); 0 enquanto mede. */
  larguraTela: number;
  /** "Página inteira": o bloco ocupa a área toda (com o zoom) e a página fica no meio. */
  bloco: { largura: number; altura: number } | null;
  acrescentar: boolean;
  negritoTexto: boolean; slotTexto: HTMLElement | null; aoTamTexto: (n: number) => void;
  regua: Regua | null; unidadeRegua: UnidadeRegua; aoMudarRegua: (r: Regua) => void; aoUnidadeRegua: (u: UnidadeRegua) => void;
  aoSelecionar: () => void; aoDesenhar: (t: Traco) => void; aoNovaForma: (f: Forma) => void;
  aoApagarParcial: (x: number, y: number, raio: number) => void; aoApagarFim: () => void;
  aoNovoTexto: (x: number, y: number, largura?: number) => void; aoPatchTexto: (id: string, patch: Partial<Texto>) => void;
  aoMoverTexto: (id: string, x: number, y: number) => void; aoMoverFimTexto: () => void;
  aoFimTexto: (id: string) => void; aoApagarTexto: (id: string) => void; aoSelecionarTexto: (id: string) => void;
  aoSelecionarLaco: (ids: string[]) => void; aoMoverSelecao: (ids: string[], dx: number, dy: number) => void;
  aoEscalarSelecao: (ids: string[], ax: number, ay: number, fator: number) => void;
  aoRotacionarSelecao: (ids: string[], ax: number, ay: number, graus: number) => void; aoOrdenarSelecao: (frente: boolean) => void;
  aoNivelSelecao: (frente: boolean) => void; aoAgrupar: () => void; aoDesagrupar: () => void;
  aoFimSelecao: () => void; aoApagarSelecao: () => void; aoEditarTexto: (id: string) => void;
  /** Camada por cima da página (o corretor da escrita à mão), com a escala da tela. */
  sobre?: (escala: number) => React.ReactNode;
}) {
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
  const modoSel = ferramenta === "laco" ? "laco" : ferramenta === "selecao" ? "selecao" : null;
  // "Página inteira": o bloco tem o tamanho da área e a página fica no meio dele
  // (assim nada da próxima aparece). "Largura toda": o bloco é a própria página.
  const larguraPg = larguraTela ? `${Math.round(larguraTela)}px` : "min(100%, 1500px)";
  const estiloBloco: React.CSSProperties = bloco ? { width: bloco.largura, height: bloco.altura } : { width: larguraPg };
  return (
    <section id={id} className={bloco ? "caderno-folha-bloco inteira" : "caderno-folha-bloco"} style={estiloBloco} aria-label={numero ? t.paginas.numero(numero) : undefined}>
      <div ref={areaRef} className="caderno-folha-area" style={{ aspectRatio: `${med.largura} / ${med.altura}`, width: bloco ? larguraPg : undefined }}
        onPointerDownCapture={aoSelecionar} onContextMenu={(e) => e.preventDefault()}>
        <Folha papel={folhaDe(pagina)} tamanho={pagina.tamanho} className="caderno-folha caderno-folha-fundo" />
        {ehPaginaTexto(pagina) && escala > 0 && (
          <CamadaDocumento html={cena.documento ?? ""} editavel={ferramenta === "texto"} escala={escala} largura={med.largura} altura={med.altura}
            slot={selecionada ? slotTexto : null} aoMudar={aoDocumento} aoContinuar={aoContinuarTexto} />
        )}
        <SuperficieDesenho cena={cena} ferramenta={ferramenta} cor={cor} ajuste={ajuste} modeloPincel={modeloPincel} forma={forma} regua={regua} largura={med.largura} altura={med.altura} imagemUrl={imagemUrl}
          soCaneta={soCaneta} multiToque={multiToque} aoCaneta={aoCaneta} opcoes={opcoes} aoDesenhar={aoDesenhar} aoNovaForma={aoNovaForma} aoApagarParcial={aoApagarParcial} aoApagarFim={aoApagarFim} />
        <CamadaTexto caixas={caixas} ativa={ferramenta === "nota" || (ferramenta === "texto" && !ehPaginaTexto(pagina))} escala={escala} editandoId={editandoTexto} soCaneta={soCaneta}
          negritoPadrao={negritoTexto} slot={slotTexto} aoTamPadrao={aoTamTexto}
          aoNovo={aoNovoTexto} aoPatch={aoPatchTexto} aoFim={aoFimTexto} aoApagar={aoApagarTexto} aoSelecionar={aoSelecionarTexto} />
        <CamadaSelecao elementos={cena.elementos} selecionados={selecionados} modo={modoSel} acrescentar={acrescentar} soCaneta={soCaneta} escala={escala} largura={med.largura} altura={med.altura}
          aoSelecionar={aoSelecionarLaco} aoMover={aoMoverSelecao} aoEscalar={aoEscalarSelecao} aoRotacionar={aoRotacionarSelecao} aoOrdenar={aoOrdenarSelecao} aoNivel={aoNivelSelecao}
          aoAgrupar={aoAgrupar} aoDesagrupar={aoDesagrupar} aoFim={aoFimSelecao} aoApagar={aoApagarSelecao} aoEditarTexto={aoEditarTexto} />
        {regua && <CamadaRegua regua={regua} unidade={unidadeRegua} escala={escala} largura={med.largura} altura={med.altura} aoMudar={aoMudarRegua} aoUnidade={aoUnidadeRegua} />}
        {sobre && escala > 0 && sobre(escala)}
      </div>
    </section>
  );
}

/** A camada das caixas de texto, por cima do desenho. Só interage quando a
 *  ferramenta de texto está ativa; nas outras, fica só mostrando (sem toque).
 *  Tocar na área vazia abre um campo novo (ou, com um campo aberto, confirma). */
function CamadaTexto({ caixas, ativa, escala, editandoId, soCaneta, negritoPadrao, slot, aoTamPadrao, aoNovo, aoPatch, aoFim, aoApagar, aoSelecionar }: {
  caixas: Texto[]; ativa: boolean; escala: number; editandoId: string; soCaneta: boolean;
  negritoPadrao: boolean; slot: HTMLElement | null; aoTamPadrao: (n: number) => void;
  aoNovo: (x: number, y: number, largura?: number) => void; aoPatch: (id: string, patch: Partial<Texto>) => void;
  aoFim: (id: string) => void; aoApagar: (id: string) => void; aoSelecionar: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Tocar cria uma caixa com a largura padrão; arrastar escolhe a largura da caixa
  // (a altura cresce com o texto). Com "só caneta", arrastar o dedo rola a folha.
  const gesto = useRef<{ id: number; x0: number; y0: number; toque: boolean } | null>(null);
  const [rascunho, setRascunho] = useState<{ x: number; y: number; l: number; a: number } | null>(null);
  const ponto = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / escala, y: (e.clientY - r.top) / escala };
  };
  const descer = (e: React.PointerEvent) => {
    if (e.target !== ref.current || escala <= 0) return; // só no fundo vazio
    if (e.button != null && e.button !== 0) return;
    e.preventDefault(); // não deixa o clique roubar o foco da nova caixa
    const toque = e.pointerType === "touch";
    if (!toque) ref.current.setPointerCapture(e.pointerId);
    const p = ponto(e);
    gesto.current = { id: e.pointerId, x0: p.x, y0: p.y, toque };
  };
  const mover = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    const p = ponto(e);
    const dx = p.x - g.x0, dy = p.y - g.y0;
    if (g.toque && soCaneta) { if (Math.hypot(dx, dy) * escala > 12) { gesto.current = null; setRascunho(null); } return; }
    if (Math.hypot(dx, dy) * escala > 12) setRascunho({ x: Math.min(g.x0, p.x), y: Math.min(g.y0, p.y), l: Math.abs(dx), a: Math.abs(dy) });
  };
  const subir = (e: React.PointerEvent) => {
    const g = gesto.current;
    gesto.current = null;
    const r = rascunho;
    setRascunho(null);
    if (!g || g.id !== e.pointerId) return;
    if (r && r.l * escala > 24) aoNovo(r.x, r.y, Math.max(60, r.l));
    else aoNovo(g.x0, g.y0);
  };
  return (
    <div ref={ref} className={ativa ? "caderno-textos ativa" : "caderno-textos"}
      onPointerDown={ativa ? descer : undefined} onPointerMove={ativa ? mover : undefined} onPointerUp={ativa ? subir : undefined}
      onPointerCancel={() => { gesto.current = null; setRascunho(null); }}>
      {caixas.map((tx) => (
        <CaixaTexto key={tx.id} caixa={tx} escala={escala} editando={tx.id === editandoId} ativa={ativa}
          negritoPadrao={negritoPadrao} slot={slot} aoTamPadrao={aoTamPadrao}
          aoPatch={(patch) => aoPatch(tx.id, patch)} aoFim={() => aoFim(tx.id)} aoApagar={() => aoApagar(tx.id)} aoSelecionar={() => aoSelecionar(tx.id)} />
      ))}
      {rascunho && (
        <div className="caderno-texto-rascunho" aria-hidden="true"
          style={{ left: rascunho.x * escala, top: rascunho.y * escala, width: rascunho.l * escala, height: Math.max(rascunho.a, 28) * escala }} />
      )}
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
    // Centralizado ou à direita: a caixa usa a largura toda (senão o alinhamento não aparece).
    // Em edição, a caixa mostra a largura dela (dá para mudar pela alça da direita).
    left: tx.x * escala, top: tx.y * escala, width: emEdicao || (tx.alinhamento ?? "esquerda") !== "esquerda" ? tx.largura * escala : "max-content",
    maxWidth: tx.largura * escala, minWidth: emEdicao ? Math.max(40, tx.tamanho * escala * 2.5) : undefined,
    ["--caderno-escala" as string]: escala,
    ...(ehNota ? { background: tx.fundo, padding: `${7 * escala}px ${9 * escala}px`, borderRadius: `${5 * escala}px`, boxShadow: "0 2px 8px rgba(0, 0, 0, 0.18)" } : {}),
  };
  const estiloTexto: React.CSSProperties = { color: tx.cor, fontSize: `${tx.tamanho * escala}px`, fontFamily: fonteCss(tx.fonte), textAlign: ALINHAR_CSS[tx.alinhamento ?? "esquerda"] };
  const classeCaixa = ehNota ? "caderno-caixa nota" : "caderno-caixa";

  // Alças da caixa em edição: a da direita muda a largura; a do canto move a caixa.
  const arrastar = (tipo: "largura" | "mover") => (e: React.PointerEvent<HTMLSpanElement>) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const caixa = ref.current?.getBoundingClientRect();
    const x0 = e.clientX, y0 = e.clientY, tx0 = tx.x, ty0 = tx.y;
    const mover = (ev: PointerEvent) => {
      if (!caixa || escala <= 0) return;
      if (tipo === "largura") aoPatch({ largura: Math.max(60, Math.min(4000, (ev.clientX - caixa.left) / escala)) });
      else aoPatch({ x: tx0 + (ev.clientX - x0) / escala, y: ty0 + (ev.clientY - y0) / escala });
    };
    const soltar = () => { el.removeEventListener("pointermove", mover); el.removeEventListener("pointerup", soltar); el.removeEventListener("pointercancel", soltar); };
    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", soltar);
  };
  if (emEdicao) {
    return (
      <div ref={ref} className={`${classeCaixa} editando`} style={estiloCaixa}>
        <span className="caderno-caixa-alca-mover" role="presentation" title={t.texto.mover} onPointerDown={arrastar("mover")}><IconeAlca aria-hidden="true" size="0.9em" /></span>
        <span className="caderno-caixa-alca-largura" role="presentation" title={t.texto.largura} onPointerDown={arrastar("largura")} />
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
    extensions: extensoesCaixa,
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
  const mudarTam = (d: number) => { const n = Math.min(80, Math.max(12, tx.tamanho + d)); aoPatch({ tamanho: n }); aoTamPadrao(n); };
  // A barra é a mesma do editor completo; aqui só entram as coisas da caixa: o
  // tamanho base da letra da caixa, o fundo da nota, o ditado, a IA, apagar e "Pronto".
  const controles = (
    <FitaTexto editor={editor} compacta tamanhoCss={(n) => `calc(${(n / 0.75).toFixed(2)}px * var(--caderno-escala, 1))`}
      extra={(
        <span className="fita-grupo">
          <button type="button" className="fita-botao" onClick={() => mudarTam(-2)} aria-label={t.texto.diminuirCaixa} title={t.texto.diminuirCaixa}><span className="fita-botao-texto">a−</span></button>
          <span className="fita-info" aria-live="polite">{t.texto.tamanhoAtual(tx.tamanho)}</span>
          <button type="button" className="fita-botao" onClick={() => mudarTam(2)} aria-label={t.texto.aumentarCaixa} title={t.texto.aumentarCaixa}><span className="fita-botao-texto">a+</span></button>
          {ditado.botao && <span className="caderno-fmt-ditado">{ditado.botao}</span>}
          {tx.fundo && (
            <button type="button" className="fita-botao" onClick={() => aoPatch({ fundo: FUNDOS_NOTA[(FUNDOS_NOTA.indexOf(tx.fundo!) + 1) % FUNDOS_NOTA.length] })} aria-label={t.texto.fundo} title={t.texto.fundo}>
              <span className="caderno-fmt-fundo" style={{ background: tx.fundo }} aria-hidden="true" />
            </button>
          )}
          {revisar.botao}
          <button type="button" className="fita-botao" onClick={aoApagar} aria-label={t.texto.apagar} title={t.texto.apagar}><Trash2 size="1em" aria-hidden="true" /></button>
          <button type="button" className="fita-botao largo caderno-fmt-pronto" onClick={aoFim}>{t.texto.pronto}</button>
        </span>
      )} />
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
function CamadaSelecao({ elementos, selecionados, modo, acrescentar, soCaneta, escala, largura, altura, aoSelecionar, aoMover, aoEscalar, aoRotacionar, aoOrdenar, aoNivel, aoAgrupar, aoDesagrupar, aoFim, aoApagar, aoEditarTexto }: {
  elementos: Elemento[]; selecionados: string[]; modo: "laco" | "selecao" | null; acrescentar: boolean; escala: number; largura: number; altura: number;
  /** Com "só caneta", o dedo arrasta a folha e não seleciona. */
  soCaneta: boolean;
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
    if (soCaneta && e.pointerType === "touch") return;
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

function SuperficieDesenho({ cena, ferramenta, cor, ajuste, modeloPincel, forma, regua, largura, altura, imagemUrl, soCaneta, multiToque, aoCaneta, opcoes, aoDesenhar, aoNovaForma, aoApagarParcial, aoApagarFim }: {
  cena: Cena; ferramenta: FerramentaUI; cor: string; ajuste: AjusteTraco; modeloPincel: ModeloPincel; forma: AjusteForma; regua: Regua | null; largura: number; altura: number;
  imagemUrl: (id: string) => string | undefined;
  /** "Escrever só com a caneta": o dedo nunca risca (só caneta e mouse). */
  soCaneta: boolean;
  /** Dois dedos ou mais na tela (pinça): ninguém desenha. */
  multiToque: React.RefObject<boolean>;
  aoCaneta: () => void;
  opcoes: OpcoesCaderno;
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
  const ehLaser = ferramenta === "laser";
  // Laser: o traço some sozinho (não fica na página nem no desfazer).
  const [rastros, setRastros] = useState<Traco[]>([]);
  const timersLaser = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timersLaser.current.forEach(clearTimeout), []);
  // "Desenhar e segurar": parado no fim por um instante, o traço vira forma.
  const seguraTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ultimoPonto = useRef<{ x: number; y: number } | null>(null);
  const [formaSegurada, setFormaSeguradaEstado] = useState<Forma | null>(null);
  const formaSeguradaRef = useRef<Forma | null>(null);
  const setFormaSegurada = (f: Forma | null) => { formaSeguradaRef.current = f; setFormaSeguradaEstado(f); };
  const podeVirarForma = opcoes.segurarForma && (ferramenta === "caneta" || ferramenta === "lapis");
  const armarSegurar = () => {
    clearTimeout(seguraTimer.current);
    if (!podeVirarForma || formaSeguradaRef.current) return;
    seguraTimer.current = setTimeout(() => {
      descarregar();
      const v = vivoRef.current;
      if (!desenhando.current || !v) return;
      const r = reconhecerForma(v.pontos.map((p) => [p.x, p.y] as Ponto2));
      if (!r) return;
      setFormaSegurada({ tipo: "forma", id: crypto.randomUUID(), forma: r.forma, x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, cor: v.cor, espessura: Math.max(1.5, v.espessura) });
    }, 550);
  };
  const ehForma = ferramenta === "forma" || ehSeta;

  // Posição da folha na tela, medida no começo do traço (medir a cada ponto
  // pesava no iPad; durante o traço a folha não se mexe).
  const caixaFolha = useRef<DOMRect | null>(null);
  // Pontos que chegaram desde o último quadro: o traço vivo é redesenhado uma vez
  // por quadro de tela, não a cada evento (no iPad chegam 240 por segundo).
  const pendentes = useRef<Ponto[]>([]);
  const quadro = useRef(0);
  const descarregar = () => {
    if (quadro.current) { cancelAnimationFrame(quadro.current); quadro.current = 0; }
    const v = vivoRef.current;
    if (v && pendentes.current.length) { const novo = { ...v, pontos: v.pontos.concat(pendentes.current) }; pendentes.current = []; setVivo(novo); }
    else pendentes.current = [];
  };
  useEffect(() => () => cancelAnimationFrame(quadro.current), []);
  // Ponto em px de referência, com a pressão. Só a caneta tem pressão de
  // verdade (Apple Pencil: 0..1); mouse (0,5 fixo) e dedo (0 ou 1) ficam com
  // espessura fixa. A pressão é suavizada entre pontos, para não "tremer".
  const ponto = (e: { clientX: number; clientY: number; pressure: number }): Ponto => {
    const r = caixaFolha.current ?? ref.current!.getBoundingClientRect();
    let p = 0.5;
    if (comCaneta.current) {
      const bruta = e.pressure > 0 ? e.pressure : pressaoAnterior.current;
      p = pressaoAnterior.current + (bruta - pressaoAnterior.current) * 0.35;
      pressaoAnterior.current = p;
    }
    return { x: ((e.clientX - r.left) / r.width) * largura, y: ((e.clientY - r.top) / r.height) * altura, p };
  };
  // A Apple Pencil no Safari também gera "toques": cancelar o toque dela segura a
  // página parada e evita a lupa e o menu do sistema enquanto escreve.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const segurar = (ev: TouchEvent) => {
      if ([...ev.changedTouches].some((tq) => (tq as Touch & { touchType?: string }).touchType === "stylus")) ev.preventDefault();
    };
    el.addEventListener("touchstart", segurar, { passive: false });
    el.addEventListener("touchmove", segurar, { passive: false });
    return () => { el.removeEventListener("touchstart", segurar); el.removeEventListener("touchmove", segurar); };
  }, []);

  // Desiste do que está sendo desenhado (ex.: entrou o segundo dedo da pinça).
  const cancelar = () => {
    if (!desenhando.current) return;
    desenhando.current = false;
    naRegua.current = false;
    pendentes.current = [];
    if (quadro.current) { cancelAnimationFrame(quadro.current); quadro.current = 0; }
    clearTimeout(seguraTimer.current);
    setFormaSegurada(null);
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
    caixaFolha.current = ref.current?.getBoundingClientRect() ?? null;
    pendentes.current = [];
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
      const novo: Traco = ehLaser
        ? { tipo: "traco", id: crypto.randomUUID(), ferramenta: "caneta", cor: opcoes.corLaser, espessura: 5, afinar: 0, alisar: 0.5, opacidade: 0.9, pressao: false, pontos: [pt] }
        : { tipo: "traco", id: crypto.randomUUID(), ferramenta: ferramenta as Ferramenta, cor, espessura: Math.round(ajuste.tamanho), afinar: ajuste.afinar, alisar: ajuste.alisar, opacidade: ajuste.opacidade, pressao: true, pontos: [comRegua(pt)] };
      ultimoPonto.current = { x: pt.x, y: pt.y };
      setFormaSegurada(null);
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
      if (formaSeguradaRef.current) return; // já virou forma: segura até soltar
      for (const ev of lista.length ? lista : [nativo]) pendentes.current.push(comRegua(ponto(ev)));
      if (!quadro.current) quadro.current = requestAnimationFrame(() => { quadro.current = 0; descarregar(); });
      // Mexeu de verdade: recomeça a contar o "segurar".
      const ult = pendentes.current[pendentes.current.length - 1];
      if (ult && (!ultimoPonto.current || Math.hypot(ult.x - ultimoPonto.current.x, ult.y - ultimoPonto.current.y) > 2.5)) {
        ultimoPonto.current = { x: ult.x, y: ult.y };
        armarSegurar();
      }
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
      clearTimeout(seguraTimer.current);
      descarregar();
      const v = vivoRef.current;
      setVivo(null);
      caixaFolha.current = null;
      const fs = formaSeguradaRef.current;
      setFormaSegurada(null);
      if (!v || !v.pontos.length) return;
      if (ehLaser) {
        setRastros((r) => [...r, v]);
        timersLaser.current.push(setTimeout(() => setRastros((r) => r.filter((x) => x.id !== v.id)), 1100));
        return;
      }
      if (fs) { aoNovaForma(fs); return; }
      // Marca-texto reto: do primeiro ao último ponto.
      if (v.ferramenta === "marcatexto" && opcoes.marcaReto && v.pontos.length > 1) {
        const a = v.pontos[0], b = v.pontos[v.pontos.length - 1];
        aoDesenhar({ ...v, pontos: [a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, p: a.p }, b] });
        return;
      }
      aoDesenhar(v);
    }
  };

  const semToque = ferramenta === "texto" || ferramenta === "nota" || ferramenta === "laco" || ferramenta === "selecao";
  const classe = semToque ? "caderno-desenho sem-toque" : ferramenta === "borracha" ? "caderno-desenho borracha" : "caderno-desenho";
  // Os traços já gravados só são recalculados quando a cena muda. Antes, trocar
  // a cor refazia o contorno de todos os traços de todas as páginas — no iPad
  // isso travava a tela e a cor escolhida demorava a aparecer marcada.
  const gravados = <DesenhoEstatico elementos={cena.elementos} imagemUrl={imagemUrl} />;
  return (
    <svg ref={ref} className={classe} viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none"
      onPointerDown={inicio} onPointerMove={mover} onPointerUp={fim} onPointerCancel={fim}>
      {gravados}
      {vivo && !formaSegurada && <g className={ehLaser ? "caderno-laser" : undefined}><TracoSvg traco={vivo} /></g>}
      {formaSegurada && <path d={caminhoDeForma(formaSegurada)} fill="none" stroke={formaSegurada.cor} strokeWidth={formaSegurada.espessura} strokeLinecap="round" strokeLinejoin="round" />}
      {rastros.map((r) => <g key={r.id} className="caderno-laser some"><TracoSvg traco={r} /></g>)}
      {formaViva && <path d={caminhoDeForma(formaViva)} fill="none" stroke={formaViva.cor} strokeWidth={formaViva.espessura} strokeLinecap="round" strokeLinejoin="round" />}
      {apagador && <circle cx={apagador.x} cy={apagador.y} r={raioApagador} className="caderno-apagador" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

type IconeUI = React.ComponentType<{ size?: string; "aria-hidden"?: "true" }>;
/** Ferramentas da barra principal (como no Goodnotes). Algumas reúnem duas:
 *  Selecionar (toque ou laço), Formas (com a seta) e Texto (com a nota adesiva).
 *  A escolha entre elas fica na barra de contexto. */
type GrupoFerramenta = "selecao" | "caneta" | "lapis" | "pincel" | "marcatexto" | "borracha" | "forma" | "texto" | "laser";
const FERRAMENTAS_UI: { id: GrupoFerramenta; icone: IconeUI }[] = [
  { id: "selecao", icone: IconeCursor }, { id: "caneta", icone: PenLine }, { id: "lapis", icone: Pencil }, { id: "pincel", icone: Wand2 },
  { id: "marcatexto", icone: Highlighter }, { id: "borracha", icone: Eraser }, { id: "forma", icone: Shapes }, { id: "texto", icone: Type }, { id: "laser", icone: IconeLaser },
];
const grupoDe = (f: FerramentaUI): GrupoFerramenta => (f === "laco" ? "selecao" : f === "seta" ? "forma" : f === "nota" ? "texto" : (f as GrupoFerramenta));

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

/** Botões de escolha única da barra de contexto (com texto ou ícone). */
function Opcoes<T extends string>({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: T; opcoes: { valor: T; nome: string; icone?: IconeUI }[]; aoMudar: (v: T) => void }) {
  return (
    <span className="caderno-ctx-grupo" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => {
        const Icone = o.icone;
        return (
          <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor} title={o.nome} aria-label={Icone ? o.nome : undefined}
            className={`caderno-sub-botao${Icone ? "" : " texto"}${valor === o.valor ? " ativo" : ""}`} onClick={() => aoMudar(o.valor)}>
            {Icone ? <Icone size="1.15em" aria-hidden="true" /> : o.nome}
          </button>
        );
      })}
    </span>
  );
}

/** Liga/desliga pequeno da barra de contexto. */
function Alternar({ nome, ligado, aoMudar, titulo }: { nome: string; ligado: boolean; aoMudar: (v: boolean) => void; titulo?: string }) {
  return (
    <button type="button" className={ligado ? "caderno-sub-botao texto ativo" : "caderno-sub-botao texto"} aria-pressed={ligado} title={titulo} onClick={() => aoMudar(!ligado)}>
      {ligado && <Check size="0.95em" aria-hidden="true" />} {nome}
    </button>
  );
}

/** Três espessuras salvas (como no Goodnotes). Tocar na escolhida abre os ajustes. */
function Espessuras({ valores, atual, cor, aoEscolher, aoAjustar }: { valores: number[]; atual: number; cor: string; aoEscolher: (n: number, i: number) => void; aoAjustar: () => void }) {
  const corValida = /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#1f2937";
  const maior = Math.max(...valores, 1);
  return (
    <span className="caderno-ctx-grupo" role="radiogroup" aria-label={t.contexto.espessura}>
      {valores.map((v, i) => {
        const sel = Math.abs(v - atual) < 0.01;
        const px = 4 + (Math.min(v, maior) / maior) * 14;
        return (
          <button key={i} type="button" role="radio" aria-checked={sel} className={sel ? "caderno-espessura ativo" : "caderno-espessura"}
            aria-label={`${t.contexto.espessuras[i] ?? ""} (${v.toFixed(1)} px)${sel ? `. ${t.contexto.tocarAjustes}` : ""}`}
            onClick={() => (sel ? aoAjustar() : aoEscolher(v, i))}>
            <span style={{ width: px, height: px, background: corValida }} aria-hidden="true" />
          </button>
        );
      })}
    </span>
  );
}

/** Cores salvas e a cor livre. A cor livre é um seletor visível (no iPad, o
 *  escondido não abria). Marca a cor já no toque, sem esperar o "click". */
function CoresContexto({ cor, favoritos, aoCor, aoCorPrevia }: { cor: string; favoritos: string[]; aoCor: (c: string) => void; aoCorPrevia: (c: string) => void }) {
  const seletorRef = useRef<HTMLInputElement>(null);
  const aoCorRef = useRef(aoCor);
  aoCorRef.current = aoCor;
  useEffect(() => {
    const el = seletorRef.current;
    if (!el) return;
    // Enquanto arrasta no seletor, só pré-visualiza; ao confirmar, a cor entra nas salvas.
    const confirmar = () => aoCorRef.current(el.value);
    el.addEventListener("change", confirmar);
    return () => el.removeEventListener("change", confirmar);
  }, []);
  const atual = cor.toLowerCase();
  return (
    <span className="caderno-ctx-grupo caderno-cores" role="group" aria-label={t.ferramentas.cor}>
      {favoritos.map((c) => (
        <button key={c} type="button" className={atual === c.toLowerCase() ? "caderno-cor atual" : "caderno-cor"} style={{ background: c }}
          onPointerDown={(e) => { if (e.button === 0 && atual !== c.toLowerCase()) aoCorPrevia(c); }}
          onMouseDown={(e) => e.preventDefault() /* não tira o cursor do texto em edição */}
          onClick={() => aoCor(c)} aria-label={c} aria-pressed={atual === c.toLowerCase()} />
      ))}
      <span className="caderno-cor-mais">
        <input ref={seletorRef} type="color" className="caderno-cor-nativa" value={/^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#000000"}
          onChange={(e) => aoCorPrevia(e.target.value)} aria-label={t.ferramentas.escolherCor} title={t.ferramentas.escolherCor} />
        <Plus aria-hidden="true" size="0.8em" className="caderno-cor-mais-icone" />
      </span>
    </span>
  );
}

/** Formas na barra de contexto (a seta fica junto). */
const FORMAS_CONTEXTO = [...FORMAS_BARRA, "seta"] as const;

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

/** Texto sem caixa aberta: tamanho e negrito das próximas caixas. */
function SubTextoPadrao({ tamanho, aoTamanho, negrito, aoNegrito }: { tamanho: number; aoTamanho: (n: number) => void; negrito: boolean; aoNegrito: (v: boolean) => void }) {
  return (
    <span className="caderno-fmt-barra" role="group" aria-label={t.texto.formatar}>
      <button type="button" className={negrito ? "caderno-fmt ativo" : "caderno-fmt"} onClick={() => aoNegrito(!negrito)} aria-pressed={negrito} aria-label={textos.rico.negrito}><Bold size="1em" aria-hidden="true" /></button>
      <span className="caderno-fmt-grupo">
        <button type="button" className="caderno-fmt" onClick={() => aoTamanho(Math.max(12, tamanho - 2))} aria-label={t.texto.diminuir}>A−</button>
        <span className="caderno-fmt-valor" aria-live="polite">{t.texto.tamanhoAtual(tamanho)}</span>
        <button type="button" className="caderno-fmt" onClick={() => aoTamanho(Math.min(80, tamanho + 2))} aria-label={t.texto.aumentar}>A+</button>
      </span>
    </span>
  );
}

/** Pontas da caneta (estilos do Goodnotes): mudam a sensibilidade à pressão. */
type PontaCaneta = "tinteiro" | "esfero" | "pincel";
const PONTAS: Record<PontaCaneta, { afinar: number; alisar: number }> = {
  tinteiro: { afinar: 0.6, alisar: 0.5 },
  esfero: { afinar: 0.08, alisar: 0.55 },
  pincel: { afinar: 0.85, alisar: 0.45 },
};
const pontaDe = (a: AjusteTraco): PontaCaneta | null =>
  (Object.keys(PONTAS) as PontaCaneta[]).find((k) => Math.abs(PONTAS[k].afinar - a.afinar) < 0.02) ?? null;

/** Tudo o que a barra de contexto precisa saber e fazer. */
interface Contexto {
  ferramenta: FerramentaUI;
  aoFerramenta: (f: FerramentaUI) => void;
  cor: string; favoritos: string[]; aoCor: (c: string) => void; aoCorPrevia: (c: string) => void;
  ajustes: Record<Ferramenta, AjusteTraco>; espessuras: Record<string, number[]>;
  aoEspessura: (f: Ferramenta | "forma", n: number) => void; aoAjuste: (f: Ferramenta, patch: Partial<AjusteTraco>) => void;
  aoAjustar: (f: FerramentaUI) => void;
  forma: AjusteForma; aoForma: (p: Partial<AjusteForma>) => void;
  modeloPincel: ModeloPincel; aoModeloPincel: (m: ModeloPincel) => void;
  modoBorracha: ModoBorracha; aoModoBorracha: (m: ModoBorracha) => void;
  opcoes: OpcoesCaderno; aoOpcoes: (p: Partial<OpcoesCaderno>) => void;
  acrescentar: boolean; aoAcrescentar: (v: boolean) => void;
  editandoTexto: boolean; tamTexto: number; aoTamTexto: (n: number) => void; negritoTexto: boolean; aoNegritoTexto: (v: boolean) => void;
  slotTexto: (el: HTMLDivElement | null) => void;
  /** A página atual é de texto: a ferramenta Texto edita o texto dela. */
  paginaTexto: boolean;
}

/** A barra de contexto da ferramenta (como a do Goodnotes): espessuras, cores
 *  salvas e as opções próprias de cada uma. */
function BarraContexto(c: Contexto) {
  const g = grupoDe(c.ferramenta);
  const tc = t.contexto;
  const cores = <CoresContexto cor={c.cor} favoritos={c.favoritos} aoCor={c.aoCor} aoCorPrevia={c.aoCorPrevia} />;
  const espessuraDe = (f: Ferramenta) => (
    <Espessuras valores={c.espessuras[f] ?? ESPESSURAS_PADRAO[f]} atual={c.ajustes[f].tamanho} cor={f === "borracha" ? "#8a8f98" : c.cor}
      aoEscolher={(n) => c.aoEspessura(f, n)} aoAjustar={() => c.aoAjustar(f)} />
  );
  const sep = <span className="caderno-barra-sep" aria-hidden="true" />;
  switch (g) {
    case "caneta": {
      const ponta = pontaDe(c.ajustes.caneta);
      return (
        <>
          <DialogTrigger>
            <Button className="caderno-sub-botao texto" aria-label={`${tc.ponta}: ${ponta ? tc.pontas[ponta] : tc.pontaPropria}`}>{ponta ? tc.pontas[ponta] : tc.pontaPropria} <ChevronDown size="0.9em" aria-hidden="true" /></Button>
            <Popover className="caderno-popover" placement="top">
              <Dialog className="caderno-popover-miolo" aria-label={tc.ponta}>
                <div className="caderno-pinceis" role="radiogroup" aria-label={tc.ponta}>
                  {(Object.keys(PONTAS) as PontaCaneta[]).map((k) => {
                    const amostra: Traco = { tipo: "traco", id: `ponta-${k}`, ferramenta: "caneta", cor: /^#[0-9a-fA-F]{6}$/.test(c.cor) ? c.cor : "#1f2937", espessura: 6, afinar: PONTAS[k].afinar, alisar: PONTAS[k].alisar, opacidade: 1, pressao: true, pontos: PONTOS_AMOSTRA };
                    return (
                      <button key={k} type="button" role="radio" aria-checked={ponta === k} className={ponta === k ? "caderno-pincel ativo" : "caderno-pincel"} onClick={() => c.aoAjuste("caneta", PONTAS[k])}>
                        <svg viewBox="0 0 300 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><TracoSvg traco={amostra} /></svg>
                        <span>{tc.pontas[k]}</span>
                      </button>
                    );
                  })}
                </div>
              </Dialog>
            </Popover>
          </DialogTrigger>
          {sep}{espessuraDe("caneta")}{sep}{cores}{sep}
          <Alternar nome={tc.segurarForma} titulo={tc.segurarFormaAjuda} ligado={c.opcoes.segurarForma} aoMudar={(v) => c.aoOpcoes({ segurarForma: v })} />
        </>
      );
    }
    case "lapis":
      return <>{espessuraDe("lapis")}{sep}{cores}{sep}<Alternar nome={tc.segurarForma} titulo={tc.segurarFormaAjuda} ligado={c.opcoes.segurarForma} aoMudar={(v) => c.aoOpcoes({ segurarForma: v })} /></>;
    case "pincel":
      return (
        <>
          <DialogTrigger>
            <Button className="caderno-sub-botao texto">{tc.modeloPincel(t.pincel.modelos[c.modeloPincel])} <ChevronDown size="0.9em" aria-hidden="true" /></Button>
            <Popover className="caderno-popover" placement="top">
              <Dialog className="caderno-popover-miolo" aria-label={t.pincel.modelo}>
                <SubPincel modelo={c.modeloPincel} cor={c.cor} ajuste={c.ajustes.pincel} aoMudar={c.aoModeloPincel} />
              </Dialog>
            </Popover>
          </DialogTrigger>
          {sep}{espessuraDe("pincel")}{sep}{cores}
        </>
      );
    case "marcatexto":
      return <>{espessuraDe("marcatexto")}{sep}{cores}{sep}<Alternar nome={tc.linhaReta} titulo={tc.linhaRetaAjuda} ligado={c.opcoes.marcaReto} aoMudar={(v) => c.aoOpcoes({ marcaReto: v })} /></>;
    case "borracha":
      return (
        <>
          <Opcoes rotulo={t.borracha.modo} valor={c.modoBorracha} aoMudar={c.aoModoBorracha} opcoes={[{ valor: "pedaco", nome: t.borracha.modos.pedaco }, { valor: "objeto", nome: t.borracha.modos.objeto }]} />
          {sep}{espessuraDe("borracha")}{sep}
          <Alternar nome={tc.soMarcaTexto} titulo={tc.soMarcaTextoAjuda} ligado={c.opcoes.borrachaSoMarca} aoMudar={(v) => c.aoOpcoes({ borrachaSoMarca: v })} />
          <Alternar nome={tc.voltarFerramenta} titulo={tc.voltarFerramentaAjuda} ligado={c.opcoes.borrachaVolta} aoMudar={(v) => c.aoOpcoes({ borrachaVolta: v })} />
        </>
      );
    case "forma": {
      const atual: (typeof FORMAS_CONTEXTO)[number] = c.ferramenta === "seta" ? "seta" : (c.forma.tipo as (typeof FORMAS_CONTEXTO)[number]);
      return (
        <>
          <Opcoes rotulo={t.forma.qual} valor={atual}
            aoMudar={(f) => { if (f === "seta") c.aoFerramenta("seta"); else { c.aoForma({ tipo: f }); c.aoFerramenta("forma"); } }}
            opcoes={FORMAS_CONTEXTO.map((f) => ({ valor: f, nome: t.forma.nomes[f], icone: f === "seta" ? IconeSeta : ICONES_FORMA[f] }))} />
          {sep}
          <Espessuras valores={c.espessuras.forma ?? ESPESSURAS_FORMA} atual={c.forma.espessura} cor={c.cor} aoEscolher={(n) => c.aoEspessura("forma", n)} aoAjustar={() => c.aoAjustar(c.ferramenta)} />
          {sep}{cores}
        </>
      );
    }
    case "texto":
      return (
        <>
          <Opcoes rotulo={tc.tipoTexto} valor={c.ferramenta === "nota" ? "nota" : "texto"} aoMudar={(v) => c.aoFerramenta(v)}
            opcoes={[{ valor: "texto", nome: c.paginaTexto ? tc.textoDaPagina : tc.caixa }, { valor: "nota", nome: t.ferramentas.nomes.nota }]} />
          {sep}
          {!c.editandoTexto && !(c.paginaTexto && c.ferramenta === "texto") && <SubTextoPadrao tamanho={c.tamTexto} aoTamanho={c.aoTamTexto} negrito={c.negritoTexto} aoNegrito={c.aoNegritoTexto} />}
          <div ref={c.slotTexto} className="caderno-subbarra-slot" />
          {c.ferramenta === "texto" && !c.paginaTexto && <>{sep}{cores}</>}
        </>
      );
    case "selecao":
      return (
        <>
          <Opcoes rotulo={tc.comoSelecionar} valor={c.ferramenta === "laco" ? "laco" : "selecao"} aoMudar={(v) => c.aoFerramenta(v)}
            opcoes={[{ valor: "selecao", nome: tc.tocar }, { valor: "laco", nome: tc.laco }]} />
          <Alternar nome={t.selecao.acrescentar} ligado={c.acrescentar} aoMudar={c.aoAcrescentar} />
          <p className="caderno-subbarra-dica">{c.ferramenta === "laco" ? t.laco.dicaCurta : t.selecao.dica}</p>
        </>
      );
    case "laser":
      return (
        <>
          <span className="caderno-ctx-grupo caderno-cores" role="radiogroup" aria-label={tc.corLaser}>
            {CORES_LASER.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={c.opcoes.corLaser === k} aria-label={tc.coresLaser[k as keyof typeof tc.coresLaser]}
                className={c.opcoes.corLaser === k ? "caderno-cor atual" : "caderno-cor"} style={{ background: k }} onClick={() => c.aoOpcoes({ corLaser: k })} />
            ))}
          </span>
          <p className="caderno-subbarra-dica">{tc.laserDica}</p>
        </>
      );
  }
}

function BarraFerramentas({ ferramenta, aoFerramenta, aoAjustar, painelAberto, aoPainel, corBarra, aoInserirImagem, aoCriarIa, aoAdesivos, reguaLigada, aoRegua, travada, aoTravar, pos, aoPos, aoCiclar, miolo, dica, aoFecharDica, aoDesfazer, aoRefazer, podeDesfazer, podeRefazer, contexto }: {
  ferramenta: FerramentaUI; aoFerramenta: (f: FerramentaUI) => void; aoAjustar: (f: FerramentaUI) => void;
  painelAberto: boolean; aoPainel: (v: boolean) => void;
  corBarra: string; aoInserirImagem: () => void; aoCriarIa: () => void; aoAdesivos: () => void;
  reguaLigada: boolean; aoRegua: () => void;
  travada: boolean; aoTravar: () => void;
  /** Lado da tela onde a barra fica; arrastar pela alça muda o lado. */
  pos: PosBarra; aoPos: (p: PosBarra) => void; aoCiclar: () => void; miolo: React.RefObject<HTMLDivElement | null>;
  dica: boolean; aoFecharDica: () => void;
  aoDesfazer: () => void; aoRefazer: () => void; podeDesfazer: boolean; podeRefazer: boolean;
  /** A barra de contexto da ferramenta (espessuras, cores, opções). */
  contexto: React.ReactNode;
}) {
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
  const estilo = corBarra ? ({ background: corBarra, "--barra-fg": corContraste(corBarra) } as React.CSSProperties) : undefined;
  const classe = `${vertical ? "caderno-barra vertical" : "caderno-barra"}${corBarra ? " tintada" : ""}`;
  const grupo = grupoDe(ferramenta);
  const mostrarContexto = !!contexto && painelAberto;
  const mostrarDica = dica && !mostrarContexto;
  // Tocar numa ferramenta escolhe; tocar de novo mostra a barra de contexto ou,
  // com ela à vista, abre os ajustes (como no Goodnotes).
  const tocarFerramenta = (id: GrupoFerramenta) => {
    if (grupo !== id) return aoFerramenta(id === "selecao" && ferramenta === "laco" ? "laco" : id);
    if (!painelAberto) return aoPainel(true);
    if (id !== "selecao" && id !== "laser") aoAjustar(ferramenta);
  };
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
          <Button className="botao-icone" onPress={aoDesfazer} isDisabled={!podeDesfazer} aria-label={`${t.ferramentas.desfazer} (Ctrl + Z)`}><Undo2 aria-hidden="true" size="1.1em" /></Button>
          <Button className="botao-icone" onPress={aoRefazer} isDisabled={!podeRefazer} aria-label={`${t.ferramentas.refazer} (Ctrl + Y)`}><Redo2 aria-hidden="true" size="1.1em" /></Button>
        </span>
        <span className="caderno-barra-sep" aria-hidden="true" />
        <span className="caderno-barra-grupo">
          {FERRAMENTAS_UI.map(({ id, icone: Icone }) => (
            <Button key={id} className={`caderno-ferramenta${grupo === id ? " ativa" : ""}`}
              onPress={() => tocarFerramenta(id)} aria-pressed={grupo === id}
              aria-label={grupo === id ? `${t.ferramentas.nomes[id]}. ${painelAberto ? t.ferramentas.tocarDeNovo : t.contexto.mostrar}` : t.ferramentas.nomes[id]}>
              <Icone aria-hidden="true" size="1.2em" />
            </Button>
          ))}
        </span>
        <span className="caderno-barra-sep" aria-hidden="true" />
        <span className="caderno-barra-grupo">
          <MenuTrigger>
            <Button className="botao-icone" aria-label={t.contexto.inserir}><ImagePlus aria-hidden="true" size="1.1em" /></Button>
            <Popover className="menu-popover" placement={pos === "baixo" ? "top" : pos === "cima" ? "bottom" : pos === "direita" ? "left" : "right"}>
              <Menu className="menu-lista" aria-label={t.contexto.inserir} onAction={(k) => { if (k === "imagem") aoInserirImagem(); else if (k === "adesivos") aoAdesivos(); else if (k === "ia") aoCriarIa(); }}>
                <MenuItem id="imagem" className="menu-item">{t.contexto.inserirImagem}</MenuItem>
                <MenuItem id="adesivos" className="menu-item">{t.adesivos.abrir}</MenuItem>
                <MenuItem id="ia" className="menu-item">{t.imagemIa.abrir}</MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
          <Button className={reguaLigada ? "botao-icone ativo" : "botao-icone"} onPress={aoRegua} aria-label={t.regua.titulo} aria-pressed={reguaLigada}><Ruler aria-hidden="true" size="1.1em" /></Button>
          <Button className={travada ? "botao-icone ativo" : "botao-icone"} onPress={aoTravar} aria-pressed={travada} aria-label={t.trava.travar}>
            {travada ? <IconeCadeado aria-hidden="true" size="1.1em" /> : <IconeCadeadoAberto aria-hidden="true" size="1.1em" />}
          </Button>
        </span>
      </div>
      {mostrarContexto && (
        <div className="caderno-flutuante caderno-subbarra caderno-contexto" role="group" aria-label={t.ferramentas.opcoesDe(t.ferramentas.nomes[ferramenta])}>
          {contexto}
          <button type="button" className="caderno-sub-botao caderno-contexto-fechar" onClick={() => aoPainel(false)} aria-label={t.ferramentas.fecharOpcoes} title={t.ferramentas.fecharOpcoes}><X aria-hidden="true" size="1em" /></button>
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

type AlvoFolha = "atual" | "todas" | { de: number; ate: number };
function EditorFolha({ inicial, tamanho, total, atual, ia, aoMudarIa, aoAplicar, aoFechar }: { inicial: Papel; tamanho: string; total: number; atual: number; ia: EstadoIa | null; aoMudarIa: (e: EstadoIa) => void; aoAplicar: (p: Papel, alvo: AlvoFolha) => void; aoFechar: () => void }) {
  const [papel, setPapel] = useState<PapelPagina>(inicial);
  if (papel.capa) {
    // Página-capa: escolhe o modelo da capa (o resto se edita na própria página).
    return (
      <div className="formulario">
        <div className="caderno-folha-previa"><Folha papel={papel} tamanho={tamanho} className="caderno-folha" /></div>
        <EscolherCapa capa={papel.capa} aoMudar={(capa) => setPapel((p) => ({ ...p, capa }))} ia={ia} aoMudarIa={aoMudarIa} />
        <p className="campo-ajuda">{t.folha.capaAjuda}</p>
        <div className="janela-acoes">
          <Button className="botao" onPress={() => setPapel((p) => semCapa(p))}>{t.folha.virarFolha}</Button>
          <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
          <Button className="botao principal" onPress={() => aoAplicar(papel, "atual")}>{t.folha.aplicar}</Button>
        </div>
      </div>
    );
  }
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

      <SeletorCor rotulo={t.folha.corPapel} valor={papel.corPapel} opcoes={CORES_PAPEL} antigas={HEX_ETIQUETA} aoMudar={(corPapel) => mudar({ corPapel })} />
      <Deslizante rotulo={t.folha.opacPapel} valor={papel.opacPapel ?? 1} min={0.1} max={1} passo={0.05} aoMudar={(n) => mudar({ opacPapel: n })} mostrar={pct} />
      {papel.modelo !== "liso" && (
        <>
          <SeletorCor rotulo={t.folha.corLinha} valor={papel.corLinha} opcoes={CORES_LINHA} antigas={HEX_ETIQUETA} aoMudar={(corLinha) => mudar({ corLinha })} />
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
