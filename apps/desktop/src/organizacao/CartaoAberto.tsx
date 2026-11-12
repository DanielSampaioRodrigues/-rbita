// O cartão aberto (como no Trello): título, descrição com formatação, checklists,
// etiquetas, data de entrega, anexos, capa e ações. Tudo é guardado sozinho,
// pouco depois de cada mudança (e na hora ao fechar).
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Dialog, Form, Modal, ModalOverlay } from "react-aria-components";
import { api, escolherArquivoParaAnexar, type Anexo, type CartaoOrg, type Checklist, type Coluna, type EtiquetaOrg, type Quadro } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { CampoRico } from "../componentes/CampoRico";
import { Interruptor } from "../componentes/Interruptor";
import { Confirmar, Janela } from "../componentes/Janela";
import { Archive, CalendarDays, Copy, ImagePlus, ListChecks, MoveHorizontal, Palette, Plus, RotateCcw, Tag, Trash2, X } from "../icones";
import { AnexosDoItem } from "../relacoes/Relacoes";
import { textos } from "../textos/pt-BR";
import { CORES_ORG, PALETA_ORG } from "./cores";
import { CapaCartao, ChipEtiqueta, EscolherCor, SeloPrazo, useImagemAnexo } from "./partes";
import { lerVinculos, sincronizarCartao } from "./agenda";
import { completarCartao } from "./regras";

const t = textos.organizacao;
const tc = t.cartao;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));
const novoId = () => crypto.randomUUID();

export interface AcoesCartao {
  quadro: Quadro;
  colunas: Coluna[];
  etiquetas: EtiquetaOrg[];
  agora: Date;
  /** Guardou: o quadro recarrega. */
  aoGuardar: (c: CartaoOrg) => Promise<CartaoOrg>;
  aoRecarregar: () => void;
  aoCriarEtiqueta: (nome: string, cor: string) => Promise<EtiquetaOrg | null>;
  aoMover: (c: CartaoOrg, quadroId: string, colunaId: string) => Promise<void>;
  aoCopiar: (c: CartaoOrg, quadroId: string, colunaId: string, titulo: string) => Promise<void>;
  aoApagar: (c: CartaoOrg) => Promise<void>;
}

export function CartaoAberto({ inicial, acoes, aoFechar }: { inicial: CartaoOrg | null; acoes: AcoesCartao; aoFechar: () => void }) {
  return (
    <ModalOverlay className="sobreposicao" isOpen={inicial !== null} onOpenChange={(v) => !v && aoFechar()} isDismissable>
      <Modal className="janela org-janela-cartao">{inicial && <Detalhe key={inicial.id} inicial={inicial} acoes={acoes} aoFechar={aoFechar} />}</Modal>
    </ModalOverlay>
  );
}

function Detalhe({ inicial, acoes, aoFechar }: { inicial: CartaoOrg; acoes: AcoesCartao; aoFechar: () => void }) {
  const recado = useRecado();
  const idTitulo = useId();
  const [c, setC] = useState(() => completarCartao(inicial));
  const atual = useRef(c);
  const [situacao, setSituacao] = useState<"" | "guardando" | "guardado">("");
  const [erro, setErro] = useState<string | null>(null);
  const relogio = useRef<number | null>(null);
  const [mostrarData, setMostrarData] = useState(!!inicial.prazo);
  const [naAgenda, setNaAgenda] = useState(false);
  useEffect(() => { void lerVinculos().then((v) => setNaAgenda(inicial.id in v)); }, [inicial.id]);
  const mudarAgenda = async (ligar: boolean) => {
    setNaAgenda(ligar);
    if (!(await guardarAgora())) return;
    try {
      await sincronizarCartao(atual.current, acoes.quadro.nome, ligar);
      recado(ligar ? tc.pusNaAgenda : tc.tireiDaAgenda);
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  const [painel, setPainel] = useState<"" | "etiquetas" | "capa" | "cor" | "mover" | "copiar" | "apagar">("");
  const [imagens, setImagens] = useState<Anexo[]>([]);
  const [versaoAnexos, setVersaoAnexos] = useState(0);
  const focoChecklist = useRef<string | null>(null);

  // As ações mudam a cada desenho do quadro; a gravação usa sempre as atuais.
  const acoesRef = useRef(acoes);
  acoesRef.current = acoes;
  const guardarAgora = useCallback(async () => {
    if (relogio.current) (window.clearTimeout(relogio.current), (relogio.current = null));
    const v = atual.current;
    if (!v.texto.trim()) {
      setErro(tc.vazio);
      return false;
    }
    setErro(null);
    setSituacao("guardando");
    try {
      await acoesRef.current.aoGuardar(v);
      setSituacao("guardado");
      return true;
    } catch (e) {
      setErro(mensagem(e));
      setSituacao("");
      return false;
    }
  }, []);

  /** Muda o cartão e agenda a gravação (texto: espera um pouco; o resto: quase na hora). */
  const mudar = (parcial: Partial<CartaoOrg>, espera = 150) => {
    const novo = { ...atual.current, ...parcial };
    atual.current = novo;
    setC(novo);
    setSituacao("guardando");
    if (relogio.current) window.clearTimeout(relogio.current);
    relogio.current = window.setTimeout(() => void guardarAgora(), espera);
  };

  const fechar = async () => {
    if (relogio.current) await guardarAgora();
    aoFechar();
  };
  // Se a janela fechar por fora (clique fora, Esc), grava o que faltava.
  useEffect(() => () => {
    if (relogio.current) void guardarAgora();
  }, [guardarAgora]);

  const coluna = acoes.colunas.find((x) => x.id === c.colunaId);
  const aplicadas = acoes.etiquetas.filter((e) => c.etiquetas.includes(e.id));

  // ── Checklists ──
  const mudarChecklists = (f: (cls: Checklist[]) => Checklist[], espera?: number) => mudar({ checklists: f(atual.current.checklists ?? []) }, espera);
  const novaChecklist = () => {
    const id = novoId();
    focoChecklist.current = id;
    mudarChecklists((cls) => [...cls, { id, nome: cls.length ? `${tc.checklistPadrao} ${cls.length + 1}` : tc.checklistPadrao, itens: [] }]);
  };

  const arquivar = async (arquivado: boolean) => {
    mudar({ arquivado }, 0);
    if (await guardarAgora()) {
      if (arquivado) {
        recado(tc.arquivou(atual.current.texto));
        aoFechar();
      }
    }
  };

  const anexarImagemCapa = async () => {
    setErro(null);
    try {
      const caminho = await escolherArquivoParaAnexar(true);
      if (!caminho) return;
      const a = await api.anexarArquivo(c.id, caminho);
      if (a.tipo !== "imagem") {
        await api.excluirAnexo(a.id).catch(() => {});
        throw new Error(t.fundo.naoImagem);
      }
      setVersaoAnexos((v) => v + 1);
      mudar({ capa: { tipo: "imagem", valor: a.id }, anexos: (atual.current.anexos ?? 0) + 1 }, 0);
    } catch (e) {
      setErro(mensagem(e));
    }
  };

  return (
    <Dialog className="janela-dialogo org-detalhe" aria-labelledby={idTitulo}>
      <CapaCartao capa={c.capa} grande />
      <div className="org-det-topo">
        <input
          type="checkbox"
          className="org-det-feito"
          checked={c.feito}
          onChange={(e) => mudar({ feito: e.target.checked }, 0)}
          aria-label={`${tc.feito}: ${c.texto}`}
        />
        <div className="org-det-titulo-caixa">
          <h2 id={idTitulo} className="visualmente-oculto">{c.texto || tc.texto}</h2>
          <textarea
            className={"org-det-titulo" + (c.feito ? " feito" : "")}
            value={c.texto}
            rows={1}
            maxLength={300}
            aria-label={tc.texto}
            onChange={(e) => mudar({ texto: e.target.value.replace(/\n/g, " ") }, 600)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void guardarAgora();
              }
            }}
          />
          <p className="org-det-onde">
            {tc.naColuna(coluna?.nome || t.coluna.semNome)}
            <span className="org-det-situacao" aria-live="polite">{situacao === "guardando" ? tc.guardando : situacao === "guardado" ? tc.guardado : ""}</span>
          </p>
        </div>
        <Button className="botao-icone org-det-fechar" onPress={() => void fechar()} aria-label={tc.fechar}><X aria-hidden="true" size="1.2em" /></Button>
      </div>

      {c.arquivado && <p className="org-det-arquivado"><Archive aria-hidden="true" size="1em" /> {tc.arquivadoAviso}</p>}
      <Aviso>{erro}</Aviso>

      <div className="org-det-grade">
        <div className="org-det-principal">
          {(aplicadas.length > 0 || (c.prazo && !mostrarData)) && (
            <div className="org-det-resumo">
              {aplicadas.length > 0 && (
                <div className="org-det-bloco">
                  <h3 className="org-det-subtitulo">{tc.etiquetas}</h3>
                  <div className="org-etiquetas">
                    {aplicadas.map((e) => <ChipEtiqueta key={e.id} etiqueta={e} />)}
                    <Button className="botao-icone org-icone org-etiqueta-mais" onPress={() => setPainel("etiquetas")} aria-label={tc.etiquetas}><Plus aria-hidden="true" size="1em" /></Button>
                  </div>
                </div>
              )}
              {c.prazo && !mostrarData && (
                <div className="org-det-bloco">
                  <h3 className="org-det-subtitulo">{tc.prazo}</h3>
                  <SeloPrazo cartao={c} agora={acoes.agora} />
                </div>
              )}
            </div>
          )}

          {mostrarData && (
            <section className="org-det-secao org-det-data">
              <h3 className="org-det-subtitulo"><CalendarDays aria-hidden="true" size="1em" /> {tc.prazo}</h3>
              <div className="org-det-linha">
                <CampoData rotulo={tc.data} tipo="date" valor={c.prazo} aoMudar={(v) => mudar({ prazo: v, hora: v ? atual.current.hora : "" }, 400)} />
                <CampoData rotulo={tc.hora} tipo="time" valor={c.hora} aoMudar={(v) => mudar({ hora: v }, 400)} />
              </div>
              {c.prazo && (
                <div className="org-det-agenda">
                  <Interruptor rotulo={tc.naAgenda} ligado={naAgenda} aoMudar={(v) => void mudarAgenda(v)} />
                  <p className="texto-suave pequeno">{tc.naAgendaAjuda}</p>
                </div>
              )}
              {c.prazo && (
                <Button className="botao pequeno com-icone" onPress={() => (mudar({ prazo: "", hora: "" }, 0), setMostrarData(false))}>
                  <Trash2 aria-hidden="true" size="1em" /> {tc.semPrazo}
                </Button>
              )}
            </section>
          )}

          <section className="org-det-secao">
            <CampoRico rotulo={tc.descricao} valor={c.descricao} aoMudar={(md) => mudar({ descricao: md }, 800)} placeholder={tc.descricaoDica} />
          </section>

          {c.checklists.map((cl) => (
            <ChecklistEditor
              key={cl.id}
              checklist={cl}
              focar={focoChecklist.current === cl.id}
              aoMudar={(novo, espera) => mudarChecklists((cls) => cls.map((x) => (x.id === cl.id ? novo : x)), espera)}
              aoApagar={() => mudarChecklists((cls) => cls.filter((x) => x.id !== cl.id), 0)}
            />
          ))}

          <section className="org-det-secao">
            <AnexosDoItem
              key={versaoAnexos}
              id={c.id}
              aoMudar={(lista) => {
                setImagens(lista.filter((a) => a.tipo === "imagem"));
                const capaFoi = atual.current.capa?.tipo === "imagem" && !lista.some((a) => a.id === atual.current.capa?.valor);
                if (capaFoi) mudar({ capa: { tipo: "", valor: "" }, anexos: lista.length }, 0);
                else if (lista.length !== (atual.current.anexos ?? 0)) {
                  // Só a contagem mudou (ela é calculada pelo banco): o quadro recarrega, nada é regravado.
                  atual.current = { ...atual.current, anexos: lista.length };
                  setC(atual.current);
                  acoes.aoRecarregar();
                }
              }}
            />
          </section>
        </div>

        <aside className="org-det-lado" aria-label={tc.adicionarAoCartao}>
          <h3 className="org-det-subtitulo">{tc.adicionarAoCartao}</h3>
          <Button className="botao org-det-acao" onPress={() => setPainel("etiquetas")}><Tag aria-hidden="true" size="1em" /> {tc.etiquetas}</Button>
          <Button className="botao org-det-acao" onPress={novaChecklist}><ListChecks aria-hidden="true" size="1em" /> {tc.checklist}</Button>
          <Button className="botao org-det-acao" onPress={() => setMostrarData(true)} aria-pressed={mostrarData}><CalendarDays aria-hidden="true" size="1em" /> {tc.data}</Button>
          <Button className="botao org-det-acao" onPress={() => setPainel("capa")}><ImagePlus aria-hidden="true" size="1em" /> {tc.capa}</Button>
          <Button className="botao org-det-acao" onPress={() => setPainel("cor")}><Palette aria-hidden="true" size="1em" /> {tc.corCurta}</Button>
          <h3 className="org-det-subtitulo">{tc.acoes}</h3>
          <Button className="botao org-det-acao" onPress={() => setPainel("mover")}><MoveHorizontal aria-hidden="true" size="1em" /> {tc.moverPara}</Button>
          <Button className="botao org-det-acao" onPress={() => setPainel("copiar")}><Copy aria-hidden="true" size="1em" /> {tc.copiar}</Button>
          {c.arquivado ? (
            <Button className="botao org-det-acao" onPress={() => void arquivar(false)}><RotateCcw aria-hidden="true" size="1em" /> {tc.desarquivar}</Button>
          ) : (
            <Button className="botao org-det-acao" onPress={() => void arquivar(true)}><Archive aria-hidden="true" size="1em" /> {tc.arquivar}</Button>
          )}
          <Button className="botao org-det-acao org-det-perigo" onPress={() => setPainel("apagar")}><Trash2 aria-hidden="true" size="1em" /> {tc.excluir}</Button>
        </aside>
      </div>

      <Janela titulo={tc.etiquetas} aberta={painel === "etiquetas"} aoFechar={() => setPainel("")} pequena>
        <EscolherEtiquetas
          todas={acoes.etiquetas}
          marcadas={c.etiquetas}
          aoMudar={(ids) => mudar({ etiquetas: ids }, 0)}
          aoCriar={async (nome, cor) => {
            const e = await acoes.aoCriarEtiqueta(nome, cor);
            if (e) mudar({ etiquetas: [...atual.current.etiquetas!, e.id] }, 0);
          }}
          aoFechar={() => setPainel("")}
        />
      </Janela>

      <Janela titulo={tc.capaTitulo} aberta={painel === "capa"} aoFechar={() => setPainel("")}>
        <EscolherCapa
          capa={c.capa}
          imagens={imagens}
          aoMudar={(capa) => mudar({ capa }, 0)}
          aoAnexar={() => void anexarImagemCapa()}
          aoFechar={() => setPainel("")}
        />
      </Janela>

      <Janela titulo={tc.cor} aberta={painel === "cor"} aoFechar={() => setPainel("")} pequena>
        <div className="formulario">
          <EscolherCor rotulo={tc.cor} valor={c.cor} aoMudar={(cor) => mudar({ cor }, 0)} />
          <div className="janela-acoes"><Button className="botao principal" onPress={() => setPainel("")}>{t.coluna.pronto}</Button></div>
        </div>
      </Janela>

      <Janela titulo={painel === "copiar" ? t.mover.tituloCopia : t.mover.titulo} aberta={painel === "mover" || painel === "copiar"} aoFechar={() => setPainel("")} pequena>
        {(painel === "mover" || painel === "copiar") && (
          <MoverCartao
            copia={painel === "copiar"}
            cartao={c}
            quadro={acoes.quadro}
            colunasDaqui={acoes.colunas}
            aoCancelar={() => setPainel("")}
            aoConfirmar={async (quadroId, colunaId, titulo) => {
              await guardarAgora();
              if (painel === "copiar") {
                await acoes.aoCopiar(atual.current, quadroId, colunaId, titulo);
                setPainel("");
              } else {
                await acoes.aoMover(atual.current, quadroId, colunaId);
                setPainel("");
                if (quadroId !== acoes.quadro.id) aoFechar();
                else {
                  const novo = { ...atual.current, colunaId };
                  atual.current = novo;
                  setC(novo);
                }
              }
            }}
          />
        )}
      </Janela>

      <Confirmar
        titulo={tc.excluir}
        texto={tc.apagarConfirmar(c.texto)}
        confirmar={tc.excluir}
        aberta={painel === "apagar"}
        aoCancelar={() => setPainel("")}
        aoConfirmar={async () => {
          if (relogio.current) (window.clearTimeout(relogio.current), (relogio.current = null));
          setPainel("");
          await acoes.aoApagar(atual.current);
          aoFechar();
        }}
      />
    </Dialog>
  );
}

function ChecklistEditor({ checklist, focar, aoMudar, aoApagar }: { checklist: Checklist; focar: boolean; aoMudar: (c: Checklist, espera?: number) => void; aoApagar: () => void }) {
  const [novo, setNovo] = useState("");
  const feitos = checklist.itens.filter((i) => i.feito).length;
  const total = checklist.itens.length;
  const nome = checklist.nome || tc.checklistPadrao;
  const adicionar = (e: React.FormEvent) => {
    e.preventDefault();
    const v = novo.trim();
    if (!v) return;
    setNovo("");
    aoMudar({ ...checklist, itens: [...checklist.itens, { id: novoId(), texto: v, feito: false }] }, 0);
  };
  return (
    <section className="org-det-secao org-checklist" aria-label={nome}>
      <div className="org-checklist-topo">
        <ListChecks aria-hidden="true" size="1.1em" />
        <input className="org-checklist-nome" value={checklist.nome} onChange={(e) => aoMudar({ ...checklist, nome: e.target.value }, 600)} aria-label={tc.nomeChecklist} maxLength={80} />
        <Button className="botao-icone org-icone" onPress={aoApagar} aria-label={tc.apagarChecklist(nome)}><Trash2 aria-hidden="true" size="1em" /></Button>
      </div>
      {total > 0 && (
        <div className="org-progresso">
          <span className="org-progresso-texto">{tc.progresso(feitos, total)}</span>
          <span className="org-progresso-barra" aria-hidden="true"><span style={{ width: `${Math.round((feitos / total) * 100)}%` }} /></span>
        </div>
      )}
      <ul className="org-checklist-itens">
        {checklist.itens.map((i) => (
          <li key={i.id} className={"org-checklist-item" + (i.feito ? " feito" : "")}>
            <input type="checkbox" checked={i.feito} onChange={(e) => aoMudar({ ...checklist, itens: checklist.itens.map((x) => (x.id === i.id ? { ...x, feito: e.target.checked } : x)) }, 0)} aria-label={i.texto} />
            <input
              className="org-checklist-texto"
              value={i.texto}
              onChange={(e) => aoMudar({ ...checklist, itens: checklist.itens.map((x) => (x.id === i.id ? { ...x, texto: e.target.value } : x)) }, 600)}
              aria-label={`${tc.checklist}: ${i.texto}`}
              maxLength={300}
            />
            <Button className="botao-icone org-icone" onPress={() => aoMudar({ ...checklist, itens: checklist.itens.filter((x) => x.id !== i.id) }, 0)} aria-label={tc.apagarItem(i.texto)}><X aria-hidden="true" size="1em" /></Button>
          </li>
        ))}
      </ul>
      <Form className="org-novo-cartao" onSubmit={adicionar}>
        <Plus aria-hidden="true" size="1em" className="org-novo-icone" />
        <input className="entrada-texto" value={novo} onChange={(e) => setNovo(e.target.value)} placeholder={tc.itemNovo} aria-label={tc.adicionarItem(nome)} autoFocus={focar} />
      </Form>
    </section>
  );
}

function EscolherEtiquetas({ todas, marcadas, aoMudar, aoCriar, aoFechar }: { todas: EtiquetaOrg[]; marcadas: string[]; aoMudar: (ids: string[]) => void; aoCriar: (nome: string, cor: string) => Promise<void>; aoFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<string>(CORES_ORG[0]);
  const [criando, setCriando] = useState(todas.length === 0);
  const alternar = (id: string) => aoMudar(marcadas.includes(id) ? marcadas.filter((x) => x !== id) : [...marcadas, id]);
  return (
    <div className="formulario">
      {todas.length === 0 ? (
        <p className="texto-suave">{t.etiquetas.vazio}</p>
      ) : (
        <ul className="org-escolher-etiquetas">
          {todas.map((e) => {
            const ligada = marcadas.includes(e.id);
            return (
              <li key={e.id}>
                <Button className={"org-etiqueta-opcao" + (ligada ? " ligada" : "")} onPress={() => alternar(e.id)} aria-pressed={ligada}>
                  <span className="org-etiqueta-marca" aria-hidden="true">{ligada ? "✓" : ""}</span>
                  <ChipEtiqueta etiqueta={e} />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {criando ? (
        <Form
          className="formulario org-nova-etiqueta"
          onSubmit={async (ev) => {
            ev.preventDefault();
            await aoCriar(nome, cor);
            setNome("");
            setCriando(false);
          }}
        >
          <label className="campo">
            <span className="campo-rotulo">{t.etiquetas.nome}</span>
            <input className="entrada-texto sozinha" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} autoFocus />
          </label>
          <EscolherCor rotulo={t.etiquetas.cor} valor={cor} aoMudar={setCor} ajuda="" semVazio />
          <div className="janela-acoes">
            <Button className="botao principal" type="submit">{t.etiquetas.criar}</Button>
          </div>
        </Form>
      ) : (
        <Button className="botao com-icone" onPress={() => setCriando(true)}><Plus aria-hidden="true" size="1em" /> {t.etiquetas.nova}</Button>
      )}
      <div className="janela-acoes"><Button className="botao principal" onPress={aoFechar}>{t.etiquetas.pronto}</Button></div>
    </div>
  );
}

function MiniaturaAnexo({ id }: { id: string }) {
  const url = useImagemAnexo(id);
  return url ? <img src={url} alt="" /> : <span className="imagem-carregando" />;
}

function EscolherCapa({ capa, imagens, aoMudar, aoAnexar, aoFechar }: { capa: CartaoOrg["capa"]; imagens: Anexo[]; aoMudar: (c: NonNullable<CartaoOrg["capa"]>) => void; aoAnexar: () => void; aoFechar: () => void }) {
  return (
    <div className="formulario">
      <fieldset className="hobby-grupo">
        <legend>{tc.capaCor}</legend>
        <div className="hobby-amostras">
          {CORES_ORG.map((cor) => (
            <Button key={cor} className="hobby-amostra-botao" aria-pressed={capa?.tipo === "cor" && capa.valor === cor} onPress={() => aoMudar({ tipo: "cor", valor: cor })}>
              <span className="hobby-amostra" style={{ background: PALETA_ORG[cor].claro }} aria-hidden="true" />
              <span className="hobby-amostra-nome">{t.cores[cor]}</span>
            </Button>
          ))}
        </div>
      </fieldset>
      <fieldset className="hobby-grupo">
        <legend>{tc.capaImagem}</legend>
        <p className="texto-suave pequeno">{tc.capaImagemAjuda}</p>
        {imagens.length === 0 ? (
          <p className="texto-suave pequeno">{tc.semImagens}</p>
        ) : (
          <div className="org-capas-imagens">
            {imagens.map((a) => (
              <Button key={a.id} className="org-capa-opcao" aria-pressed={capa?.tipo === "imagem" && capa.valor === a.id} onPress={() => aoMudar({ tipo: "imagem", valor: a.id })} aria-label={tc.capaDe(a.nome)}>
                <MiniaturaAnexo id={a.id} />
              </Button>
            ))}
          </div>
        )}
        <Button className="botao com-icone" onPress={aoAnexar}><ImagePlus aria-hidden="true" size="1em" /> {tc.anexarImagemCapa}</Button>
      </fieldset>
      <div className="janela-acoes">
        {capa?.tipo && <Button className="botao com-icone" onPress={() => aoMudar({ tipo: "", valor: "" })}><Trash2 aria-hidden="true" size="1em" /> {tc.tirarCapa}</Button>}
        <Button className="botao principal" onPress={aoFechar}>{t.coluna.pronto}</Button>
      </div>
    </div>
  );
}

function MoverCartao({ copia, cartao, quadro, colunasDaqui, aoCancelar, aoConfirmar }: {
  copia: boolean;
  cartao: CartaoOrg;
  quadro: Quadro;
  colunasDaqui: Coluna[];
  aoCancelar: () => void;
  aoConfirmar: (quadroId: string, colunaId: string, titulo: string) => Promise<void>;
}) {
  const [quadros, setQuadros] = useState<Quadro[]>([quadro]);
  const [quadroId, setQuadroId] = useState(quadro.id);
  const [colunas, setColunas] = useState<Coluna[]>(colunasDaqui.filter((c) => !c.arquivada));
  const [colunaId, setColunaId] = useState(cartao.colunaId);
  const [titulo, setTitulo] = useState(cartao.texto);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const idQ = useId();
  const idC = useId();
  const idT = useId();

  useEffect(() => {
    api.listarQuadros().then(setQuadros, () => {});
  }, []);
  useEffect(() => {
    if (quadroId === quadro.id) {
      const cs = colunasDaqui.filter((c) => !c.arquivada);
      setColunas(cs);
      setColunaId((atual) => (cs.some((c) => c.id === atual) ? atual : cs[0]?.id ?? ""));
      return;
    }
    let vivo = true;
    api.listarColunas(quadroId).then((cs) => {
      if (!vivo) return;
      const vis = cs.filter((c) => !c.arquivada);
      setColunas(vis);
      setColunaId(vis[0]?.id ?? "");
    }, (e) => setErro(mensagem(e)));
    return () => void (vivo = false);
  }, [quadroId, quadro.id, colunasDaqui]);

  return (
    <Form
      className="formulario"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!colunaId) return;
        setOcupado(true);
        try {
          await aoConfirmar(quadroId, colunaId, titulo);
        } catch (err) {
          setErro(mensagem(err));
        } finally {
          setOcupado(false);
        }
      }}
    >
      {copia && (
        <div className="campo">
          <label className="campo-rotulo" htmlFor={idT}>{t.mover.nomeCopia}</label>
          <input id={idT} className="entrada-texto sozinha" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={300} />
        </div>
      )}
      <div className="campo">
        <label className="campo-rotulo" htmlFor={idQ}>{t.mover.quadro}</label>
        <select id={idQ} className="entrada-texto sozinha" value={quadroId} onChange={(e) => setQuadroId(e.target.value)}>
          {quadros.map((q) => <option key={q.id} value={q.id}>{q.nome}{q.id === quadro.id ? ` ${t.mover.atual}` : ""}</option>)}
        </select>
      </div>
      <div className="campo">
        <label className="campo-rotulo" htmlFor={idC}>{t.mover.coluna}</label>
        <select id={idC} className="entrada-texto sozinha" value={colunaId} onChange={(e) => setColunaId(e.target.value)}>
          {colunas.map((c) => <option key={c.id} value={c.id}>{c.nome || t.coluna.semNome}</option>)}
        </select>
      </div>
      {copia && <p className="campo-ajuda">{t.mover.copiaAviso}</p>}
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoCancelar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!colunaId || ocupado || (copia && !titulo.trim())}>{copia ? t.mover.copiar : t.mover.mover}</Button>
      </div>
    </Form>
  );
}
