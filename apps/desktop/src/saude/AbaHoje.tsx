import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { chaveDia, inicioDoDia, somarDias } from "../agenda/datas";
import { api, type AvisoSaude, type Profissional, type RegistroSaude } from "../api";
import { useMudancas } from "../dados";
import { CalendarDays, Heart, Pill } from "../icones";
import { textos } from "../textos/pt-BR";
import { diasAte, ordenarPorConsulta } from "../cuidado/consulta";
import { quandoConsulta } from "../cuidado/MarcarConsulta";
import { ItemRegistro } from "./ItemRegistro";
import { JanelaComoEstou } from "./RegistroRapido";
import { CartaoRemediosHoje } from "./RemediosHoje";
import type { AbaSaude } from "./Saude";

const t = textos.saude;

/** Aba "Hoje": remédios do dia, o registro rápido e o que já foi registrado hoje. */
export function AbaHoje({ aoIrPara }: { aoIrPara: (aba: AbaSaude) => void }) {
  const [comoEstou, setComoEstou] = useState(false);
  const [registros, setRegistros] = useState<RegistroSaude[]>([]);
  const [alertas, setAlertas] = useState<AvisoSaude[]>([]);
  const [proxima, setProxima] = useState<Profissional | null>(null);
  const mudancas = useMudancas();
  const hoje = chaveDia(new Date());

  useEffect(() => {
    const de = inicioDoDia(new Date());
    api.listarRegistrosSaude(de.getTime(), somarDias(de, 1).getTime()).then(
      (rs) => setRegistros([...rs].sort((a, b) => b.momento - a.momento)),
      () => {},
    );
    api.alertasSaude(hoje).then(setAlertas, () => {});
    api.listarProfissionais().then((ps) => {
      const futuras = ordenarPorConsulta(ps, hoje).filter((p) => (diasAte(hoje, p.proximaConsulta) ?? -1) >= 0);
      setProxima(futuras[0] ?? null);
    }, () => {});
  }, [hoje, mudancas]);

  return (
    <>
      <section className="cartao saude-cartao saude-como-estou" aria-labelledby="saude-como-estou">
        <h2 id="saude-como-estou" className="visualmente-oculto">{t.hoje.comoEstou}</h2>
        <Button className="botao principal saude-botao-grande" onPress={() => setComoEstou(true)}>
          <Heart aria-hidden="true" size="1.4em" /> {t.hoje.comoEstou}
        </Button>
        <p className="texto-suave">{t.hoje.comoEstouAjuda}</p>
      </section>

      <section className="cartao saude-cartao" aria-labelledby="remedios-hoje">
        <h2 id="remedios-hoje"><Pill aria-hidden="true" size="1em" /> {t.remediosHoje}</h2>
        <CartaoRemediosHoje />
        {alertas.length > 0 && (
          <div className="saude-nota-lateral">
            <p>{t.hoje.avisosRemedios(alertas.length)}</p>
            <Button className="botao" onPress={() => aoIrPara("remedios")}>{t.hoje.verAvisos}</Button>
          </div>
        )}
      </section>

      {proxima && (
        <section className="cartao saude-cartao" aria-labelledby="saude-proxima-consulta">
          <h2 id="saude-proxima-consulta"><CalendarDays aria-hidden="true" size="1em" /> {t.hoje.proximaConsultaTitulo}</h2>
          <p>
            <strong>{proxima.nome}</strong>
            {proxima.especialidade && <span className="texto-suave"> · {proxima.especialidade}</span>}
            <br />
            {quandoConsulta(hoje, proxima.proximaConsulta)}
          </p>
          <div className="botoes">
            <Button className="botao" onPress={() => aoIrPara("planos")}>{t.hoje.verConsultas}</Button>
          </div>
        </section>
      )}

      <section className="cartao saude-cartao" aria-labelledby="saude-registros-hoje">
        <h2 id="saude-registros-hoje">{t.hoje.registrosHoje}</h2>
        {registros.length === 0 ? (
          <p className="texto-suave">{t.hoje.semRegistrosHoje}</p>
        ) : (
          <ul className="lista-simples sem-marcador saude-registros">
            {registros.map((r) => <ItemRegistro key={r.id} registro={r} />)}
          </ul>
        )}
        {registros.length > 0 && (
          <div className="botoes">
            <Button className="botao" onPress={() => aoIrPara("historico")}>{t.hoje.verHistorico}</Button>
          </div>
        )}
      </section>

      <JanelaComoEstou aberta={comoEstou} aoFechar={() => setComoEstou(false)} />
    </>
  );
}
