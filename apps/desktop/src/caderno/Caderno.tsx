import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Form, Label, Radio, RadioGroup } from "react-aria-components";
import { MODELOS_PAPEL, papelDataUri, papelPadrao, TAMANHOS, type CoresPapel, type ModeloPapel, type Papel } from "@orbita/caderno";
import { api, CORES_ETIQUETA, type Capa, type Caderno, type PaginaCaderno, type PastaCaderno } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Interruptor } from "../componentes/Interruptor";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { Bookmark, ChevronLeft, FolderOpen, FolderPlus, LayoutGrid, List, Pencil, PenLine, Plus, SlidersHorizontal, Trash2 } from "../icones";
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

  const infinito = caderno.modo === "infinito";
  const sel = paginas.find((p) => p.id === selId) ?? paginas[0];

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
          <div className="caderno-aviso-breve"><PenLine aria-hidden="true" size="1.1em" /> {t.emBreve}</div>

          {infinito ? (
            <Folha papel={folhaDe(paginas[0] ?? { papel: null } as PaginaCaderno)} tamanho="a4" className="caderno-infinito-previa" />
          ) : (
            <>
              {paginas.map((p, i) => (
                <PaginaView key={p.id} id={`pg-${p.id}`} pagina={p} numero={i + 1} selecionada={p.id === selId} podeApagar={paginas.length > 1}
                  aoSelecionar={() => setSelId(p.id)}
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

      <Janela titulo={t.folha.titulo} aberta={editor} aoFechar={() => setEditor(false)}>
        {editor && <EditorFolha inicial={sel ? folhaDe(sel) : papelPadrao()} tamanho={sel?.tamanho ?? "a4"} varias={paginas.length > 1} aoAplicar={aplicarFolha} aoFechar={() => setEditor(false)} />}
      </Janela>
    </div>
  );
}

function PaginaView({ id, pagina, numero, selecionada, podeApagar, aoSelecionar, aoTitulo, aoMarcar, aoApagar }: {
  id: string; pagina: PaginaCaderno; numero: number; selecionada: boolean; podeApagar: boolean;
  aoSelecionar: () => void; aoTitulo: (t: string) => void; aoMarcar: () => void; aoApagar: () => void;
}) {
  const [titulo, setTitulo] = useState(pagina.titulo);
  useEffect(() => setTitulo(pagina.titulo), [pagina.titulo]);
  return (
    <section id={id} className={selecionada ? "caderno-folha-bloco atual" : "caderno-folha-bloco"} onMouseDown={aoSelecionar}>
      <div className="caderno-folha-topo">
        <span className="texto-suave pequeno">{t.paginas.numero(numero)}</span>
        <input className="entrada-texto sozinha caderno-folha-titulo" value={titulo} placeholder={t.paginas.semTitulo} onChange={(e) => setTitulo(e.target.value)} onBlur={() => titulo !== pagina.titulo && aoTitulo(titulo)} aria-label={t.paginas.tituloCampo} maxLength={80} />
        <Button className={pagina.marcado ? "botao-icone pequeno ativo" : "botao-icone pequeno"} onPress={aoMarcar} aria-label={pagina.marcado ? t.paginas.desmarcar : t.paginas.marcar} aria-pressed={pagina.marcado}><Bookmark aria-hidden="true" size="1em" /></Button>
        {podeApagar && <Button className="botao-icone pequeno" onPress={aoApagar} aria-label={t.paginas.excluir}><Trash2 aria-hidden="true" size="1em" /></Button>}
      </div>
      <Folha papel={folhaDe(pagina)} tamanho={pagina.tamanho} className="caderno-folha" />
    </section>
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
