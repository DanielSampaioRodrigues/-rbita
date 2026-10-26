import { useEffect, useId, useState } from "react";
import { Button, Form } from "react-aria-components";
import { lerMetadados } from "@orbita/leitor";
import { api, escolherLivro, type CorEtiqueta, type GrupoLivro, type Livro } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { Confirmar, Janela } from "../componentes/Janela";
import { EscolherCor } from "../ideias/etiquetas";
import { BookOpen, Check, Pencil, Plus, Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { LeitorLivro } from "./Leitor";

const t = textos.leitura;
const ORDEM: Livro["status"][] = ["lendo", "quero", "pausado", "lido"];
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const dataLegivel = (iso: string) => (iso ? fmtData.format(new Date(`${iso}T00:00:00`)) : "");

function base64ParaBytes(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function livroNovo(): Livro {
  return { id: "", titulo: "", autor: "", status: "quero", ondeParei: "", impressoes: "", inicio: "", fim: "", formato: "", arquivoId: "", grupoId: "", cor: "mar", criadoEm: 0 };
}

export function PaginaLeitura() {
  const [livros, setLivros] = useState<Livro[]>([]);
  const [grupos, setGrupos] = useState<GrupoLivro[]>([]);
  const [editando, setEditando] = useState<Livro | null>(null);
  const [excluindo, setExcluindo] = useState<Livro | null>(null);
  const [editandoGrupo, setEditandoGrupo] = useState<GrupoLivro | null>(null);
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
      (e) => setErro(e instanceof Error ? e.message : String(e)),
    );
  }, [mudancas]);

  const mudarStatus = async (l: Livro, status: string) => {
    await api.mudarStatusLivro(l.id, status);
    avisarMudanca();
  };

  const mudarGrupo = async (l: Livro, grupoId: string) => {
    await api.salvarLivro({ ...l, grupoId });
    avisarMudanca();
  };

  const excluir = async () => {
    if (!excluindo) return;
    await api.excluirLivro(excluindo.id);
    setExcluindo(null);
    avisarMudanca();
  };

  const excluirGrupo = async () => {
    if (!excluindoGrupo) return;
    await api.excluirGrupoLivro(excluindoGrupo.id);
    setExcluindoGrupo(null);
    avisarMudanca();
  };

  if (lendo) return <LeitorLivro livro={lendo} aoFechar={() => setLendo(null)} />;

  // Prateleiras nomeadas primeiro (em ordem), depois os livros sem prateleira.
  const prateleiras: { id: string; nome: string }[] = [
    ...grupos.map((g) => ({ id: g.id, nome: g.nome })),
    { id: "", nome: t.semPrateleira },
  ];
  const ordenar = (a: Livro, b: Livro) =>
    (ORDEM.indexOf(a.status) - ORDEM.indexOf(b.status)) || a.titulo.localeCompare(b.titulo);

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <div className="botoes">
        <Button className="botao principal" onPress={() => setEditando(livroNovo())}>
          <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
        </Button>
        <Button className="botao" onPress={() => setEditandoGrupo({ id: "", nome: "", criadoEm: 0 })}>
          <Plus aria-hidden="true" size="1.1em" /> {t.prateleiras.adicionar}
        </Button>
      </div>

      {livros.length === 0 ? (
        <section className="cartao largura-leitura esticado"><p className="texto-suave">{t.semLivros}</p></section>
      ) : (
        prateleiras
          .filter((p) => (p.id === "" ? livros.some((l) => !grupos.some((g) => g.id === l.grupoId)) : livros.some((l) => l.grupoId === p.id)))
          .map((p) => {
            const daPrateleira = (p.id === ""
              ? livros.filter((l) => !grupos.some((g) => g.id === l.grupoId))
              : livros.filter((l) => l.grupoId === p.id)
            ).sort(ordenar);
            const grupo = grupos.find((g) => g.id === p.id);
            return (
              <section key={p.id || "sem"} className="cartao largura-leitura esticado" aria-labelledby={`prat-${p.id || "sem"}`}>
                <div className="linha-ajuste">
                  <h2 id={`prat-${p.id || "sem"}`}>{p.nome}</h2>
                  {grupo && (
                    <span className="linha-ajuste">
                      <Button className="botao-icone" onPress={() => setEditandoGrupo(grupo)} aria-label={`${t.prateleiras.editar}: ${grupo.nome}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
                      <Button className="botao-icone" onPress={() => setExcluindoGrupo(grupo)} aria-label={`${t.prateleiras.excluir}: ${grupo.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
                    </span>
                  )}
                </div>
                <ul className="lista-simples sem-marcador">
                  {daPrateleira.map((l) => (
                    <LivroCartao key={l.id} livro={l} grupos={grupos} aoMudarStatus={mudarStatus} aoMudarGrupo={mudarGrupo} aoLer={() => setLendo(l)} aoEditar={() => setEditando(l)} aoExcluir={() => setExcluindo(l)} />
                  ))}
                </ul>
              </section>
            );
          })
      )}

      <Aviso>{erro}</Aviso>

      <Janela titulo={editando && editando.id ? t.form.editarTitulo : t.form.novo} aberta={editando !== null} aoFechar={() => setEditando(null)}>
        {editando && <FormLivro key={editando.id || "novo"} inicial={editando} grupos={grupos} aoFechar={() => setEditando(null)} />}
      </Janela>

      <Janela titulo={editandoGrupo && editandoGrupo.id ? t.prateleiras.editar : t.prateleiras.novo} aberta={editandoGrupo !== null} aoFechar={() => setEditandoGrupo(null)}>
        {editandoGrupo && <FormPrateleira key={editandoGrupo.id || "novo"} inicial={editandoGrupo} aoFechar={() => setEditandoGrupo(null)} />}
      </Janela>

      <Confirmar titulo={t.excluir} texto={excluindo ? t.confirmarExcluir(excluindo.titulo) : ""} confirmar={t.excluir} aberta={excluindo !== null} aoCancelar={() => setExcluindo(null)} aoConfirmar={() => void excluir()} />
      <Confirmar titulo={t.prateleiras.excluir} texto={excluindoGrupo ? t.prateleiras.confirmarExcluir(excluindoGrupo.nome) : ""} confirmar={t.prateleiras.excluir} aberta={excluindoGrupo !== null} aoCancelar={() => setExcluindoGrupo(null)} aoConfirmar={() => void excluirGrupo()} />
    </div>
  );
}

function LivroCartao({ livro, grupos, aoMudarStatus, aoMudarGrupo, aoLer, aoEditar, aoExcluir }: { livro: Livro; grupos: GrupoLivro[]; aoMudarStatus: (l: Livro, s: string) => void; aoMudarGrupo: (l: Livro, g: string) => void; aoLer: () => void; aoEditar: () => void; aoExcluir: () => void }) {
  const idStatus = useId();
  const idGrupo = useId();
  const temArquivo = livro.arquivoId !== "" && livro.formato !== "";
  return (
    <li className="livro-cartao">
      <div className="linha-ajuste">
        <span className="quebra livro-nome">
          <span className={`etiqueta-cor cor-${livro.cor || "cinza"}`} aria-hidden="true" />
          <span>
            <strong>{livro.titulo}</strong>
            {livro.autor && <span className="texto-suave"> {t.porAutor(livro.autor)}</span>}
          </span>
          <span className="livro-selo">{t.status[livro.status as keyof typeof t.status]}</span>
        </span>
        <span className="linha-ajuste">
          {temArquivo && (
            <Button className="botao" onPress={aoLer}><BookOpen aria-hidden="true" size="1.1em" /> {t.abrir}</Button>
          )}
          <Button className="botao-icone" onPress={aoEditar} aria-label={`${t.editar}: ${livro.titulo}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
          <Button className="botao-icone" onPress={aoExcluir} aria-label={`${t.excluir}: ${livro.titulo}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
        </span>
      </div>
      {livro.ondeParei && <p className="quebra"><strong>{t.ondeParei}:</strong> {livro.ondeParei}</p>}
      {livro.impressoes && <p className="quebra"><strong>{t.impressoes}:</strong> {livro.impressoes}</p>}
      {(livro.inicio || livro.fim) && (
        <p className="campo-ajuda">
          {livro.inicio && `${t.inicio} ${dataLegivel(livro.inicio)}`}
          {livro.inicio && livro.fim && " · "}
          {livro.fim && `${t.fim} ${dataLegivel(livro.fim)}`}
        </p>
      )}
      <div className="linha-ajuste">
        <div className="campo">
          <label className="campo-ajuda" htmlFor={idStatus}>{t.moverPara}</label>
          <select id={idStatus} className="entrada-texto sozinha" value={livro.status} onChange={(e) => aoMudarStatus(livro, e.target.value)}>
            {ORDEM.map((st) => (
              <option key={st} value={st}>{t.status[st as keyof typeof t.status]}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label className="campo-ajuda" htmlFor={idGrupo}>{t.prateleira}</label>
          <select id={idGrupo} className="entrada-texto sozinha" value={livro.grupoId} onChange={(e) => aoMudarGrupo(livro, e.target.value)}>
            <option value="">{t.semPrateleira}</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>{g.nome}</option>
            ))}
          </select>
        </div>
      </div>
    </li>
  );
}

function FormLivro({ inicial, grupos, aoFechar }: { inicial: Livro; grupos: GrupoLivro[]; aoFechar: () => void }) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [autor, setAutor] = useState(inicial.autor);
  const [status, setStatus] = useState(inicial.status);
  const [grupoId, setGrupoId] = useState(inicial.grupoId);
  const [cor, setCor] = useState<CorEtiqueta>((inicial.cor || "mar") as CorEtiqueta);
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
  const editando = inicial.id !== "";
  const temArquivo = inicial.arquivoId !== "" || caminho !== null;

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
      // Se escolheu um arquivo novo, anexa ao livro e guarda o formato.
      if (caminho) {
        const anexo = await api.anexarArquivo(salvo.id, caminho);
        const formato = caminho.toLowerCase().endsWith(".pdf") ? "pdf" : "epub";
        await api.salvarLivro({ ...salvo, formato, arquivoId: anexo.id });
      }
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.form.titulo} valor={titulo} aoMudar={setTitulo} autoFocus maximo={160} semDitado />
      <Campo rotulo={t.form.autor} valor={autor} aoMudar={setAutor} maximo={120} semDitado />
      <div className="campo">
        <label className="campo-rotulo" htmlFor={idStatus}>{t.form.status}</label>
        <select id={idStatus} className="entrada-texto sozinha" value={status} onChange={(e) => setStatus(e.target.value)}>
          {ORDEM.map((st) => (
            <option key={st} value={st}>{t.status[st as keyof typeof t.status]}</option>
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
      <EscolherCor valor={cor} aoMudar={setCor} rotulo={t.corLivro} />
      <div className="campo">
        <span className="campo-rotulo">{t.form.arquivo}</span>
        <div className="linha-ajuste">
          <Button className={temArquivo ? "botao principal" : "botao"} onPress={() => void escolher()} isDisabled={lendoMeta}>
            {temArquivo ? (
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
      <CampoData rotulo={t.inicio} tipo="date" valor={inicio} aoMudar={setInicio} />
      <CampoData rotulo={t.fim} tipo="date" valor={fim} aoMudar={setFim} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.form.salvarMudancas : t.form.salvar}</Button>
      </div>
    </Form>
  );
}

function FormPrateleira({ inicial, aoFechar }: { inicial: GrupoLivro; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarGrupoLivro({ ...inicial, nome });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <p className="texto-suave">{t.prateleiras.intro}</p>
      <Campo rotulo={t.prateleiras.nome} valor={nome} aoMudar={setNome} autoFocus maximo={60} semDitado />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.prateleiras.salvarMudancas : t.prateleiras.salvar}</Button>
      </div>
    </Form>
  );
}
