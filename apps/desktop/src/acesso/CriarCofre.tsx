import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type ModoAbrir } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { ChaveRecuperacao } from "../componentes/ChaveRecuperacao";
import { EscolhaModo } from "../componentes/EscolhaModo";
import { RestaurarBackup } from "../componentes/RestaurarBackup";
import { textos } from "../textos/pt-BR";
import { useHelloDisponivel } from "../useHello";
import { MolduraAcesso } from "./Moldura";
import { avaliarPin } from "./validacao";

const t = textos.criar;
const c = textos.comum;

// Sem senha para inventar: as 6 palavras são a tranca forte (a senha é opcional, em Ajustes).
type Passo = "boasVindas" | "restaurar" | "modo" | "pin" | "chave";

export function CriarCofre({ aoConcluir }: { aoConcluir: () => void }) {
  const [passo, setPasso] = useState<Passo>("boasVindas");
  const comHello = useHelloDisponivel() ?? false;
  // Até a pessoa escolher, a recomendação: Windows Hello quando houver, senão PIN.
  const [escolhido, setModo] = useState<ModoAbrir | null>(null);
  const modo: ModoAbrir = escolhido ?? (comHello ? "hello" : "pin");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [palavras, setPalavras] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const avPin = avaliarPin(pin, pin2);
  const ordem: Passo[] = modo === "pin" ? ["modo", "pin", "chave"] : ["modo", "chave"];
  const numero = (p: Passo) => c.passo(ordem.indexOf(p) + 1, ordem.length);

  const criar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      setPalavras(await api.criarCofre(null, modo, modo === "pin" ? pin : undefined));
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
        <Button className="botao principal" autoFocus onPress={() => setPasso("modo")}>{t.comecar}</Button>
        <div className="links">
          <Button className="link" onPress={() => setPasso("restaurar")}>{textos.backup.tenhoBackup}</Button>
        </div>
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
