import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { api } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";
import { useRecado } from "./Recado";

const t = textos.captura;

/** Captura sem atrito: escreve, Enter, pronto. Vai para Ideias. */
export function Captura({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const recado = useRecado();

  const guardar = async () => {
    if (!texto.trim()) return;
    try {
      await api.criarIdeia(texto);
      setTexto("");
      setErro(null);
      avisarMudanca();
      recado(t.guardada);
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Janela titulo={t.titulo} aberta={aberta} aoFechar={aoFechar}>
      <Form className="formulario" onSubmit={(e) => (e.preventDefault(), guardar())}>
        <Campo rotulo={t.campo} valor={texto} aoMudar={setTexto} autoFocus descricao={t.dica} />
        <Aviso>{erro}</Aviso>
        <p className="texto-suave pequeno">{t.atalhoGlobal}</p>
        <div className="janela-acoes">
          <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
          <Button className="botao principal" type="submit" isDisabled={!texto.trim()}>{t.guardar}</Button>
        </div>
      </Form>
    </Janela>
  );
}
