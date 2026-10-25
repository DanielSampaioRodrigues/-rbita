import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { avaliarPin, avaliarSenha } from "../acesso/validacao";
import { api, type ModoAbrir } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { ChaveRecuperacao } from "../componentes/ChaveRecuperacao";
import { EscolhaModo } from "../componentes/EscolhaModo";
import { Janela } from "../componentes/Janela";
import { textos } from "../textos/pt-BR";
import { useHelloDisponivel } from "../useHello";

const t = textos.seguranca;
const c = textos.comum;

type Janela = "modo" | "senha" | "chave" | null;

export function Seguranca({ modo, aoMudar }: { modo: ModoAbrir | null; aoMudar: () => void }) {
  const [janela, setJanela] = useState<Janela>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const fechar = () => setJanela(null);
  const concluir = () => {
    setJanela(null);
    setAviso(t.salvoComSucesso);
    aoMudar();
  };

  return (
    <section className="cartao">
      <h2>{t.titulo}</h2>
      <div className="linha-ajuste">
        <div>
          <p className="campo-rotulo">{t.comoAbre}</p>
          <p className="texto-suave">{modo ? textos.modos[modo].nome : "—"}</p>
        </div>
        <Button className="botao" onPress={() => (setAviso(null), setJanela("modo"))}>{t.mudar}</Button>
      </div>
      <div className="botoes">
        <Button className="botao" onPress={() => (setAviso(null), setJanela("senha"))}>{t.trocarSenha}</Button>
        <Button className="botao" onPress={() => (setAviso(null), setJanela("chave"))}>{t.verChave}</Button>
      </div>
      <Aviso tipo="ok">{aviso}</Aviso>

      <Janela titulo={t.mudarTitulo} aberta={janela === "modo"} aoFechar={fechar}>
        <MudarModo atual={modo ?? "pin"} aoCancelar={fechar} aoConcluir={concluir} />
      </Janela>
      <Janela titulo={t.trocarTitulo} aberta={janela === "senha"} aoFechar={fechar}>
        <TrocarSenha aoCancelar={fechar} aoConcluir={concluir} />
      </Janela>
      <Janela titulo={t.verTitulo} aberta={janela === "chave"} aoFechar={fechar}>
        <VerChave aoFechar={fechar} />
      </Janela>
    </section>
  );
}

function useEnvio() {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviar = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };
  return { ocupado, erro, enviar };
}

function MudarModo({ atual, aoCancelar, aoConcluir }: { atual: ModoAbrir; aoCancelar: () => void; aoConcluir: () => void }) {
  const [modo, setModo] = useState<ModoAbrir>(atual);
  const comHello = (useHelloDisponivel() ?? false) || atual === "hello";
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [senha, setSenha] = useState("");
  const { ocupado, erro, enviar } = useEnvio();
  const avPin = avaliarPin(pin, pin2);
  const pronto = senha.length > 0 && (modo !== "pin" || avPin.ok);
  return (
    <Form className="formulario" onSubmit={(e) => (e.preventDefault(), pronto && enviar(async () => (await api.mudarModo(senha, modo, modo === "pin" ? pin : undefined), aoConcluir())))}>
      <EscolhaModo valor={modo} aoMudar={setModo} rotulo={t.mudarTitulo} comHello={comHello} />
      {modo === "pin" && (
        <>
          <Campo rotulo={textos.pin.rotulo} valor={pin} aoMudar={setPin} secreto numerico maximo={8} descricao={textos.pin.dica} />
          <Campo rotulo={textos.pin.confirmar} valor={pin2} aoMudar={setPin2} secreto numerico maximo={8} />
        </>
      )}
      <Campo rotulo={t.senhaAtual} valor={senha} aoMudar={setSenha} secreto descricao={t.confirmarComSenha} autoComplete="current-password" />
      <Aviso>{avPin.erro && modo === "pin" ? avPin.erro : erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoCancelar}>{c.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!pronto || ocupado}>{ocupado ? c.aguarde : c.salvar}</Button>
      </div>
    </Form>
  );
}

function TrocarSenha({ aoCancelar, aoConcluir }: { aoCancelar: () => void; aoConcluir: () => void }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [nova2, setNova2] = useState("");
  const { ocupado, erro, enviar } = useEnvio();
  const av = avaliarSenha(nova, nova2);
  const pronto = atual.length > 0 && av.ok;
  return (
    <Form className="formulario" onSubmit={(e) => (e.preventDefault(), pronto && enviar(async () => (await api.trocarSenha(atual, nova), aoConcluir())))}>
      <Campo rotulo={t.senhaAtual} valor={atual} aoMudar={setAtual} secreto autoFocus autoComplete="current-password" />
      <Campo rotulo={t.novaSenha} valor={nova} aoMudar={setNova} secreto descricao={av.dica ?? textos.senha.dica} autoComplete="new-password" />
      <Campo rotulo={textos.senha.confirmar} valor={nova2} aoMudar={setNova2} secreto autoComplete="new-password" />
      <Aviso>{av.erro ?? erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoCancelar}>{c.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!pronto || ocupado}>{ocupado ? c.aguarde : c.salvar}</Button>
      </div>
    </Form>
  );
}

function VerChave({ aoFechar }: { aoFechar: () => void }) {
  const [senha, setSenha] = useState("");
  const [palavras, setPalavras] = useState<string[] | null>(null);
  const { ocupado, erro, enviar } = useEnvio();
  if (palavras) {
    return (
      <>
        <p>{textos.chave.texto}</p>
        <ChaveRecuperacao palavras={palavras} />
        <div className="janela-acoes">
          <Button className="botao principal" onPress={aoFechar}>{c.fechar}</Button>
        </div>
      </>
    );
  }
  return (
    <Form className="formulario" onSubmit={(e) => (e.preventDefault(), senha && enviar(async () => setPalavras(await api.verPalavras(senha))))}>
      <Campo rotulo={textos.senha.rotulo} valor={senha} aoMudar={setSenha} secreto autoFocus descricao={t.confirmarComSenha} autoComplete="current-password" />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{c.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!senha || ocupado}>{ocupado ? c.aguarde : c.continuar}</Button>
      </div>
    </Form>
  );
}
