import { PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Checkbox } from "react-aria-components";
import { LinhaOcorrencia } from "../agenda/Agenda";
import { chaveDia, expandir, inicioDoDia, somarDias, type Ocorrencia } from "../agenda/datas";
import { api, type Basico, type TarefaSugerida } from "../api";
import { Marca } from "../app/Marca";
import { Interruptor } from "../componentes/Interruptor";
import { avisarMudanca, useMudancas } from "../dados";
import { usePreferencias } from "../estado";
import { textos } from "../textos/pt-BR";
import { RegistroRapido } from "./Energia";

const t = textos.baixaEnergia;

function Caixa({ marcada, aoMudar, rotulo }: { marcada: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <Checkbox className="caixa" isSelected={marcada} onChange={aoMudar}>
      <span className="caixa-quadrado" aria-hidden="true">
        <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
      </span>
      <span className={marcada ? "tarefa-titulo feita" : "tarefa-titulo"}>{rotulo}</span>
    </Checkbox>
  );
}

/** Tela inteira só com o essencial. Sem barra lateral, sem números, sem cobrança. */
export function BaixaEnergia({ aoSair, aoCapturar }: { aoSair: () => void; aoCapturar: () => void }) {
  const [basicos, setBasicos] = useState<Basico[]>([]);
  const [tarefas, setTarefas] = useState<TarefaSugerida[]>([]);
  const [indice, setIndice] = useState(0);
  const [hoje, setHoje] = useState<Ocorrencia[]>([]);
  const mudancas = useMudancas();
  const { prefs, mudar } = usePreferencias();
  const dia = chaveDia(new Date());

  useEffect(() => {
    api.basicosDoDia(dia).then(setBasicos, () => {});
    api.tarefasSugeridas().then(setTarefas, () => {});
    const de = inicioDoDia(new Date());
    const ate = somarDias(de, 1);
    api.listarEventos(de.getTime(), ate.getTime()).then((es) => setHoje(expandir(es, de, ate)), () => {});
  }, [dia, mudancas]);

  const tarefa = tarefas.length ? tarefas[indice % tarefas.length] : null;

  return (
    <div className="baixa-energia">
      <header className="acesso-topo">
        <div className="lateral-marca">
          <Marca />
          <span>{textos.app.nome}</span>
        </div>
        <Interruptor compacto rotulo={textos.moldura.baixoEstimulo} ligado={prefs.baixoEstimulo} aoMudar={(baixoEstimulo) => mudar({ baixoEstimulo })} />
      </header>
      <main className="baixa-energia-conteudo">
        <h1>{t.titulo}</h1>
        <p className="pagina-intro">{t.texto}</p>

        <section className="cartao">
          <h2>{t.basicos}</h2>
          <ul className="tarefas">
            {basicos.map((b) => (
              <li key={b.texto} className="tarefa-linha">
                <Caixa
                  marcada={b.feito}
                  rotulo={b.texto}
                  aoMudar={async (feito) => {
                    await api.marcarBasico(dia, b.texto, feito);
                    setBasicos((bs) => bs.map((x) => (x.texto === b.texto ? { ...x, feito } : x)));
                  }}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="cartao">
          <h2>{t.umaTarefa}</h2>
          {tarefa ? (
            <>
              <div className="tarefa-linha">
                <Caixa
                  marcada={false}
                  rotulo={tarefa.titulo}
                  aoMudar={async () => {
                    await api.mudarEstadoTarefa(tarefa.id, "feita");
                    avisarMudanca();
                  }}
                />
              </div>
              <p className="texto-suave pequeno">{t.deProjeto(tarefa.projeto)}</p>
              {tarefas.length > 1 && (
                <div className="botoes">
                  <Button className="botao" onPress={() => setIndice((i) => i + 1)}>{t.outra}</Button>
                </div>
              )}
            </>
          ) : (
            <p className="texto-suave">{t.nenhumaTarefa}</p>
          )}
        </section>

        {hoje.length > 0 && (
          <section className="cartao">
            <h2>{t.hoje}</h2>
            <ul className="lista-ocorrencias">
              {hoje.map((o) => (
                <li key={o.evento.id + o.dia}>
                  <LinhaOcorrencia o={o} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="cartao">
          <RegistroRapido />
        </section>

        <div className="botoes">
          <Button className="botao" onPress={aoCapturar}>
            <PenLine aria-hidden="true" size="1.1em" /> {textos.moldura.capturar}
          </Button>
          <Button className="botao principal" onPress={aoSair}>{t.sair}</Button>
        </div>
      </main>
    </div>
  );
}
