import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type ModoAbrir } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { ChaveRecuperacao } from "../componentes/ChaveRecuperacao";
import { EscolhaModo } from "../componentes/EscolhaModo";
import { textos } from "../textos/pt-BR";
import { MolduraAcesso } from "./Moldura";
import { avaliarPin, avaliarSenha } from "./validacao";

const t = textos.criar;
const c = textos.comum;

type Passo = "boasVindas" | "senha" | "modo" | "pin" | "chave";

export function CriarCofre({ aoConcluir }: { aoConcluir: () => void }) {
  const [passo, setPasso] = useState<Passo>("boasVindas");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [modo, setModo] = useState<ModoAbrir>("pin");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [palavras, setPalavras] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const avSenha = avaliarSenha(senha, senha2);
  const avPin = avaliarPin(pin, pin2);
  const ordem: Passo[] = modo === "pin" ? ["senha", "modo", "pin", "chave"] : ["senha", "modo", "chave"];
  const numero = (p: Passo) => c.passo(ordem.indexOf(p) + 1, ordem.length);

  const criar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      setPalavras(await api.criarCofre(senha, modo, modo === "pin" ? pin : undefined));
      setPasso("chave");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  if (passo === "boasVindas") {
    return (
      <MolduraAcesso>
        <h1>{t.boasVindasTitulo}</h1>
        <p>{t.boasVindasTexto}</p>
        <p className="texto-suave">{t.boasVindasPassos}</p>
        <Button className="botao principal" autoFocus onPress={() => setPasso("senha")}>{t.comecar}</Button>
      </MolduraAcesso>
    );
  }

  if (passo === "senha") {
    return (
      <MolduraAcesso passo={numero("senha")}>
        <Form className="formulario" onSubmit={(e) => (e.preventDefault(), avSenha.ok && setPasso("modo"))}>
          <h1>{t.senhaTitulo}</h1>
          <p>{t.senhaTexto}</p>
          <Campo rotulo={textos.senha.rotulo} valor={senha} aoMudar={setSenha} secreto autoFocus autoComplete="new-password"
            descricao={avSenha.dica ?? textos.senha.dica} />
          <Campo rotulo={textos.senha.confirmar} valor={senha2} aoMudar={setSenha2} secreto autoComplete="new-password" />
          <Aviso>{avSenha.erro}</Aviso>
          <div className="botoes">
            <Button className="botao" onPress={() => setPasso("boasVindas")}>{c.voltar}</Button>
            <Button className="botao principal" type="submit" isDisabled={!avSenha.ok}>{c.continuar}</Button>
          </div>
        </Form>
      </MolduraAcesso>
    );
  }

  if (passo === "modo") {
    return (
      <MolduraAcesso passo={numero("modo")}>
        <Form className="formulario" onSubmit={(e) => (e.preventDefault(), modo === "pin" ? setPasso("pin") : criar())}>
          <h1>{t.modoTitulo}</h1>
          <p className="texto-suave">{t.modoTexto}</p>
          <EscolhaModo valor={modo} aoMudar={setModo} rotulo={t.modoTitulo} />
          <Aviso>{erro}</Aviso>
          <div className="botoes">
            <Button className="botao" onPress={() => setPasso("senha")}>{c.voltar}</Button>
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
