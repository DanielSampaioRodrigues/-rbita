import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Button } from "react-aria-components";
import { api, ErroOrbita, type Projeto } from "../api";
import { Aviso } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";
import { JanelaOndeParei } from "./OndeParei";

const t = textos.limite;

interface Pedido {
  /** A ação que esbarrou no limite; é repetida depois de liberar uma vaga. */
  repetir: () => Promise<void>;
  /** Quando é um projeto novo, dá para criar já pausado. */
  criarPausado?: () => Promise<void>;
}

const Contexto = createContext<(acao: () => Promise<void>, criarPausado?: () => Promise<void>) => Promise<void>>(async (a) => a());

/**
 * Executa uma ação que ativa projeto. Se esbarrar no limite, pergunta qual
 * projeto pausar (ou mudar o limite) e tenta de novo. Nunca passa por cima do limite.
 */
export const useComLimite = () => useContext(Contexto);

export function ProvedorLimite({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<(Pedido & { limite: number; ativos: Projeto[] }) | null>(null);
  const [pausando, setPausando] = useState<Projeto | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const comLimite = useCallback(async (acao: () => Promise<void>, criarPausado?: () => Promise<void>) => {
    try {
      await acao();
    } catch (e) {
      if (e instanceof ErroOrbita && e.codigo === "limite_projetos") {
        const ativos = (await api.listarProjetos()).filter((p) => p.estado === "ativo");
        setErro(null);
        setPedido({ repetir: acao, criarPausado, limite: e.limite ?? ativos.length, ativos });
      } else throw e;
    }
  }, []);

  const fechar = () => setPedido(null);
  const tentarDeNovo = async (passo: () => Promise<void>) => {
    if (!pedido) return;
    try {
      await passo();
      fechar();
      avisarMudanca();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Contexto.Provider value={comLimite}>
      {children}
      <Janela titulo={t.titulo} aberta={!!pedido && !pausando} aoFechar={fechar}>
        {pedido && (
          <div className="formulario">
            <p>{t.texto(pedido.limite)}</p>
            <ul className="lista-limite">
              {pedido.ativos.map((p) => (
                <li key={p.id}>
                  <span className="quebra">{p.titulo}</span>
                  <Button className="botao" onPress={() => setPausando(p)}>{t.pausarEste}</Button>
                </li>
              ))}
            </ul>
            <Segmentado
              rotulo={textos.projetos.mudarLimite}
              valor={String(pedido.limite)}
              opcoes={["1", "2", "3", "4", "5", "6"].map((n) => ({ valor: n, nome: n }))}
              aoMudar={(n) => tentarDeNovo(async () => (await api.definirLimiteProjetos(Number(n)), await pedido.repetir()))}
            />
            <Aviso>{erro}</Aviso>
            <div className="janela-acoes">
              <Button className="botao" onPress={fechar}>{textos.comum.cancelar}</Button>
              {pedido.criarPausado && (
                <Button className="botao principal" onPress={() => tentarDeNovo(pedido.criarPausado!)}>{t.criarPausado}</Button>
              )}
            </div>
          </div>
        )}
      </Janela>
      <JanelaOndeParei
        projeto={pausando}
        modo="pausar"
        aoFechar={() => setPausando(null)}
        aoConcluir={() => {
          setPausando(null);
          if (pedido) void tentarDeNovo(pedido.repetir);
        }}
      />
    </Contexto.Provider>
  );
}
