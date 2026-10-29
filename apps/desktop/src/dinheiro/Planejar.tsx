// Aba "Planejar": contas fixas, metas de reserva, lista de espera e os grupos.

import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type Conta, type Desejo, type Grupo, type Meta } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { avisarMudanca } from "../dados";
import { Check, Pencil, Plus, Trash2 } from "../icones";
import { textos } from "../textos/pt-BR";
import { FormConta, novaConta } from "./FormConta";
import { FormGrupo, proximaCor } from "./FormGrupo";
import { FormMeta, novaMeta } from "./FormMeta";
import { formatarMoeda, reaisParaCentavos } from "./moeda";

const t = textos.dinheiro;
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

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

interface Props {
  grupos: Grupo[];
  contas: Conta[];
  desejos: Desejo[];
  metas: Meta[];
}

export function Planejar({ grupos, contas, desejos, metas }: Props) {
  const [editandoConta, setEditandoConta] = useState<Conta | null>(null);
  const [excluindoConta, setExcluindoConta] = useState<Conta | null>(null);
  const [editandoMeta, setEditandoMeta] = useState<Meta | null>(null);
  const [excluindoMeta, setExcluindoMeta] = useState<Meta | null>(null);
  const [editandoGrupo, setEditandoGrupo] = useState<Grupo | null>(null);
  const [excluindoGrupo, setExcluindoGrupo] = useState<Grupo | null>(null);

  const contasOrdenadas = [...contas].sort((a, b) => diasAteVencimento(a.diaVencimento) - diasAteVencimento(b.diaVencimento));
  const totalContas = contas.reduce((s, c) => s + c.centavos, 0);
  const porGrupo = new Map(grupos.map((g) => [g.id, g]));

  const excluirConta = async () => { if (excluindoConta) { await api.excluirConta(excluindoConta.id); setExcluindoConta(null); avisarMudanca(); } };
  const excluirMeta = async () => { if (excluindoMeta) { await api.excluirMeta(excluindoMeta.id); setExcluindoMeta(null); avisarMudanca(); } };
  const excluirGrupo = async () => { if (excluindoGrupo) { await api.excluirGrupoGasto(excluindoGrupo.id); setExcluindoGrupo(null); avisarMudanca(); } };

  const criarSugeridos = async () => {
    const criados: Grupo[] = [];
    for (const nome of t.grupos.sugeridos) {
      criados.push(await api.salvarGrupoGasto({ id: "", nome, cor: proximaCor(criados), criadoEm: 0 }));
    }
    avisarMudanca();
  };

  return (
    <div className="dinheiro-aba">
      <p className="texto-suave">{t.planejar.intro}</p>

      <section className="cartao" aria-labelledby="dinheiro-contas">
        <h2 id="dinheiro-contas">{t.contas.titulo}</h2>
        <p className="texto-suave">{t.contas.intro}</p>
        {contasOrdenadas.length === 0 ? (
          <div className="dinheiro-vazio"><p>{t.contas.semContas}</p></div>
        ) : (
          <>
            <ul className="dinheiro-lista">
              {contasOrdenadas.map((c) => {
                const grupo = porGrupo.get(c.grupoId);
                return (
                  <li key={c.id} className="dinheiro-linha">
                    <span className={`etiqueta-cor grande cor-${grupo?.cor ?? "cinza"}`} aria-hidden="true" />
                    <span className="dinheiro-linha-texto">
                      <span>{c.nome}</span>
                      <span className="dinheiro-linha-detalhe">{t.contas.venceDia(c.diaVencimento)} · {t.contas.faltamDias(diasAteVencimento(c.diaVencimento))}{grupo ? ` · ${grupo.nome}` : ""}</span>
                    </span>
                    <span className="dinheiro-linha-valor">{formatarMoeda(c.centavos)}</span>
                    <span className="dinheiro-linha-botoes">
                      <Button className="botao-icone" onPress={() => setEditandoConta(c)} aria-label={`${t.contas.editar}: ${c.nome}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
                      <Button className="botao-icone" onPress={() => setExcluindoConta(c)} aria-label={`${t.contas.excluir}: ${c.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="texto-suave">{t.contas.totalMes(formatarMoeda(totalContas))}</p>
          </>
        )}
        <div className="botoes">
          <Button className="botao principal" onPress={() => setEditandoConta(novaConta())}><Plus aria-hidden="true" size="1.1em" /> {t.contas.adicionar}</Button>
        </div>
      </section>

      <section className="cartao" aria-labelledby="dinheiro-metas">
        <h2 id="dinheiro-metas">{t.metas.titulo}</h2>
        <p className="texto-suave">{t.metas.intro}</p>
        {metas.length === 0 ? (
          <div className="dinheiro-vazio"><p>{t.metas.semMetas}</p></div>
        ) : (
          <ul className="dinheiro-lista">
            {metas.map((m) => {
              const pct = m.alvoCentavos > 0 ? Math.min(100, Math.round((m.guardadoCentavos / m.alvoCentavos) * 100)) : 0;
              return (
                <li key={m.id} className="dinheiro-linha dinheiro-linha-meta">
                  <span className="dinheiro-linha-texto">
                    <span>{m.nome}</span>
                    <span className="dinheiro-linha-detalhe">{t.metas.progresso(formatarMoeda(m.guardadoCentavos), formatarMoeda(m.alvoCentavos))} · {pct}%</span>
                    <span className="barra-progresso-trilho" aria-hidden="true"><span className="barra-progresso-preenchido" style={{ width: `${pct}%` }} /></span>
                  </span>
                  <span className="dinheiro-linha-botoes">
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

      <ListaEspera desejos={desejos} />

      <section className="cartao" aria-labelledby="dinheiro-grupos">
        <h2 id="dinheiro-grupos">{t.grupos.titulo}</h2>
        <p className="texto-suave">{t.grupos.intro}</p>
        {grupos.length === 0 ? (
          <div className="dinheiro-vazio">
            <p>{t.grupos.semGrupos}</p>
            <p className="texto-suave">{t.grupos.sugeridos.join(", ")}</p>
            <div className="botoes">
              <Button className="botao" onPress={() => void criarSugeridos()}>{t.grupos.criarSugeridos}</Button>
            </div>
          </div>
        ) : (
          <ul className="dinheiro-lista">
            {grupos.map((g) => (
              <li key={g.id} className="dinheiro-linha dinheiro-linha-grupo">
                <span className={`etiqueta-cor grande cor-${g.cor}`} aria-hidden="true" />
                <span className="dinheiro-linha-texto"><span>{g.nome}</span></span>
                <span className="dinheiro-linha-botoes">
                  <Button className="botao-icone" onPress={() => setEditandoGrupo(g)} aria-label={`${t.grupos.editar}: ${g.nome}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
                  <Button className="botao-icone" onPress={() => setExcluindoGrupo(g)} aria-label={`${t.grupos.excluir}: ${g.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="botoes">
          <Button className="botao principal" onPress={() => setEditandoGrupo({ id: "", nome: "", cor: proximaCor(grupos), criadoEm: 0 })}><Plus aria-hidden="true" size="1.1em" /> {t.grupos.adicionar}</Button>
        </div>
      </section>

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
    <section className="cartao" aria-labelledby="dinheiro-espera">
      <h2 id="dinheiro-espera">{t.espera.titulo}</h2>
      <p className="texto-suave">{t.espera.intro}</p>
      {desejos.length === 0 ? (
        <div className="dinheiro-vazio"><p>{t.espera.semDesejos}</p></div>
      ) : (
        <ul className="dinheiro-lista">
          {desejos.map((d) => {
            const resolvido = d.estado !== "esperando";
            const podeDecidir = d.decidirEm <= agora;
            return (
              <li key={d.id} className={resolvido ? "dinheiro-linha dinheiro-linha-meta feito" : "dinheiro-linha dinheiro-linha-meta"}>
                <span className="dinheiro-linha-texto">
                  <span>{d.nome}{d.centavos > 0 && <span className="texto-suave"> · {formatarMoeda(d.centavos)}</span>}</span>
                  <span className="dinheiro-linha-detalhe">
                    {resolvido ? t.espera.resolvido : podeDecidir ? t.espera.podeDecidir : t.espera.esperarAte(fmtData.format(d.decidirEm))}
                  </span>
                </span>
                <span className="dinheiro-linha-botoes">
                  {!resolvido && <Button className="botao-icone" onPress={() => void resolver(d.id)} aria-label={`${t.espera.jaDecidi}: ${d.nome}`}><Check aria-hidden="true" size="1.1em" /></Button>}
                  <Button className="botao-icone" onPress={() => void apagar(d.id)} aria-label={`${t.espera.excluir}: ${d.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
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
    </section>
  );
}
