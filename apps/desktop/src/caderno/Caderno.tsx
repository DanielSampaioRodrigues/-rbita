import { useCallback, useEffect, useState } from "react";
import { Button, Form, Label, Radio, RadioGroup } from "react-aria-components";
import { TAMANHOS } from "@orbita/caderno";
import { api, CORES_ETIQUETA, type Capa, type Caderno, type PaginaCaderno, type PastaCaderno } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { ChevronLeft, LayoutGrid, Pencil, PenLine, Plus, Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
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

  const novo = (): Caderno => ({ id: "", nome: "", modo: "caderno", capa: { tipo: "cor", valor: "mar" }, pastaId: "", criadoEm: 0 });

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <div className="botoes">
        <Button className="botao principal" onPress={() => setEditando(novo())}><Plus aria-hidden="true" size="1.1em" /> {t.novo}</Button>
        <Button className="botao" onPress={() => setEditandoPasta({ id: "", nome: "", criadoEm: 0 })}><Plus aria-hidden="true" size="1.1em" /> {t.novaPasta}</Button>
      </div>

      {cadernos.length === 0 ? (
        <section className="cartao largura-leitura esticado"><p className="texto-suave">{t.vazio}</p></section>
      ) : (
        <>
          {pastas.map((p) => {
            const lista = porPasta(p.id);
            return (
              <section key={p.id} className="caderno-grupo">
                <div className="linha-ajuste">
                  <h2 className="caderno-grupo-titulo">{p.nome} <span className="texto-suave">({lista.length})</span></h2>
                  <span className="linha-ajuste">
                    <Button className="botao-icone" onPress={() => setEditandoPasta(p)} aria-label={`${t.pasta.editar}: ${p.nome}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
                    <Button className="botao-icone" onPress={() => setExcluindoPasta(p)} aria-label={`${t.pasta.excluir}: ${p.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
                  </span>
                </div>
                <GradeCadernos cadernos={lista} aoAbrir={setAberto} aoEditar={setEditando} aoExcluir={setExcluindo} />
              </section>
            );
          })}
          <section className="caderno-grupo">
            {pastas.length > 0 && <h2 className="caderno-grupo-titulo">{t.semPasta} <span className="texto-suave">({semPasta.length})</span></h2>}
            <GradeCadernos cadernos={semPasta} aoAbrir={setAberto} aoEditar={setEditando} aoExcluir={setExcluindo} />
          </section>
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

function GradeCadernos({ cadernos, aoAbrir, aoEditar, aoExcluir }: { cadernos: Caderno[]; aoAbrir: (c: Caderno) => void; aoEditar: (c: Caderno) => void; aoExcluir: (c: Caderno) => void }) {
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

// ---------- Caderno aberto (casca; o desenho chega na etapa seguinte) ----------

function CadernoAberto({ caderno, aoFechar }: { caderno: Caderno; aoFechar: () => void }) {
  const [paginas, setPaginas] = useState<PaginaCaderno[]>([]);
  const [tamanho, setTamanho] = useState<"a4" | "a5" | "carta">("a4");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setPaginas(await api.listarPaginasCaderno(caderno.id));
    } catch (e) {
      setErro(mensagem(e));
    }
  }, [caderno.id]);
  useEffect(() => void carregar(), [carregar]);

  const adicionar = async () => {
    try {
      await api.salvarPaginaCaderno({ id: "", cadernoId: caderno.id, ordem: 0, tamanho, papel: null, criadoEm: 0 });
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

  const infinito = caderno.modo === "infinito";

  return (
    <div className="caderno-tela">
      <div className="leitor-barra">
        <Button className="botao-icone" onPress={aoFechar} aria-label={t.voltar}><ChevronLeft aria-hidden="true" size="1.2em" /></Button>
        <strong className="leitor-titulo quebra">
          {infinito ? <LayoutGrid aria-hidden="true" size="1em" /> : <PenLine aria-hidden="true" size="1em" />} {caderno.nome}
        </strong>
      </div>

      {erro && <div className="leitor-aviso"><Aviso>{erro}</Aviso></div>}

      <div className="caderno-corpo">
        <div className="caderno-aviso-breve"><PenLine aria-hidden="true" size="1.1em" /> {t.emBreve}</div>

        {infinito ? (
          <div className="caderno-infinito-previa" aria-hidden="true" />
        ) : (
          <>
            <div className="linha-ajuste caderno-paginas-topo">
              <h2>{t.paginas.titulo} <span className="texto-suave">({paginas.length})</span></h2>
              <span className="linha-ajuste">
                <Segmentado rotulo={t.paginas.tamanho} valor={tamanho} aoMudar={(v) => setTamanho(v as typeof tamanho)} opcoes={[{ valor: "a4", nome: t.paginas.tamanhos.a4 }, { valor: "a5", nome: t.paginas.tamanhos.a5 }, { valor: "carta", nome: t.paginas.tamanhos.carta }]} />
                <Button className="botao com-icone" onPress={() => void adicionar()}><Plus aria-hidden="true" size="1.1em" /> {t.paginas.adicionar}</Button>
              </span>
            </div>
            {paginas.length === 0 ? (
              <p className="texto-suave">{t.paginas.vazio}</p>
            ) : (
              <ul className="caderno-paginas">
                {paginas.map((p, i) => <ThumbPagina key={p.id} numero={i + 1} pagina={p} aoApagar={() => void apagar(p.id)} podeApagar={paginas.length > 1} />)}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ThumbPagina({ numero, pagina, aoApagar, podeApagar }: { numero: number; pagina: PaginaCaderno; aoApagar: () => void; podeApagar: boolean }) {
  const med = TAMANHOS[pagina.tamanho as keyof typeof TAMANHOS] ?? TAMANHOS.a4;
  const prop = med.largura / med.altura;
  return (
    <li className="caderno-pagina">
      <div className="caderno-pagina-folha" style={{ aspectRatio: `${prop}` }} aria-hidden="true" />
      <div className="caderno-pagina-pe">
        <span className="texto-suave pequeno">{t.paginas.numero(numero)} · {(t.paginas.tamanhos as Record<string, string>)[pagina.tamanho] ?? pagina.tamanho}</span>
        {podeApagar && <Button className="botao-icone pequeno" onPress={aoApagar} aria-label={t.paginas.excluir}><Trash2 aria-hidden="true" size="1em" /></Button>}
      </div>
    </li>
  );
}
