import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { avaliarPin, avaliarSenha } from "../acesso/validacao";
import { api, type ModoAbrir } from "../api";
import { useConfirmarIdentidade } from "../componentes/ConfirmarIdentidade";
import { Aviso, Campo } from "../componentes/Campo";
import { ChaveRecuperacao } from "../componentes/ChaveRecuperacao";
import { EscolhaModo } from "../componentes/EscolhaModo";
import { Janela } from "../componentes/Janela";
import { textos } from "../textos/pt-BR";
import { useHelloDisponivel } from "../useHello";

const t = textos.seguranca;
const c = textos.comum;

type Janela = "modo" | "senha" | "chave" | null;

export function Seguranca({ modo, temSenha, aoMudar }: { modo: ModoAbrir | null; temSenha: boolean; aoMudar: () => void }) {
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
      <p className="texto-suave">{temSenha ? t.comSenha : t.semSenha}</p>
      <div className="botoes">
        <Button className="botao" onPress={() => (setAviso(null), setJanela("senha"))}>{temSenha ? t.trocarSenha : t.criarSenha}</Button>
        <Button className="botao" onPress={() => (setAviso(null), setJanela("chave"))}>{t.verChave}</Button>
      </div>
      <Aviso tipo="ok">{aviso}</Aviso>

      <Janela titulo={t.mudarTitulo} aberta={janela === "modo"} aoFechar={fechar}>
        <MudarModo atual={modo ?? "pin"} temSenha={temSenha} aoCancelar={fechar} aoConcluir={concluir} />
      </Janela>
      <Janela titulo={temSenha ? t.trocarTitulo : t.criarSenha} aberta={janela === "senha"} aoFechar={fechar}>
        <DefinirSenha modo={modo} temSenha={temSenha} aoCancelar={fechar} aoConcluir={concluir} />
      </Janela>
      <Janela titulo={t.verTitulo} aberta={janela === "chave"} aoFechar={fechar}>
        <VerChave modo={modo} temSenha={temSenha} aoFechar={fechar} />
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

type PropsConfirmar = { modo: ModoAbrir | null; temSenha: boolean };

function MudarModo({ atual, temSenha, aoCancelar, aoConcluir }: { atual: ModoAbrir; temSenha: boolean; aoCancelar: () => void; aoConcluir: () => void }) {
  const [modo, setModo] = useState<ModoAbrir>(atual);
  const comHello = (useHelloDisponivel() ?? false) || atual === "hello";
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const { confirmacao, campos } = useConfirmarIdentidade(atual, temSenha);
  const { ocupado, erro, enviar } = useEnvio();
  const avPin = avaliarPin(pin, pin2);
  const pronto = confirmacao !== null && (modo !== "pin" || avPin.ok);
  return (
    <Form className="formulario" onSubmit={(e) => (e.preventDefault(), pronto && enviar(async () => (await api.mudarModo(confirmacao, modo, modo === "pin" ? pin : undefined), aoConcluir())))}>
      <EscolhaModo valor={modo} aoMudar={setModo} rotulo={t.mudarTitulo} comHello={comHello} comSenha={temSenha} />
      {modo === "pin" && (
        <>
          <Campo rotulo={textos.pin.rotulo} valor={pin} aoMudar={setPin} secreto numerico maximo={8} descricao={textos.pin.dica} />
          <Campo rotulo={textos.pin.confirmar} valor={pin2} aoMudar={setPin2} secreto numerico maximo={8} />
        </>
      )}
      {campos}
      <Aviso>{avPin.erro && modo === "pin" ? avPin.erro : erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoCancelar}>{c.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!pronto || ocupado}>{ocupado ? c.aguarde : c.salvar}</Button>
      </div>
    </Form>
  );
}

function DefinirSenha({ modo, temSenha, aoCancelar, aoConcluir }: PropsConfirmar & { aoCancelar: () => void; aoConcluir: () => void }) {
  const [nova, setNova] = useState("");
  const [nova2, setNova2] = useState("");
  const { confirmacao, campos } = useConfirmarIdentidade(modo, temSenha);
  const { ocupado, erro, enviar } = useEnvio();
  const av = avaliarSenha(nova, nova2);
  const pronto = confirmacao !== null && av.ok;
  return (
    <Form className="formulario" onSubmit={(e) => (e.preventDefault(), pronto && enviar(async () => (await api.definirSenha(confirmacao, nova), aoConcluir())))}>
      {!temSenha && <p>{t.criarSenhaTexto}</p>}
      {campos}
      <Campo rotulo={t.novaSenha} valor={nova} aoMudar={setNova} secreto autoFocus={!temSenha} descricao={av.dica ?? textos.senha.dica} autoComplete="new-password" />
      <Campo rotulo={textos.senha.confirmar} valor={nova2} aoMudar={setNova2} secreto autoComplete="new-password" />
      <Aviso>{av.erro ?? erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoCancelar}>{c.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!pronto || ocupado}>{ocupado ? c.aguarde : c.salvar}</Button>
      </div>
    </Form>
  );
}

function VerChave({ modo, temSenha, aoFechar }: PropsConfirmar & { aoFechar: () => void }) {
  const [palavras, setPalavras] = useState<string[] | null>(null);
  const { confirmacao, campos } = useConfirmarIdentidade(modo, temSenha);
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
    <Form className="formulario" onSubmit={(e) => (e.preventDefault(), confirmacao && enviar(async () => setPalavras(await api.verPalavras(confirmacao))))}>
      {campos}
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{c.cancelar}</Button>
        <Button className="botao principal" type="submit" autoFocus={confirmacao?.tipo === "aparelho"} isDisabled={!confirmacao || ocupado}>{ocupado ? c.aguarde : c.continuar}</Button>
      </div>
    </Form>
  );
}
