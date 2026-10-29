// Aba "Entender": a tabela grupos × meses, explícita (cabeçalho e primeira
// coluna fixos, totais por linha e por coluna, "—" onde não há nada), e
// abaixo os gráficos.

import { useId, useMemo, useState } from "react";
import { ToggleButton } from "react-aria-components";
import type { Conta, Entrada, Gasto, Grupo } from "../api";
import { Segmentado } from "../componentes/Segmentado";
import { Sparkles } from "../icones";
import { textos } from "../textos/pt-BR";
import { BarrasPorMes, LinhaPorMes, Pizza } from "./Graficos";
import { formatarMoeda } from "./moeda";
import { entradasPorMes, filtrar, mesesEntre, mesesRecentes, tabelaPorMes } from "./visao";

const t = textos.dinheiro;
const fmtMesCurto = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const fmtMesLongo = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const chaveMesDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const dataDe = (chave: string) => {
  const [a, m] = chave.split("-").map(Number);
  return new Date(a, m - 1, 1);
};
/** "out/26": curto, para caber; o nome inteiro vai para o leitor de tela. */
const mesCurto = (chave: string) => `${fmtMesCurto.format(dataDe(chave)).replace(".", "")}/${chave.slice(2, 4)}`;
const celula = (v: number | undefined) => (v ? formatarMoeda(v) : "—");

interface Props {
  gastos: Gasto[];
  contas: Conta[];
  entradas: Entrada[];
  grupos: Grupo[];
}

export function Entender({ gastos, contas, entradas, grupos }: Props) {
  const [periodo, setPeriodo] = useState<"3" | "6" | "12" | "custom">("6");
  const hoje = useMemo(() => new Date(), []);
  const mesMax = chaveMesDe(hoje);
  const mesMin = chaveMesDe(new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1));
  const [inicioMes, setInicioMes] = useState(() => chaveMesDe(new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)));
  const [fimMes, setFimMes] = useState(mesMax);
  const [grupoId, setGrupoId] = useState("todos");
  const [soInteresse, setSoInteresse] = useState(false);
  const idFiltro = useId();
  const idComoLer = useId();
  const meses = useMemo(
    () => (periodo === "custom" ? mesesEntre(inicioMes, fimMes) : mesesRecentes(new Date(), Number(periodo))),
    [periodo, inicioMes, fimMes],
  );
  const filtrados = useMemo(() => filtrar(gastos, contas, { grupoId, soInteresse }), [gastos, contas, grupoId, soInteresse]);
  const tabela = useMemo(() => tabelaPorMes(filtrados.gastos, filtrados.contas, grupos, meses), [filtrados, grupos, meses]);
  const entrouMes = useMemo(() => entradasPorMes(entradas, meses), [entradas, meses]);
  const totalEntrou = meses.reduce((s, m) => s + (entrouMes[m] ?? 0), 0);
  const filtrando = grupoId !== "todos" || soInteresse;
  // "Entrou" e "Sobrou" só fazem sentido olhando tudo (sem filtro) e com alguma entrada.
  const mostrarSobra = !filtrando && totalEntrou > 0;
  const sobra = (entrou: number, saiu: number) => {
    const v = entrou - saiu;
    return v < 0 ? `${t.mes.faltou} ${formatarMoeda(-v)}` : formatarMoeda(v);
  };

  return (
    <div className="dinheiro-aba">
      <section className="cartao" aria-labelledby="dinheiro-visao">
        <h2 id="dinheiro-visao">{t.visao.titulo}</h2>
        <p className="texto-suave">{t.visao.intro}</p>
        <Segmentado
          rotulo={t.visao.periodo}
          valor={periodo}
          aoMudar={setPeriodo}
          opcoes={[
            { valor: "3", nome: t.visao.periodos[3] },
            { valor: "6", nome: t.visao.periodos[6] },
            { valor: "12", nome: t.visao.periodos[12] },
            { valor: "custom", nome: t.visao.periodoCustom },
          ]}
        />
        {periodo === "custom" && (
          <div className="dinheiro-intervalo">
            <div className="campo">
              <label className="campo-rotulo" htmlFor="dinheiro-de">{t.visao.de}</label>
              <input id="dinheiro-de" type="month" className="entrada-texto sozinha" min={mesMin} max={fimMes} value={inicioMes} onChange={(e) => setInicioMes(e.target.value || mesMin)} />
            </div>
            <div className="campo">
              <label className="campo-rotulo" htmlFor="dinheiro-ate">{t.visao.ate}</label>
              <input id="dinheiro-ate" type="month" className="entrada-texto sozinha" min={inicioMes} max={mesMax} value={fimMes} onChange={(e) => setFimMes(e.target.value || mesMax)} />
            </div>
          </div>
        )}

        <div className="dinheiro-filtros">
          <div className="campo">
            <label className="campo-rotulo" htmlFor={idFiltro}>{t.visao.filtroGrupo}</label>
            <select id={idFiltro} className="entrada-texto sozinha" value={grupoId} onChange={(e) => setGrupoId(e.target.value)} disabled={soInteresse}>
              <option value="todos">{t.visao.todosGrupos}</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              <option value="">{t.visao.semGrupoOpcao}</option>
            </select>
          </div>
          <ToggleButton isSelected={soInteresse} onChange={setSoInteresse} className="etiqueta-alternar dinheiro-alternar">
            <Sparkles aria-hidden="true" size="1.1em" /> {t.visao.soInteresse}
          </ToggleButton>
        </div>
        {soInteresse && <p className="campo-ajuda">{t.visao.soInteresseAjuda}</p>}

        {tabela.total === 0 ? (
          <div className="dinheiro-vazio">
            <p><strong>{filtrando ? t.visao.semDadosFiltro : t.visao.semDados}</strong></p>
            {!filtrando && <p className="texto-suave">{t.visao.semDadosPasso}</p>}
          </div>
        ) : (
          <>
            <p className="dinheiro-como-ler" id={idComoLer}>{t.visao.comoLer}</p>
            <div className="dinheiro-tabela-rolagem" tabIndex={0} role="region" aria-label={t.visao.tabelaRotulo}>
              <table className="dinheiro-tabela" aria-describedby={idComoLer}>
                <thead>
                  <tr>
                    <th scope="col">{t.visao.grupoColuna}</th>
                    {meses.map((m) => (
                      <th key={m} scope="col"><abbr title={fmtMesLongo.format(dataDe(m))}>{mesCurto(m)}</abbr></th>
                    ))}
                    <th scope="col" className="dinheiro-tabela-total">{t.visao.totalLinha}</th>
                  </tr>
                </thead>
                <tbody>
                  {tabela.linhas.map((l) => (
                    <tr key={l.id || "sem"}>
                      <th scope="row">
                        <span className="dinheiro-tabela-grupo"><span className={`etiqueta-cor cor-${l.cor}`} aria-hidden="true" />{l.nome}</span>
                      </th>
                      {meses.map((m) => (
                        <td key={m} className={l.porMes[m] ? undefined : "dinheiro-tabela-vazia"}>{celula(l.porMes[m])}</td>
                      ))}
                      <td className="dinheiro-tabela-total">{formatarMoeda(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="dinheiro-tabela-soma">
                    <th scope="row">{t.visao.totalSaiu}</th>
                    {meses.map((m) => <td key={m}>{celula(tabela.totaisMes[m])}</td>)}
                    <td className="dinheiro-tabela-total">{formatarMoeda(tabela.total)}</td>
                  </tr>
                  {mostrarSobra && (
                    <>
                      <tr>
                        <th scope="row">{t.visao.entrouLinha}</th>
                        {meses.map((m) => <td key={m}>{celula(entrouMes[m])}</td>)}
                        <td className="dinheiro-tabela-total">{formatarMoeda(totalEntrou)}</td>
                      </tr>
                      <tr>
                        <th scope="row">{t.visao.sobrouLinha}</th>
                        {meses.map((m) => <td key={m}>{sobra(entrouMes[m] ?? 0, tabela.totaisMes[m] ?? 0)}</td>)}
                        <td className="dinheiro-tabela-total">{sobra(totalEntrou, tabela.total)}</td>
                      </tr>
                    </>
                  )}
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>

      {tabela.total > 0 && (
        <section className="cartao" aria-labelledby="dinheiro-graficos">
          <h2 id="dinheiro-graficos">{t.visao.graficosTitulo}</h2>
          <div className="graficos-lado-a-lado">
            <div>
              <h3 className="campo-rotulo">{t.visao.pizzaTitulo}</h3>
              <Pizza linhas={tabela.linhas} />
            </div>
            <div>
              <h3 className="campo-rotulo">{t.visao.barrasTitulo}</h3>
              <BarrasPorMes meses={meses} totaisMes={tabela.totaisMes} />
            </div>
            <div>
              <h3 className="campo-rotulo">{t.visao.linhaTitulo}</h3>
              <LinhaPorMes meses={meses} totaisMes={tabela.totaisMes} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
