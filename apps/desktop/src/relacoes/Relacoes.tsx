import { Download, ExternalLink, FileText, Link2, Paperclip, Tag, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, escolherArquivoParaAnexar, escolherOndeSalvarAnexo, type Anexo, type Etiqueta, type ItemResumo } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Escolha } from "../componentes/Escolha";
import { Confirmar, Janela } from "../componentes/Janela";
import { avisarMudanca, useMudancas } from "../dados";
import { ChipEtiqueta, EscolherEtiquetas } from "../ideias/etiquetas";
import { textos } from "../textos/pt-BR";

const t = textos.relacoes;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Etiquetas de um item: os nomes à vista e um botão para escolher. Grava ao salvar a janela. */
export function EtiquetasDoItem({ id, marcadas }: { id: string; marcadas: string[] }) {
  const [todas, setTodas] = useState<Etiqueta[]>([]);
  const [editando, setEditando] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarEtiquetas().then(setTodas, () => setTodas([]));
  }, [mudancas]);

  const salvar = async () => {
    if (!editando) return;
    try {
      await api.definirEtiquetasItem(id, editando);
      setEditando(null);
      avisarMudanca();
    } catch (e) {
      setErro(mensagem(e));
    }
  };

  const visiveis = todas.filter((e) => marcadas.includes(e.id));
  return (
    <div className="relacao">
      <h3 className="relacao-titulo">{t.etiquetas}</h3>
      {visiveis.length === 0 ? (
        <p className="texto-suave pequeno">{t.semEtiquetas}</p>
      ) : (
        <ul className="etiquetas-linha" aria-label={t.etiquetas}>
          {visiveis.map((e) => (
            <li key={e.id}><ChipEtiqueta etiqueta={e} /></li>
          ))}
        </ul>
      )}
      <Button className="botao pequeno com-icone" onPress={() => (setErro(null), setEditando(marcadas))}>
        <Tag aria-hidden="true" size="1em" /> {t.editarEtiquetas}
      </Button>
      <Janela titulo={t.editarEtiquetas} aberta={editando !== null} aoFechar={() => setEditando(null)}>
        <div className="formulario">
          <EscolherEtiquetas
            todas={todas}
            marcadas={editando ?? []}
            aoMudar={setEditando}
            aoCriar={(e) => setTodas((ts) => (ts.some((x) => x.id === e.id) ? ts : [...ts, e]))}
          />
          <Aviso>{erro}</Aviso>
          <div className="janela-acoes">
            <Button className="botao" onPress={() => setEditando(null)}>{textos.comum.cancelar}</Button>
            <Button className="botao principal" onPress={salvar}>{textos.comum.salvar}</Button>
          </div>
        </div>
      </Janela>
    </div>
  );
}

/** Ligações com ideias e projetos (nos dois sentidos). Ligar e desligar valem na hora. */
export function LigacoesDoItem({ id }: { id: string }) {
  const [ligados, setLigados] = useState<ItemResumo[]>([]);
  const [opcoes, setOpcoes] = useState<{ valor: string; nome: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  useEffect(() => {
    Promise.all([api.itensLigados(id), api.listarIdeias(), api.listarProjetos()]).then(
      ([l, ideias, projetos]) => {
        setLigados(l);
        const ja = new Set([id, ...l.map((x) => x.id)]);
        setOpcoes([
          ...projetos.filter((p) => !ja.has(p.id)).map((p) => ({ valor: p.id, nome: `${t.tipos.projeto}: ${p.titulo}` })),
          ...ideias.filter((i) => !ja.has(i.id)).map((i) => ({ valor: i.id, nome: `${t.tipos.ideia}: ${i.texto}` })),
        ]);
      },
      (e) => setErro(mensagem(e)),
    );
  }, [id, mudancas]);

  const ligar = async (outro: string, sim: boolean) => {
    setErro(null);
    try {
      await api.ligarItens(id, outro, sim);
      avisarMudanca();
    } catch (e) {
      setErro(mensagem(e));
    }
  };

  return (
    <div className="relacao">
      <h3 className="relacao-titulo">{t.ligacoes}</h3>
      {ligados.length === 0 ? (
        <p className="texto-suave pequeno">{t.semLigacoes}</p>
      ) : (
        <ul className="lista-ligadas">
          {ligados.map((l) => (
            <li key={l.id}>
              <span className="quebra">
                <span className="texto-suave pequeno">{t.tipos[l.tipo]}: </span>
                {l.titulo}
              </span>
              <Button className="botao-icone" onPress={() => ligar(l.id, false)} aria-label={t.desligar(l.titulo)}>
                <X aria-hidden="true" size="1em" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {opcoes.length > 0 && <Escolha rotulo={t.ligarA} valor={null} vazio={t.escolher} opcoes={opcoes} aoMudar={(o) => ligar(o, true)} />}
      <Aviso>{erro}</Aviso>
    </div>
  );
}

/** Miniatura de um anexo de imagem (carregada do cofre só quando aparece). */
export function ImagemAnexo({ id, nome, className }: { id: string; nome: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    api.imagemAnexo(id).then((s) => vivo && setSrc(s), () => vivo && setSrc(null));
    return () => void (vivo = false);
  }, [id]);
  return src ? <img src={src} alt={nome} className={className} /> : <span className={`${className ?? ""} imagem-carregando`} aria-hidden="true" />;
}

/** Imagens, arquivos e links presos a um item. Tudo fica dentro do cofre criptografado. */
export function AnexosDoItem({ id }: { id: string }) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [link, setLink] = useState<{ nome: string; endereco: string } | null>(null);
  const [vendo, setVendo] = useState<Anexo | null>(null);
  const [excluindo, setExcluindo] = useState<Anexo | null>(null);
  const recado = useRecado();

  const carregar = useCallback(() => api.listarAnexos(id).then(setAnexos, (e) => setErro(mensagem(e))), [id]);
  useEffect(() => void carregar(), [carregar]);

  const fazer = async (acao: () => Promise<unknown>) => {
    setErro(null);
    setOcupado(true);
    try {
      await acao();
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  };

  const anexarArquivo = () =>
    fazer(async () => {
      const caminho = await escolherArquivoParaAnexar();
      if (caminho) await api.anexarArquivo(id, caminho);
    });

  const salvarCopia = (a: Anexo) =>
    fazer(async () => {
      const caminho = await escolherOndeSalvarAnexo(a.nome);
      if (caminho) (await api.salvarAnexo(a.id, caminho), recado(t.salvo));
    });

  return (
    <div className="relacao">
      <h3 className="relacao-titulo">{t.anexos}</h3>
      {anexos.length === 0 ? (
        <p className="texto-suave pequeno">{t.semAnexos}</p>
      ) : (
        <ul className="lista-anexos">
          {anexos.map((a) => (
            <li key={a.id} className="anexo">
              {a.tipo === "imagem" ? (
                <Button className="anexo-miniatura" onPress={() => setVendo(a)} aria-label={t.verImagem(a.nome)}>
                  <ImagemAnexo id={a.id} nome="" className="anexo-imagem" />
                </Button>
              ) : (
                <span className="anexo-icone" aria-hidden="true">
                  {a.tipo === "link" ? <Link2 size="1.2em" /> : <FileText size="1.2em" />}
                </span>
              )}
              <span className="anexo-nome">
                <span className="quebra">{a.nome}</span>
                <span className="texto-suave pequeno quebra">
                  {t.tiposAnexo[a.tipo]} · {a.tipo === "link" ? a.endereco : t.tamanho(a.tamanho)}
                </span>
              </span>
              <span className="anexo-acoes">
                <Button className="botao-icone" onPress={() => fazer(() => api.abrirAnexo(a.id))} aria-label={t.abrirNome(a.nome)}>
                  <ExternalLink aria-hidden="true" size="1em" />
                </Button>
                {a.tipo !== "link" && (
                  <Button className="botao-icone" onPress={() => salvarCopia(a)} aria-label={`${t.salvarCopia}: ${a.nome}`}>
                    <Download aria-hidden="true" size="1em" />
                  </Button>
                )}
                <Button className="botao-icone" onPress={() => setExcluindo(a)} aria-label={t.excluirNome(a.nome)}>
                  <Trash2 aria-hidden="true" size="1em" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="botoes">
        <Button className="botao pequeno com-icone" onPress={anexarArquivo} isDisabled={ocupado}>
          <Paperclip aria-hidden="true" size="1em" /> {ocupado ? t.anexando : t.anexarArquivo}
        </Button>
        <Button className="botao pequeno com-icone" onPress={() => (setErro(null), setLink({ nome: "", endereco: "" }))} isDisabled={ocupado}>
          <Link2 aria-hidden="true" size="1em" /> {t.anexarLink}
        </Button>
      </div>
      {anexos.some((a) => a.tipo !== "link") && <p className="texto-suave pequeno">{t.abrirAviso}</p>}
      <Aviso>{erro}</Aviso>

      <Janela titulo={t.anexarLink} aberta={link !== null} aoFechar={() => setLink(null)}>
        {link && (
          <Form
            className="formulario"
            onSubmit={(ev) => {
              ev.preventDefault();
              fazer(async () => (await api.anexarLink(id, link.nome, link.endereco), setLink(null)));
            }}
          >
            <Campo rotulo={t.enderecoLink} valor={link.endereco} aoMudar={(v) => setLink({ ...link, endereco: v })} descricao={t.exemploLink} autoFocus semDitado />
            <Campo rotulo={t.nomeLink} valor={link.nome} aoMudar={(v) => setLink({ ...link, nome: v })} maximo={120} semDitado />
            <Aviso>{erro}</Aviso>
            <div className="janela-acoes">
              <Button className="botao" onPress={() => setLink(null)}>{textos.comum.cancelar}</Button>
              <Button className="botao principal" type="submit" isDisabled={!link.endereco.trim() || ocupado}>{t.anexarLink}</Button>
            </div>
          </Form>
        )}
      </Janela>

      <Janela titulo={vendo?.nome ?? ""} aberta={vendo !== null} aoFechar={() => setVendo(null)} larga>
        {vendo && (
          <div className="formulario">
            <ImagemAnexo id={vendo.id} nome={vendo.nome} className="anexo-grande" />
            <div className="janela-acoes">
              <Button className="botao com-icone" onPress={() => salvarCopia(vendo)}>
                <Download aria-hidden="true" size="1em" /> {t.salvarCopia}
              </Button>
              <Button className="botao principal" onPress={() => setVendo(null)}>{textos.atalhos.fechar}</Button>
            </div>
          </div>
        )}
      </Janela>

      <Confirmar
        titulo={t.excluirTitulo}
        texto={excluindo ? t.excluirTexto(excluindo.nome) : ""}
        confirmar={t.excluir}
        aberta={excluindo !== null}
        aoCancelar={() => setExcluindo(null)}
        aoConfirmar={() => {
          const a = excluindo;
          setExcluindo(null);
          if (a) fazer(() => api.excluirAnexo(a.id));
        }}
      />
    </div>
  );
}

/** Os três juntos, para a página de projeto e a janela de tarefa. */
export function Relacoes({ id, etiquetas }: { id: string; etiquetas: string[] }) {
  return (
    <div className="relacoes">
      <EtiquetasDoItem id={id} marcadas={etiquetas} />
      <LigacoesDoItem id={id} />
      <AnexosDoItem id={id} />
    </div>
  );
}
