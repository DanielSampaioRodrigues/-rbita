import { Bot, Cpu } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { api, type EstadoIa, type FuncaoIa, type ProvedorVisivel } from "../api";
import { Escolha } from "../componentes/Escolha";
import { Interruptor } from "../componentes/Interruptor";
import { Confirmar } from "../componentes/Janela";
import { textos } from "../textos/pt-BR";
import { JanelaProvedor } from "./JanelaProvedor";
import { recarregarRecursos } from "../ditado/recursos";

const t = textos.ia;
const FUNCOES: FuncaoIa[] = ["quebrar", "conversa", "revisao"];
const NENHUM = "nenhum";

/** Cartão de IA em Ajustes: provedores, provedor por função e bloqueio de dados sensíveis. */
export function AjustesIa() {
  const [estado, setEstadoLocal] = useState<EstadoIa | null>(null);
  // A revisão nos campos de texto depende daqui: avisa quando muda.
  const setEstado = (e: EstadoIa) => (setEstadoLocal(e), void recarregarRecursos());
  const [janela, setJanela] = useState<{ editando: ProvedorVisivel | null } | null>(null);
  const [removendo, setRemovendo] = useState<ProvedorVisivel | null>(null);

  useEffect(() => {
    api.estadoIa().then(setEstadoLocal, () => {});
  }, []);

  if (!estado) return null;

  return (
    <section className="cartao">
      <h2>{t.titulo}</h2>
      <p className="texto-suave">{t.explicacao}</p>

      {estado.provedores.length === 0 ? (
        <p>{t.nenhum}</p>
      ) : (
        <ul className="lista-provedores">
          {estado.provedores.map((p) => (
            <li key={p.id} className="provedor">
              {p.local ? <Cpu aria-hidden="true" size="1.2em" /> : <Bot aria-hidden="true" size="1.2em" />}
              <div className="provedor-texto">
                <strong>{p.nome}</strong>
                <span className="texto-suave pequeno quebra">{t.linhaProvedor(p.modelo, p.finalChave, p.local)}</span>
              </div>
              <div className="botoes">
                <Button className="botao pequeno" onPress={() => setJanela({ editando: p })} aria-label={`${t.editar} ${p.nome}`}>
                  {t.editar}
                </Button>
                <Button className="botao pequeno" onPress={() => setRemovendo(p)} aria-label={`${t.remover} ${p.nome}`}>
                  {t.remover}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="botoes">
        <Button className="botao" onPress={() => setJanela({ editando: null })}>{t.adicionar}</Button>
      </div>

      {estado.provedores.length > 0 && (
        <>
          <h3>{t.funcoesTitulo}</h3>
          {FUNCOES.map((f) => (
            <Escolha
              key={f}
              rotulo={t.funcoes[f]}
              valor={estado.funcoes[f] ?? NENHUM}
              opcoes={[{ valor: NENHUM, nome: t.naoUsar }, ...estado.provedores.map((p) => ({ valor: p.id, nome: `${p.nome} (${p.modelo})` }))]}
              aoMudar={async (v) => setEstado(await api.definirFuncaoIa(f, v === NENHUM ? null : v))}
            />
          ))}
        </>
      )}

      <div className="campo">
        <Interruptor rotulo={t.sensivel} ligado={estado.bloquearSensivel} aoMudar={async (v) => setEstado(await api.bloquearSensivelIa(v))} />
        <p className="campo-ajuda">{t.sensivelAjuda}</p>
      </div>

      <JanelaProvedor
        aberta={janela !== null}
        editando={janela?.editando ?? null}
        aoFechar={() => setJanela(null)}
        aoSalvar={(e) => {
          setEstado(e);
          setJanela(null);
        }}
      />
      <Confirmar
        aberta={removendo !== null}
        titulo={removendo ? t.removerTitulo(removendo.nome) : ""}
        texto={t.removerTexto}
        confirmar={t.remover}
        aoCancelar={() => setRemovendo(null)}
        aoConfirmar={async () => {
          if (removendo) setEstado(await api.removerProvedorIa(removendo.id));
          setRemovendo(null);
        }}
      />
    </section>
  );
}
