import { X } from "../icones";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { ATALHOS, ATALHOS_GERAIS } from "../atalhos";
import { ATALHOS_CADERNO, ATALHOS_EDITOR, GESTOS_CADERNO } from "../caderno/atalhosCaderno";
import { Teclas } from "../componentes/Teclas";
import { textos } from "../textos/pt-BR";

const t = textos.atalhos;

export function JanelaAtalhos({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  return (
    <ModalOverlay className="sobreposicao" isOpen={aberta} onOpenChange={(v) => !v && aoFechar()} isDismissable>
      <Modal className="janela">
        <Dialog className="janela-dialogo">
          <div className="janela-topo">
            <Heading slot="title">{t.titulo}</Heading>
            <Button className="botao-icone" onPress={aoFechar} aria-label={t.fechar}>
              <X aria-hidden="true" size="1.2em" />
            </Button>
          </div>

          <h3 className="janela-subtitulo">{t.doApp}</h3>
          <dl className="lista-atalhos">
            {ATALHOS.map((a) => (
              <div key={a.acao}>
                <dt>{a.descricao}</dt>
                <dd><Teclas combinacoes={a.teclas} /></dd>
              </div>
            ))}
          </dl>

          <h3 className="janela-subtitulo">{t.caderno}</h3>
          <dl className="lista-atalhos">
            {ATALHOS_CADERNO.map((a) => (
              <div key={a.descricao}>
                <dt>{a.descricao}</dt>
                <dd><Teclas combinacoes={a.teclas} /></dd>
              </div>
            ))}
          </dl>

          <h3 className="janela-subtitulo">{t.gestos}</h3>
          <dl className="lista-atalhos">
            {GESTOS_CADERNO.map((a) => (
              <div key={a.gesto}>
                <dt>{a.descricao}</dt>
                <dd>{a.gesto}</dd>
              </div>
            ))}
          </dl>

          <h3 className="janela-subtitulo">{t.editor}</h3>
          <dl className="lista-atalhos">
            {ATALHOS_EDITOR.map((a) => (
              <div key={a.descricao}>
                <dt>{a.descricao}</dt>
                <dd><Teclas combinacoes={a.teclas} /></dd>
              </div>
            ))}
          </dl>

          <h3 className="janela-subtitulo">{t.gerais}</h3>
          <dl className="lista-atalhos">
            {ATALHOS_GERAIS.map((a) => (
              <div key={a.descricao}>
                <dt>{a.descricao}</dt>
                <dd><Teclas combinacoes={a.teclas} /></dd>
              </div>
            ))}
          </dl>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
