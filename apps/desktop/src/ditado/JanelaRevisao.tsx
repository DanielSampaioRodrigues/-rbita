import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { api, ErroOrbita, type ModoReescrita, type ProvedorVisivel } from "../api";
import { Aviso } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { pareceSensivel } from "../ia/sensivel";
import { textos } from "../textos/pt-BR";

const t = textos.ditado;

type Fase = { tipo: "aviso" | "bloqueado" | "revisando" } | { tipo: "pronto"; revisado: string } | { tipo: "erro"; texto: string };

export interface PedidoReescrita {
  texto: string;
  modo: ModoReescrita;
  /** Só no modo "livre": o que a pessoa pediu. */
  instrucao?: string;
}

/** A IA revisa ou reescreve; a pessoa vê antes e depois e escolhe. */
export function JanelaRevisao({
  pedido,
  revisor,
  bloquearSensivel,
  aoFechar,
  aoUsar,
}: {
  /** null = fechada. */
  pedido: PedidoReescrita | null;
  revisor: ProvedorVisivel;
  bloquearSensivel: boolean;
  aoFechar: () => void;
  aoUsar: (revisado: string) => void;
}) {
  const [fase, setFase] = useState<Fase>({ tipo: "revisando" });
  const pedidoAtual = useRef(0);

  const texto = pedido?.texto ?? null;
  const revisar = async (sensivel: boolean) => {
    if (!pedido) return;
    const este = ++pedidoAtual.current;
    setFase({ tipo: "revisando" });
    try {
      const revisado = await api.revisarTextoIa(pedido.texto, sensivel, pedido.modo, pedido.instrucao);
      if (este === pedidoAtual.current) setFase({ tipo: "pronto", revisado });
    } catch (e) {
      if (este === pedidoAtual.current) setFase({ tipo: "erro", texto: e instanceof ErroOrbita ? e.message : String(e) });
    }
  };

  useEffect(() => {
    pedidoAtual.current++;
    if (!pedido) return;
    const sensivel = pareceSensivel(pedido.texto) && !revisor.local;
    if (sensivel) setFase({ tipo: bloquearSensivel ? "bloqueado" : "aviso" });
    else void revisar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  const igual = fase.tipo === "pronto" && fase.revisado.trim() === texto?.trim();

  return (
    <Janela
      titulo={pedido && pedido.modo !== "revisar" ? textos.reescrever.titulo(textos.reescrever.modos[pedido.modo]) : t.revisaoTitulo}
      aberta={pedido !== null}
      aoFechar={aoFechar}
    >
      {(fase.tipo === "aviso" || fase.tipo === "bloqueado") && (
        <>
          <Aviso tipo="info">{fase.tipo === "aviso" ? t.sensivelAviso(revisor.nome) : t.sensivelBloqueado}</Aviso>
          <div className="janela-acoes">
            <Button className="botao" onPress={aoFechar} autoFocus>{textos.comum.cancelar}</Button>
            {fase.tipo === "aviso" && <Button className="botao" onPress={() => revisar(true)}>{t.revisarMesmoAssim}</Button>}
          </div>
        </>
      )}
      {fase.tipo === "revisando" && (
        <>
          <p role="status">{t.revisando(revisor.nome)}</p>
          <div className="janela-acoes">
            <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
          </div>
        </>
      )}
      {fase.tipo === "erro" && (
        <>
          <Aviso>{fase.texto}</Aviso>
          <div className="janela-acoes">
            <Button className="botao" onPress={aoFechar}>{textos.comum.fechar}</Button>
            <Button className="botao principal" onPress={() => revisar(pareceSensivel(texto ?? ""))} autoFocus>{textos.ia.tentarDeNovo}</Button>
          </div>
        </>
      )}
      {fase.tipo === "pronto" && (
        <>
          {igual ? (
            <p role="status">{t.semMudanca}</p>
          ) : (
            <div className="revisao-comparar">
              <section>
                <h3 className="campo-rotulo">{t.antes}</h3>
                <p className="revisao-texto">{texto}</p>
              </section>
              <section>
                <h3 className="campo-rotulo">{t.depois}</h3>
                <p className="revisao-texto revisado">{fase.revisado}</p>
              </section>
            </div>
          )}
          <div className="janela-acoes">
            <Button className="botao" onPress={aoFechar} autoFocus={igual}>{t.manter}</Button>
            {!igual && (
              <Button className="botao principal" onPress={() => aoUsar(fase.revisado)} autoFocus>
                {t.usarRevisao}
              </Button>
            )}
          </div>
        </>
      )}
    </Janela>
  );
}
