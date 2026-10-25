import { Download, FolderOpen, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { api, escolherOndeSalvarBackup, escolherPasta, type SituacaoBackup } from "../api";
import { Aviso } from "../componentes/Campo";
import { Interruptor } from "../componentes/Interruptor";
import { RestaurarBackup } from "../componentes/RestaurarBackup";
import { textos } from "../textos/pt-BR";

const t = textos.backup;
const formato = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" });

export function Backup({ aoRestaurar }: { aoRestaurar: () => void }) {
  const [situacao, setSituacao] = useState<SituacaoBackup | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api.situacaoBackup().then(setSituacao, () => {});
  }, []);

  const executar = async (acao: () => Promise<string | null>) => {
    setOcupado(true);
    setAviso(null);
    try {
      const texto = await acao();
      if (texto) setAviso({ tipo: "ok", texto });
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado(false);
    }
  };

  const ligarAutomatico = (ligar: boolean) =>
    executar(async () => {
      const pasta = ligar ? await escolherPasta() : null;
      if (ligar && !pasta) return null;
      setSituacao(await api.definirBackupAutomatico(pasta));
      return null;
    });

  return (
    <section className="cartao">
      <h2>{t.titulo}</h2>
      <p className="texto-suave">{t.explicacao}</p>
      <div className="botoes">
        <Button
          className="botao"
          isDisabled={ocupado}
          onPress={() =>
            executar(async () => {
              const caminho = await escolherOndeSalvarBackup();
              if (!caminho) return null;
              await api.fazerBackup(caminho);
              return t.feito;
            })
          }
        >
          <Download aria-hidden="true" size="1.1em" /> {t.fazerAgora}
        </Button>
        <Button className="botao" onPress={() => (setAviso(null), setRestaurando(true))}>
          <Upload aria-hidden="true" size="1.1em" /> {t.restaurar}
        </Button>
      </div>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

      <div className="campo">
        <Interruptor rotulo={t.automatico} ligado={!!situacao?.pasta} aoMudar={ligarAutomatico} />
        <p className="campo-ajuda">{t.automaticoExplicacao}</p>
      </div>
      {situacao?.pasta && (
        <div className="linha-ajuste">
          <div>
            <p className="quebra">{t.pasta(situacao.pasta)}</p>
            <p className="texto-suave">{situacao.ultimo ? t.ultimo(formato.format(situacao.ultimo)) : t.nenhumAinda}</p>
          </div>
          <Button className="botao" isDisabled={ocupado} onPress={() => ligarAutomatico(true)}>
            <FolderOpen aria-hidden="true" size="1.1em" /> {t.trocarPasta}
          </Button>
        </div>
      )}
      {situacao?.erro && <Aviso>{t.erro(situacao.erro)}</Aviso>}

      <ModalOverlay className="sobreposicao" isOpen={restaurando} onOpenChange={setRestaurando} isDismissable>
        <Modal className="janela">
          <Dialog className="janela-dialogo">
            <Heading slot="title">{t.restaurarTitulo}</Heading>
            <RestaurarBackup substitui aoVoltar={() => setRestaurando(false)} aoConcluir={() => (setRestaurando(false), aoRestaurar())} />
          </Dialog>
        </Modal>
      </ModalOverlay>
    </section>
  );
}
