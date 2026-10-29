import { CalendarDays } from "../icones";
import { useEffect, useState } from "react";
import { expandir, inicioDoDia, somarDias, type Ocorrencia } from "../agenda/datas";
import { api } from "../api";
import { useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { useContas } from "./Contas";
import { diasPesados, fraseAviso, negativosSeguidos, NEGATIVOS_PARA_AVISO, semanaEmSaldo } from "./semana";

const ts = textos.energia.semana;
const tp = textos.energia.pesados;
const tcam = textos.energia.camuflagem;

/** Os últimos 7 dias do "gasta e repõe", uma linha por dia, em palavras. Sem gráfico e sem vermelho. */
export function SemanaEmSaldo() {
  const [dados] = useContas();
  const hoje = new Date();
  const semana = semanaEmSaldo(dados, hoje);
  const seguidos = negativosSeguidos(semana);

  return (
    <section className="cartao energia-semana" aria-labelledby="energia-semana-titulo">
      <h2 id="energia-semana-titulo">{ts.titulo}</h2>
      <p className="campo-ajuda">{ts.explicacao}</p>
      {dados.atividades.length === 0 ? (
        <p className="texto-suave">{ts.semAtividades}</p>
      ) : (
        <ol className="lista-simples sem-marcador energia-semana-dias">
          {semana.map((d, i) => {
            const eHoje = i === semana.length - 1;
            const nomeDia = eHoje ? ts.hoje : ts.dias[new Date(`${d.dia}T00:00`).getDay()];
            const marca = d.camuflagem ? (tcam.marca[d.camuflagem] ?? "") : "";
            return (
              <li key={d.dia} className={`energia-semana-dia ${d.balanco}`}>
                <span className="energia-semana-nome">{nomeDia}</span>
                <span className="energia-semana-balanco">{ts.balanco[d.balanco]}</span>
                {marca && <span className="energia-semana-marca">{marca}</span>}
              </li>
            );
          })}
        </ol>
      )}
      {seguidos >= NEGATIVOS_PARA_AVISO && <p className="energia-semana-descanso">{ts.descanso(seguidos)}</p>}
    </section>
  );
}

/** Avisa, com neutralidade, de dias cheios na Agenda dos próximos 7 dias. Só lê; não cria nada. */
export function DiasPesados() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[] | null>(null);
  const mudancas = useMudancas();

  useEffect(() => {
    const de = inicioDoDia(new Date());
    const ate = somarDias(de, 7);
    api.listarEventos(de.getTime(), ate.getTime()).then(
      (es) => setOcorrencias(expandir(es, de, ate)),
      () => setOcorrencias([]),
    );
  }, [mudancas]);

  if (ocorrencias === null) return null;
  const hoje = new Date();
  const avisos = diasPesados(ocorrencias, hoje);

  return (
    <section className="cartao energia-pesados" aria-labelledby="energia-pesados-titulo">
      <h2 id="energia-pesados-titulo">
        <CalendarDays aria-hidden="true" size="1em" className="energia-titulo-icone" /> {tp.titulo}
      </h2>
      <p className="campo-ajuda">{tp.explicacao}</p>
      {avisos.length === 0 ? (
        <p className="texto-suave">{tp.nada}</p>
      ) : (
        <ul className="lista-simples sem-marcador energia-pesados-lista">
          {avisos.map((a) => (
            <li key={a.tipo === "dia" ? a.dia : a.dias[0].dia}>{fraseAviso(a, hoje)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
