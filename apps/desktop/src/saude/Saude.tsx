import { useEffect, useState, type ReactNode } from "react";
import { Button, Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { chaveDia } from "../agenda/datas";
import { api, type AvisoSaude, type Remedio } from "../api";
import { Aviso } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { avisarMudanca, useMudancas } from "../dados";
import { BatteryMedium, CalendarDays, Heart, ListChecks, Pencil, Pause, Pill, Play, Plus, Quote, Sun, Trash2 } from "../icones";
import { textos } from "../textos/pt-BR";
import { FormRemedio, novoRemedio } from "./FormRemedio";
import { AbaHoje } from "./AbaHoje";
import { AbaHistorico } from "./HistoricoSaude";
import { AbaPlanos } from "./AbaPlanos";

const t = textos.saude;
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });

export type AbaSaude = "hoje" | "remedios" | "energia" | "profissionais" | "historico" | "planos";
const ABAS: AbaSaude[] = ["hoje", "remedios", "energia", "profissionais", "historico", "planos"];
const CHAVE_ABA = "orbita.saude.aba";

function lerAba(): AbaSaude {
  try {
    const v = localStorage.getItem(CHAVE_ABA);
    return ABAS.includes(v as AbaSaude) ? (v as AbaSaude) : "hoje";
  } catch {
    return "hoje";
  }
}

export { CartaoRemediosHoje } from "./RemediosHoje";

export function PaginaSaude({ aoAbrirPlanoDeCrise, abaPedida, energia, profissionais }: {
  aoAbrirPlanoDeCrise: () => void;
  /** Abrir direto numa aba (quem veio de "Energia" ou de "Cuidado"). */
  abaPedida?: AbaSaude;
  /** As telas de Energia e de Cuidado, que agora moram aqui dentro. */
  energia: ReactNode; profissionais: ReactNode;
}) {
  const [aba, setAbaEstado] = useState<AbaSaude>(() => abaPedida ?? lerAba());

  const setAba = (a: AbaSaude) => {
    setAbaEstado(a);
    try {
      localStorage.setItem(CHAVE_ABA, a);
    } catch {
      // Sem armazenamento: só não lembra a aba na próxima vez.
    }
  };

  return (
    <div className="pagina saude-pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <Tabs className="saude-tabs" selectedKey={aba} onSelectionChange={(k) => setAba(k as AbaSaude)}>
        <TabList className="saude-abas" aria-label={t.abas.rotulo}>
          <Tab id="hoje" className="saude-aba"><Sun aria-hidden="true" size="1.1em" /> {t.abas.hoje}</Tab>
          <Tab id="remedios" className="saude-aba"><Pill aria-hidden="true" size="1.1em" /> {t.abas.remedios}</Tab>
          <Tab id="energia" className="saude-aba"><BatteryMedium aria-hidden="true" size="1.1em" /> {t.abas.energia}</Tab>
          <Tab id="profissionais" className="saude-aba"><Quote aria-hidden="true" size="1.1em" /> {t.abas.profissionais}</Tab>
          <Tab id="historico" className="saude-aba"><ListChecks aria-hidden="true" size="1.1em" /> {t.abas.historico}</Tab>
          <Tab id="planos" className="saude-aba"><CalendarDays aria-hidden="true" size="1.1em" /> {t.abas.planos}</Tab>
        </TabList>
        <TabPanel id="hoje" className="saude-painel">
          <AbaHoje aoIrPara={setAba} />
        </TabPanel>
        <TabPanel id="remedios" className="saude-painel">
          <AbaRemedios />
        </TabPanel>
        <TabPanel id="energia" className="saude-painel saude-embutida">{energia}</TabPanel>
        <TabPanel id="profissionais" className="saude-painel saude-embutida">{profissionais}</TabPanel>
        <TabPanel id="historico" className="saude-painel">
          <AbaHistorico />
        </TabPanel>
        <TabPanel id="planos" className="saude-painel">
          <AbaPlanos aoAbrirPlanoDeCrise={aoAbrirPlanoDeCrise} />
        </TabPanel>
      </Tabs>
    </div>
  );
}

/** Aba "Remédios": a lista, o estoque, a receita e os avisos calmos. */
function AbaRemedios() {
  const [remedios, setRemedios] = useState<Remedio[]>([]);
  const [alertas, setAlertas] = useState<AvisoSaude[]>([]);
  const [editando, setEditando] = useState<Remedio | null>(null);
  const [excluindo, setExcluindo] = useState<Remedio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();
  const hoje = chaveDia(new Date());

  useEffect(() => {
    api.listarRemedios().then(setRemedios, (e) => setErro(e instanceof Error ? e.message : String(e)));
    api.alertasSaude(hoje).then(setAlertas, () => {});
  }, [hoje, mudancas]);

  const pausar = async (r: Remedio, pausado: boolean) => {
    await api.pausarRemedio(r.id, pausado);
    avisarMudanca();
  };

  const excluir = async () => {
    if (!excluindo) return;
    await api.excluirRemedio(excluindo.id);
    setExcluindo(null);
    avisarMudanca();
  };

  return (
    <>
      {alertas.length > 0 && (
        <section className="cartao saude-cartao saude-avisos" aria-labelledby="avisos-saude">
          <h2 id="avisos-saude">{t.alertas}</h2>
          <ul className="lista-simples sem-marcador">
            {alertas.map((a, i) => (
              <li key={`${a.remedioId}|${a.tipo}|${i}`}>
                {a.tipo === "estoque" ? t.alertaEstoque(a.nome, a.quanto) : t.alertaReceita(a.nome, a.quanto)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="cartao saude-cartao" aria-labelledby="seus-remedios">
        <div className="linha-ajuste">
          <h2 id="seus-remedios">{t.seusRemedios}</h2>
          <Button className="botao principal" onPress={() => setEditando(novoRemedio())}>
            <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
          </Button>
        </div>
        {remedios.length === 0 ? (
          <div className="saude-vazio">
            <Pill aria-hidden="true" size="1.6em" />
            <p>{t.semRemedios}</p>
            <p className="texto-suave">{t.semRemediosAjuda}</p>
          </div>
        ) : (
          <ul className="lista-simples sem-marcador saude-remedios">
            {remedios.map((r) => (
              <li key={r.id} className={r.estado === "pausado" ? "saude-remedio esmaecido" : "saude-remedio"}>
                <div className="linha-ajuste">
                  <span className="quebra">
                    <strong>{r.nome}</strong>
                    {r.estado === "pausado" && <span className="etiqueta-estado peso">{t.pausado}</span>}
                  </span>
                  <span className="linha-ajuste">
                    <Button className="botao-icone" onPress={() => setEditando(r)} aria-label={`${t.editar}: ${r.nome}`}>
                      <Pencil aria-hidden="true" size="1.1em" />
                    </Button>
                    <Button
                      className="botao-icone"
                      onPress={() => void pausar(r, r.estado !== "pausado")}
                      aria-label={`${r.estado === "pausado" ? t.retomar : t.pausar}: ${r.nome}`}
                    >
                      {r.estado === "pausado" ? <Play aria-hidden="true" size="1.1em" /> : <Pause aria-hidden="true" size="1.1em" />}
                    </Button>
                    <Button className="botao-icone" onPress={() => setExcluindo(r)} aria-label={`${t.excluir}: ${r.nome}`}>
                      <Trash2 aria-hidden="true" size="1.1em" />
                    </Button>
                  </span>
                </div>
                <dl className="saude-ficha">
                  <div><dt>{t.ficha.dose}</dt><dd>{r.dose || "—"}</dd></div>
                  <div><dt>{t.ficha.horarios}</dt><dd>{r.horarios.length ? r.horarios.join(", ") : t.ficha.semHorario}</dd></div>
                  <div><dt>{t.ficha.estoque}</dt><dd>{r.estoque !== null ? t.estoqueRestante(r.estoque) : t.semEstoque}</dd></div>
                  <div><dt>{t.ficha.receita}</dt><dd>{r.receita ? fmtData.format(new Date(`${r.receita}T00:00:00`)) : t.ficha.semReceita}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Aviso>{erro}</Aviso>

      <Janela
        titulo={editando && editando.id ? t.form.editarTitulo : t.form.novo}
        aberta={editando !== null}
        aoFechar={() => setEditando(null)}
      >
        {editando && (
          <FormRemedio key={editando.id || "novo"} inicial={editando} aoFechar={() => setEditando(null)} />
        )}
      </Janela>

      <Confirmar
        titulo={t.excluir}
        texto={excluindo ? t.confirmarExcluir(excluindo.nome) : ""}
        confirmar={t.excluir}
        aberta={excluindo !== null}
        aoCancelar={() => setExcluindo(null)}
        aoConfirmar={() => void excluir()}
      />
    </>
  );
}

/** Ícone da seção (usado na barra lateral). */
export const IconeSaude = Heart;
