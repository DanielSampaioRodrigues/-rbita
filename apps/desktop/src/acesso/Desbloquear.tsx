import { useEffect, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, ErroOrbita, type Situacao } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { textos } from "../textos/pt-BR";
import { MolduraAcesso } from "./Moldura";
import { Recuperar } from "./Recuperar";

const t = textos.desbloquear;

type Forma = "pin" | "senha" | "recuperar";

export function Desbloquear({ situacao, aoAbrir }: { situacao: Situacao; aoAbrir: () => void }) {
  const pinDisponivel = situacao.modo === "pin" && situacao.tentativasRestantes > 0;
  const [forma, setForma] = useState<Forma>(pinDisponivel ? "pin" : "senha");
  const [valor, setValor] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(
    situacao.modo === "pin" && !pinDisponivel ? t.pinBloqueado : null,
  );
  const [pinBloqueado, setPinBloqueado] = useState(!pinDisponivel);

  // "Abrir direto": tenta sozinho; se o computador não tiver a chave, pede a senha.
  useEffect(() => {
    if (situacao.modo !== "direto") return;
    api.abrirDireto().then(aoAbrir, () => setErro(t.semChave));
  }, [situacao.modo, aoAbrir]);

  const trocar = (f: Forma) => {
    setForma(f);
    setValor("");
    setErro(null);
  };

  const entrar = async () => {
    if (!valor || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      await (forma === "pin" ? api.abrirComPin(valor) : api.abrirComSenha(valor));
      aoAbrir();
    } catch (e) {
      const err = e instanceof ErroOrbita ? e : new ErroOrbita("interno", String(e));
      setValor("");
      if (err.codigo === "pin_errado") setErro(`${err.message} ${t.restantes(err.tentativasRestantes ?? 0)}`);
      else if (err.codigo === "pin_bloqueado" || err.codigo === "aparelho_sem_chave") {
        // O PIN não serve mais aqui: já mostra o campo de senha.
        setPinBloqueado(true);
        setForma("senha");
        setErro(err.codigo === "pin_bloqueado" ? t.pinBloqueado : t.semChave);
      } else setErro(err.message);
    } finally {
      setOcupado(false);
    }
  };

  if (forma === "recuperar") return <Recuperar aoVoltar={() => trocar("senha")} aoConcluir={aoAbrir} />;

  return (
    <MolduraAcesso>
      <Form className="formulario" onSubmit={(e) => (e.preventDefault(), entrar())}>
        <h1>{t.titulo}</h1>
        <p>{forma === "pin" ? t.pinTexto : t.senhaTexto}</p>
        {forma === "pin" ? (
          <Campo key="pin" rotulo={textos.pin.rotulo} valor={valor} aoMudar={setValor} secreto numerico autoFocus maximo={8} />
        ) : (
          <Campo key="senha" rotulo={textos.senha.rotulo} valor={valor} aoMudar={setValor} secreto autoFocus autoComplete="current-password" />
        )}
        <Aviso>{erro}</Aviso>
        <div className="botoes">
          <Button className="botao principal" type="submit" isDisabled={!valor || ocupado}>
            {ocupado ? textos.comum.aguarde : textos.comum.entrar}
          </Button>
        </div>
        <div className="links">
          {forma === "pin" && <Button className="link" onPress={() => trocar("senha")}>{t.usarSenha}</Button>}
          {forma === "senha" && situacao.modo === "pin" && !pinBloqueado && (
            <Button className="link" onPress={() => trocar("pin")}>{t.usarPin}</Button>
          )}
          <Button className="link" onPress={() => trocar("recuperar")}>{t.esqueci}</Button>
        </div>
      </Form>
    </MolduraAcesso>
  );
}
