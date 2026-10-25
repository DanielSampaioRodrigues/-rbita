import { useEffect, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, ErroOrbita, type Situacao } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { textos } from "../textos/pt-BR";
import { MolduraAcesso } from "./Moldura";
import { esquecerMotivo, motivoDoBloqueio } from "../app/BloqueioAutomatico";
import { Recuperar } from "./Recuperar";

const t = textos.desbloquear;

type Forma = "hello" | "pin" | "senha" | "recuperar";

export function Desbloquear({ situacao, aoAbrir }: { situacao: Situacao; aoAbrir: () => void }) {
  const pinDisponivel = situacao.modo === "pin" && situacao.tentativasRestantes > 0;
  const comSenha = situacao.temSenha;
  // Plano B quando o jeito rápido não serve: a senha, ou (sem senha) as 6 palavras.
  const reserva: Forma = comSenha ? "senha" : "recuperar";
  const [forma, setForma] = useState<Forma>(situacao.modo === "hello" ? "hello" : pinDisponivel ? "pin" : situacao.modo === "direto" ? "senha" : reserva);
  const [valor, setValor] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [motivo] = useState(motivoDoBloqueio);
  useEffect(esquecerMotivo, []);
  const [erro, setErro] = useState<string | null>(
    situacao.modo === "pin" && !pinDisponivel ? t.pinBloqueado(comSenha) : null,
  );
  const [pinBloqueado, setPinBloqueado] = useState(!pinDisponivel);

  // "Abrir direto": tenta sozinho; se o computador não tiver a chave, pede a senha.
  useEffect(() => {
    if (situacao.modo !== "direto") return;
    api.abrirDireto().then(aoAbrir, () => (setErro(t.semChave(comSenha)), setForma(reserva)));
  }, [situacao.modo, aoAbrir, comSenha, reserva]);

  const trocar = (f: Forma) => {
    setForma(f);
    setValor("");
    setErro(null);
  };

  const entrar = async () => {
    if ((forma !== "hello" && !valor) || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      await (forma === "hello" ? api.abrirComHello() : forma === "pin" ? api.abrirComPin(valor) : api.abrirComSenha(valor));
      aoAbrir();
    } catch (e) {
      const err = e instanceof ErroOrbita ? e : new ErroOrbita("interno", String(e));
      setValor("");
      if (err.codigo === "pin_errado") setErro(`${err.message} ${t.restantes(err.tentativasRestantes ?? 0)}`);
      else if (err.codigo === "hello_cancelado") setErro(t.helloCancelado);
      else if (["pin_bloqueado", "aparelho_sem_chave", "hello_indisponivel"].includes(err.codigo)) {
        // O jeito rápido não serve mais aqui: já mostra o campo de senha.
        setPinBloqueado(true);
        setForma(reserva);
        setErro(err.codigo === "pin_bloqueado" ? t.pinBloqueado(comSenha) : err.codigo === "hello_indisponivel" ? err.message : t.semChave(comSenha));
      } else setErro(err.message);
    } finally {
      setOcupado(false);
    }
  };

  // De onde voltar da recuperação: a senha, ou o jeito rápido se ele ainda serve.
  const voltarPara: Forma | null = comSenha ? "senha" : situacao.modo === "hello" && !pinBloqueado ? "hello" : situacao.modo === "pin" && !pinBloqueado ? "pin" : null;
  if (forma === "recuperar")
    return <Recuperar comSenha={comSenha} aviso={erro} aoVoltar={voltarPara ? () => trocar(voltarPara) : undefined} aoConcluir={aoAbrir} />;
  // "Abrir direto" tentando sozinho: só uma tela calma enquanto isso.
  if (situacao.modo === "direto" && forma === "senha" && !comSenha) return <MolduraAcesso><p role="status">{textos.comum.aguarde}</p></MolduraAcesso>;

  return (
    <MolduraAcesso>
      <Form className="formulario" onSubmit={(e) => (e.preventDefault(), entrar())}>
        <h1>{t.titulo}</h1>
        {motivo && <Aviso tipo="info">{textos.janela.bloqueadoPorTempo(motivo)}</Aviso>}
        <p>{forma === "hello" ? t.helloTexto : forma === "pin" ? t.pinTexto : t.senhaTexto}</p>
        {forma === "hello" ? null : forma === "pin" ? (
          <Campo key="pin" rotulo={textos.pin.rotulo} valor={valor} aoMudar={setValor} secreto numerico autoFocus maximo={8} />
        ) : (
          <Campo key="senha" rotulo={textos.senha.rotulo} valor={valor} aoMudar={setValor} secreto autoFocus autoComplete="current-password" />
        )}
        <Aviso>{erro}</Aviso>
        <div className="botoes">
          <Button className="botao principal" type="submit" autoFocus={forma === "hello"} isDisabled={(forma !== "hello" && !valor) || ocupado}>
            {ocupado ? textos.comum.aguarde : forma === "hello" ? t.abrirHello : textos.comum.entrar}
          </Button>
        </div>
        <div className="links">
          {(forma === "pin" || forma === "hello") && <Button className="link" onPress={() => trocar(reserva)}>{comSenha ? t.usarSenha : t.usarPalavras}</Button>}
          {forma === "senha" && situacao.modo === "hello" && !pinBloqueado && (
            <Button className="link" onPress={() => trocar("hello")}>{t.usarHello}</Button>
          )}
          {forma === "senha" && situacao.modo === "pin" && !pinBloqueado && (
            <Button className="link" onPress={() => trocar("pin")}>{t.usarPin}</Button>
          )}
          {comSenha && <Button className="link" onPress={() => trocar("recuperar")}>{t.esqueci}</Button>}
        </div>
      </Form>
    </MolduraAcesso>
  );
}
