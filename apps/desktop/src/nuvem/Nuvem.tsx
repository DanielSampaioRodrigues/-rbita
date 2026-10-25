import { Cloud, CloudUpload, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Form, Label, Radio, RadioGroup } from "react-aria-components";
import { avaliarPin } from "../acesso/validacao";
import { api, type EncontradoNaNuvem, type ModoAbrir, type ProvedorNuvem, type SituacaoNuvem } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { EscolhaModo } from "../componentes/EscolhaModo";
import { Janela } from "../componentes/Janela";
import { textos } from "../textos/pt-BR";
import { useHelloDisponivel } from "../useHello";

const t = textos.nuvem;
const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" });
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Quais contas esta versão sabe usar. Vazio enquanto não houver cadastro no Google e na Microsoft. */
export function useContasDisponiveis(): ProvedorNuvem[] {
  const [lista, setLista] = useState<ProvedorNuvem[]>([]);
  useEffect(() => {
    api.nuvemDisponivel().then(
      (d) => setLista((["google", "microsoft"] as const).filter((p) => d[p])),
      () => setLista([]),
    );
  }, []);
  return lista;
}

type Escolha = ProvedorNuvem | "palavras";

/**
 * Primeira vez, depois de criar o cofre: guardar a recuperação na conta da pessoa
 * ou anotar as 6 palavras. `aoEscolherPalavras` mostra a tela das palavras de sempre.
 */
export function EscolherRecuperacao({
  contas,
  aoEscolherPalavras,
  aoConcluir,
}: {
  contas: ProvedorNuvem[];
  aoEscolherPalavras: () => void;
  aoConcluir: () => void;
}) {
  const [escolha, setEscolha] = useState<Escolha>(contas[0] ?? "palavras");
  const [entrando, setEntrando] = useState<ProvedorNuvem | null>(null);
  const [pronto, setPronto] = useState<SituacaoNuvem | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const continuar = async () => {
    if (escolha === "palavras") return aoEscolherPalavras();
    setErro(null);
    setEntrando(escolha);
    try {
      setPronto(await api.nuvemConectar(escolha));
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setEntrando(null);
    }
  };

  if (pronto) {
    return (
      <div className="formulario">
        <h1>{t.guardadoTitulo}</h1>
        <p>{t.guardadoTexto(`${pronto.conta} (${t.servicos[pronto.provedor]})`)}</p>
        <div className="botoes">
          <Button className="botao principal" autoFocus onPress={aoConcluir}>{textos.chave.pronto}</Button>
        </div>
        <div className="links">
          <Button className="link" onPress={aoEscolherPalavras}>{t.verPalavras}</Button>
        </div>
      </div>
    );
  }

  return (
    <Form className="formulario" onSubmit={(e) => (e.preventDefault(), !entrando && continuar())}>
      <h1>{t.recuperacaoTitulo}</h1>
      <p className="texto-suave">{t.recuperacaoTexto}</p>
      <RadioGroup className="campo" value={escolha} onChange={(v) => setEscolha(v as Escolha)}>
        <Label className="visualmente-oculto">{t.recuperacaoTitulo}</Label>
        <div className="opcoes-cartao">
          {[...contas, "palavras" as const].map((o) => (
            <Radio key={o} value={o} className="opcao-cartao">
              <span className="opcao-cartao-marca" aria-hidden="true" />
              <span className="opcao-cartao-texto">
                <span className="opcao-cartao-nome">{t.opcoes[o].nome}</span>
                <span className="opcao-cartao-descricao">{t.opcoes[o].descricao}</span>
              </span>
            </Radio>
          ))}
        </div>
        {escolha !== "palavras" && <p className="campo-ajuda">{t.limite}</p>}
      </RadioGroup>
      {entrando && <p role="status">{t.entrando(t.servicos[entrando])}</p>}
      <Aviso>{erro}</Aviso>
      <div className="botoes">
        <Button className="botao principal com-icone" type="submit" isDisabled={!!entrando}>
          {escolha !== "palavras" && <LogIn aria-hidden="true" size="1em" />}
          {entrando ? textos.comum.aguarde : escolha === "palavras" ? textos.comum.continuar : t.entrarCom(t.provedores[escolha])}
        </Button>
      </div>
    </Form>
  );
}

/** Computador novo: entrar na conta, conferir o que foi achado, escolher como abrir e trazer. */
export function RecuperarDaNuvem({ contas, aoVoltar, aoConcluir }: { contas: ProvedorNuvem[]; aoVoltar: () => void; aoConcluir: () => void }) {
  const [entrando, setEntrando] = useState<ProvedorNuvem | null>(null);
  const [achado, setAchado] = useState<EncontradoNaNuvem | null>(null);
  const comHello = useHelloDisponivel() ?? false;
  const [escolhido, setEscolhido] = useState<ModoAbrir | null>(null);
  const modo: ModoAbrir = escolhido ?? (comHello ? "hello" : "pin");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const avPin = avaliarPin(pin, pin2);

  const buscar = async (p: ProvedorNuvem) => {
    setErro(null);
    setEntrando(p);
    try {
      setAchado(await api.nuvemBuscarParaRecuperar(p));
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setEntrando(null);
    }
  };

  const trazer = async () => {
    setErro(null);
    setOcupado(true);
    try {
      await api.nuvemConcluirRecuperacao(modo, modo === "pin" ? pin : undefined);
      aoConcluir();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  };

  if (achado) {
    const pronto = modo !== "pin" || avPin.ok;
    return (
      <Form className="formulario" onSubmit={(e) => (e.preventDefault(), pronto && !ocupado && trazer())}>
        <h1>{t.recuperarTitulo}</h1>
        <Aviso tipo="ok">{t.encontrado(achado.conta, formatoData.format(achado.criadoEm))}</Aviso>
        <p className="campo-rotulo">{t.comoAbrir}</p>
        <EscolhaModo valor={modo} aoMudar={setEscolhido} rotulo={t.comoAbrir} comHello={comHello} comSenha={false} />
        {modo === "pin" && (
          <>
            <Campo rotulo={textos.pin.rotulo} valor={pin} aoMudar={setPin} secreto numerico maximo={8} descricao={textos.pin.dica} />
            <Campo rotulo={textos.pin.confirmar} valor={pin2} aoMudar={setPin2} secreto numerico maximo={8} />
            <Aviso>{avPin.erro}</Aviso>
          </>
        )}
        <Aviso>{erro}</Aviso>
        <div className="botoes">
          <Button className="botao" onPress={() => (setAchado(null), setErro(null))}>{textos.comum.voltar}</Button>
          <Button className="botao principal" type="submit" isDisabled={!pronto || ocupado}>{ocupado ? t.trazendo : t.trazer}</Button>
        </div>
      </Form>
    );
  }

  return (
    <div className="formulario">
      <h1>{t.recuperarTitulo}</h1>
      <p>{t.recuperarTexto}</p>
      <div className="botoes-grandes">
        {contas.map((p, i) => (
          <Button key={p} className="botao grande" autoFocus={i === 0} isDisabled={!!entrando} onPress={() => buscar(p)}>
            <LogIn aria-hidden="true" size="1.3em" /> {t.entrarCom(t.provedores[p])}
          </Button>
        ))}
      </div>
      {entrando && <p role="status">{t.entrando(t.servicos[entrando])}</p>}
      <Aviso>{erro}</Aviso>
      <div className="botoes">
        <Button className="botao" onPress={aoVoltar}>{textos.comum.voltar}</Button>
      </div>
    </div>
  );
}

/** Ajustes: ligar, ver a última cópia, enviar agora e desligar. Some se não houver conta disponível. */
export function AjustesNuvem() {
  const contas = useContasDisponiveis();
  const [situacao, setSituacao] = useState<SituacaoNuvem | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [desligando, setDesligando] = useState(false);

  useEffect(() => {
    api.nuvemSituacao().then(setSituacao, () => setSituacao(null));
  }, []);

  const fazer = async (qual: string, acao: () => Promise<unknown>, ok?: string) => {
    setErro(null);
    setAviso(null);
    setOcupado(qual);
    try {
      await acao();
      if (ok) setAviso(ok);
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(null);
      api.nuvemSituacao().then(setSituacao, () => undefined);
    }
  };

  if (contas.length === 0 && !situacao) return null;

  return (
    <section className="cartao">
      <h2>{t.titulo}</h2>
      <p className="campo-ajuda">{t.explicacao}</p>
      {situacao ? (
        <>
          <p className="com-icone">
            <Cloud aria-hidden="true" size="1.1em" /> {t.ligadoA(situacao.conta, t.servicos[situacao.provedor])}
          </p>
          <p className="texto-suave">{situacao.ultimo ? t.ultimo(formatoData.format(situacao.ultimo)) : t.nuncaEnviado}</p>
          {situacao.erro && <Aviso>{`${t.erroUltimo} ${situacao.erro}`}</Aviso>}
          <div className="botoes">
            <Button className="botao com-icone" isDisabled={!!ocupado} onPress={() => fazer("enviar", () => api.nuvemEnviar(false), t.enviado)}>
              <CloudUpload aria-hidden="true" size="1em" /> {ocupado === "enviar" ? t.enviando : t.enviarAgora}
            </Button>
            <Button className="botao" isDisabled={!!ocupado} onPress={() => setDesligando(true)}>{t.desligar}</Button>
          </div>
        </>
      ) : (
        <>
          <p className="campo-ajuda">{t.limite}</p>
          <div className="botoes">
            {contas.map((p) => (
              <Button key={p} className="botao com-icone" isDisabled={!!ocupado} onPress={() => fazer(p, () => api.nuvemConectar(p))}>
                <LogIn aria-hidden="true" size="1em" /> {ocupado === p ? textos.comum.aguarde : t.ligar(t.provedores[p])}
              </Button>
            ))}
          </div>
          {ocupado && ocupado !== "enviar" && <p role="status">{t.entrando(t.servicos[ocupado as ProvedorNuvem])}</p>}
        </>
      )}
      <Aviso tipo="ok">{aviso}</Aviso>
      <Aviso>{erro}</Aviso>

      <Janela titulo={t.desligarTitulo} aberta={desligando} aoFechar={() => setDesligando(false)} pequena>
        <div className="formulario">
          <p>{t.desligarTexto}</p>
          {situacao?.provedor === "microsoft" && <p className="texto-suave pequeno">{t.microsoftRevogar}</p>}
          <div className="janela-acoes">
            <Button className="botao" onPress={() => setDesligando(false)}>{textos.comum.cancelar}</Button>
            <Button className="botao" onPress={() => (setDesligando(false), fazer("desligar", () => api.nuvemDesconectar(false), t.desligado))}>{t.soDesligar}</Button>
            <Button className="botao principal" onPress={() => (setDesligando(false), fazer("desligar", () => api.nuvemDesconectar(true), t.desligado))}>{t.desligarEApagar}</Button>
          </div>
        </div>
      </Janela>
    </section>
  );
}
