import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { chaveDia } from "../agenda/datas";
import { api, type AvisoSaude, type DoseDoDia, type Remedio } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { avisarMudanca, useMudancas } from "../dados";
import { Check, Heart, Pencil, Pause, Play, Plus, Trash2, TriangleAlert } from "../icones";
import { textos } from "../textos/pt-BR";
import { FormRemedio, novoRemedio } from "./FormRemedio";

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
    avisarMudanca();
    recado(tomada ? t.tomadaConfirmada(d.nome) : t.tomadaDesfeita(d.nome));
  };

  if (doses.length === 0) return <p className="texto-suave">{t.semRemediosHoje}</p>;

  return (
    <ul className="lista-simples sem-marcador">
      {doses.map((d) => (
        <li key={`${d.remedioId}|${d.horario}`} className={d.tomada ? "linha-ajuste feito" : "linha-ajuste"}>
          <span className="quebra">
            <strong>{d.nome}</strong>
            {" "}
            <span className="texto-suave">{t.doseTexto(d.dose, [d.horario])}</span>
          </span>
          {d.tomada ? (
            <span className="linha-ajuste">
              <span className="etiqueta-estado ok">
                <Check aria-hidden="true" size="1em" /> {t.tomada}
              </span>
              <Button className="link" onPress={() => void marcar(d, false)}>{t.desfazer}</Button>
            </span>
          ) : (
            <Button className="botao principal" onPress={() => void marcar(d, true)}>
              <Check aria-hidden="true" size="1.1em" /> {t.tomei}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function PaginaSaude() {
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
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <section className="cartao largura-leitura esticado" aria-labelledby="remedios-hoje">
        <h2 id="remedios-hoje">{t.remediosHoje}</h2>
        <CartaoRemediosHoje />
      </section>

      {alertas.length > 0 && (
        <section className="cartao largura-leitura esticado" aria-labelledby="avisos-saude">
          <h2 id="avisos-saude">
            <TriangleAlert aria-hidden="true" size="1em" /> {t.alertas}
          </h2>
          <ul className="lista-simples sem-marcador">
            {alertas.map((a, i) => (
              <li key={`${a.remedioId}|${a.tipo}|${i}`}>
                {a.tipo === "estoque" ? t.alertaEstoque(a.nome, a.quanto) : t.alertaReceita(a.nome, a.quanto)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="cartao largura-leitura esticado" aria-labelledby="seus-remedios">
        <h2 id="seus-remedios">{t.seusRemedios}</h2>
        {remedios.length === 0 ? (
          <p className="texto-suave">{t.semRemedios}</p>
        ) : (
          <ul className="lista-simples sem-marcador">
            {remedios.map((r) => (
              <li key={r.id} className={r.estado === "pausado" ? "linha-ajuste esmaecido" : "linha-ajuste"}>
                <span className="quebra">
                  <strong>{r.nome}</strong>
                  {r.estado === "pausado" && <span className="etiqueta-estado"> {t.pausado}</span>}
                  <br />
                  <span className="texto-suave">{t.doseTexto(r.dose, r.horarios)}</span>
                  {r.estoque !== null && <span className="texto-suave"> · {t.estoqueRestante(r.estoque)}</span>}
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
              </li>
            ))}
          </ul>
        )}
        <div className="botoes">
          <Button className="botao principal" onPress={() => setEditando(novoRemedio())}>
            <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
          </Button>
        </div>
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
    </div>
  );
}

/** Ícone da seção (usado na barra lateral). */
export const IconeSaude = Heart;
