import { useEffect, useMemo, useState } from "react";
import { Button } from "react-aria-components";
import { chaveDia, inicioDoDia, somarDias } from "../agenda/datas";
import { api, type Prazo, type Projeto } from "../api";
import { textos } from "../textos/pt-BR";
import { dataLocal } from "./prazos";

const t = textos.projetos;
const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });
const fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
const DIA = 86_400_000;

/**
 * Uma linha por projeto: barra do começo ao prazo (ou até hoje, tracejada, se não
 * houver prazo) e losangos nos prazos das tarefas. Cada linha abre o projeto.
 */
export function LinhaDoTempo({ projetos, aoAbrir }: { projetos: Projeto[]; aoAbrir: (id: string) => void }) {
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const hoje = inicioDoDia(new Date());

  const linhas = useMemo(
    () =>
      projetos
        .filter((p) => p.estado !== "concluido")
        .map((p) => ({ p, de: p.inicio ? dataLocal(p.inicio) : inicioDoDia(new Date(p.criadoEm)), ate: p.prazo ? dataLocal(p.prazo) : null })),
    [projetos],
  );

  // Período visível: do começo mais antigo ao prazo mais distante, com folga, sempre incluindo hoje.
  const [inicio, fim] = useMemo(() => {
    const datas = linhas.flatMap((l) => [l.de, l.ate ?? hoje]).concat(prazos.map((x) => dataLocal(x.data)), [hoje]);
    const min = new Date(Math.min(...datas.map((d) => d.getTime())));
    const max = new Date(Math.max(...datas.map((d) => d.getTime())));
    return [new Date(min.getFullYear(), min.getMonth(), 1), new Date(max.getFullYear(), max.getMonth() + 1, 1)];
  }, [linhas, prazos, hoje]);

  useEffect(() => {
    api.listarPrazos(chaveDia(somarDias(hoje, -730)), chaveDia(somarDias(hoje, 730))).then(setPrazos, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetos]);

  const total = fim.getTime() - inicio.getTime();
  const pos = (d: Date) => `${((d.getTime() - inicio.getTime()) / total) * 100}%`;
  const meses: Date[] = [];
  for (let m = new Date(inicio); m < fim; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) meses.push(m);

  return (
    <div className="linha-tempo esticado">
      <p className="campo-ajuda">{t.semDatas}</p>
      <div className="linha-tempo-grade">
        <div className="linha-tempo-cabecalho" aria-hidden="true">
          <span />
          <div className="linha-tempo-eixo">
            {meses.map((m) => (
              <span key={m.getTime()} style={{ left: pos(m) }}>{fmtMes.format(m).replace(".", "")}</span>
            ))}
            <span className="linha-tempo-hoje-rotulo" style={{ left: pos(hoje) }}>{t.hoje}</span>
          </div>
        </div>
        <ul className="linha-tempo-linhas">
          {linhas.map(({ p, de, ate }) => {
            const fimBarra = ate ?? new Date(Math.max(hoje.getTime(), de.getTime()) + 14 * DIA);
            const doProjeto = prazos.filter((x) => x.projetoId === p.id && x.tipo === "tarefa");
            const rotulo = `${t.barra(p.titulo, fmtDia.format(de), ate ? fmtDia.format(ate) : null)}. ${t.grupos[p.estado]}${doProjeto.length ? `. ${t.prazosTarefas(doProjeto.length)}` : ""}`;
            return (
              <li key={p.id}>
                <Button className={`linha-tempo-linha estado-${p.estado}`} onPress={() => aoAbrir(p.id)} aria-label={rotulo}>
                  <span className="linha-tempo-nome quebra">{p.titulo}</span>
                  <span className="linha-tempo-trilho" aria-hidden="true">
                    <span className="linha-tempo-hoje" style={{ left: pos(hoje) }} />
                    <span className={ate ? "linha-tempo-barra" : "linha-tempo-barra aberta"} style={{ left: pos(de), width: `calc(${pos(fimBarra)} - ${pos(de)})` }} />
                    {doProjeto.map((x) => (
                      <span key={x.id} className="linha-tempo-marco" style={{ left: pos(dataLocal(x.data)) }} title={`${x.titulo} · ${fmtDia.format(dataLocal(x.data))}`} />
                    ))}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
