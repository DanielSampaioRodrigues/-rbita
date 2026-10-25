import type { ReactNode } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { textos } from "../textos/pt-BR";

interface Props {
  titulo: string;
  aberta: boolean;
  aoFechar: () => void;
  children: ReactNode;
  pequena?: boolean;
}

/** Janela de diálogo: Esc ou clique fora fecham; o foco fica preso dentro. */
export function Janela({ titulo, aberta, aoFechar, children, pequena }: Props) {
  return (
    <ModalOverlay className="sobreposicao" isOpen={aberta} onOpenChange={(v) => !v && aoFechar()} isDismissable>
      <Modal className={pequena ? "janela pequena" : "janela"}>
        <Dialog className="janela-dialogo">
          <Heading slot="title">{titulo}</Heading>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Pergunta antes de algo que não dá para desfazer pela tela. */
export function Confirmar({
  titulo,
  texto,
  confirmar,
  aberta,
  aoCancelar,
  aoConfirmar,
}: {
  titulo: string;
  texto: string;
  confirmar: string;
  aberta: boolean;
  aoCancelar: () => void;
  aoConfirmar: () => void;
}) {
  return (
    <ModalOverlay className="sobreposicao" isOpen={aberta} onOpenChange={(v) => !v && aoCancelar()} isDismissable>
      <Modal className="janela pequena">
        <Dialog className="janela-dialogo" role="alertdialog">
          <Heading slot="title">{titulo}</Heading>
          <p>{texto}</p>
          <div className="janela-acoes">
            <Button className="botao" onPress={aoCancelar} autoFocus>{textos.comum.cancelar}</Button>
            <Button className="botao principal" onPress={aoConfirmar}>{confirmar}</Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
