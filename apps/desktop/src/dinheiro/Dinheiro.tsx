import { useEffect, useMemo, useState } from "react";
import { Button, Form, ToggleButton } from "react-aria-components";
import { api, type Conta, type Desejo, type Gasto, type Meta } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { Check, Pencil, Plus, Sparkles, Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { formatarMoeda, reaisParaCentavos } from "./moeda";
import { FormConta, novaConta } from "./FormConta";
import { FormMeta, novaMeta } from "./FormMeta";

const t = textos.dinheiro;
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}

/** Dias até o próximo vencimento no dia `dia` do mês (hoje conta como 0). */
function diasAteVencimento(dia: number): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth();
  const diaClamp = (a: number, m: number) => Math.min(dia, diasNoMes(a, m));
  let venc = new Date(ano, mes, diaClamp(ano, mes));
  if (venc < hoje) {
    mes += 1;
    if (mes > 11) { mes = 0; ano += 1; }
    venc = new Date(ano, mes, diaClamp(ano, mes));
  }
  return Math.round((venc.getTime() - hoje.getTime()) / 86_400_000);
}

export function PaginaDinheiro() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [desejos, setDesejos] = useState<Desejo[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [editandoConta, setEditandoConta] = useState<Conta | null>(null);
  const [excluindoConta, setExcluindoConta] = useState<Conta | null>(null);
  const [editandoMeta, setEditandoMeta] = useState<Meta | null>(null);
  const [excluindoMeta, setExcluindoMeta] = useState<Meta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  const [inicioMes, fimMes] = useMemo(() => {
    const agora = new Date();
    return [new Date(agora.getFullYear(), agora.getMonth(), 1).getTime(), new Date(agora.getFullYear(), agora.getMonth() + 1, 1).getTime()];
  }, []);

  useEffect(() => {
    api.listarGastos(inicioMes, fimMes).then(setGastos, (e) => setErro(e instanceof Error ? e.message : String(e)));
    api.listarContas().then(setContas, () => {});
    api.listarDesejos().then(setDesejos, () => {});
    api.listarMetas().then(setMetas, () => {});
  }, [mudancas, inicioMes, fimMes]);

  const totalMes = gastos.reduce((s, g) => s + g.centavos, 0);
  const totalInteresse = gastos.filter((g) => g.interesse).reduce((s, g) => s + g.centavos, 0);
  const contasOrdenadas = [...contas].sort((a, b) => diasAteVencimento(a.diaVencimento) - diasAteVencimento(b.diaVencimento));

  const excluirConta = async () => {
    if (!excluindoConta) return;
    await api.excluirConta(excluindoConta.id);
    setExcluindoConta(null);
    avisarMudanca();
  };
  const excluirMeta = async () => {
    if (!excluindoMeta) return;
    await api.excluirMeta(excluindoMeta.id);
    setExcluindoMeta(null);
    avisarMudanca();
  };

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <section className="cartao largura-leitura esticado" aria-labelledby="mes">
        <h2 id="mes">{t.mes.resumo}</h2>
        <p><strong>{t.mes.total(formatarMoeda(totalMes))}</strong></p>
        {totalInteresse > 0 && <p className="texto-suave">{t.mes.interesseTotal(formatarMoeda(totalInteresse))}</p>}
      </section>

      <section className="cartao largura-leitura esticado" aria-labelledby="contas">
        <h2 id="contas">{t.contas.titulo}</h2>
        <p className="texto-suave">{t.contas.intro}</p>
        {contasOrdenadas.length === 0 ? (
          <p className="texto-suave">{t.contas.semContas}</p>
        ) : (
          <ul className="lista-simples sem-marcador">
            {contasOrdenadas.map((c) => (
              <li key={c.id} className="linha-ajuste">
                <span className="quebra">
                  <strong>{c.nome}</strong> · {formatarMoeda(c.centavos)}
                  <br />
                  <span className="texto-suave">{t.contas.venceDia(c.diaVencimento)} · {t.contas.faltamDias(diasAteVencimento(c.diaVencimento))}</span>
                </span>
                <span className="linha-ajuste">
                  <Button className="botao-icone" onPress={() => setEditandoConta(c)} aria-label={`${t.contas.editar}: ${c.nome}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
                  <Button className="botao-icone" onPress={() => setExcluindoConta(c)} aria-label={`${t.contas.excluir}: ${c.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="botoes">
          <Button className="botao principal" onPress={() => setEditandoConta(novaConta())}><Plus aria-hidden="true" size="1.1em" /> {t.contas.adicionar}</Button>
        </div>
      </section>

      <RegistrarGasto gastos={gastos} />

      <ListaEspera desejos={desejos} />

      <section className="cartao largura-leitura esticado" aria-labelledby="metas">
        <h2 id="metas">{t.metas.titulo}</h2>
        <p className="texto-suave">{t.metas.intro}</p>
        {metas.length === 0 ? (
          <p className="texto-suave">{t.metas.semMetas}</p>
        ) : (
          <ul className="lista-simples sem-marcador">
            {metas.map((m) => {
              const pct = m.alvoCentavos > 0 ? Math.min(100, Math.round((m.guardadoCentavos / m.alvoCentavos) * 100)) : 0;
              return (
                <li key={m.id} className="linha-ajuste">
                  <span className="quebra">
                    <strong>{m.nome}</strong>
                    <br />
                    <span className="texto-suave">{t.metas.progresso(formatarMoeda(m.guardadoCentavos), formatarMoeda(m.alvoCentavos))} · {pct}%</span>
                    <span className="barra-progresso-trilho" aria-hidden="true"><span className="barra-progresso-preenchido" style={{ width: `${pct}%` }} /></span>
                  </span>
                  <span className="linha-ajuste">
                    <Button className="botao-icone" onPress={() => setEditandoMeta(m)} aria-label={`${t.metas.editar}: ${m.nome}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
                    <Button className="botao-icone" onPress={() => setExcluindoMeta(m)} aria-label={`${t.metas.excluir}: ${m.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="botoes">
          <Button className="botao principal" onPress={() => setEditandoMeta(novaMeta())}><Plus aria-hidden="true" size="1.1em" /> {t.metas.adicionar}</Button>
        </div>
      </section>

      <Aviso>{erro}</Aviso>

      <Janela titulo={editandoConta && editandoConta.id ? t.contas.editar : t.contas.novo} aberta={editandoConta !== null} aoFechar={() => setEditandoConta(null)}>
        {editandoConta && <FormConta key={editandoConta.id || "novo"} inicial={editandoConta} aoFechar={() => setEditandoConta(null)} />}
      </Janela>
      <Janela titulo={editandoMeta && editandoMeta.id ? t.metas.editar : t.metas.novo} aberta={editandoMeta !== null} aoFechar={() => setEditandoMeta(null)}>
        {editandoMeta && <FormMeta key={editandoMeta.id || "novo"} inicial={editandoMeta} aoFechar={() => setEditandoMeta(null)} />}
      </Janela>
      <Confirmar titulo={t.contas.excluir} texto={excluindoConta ? t.contas.confirmarExcluir(excluindoConta.nome) : ""} confirmar={t.contas.excluir} aberta={excluindoConta !== null} aoCancelar={() => setExcluindoConta(null)} aoConfirmar={() => void excluirConta()} />
      <Confirmar titulo={t.metas.excluir} texto={excluindoMeta ? t.metas.confirmarExcluir(excluindoMeta.nome) : ""} confirmar={t.metas.excluir} aberta={excluindoMeta !== null} aoCancelar={() => setExcluindoMeta(null)} aoConfirmar={() => void excluirMeta()} />
    </div>
  );
}

function RegistrarGasto({ gastos }: { gastos: Gasto[] }) {
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [interesse, setInteresse] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const recado = useRecado();

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const centavos = reaisParaCentavos(valor);
    if (centavos == null) {
      setErro(textos.dinheiro.valorInvalido);
      return;
    }
    try {
      await api.registrarGasto(centavos, categoria, descricao, interesse);
      setValor(""); setCategoria(""); setDescricao(""); setInteresse(false);
      avisarMudanca();
      recado(t.gasto.registrado);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  const apagar = async (id: string) => {
    await api.excluirGasto(id);
    avisarMudanca();
  };

  return (
    <section className="cartao largura-leitura esticado" aria-labelledby="gasto">
      <h2 id="gasto">{t.gasto.titulo}</h2>
      <Form className="formulario" onSubmit={registrar}>
        <Campo rotulo={t.gasto.valor} valor={valor} aoMudar={setValor} numerico semDitado />
        <Campo rotulo={t.gasto.categoria} valor={categoria} aoMudar={setCategoria} descricao={t.gasto.categoriaAjuda} maximo={40} semDitado />
        <Campo rotulo={t.gasto.descricao} valor={descricao} aoMudar={setDescricao} maximo={120} />
        <ToggleButton isSelected={interesse} onChange={setInteresse} className="etiqueta-alternar">
          <Sparkles aria-hidden="true" size="1.1em" /> {t.gasto.interesse}
        </ToggleButton>
        <p className="campo-ajuda">{t.gasto.interesseAjuda}</p>
        <Aviso>{erro}</Aviso>
        <div className="botoes">
          <Button className="botao principal" type="submit">{t.gasto.registrar}</Button>
        </div>
      </Form>
      {gastos.length > 0 && (
        <div className="campo">
          <span className="campo-rotulo">{t.gasto.recentes}</span>
          <ul className="lista-simples sem-marcador">
            {gastos.slice(0, 12).map((g) => (
              <li key={g.id} className="linha-ajuste">
                <span className="quebra">
                  <strong>{formatarMoeda(g.centavos)}</strong>
                  {g.categoria && <span className="texto-suave"> · {g.categoria}</span>}
                  {g.interesse && <span className="etiqueta-estado"> <Sparkles aria-hidden="true" size="0.9em" /></span>}
                  <span className="texto-suave"> · {fmtData.format(g.momento)}</span>
                  {g.descricao && <><br /><span>{g.descricao}</span></>}
                </span>
                <Button className="botao-icone" onPress={() => void apagar(g.id)} aria-label={t.gasto.excluir}><Trash2 aria-hidden="true" size="1.1em" /></Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ListaEspera({ desejos }: { desejos: Desejo[] }) {
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState<"24" | "48" | "72" | "168">("48");
  const [erro, setErro] = useState<string | null>(null);
  const agora = Date.now();

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setErro(null);
    try {
      await api.criarDesejo(nome, reaisParaCentavos(valor) ?? 0, Number(prazo));
      setNome(""); setValor("");
      avisarMudanca();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  const resolver = async (id: string) => { await api.resolverDesejo(id); avisarMudanca(); };
  const apagar = async (id: string) => { await api.excluirDesejo(id); avisarMudanca(); };

  return (
    <section className="cartao largura-leitura esticado" aria-labelledby="espera">
      <h2 id="espera">{t.espera.titulo}</h2>
      <p className="texto-suave">{t.espera.intro}</p>
      <Form className="formulario" onSubmit={adicionar}>
        <Campo rotulo={t.espera.oQue} valor={nome} aoMudar={setNome} maximo={120} semDitado />
        <Campo rotulo={t.espera.valor} valor={valor} aoMudar={setValor} numerico semDitado />
        <Segmentado
          rotulo={t.espera.prazo}
          valor={prazo}
          aoMudar={setPrazo}
          opcoes={[
            { valor: "24", nome: t.espera.prazos[24] },
            { valor: "48", nome: t.espera.prazos[48] },
            { valor: "72", nome: t.espera.prazos[72] },
            { valor: "168", nome: t.espera.prazos[168] },
          ]}
        />
        <Aviso>{erro}</Aviso>
        <div className="botoes">
          <Button className="botao principal" type="submit"><Plus aria-hidden="true" size="1.1em" /> {t.espera.adicionar}</Button>
        </div>
      </Form>
      {desejos.length === 0 ? (
        <p className="texto-suave">{t.espera.semDesejos}</p>
      ) : (
        <ul className="lista-simples sem-marcador">
          {desejos.map((d) => {
            const resolvido = d.estado !== "esperando";
            const podeDecidir = d.decidirEm <= agora;
            return (
              <li key={d.id} className={resolvido ? "linha-ajuste feito" : "linha-ajuste"}>
                <span className="quebra">
                  <strong>{d.nome}</strong>
                  {d.centavos > 0 && <span className="texto-suave"> · {formatarMoeda(d.centavos)}</span>}
                  <br />
                  <span className="texto-suave">
                    {resolvido ? t.espera.resolvido : podeDecidir ? t.espera.podeDecidir : t.espera.esperarAte(fmtData.format(d.decidirEm))}
                  </span>
                </span>
                <span className="linha-ajuste">
                  {!resolvido && (
                    <Button className="botao-icone" onPress={() => void resolver(d.id)} aria-label={t.espera.jaDecidi}><Check aria-hidden="true" size="1.1em" /></Button>
                  )}
                  <Button className="botao-icone" onPress={() => void apagar(d.id)} aria-label={t.espera.excluir}><Trash2 aria-hidden="true" size="1.1em" /></Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
