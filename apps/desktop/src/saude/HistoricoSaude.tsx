import { useEffect, useMemo, useState } from "react";
import { chaveDia, inicioDoDia, somarDias } from "../agenda/datas";
import { api, type RegistroSaude } from "../api";
import { Segmentado } from "../componentes/Segmentado";
import { useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { agruparPorDia, contarGatilhos } from "./gatilhos";
import { GraficosSaude } from "./GraficosSaude";
import { ItemRegistro } from "./ItemRegistro";
import { TIPOS_REGISTRO } from "./RegistroRapido";

const t = textos.saude.historico;
const tr = textos.saude.registros;
const tg = textos.saude.graficos;
const fmtDia = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

type Periodo = "7" | "30" | "90";
type Filtro = "todos" | (typeof TIPOS_REGISTRO)[number]["tipo"];

/** Aba "Histórico": registros por dia, filtro por tipo, gatilhos e o panorama. */
export function AbaHistorico() {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [registros, setRegistros] = useState<RegistroSaude[]>([]);
  const mudancas = useMudancas();

  useEffect(() => {
    const ate = somarDias(inicioDoDia(new Date()), 1);
    api.listarRegistrosSaude(somarDias(ate, -Number(periodo)).getTime(), ate.getTime()).then(setRegistros, () => setRegistros([]));
  }, [periodo, mudancas]);

  const filtrados = useMemo(() => (filtro === "todos" ? registros : registros.filter((r) => r.tipo === filtro)), [registros, filtro]);
  const dias = useMemo(() => agruparPorDia(filtrados), [filtrados]);
  const gatilhos = useMemo(() => contarGatilhos(registros), [registros]);

  const hoje = chaveDia(new Date());
  const ontem = chaveDia(somarDias(new Date(), -1));
  const nomeDia = (dia: string) =>
    dia === hoje ? t.hoje : dia === ontem ? t.ontem : fmtDia.format(new Date(`${dia}T00:00:00`));

  return (
    <>
      <section className="cartao saude-cartao" aria-labelledby="saude-historico">
        <h2 id="saude-historico">{t.titulo}</h2>
        <div className="saude-filtros">
          <Segmentado
            rotulo={tg.periodo}
            valor={periodo}
            aoMudar={setPeriodo}
            opcoes={[
              { valor: "7", nome: tg.periodos[7] },
              { valor: "30", nome: tg.periodos[30] },
              { valor: "90", nome: tg.periodos[90] },
            ]}
          />
          <Segmentado
            rotulo={t.filtro}
            valor={filtro}
            aoMudar={setFiltro}
            opcoes={[{ valor: "todos", nome: t.todos }, ...TIPOS_REGISTRO.map(({ tipo }) => ({ valor: tipo, nome: tr.tipos[tipo] }))]}
          />
        </div>

        {dias.length === 0 ? (
          <p className="texto-suave">{filtro === "todos" ? t.vazio : t.vazioFiltro}</p>
        ) : (
          <ol className="saude-dias">
            {dias.map((d) => (
              <li key={d.dia}>
                <h3 className="saude-dia-titulo">{nomeDia(d.dia)}</h3>
                <ul className="lista-simples sem-marcador saude-registros">
                  {d.registros.map((r) => <ItemRegistro key={r.id} registro={r} />)}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>

      {gatilhos.length > 0 && (
        <section className="cartao saude-cartao" aria-labelledby="saude-gatilhos">
          <h2 id="saude-gatilhos">{t.gatilhosTitulo}</h2>
          <p className="texto-suave">{t.gatilhosIntro}</p>
          <ul className="lista-simples sem-marcador saude-gatilhos-contagem">
            {gatilhos.map((g) => (
              <li key={g.gatilho} className="linha-ajuste">
                <span>{g.gatilho}</span>
                <span className="texto-suave">{t.vezes(g.vezes)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="cartao saude-cartao" aria-labelledby="saude-graficos">
        <h2 id="saude-graficos">{tg.titulo}</h2>
        <p className="texto-suave">{tg.intro}</p>
        <GraficosSaude periodo={periodo} />
      </section>
    </>
  );
}
