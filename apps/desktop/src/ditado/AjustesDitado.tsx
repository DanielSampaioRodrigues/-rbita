import { useEffect, useState } from "react";
import { Button, ProgressBar } from "react-aria-components";
import { api, ErroOrbita, type EstadoDitado, type ModeloVoz } from "../api";
import { Aviso } from "../componentes/Campo";
import { Confirmar } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { textos } from "../textos/pt-BR";
import { recarregarRecursos } from "./recursos";

const t = textos.ditado;
const TAMANHO: Record<ModeloVoz, string> = { base: "142 MB", small: "466 MB" };

/** Cartão de Ditado em Ajustes: escolher o modelo de voz, baixar, trocar ou remover. */
export function AjustesDitado() {
  const [estado, setEstado] = useState<EstadoDitado | null>(null);
  const [memoria, setMemoria] = useState<number | null>(null);
  const [modelo, setModelo] = useState<ModeloVoz>("small");
  const [progresso, setProgresso] = useState<number | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [removendo, setRemovendo] = useState(false);

  useEffect(() => {
    api.ditadoEstado().then(setEstado, () => {});
    api.memoriaDoComputador().then((gb) => {
      if (gb === null) return;
      const arredondado = Math.round(gb);
      setMemoria(arredondado);
      setModelo(arredondado < 8 ? "base" : "small");
    }, () => {});
    let parar: (() => void) | null = null;
    api.ouvirProgressoDitado((b, total) => setProgresso(Math.min(100, Math.round((b / total) * 100)))).then((f) => (parar = f));
    return () => parar?.();
  }, []);

  if (!estado) return null;

  const baixar = async (m: ModeloVoz) => {
    setAviso(null);
    setProgresso(0);
    try {
      setEstado({ ...estado, baixando: true });
      setEstado(await api.ditadoBaixar(m));
      setAviso({ tipo: "ok", texto: t.instaladoAviso });
      void recarregarRecursos();
    } catch (e) {
      setEstado(await api.ditadoEstado());
      setAviso({ tipo: "erro", texto: e instanceof ErroOrbita ? e.message : String(e) });
    } finally {
      setProgresso(null);
    }
  };

  const outro: ModeloVoz = estado.instalado === "small" ? "base" : "small";

  return (
    <section className="cartao">
      <h2>{t.titulo}</h2>
      <p className="texto-suave">{t.explicacao}</p>

      {estado.baixando ? (
        <>
          <ProgressBar className="barra-progresso" value={progresso ?? 0} aria-label={t.baixando(progresso ?? 0)}>
            {({ percentage }) => (
              <>
                <span className="barra-progresso-texto">{t.baixando(Math.round(percentage ?? 0))}</span>
                <div className="barra-progresso-trilho">
                  <div className="barra-progresso-preenchido" style={{ width: `${percentage}%` }} />
                </div>
              </>
            )}
          </ProgressBar>
          <div className="botoes">
            <Button className="botao" onPress={() => api.ditadoCancelarDownload()}>{t.cancelar}</Button>
          </div>
        </>
      ) : estado.instalado ? (
        <>
          <p>{t.instalado(t.modelos[estado.instalado])}</p>
          <p className="campo-ajuda">{t.dica}</p>
          <div className="botoes">
            <Button className="botao" onPress={() => baixar(outro)}>{`${t.trocar} (${t.modelos[outro]})`}</Button>
            <Button className="botao" onPress={() => setRemovendo(true)}>{t.remover}</Button>
          </div>
        </>
      ) : (
        <>
          <Segmentado<ModeloVoz>
            rotulo={t.modelo}
            valor={modelo}
            opcoes={(["small", "base"] as ModeloVoz[]).map((m) => ({ valor: m, nome: t.modelos[m] }))}
            aoMudar={setModelo}
          />
          <p className="campo-ajuda">{t.recomendado(memoria, memoria !== null && memoria < 8 ? "base" : "small")}</p>
          <div className="botoes">
            <Button className="botao principal" onPress={() => baixar(modelo)}>{t.baixar(TAMANHO[modelo])}</Button>
          </div>
        </>
      )}
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

      <Confirmar
        aberta={removendo}
        titulo={t.remover}
        texto={t.removerTexto}
        confirmar={t.remover}
        aoCancelar={() => setRemovendo(false)}
        aoConfirmar={async () => {
          setRemovendo(false);
          setEstado(await api.ditadoRemover());
          setAviso({ tipo: "ok", texto: t.removido });
          void recarregarRecursos();
        }}
      />
    </section>
  );
}
