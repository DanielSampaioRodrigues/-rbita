// Ajustes > Sincronizar aparelhos (etapa 2d): estado, ligar, perguntas, senha nova e
// "Desligar neste aparelho". Os passos de ligar ficam no assistente (TelasSincronia.tsx).
import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { api } from "../api";
import { Aviso } from "../componentes/Campo";
import { Confirmar } from "../componentes/Janela";
import { Check, RefreshCw } from "../icones";
import { textos } from "../textos/pt-BR";
import { olharPasta } from "./fluxo";
import { useSincronia } from "./ProvedorSincronia";
import { quandoFoi } from "./rotulo";
import { CartaoConta, LogoGoogle, mensagemDe } from "./TelasSincronia";

const t = textos.sincronia;

export function AjustesSincronia() {
  const s = useSincronia();
  const [temChave, setTemChave] = useState<boolean | null>(null);
  const [perguntas, setPerguntas] = useState<boolean | null | "erro">(null);
  const [desligando, setDesligando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Recarrega quando a sincronização muda (ligou, desligou, terminou um ciclo).
  const fase = s.estado.fase;
  useEffect(() => {
    let vivo = true;
    if (s.disponibilidade !== "sim") return;
    api.sincroniaSituacao().then(
      (x) => vivo && setTemChave(x.temChave),
      () => vivo && setTemChave(false),
    );
    return () => void (vivo = false);
  }, [s.disponibilidade, s.versao, fase]);
  useEffect(() => {
    let vivo = true;
    if (!temChave || !s.armazenamento) return;
    olharPasta(s.armazenamento).then(
      (o) => vivo && setPerguntas(o.temRecuperacao),
      () => vivo && setPerguntas("erro"),
    );
    return () => void (vivo = false);
  }, [temChave, s.armazenamento, s.versao]);

  const desligar = async () => {
    setDesligando(false);
    setOcupado(true);
    setErro(null);
    try {
      await api.sincroniaSair();
      setAviso(t.desligado);
      s.avisarQueMudou();
      await s.sincronizarAgora(); // o aviso do alto some (este aparelho não tem mais a chave)
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setOcupado(false);
    }
  };

  const ligada = temChave === true;
  const cabecalho = (
    <div className="sinc-cartao-topo">
      <span className="sinc-topo-icone" aria-hidden="true">
        <RefreshCw size="1.3em" strokeWidth={1.75} />
      </span>
      <div className="sinc-cartao-titulo">
        <h2>{t.nomeAssunto}</h2>
        {s.disponibilidade === "sim" && temChave !== null && (
          <span className={`sinc-selo${ligada ? " ligada" : ""}`}>
            {ligada && <Check aria-hidden="true" size="0.95em" strokeWidth={2.5} />}
            {ligada ? t.ligada : t.desligada}
          </span>
        )}
      </div>
    </div>
  );

  if (s.disponibilidade !== "sim") {
    return (
      <section className="cartao sinc-cartao">
        {cabecalho}
        <p className="campo-ajuda">{t.cartaoTexto}</p>
        <Pontinhos />
        <Aviso tipo="info">{s.disponibilidade === "sem-credencial" ? t.semCredencial : t.indisponivel}</Aviso>
      </section>
    );
  }

  return (
    <section className="cartao sinc-cartao">
      {cabecalho}
      <p className="campo-ajuda">{t.cartaoTexto}</p>
      {ligada ? (
        <>
          <dl className="sinc-dados">
            {s.conta && (
              <div>
                <dt>{t.contaRotulo}</dt>
                <dd><CartaoConta conta={s.conta} /></dd>
              </div>
            )}
            <div>
              <dt>{t.ultimaRotulo}</dt>
              <dd>{s.estado.ultima ? quandoFoi(s.estado.ultima, Date.now()) : t.nuncaSincronizou}</dd>
            </div>
            <div>
              <dt>{t.perguntasRotulo}</dt>
              <dd>{perguntas === "erro" ? t.perguntasNaoSei : perguntas === null ? textos.comum.aguarde : perguntas ? t.perguntasFeitas : t.perguntasNaoFeitas}</dd>
            </div>
          </dl>
          <div className="botoes">
            <Button className="botao com-icone" isDisabled={ocupado} onPress={() => void s.sincronizarAgora()}>
              <RefreshCw aria-hidden="true" size="1em" /> {t.sincronizarAgora}
            </Button>
            <Button className="botao" isDisabled={ocupado} onPress={() => (setAviso(null), s.abrirAssistente("perguntas"))}>
              {perguntas === true ? t.refazerPerguntas : t.fazerPerguntas}
            </Button>
            <Button className="botao" isDisabled={ocupado} onPress={() => (setAviso(null), s.abrirAssistente("senhaNova"))}>
              {t.criarSenhaNova}
            </Button>
          </div>
          <div className="sinc-cartao-rodape">
            <Button className="botao" isDisabled={ocupado} onPress={() => (setAviso(null), setDesligando(true))}>
              {t.desligar}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Pontinhos />
          {s.plataforma === "windows" && !s.conta && <p className="texto-suave pequeno">{t.windowsSemConta}</p>}
          <div className="botoes">
            <Button className="botao principal com-icone" isDisabled={temChave === null} onPress={() => (setAviso(null), s.abrirAssistente("ligar"))}>
              {s.conta ? <RefreshCw aria-hidden="true" size="1em" /> : <LogoGoogle tamanho="1.1em" />} {t.ligar}
            </Button>
          </div>
        </>
      )}
      <Aviso tipo="ok">{aviso}</Aviso>
      <Aviso>{erro}</Aviso>
      <Confirmar titulo={t.desligarTitulo} texto={t.desligarTexto} confirmar={t.desligar} aberta={desligando} aoCancelar={() => setDesligando(false)} aoConfirmar={() => void desligar()} />
    </section>
  );
}

function Pontinhos() {
  return (
    <ul className="sinc-pontos">
      {t.pontos.map((p) => (
        <li key={p}>
          <Check aria-hidden="true" size="1em" strokeWidth={2} />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}
