import { Sparkles } from "../icones";
import { useState } from "react";
import { Button, Form, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { MODOS_REESCRITA, type ModoReescrita } from "../api";
import { Janela } from "../componentes/Janela";
import { JanelaRevisao, type PedidoReescrita } from "../ditado/JanelaRevisao";
import { useRecursos } from "../ditado/recursos";
import { textos } from "../textos/pt-BR";

const t = textos.reescrever;

/**
 * Botão ✨ de um campo de texto: um menu com jeitos de reescrever com IA.
 * O resultado sempre aparece como antes e depois; nada muda sem a pessoa escolher.
 * Só aparece com uma IA escolhida para "Revisar e reescrever textos".
 */
export function useReescrever(valor: string, aoMudar: (v: string) => void, ativo: boolean, aoTerminar?: () => void) {
  const { revisor, bloquearSensivel } = useRecursos();
  const [pedido, setPedido] = useState<PedidoReescrita | null>(null);
  const [livre, setLivre] = useState<string | null>(null);

  if (!ativo || !revisor) return { botao: null, janelas: null };

  const escolher = (modo: ModoReescrita) => {
    if (modo === "livre") setLivre("");
    else setPedido({ texto: valor, modo });
  };

  const botao = (
    <MenuTrigger>
      <Button className="entrada-botao" aria-label={t.botao} isDisabled={!valor.trim()}>
        <Sparkles aria-hidden="true" size="1em" />
      </Button>
      <Popover className="menu-popover" placement="bottom end">
        <Menu className="menu" aria-label={t.botao} onAction={(k) => escolher(k as ModoReescrita)}>
          {MODOS_REESCRITA.map((m) => (
            <MenuItem key={m} id={m} className="menu-item">{t.modos[m]}</MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );

  const janelas = (
    <>
      <Janela titulo={t.livreTitulo} aberta={livre !== null} aoFechar={() => setLivre(null)}>
        <Form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault();
            if (!livre?.trim()) return;
            setPedido({ texto: valor, modo: "livre", instrucao: livre });
            setLivre(null);
          }}
        >
          <label className="campo">
            <span className="campo-rotulo">{t.livreCampo}</span>
            <input className="entrada-texto sozinha" value={livre ?? ""} onChange={(e) => setLivre(e.target.value)} autoFocus maxLength={500} />
            <span className="campo-ajuda">{t.livreAjuda}</span>
          </label>
          <div className="janela-acoes">
            <Button className="botao" onPress={() => setLivre(null)}>{textos.comum.cancelar}</Button>
            <Button className="botao principal" type="submit" isDisabled={!livre?.trim()}>{t.pedir}</Button>
          </div>
        </Form>
      </Janela>
      <JanelaRevisao
        pedido={pedido}
        revisor={revisor}
        bloquearSensivel={bloquearSensivel}
        aoFechar={() => (setPedido(null), aoTerminar?.())}
        aoUsar={(novo) => (aoMudar(novo), setPedido(null), aoTerminar?.())}
      />
    </>
  );

  return { botao, janelas };
}
