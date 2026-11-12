import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { chaveDia } from "../agenda/datas";
import { api, type DoseDoDia } from "../api";
import { useRecado } from "../app/Recado";
import { avisarMudanca, useMudancas } from "../dados";
import { acompanharBasico } from "../energia/remedios";
import { Check } from "../icones";
import { textos } from "../textos/pt-BR";

const t = textos.saude;

/** Cartão das doses do dia, com confirmar e desfazer. Reaproveitável em outras telas. */
export function CartaoRemediosHoje() {
  const [doses, setDoses] = useState<DoseDoDia[]>([]);
  const mudancas = useMudancas();
  const recado = useRecado();
  const hoje = chaveDia(new Date());

  useEffect(() => {
    api.dosesDoDia(hoje).then(setDoses, () => {});
  }, [hoje, mudancas]);

  const marcar = async (d: DoseDoDia, tomada: boolean) => {
    await api.marcarDose(d.remedioId, d.horario, hoje, tomada);
    await acompanharBasico(hoje, doses.map((x) => (x.remedioId === d.remedioId && x.horario === d.horario ? { ...x, tomada } : x))).catch(() => {});
    avisarMudanca();
    recado(tomada ? t.tomadaConfirmada(d.nome) : t.tomadaDesfeita(d.nome));
  };

  if (doses.length === 0) return <p className="texto-suave">{t.semRemediosHoje}</p>;

  return (
    <ul className="lista-simples sem-marcador saude-doses">
      {doses.map((d) => (
        <li key={`${d.remedioId}|${d.horario}`} className={d.tomada ? "linha-ajuste feito" : "linha-ajuste"}>
          <span className="quebra">
            {d.horario && <span className="saude-hora">{d.horario}</span>}
            <strong>{d.nome}</strong>
            {d.dose && <span className="texto-suave"> · {d.dose}</span>}
          </span>
          {d.tomada ? (
            <span className="linha-ajuste">
              <span className="etiqueta-estado ok">
                <Check aria-hidden="true" size="1em" /> {t.tomada}
              </span>
              <Button className="botao" onPress={() => void marcar(d, false)} aria-label={`${t.desfazer}: ${d.nome}`}>{t.desfazer}</Button>
            </span>
          ) : (
            <Button className="botao principal" onPress={() => void marcar(d, true)} aria-label={`${t.tomei}: ${d.nome}${d.horario ? ` (${d.horario})` : ""}`}>
              <Check aria-hidden="true" size="1.1em" /> {t.tomei}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

