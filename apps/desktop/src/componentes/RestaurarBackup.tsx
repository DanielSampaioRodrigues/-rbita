import { FileUp } from "lucide-react";
import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { avaliarPin } from "../acesso/validacao";
import { api, ErroOrbita, escolherBackup, type InfoBackup, type ModoAbrir } from "../api";
import { useHelloDisponivel } from "../useHello";
import { EscolhaModo } from "./EscolhaModo";
import { QUANTIDADE, reconhecer } from "../palavras";
import { textos } from "../textos/pt-BR";
import { Aviso, Campo } from "./Campo";
import { CampoPalavras } from "./CampoPalavras";

const t = textos.backup;
const c = textos.comum;
const formato = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" });

function mensagem(e: unknown): string {
  if (e instanceof ErroOrbita) {
    if (e.codigo === "palavras_erradas" && e.posicoes) return textos.recuperar.erradas(e.posicoes);
    if (e.codigo === "chave_errada") return textos.recuperar.naoAbre;
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
}

interface Props {
  /** Há dados neste computador que serão guardados de lado. */
  substitui: boolean;
  aoVoltar: () => void;
  aoConcluir: () => void;
}

/** Restaurar: escolher o arquivo, digitar a senha (ou as palavras) e pronto. */
export function RestaurarBackup({ substitui, aoVoltar, aoConcluir }: Props) {
  const [arquivo, setArquivo] = useState<{ caminho: string; info: InfoBackup } | null>(null);
  const [usarPalavras, setUsarPalavras] = useState(false);
  const [senha, setSenha] = useState("");
  const [palavras, setPalavras] = useState<string[]>(Array(QUANTIDADE).fill(""));
  const [modoFinal, setModoFinal] = useState<ModoAbrir | null>(null);
  // Backup sem senha: a pessoa escolhe como abrir depois (não há senha para voltar).
  const comHello = useHelloDisponivel() ?? false;
  const [escolhido, setEscolhido] = useState<ModoAbrir | null>(null);
  const modoDepois: ModoAbrir = escolhido ?? (comHello ? "hello" : "pin");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
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

  if (modoFinal) {
    return (
      <div className="formulario">
        <Aviso tipo="ok">{t.restaurado}</Aviso>
        {modoFinal === "senha" && <p className="texto-suave">{t.pinDeNovo}</p>}
        <div className="botoes">
          <Button className="botao principal" autoFocus onPress={aoConcluir}>{t.abrir}</Button>
        </div>
      </div>
    );
  }

  if (!arquivo) {
    return (
      <div className="formulario">
        <p>{t.escolherTexto}</p>
        <Aviso>{erro}</Aviso>
        <div className="botoes">
          <Button className="botao" onPress={aoVoltar}>{c.voltar}</Button>
          <Button
            className="botao principal"
            autoFocus
            isDisabled={ocupado}
            onPress={() =>
              executar(async () => {
                const caminho = await escolherBackup();
                if (caminho) setArquivo({ caminho, info: await api.infoBackup(caminho) });
              })
            }
          >
            <FileUp aria-hidden="true" size="1.1em" /> {t.escolherArquivo}
          </Button>
        </div>
      </div>
    );
  }

  const semSenha = !arquivo.info.temSenha;
  const comPalavras = usarPalavras || semSenha;
  const avPin = avaliarPin(pin, pin2);
  const pronto = (comPalavras ? palavras.every((p) => reconhecer(p)) : senha.length > 0) && (!semSenha || modoDepois !== "pin" || avPin.ok);
  const restaurar = () =>
    executar(async () => {
      const segredo = comPalavras ? { palavras: palavras.join(" ") } : { senha };
      const escolha = semSenha ? { modo: modoDepois, pin: modoDepois === "pin" ? pin : undefined } : undefined;
      setModoFinal(await api.restaurarBackup(arquivo.caminho, segredo, escolha));
    });

  return (
    <Form className="formulario" onSubmit={(e) => (e.preventDefault(), pronto && !ocupado && restaurar())}>
      <p className="campo-rotulo">{t.deData(formato.format(arquivo.info.criadoEm))}</p>
      {comPalavras ? (
        <>
          <p className="texto-suave">{semSenha ? t.semSenhaTexto : t.palavrasTexto}</p>
          <CampoPalavras valores={palavras} aoMudar={setPalavras} />
        </>
      ) : (
        <Campo rotulo={textos.senha.rotulo} valor={senha} aoMudar={setSenha} secreto autoFocus descricao={t.senhaTexto} />
      )}
      {!semSenha && (
        <div className="links">
          <Button className="link" onPress={() => (setErro(null), setUsarPalavras((v) => !v))}>
            {usarPalavras ? t.usarSenha : t.usarPalavras}
          </Button>
        </div>
      )}
      {semSenha && (
        <>
          <p className="campo-rotulo">{t.comoAbrirDepois}</p>
          <EscolhaModo valor={modoDepois} aoMudar={setEscolhido} rotulo={t.comoAbrirDepois} comHello={comHello} comSenha={false} />
          {modoDepois === "pin" && (
            <>
              <Campo rotulo={textos.pin.rotulo} valor={pin} aoMudar={setPin} secreto numerico maximo={8} descricao={textos.pin.dica} />
              <Campo rotulo={textos.pin.confirmar} valor={pin2} aoMudar={setPin2} secreto numerico maximo={8} />
              <Aviso>{avPin.erro}</Aviso>
            </>
          )}
        </>
      )}
      {substitui && <p className="texto-suave">{t.avisoSubstituir}</p>}
      <Aviso>{erro}</Aviso>
      <div className="botoes">
        <Button className="botao" onPress={() => (setErro(null), setArquivo(null))}>{c.voltar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!pronto || ocupado}>
          {ocupado ? c.aguarde : t.restaurarBotao}
        </Button>
      </div>
    </Form>
  );
}
