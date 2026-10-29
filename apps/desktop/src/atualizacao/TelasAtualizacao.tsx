import { Download, RefreshCw } from "../icones";
import { useState } from "react";
import { Button } from "react-aria-components";
import { Aviso } from "../componentes/Campo";
import { Interruptor } from "../componentes/Interruptor";
import { Janela } from "../componentes/Janela";
import { TextoRico } from "../componentes/TextoRico";
import { usePreferencias } from "../estado";
import { textos } from "../textos/pt-BR";
import { MODO_WEB } from "../api";
import { useAtualizacao, type Atualizacao } from "./atualizacao";

const t = textos.atualizacao;

/** Faixa calma no alto da tela quando há versão nova. Some com "Agora não". */
export function AvisoAtualizacao() {
  const { estado, adiada, adiar } = useAtualizacao();
  const [vendo, setVendo] = useState(false);
  if (estado.fase !== "disponivel") return null;
  return (
    <>
      {!adiada && (
        <div className="aviso-transicao aviso-atualizacao" role="status">
          <Download aria-hidden="true" size="1.2em" />
          <p>{t.disponivel(estado.atualizacao.versao)}</p>
          <Button className="botao" onPress={() => setVendo(true)}>{t.verMudancas}</Button>
          <Button className="botao" onPress={adiar}>{t.agoraNao}</Button>
        </div>
      )}
      <JanelaAtualizacao atualizacao={vendo ? estado.atualizacao : null} aoFechar={() => setVendo(false)} aoAdiar={() => (adiar(), setVendo(false))} />
    </>
  );
}

/** O que mudou, e instalar só se a pessoa quiser. */
export function JanelaAtualizacao({ atualizacao, aoFechar, aoAdiar }: { atualizacao: Atualizacao | null; aoFechar: () => void; aoAdiar: () => void }) {
  const [progresso, setProgresso] = useState<number | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const instalando = progresso !== undefined;

  const instalar = async () => {
    if (!atualizacao) return;
    setErro(null);
    setProgresso(null);
    try {
      await atualizacao.instalar(setProgresso);
    } catch {
      setProgresso(undefined);
      setErro(t.erroInstalar);
    }
  };

  return (
    <Janela titulo={atualizacao ? t.tituloJanela(atualizacao.versao) : ""} aberta={atualizacao !== null} aoFechar={() => !instalando && aoFechar()}>
      {atualizacao && (
        <div className="formulario">
          <h3>{t.oQueMudou}</h3>
          {atualizacao.notas.trim() ? <TextoRico markdown={atualizacao.notas} /> : <p className="texto-suave">{t.semNotas}</p>}
          <p className="texto-suave pequeno">{MODO_WEB ? t.comoInstalaWeb : t.comoInstala}</p>
          {instalando && (
            <div className="barra-progresso" role="status">
              <span>{progresso === null ? t.baixando : t.baixandoPorcento(Math.round((progresso ?? 0) * 100))}</span>
              <div className="barra-progresso-trilho" aria-hidden="true">
                <div className="barra-progresso-preenchido" style={{ width: `${Math.round((progresso ?? 0) * 100)}%` }} />
              </div>
            </div>
          )}
          <Aviso>{erro}</Aviso>
          <div className="janela-acoes">
            <Button className="botao" onPress={aoAdiar} isDisabled={instalando}>{t.agoraNao}</Button>
            <Button className="botao principal com-icone" onPress={instalar} isDisabled={instalando}>
              <Download aria-hidden="true" size="1em" /> {t.instalarAgora}
            </Button>
          </div>
        </div>
      )}
    </Janela>
  );
}

/** Bloco em Ajustes: versão atual, procurar agora e procurar sozinho ao abrir. */
export function AjustesAtualizacao() {
  const { prefs, mudar } = usePreferencias();
  const { estado, procurar, adiar } = useAtualizacao();
  const [vendo, setVendo] = useState(false);
  return (
    <section className="cartao">
      <h2>{t.titulo}</h2>
      <p className="campo-ajuda">{t.versaoAtual(__VERSAO__)}</p>
      <div className="botoes">
        <Button className="botao com-icone" onPress={procurar} isDisabled={estado.fase === "procurando"}>
          <RefreshCw aria-hidden="true" size="1em" /> {estado.fase === "procurando" ? t.procurando : t.procurar}
        </Button>
        {estado.fase === "disponivel" && (
          <Button className="botao principal" onPress={() => setVendo(true)}>{t.verMudancas}</Button>
        )}
      </div>
      <div role="status">
        {estado.fase === "em-dia" && <p>{t.emDia}</p>}
        {estado.fase === "disponivel" && <p>{t.disponivel(estado.atualizacao.versao)}</p>}
      </div>
      {estado.fase === "erro" && <Aviso>{estado.mensagem}</Aviso>}
      <div className="campo">
        <Interruptor rotulo={t.procurarAoAbrir} ligado={prefs.procurarAtualizacao} aoMudar={(procurarAtualizacao) => mudar({ procurarAtualizacao })} />
        <p className="campo-ajuda">{t.procurarAoAbrirAjuda}</p>
      </div>
      <JanelaAtualizacao
        atualizacao={vendo && estado.fase === "disponivel" ? estado.atualizacao : null}
        aoFechar={() => setVendo(false)}
        aoAdiar={() => (adiar(), setVendo(false))}
      />
    </section>
  );
}
