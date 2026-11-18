import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type ModoAbrir } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { ChaveRecuperacao } from "../componentes/ChaveRecuperacao";
import { EscolhaModo } from "../componentes/EscolhaModo";
import { RestaurarBackup } from "../componentes/RestaurarBackup";
import { ICONES } from "../app/Moldura";
import { usePreferencias } from "../estado";
import { SECOES_JUNTAS, SECOES_MENU, SECOES_SUGERIDAS, SECOES_TRAVADAS, type SecaoMenu } from "../preferencias";
import { textos } from "../textos/pt-BR";
import { useHelloDisponivel } from "../useHello";
import { MolduraAcesso } from "./Moldura";
import { avaliarPin } from "./validacao";
import { EscolherRecuperacao, RecuperarDaNuvem, useContasDisponiveis } from "../nuvem/Nuvem";
import { contaNaPrimeiraTela, continuarSincroniaDepois, entrarAntesDoCofre } from "../sincronia/ProvedorSincronia";
import { CartaoConta, mensagemDe } from "../sincronia/TelasSincronia";
import type { PerfilGoogle } from "../sincronia/googleWeb";

const t = textos.criar;
/** O que dá para escolher na primeira vez (o Início, a Aparência e os Ajustes ficam sempre). */
const MODULOS: SecaoMenu[] = SECOES_MENU.filter((s) => !SECOES_TRAVADAS.includes(s) && !SECOES_JUNTAS[s]);
const c = textos.comum;

// Sem senha para inventar: as 6 palavras são a tranca forte (a senha é opcional, em Ajustes).
type Passo = "boasVindas" | "usar" | "restaurar" | "nuvem" | "modo" | "pin" | "recuperacao" | "chave" | "googlePin";

export function CriarCofre({ aoConcluir }: { aoConcluir: () => void }) {
  const [passo, setPasso] = useState<Passo>("boasVindas");
  const { prefs, mudar } = usePreferencias();
  const [usar, setUsar] = useState<SecaoMenu[]>(() => MODULOS.filter((s) => SECOES_SUGERIDAS.includes(s)));
  const comHello = useHelloDisponivel() ?? false;
  // Até a pessoa escolher, a recomendação: Windows Hello quando houver, senão PIN.
  const [escolhido, setModo] = useState<ModoAbrir | null>(null);
  const modo: ModoAbrir = escolhido ?? (comHello ? "hello" : "pin");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [palavras, setPalavras] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Entrar com Google em destaque (só quando o login do Google existe nesta versão).
  const [comConta] = useState(contaNaPrimeiraTela);
  const [conta, setConta] = useState<PerfilGoogle | null>(null);

  // Com conta Google ou Microsoft disponível, o último passo pergunta onde guardar a recuperação.
  const contas = useContasDisponiveis();
  const avPin = avaliarPin(pin, pin2);
  const ordem: Passo[] = modo === "pin" ? ["modo", "pin", "chave"] : ["modo", "chave"];
  const numero = (p: Passo) => c.passo(ordem.indexOf(p === "recuperacao" ? "chave" : p) + 1, ordem.length);

  // Primeira vez sem burocracia (decisão de Dan, 18/11/2026): abre direto, sem PIN e sem as 6 palavras
  // na entrada. A trava e a recuperação viram opção, oferecida depois (Ajustes > Segurança).
  const criarDireto = async () => {
    setOcupado(true);
    setErro(null);
    try {
      await api.criarCofre(null, "direto");
      mudar({ recuperacaoPendente: true, menu: { ordem: prefs.menu.ordem, ocultos: MODULOS.filter((s) => !usar.includes(s)) } });
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setOcupado(false);
    }
  };

  const criar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      setPalavras(await api.criarCofre(null, modo, modo === "pin" ? pin : undefined));
      setPasso(contas.length > 0 ? "recuperacao" : "chave");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  // Entrar com Google: a janela do Google abre direto do toque (Safari do iPad).
  const entrarGoogle = () => {
    setErro(null);
    setOcupado(true);
    entrarAntesDoCofre()
      .then((p) => {
        setConta(p);
        setPin("");
        setPin2("");
        setPasso("googlePin");
      })
      .catch((e) => setErro(mensagemDe(e)))
      .finally(() => setOcupado(false));
  };

  const criarComConta = async () => {
    setOcupado(true);
    setErro(null);
    try {
      // As 6 palavras continuam existindo (Ajustes > Segurança), mas deixam de ser obrigatórias.
      await api.criarCofre(null, "pin", pin);
      continuarSincroniaDepois(pin);
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setOcupado(false);
    }
  };

  if (passo === "googlePin") {
    return (
      <MolduraAcesso>
        <Form className="formulario" onSubmit={(e) => (e.preventDefault(), avPin.ok && !ocupado && criarComConta())}>
          {conta && (
            <>
              <p className="sinc-rotulo-pequeno">{textos.sincronia.contaEntrou}</p>
              <CartaoConta conta={conta} />
            </>
          )}
          <h1>{t.googlePinTitulo}</h1>
          <p>{t.googlePinTexto}</p>
          <Campo rotulo={textos.pin.rotulo} valor={pin} aoMudar={setPin} secreto numerico autoFocus maximo={8} descricao={textos.pin.dica} />
          <Campo rotulo={textos.pin.confirmar} valor={pin2} aoMudar={setPin2} secreto numerico maximo={8} />
          <p className="texto-suave pequeno">{t.googleDepois}</p>
          <Aviso>{avPin.erro ?? erro}</Aviso>
          <div className="botoes">
            <Button className="botao" onPress={() => setPasso("boasVindas")}>{c.voltar}</Button>
            <Button className="botao principal" type="submit" isDisabled={!avPin.ok || ocupado}>{ocupado ? t.protegendo : c.continuar}</Button>
          </div>
        </Form>
      </MolduraAcesso>
    );
  }

  if (passo === "boasVindas") {
    return (
      <MolduraAcesso>
        <h1>{t.boasVindasTitulo}</h1>
        <p>{t.boasVindasTexto}</p>
        <ul className="primeira-pontos">{t.pontos.map((x) => <li key={x}>{x}</li>)}</ul>
        <Aviso>{erro}</Aviso>
        <Button className="botao principal grande" autoFocus onPress={() => (setErro(null), setPasso("usar"))}>{t.comecar}</Button>
        <div className="links">
          {comConta && <Button className="link" isDisabled={ocupado} onPress={entrarGoogle}>{ocupado ? textos.sincronia.entrando : t.jaUsoGoogle}</Button>}
          {contas.length > 0 && <Button className="link" onPress={() => setPasso("nuvem")}>{textos.nuvem.jaUso}</Button>}
          <Button className="link" onPress={() => setPasso("restaurar")}>{textos.backup.tenhoBackup}</Button>
        </div>
      </MolduraAcesso>
    );
  }

  if (passo === "usar") {
    const tudo = usar.length === MODULOS.length;
    return (
      <MolduraAcesso passo={c.passo(2, 2)}>
        <div className="linha-ajuste esticado">
          <h1>{t.usarTitulo}</h1>
          <Button className="botao" onPress={() => setUsar(tudo ? [] : [...MODULOS])}>{tudo ? t.desmarcarTudo : t.escolherTudo}</Button>
        </div>
        <p className="texto-suave">{t.usarTexto}</p>
        <div className="primeira-modulos" role="group" aria-label={t.usarTitulo}>
          {MODULOS.map((s) => {
            const Icone = ICONES[s], ligado = usar.includes(s);
            return (
              <button key={s} type="button" className={ligado ? "primeira-modulo ligado" : "primeira-modulo"} aria-pressed={ligado}
                onClick={() => setUsar((u) => (u.includes(s) ? u.filter((x) => x !== s) : [...u, s]))}>
                <Icone aria-hidden="true" size="1.2em" strokeWidth={1.75} />
                <b>{textos.secoes[s]}</b>
                <small>{t.modulos[s as keyof typeof t.modulos]}</small>
              </button>
            );
          })}
        </div>
        <Aviso>{erro}</Aviso>
        <div className="botoes">
          <span className="texto-suave pequeno">{t.quantos(usar.length, MODULOS.length)}</span>
          <Button className="botao" onPress={() => setPasso("boasVindas")}>{c.voltar}</Button>
          <Button className="botao principal grande" isDisabled={ocupado} onPress={() => void criarDireto()}>{ocupado ? t.protegendo : t.abrirOrbita}</Button>
        </div>
        <p className="texto-suave pequeno">{t.semTrava}</p>
      </MolduraAcesso>
    );
  }

  if (passo === "nuvem") {
    return (
      <MolduraAcesso>
        <RecuperarDaNuvem contas={contas} aoVoltar={() => setPasso("boasVindas")} aoConcluir={aoConcluir} />
      </MolduraAcesso>
    );
  }

  if (passo === "recuperacao") {
    return (
      <MolduraAcesso passo={numero("recuperacao")}>
        <EscolherRecuperacao contas={contas} aoEscolherPalavras={() => setPasso("chave")} aoConcluir={aoConcluir} />
      </MolduraAcesso>
    );
  }

  if (passo === "restaurar") {
    return (
      <MolduraAcesso>
        <h1>{textos.backup.restaurarTitulo}</h1>
        <RestaurarBackup substitui={false} aoVoltar={() => setPasso("boasVindas")} aoConcluir={aoConcluir} />
      </MolduraAcesso>
    );
  }

  if (passo === "modo") {
    return (
      <MolduraAcesso passo={numero("modo")}>
        <Form className="formulario" onSubmit={(e) => (e.preventDefault(), modo === "pin" ? setPasso("pin") : criar())}>
          <h1>{t.modoTitulo}</h1>
          <p className="texto-suave">{t.modoTexto}</p>
          <EscolhaModo valor={modo} aoMudar={setModo} rotulo={t.modoTitulo} comHello={comHello} comSenha={false} />
          <Aviso>{erro}</Aviso>
          <div className="botoes">
            <Button className="botao" onPress={() => setPasso("boasVindas")}>{c.voltar}</Button>
            <Button className="botao principal" type="submit" isDisabled={ocupado}>{ocupado ? t.protegendo : c.continuar}</Button>
          </div>
        </Form>
      </MolduraAcesso>
    );
  }

  if (passo === "pin") {
    return (
      <MolduraAcesso passo={numero("pin")}>
        <Form className="formulario" onSubmit={(e) => (e.preventDefault(), avPin.ok && !ocupado && criar())}>
          <h1>{t.pinTitulo}</h1>
          <p>{t.pinTexto}</p>
          <Campo rotulo={textos.pin.rotulo} valor={pin} aoMudar={setPin} secreto numerico autoFocus maximo={8} descricao={textos.pin.dica} />
          <Campo rotulo={textos.pin.confirmar} valor={pin2} aoMudar={setPin2} secreto numerico maximo={8} />
          <Aviso>{avPin.erro ?? erro}</Aviso>
          <div className="botoes">
            <Button className="botao" onPress={() => setPasso("modo")}>{c.voltar}</Button>
            <Button className="botao principal" type="submit" isDisabled={!avPin.ok || ocupado}>{ocupado ? t.protegendo : c.continuar}</Button>
          </div>
        </Form>
      </MolduraAcesso>
    );
  }

  return (
    <MolduraAcesso passo={numero("chave")}>
      <h1>{textos.chave.titulo}</h1>
      <p>{textos.chave.texto}</p>
      <p className="texto-suave">{textos.chave.ondeGuardar}</p>
      <ChaveRecuperacao palavras={palavras} />
      <p className="texto-suave">{textos.chave.depois}</p>
      <div className="botoes">
        <Button className="botao principal" onPress={aoConcluir}>{textos.chave.pronto}</Button>
      </div>
    </MolduraAcesso>
  );
}
