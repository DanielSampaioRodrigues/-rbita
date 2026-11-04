import { Plus, Sparkles, X } from "../icones";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button, Checkbox, TextArea, TextField, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { api, ErroOrbita, type FalaPlano, type ProvedorVisivel, type Projeto, type Tarefa } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";
import { acrescentar, apagarLinha, comoLinhas, contar, MAXIMO_DE_ETAPAS, MAXIMO_DE_SUBTAREFAS, MAXIMO_DO_TEXTO, mudarLinha, proposta, type LinhaPlano } from "./planoEstado";
import { marcarAvisado, precisaAvisar } from "./avisoSensivel";
import { pareceSensivel } from "./sensivel";

const t = textos.ia.plano;
type Forma = "lista" | "mapa";
const CHAVE_FORMA = "orbita.plano-forma";

function formaSalva(): Forma {
  try {
    return localStorage.getItem(CHAVE_FORMA) === "mapa" ? "mapa" : "lista";
  } catch {
    return "lista";
  }
}

const mensagem = (e: unknown) => (e instanceof ErroOrbita || e instanceof Error ? e.message : String(e));

/**
 * "Planejar com a IA": uma conversa sobre o projeto (ou uma etapa) que termina
 * numa proposta de etapas com subtarefas. A proposta aparece em Lista (editável)
 * ou Mapa. Nada é gravado até "Aprovar e criar"; depois dá para desfazer.
 */
export function JanelaPlanejar({
  alvo,
  projeto,
  tarefas,
  provedor,
  aoFechar,
}: {
  /** null = janela fechada. `projeto: false` = uma etapa (a proposta vira subtarefas dela). */
  alvo: { id: string; titulo: string; projeto: boolean } | null;
  projeto: Projeto;
  tarefas: Tarefa[];
  provedor: ProvedorVisivel;
  aoFechar: () => void;
}) {
  const etapa = alvo ? !alvo.projeto : false;
  const [falas, setFalas] = useState<FalaPlano[]>([]);
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<LinhaPlano[]>([]);
  const [forma, setForma] = useState<Forma>(formaSalva);
  const [pedindo, setPedindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** O último pedido à IA falhou: aparece "Tentar de novo". */
  const [podeTentar, setPodeTentar] = useState(false);
  const [aviso, setAviso] = useState<"sensivel" | "bloqueado" | null>(null);
  const [confirmouSensivel, setConfirmouSensivel] = useState(false);
  const [bloqueiaSensivel, setBloqueiaSensivel] = useState(true);
  const [anuncio, setAnuncio] = useState("");
  const [gravando, setGravando] = useState(false);
  /** Ids criados na última aprovação (etapas, ou subtarefas no caso de etapa), para desfazer. */
  const [criadas, setCriadas] = useState<{ ids: string[]; etapas: number; subtarefas: number; completo: boolean } | null>(null);
  const [desfeito, setDesfeito] = useState(false);
  const [focar, setFocar] = useState<string | null>(null);
  // Uma resposta que chega depois de cancelar (ou de fechar) é ignorada.
  const pedidoAtual = useRef(0);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pedidoAtual.current++;
    if (!alvo) return;
    setFalas([]);
    setTexto("");
    setLinhas([]);
    setPedindo(false);
    setErro(null);
    setPodeTentar(false);
    setAviso(null);
    setConfirmouSensivel(false);
    setAnuncio("");
    setCriadas(null);
    setDesfeito(false);
    api.estadoIa().then((e) => setBloqueiaSensivel(e.bloquearSensivel), () => setBloqueiaSensivel(true));
  }, [alvo]);

  // Foco depois de acrescentar ou apagar uma linha (sem ele, quem usa teclado se perde).
  useEffect(() => {
    if (!focar) return;
    const alvoFoco = caixa.current?.querySelector<HTMLElement>(`[data-foco="${focar}"]`);
    alvoFoco?.focus();
    setFocar(null);
  }, [focar, linhas]);

  // A conversa mostra sempre a fala mais recente.
  const listaFalas = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const l = listaFalas.current;
    if (l) l.scrollTop = l.scrollHeight;
  }, [falas]);

  const focarCampo = () => setTimeout(() => caixa.current?.querySelector<HTMLElement>(".plano-conversa textarea")?.focus(), 0);

  const trocarForma = (f: Forma) => {
    setForma(f);
    try {
      localStorage.setItem(CHAVE_FORMA, f);
    } catch {
      // Sem armazenamento: só não lembra da escolha.
    }
  };

  /** Tudo o que vai para a IA, para conferir se há sinais de saúde ou terapia. */
  const temSensivel = (conversa: FalaPlano[]) =>
    pareceSensivel(
      [projeto.titulo, projeto.anotacoes, projeto.ondeParei?.texto ?? "", projeto.ondeParei?.proximoPasso ?? "", ...tarefas.map((x) => x.titulo), ...conversa.map((f) => f.texto), ...proposta(linhas).flatMap((e) => [e.titulo, ...e.subtarefas])].join("\n"),
    );

  const pedir = async (conversa: FalaPlano[], sensivel: boolean) => {
    if (!alvo) return;
    const este = ++pedidoAtual.current;
    setErro(null);
    setPodeTentar(false);
    setAviso(null);
    setDesfeito(false);
    setPedindo(true);
    setAnuncio("");
    try {
      const atual = proposta(linhas);
      const plano = await api.planejarComIa(alvo.id, conversa, atual.length ? atual : null, sensivel);
      if (este !== pedidoAtual.current) return;
      const novas = comoLinhas(plano.etapas);
      const n = contar(novas);
      setLinhas(novas);
      setFalas([...conversa, { papel: "ia", texto: plano.explicacao ?? t.respostaPadrao(n.etapas, etapa) }]);
      setAnuncio(t.chegou(n.etapas, n.subtarefas, etapa));
      setCriadas(null);
    } catch (e) {
      if (este === pedidoAtual.current) (setErro(mensagem(e)), setPodeTentar(true));
    } finally {
      if (este === pedidoAtual.current) setPedindo(false);
    }
  };

  const enviar = async (confirmou = false) => {
    if (pedindo) return;
    const nova = texto.trim();
    if (!nova && linhas.length > 0) return;
    const conversa: FalaPlano[] = nova ? [...falas, { papel: "pessoa", texto: nova.slice(0, 2000) }] : falas;
    const sensivel = temSensivel(conversa);
    if (!confirmouSensivel && !confirmou && (await precisaAvisar(sensivel, provedor, bloqueiaSensivel))) {
      setAviso(bloqueiaSensivel ? "bloqueado" : "sensivel");
      return;
    }
    if (confirmou) { setConfirmouSensivel(true); void marcarAvisado(provedor.id); }
    setAviso(null);
    setFalas(conversa);
    setTexto("");
    focarCampo();
    void pedir(conversa, sensivel);
  };

  /** Repete o último pedido (a fala da pessoa já está na conversa). */
  const tentarDeNovo = () => {
    focarCampo();
    void pedir(falas, temSensivel(falas));
  };

  /** Cancela o pedido: a última fala da pessoa volta para a caixa de texto. */
  const cancelar = () => {
    pedidoAtual.current++;
    setPedindo(false);
    setPodeTentar(false);
    const ultima = falas[falas.length - 1];
    if (ultima?.papel === "pessoa") {
      setFalas(falas.slice(0, -1));
      setTexto(ultima.texto);
    }
    focarCampo();
  };

  const aoTeclar = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      enviar();
    }
  };

  const aprovar = async () => {
    if (!alvo) return;
    const p = proposta(linhas);
    const ids: string[] = [];
    let subtarefas = 0;
    setGravando(true);
    setErro(null);
    setPodeTentar(false);
    try {
      for (const e of p) {
        const criada = await api.criarTarefa(alvo.id, e.titulo);
        ids.push(criada.id);
        if (!etapa) for (const s of e.subtarefas) (await api.criarTarefa(criada.id, s), subtarefas++);
      }
      setCriadas({ ids, etapas: ids.length, subtarefas, completo: true });
    } catch (e) {
      setErro(mensagem(e));
      if (ids.length) setCriadas({ ids, etapas: ids.length, subtarefas, completo: false });
    } finally {
      setGravando(false);
      avisarMudanca();
    }
  };

  const desfazer = async () => {
    if (!criadas) return;
    setGravando(true);
    try {
      // Apagar uma etapa apaga as subtarefas dela junto.
      for (const id of criadas.ids) await api.excluirItem(id);
      setCriadas(null);
      setDesfeito(true);
      setErro(null);
      focarCampo();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setGravando(false);
      avisarMudanca();
    }
  };

  const fechar = () => {
    pedidoAtual.current++;
    aoFechar();
  };

  const n = contar(linhas);
  const nomeEtapa = (i: number) => (etapa ? t.passo(i + 1) : t.etapa(i + 1));

  return (
    <Janela titulo={alvo ? t.titulo(alvo.titulo) : ""} aberta={alvo !== null} aoFechar={fechar} larga>
      <div ref={caixa} className="plano-ia">
        <section className="plano-conversa" aria-labelledby="plano-conversa-titulo" onKeyDown={aoTeclar}>
          <h3 id="plano-conversa-titulo" className="janela-subtitulo">{t.conversa}</h3>
          <p className="texto-suave pequeno">{t.vaiPara(provedor.nome, provedor.local, etapa)}</p>
          {!provedor.local && <p className="texto-suave pequeno">{t.chave}</p>}
          {falas.length === 0 ? (
            <p className="texto-suave">{t.semMensagens(etapa)}</p>
          ) : (
            <ol ref={listaFalas} className="plano-falas" aria-label={t.conversa} tabIndex={0}>
              {falas.map((f, i) => (
                <li key={i} className={`plano-fala ${f.papel}`}>
                  <span className="plano-fala-quem">{f.papel === "ia" ? provedor.nome : t.voce}</span>
                  <span className="quebra">{f.texto}</span>
                </li>
              ))}
            </ol>
          )}
          {criadas === null || !criadas.completo ? (
            <>
              <Campo
                rotulo={linhas.length ? t.campoMais : t.campoPrimeiro(etapa)}
                valor={texto}
                aoMudar={(v) => (setTexto(v), setAviso(null))}
                descricao={t.campoAjuda}
                maximo={2000}
                multilinha
                autoFocus
              />
              <div className="botoes">
                <Button className="botao com-icone" onPress={() => enviar()} isDisabled={!texto.trim() && linhas.length > 0}>
                  <Sparkles aria-hidden="true" size="1em" /> {texto.trim() || linhas.length ? t.enviar : t.pedirProposta}
                </Button>
                {pedindo && <Button className="botao" onPress={cancelar}>{textos.comum.cancelar}</Button>}
              </div>
            </>
          ) : null}
          {pedindo && (
            <>
              <p role="status" className="texto-suave">{t.pensando(provedor.nome)}</p>
              {provedor.local && <p className="texto-suave pequeno">{textos.ia.pedindoLocal}</p>}
            </>
          )}
          {aviso && (
            <>
              <Aviso tipo="info">{aviso === "sensivel" ? t.sensivel(provedor.nome) : t.sensivelBloqueado}</Aviso>
              {aviso === "sensivel" && (
                <div className="botoes">
                  <Button className="botao" onPress={() => enviar(true)}>{t.enviarMesmoAssim}</Button>
                </div>
              )}
            </>
          )}
          {erro && !pedindo && (
            <>
              <Aviso>{erro}</Aviso>
              {podeTentar && (
                <div className="botoes">
                  <Button className="botao" onPress={tentarDeNovo}>{textos.ia.tentarDeNovo}</Button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="plano-proposta" aria-labelledby="plano-proposta-titulo">
          <div className="plano-proposta-topo">
            <h3 id="plano-proposta-titulo" className="janela-subtitulo">{t.proposta}</h3>
            {linhas.length > 0 && (
              <ToggleButtonGroup
                aria-label={t.formaDaProposta}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[forma]}
                onSelectionChange={(k) => trocarForma([...k][0] as Forma)}
                className="segmentado"
              >
                <ToggleButton id="lista" className="segmentado-opcao">{t.lista}</ToggleButton>
                <ToggleButton id="mapa" className="segmentado-opcao">{t.mapa}</ToggleButton>
              </ToggleButtonGroup>
            )}
          </div>
          <p className="visualmente-oculto" aria-live="polite">{anuncio}</p>
          {linhas.length === 0 ? (
            <p className="texto-suave plano-vazia">{t.vazia}</p>
          ) : forma === "mapa" ? (
            <MapaPlano titulo={alvo?.titulo ?? ""} linhas={linhas} />
          ) : (
            <ListaPlano linhas={linhas} etapa={etapa} aoMudar={setLinhas} aoFocar={setFocar} nomeEtapa={nomeEtapa} />
          )}
        </section>
      </div>

      {criadas && (
        <Aviso tipo="ok">
          {t.criado(criadas.etapas, criadas.subtarefas, etapa)} {!criadas.completo && t.criadoEmParte}
        </Aviso>
      )}
      {desfeito && <Aviso tipo="ok">{t.desfeito}</Aviso>}

      <div className="janela-acoes">
        {criadas ? (
          <>
            <Button className="botao" onPress={desfazer} isDisabled={gravando}>{t.desfazer}</Button>
            <Button className="botao principal" onPress={fechar} autoFocus>{t.fechar}</Button>
          </>
        ) : (
          <>
            <Button className="botao" onPress={fechar}>{t.descartar}</Button>
            <Button className="botao principal" isDisabled={gravando || pedindo || n.etapas === 0} onPress={aprovar}>
              {gravando ? t.criando : t.aprovar(n.etapas, n.subtarefas, etapa)}
            </Button>
          </>
        )}
      </div>
    </Janela>
  );
}

/** Cada item é uma linha só: Enter não quebra a linha (o texto longo quebra sozinho na tela). */
const semEnter = (e: KeyboardEvent) => {
  if (e.key === "Enter") e.preventDefault();
};

function Marcar({ incluir, aoMudar, rotulo }: { incluir: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <Checkbox className="caixa estreita" isSelected={incluir} onChange={aoMudar} aria-label={rotulo}>
      <span className="caixa-quadrado" aria-hidden="true">
        <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
      </span>
    </Checkbox>
  );
}

/** A proposta em lista: etapas com as subtarefas recuadas, tudo editável. */
function ListaPlano({
  linhas,
  etapa,
  aoMudar,
  aoFocar,
  nomeEtapa,
}: {
  linhas: LinhaPlano[];
  etapa: boolean;
  aoMudar: (l: LinhaPlano[]) => void;
  aoFocar: (chave: string) => void;
  nomeEtapa: (i: number) => string;
}) {
  const mais = (pai?: string) => {
    const [novas, chave] = acrescentar(linhas, pai);
    aoMudar(novas);
    if (chave) aoFocar(chave);
  };
  // Depois de apagar, o foco vai para a linha vizinha (ou para o botão de acrescentar).
  const apagar = (chave: string, vizinhas: string[], reserva: string) => {
    const i = vizinhas.indexOf(chave);
    const proxima = vizinhas[i + 1] ?? vizinhas[i - 1] ?? reserva;
    aoMudar(apagarLinha(linhas, chave));
    aoFocar(proxima);
  };
  const chavesEtapas = linhas.map((l) => l.chave);

  return (
    <>
      <p className="texto-suave pequeno">{t.ajudaLista}</p>
      <ol className="plano-lista">
        {linhas.map((l, i) => {
          const nome = nomeEtapa(i);
          const chavesFilhos = l.filhos.map((f) => f.chave);
          return (
            <li key={l.chave} className="plano-etapa">
              <div className={l.incluir ? "passo-ia" : "passo-ia desmarcada"}>
                <Marcar incluir={l.incluir} aoMudar={(incluir) => aoMudar(mudarLinha(linhas, l.chave, { incluir }))} rotulo={t.incluir(l.texto || nome)} />
                <TextField className="passo-ia-texto" value={l.texto} onChange={(texto) => aoMudar(mudarLinha(linhas, l.chave, { texto }))} aria-label={nome}>
                  <TextArea className={`entrada-texto sozinha plano-texto ${etapa ? "" : "plano-etapa-texto"} ${l.incluir ? "" : "desmarcado"}`} rows={1} maxLength={MAXIMO_DO_TEXTO} data-foco={l.chave} onKeyDown={semEnter} />
                </TextField>
                <Button className="botao-icone" onPress={() => apagar(l.chave, chavesEtapas, "mais-etapa")} aria-label={t.apagar(l.texto || nome)}>
                  <X aria-hidden="true" size="1.1em" />
                </Button>
              </div>
              {!etapa && (
                <ul className="plano-subs" aria-label={l.texto || nome}>
                  {l.filhos.map((f, j) => {
                    const nomeSub = t.subtarefa(j + 1, i + 1);
                    return (
                      <li key={f.chave} className={f.incluir && l.incluir ? "passo-ia" : "passo-ia desmarcada"}>
                        <Marcar incluir={f.incluir} aoMudar={(incluir) => aoMudar(mudarLinha(linhas, f.chave, { incluir }))} rotulo={t.incluir(f.texto || nomeSub)} />
                        <TextField className="passo-ia-texto" value={f.texto} onChange={(texto) => aoMudar(mudarLinha(linhas, f.chave, { texto }))} aria-label={nomeSub}>
                          <TextArea className={`entrada-texto sozinha plano-texto ${f.incluir && l.incluir ? "" : "desmarcado"}`} rows={1} maxLength={MAXIMO_DO_TEXTO} data-foco={f.chave} onKeyDown={semEnter} />
                        </TextField>
                        <Button className="botao-icone" onPress={() => apagar(f.chave, chavesFilhos, `mais-${l.chave}`)} aria-label={t.apagar(f.texto || nomeSub)}>
                          <X aria-hidden="true" size="1.1em" />
                        </Button>
                      </li>
                    );
                  })}
                  {l.filhos.length < MAXIMO_DE_SUBTAREFAS && (
                    <li>
                      <Button className="link plano-mais" onPress={() => mais(l.chave)} data-foco={`mais-${l.chave}`} aria-label={`${t.maisSubtarefa}: ${l.texto || nome}`}>
                        <Plus aria-hidden="true" size="0.95em" /> {t.maisSubtarefa}
                      </Button>
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      {linhas.length < MAXIMO_DE_ETAPAS && (
        <div className="botoes">
          <Button className="botao com-icone" onPress={() => mais()} data-foco="mais-etapa">
            <Plus aria-hidden="true" size="1em" /> {etapa ? t.maisPasso : t.maisEtapa}
          </Button>
        </div>
      )}
    </>
  );
}

/** A proposta em mapa: o projeto (ou a etapa) no começo, os ramos e as folhas. Só leitura. */
function MapaPlano({ titulo, linhas }: { titulo: string; linhas: LinhaPlano[] }) {
  const p = proposta(linhas);
  return (
    <>
      <p className="texto-suave pequeno">{t.ajudaMapa}</p>
      <div className="plano-mapa">
        <ul aria-label={t.mapa}>
          <li className="plano-ramo">
            <span className="plano-no nivel-0 quebra">{titulo}</span>
            {p.length > 0 && (
              <ul className="plano-filhos">
                {p.map((e, i) => (
                  <li key={i} className="plano-ramo">
                    <span className="plano-no nivel-1 quebra">{e.titulo}</span>
                    {e.subtarefas.length > 0 && (
                      <ul className="plano-folhas" aria-label={e.titulo}>
                        {e.subtarefas.map((s, j) => (
                          <li key={j} className="plano-folha quebra">{s}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        </ul>
      </div>
    </>
  );
}
