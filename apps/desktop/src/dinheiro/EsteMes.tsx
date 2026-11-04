// Aba "Este mês": três números (entrou, saiu, sobrou), o botão de registrar e
// os gastos do mês, dia a dia. Dá para olhar meses anteriores com as setas.

import { useMemo, useState } from "react";
import { Button } from "react-aria-components";
import { api, type Conta, type Entrada, type Gasto, type Grupo } from "../api";
import { Confirmar } from "../componentes/Janela";
import { avisarMudanca } from "../dados";
import { Check, ChevronLeft, ChevronRight, Plus, Sparkles, Trash2 } from "../icones";
import { textos } from "../textos/pt-BR";
import { formatarMoeda } from "./moeda";
import { chaveDia, chaveMes, contasDoMes, contasPagasNoMes, gastosPorDia, mesVizinho, resumoDoMes } from "./visao";

const t = textos.dinheiro;
const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const fmtDia = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return maiuscula(fmtMes.format(new Date(a, m - 1, 1)));
}

function nomeDoDia(dia: string): string {
  const hoje = chaveDia(Date.now());
  const ontem = chaveDia(Date.now() - 86_400_000);
  if (dia === hoje) return t.mes.hoje;
  if (dia === ontem) return t.mes.ontem;
  const [a, m, d] = dia.split("-").map(Number);
  return maiuscula(fmtDia.format(new Date(a, m - 1, d)));
}

interface Props {
  gastos: Gasto[];
  entradas: Entrada[];
  contas: Conta[];
  grupos: Grupo[];
  /** O mês mais antigo carregado ("AAAA-MM"). */
  mesMinimo: string;
  aoRegistrarGasto: () => void;
  aoRegistrarEntrada: () => void;
  aoVerContas: () => void;
  /** Abre o registro de gasto já preenchido com a conta fixa. */
  aoPagarConta: (conta: Conta) => void;
}

export function EsteMes({ gastos, entradas, contas, grupos, mesMinimo, aoRegistrarGasto, aoRegistrarEntrada, aoVerContas, aoPagarConta }: Props) {
  const mesAtual = chaveMes(Date.now());
  const [mes, setMes] = useState(mesAtual);
  const [apagandoGasto, setApagandoGasto] = useState<Gasto | null>(null);
  const [apagandoEntrada, setApagandoEntrada] = useState<Entrada | null>(null);
  const porGrupo = useMemo(() => new Map(grupos.map((g) => [g.id, g])), [grupos]);

  const resumo = useMemo(() => resumoDoMes(gastos, contas, entradas, mes), [gastos, contas, entradas, mes]);
  const dias = useMemo(() => gastosPorDia(gastos, mes), [gastos, mes]);
  const entradasDoMes = useMemo(() => entradas.filter((e) => chaveMes(e.momento) === mes).sort((a, b) => b.momento - a.momento), [entradas, mes]);
  const contasMes = useMemo(() => contasDoMes(contas, mes), [contas, mes]);
  const pagas = useMemo(() => contasPagasNoMes(gastos, mes), [gastos, mes]);
  const faltou = resumo.sobra < 0;

  const nomeGasto = (g: Gasto) => g.descricao || porGrupo.get(g.grupoId)?.nome || g.categoria || t.gasto.semDescricao;

  const apagarGasto = async () => {
    if (!apagandoGasto) return;
    await api.excluirGasto(apagandoGasto.id);
    setApagandoGasto(null);
    avisarMudanca();
  };
  const apagarEntrada = async () => {
    if (!apagandoEntrada) return;
    await api.excluirEntrada(apagandoEntrada.id);
    setApagandoEntrada(null);
    avisarMudanca();
  };

  return (
    <div className="dinheiro-aba">
      <div className="dinheiro-mes-nav">
        <Button className="botao-icone" onPress={() => setMes(mesVizinho(mes, -1))} isDisabled={mes <= mesMinimo} aria-label={t.mes.anterior}>
          <ChevronLeft aria-hidden="true" size="1.2em" />
        </Button>
        <h2 aria-live="polite">{nomeDoMes(mes)}</h2>
        <Button className="botao-icone" onPress={() => setMes(mesVizinho(mes, 1))} isDisabled={mes >= mesAtual} aria-label={t.mes.seguinte}>
          <ChevronRight aria-hidden="true" size="1.2em" />
        </Button>
      </div>
      {mes !== mesAtual && (
        <Button className="botao dinheiro-botao-leve dinheiro-voltar" onPress={() => setMes(mesAtual)}>{t.mes.voltarHoje}</Button>
      )}

      <dl className="dinheiro-resumo" aria-label={t.mes.resumoRotulo}>
        <div className="dinheiro-numero">
          <dt>{t.mes.entrou}</dt>
          <dd className="dinheiro-numero-valor">{formatarMoeda(resumo.entrou)}</dd>
          <dd className="dinheiro-numero-ajuda">{resumo.entrou === 0 ? t.mes.semEntradaAjuda : t.mes.entrouAjuda}</dd>
        </div>
        <div className="dinheiro-numero">
          <dt>{t.mes.saiu}</dt>
          <dd className="dinheiro-numero-valor">{formatarMoeda(resumo.saiu)}</dd>
          <dd className="dinheiro-numero-ajuda">{t.mes.saiuDetalhe(formatarMoeda(resumo.gastos), formatarMoeda(resumo.contas))}</dd>
        </div>
        <div className="dinheiro-numero dinheiro-numero-sobra">
          <dt>{faltou ? t.mes.faltou : t.mes.sobrou}</dt>
          <dd className="dinheiro-numero-valor">{formatarMoeda(Math.abs(resumo.sobra))}</dd>
          <dd className="dinheiro-numero-ajuda">{faltou ? t.mes.faltouAjuda : t.mes.sobrouAjuda}</dd>
        </div>
      </dl>

      <div className="dinheiro-acoes">
        <Button className="botao principal dinheiro-registrar" onPress={aoRegistrarGasto}>
          <Plus aria-hidden="true" size="1.2em" /> {t.mes.registrarGasto}
        </Button>
        <Button className="botao dinheiro-registrar-entrada" onPress={aoRegistrarEntrada}>
          <Plus aria-hidden="true" size="1.1em" /> {t.mes.registrarEntrada}
        </Button>
      </div>

      <section className="cartao" aria-labelledby="dinheiro-gastos-mes">
        <h2 id="dinheiro-gastos-mes">{t.mes.gastosTitulo}</h2>
        {dias.length === 0 ? (
          <div className="dinheiro-vazio">
            <p><strong>{t.mes.semGastos}</strong></p>
            <p className="texto-suave">{t.mes.semGastosPasso}</p>
          </div>
        ) : (
          <ol className="dinheiro-dias">
            {dias.map((d) => (
              <li key={d.dia}>
                <div className="dinheiro-dia-cabeca">
                  <h3>{nomeDoDia(d.dia)}</h3>
                  <span className="texto-suave">{t.mes.totalDia(formatarMoeda(d.total))}</span>
                </div>
                <ul className="dinheiro-lista">
                  {d.gastos.map((g) => {
                    const grupo = porGrupo.get(g.grupoId);
                    const nomeGrupo = grupo?.nome || g.categoria || t.gasto.semGrupo;
                    return (
                      <li key={g.id} className="dinheiro-linha">
                        <span className={`etiqueta-cor grande cor-${grupo?.cor ?? "cinza"}`} aria-hidden="true" />
                        <span className="dinheiro-linha-texto">
                          <span>{nomeGasto(g)}</span>
                          <span className="dinheiro-linha-detalhe">
                            {nomeGrupo}
                            {g.interesse && <> · <Sparkles aria-hidden="true" size="0.9em" /> {t.mes.interesse}</>}
                          </span>
                          {g.nota && <span className="dinheiro-linha-detalhe">{g.nota}</span>}
                        </span>
                        <span className="dinheiro-linha-valor">{formatarMoeda(g.centavos)}</span>
                        <Button className="botao-icone" onPress={() => setApagandoGasto(g)} aria-label={`${t.gasto.excluir}: ${nomeGasto(g)}`}>
                          <Trash2 aria-hidden="true" size="1.1em" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>

      {contasMes.length > 0 && (
        <section className="cartao" aria-labelledby="dinheiro-contas-mes">
          <h2 id="dinheiro-contas-mes">{t.mes.contasTitulo}</h2>
          <p className="texto-suave dinheiro-nota-contas">{t.mes.contasAjuda}</p>
          <ul className="dinheiro-lista">
            {contasMes.map((c) => {
              const paga = pagas.has(c.id);
              return (
                <li key={c.id} className="dinheiro-linha">
                  <span className={`etiqueta-cor grande cor-${porGrupo.get(c.grupoId)?.cor ?? "cinza"}`} aria-hidden="true" />
                  <span className="dinheiro-linha-texto">
                    <span>{c.nome}</span>
                    {paga && <span className="dinheiro-linha-detalhe"><Check aria-hidden="true" size="0.9em" /> {t.mes.contaPaga}</span>}
                  </span>
                  <span className="dinheiro-linha-valor">{formatarMoeda(c.centavos)}</span>
                  {paga ? <span aria-hidden="true" /> : (
                    <Button className="botao dinheiro-botao-leve" onPress={() => aoPagarConta(c)} aria-label={t.mes.registrarPagamentoDe(c.nome)}>
                      {t.mes.registrarPagamento}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="dinheiro-nota-contas">
            <Button className="link" onPress={aoVerContas}>{t.mes.verContas}</Button>
          </p>
        </section>
      )}

      <section className="cartao" aria-labelledby="dinheiro-entradas-mes">
        <h2 id="dinheiro-entradas-mes">{t.mes.entradasTitulo}</h2>
        {entradasDoMes.length === 0 ? (
          <div className="dinheiro-vazio">
            <p><strong>{t.mes.semEntradas}</strong></p>
            <p className="texto-suave">{t.mes.semEntradaAjuda}</p>
          </div>
        ) : (
          <ul className="dinheiro-lista">
            {entradasDoMes.map((e) => (
              <li key={e.id} className="dinheiro-linha">
                <span className="etiqueta-cor grande cor-musgo" aria-hidden="true" />
                <span className="dinheiro-linha-texto">
                  <span>{e.descricao || t.entrada.semDescricao}</span>
                  <span className="dinheiro-linha-detalhe">{nomeDoDia(chaveDia(e.momento))}</span>
                </span>
                <span className="dinheiro-linha-valor">{formatarMoeda(e.centavos)}</span>
                <Button className="botao-icone" onPress={() => setApagandoEntrada(e)} aria-label={`${t.entrada.excluir}: ${e.descricao || t.entrada.semDescricao}`}>
                  <Trash2 aria-hidden="true" size="1.1em" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Confirmar
        titulo={t.gasto.excluir}
        texto={apagandoGasto ? t.gasto.confirmarExcluir(nomeGasto(apagandoGasto)) : ""}
        confirmar={t.gasto.excluir}
        aberta={apagandoGasto !== null}
        aoCancelar={() => setApagandoGasto(null)}
        aoConfirmar={() => void apagarGasto()}
      />
      <Confirmar
        titulo={t.entrada.excluir}
        texto={apagandoEntrada ? t.entrada.confirmarExcluir(apagandoEntrada.descricao || t.entrada.semDescricao) : ""}
        confirmar={t.entrada.excluir}
        aberta={apagandoEntrada !== null}
        aoCancelar={() => setApagandoEntrada(null)}
        aoConfirmar={() => void apagarEntrada()}
      />
    </div>
  );
}
