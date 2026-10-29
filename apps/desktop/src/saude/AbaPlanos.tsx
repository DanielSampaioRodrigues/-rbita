import { useEffect, useMemo, useState } from "react";
import { Button } from "react-aria-components";
import { chaveDia } from "../agenda/datas";
import { api, type Profissional } from "../api";
import { useMudancas } from "../dados";
import { CalendarDays, FileText, Plus } from "../icones";
import { textos } from "../textos/pt-BR";
import { diasAte, ordenarPorConsulta } from "../cuidado/consulta";
import { JanelaMarcarConsulta, quandoConsulta } from "../cuidado/MarcarConsulta";
import { ListaNotas } from "../cuidado/ListaNotas";
import { PlanosSaude } from "./PlanoDeCrise";
import { JanelaResumoConsulta } from "./ResumoConsulta";

const t = textos.saude;
const tc = textos.cuidado;

/** Aba "Planos e consultas": consultas marcadas, resumo para levar e os planos. */
export function AbaPlanos({ aoAbrirPlanoDeCrise }: { aoAbrirPlanoDeCrise: () => void }) {
  const [resumoAberto, setResumoAberto] = useState(false);

  return (
    <>
      <ConsultasSaude />

      <section className="cartao saude-cartao" aria-labelledby="saude-resumo">
        <h2 id="saude-resumo"><FileText aria-hidden="true" size="1em" /> {t.resumo.titulo}</h2>
        <p className="texto-suave">{t.resumo.intro}</p>
        <div className="botoes">
          <Button className="botao" onPress={() => setResumoAberto(true)}>{t.resumo.abrir}</Button>
        </div>
      </section>

      <section className="cartao saude-cartao" aria-labelledby="plano-crise">
        <h2 id="plano-crise">{t.plano.titulo}</h2>
        <p className="texto-suave">{t.plano.intro}</p>
        <PlanosSaude semIntro />
        <p className="campo-ajuda">
          {t.plano.atalho}{" "}
          <Button className="link" onPress={aoAbrirPlanoDeCrise}>{t.plano.abrirJanela}</Button>
        </p>
      </section>

      <JanelaResumoConsulta aberta={resumoAberto} aoFechar={() => setResumoAberto(false)} />
    </>
  );
}

/** As próximas consultas (dos profissionais da seção Cuidado) com o que perguntar. */
function ConsultasSaude() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [marcando, setMarcando] = useState(false);
  const [mudandoData, setMudandoData] = useState<Profissional | null>(null);
  const mudancas = useMudancas();
  const hoje = chaveDia(new Date());

  useEffect(() => {
    api.listarProfissionais().then(setProfissionais, () => {});
  }, [mudancas]);

  const proximas = useMemo(
    () => ordenarPorConsulta(profissionais, hoje).filter((p) => (diasAte(hoje, p.proximaConsulta) ?? -1) >= 0),
    [profissionais, hoje],
  );

  return (
    <section className="cartao saude-cartao" aria-labelledby="saude-consultas">
      <div className="linha-ajuste">
        <h2 id="saude-consultas"><CalendarDays aria-hidden="true" size="1em" /> {t.consultas.titulo}</h2>
        <Button className="botao principal" onPress={() => setMarcando(true)}>
          <Plus aria-hidden="true" size="1.1em" /> {t.consultas.marcar}
        </Button>
      </div>
      <p className="texto-suave">{t.consultas.intro}</p>

      {proximas.length === 0 ? (
        <p className="saude-vazio-linha">{t.consultas.vazio}</p>
      ) : (
        <ul className="lista-simples sem-marcador saude-consultas">
          {proximas.map((p) => (
            <li key={p.id} className="saude-consulta">
              <div className="linha-ajuste">
                <span className="quebra">
                  <strong>{p.nome}</strong>
                  {p.especialidade && <span className="texto-suave"> · {p.especialidade}</span>}
                  <br />
                  <span className="saude-consulta-quando">{quandoConsulta(hoje, p.proximaConsulta)}</span>
                </span>
                <Button className="botao" onPress={() => setMudandoData(p)} aria-label={`${t.consultas.mudarData}: ${p.nome}`}>
                  {t.consultas.mudarData}
                </Button>
              </div>
              <details className="saude-recolhivel">
                <summary>{t.consultas.oQuePerguntar}</summary>
                <ListaNotas
                  profissionalId={p.id}
                  tipo="pergunta"
                  rotulos={{ campo: tc.perguntas.campo, adicionar: tc.perguntas.adicionar, vazio: tc.perguntas.vazio, marcar: tc.perguntas.marcar, desmarcar: tc.perguntas.desmarcar, feitas: tc.perguntas.feitas }}
                />
              </details>
            </li>
          ))}
        </ul>
      )}

      <JanelaMarcarConsulta aberta={marcando} aoFechar={() => setMarcando(false)} profissionais={profissionais} />
      <JanelaMarcarConsulta aberta={mudandoData !== null} aoFechar={() => setMudandoData(null)} fixo={mudandoData} />
    </section>
  );
}
