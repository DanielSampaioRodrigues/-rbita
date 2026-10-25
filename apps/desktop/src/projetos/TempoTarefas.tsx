import { ChevronLeft, ChevronRight, Flag } from "../icones";
import { useState } from "react";
import { Button } from "react-aria-components";
import { chaveDia, diasDaGradeDoMes, inicioDoDia, inicioDoMes } from "../agenda/datas";
import type { Projeto, Tarefa } from "../api";
import { textos } from "../textos/pt-BR";
import { dataLocal } from "./prazos";

const t = textos.projeto;
const ta = textos.agenda;
const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });
const fmtMesLongo = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });

interface Props {
  projeto: Projeto;
  tarefas: Tarefa[];
  /** Abre a janela de prazo da tarefa. */
  aoDefinirPrazo: (t: Tarefa) => void;
}

/** Tarefas sem prazo, com um jeito rápido de dar prazo (sem cobrar). */
function SemPrazo({ tarefas, aoDefinirPrazo }: { tarefas: Tarefa[]; aoDefinirPrazo: (t: Tarefa) => void }) {
  if (!tarefas.length) return null;
  return (
    <section className="grupo" aria-labelledby="sem-prazo">
      <h3 id="sem-prazo">{t.semPrazo}</h3>
      <p className="texto-suave pequeno">{t.semPrazoAjuda}</p>
      <ul className="lista-ligadas">
        {tarefas.map((x) => (
          <li key={x.id}>
            <span className={x.estado === "feita" ? "quebra feita-texto" : "quebra"}>{x.titulo}</span>
            <Button className="botao pequeno" onPress={() => aoDefinirPrazo(x)}>{t.definirPrazo}</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Uma linha por tarefa com prazo, em ordem de data, com a marca de hoje e o prazo do projeto. */
export function LinhaTarefas({ projeto, tarefas, aoDefinirPrazo }: Props) {
  const hoje = inicioDoDia(new Date());
  const comPrazo = tarefas.filter((x) => x.prazo).sort((a, b) => a.prazo!.localeCompare(b.prazo!));
  const datas = [hoje, ...comPrazo.map((x) => dataLocal(x.prazo!))];
  if (projeto.inicio) datas.push(dataLocal(projeto.inicio));
  if (projeto.prazo) datas.push(dataLocal(projeto.prazo));
  const min = new Date(Math.min(...datas.map((d) => d.getTime())));
  const max = new Date(Math.max(...datas.map((d) => d.getTime())));
  const inicio = new Date(min.getFullYear(), min.getMonth(), 1);
  const fim = new Date(max.getFullYear(), max.getMonth() + 1, 1);
  const total = fim.getTime() - inicio.getTime();
  const pos = (d: Date) => `${((d.getTime() - inicio.getTime()) / total) * 100}%`;
  const meses: Date[] = [];
  for (let m = new Date(inicio); m < fim; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) meses.push(m);
  const prazoProjeto = projeto.prazo ? dataLocal(projeto.prazo) : null;

  return (
    <div className="linha-tempo esticado">
      {comPrazo.length === 0 ? (
        <p className="texto-suave">{t.nenhumaComPrazo}</p>
      ) : (
        <div className="linha-tempo-grade">
          <div className="linha-tempo-cabecalho" aria-hidden="true">
            <span />
            <div className="linha-tempo-eixo">
              {meses.map((m) => (
                <span key={m.getTime()} style={{ left: pos(m) }}>{fmtMes.format(m).replace(".", "")}</span>
              ))}
              <span className="linha-tempo-hoje-rotulo" style={{ left: pos(hoje) }}>{textos.projetos.hoje}</span>
            </div>
          </div>
          <ul className="linha-tempo-linhas">
            {comPrazo.map((x) => {
              const d = dataLocal(x.prazo!);
              return (
                <li key={x.id}>
                  <Button className={`linha-tempo-linha ${x.estado === "feita" ? "feita" : ""}`} onPress={() => aoDefinirPrazo(x)} aria-label={t.tarefaPrazo(x.titulo, fmtDia.format(d))}>
                    <span className="linha-tempo-nome quebra">{x.titulo}</span>
                    <span className="linha-tempo-trilho" aria-hidden="true">
                      <span className="linha-tempo-hoje" style={{ left: pos(hoje) }} />
                      {prazoProjeto && <span className="linha-tempo-fim-projeto" style={{ left: pos(prazoProjeto) }} />}
                      <span className="linha-tempo-marco" style={{ left: pos(d) }} />
                      <span className="linha-tempo-data" style={{ left: pos(d) }}>{fmtDia.format(d)}</span>
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
          {prazoProjeto && (
            <p className="texto-suave pequeno com-icone"><Flag aria-hidden="true" size="0.9em" /> {t.prazoDoProjeto}: {fmtDia.format(prazoProjeto)}</p>
          )}
        </div>
      )}
      <SemPrazo tarefas={tarefas.filter((x) => !x.prazo)} aoDefinirPrazo={aoDefinirPrazo} />
    </div>
  );
}

/** O mês, com as tarefas no dia do prazo. Clicar numa tarefa muda o prazo. */
export function CalendarioTarefas({ projeto, tarefas, aoDefinirPrazo }: Props) {
  const primeiroPrazo = tarefas.filter((x) => x.prazo && x.estado !== "feita").map((x) => x.prazo!).sort()[0];
  const [mes, setMes] = useState(() => inicioDoMes(primeiroPrazo && dataLocal(primeiroPrazo) > new Date() ? dataLocal(primeiroPrazo) : new Date()));
  const hoje = chaveDia(new Date());
  const dias = diasDaGradeDoMes(mes);
  const andar = (n: number) => setMes(new Date(mes.getFullYear(), mes.getMonth() + n, 1));

  return (
    <div className="grupo esticado">
      <div className="botoes">
        <Button className="botao-icone" onPress={() => andar(-1)} aria-label={t.mesAnterior}><ChevronLeft aria-hidden="true" size="1.1em" /></Button>
        <Button className="botao" onPress={() => setMes(inicioDoMes(new Date()))}>{t.esteMes}</Button>
        <Button className="botao-icone" onPress={() => andar(1)} aria-label={t.mesSeguinte}><ChevronRight aria-hidden="true" size="1.1em" /></Button>
        <h3 className="mes-titulo" aria-live="polite">{fmtMesLongo.format(mes)}</h3>
      </div>
      <div className="mes" role="grid" aria-label={fmtMesLongo.format(mes)}>
        <div className="mes-linha cabecalho" role="row">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <span key={d} role="columnheader" className="mes-cabecalho">{ta.diasSemanaCurtos[d]}</span>
          ))}
        </div>
        {Array.from({ length: dias.length / 7 }, (_, s) => (
          <div key={s} className="mes-linha" role="row">
            {dias.slice(s * 7, s * 7 + 7).map((d) => {
              const chave = chaveDia(d);
              const doDia = tarefas.filter((x) => x.prazo === chave);
              const fimProjeto = projeto.prazo === chave;
              const classes = ["mes-dia", "estatico", d.getMonth() !== mes.getMonth() && "fora", chave === hoje && "hoje"].filter(Boolean).join(" ");
              return (
                <div key={chave} role="gridcell" className={classes}>
                  <span className="mes-numero">{d.getDate()}</span>
                  {fimProjeto && <span className="mes-evento prazo quebra">{t.prazoDoProjeto}</span>}
                  {doDia.map((x) => (
                    <Button key={x.id} className={x.estado === "feita" ? "mes-evento tarefa feita-texto quebra" : "mes-evento tarefa quebra"} onPress={() => aoDefinirPrazo(x)} aria-label={t.tarefaPrazo(x.titulo, fmtDia.format(d))}>
                      {x.titulo}
                    </Button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <SemPrazo tarefas={tarefas.filter((x) => !x.prazo)} aoDefinirPrazo={aoDefinirPrazo} />
    </div>
  );
}
