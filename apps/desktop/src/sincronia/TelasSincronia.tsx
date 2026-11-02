// Telas da etapa 2d (ver docs/decisoes/0012-sincronizacao.md e a especificação,
// "Entrar com Google e sincronizar"): ligar no primeiro aparelho, entrar num aparelho
// novo (senha, ou PIN + 6 perguntas), PIN igual em todos os aparelhos e juntar os dados.
// Desde 03/11/2026 (decisão de Dan) a senha de sincronização é opcional: o padrão é "só o
// Google"; a "proteção extra" (senha + recuperação por PIN e 6 perguntas) é uma caixinha.
// Um passo por vez, sem tempo limite, sem animação (princípios 2 e 7).
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button, Checkbox, Dialog, Form, Heading, Label, Modal, ModalOverlay, Radio, RadioGroup } from "react-aria-components";
import { avaliarPin, avaliarSenha } from "../acesso/validacao";
import { api, comoErro, escolherOndeSalvarBackup, type Confirmacao, type ModoAbrir, type ModoChaveSincronia } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { useConfirmarIdentidade } from "../componentes/ConfirmarIdentidade";
import { Check, Cloud, Lock, RefreshCw, Smartphone } from "../icones";
import { textos } from "../textos/pt-BR";
import { DriveOcupado } from "./driveRest";
import { AcessoNegado, SemInternet } from "./armazenamento";
import {
  avaliarPerguntas,
  conferirPin,
  entrarPelaConta,
  entrarPorRecuperacao,
  guardarPin,
  guardarRecuperacao,
  ligarProtecao,
  olharPasta,
  perguntasDaPasta,
  QUANTAS_PERGUNTAS,
  trocarSenha,
} from "./fluxo";
import { entrarComSenha, JaExisteChave, ligarComoPrimeiro } from "./maestro";
import type { PerfilGoogle } from "./googleWeb";
import { useSincronia } from "./ProvedorSincronia";

const t = textos.sincronia;

/** Por onde o assistente começa. */
export type InicioAssistente = "ligar" | "perguntas" | "senhaNova" | "protecao";

type Passo =
  | "conta"
  | "olhando"
  | "protecao"
  | "senhaNova"
  | "pinPrimeiro"
  | "perguntas"
  | "pularPerguntas"
  | "senha"
  | "esqueci"
  | "senhaDepois"
  | "pinAparelho"
  | "juntar"
  | "trabalhando"
  | "pronto";

/** Mensagem simples de um erro, com os casos da sincronização em linguagem literal. */
export function mensagemDe(e: unknown): string {
  if (e instanceof SemInternet || e instanceof DriveOcupado) return e.message || "Sem internet agora.";
  if (e instanceof AcessoNegado) return e.message;
  if (e instanceof JaExisteChave) return t.jaExiste;
  const x = comoErro(e);
  if (x.codigo === "senha_errada") return t.senhaErrada;
  if (x.codigo === "respostas_erradas") return t.respostasErradas;
  if (x.codigo === "pin_errado") return t.pinErrado;
  return e instanceof Error ? e.message : x.message;
}

/** A pessoa fechou o "salvar como" da cópia de segurança: nada foi apagado. */
class CopiaCancelada extends Error {}

const vazias = () => Array<string>(QUANTAS_PERGUNTAS).fill("");

/** O "G" do Google, nas cores dele (exigido nos botões de entrar com Google). */
export function LogoGoogle({ tamanho = "1.2em" }: { tamanho?: string }) {
  return (
    <svg className="logo-google" width={tamanho} height={tamanho} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Cartão pequeno da conta: foto (ou inicial), nome e e-mail. */
export function CartaoConta({ conta }: { conta: PerfilGoogle }) {
  const inicial = (conta.nome || conta.email || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="sinc-conta">
      {conta.foto ? <img className="sinc-conta-foto" src={conta.foto} alt="" referrerPolicy="no-referrer" /> : <span className="sinc-conta-foto inicial" aria-hidden="true">{inicial}</span>}
      <span className="sinc-conta-texto">
        <span className="sinc-conta-nome">{conta.nome}</span>
        {conta.email && conta.email !== conta.nome && <span className="sinc-conta-email">{conta.email}</span>}
      </span>
    </div>
  );
}

/** Lista curta com marcas, para explicar sem parágrafo comprido. */
function Pontos({ itens }: { itens: readonly string[] }) {
  return (
    <ul className="sinc-pontos">
      {itens.map((i) => (
        <li key={i}>
          <Check aria-hidden="true" size="1em" strokeWidth={2} />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}

interface Etapa {
  id: string;
  texto: string;
  estado: "esperando" | "fazendo" | "feito" | "falhou";
}

/** Progresso calmo: uma lista com marcas, sem nada girando. */
function Progresso({ etapas }: { etapas: Etapa[] }) {
  return (
    <ol className="sinc-progresso">
      {etapas.map((e) => (
        <li key={e.id} className={`sinc-etapa ${e.estado}`}>
          <span className="sinc-etapa-marca" aria-hidden="true">{e.estado === "feito" ? <Check size="0.9em" strokeWidth={2.5} /> : null}</span>
          <span className="sinc-etapa-texto">{e.texto}</span>
          {e.estado === "feito" && <span className="visualmente-oculto">{`: ${t.feito}`}</span>}
          {e.estado === "fazendo" && <span className="sinc-etapa-agora">{t.agoraFazendo}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Cabeçalho de cada passo: ícone, passo X de Y, título (recebe o foco). */
function Topo({ icone, passo, titulo, tituloRef }: { icone: ReactNode; passo?: string; titulo: string; tituloRef: RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="sinc-topo">
      <span className="sinc-topo-icone" aria-hidden="true">{icone}</span>
      <div className="sinc-topo-texto">
        {passo && <p className="sinc-topo-passo">{passo}</p>}
        <Heading slot="title" ref={tituloRef} tabIndex={-1} className="sinc-topo-titulo">
          {titulo}
        </Heading>
      </div>
    </div>
  );
}

interface PropsAssistente {
  inicio: InicioAssistente;
  /** O PIN com que a primeira tela acabou de criar o cofre (fluxo com Google). */
  pinConhecido?: string;
  aoFechar: () => void;
}

export function AssistenteSincronia({ inicio, pinConhecido, aoFechar }: PropsAssistente) {
  const s = useSincronia();
  const arm = s.armazenamento;
  const [passo, setPasso] = useState<Passo>(inicio === "perguntas" ? "perguntas" : inicio === "senhaNova" || inicio === "protecao" ? "senhaNova" : "conta");
  const [caminho, setCaminho] = useState<"primeiro" | "novo" | null>(inicio === "ligar" ? null : "primeiro");
  const [cofre, setCofre] = useState<{ modo: ModoAbrir | null; temSenha: boolean }>({ modo: pinConhecido ? "pin" : null, temSenha: false });
  const [temRecuperacao, setTemRecuperacao] = useState(false);
  const [dadosLocais, setDadosLocais] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [pin, setPin] = useState(pinConhecido ?? "");
  const [pin2, setPin2] = useState(pinConhecido ?? "");
  const [perguntas, setPerguntas] = useState<string[]>(vazias);
  const [respostas, setRespostas] = useState<string[]>(vazias);
  const [comPerguntas, setComPerguntas] = useState(true);
  const [recPerguntas, setRecPerguntas] = useState<string[] | null>(null);
  const [recRespostas, setRecRespostas] = useState<string[]>(vazias);
  const [pelaRecuperacao, setPelaRecuperacao] = useState(false);
  /** Primeiro aparelho: a "proteção extra" (senha de sincronização). Desligada por padrão. */
  const [protecao, setProtecao] = useState(false);
  /** Aparelho novo: como a chave está guardada na pasta ("conta": entra sem senha). */
  const [modoPasta, setModoPasta] = useState<ModoChaveSincronia | null>(null);
  const [pelaConta, setPelaConta] = useState(false);
  const [senhaNova, setSenhaNova] = useState<string | null>(null);
  /** O PIN conferido com o dos outros aparelhos (ou null: ainda não há resumo na pasta). */
  const [pinNaPasta, setPinNaPasta] = useState<boolean | null>(null);
  const [juntar, setJuntar] = useState<"tudo" | "drive">("tudo");
  const [etapas, setEtapas] = useState<Etapa[]>([]);

  /** A chave foi guardada aqui nesta janela e o fluxo ainda não terminou (cancelar desfaz). */
  const entrouSemConcluir = useRef(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const corpoRef = useRef<HTMLDivElement>(null);

  // Nada sincroniza enquanto a pessoa decide (a chave pode chegar antes da escolha de juntar).
  useEffect(() => {
    s.pausar(true);
    return () => s.pausar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    api.situacao().then(
      (x) => setCofre({ modo: x.modo, temSenha: x.temSenha }),
      () => undefined,
    );
    api.sincroniaDadosLocais().then(setDadosLocais, () => undefined);
  }, []);

  // A cada passo, o foco vai para o primeiro campo (ou para o título), para teclado e leitor de tela.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const campo = corpoRef.current?.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled])");
      (campo ?? tituloRef.current)?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [passo]);

  const fechar = () => {
    if (entrouSemConcluir.current) {
      entrouSemConcluir.current = false;
      void api.sincroniaSair().catch(() => undefined);
    }
    aoFechar();
  };

  const ir = (p: Passo) => {
    setErro(null);
    setPasso(p);
  };

  async function fazer(acao: () => Promise<void>) {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setOcupado(false);
    }
  }

  // Com a conta já em mãos (primeira tela com Google), pula direto para conferir a pasta.
  const olhar = () =>
    fazer(async () => {
      if (!arm) throw new Error(t.indisponivel);
      setPasso("olhando");
      try {
        const o = await olharPasta(arm);
        setTemRecuperacao(o.temRecuperacao);
        if (!o.temChave) {
          setCaminho("primeiro");
          setPasso("protecao");
          return;
        }
        setCaminho("novo");
        setInfo(null);
        await entrarNaExistente();
      } catch (e) {
        setPasso("conta");
        throw e;
      }
    });
  /**
   * Já há chave na pasta: no modo conta, entra direto (sem senha) e segue para o PIN;
   * no modo senha, vai para "Digite a senha de sincronização".
   */
  async function entrarNaExistente() {
    if (!arm) throw new Error(t.indisponivel);
    const modo = await entrarPelaConta(arm, api);
    modoDaChaveAgora.current = modo;
    setModoPasta(modo);
    if (modo === "conta") {
      entrouSemConcluir.current = true;
      setPelaConta(true);
      setPelaRecuperacao(false);
      setPasso("pinAparelho");
    } else if (modo === "senha") {
      setPasso("senha");
    } else {
      // A chave sumiu da pasta enquanto isso: começa como primeiro aparelho.
      setCaminho("primeiro");
      setPasso("protecao");
    }
  }
  const modoDaChaveAgora = useRef<ModoChaveSincronia | null>(null);
  const pulouConta = useRef(false);
  useEffect(() => {
    if (inicio === "ligar" && pinConhecido && s.conta && arm && !pulouConta.current) {
      pulouConta.current = true;
      void olhar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arm, s.conta]);

  const entrarNaConta = () => {
    setErro(null);
    setOcupado(true);
    // Sem await antes: no iPad, a janela do Google só abre se nascer do toque.
    s.entrar()
      .then(() => olhar())
      .catch((e) => setErro(mensagemDe(e)))
      .finally(() => setOcupado(false));
  };

  // ── Numeração dos passos ──
  // O total se ajusta: sem a proteção extra, não há senha nem perguntas; no modo conta, o
  // aparelho novo não tem o passo da senha.
  const ordemPrimeiro: Passo[] = [
    "conta",
    "protecao",
    ...(protecao ? (["senhaNova"] as Passo[]) : []),
    ...(pinConhecido ? [] : (["pinPrimeiro"] as Passo[])),
    ...(protecao ? (["perguntas"] as Passo[]) : []),
  ];
  const ordemNovo: Passo[] = ["conta", ...(modoPasta === "conta" ? [] : (["senha"] as Passo[])), "pinAparelho", ...(dadosLocais > 0 ? (["juntar"] as Passo[]) : [])];
  const totalPrimeiro = ordemPrimeiro.length;
  const totalNovo = ordemNovo.length;
  const numero = (p: Passo): string | undefined => {
    if (inicio !== "ligar") return undefined;
    if (p === "conta") return t.passo(1, caminho === "novo" ? totalNovo : totalPrimeiro);
    if (caminho === "primeiro") {
      const i = ordemPrimeiro.indexOf(p === "pularPerguntas" ? "perguntas" : p);
      return i >= 0 ? t.passo(i + 1, totalPrimeiro) : undefined;
    }
    if (caminho === "novo") {
      const ordem = ordemNovo;
      const i = ordem.indexOf(p === "esqueci" || p === "senhaDepois" ? "senha" : p);
      return i >= 0 ? t.passo(i + 1, totalNovo) : undefined;
    }
    return undefined;
  };

  // ── Trabalho final ──
  const marcar = (id: string, estado: Etapa["estado"]) => setEtapas((l) => l.map((e) => (e.id === id ? { ...e, estado } : e)));
  /** Etapas já feitas nesta janela: "Tentar de novo" não repete (nem a chave, nem a cópia, nem esvaziar). */
  const feitas = useRef(new Set<string>());
  const comEstado = (lista: Etapa[]) => lista.map((e) => (feitas.current.has(e.id) ? { ...e, estado: "feito" as const } : e));
  async function etapa(id: string, f: () => Promise<void>) {
    if (feitas.current.has(id)) return;
    marcar(id, "fazendo");
    try {
      await f();
      feitas.current.add(id);
      marcar(id, "feito");
    } catch (e) {
      marcar(id, "falhou");
      throw e;
    }
  }

  async function ligarPrimeiro(com: boolean = comPerguntas) {
    if (!arm) return;
    com = com && protecao; // sem a proteção extra não há perguntas (elas abrem o envelope da senha)
    setComPerguntas(com);
    const lista: Etapa[] = [
      { id: "chave", texto: protecao ? t.etapaChave : t.etapaChaveConta, estado: "esperando" },
      { id: "pin", texto: t.etapaPin, estado: "esperando" },
      ...(com ? [{ id: "perguntas", texto: t.etapaPerguntas, estado: "esperando" as const }] : []),
      { id: "primeira", texto: t.etapaPrimeira, estado: "esperando" },
    ];
    setEtapas(comEstado(lista));
    setPasso("trabalhando");
    setErro(null);
    try {
      await etapa("chave", () => ligarComoPrimeiro(arm, api, protecao ? senha : null));
      await etapa("pin", () => guardarPin(arm, api, pin));
      if (com) await etapa("perguntas", () => guardarRecuperacao(arm, api, pin, perguntas, respostas));
      await etapa("primeira", async () => {
        s.pausar(false);
        await s.sincronizarAgora();
      });
      setPasso("pronto");
    } catch (e) {
      if (e instanceof JaExisteChave) {
        // Proteção: outro aparelho criou a chave antes. Nunca trocar: este entra com a senha de lá.
        setCaminho("novo");
        setTemRecuperacao((await olharPasta(arm).catch(() => null))?.temRecuperacao ?? false);
        setSenha("");
        setSenha2("");
        try {
          await entrarNaExistente();
        } catch (x) {
          setPasso("conta");
          setErro(mensagemDe(x));
          return;
        }
        setInfo(modoDaChaveAgora.current === "conta" ? t.jaExisteConta : t.jaExiste);
        return;
      }
      setErro(t.falhou(mensagemDe(e)));
    }
  }

  /** Entra de novo (depois de esvaziar), do mesmo jeito que entrou antes. */
  async function entrarDeNovo() {
    if (!arm) return;
    if (pelaConta) {
      if ((await entrarPelaConta(arm, api)) !== "conta") throw new Error(t.senhaTexto);
    } else if (pelaRecuperacao) await entrarPorRecuperacao(arm, api, pin, recRespostas);
    else await entrarComSenha(arm, api, senha);
  }

  async function ligarNovo() {
    if (!arm) return;
    const drive = dadosLocais > 0 && juntar === "drive";
    const lista: Etapa[] = [
      ...(drive
        ? [
            { id: "copia", texto: t.etapaCopia, estado: "esperando" as const },
            { id: "esvaziar", texto: t.etapaEsvaziar, estado: "esperando" as const },
          ]
        : []),
      ...(pinNaPasta === null ? [{ id: "pin", texto: t.etapaPin, estado: "esperando" as const }] : []),
      ...(senhaNova ? [{ id: "senha", texto: t.etapaSenhaNova, estado: "esperando" as const }] : []),
      { id: "primeira", texto: t.etapaPrimeira, estado: "esperando" },
    ];
    setEtapas(comEstado(lista));
    setPasso("trabalhando");
    setErro(null);
    try {
      if (drive) {
        try {
          await etapa("copia", async () => {
            const caminhoCopia = await escolherOndeSalvarBackup();
            if (!caminhoCopia) throw new CopiaCancelada();
            await api.fazerBackup(caminhoCopia);
          });
        } catch (e) {
          if (!(e instanceof CopiaCancelada)) throw e;
          setInfo(t.copiaCancelada);
          setPasso("juntar");
          return;
        }
        await etapa("esvaziar", async () => {
          // O motor só esvazia sem a chave: sai, esvazia e entra de novo do mesmo jeito.
          await api.sincroniaSair();
          await api.sincroniaEsvaziar();
          await entrarDeNovo();
        });
      }
      if (pinNaPasta === null) await etapa("pin", () => guardarPin(arm, api, pin));
      if (senhaNova) await etapa("senha", () => trocarSenha(arm, api, senhaNova));
      await etapa("primeira", async () => {
        s.pausar(false);
        await s.sincronizarAgora();
      });
      entrouSemConcluir.current = false;
      setPasso("pronto");
    } catch (e) {
      setErro(t.falhou(mensagemDe(e)));
    }
  }

  // ── Cada passo ──
  let corpo: ReactNode;
  const botaoCancelar = (
    <Button className="botao" onPress={fechar}>
      {t.cancelar}
    </Button>
  );

  if (passo === "conta") {
    const indisponivel = s.disponibilidade !== "sim" || !arm;
    corpo = (
      <>
        <Topo icone={<Cloud size="1.4em" strokeWidth={1.75} />} passo={numero("conta")} titulo={indisponivel ? t.nomeAssunto : t.contaTitulo} tituloRef={tituloRef} />
        {indisponivel ? (
          <>
            <p>{s.disponibilidade === "sem-credencial" ? t.semCredencial : t.indisponivel}</p>
            <div className="janela-acoes">
              <Button className="botao principal" onPress={fechar}>{t.fechar}</Button>
            </div>
          </>
        ) : (
          <>
            <p>{t.contaTexto}</p>
            {s.conta ? (
              <>
                <p className="sinc-rotulo-pequeno">{t.contaEntrou}</p>
                <CartaoConta conta={s.conta} />
              </>
            ) : (
              s.plataforma === "windows" && <p className="texto-suave pequeno">{t.contaWindows}</p>
            )}
            {ocupado && !s.conta && (
              <p role="status" className="texto-suave pequeno">
                {s.plataforma === "windows" ? t.janelaWindows : t.janelaGoogle}
              </p>
            )}
            <Aviso>{erro}</Aviso>
            <div className="janela-acoes">
              {botaoCancelar}
              {s.conta ? (
                <Button className="botao principal" isDisabled={ocupado} onPress={() => void olhar()}>
                  {t.contaContinuar}
                </Button>
              ) : (
                <Button className="botao botao-google" isDisabled={ocupado} onPress={entrarNaConta}>
                  <LogoGoogle /> {ocupado ? t.entrando : t.entrarComGoogle}
                </Button>
              )}
            </div>
          </>
        )}
      </>
    );
  } else if (passo === "olhando") {
    corpo = (
      <>
        <Topo icone={<Cloud size="1.4em" strokeWidth={1.75} />} passo={numero("conta")} titulo={t.contaTitulo} tituloRef={tituloRef} />
        {s.conta && <CartaoConta conta={s.conta} />}
        <p role="status">{t.olhando}</p>
      </>
    );
  } else if (passo === "protecao") {
    corpo = (
      <Form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          if (ocupado) return;
          if (protecao) ir("senhaNova");
          else if (pinConhecido) void ligarPrimeiro(false);
          else ir("pinPrimeiro");
        }}
      >
        <Topo icone={<Lock size="1.4em" strokeWidth={1.75} />} passo={numero("protecao")} titulo={t.protecaoTitulo} tituloRef={tituloRef} />
        <p>{t.protecaoTexto}</p>
        <div className="sinc-protecao">
          <Checkbox className="caixa" isSelected={protecao} onChange={setProtecao} aria-describedby="sinc-protecao-troca">
            <span className="caixa-quadrado" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
            </span>
            <span className="sinc-protecao-rotulo">{t.protecaoCaixa}</span>
          </Checkbox>
          <ul id="sinc-protecao-troca" className="sinc-protecao-troca">
            <li>{t.protecaoSem}</li>
            <li>{t.protecaoCom}</li>
          </ul>
        </div>
        <p className="texto-suave pequeno">{t.protecaoDepois}</p>
        <Aviso>{erro}</Aviso>
        <div className="janela-acoes">
          {botaoCancelar}
          <Button className="botao principal" type="submit" isDisabled={ocupado}>
            {ocupado ? textos.comum.aguarde : t.continuar}
          </Button>
        </div>
      </Form>
    );
  } else if (passo === "senhaNova") {
    const av = avaliarSenha(senha, senha2);
    const soTrocar = inicio === "senhaNova";
    const ligandoProtecao = inicio === "protecao";
    corpo = (
      <Form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          if (!av.ok || ocupado) return;
          if (soTrocar) {
            void fazer(async () => {
              if (!arm) throw new Error(t.indisponivel);
              await trocarSenha(arm, api, senha);
              setInfo(t.senhaTrocada);
              setPasso("pronto");
            });
          } else if (ligandoProtecao) {
            // Liga a proteção já (mesma chave) e oferece as perguntas em seguida.
            void fazer(async () => {
              if (!arm) throw new Error(t.indisponivel);
              await ligarProtecao(arm, api, senha);
              setPasso("perguntas");
            });
          } else ir(pinConhecido ? "perguntas" : "pinPrimeiro");
        }}
      >
        <Topo
          icone={<Lock size="1.4em" strokeWidth={1.75} />}
          passo={numero("senhaNova")}
          titulo={soTrocar ? t.senhaNovaAjustesTitulo : ligandoProtecao ? t.ligarProtecaoTitulo : t.senhaNovaTitulo}
          tituloRef={tituloRef}
        />
        {soTrocar ? <p>{t.senhaNovaAjustesTexto}</p> : ligandoProtecao ? <p>{t.ligarProtecaoTexto}</p> : <Pontos itens={t.senhaNovaExplica} />}
        <Campo rotulo={t.senhaRotulo} valor={senha} aoMudar={setSenha} secreto autoComplete="new-password" descricao={av.dica ?? t.senhaDica} />
        <Campo rotulo={t.senhaConfirmar} valor={senha2} aoMudar={setSenha2} secreto autoComplete="new-password" />
        <Aviso>{av.erro ?? erro}</Aviso>
        <div className="janela-acoes">
          {inicio === "ligar" && <Button className="botao separado" onPress={() => ir("protecao")}>{t.voltar}</Button>}
          {botaoCancelar}
          <Button className="botao principal" type="submit" isDisabled={!av.ok || ocupado}>
            {ocupado ? textos.comum.aguarde : soTrocar ? t.criarSenha : ligandoProtecao ? t.ligarProtecaoBotao : t.continuar}
          </Button>
        </div>
      </Form>
    );
  } else if (passo === "pinPrimeiro") {
    const jaUsaPin = cofre.modo === "pin";
    const avPin = avaliarPin(pin, jaUsaPin ? pin : pin2);
    const comoAbre = cofre.modo ? textos.modos[cofre.modo].nome : "";
    corpo = (
      <Form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          if (!avPin.ok || ocupado) return;
          // Sem a proteção extra, o PIN é o último passo: liga em seguida.
          const seguir = () => (protecao ? ir("perguntas") : void ligarPrimeiro(false));
          if (!jaUsaPin) return seguir();
          // Confere com o PIN deste aparelho (sem mudar nada).
          void fazer(async () => {
            await api.verPalavras({ tipo: "pin", valor: pin });
            seguir();
          });
        }}
      >
        <Topo icone={<Smartphone size="1.4em" strokeWidth={1.75} />} passo={numero("pinPrimeiro")} titulo={jaUsaPin ? t.pinConfirmarTitulo : t.pinEscolherTitulo} tituloRef={tituloRef} />
        <p>{jaUsaPin ? t.pinConfirmarTexto : t.pinEscolherTexto(comoAbre)}</p>
        {protecao && <p className="texto-suave pequeno">{t.pinParaQue}</p>}
        <Campo rotulo={textos.pin.rotulo} valor={pin} aoMudar={setPin} secreto numerico maximo={8} descricao={textos.pin.dica} />
        {!jaUsaPin && <Campo rotulo={textos.pin.confirmar} valor={pin2} aoMudar={setPin2} secreto numerico maximo={8} />}
        <Aviso>{avPin.erro ?? erro}</Aviso>
        <div className="janela-acoes">
          <Button className="botao separado" onPress={() => ir(protecao ? "senhaNova" : "protecao")}>{t.voltar}</Button>
          {botaoCancelar}
          <Button className="botao principal" type="submit" isDisabled={!avPin.ok || ocupado}>
            {ocupado ? t.conferindo : protecao ? t.continuar : t.ligarAgora}
          </Button>
        </div>
      </Form>
    );
  } else if (passo === "perguntas") {
    const av = avaliarPerguntas(perguntas, respostas);
    // Ajustes: "Fazer as perguntas" ou logo depois de "Ligar a proteção extra".
    const soPerguntas = inicio === "perguntas" || inicio === "protecao";
    const pinOk = /^\d{4,8}$/.test(pin);
    const pronto = av.ok && (!soPerguntas || pinOk);
    const aviso = soPerguntas && pin && !pinOk ? textos.pin.soNumeros : av.repetidas ? t.perguntasRepetidas : null;
    corpo = (
      <Form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          if (!pronto || ocupado) return;
          if (!soPerguntas) {
            void ligarPrimeiro(true);
            return;
          }
          void fazer(async () => {
            if (!arm) throw new Error(t.indisponivel);
            const igual = await conferirPin(arm, api, pin);
            if (igual === false) throw new Error(t.pinDiferente);
            if (igual === null) await guardarPin(arm, api, pin);
            await guardarRecuperacao(arm, api, pin, perguntas, respostas);
            setComPerguntas(true);
            setInfo(t.perguntasGuardadas);
            setPasso("pronto");
          });
        }}
      >
        <Topo icone={<Lock size="1.4em" strokeWidth={1.75} />} passo={numero("perguntas")} titulo={t.perguntasTitulo} tituloRef={tituloRef} />
        <p>{t.perguntasTexto}</p>
        <div className="aviso aviso-info sinc-franqueza">
          <p>{t.perguntasLimite}</p>
          <p className="texto-suave pequeno">{t.perguntasNaoGuarda}</p>
        </div>
        {soPerguntas && <Campo rotulo={t.pinParaPerguntas} valor={pin} aoMudar={setPin} secreto numerico maximo={8} descricao={t.pinParaPerguntasAjuda} />}
        <ol className="sinc-perguntas">
          {perguntas.map((p, i) => (
            <li key={i} className="sinc-par">
              <span className="sinc-par-numero" aria-hidden="true">{i + 1}</span>
              <div className="sinc-par-campos">
                <Campo
                  rotulo={t.perguntaRotulo(i + 1)}
                  valor={p}
                  aoMudar={(v) => setPerguntas((l) => l.map((x, j) => (j === i ? v : x)))}
                  maximo={200}
                  semDitado
                  descricao={(t.perguntaExemplo as readonly string[])[i]}
                />
                <Campo rotulo={t.respostaRotulo(i + 1)} valor={respostas[i]} aoMudar={(v) => setRespostas((l) => l.map((x, j) => (j === i ? v : x)))} secreto semDitado maximo={200} autoComplete="off" />
              </div>
            </li>
          ))}
        </ol>
        {!av.ok && av.faltam > 0 && <p className="texto-suave pequeno">{t.faltamPares(av.faltam)}</p>}
        <Aviso>{aviso ?? erro}</Aviso>
        <div className="janela-acoes">
          {!soPerguntas && (
            <Button className="botao separado" onPress={() => ir(pinConhecido ? "senhaNova" : "pinPrimeiro")}>
              {t.voltar}
            </Button>
          )}
          {inicio === "protecao" ? (
            <Button
              className="botao"
              onPress={() => {
                setComPerguntas(false);
                ir("pronto");
              }}
            >
              {t.fazerDepois}
            </Button>
          ) : soPerguntas ? (
            botaoCancelar
          ) : (
            <Button className="botao" onPress={() => ir("pularPerguntas")}>{t.fazerDepois}</Button>
          )}
          <Button className="botao principal" type="submit" isDisabled={!pronto || ocupado}>
            {ocupado ? textos.comum.aguarde : soPerguntas ? t.guardarPerguntas : t.guardarELigar}
          </Button>
        </div>
      </Form>
    );
  } else if (passo === "pularPerguntas") {
    corpo = (
      <>
        <Topo icone={<Lock size="1.4em" strokeWidth={1.75} />} passo={numero("pularPerguntas")} titulo={t.pularTitulo} tituloRef={tituloRef} />
        <p>{t.pularTexto}</p>
        <p className="texto-suave">{t.pularOnde}</p>
        <div className="janela-acoes">
          <Button className="botao" onPress={() => ir("perguntas")}>{t.voltarPerguntas}</Button>
          <Button
            className="botao principal"
            onPress={() => void ligarPrimeiro(false)}
          >
            {t.ligarSemPerguntas}
          </Button>
        </div>
      </>
    );
  } else if (passo === "senha") {
    corpo = (
      <Form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          if (!senha || ocupado) return;
          void fazer(async () => {
            if (!arm) throw new Error(t.indisponivel);
            const ok = await entrarComSenha(arm, api, senha);
            if (!ok) throw new Error(t.esqueciSemPerguntas);
            entrouSemConcluir.current = true;
            setPelaRecuperacao(false);
            setInfo(null);
            setPasso("pinAparelho");
          });
        }}
      >
        <Topo icone={<Lock size="1.4em" strokeWidth={1.75} />} passo={numero("senha")} titulo={t.senhaTitulo} tituloRef={tituloRef} />
        {info ? <Aviso tipo="info">{info}</Aviso> : <p>{t.senhaTexto}</p>}
        {s.conta && <CartaoConta conta={s.conta} />}
        <Campo rotulo={t.senhaRotulo} valor={senha} aoMudar={setSenha} secreto autoComplete="current-password" />
        <div className="links">
          <Button className="link" onPress={() => void abrirEsqueci()}>{t.esqueci}</Button>
        </div>
        <Aviso>{erro}</Aviso>
        <div className="janela-acoes">
          {botaoCancelar}
          <Button className="botao principal" type="submit" isDisabled={!senha || ocupado}>{ocupado ? t.conferindo : t.continuar}</Button>
        </div>
      </Form>
    );
  } else if (passo === "esqueci") {
    const completas = recPerguntas !== null && /^\d{4,8}$/.test(pin) && recRespostas.every((r) => r.trim() !== "");
    corpo = (
      <Form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          if (!completas || ocupado) return;
          void fazer(async () => {
            if (!arm) throw new Error(t.indisponivel);
            await entrarPorRecuperacao(arm, api, pin, recRespostas);
            entrouSemConcluir.current = true;
            setPelaRecuperacao(true);
            setPin2(pin);
            setSenha("");
            setSenha2("");
            setPasso("senhaDepois");
          });
        }}
      >
        <Topo icone={<Lock size="1.4em" strokeWidth={1.75} />} passo={numero("esqueci")} titulo={t.esqueciTitulo} tituloRef={tituloRef} />
        {!temRecuperacao || recPerguntas === null ? (
          <>
            <p>{temRecuperacao ? t.conferindo : t.esqueciSemPerguntas}</p>
            <Aviso>{erro}</Aviso>
            <div className="janela-acoes">
              <Button className="botao principal" onPress={() => ir("senha")}>{t.voltar}</Button>
            </div>
          </>
        ) : (
          <>
            <p>{t.esqueciTexto}</p>
            <div className="aviso aviso-info sinc-franqueza">
              <p>{t.perguntasLimite}</p>
            </div>
            <Campo rotulo={t.pinParaPerguntas} valor={pin} aoMudar={setPin} secreto numerico maximo={8} descricao={textos.pin.dica} />
            <ol className="sinc-perguntas">
              {recPerguntas.map((p, i) => (
                <li key={i} className="sinc-par">
                  <span className="sinc-par-numero" aria-hidden="true">{i + 1}</span>
                  <div className="sinc-par-campos">
                    <Campo rotulo={p} valor={recRespostas[i]} aoMudar={(v) => setRecRespostas((l) => l.map((x, j) => (j === i ? v : x)))} secreto semDitado maximo={200} autoComplete="off" />
                  </div>
                </li>
              ))}
            </ol>
            <Aviso>{erro}</Aviso>
            <div className="janela-acoes">
              <Button className="botao separado" onPress={() => ir("senha")}>{t.voltar}</Button>
              {botaoCancelar}
              <Button className="botao principal" type="submit" isDisabled={!completas || ocupado}>{ocupado ? t.conferindo : t.entrarComRespostas}</Button>
            </div>
          </>
        )}
      </Form>
    );
  } else if (passo === "senhaDepois") {
    const av = avaliarSenha(senha, senha2);
    corpo = (
      <Form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          if (!av.ok) return;
          setSenhaNova(senha);
          ir("pinAparelho");
        }}
      >
        <Topo icone={<Lock size="1.4em" strokeWidth={1.75} />} passo={numero("senhaDepois")} titulo={t.senhaDepoisTitulo} tituloRef={tituloRef} />
        <p>{t.senhaDepoisTexto}</p>
        <Campo rotulo={t.senhaRotulo} valor={senha} aoMudar={setSenha} secreto autoComplete="new-password" descricao={av.dica ?? t.senhaDica} />
        <Campo rotulo={t.senhaConfirmar} valor={senha2} aoMudar={setSenha2} secreto autoComplete="new-password" />
        <Aviso>{av.erro}</Aviso>
        <div className="janela-acoes">
          <Button
            className="botao"
            onPress={() => {
              setSenhaNova(null);
              ir("pinAparelho");
            }}
          >
            {t.agoraNao}
          </Button>
          <Button className="botao principal" type="submit" isDisabled={!av.ok}>{t.criarSenha}</Button>
        </div>
      </Form>
    );
  } else if (passo === "pinAparelho") {
    corpo = (
      <PassoPinAparelho
        topo={<Topo icone={<Smartphone size="1.4em" strokeWidth={1.75} />} passo={numero("pinAparelho")} titulo={t.pinAparelhoTitulo} tituloRef={tituloRef} />}
        cofre={cofre}
        pinConhecido={pinConhecido}
        pinDaRecuperacao={pelaRecuperacao ? pin : null}
        aviso={pelaConta ? info : null}
        aoCancelar={fechar}
        conferir={async (p) => (arm ? conferirPin(arm, api, p) : null)}
        aoConcluir={(p, naPasta) => {
          setPin(p);
          setPinNaPasta(naPasta);
          setCofre((c) => ({ ...c, modo: "pin" }));
          if (dadosLocais > 0) ir("juntar");
          else void ligarNovoDepois();
        }}
      />
    );
  } else if (passo === "juntar") {
    corpo = (
      <Form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          setInfo(null);
          void ligarNovo();
        }}
      >
        <Topo icone={<RefreshCw size="1.4em" strokeWidth={1.75} />} passo={numero("juntar")} titulo={t.juntarTitulo} tituloRef={tituloRef} />
        <p>{t.juntarTexto(dadosLocais)}</p>
        <RadioGroup className="campo" value={juntar} onChange={(v) => setJuntar(v as "tudo" | "drive")}>
          <Label className="visualmente-oculto">{t.juntarTitulo}</Label>
          <div className="opcoes-cartao">
            <Radio value="tudo" className="opcao-cartao">
              <span className="opcao-cartao-marca" aria-hidden="true" />
              <span className="opcao-cartao-texto">
                <span className="opcao-cartao-nome">
                  {t.juntarTudo} <span className="selo">{t.recomendado}</span>
                </span>
                <span className="opcao-cartao-descricao">{t.juntarTudoTexto}</span>
              </span>
            </Radio>
            <Radio value="drive" className="opcao-cartao">
              <span className="opcao-cartao-marca" aria-hidden="true" />
              <span className="opcao-cartao-texto">
                <span className="opcao-cartao-nome">{t.soDrive}</span>
                <span className="opcao-cartao-descricao">{t.soDriveTexto}</span>
              </span>
            </Radio>
          </div>
        </RadioGroup>
        <Aviso tipo="info">{info}</Aviso>
        <div className="janela-acoes">
          {botaoCancelar}
          <Button className="botao principal" type="submit">{t.continuar}</Button>
        </div>
      </Form>
    );
  } else if (passo === "trabalhando") {
    corpo = (
      <>
        <Topo icone={<RefreshCw size="1.4em" strokeWidth={1.75} />} titulo={t.trabalhandoTitulo} tituloRef={tituloRef} />
        <p className="texto-suave">{t.trabalhandoTexto}</p>
        <Progresso etapas={etapas} />
        <p role="status" className="visualmente-oculto">
          {etapas.find((e) => e.estado === "fazendo")?.texto ?? ""}
        </p>
        {erro && (
          <>
            <Aviso>{erro}</Aviso>
            <div className="janela-acoes">
              {botaoCancelar}
              <Button className="botao principal" onPress={() => void (caminho === "novo" ? ligarNovo() : ligarPrimeiro())}>
                {t.tentarDeNovo}
              </Button>
            </div>
          </>
        )}
      </>
    );
  } else {
    // pronto
    const soAjuste = inicio !== "ligar";
    const tituloAjuste = inicio === "protecao" ? t.protecaoLigadaAviso : (info ?? t.prontoTitulo);
    corpo = (
      <>
        <Topo icone={<Check size="1.4em" strokeWidth={2} />} titulo={soAjuste ? tituloAjuste : t.prontoTitulo} tituloRef={tituloRef} />
        {inicio === "protecao" && <p>{comPerguntas ? t.perguntasGuardadas : t.prontoSemPerguntas}</p>}
        {!soAjuste && (
          <>
            {etapas.length > 0 && <Progresso etapas={etapas} />}
            <p>{caminho === "novo" ? t.prontoNovo : protecao ? t.prontoPrimeiro : t.prontoPrimeiroConta}</p>
            <p className="texto-suave">{t.prontoAviso}</p>
            {caminho === "primeiro" && protecao && !comPerguntas && <p className="texto-suave pequeno">{t.prontoSemPerguntas}</p>}
          </>
        )}
        <div className="janela-acoes">
          <Button className="botao principal" onPress={aoFechar}>{t.fechar}</Button>
        </div>
      </>
    );
  }

  async function abrirEsqueci() {
    setErro(null);
    setRecRespostas(vazias());
    setPin(pinConhecido ?? "");
    setPasso("esqueci");
    if (!arm || !temRecuperacao) return;
    try {
      setRecPerguntas(await perguntasDaPasta(arm, api));
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }

  // Sem dados aqui, não há o que perguntar: segue direto para o trabalho final.
  function ligarNovoDepois() {
    setJuntar("tudo");
    return ligarNovo();
  }

  return (
    <ModalOverlay className="sobreposicao" isOpen isDismissable={false} isKeyboardDismissDisabled={passo === "trabalhando"} onOpenChange={(v) => !v && fechar()}>
      <Modal className="janela sinc-janela">
        <Dialog className="janela-dialogo sinc-dialogo-assistente">
          <div ref={corpoRef} className="sinc-assistente">
            {corpo}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/**
 * Aparelho novo: o PIN deste aparelho passa a ser o mesmo dos outros. Usa o "mudar modo"
 * de sempre (a criptografia do cofre não muda), confirmando que é a pessoa do jeito que
 * ela já abre o Órbita aqui.
 */
function PassoPinAparelho({
  topo,
  cofre,
  pinConhecido,
  pinDaRecuperacao,
  aviso,
  aoCancelar,
  conferir,
  aoConcluir,
}: {
  topo: ReactNode;
  /** Recado calmo no alto (ex.: outro aparelho ligou antes e este entrou na mesma sincronização). */
  aviso?: string | null;
  cofre: { modo: ModoAbrir | null; temSenha: boolean };
  pinConhecido?: string;
  pinDaRecuperacao: string | null;
  aoCancelar: () => void;
  conferir: (pin: string) => Promise<boolean | null>;
  aoConcluir: (pin: string, naPasta: boolean | null) => void;
}) {
  const sabido = pinDaRecuperacao ?? null;
  const [pin, setPin] = useState(sabido ?? pinConhecido ?? "");
  const [pin2, setPin2] = useState(sabido ?? pinConhecido ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [diferente, setDiferente] = useState(false);
  const identidade = useConfirmarIdentidade(cofre.modo, cofre.temSenha);
  // Cofre criado agora pela primeira tela: o PIN de lá confirma que é a pessoa.
  const confirmacao: Confirmacao | null = pinConhecido ? { tipo: "pin", valor: pinConhecido } : identidade.confirmacao;
  const avPin = avaliarPin(pin, pin2);
  const pronto = avPin.ok && confirmacao !== null;

  const concluir = async (p: string) => {
    const naPasta = await conferir(p);
    if (naPasta === false) {
      setDiferente(true);
      throw new Error(t.pinDiferente);
    }
    const jaEhEsse = confirmacao?.tipo === "pin" && confirmacao.valor === p && cofre.modo === "pin";
    if (!jaEhEsse && confirmacao) await api.mudarModo(confirmacao, "pin", p);
    aoConcluir(p, naPasta);
  };

  // Primeira tela com Google: se o PIN de lá já é o mesmo dos outros aparelhos, nem mostra este passo.
  const tentou = useRef(false);
  useEffect(() => {
    if (!pinConhecido || tentou.current) return;
    tentou.current = true;
    setOcupado(true);
    concluir(pinConhecido)
      .catch((e) => {
        setPin("");
        setPin2("");
        setErro(e instanceof Error && e.message === t.pinDiferente ? null : mensagemDe(e));
      })
      .finally(() => setOcupado(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pinConhecido && ocupado && !diferente) {
    return (
      <>
        {topo}
        {aviso && <Aviso tipo="info">{aviso}</Aviso>}
        <p role="status">{t.conferindo}</p>
      </>
    );
  }

  return (
    <Form
      className="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pronto || ocupado) return;
        setOcupado(true);
        setErro(null);
        concluir(pin)
          .catch((x) => setErro(mensagemDe(x)))
          .finally(() => setOcupado(false));
      }}
    >
      {topo}
      {aviso && <Aviso tipo="info">{aviso}</Aviso>}
      <p>{diferente && pinConhecido ? t.pinAparelhoDiferente : sabido ? t.pinAparelhoConhecido : t.pinAparelhoTexto}</p>
      {!sabido && (
        <>
          <Campo rotulo={t.pinParaPerguntas} valor={pin} aoMudar={setPin} secreto numerico maximo={8} descricao={textos.pin.dica} />
          <Campo rotulo={t.pinDeNovo} valor={pin2} aoMudar={setPin2} secreto numerico maximo={8} />
        </>
      )}
      {!pinConhecido && (
        <div className="sinc-confirmar">
          <p className="campo-rotulo">{t.confirmeQueEVoce}</p>
          {identidade.campos}
        </div>
      )}
      <Aviso>{avPin.erro ?? erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoCancelar}>{t.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!pronto || ocupado}>{ocupado ? t.conferindo : t.continuar}</Button>
      </div>
    </Form>
  );
}
