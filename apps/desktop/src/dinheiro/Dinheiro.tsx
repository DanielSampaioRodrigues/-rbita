import { useEffect, useId, useMemo, useState } from "react";
import { Button, Form, ToggleButton } from "react-aria-components";
import { api, type Conta, type Desejo, type Gasto, type Grupo, type Meta } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { EscolherCor } from "../ideias/etiquetas";
import { Check, Pencil, Plus, Sparkles, Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { formatarMoeda, reaisParaCentavos } from "./moeda";
import { FormConta, novaConta } from "./FormConta";
import { FormMeta, novaMeta } from "./FormMeta";
import { Pizza, BarrasPorMes, LinhaPorMes } from "./Graficos";
import { filtrar, mesesEntre, mesesRecentes, tabelaPorMes } from "./visao";
import type { CorEtiqueta } from "../api";

const t = textos.dinheiro;
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const fmtMesCurto = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const nomeMes = (chave: string) => {
  const [a, m] = chave.split("-").map(Number);
  return fmtMesCurto.format(new Date(a, m - 1, 1)).replace(".", "");
};

function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}
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
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [desejos, setDesejos] = useState<Desejo[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [editandoConta, setEditandoConta] = useState<Conta | null>(null);
  const [excluindoConta, setExcluindoConta] = useState<Conta | null>(null);
  const [editandoMeta, setEditandoMeta] = useState<Meta | null>(null);
  const [excluindoMeta, setExcluindoMeta] = useState<Meta | null>(null);
  const [editandoGrupo, setEditandoGrupo] = useState<Grupo | null>(null);
  const [excluindoGrupo, setExcluindoGrupo] = useState<Grupo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  // Carrega até 12 meses de gastos (para a tabela e os gráficos).
  const [de12, ate] = useMemo(() => {
    const agora = new Date();
    return [new Date(agora.getFullYear(), agora.getMonth() - 11, 1).getTime(), new Date(agora.getFullYear(), agora.getMonth() + 1, 1).getTime()];
  }, []);

  useEffect(() => {
    api.listarGastos(de12, ate).then(setGastos, (e) => setErro(e instanceof Error ? e.message : String(e)));
    api.listarGruposGasto().then(setGrupos, () => {});
    api.listarContas().then(setContas, () => {});
    api.listarDesejos().then(setDesejos, () => {});
    api.listarMetas().then(setMetas, () => {});
  }, [mudancas, de12, ate]);

  const contasOrdenadas = [...contas].sort((a, b) => diasAteVencimento(a.diaVencimento) - diasAteVencimento(b.diaVencimento));

  const excluirConta = async () => { if (excluindoConta) { await api.excluirConta(excluindoConta.id); setExcluindoConta(null); avisarMudanca(); } };
  const excluirMeta = async () => { if (excluindoMeta) { await api.excluirMeta(excluindoMeta.id); setExcluindoMeta(null); avisarMudanca(); } };
  const excluirGrupo = async () => { if (excluindoGrupo) { await api.excluirGrupoGasto(excluindoGrupo.id); setExcluindoGrupo(null); avisarMudanca(); } };

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <VisaoGastos gastos={gastos} contas={contas} grupos={grupos} />

      <RegistrarGasto gastos={gastos} grupos={grupos} />

      <section className="cartao largura-leitura esticado" aria-labelledby="grupos">
        <h2 id="grupos">{t.grupos.titulo}</h2>
        <p className="texto-suave">{t.grupos.intro}</p>
        {grupos.length === 0 ? (
          <p className="texto-suave">{t.grupos.semGrupos}</p>
        ) : (
          <ul className="lista-simples sem-marcador">
            {grupos.map((g) => (
              <li key={g.id} className="linha-ajuste">
                <span className="etiqueta-chip">
                  <span className={`etiqueta-cor cor-${g.cor}`} aria-hidden="true" />
                  <strong>{g.nome}</strong>
                </span>
                <span className="linha-ajuste">
                  <Button className="botao-icone" onPress={() => setEditandoGrupo(g)} aria-label={`${t.grupos.editar}: ${g.nome}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
                  <Button className="botao-icone" onPress={() => setExcluindoGrupo(g)} aria-label={`${t.grupos.excluir}: ${g.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="botoes">
          <Button className="botao principal" onPress={() => setEditandoGrupo({ id: "", nome: "", cor: "mar", criadoEm: 0 })}><Plus aria-hidden="true" size="1.1em" /> {t.grupos.adicionar}</Button>
        </div>
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
        {editandoConta && <FormConta key={editandoConta.id || "novo"} inicial={editandoConta} grupos={grupos} aoFechar={() => setEditandoConta(null)} />}
      </Janela>
      <Janela titulo={editandoMeta && editandoMeta.id ? t.metas.editar : t.metas.novo} aberta={editandoMeta !== null} aoFechar={() => setEditandoMeta(null)}>
        {editandoMeta && <FormMeta key={editandoMeta.id || "novo"} inicial={editandoMeta} aoFechar={() => setEditandoMeta(null)} />}
      </Janela>
      <Janela titulo={editandoGrupo && editandoGrupo.id ? t.grupos.editar : t.grupos.novo} aberta={editandoGrupo !== null} aoFechar={() => setEditandoGrupo(null)}>
        {editandoGrupo && <FormGrupo key={editandoGrupo.id || "novo"} inicial={editandoGrupo} aoFechar={() => setEditandoGrupo(null)} />}
      </Janela>
      <Confirmar titulo={t.contas.excluir} texto={excluindoConta ? t.contas.confirmarExcluir(excluindoConta.nome) : ""} confirmar={t.contas.excluir} aberta={excluindoConta !== null} aoCancelar={() => setExcluindoConta(null)} aoConfirmar={() => void excluirConta()} />
      <Confirmar titulo={t.metas.excluir} texto={excluindoMeta ? t.metas.confirmarExcluir(excluindoMeta.nome) : ""} confirmar={t.metas.excluir} aberta={excluindoMeta !== null} aoCancelar={() => setExcluindoMeta(null)} aoConfirmar={() => void excluirMeta()} />
      <Confirmar titulo={t.grupos.excluir} texto={excluindoGrupo ? t.grupos.confirmarExcluir(excluindoGrupo.nome) : ""} confirmar={t.grupos.excluir} aberta={excluindoGrupo !== null} aoCancelar={() => setExcluindoGrupo(null)} aoConfirmar={() => void excluirGrupo()} />
    </div>
  );
}

const chaveMesDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function VisaoGastos({ gastos, contas, grupos }: { gastos: Gasto[]; contas: Conta[]; grupos: Grupo[] }) {
  const [periodo, setPeriodo] = useState<"3" | "6" | "12" | "custom">("6");
  const hoje = useMemo(() => new Date(), []);
  const mesMax = chaveMesDe(hoje);
  const mesMin = chaveMesDe(new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1));
  const [inicioMes, setInicioMes] = useState(() => chaveMesDe(new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)));
  const [fimMes, setFimMes] = useState(mesMax);
  const [grupoId, setGrupoId] = useState("todos");
  const [soInteresse, setSoInteresse] = useState(false);
  const idFiltro = useId();
  const meses = useMemo(
    () => (periodo === "custom" ? mesesEntre(inicioMes, fimMes) : mesesRecentes(new Date(), Number(periodo))),
    [periodo, inicioMes, fimMes],
  );
  const filtrados = useMemo(() => filtrar(gastos, contas, { grupoId, soInteresse }), [gastos, contas, grupoId, soInteresse]);
  const tabela = useMemo(() => tabelaPorMes(filtrados.gastos, filtrados.contas, grupos, meses), [filtrados, grupos, meses]);
  const filtrando = grupoId !== "todos" || soInteresse;

  return (
    <section className="cartao largura-leitura esticado" aria-labelledby="visao">
      <h2 id="visao">{t.visao.titulo}</h2>
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
        <ToggleButton isSelected={soInteresse} onChange={setSoInteresse} className="etiqueta-alternar">
          <Sparkles aria-hidden="true" size="1.1em" /> {t.visao.soInteresse}
        </ToggleButton>
      </div>
      {soInteresse && <p className="campo-ajuda">{t.visao.soInteresseAjuda}</p>}

      {tabela.total === 0 ? (
        <p className="texto-suave">{filtrando ? t.visao.semDadosFiltro : t.visao.semDados}</p>
      ) : (
        <>
          <div className="tabela-rolagem">
            <table className="tabela-dados" aria-label={t.visao.tabelaRotulo}>
              <thead>
                <tr>
                  <th scope="col">{t.visao.grupoColuna}</th>
                  {meses.map((m) => <th key={m} scope="col">{nomeMes(m)}</th>)}
                  <th scope="col">{t.visao.totalLinha}</th>
                </tr>
              </thead>
              <tbody>
                {tabela.linhas.map((l) => (
                  <tr key={l.id || "sem"}>
                    <th scope="row">
                      <span className="etiqueta-chip"><span className={`etiqueta-cor cor-${l.cor}`} aria-hidden="true" />{l.nome}</span>
                    </th>
                    {meses.map((m) => <td key={m}>{l.porMes[m] ? formatarMoeda(l.porMes[m]) : "—"}</td>)}
                    <td><strong>{formatarMoeda(l.total)}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{t.visao.totalLinha}</th>
                  {meses.map((m) => <td key={m}>{tabela.totaisMes[m] ? formatarMoeda(tabela.totaisMes[m]) : "—"}</td>)}
                  <td><strong>{formatarMoeda(tabela.total)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>

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
        </>
      )}
    </section>
  );
}

function RegistrarGasto({ gastos, grupos }: { gastos: Gasto[]; grupos: Grupo[] }) {
  const [valor, setValor] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [interesse, setInteresse] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idGrupo = useId();
  const recado = useRecado();
  const porGrupo = useMemo(() => new Map(grupos.map((g) => [g.id, g])), [grupos]);

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const centavos = reaisParaCentavos(valor);
    if (centavos == null) {
      setErro(textos.dinheiro.valorInvalido);
      return;
    }
    try {
      await api.registrarGasto(centavos, grupoId, descricao, interesse);
      setValor(""); setDescricao(""); setInteresse(false);
      avisarMudanca();
      recado(t.gasto.registrado);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  const apagar = async (id: string) => { await api.excluirGasto(id); avisarMudanca(); };
  const recentes = [...gastos].sort((a, b) => b.momento - a.momento).slice(0, 12);

  return (
    <section className="cartao largura-leitura esticado" aria-labelledby="gasto">
      <h2 id="gasto">{t.gasto.titulo}</h2>
      <Form className="formulario" onSubmit={registrar}>
        <Campo rotulo={t.gasto.valor} valor={valor} aoMudar={setValor} numerico semDitado />
        <div className="campo">
          <label className="campo-rotulo" htmlFor={idGrupo}>{t.gasto.grupo}</label>
          <select id={idGrupo} className="entrada-texto sozinha" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
            <option value="">{t.gasto.semGrupo}</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
          {grupos.length === 0 && <p className="campo-ajuda">{t.gasto.crieGrupoAntes}</p>}
        </div>
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
      {recentes.length > 0 && (
        <div className="campo">
          <span className="campo-rotulo">{t.gasto.recentes}</span>
          <ul className="lista-simples sem-marcador">
            {recentes.map((g) => {
              const grupo = porGrupo.get(g.grupoId);
              const nomeGrupo = grupo?.nome || g.categoria || t.gasto.semGrupo;
              return (
                <li key={g.id} className="linha-ajuste">
                  <span className="quebra">
                    <strong>{formatarMoeda(g.centavos)}</strong>
                    <span className="texto-suave"> · </span>
                    <span className="etiqueta-chip"><span className={`etiqueta-cor cor-${grupo?.cor ?? "cinza"}`} aria-hidden="true" />{nomeGrupo}</span>
                    {g.interesse && <span className="etiqueta-estado"> <Sparkles aria-hidden="true" size="0.9em" /></span>}
                    <span className="texto-suave"> · {fmtData.format(g.momento)}</span>
                    {g.descricao && <><br /><span>{g.descricao}</span></>}
                  </span>
                  <Button className="botao-icone" onPress={() => void apagar(g.id)} aria-label={t.gasto.excluir}><Trash2 aria-hidden="true" size="1.1em" /></Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function FormGrupo({ inicial, aoFechar }: { inicial: Grupo; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [cor, setCor] = useState<CorEtiqueta>((inicial.cor || "mar") as CorEtiqueta);
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarGrupoGasto({ ...inicial, nome, cor });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.grupos.nome} valor={nome} aoMudar={setNome} autoFocus maximo={40} semDitado />
      <EscolherCor valor={cor} aoMudar={setCor} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.grupos.salvarMudancas : t.grupos.salvar}</Button>
      </div>
    </Form>
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
                  {!resolvido && <Button className="botao-icone" onPress={() => void resolver(d.id)} aria-label={t.espera.jaDecidi}><Check aria-hidden="true" size="1.1em" /></Button>}
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
