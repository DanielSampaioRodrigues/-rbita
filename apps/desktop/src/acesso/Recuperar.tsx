import { FileText, Keyboard } from "../icones";
import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, ErroOrbita, escolherArquivoRecuperacao } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoPalavras } from "../componentes/CampoPalavras";
import { QUANTIDADE, reconhecer } from "../palavras";
import { textos } from "../textos/pt-BR";
import { MolduraAcesso } from "./Moldura";
import { avaliarSenha } from "./validacao";

const t = textos.recuperar;
const c = textos.comum;

type Passo = "escolher" | "palavras" | "novaSenha";

function mensagem(e: unknown): string {
  if (e instanceof ErroOrbita) {
    if (e.codigo === "palavras_erradas" && e.posicoes) return t.erradas(e.posicoes);
    if (e.codigo === "chave_errada") return t.naoAbre;
    return e.message;
  }
  return String(e);
}

/**
 * Esqueci a senha: um passo por tela, sem pressa, sem apagar nada.
 * Sem senha (`comSenha` falso), as palavras só abrem o Órbita, sem pedir senha nova.
 */
export function Recuperar({
  aoVoltar,
  aoConcluir,
  comSenha = true,
  aviso = null,
}: {
  /** Sem "voltar" quando não há outro jeito de abrir. */
  aoVoltar?: () => void;
  aoConcluir: () => void;
  comSenha?: boolean;
  aviso?: string | null;
}) {
  const [passo, setPasso] = useState<Passo>("escolher");
  const [palavras, setPalavras] = useState<string[]>(Array(QUANTIDADE).fill(""));
  const [chave, setChave] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const executar = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  };

  const conferir = (texto: string) =>
    executar(async () => {
      if (!comSenha) return void (await api.abrirComPalavras(texto), aoConcluir());
      await api.conferirPalavras(texto);
      setChave(texto);
      setPasso("novaSenha");
    });

  if (passo === "escolher") {
    return (
      <MolduraAcesso>
        <h1>{comSenha ? t.titulo : t.tituloSemSenha}</h1>
        {aviso && <Aviso tipo="info">{aviso}</Aviso>}
        <p>{comSenha ? t.texto : t.textoSemSenha}</p>
        <div className="botoes-grandes">
          <Button className="botao grande" autoFocus onPress={() => (setErro(null), setPasso("palavras"))}>
            <Keyboard aria-hidden="true" size="1.3em" /> {t.porPalavras}
          </Button>
          <Button
            className="botao grande"
            isDisabled={ocupado}
            onPress={() =>
              executar(async () => {
                const lidas = await escolherArquivoRecuperacao().catch(() => {
                  throw new Error(t.arquivoNaoLido);
                });
                if (lidas) await conferir(lidas);
              })
            }
          >
            <FileText aria-hidden="true" size="1.3em" /> {t.porArquivo}
          </Button>
        </div>
        <Aviso>{erro}</Aviso>
        {aoVoltar && (
          <div className="botoes">
            <Button className="botao" onPress={aoVoltar}>{c.voltar}</Button>
          </div>
        )}
      </MolduraAcesso>
    );
  }

  if (passo === "palavras") {
    const todas = palavras.every((p) => reconhecer(p));
    return (
      <MolduraAcesso>
        <Form className="formulario" onSubmit={(e) => (e.preventDefault(), todas && !ocupado && conferir(palavras.join(" ")))}>
          <h1>{t.palavrasTitulo}</h1>
          <p className="texto-suave">{t.palavrasTexto}</p>
          <CampoPalavras valores={palavras} aoMudar={setPalavras} />
          <Aviso>{erro}</Aviso>
          <div className="botoes">
            <Button className="botao" onPress={() => (setErro(null), setPasso("escolher"))}>{c.voltar}</Button>
            <Button className="botao principal" type="submit" isDisabled={!todas || ocupado}>
              {ocupado ? c.aguarde : comSenha ? t.conferir : t.abrir}
            </Button>
          </div>
        </Form>
      </MolduraAcesso>
    );
  }

  const av = avaliarSenha(senha, senha2);
  return (
    <MolduraAcesso>
      <Form
        className="formulario"
        onSubmit={(e) => (e.preventDefault(), av.ok && !ocupado && executar(async () => (await api.recuperar(chave, senha), aoConcluir())))}
      >
        <h1>{t.novaSenhaTitulo}</h1>
        <p>{t.novaSenhaTexto}</p>
        <Campo rotulo={textos.seguranca.novaSenha} valor={senha} aoMudar={setSenha} secreto autoFocus autoComplete="new-password"
          descricao={av.dica ?? textos.senha.dica} />
        <Campo rotulo={textos.senha.confirmar} valor={senha2} aoMudar={setSenha2} secreto autoComplete="new-password" />
        <Aviso>{av.erro ?? erro}</Aviso>
        <div className="botoes">
          <Button className="botao principal" type="submit" isDisabled={!av.ok || ocupado}>
            {ocupado ? c.aguarde : t.concluir}
          </Button>
        </div>
      </Form>
    </MolduraAcesso>
  );
}
