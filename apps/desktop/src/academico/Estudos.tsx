import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Form, Menu, MenuItem, MenuTrigger, Popover, Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { chaveDia } from "../agenda/datas";
import { api, type Atividade, type Aula, type Materia } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import {
  Backpack,
  BookOpen,
  Books,
  Check,
  FileText,
  Flag,
  Laptop,
  Lightbulb,
  ListChecks,
  Pencil,
  PenLine,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  type LucideIcon,
} from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { FormMateria, novaMateria } from "./FormMateria";
import { FormAtividade, nomeTipo, novaAtividade } from "./FormAtividade";
import { aulasDoDia, GradeHorario } from "./Grade";
import { mediaPonderada, mediasPorBimestre, situacao } from "./media";
import { useExtras, type ExtrasAcademico, type PrazoPesquisa } from "./extras";
import { bimestreDaData, diasAte, NIVEIS, PERFIL_PERSONALIZADO_PADRAO, perfilDoNivel, tipoMostrado, TIPOS_ATIVIDADE, type Nivel, type NivelOuTodos, type PerfilNivel, type TipoAtividade } from "./nivel";
import { Interruptor } from "../componentes/Interruptor";
import { Segmentado } from "../componentes/Segmentado";
import { PainelPesquisa } from "./Pesquisa";

const t = textos.estudos;
const fmtData = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
const numeroBonito = (n: number) => n.toFixed(1).replace(".", ",");
const dataLegivel = (iso: string) => (iso ? fmtData.format(new Date(`${iso}T00:00:00`)) : t.semData);

const ICONE_TIPO: Record<TipoAtividade, LucideIcon> = { prova: FileText, trabalho: PenLine, dever: ListChecks, leitura: BookOpen, entrega: Upload };
const ICONE_NIVEL: Record<Nivel, LucideIcon> = { fundamental: Backpack, medio: Books, tecnico: ListChecks, graduacao: Laptop, pos: Lightbulb, livre: Sparkles, personalizado: SlidersHorizontal };

type Aba = "semana" | "materias" | "grade" | "notas" | "pesquisa";
const CHAVE_ABA = "orbita.academico.aba";
const lerAba = (): Aba => {
  try {
    const v = localStorage.getItem(CHAVE_ABA);
    return v === "materias" || v === "grade" || v === "notas" || v === "pesquisa" ? v : "semana";
  } catch {
    return "semana";
  }
};

export function PaginaEstudos() {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [aprovacao, setAprovacao] = useState(6);
  const [extras, mudarExtras, extrasProntos] = useExtras();
  const [trocandoNivel, setTrocandoNivel] = useState(false);
  const [aba, setAba] = useState<Aba>(lerAba);
  const [editandoMateria, setEditandoMateria] = useState<Materia | null>(null);
  const [editandoAtividade, setEditandoAtividade] = useState<{ a: Atividade; tipo?: TipoAtividade } | null>(null);
  const [excluindoMateria, setExcluindoMateria] = useState<Materia | null>(null);
  const [excluindoAtividade, setExcluindoAtividade] = useState<Atividade | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarMaterias().then(setMaterias, (e) => setErro(e instanceof Error ? e.message : String(e)));
    api.listarAtividades().then(setAtividades, () => {});
    api.listarAulas().then(setAulas, () => {});
    api.mediaAprovacao().then(setAprovacao, () => {});
  }, [mudancas]);

  const nivel = extras.nivel;
  const perfil = perfilDoNivel(nivel ?? "todos", extras.perfilPersonalizado);
  const disciplina = perfil.vocabulario === "disciplina";
  const temNotaLancada = atividades.some((a) => a.nota != null);
  const mostraNotas = perfil.notas || temNotaLancada;
  const abasVisiveis: Aba[] = ["semana", "materias", "grade", ...(mostraNotas ? (["notas"] as Aba[]) : []), ...(perfil.pesquisa ? (["pesquisa"] as Aba[]) : [])];
  const abaAtual = abasVisiveis.includes(aba) ? aba : "semana";

  const escolherAba = (a: Aba) => {
    setAba(a);
    try { localStorage.setItem(CHAVE_ABA, a); } catch { /* só não lembra */ }
  };

  const escolherNivel = (n: NivelOuTodos, personalizado?: { nome: string; perfil: PerfilNivel }) => {
    mudarExtras((x) => (personalizado ? { ...x, nivel: n, nivelNome: personalizado.nome, perfilPersonalizado: personalizado.perfil } : { ...x, nivel: n }));
    setTrocandoNivel(false);
  };
  const nomeDoNivel = (n: NivelOuTodos) => (n === "todos" ? t.nivel.todos : n === "personalizado" && extras.nivelNome ? extras.nivelNome : t.nivel.nomes[n]);

  const porMateria = useMemo(() => new Map(materias.map((m) => [m.id, m])), [materias]);
  const tipoDe = (a: Atividade) => tipoMostrado(a.tipo, extras.atividades[a.id]?.tipo);

  const marcar = async (a: Atividade, feita: boolean) => {
    await api.marcarAtividade(a.id, feita);
    avisarMudanca();
  };
  const excluirMateria = async () => {
    if (!excluindoMateria) return;
    const id = excluindoMateria.id;
    const dela = atividades.filter((a) => a.materiaId === id).map((a) => a.id);
    await api.excluirMateria(id);
    mudarExtras((x) => {
      const materiasX = { ...x.materias };
      delete materiasX[id];
      const atividadesX = { ...x.atividades };
      for (const aid of dela) delete atividadesX[aid];
      return { ...x, materias: materiasX, atividades: atividadesX };
    });
    setExcluindoMateria(null);
    avisarMudanca();
  };
  const excluirAtividade = async () => {
    if (!excluindoAtividade) return;
    const id = excluindoAtividade.id;
    await api.excluirAtividade(id);
    mudarExtras((x) => {
      const atividadesX = { ...x.atividades };
      delete atividadesX[id];
      return { ...x, atividades: atividadesX };
    });
    setExcluindoAtividade(null);
    avisarMudanca();
  };

  // Ainda lendo do cofre: espera, sem mostrar a escolha de nível à toa.
  if (!extrasProntos && !trocandoNivel) {
    return (
      <div className="pagina estudos">
        <h1>{t.titulo}</h1>
      </div>
    );
  }

  // Primeira abertura (ou "Mudar nível"): a escolha ocupa a página.
  if (nivel === undefined || trocandoNivel) {
    return (
      <div className="pagina estudos">
        <h1>{t.titulo}</h1>
        <EscolhaNivel atual={nivel} nomeAtual={extras.nivelNome} perfilAtual={extras.perfilPersonalizado} aoEscolher={escolherNivel} aoCancelar={nivel !== undefined ? () => setTrocandoNivel(false) : undefined} />
      </div>
    );
  }

  const nomeAba: Record<Aba, string> = {
    semana: t.abas.semana,
    materias: disciplina ? t.abas.disciplinas : t.abas.materias,
    grade: t.abas.grade,
    notas: t.abas.notas,
    pesquisa: t.abas.pesquisa,
  };

  const acoesAtividade = {
    marcar: (a: Atividade) => void marcar(a, !a.feita),
    editar: (a: Atividade) => setEditandoAtividade({ a }),
    excluir: (a: Atividade) => setExcluindoAtividade(a),
  };

  return (
    <div className="pagina estudos">
      <header className="estudos-cabeca">
        <h1>{t.titulo}</h1>
        <div className="estudos-nivel">
          <span className="estudos-nivel-chip">
            {nivel !== "todos" && (() => { const I = ICONE_NIVEL[nivel]; return <I aria-hidden="true" size="1em" />; })()}
            {t.nivel.atual(nomeDoNivel(nivel))}
          </span>
          <Button className="estudos-link" onPress={() => setTrocandoNivel(true)}>{t.nivel.mudar}</Button>
        </div>
      </header>
      <p className="pagina-intro">{t.intro}</p>

      <Tabs className="estudos-abas" selectedKey={abaAtual} onSelectionChange={(k) => escolherAba(k as Aba)}>
        <TabList className="estudos-abas-lista" aria-label={t.abas.rotulo}>
          {abasVisiveis.map((a) => (
            <Tab key={a} id={a} className="estudos-aba">{nomeAba[a]}</Tab>
          ))}
        </TabList>

        <TabPanel id="semana" className="estudos-painel">
          <AbaSemana
            materias={materias}
            atividades={atividades}
            aulas={aulas}
            extras={extras}
            perfil={perfil}
            porMateria={porMateria}
            tipoDe={tipoDe}
            acoes={acoesAtividade}
            aoAdicionar={(tipo) => setEditandoAtividade({ a: novaAtividade(materias[0]?.id ?? ""), tipo })}
            aoMarcarPrazo={(p) => mudarExtras((x) => ({ ...x, pesquisa: { ...x.pesquisa, prazos: x.pesquisa.prazos.map((q) => (q.id === p.id ? { ...q, feito: !q.feito } : q)) } }))}
            aoCriarMateria={() => setEditandoMateria(novaMateria())}
          />
        </TabPanel>

        <TabPanel id="materias" className="estudos-painel">
          <AbaMaterias
            materias={materias}
            atividades={atividades}
            extras={extras}
            perfil={perfil}
            aprovacao={aprovacao}
            mostraNotas={mostraNotas}
            aoAdicionar={() => setEditandoMateria(novaMateria())}
            aoEditar={setEditandoMateria}
            aoExcluir={setExcluindoMateria}
          />
        </TabPanel>

        <TabPanel id="grade" className="estudos-painel">
          <section className="estudos-bloco" aria-labelledby="grade-titulo">
            <h2 id="grade-titulo">{t.grade.titulo}</h2>
            <p className="texto-suave">{t.grade.intro}</p>
            <GradeHorario materias={materias} aulas={aulas} disciplina={disciplina} />
          </section>
        </TabPanel>

        {mostraNotas && (
          <TabPanel id="notas" className="estudos-painel">
            <AbaNotas materias={materias} atividades={atividades} extras={extras} perfil={perfil} aprovacao={aprovacao} />
          </TabPanel>
        )}

        {perfil.pesquisa && (
          <TabPanel id="pesquisa" className="estudos-painel">
            <PainelPesquisa pesquisa={extras.pesquisa} hoje={chaveDia(new Date())} mudar={(f) => mudarExtras((x) => ({ ...x, pesquisa: f(x.pesquisa) }))} />
          </TabPanel>
        )}
      </Tabs>

      <Aviso>{erro}</Aviso>

      <Janela
        titulo={editandoMateria && editandoMateria.id ? t.materias.editar : disciplina ? t.materias.novaDisciplina : t.materias.novo}
        aberta={editandoMateria !== null}
        aoFechar={() => setEditandoMateria(null)}
      >
        {editandoMateria && (
          <FormMateria
            key={editandoMateria.id || "novo"}
            inicial={editandoMateria}
            perfil={perfil}
            extras={extras.materias[editandoMateria.id]}
            aoSalvarExtras={(id, e) => mudarExtras((x) => ({ ...x, materias: { ...x.materias, [id]: e } }))}
            aoFechar={() => setEditandoMateria(null)}
          />
        )}
      </Janela>

      <Janela titulo={editandoAtividade && editandoAtividade.a.id ? t.atividade.editar : t.atividade.novo} aberta={editandoAtividade !== null} aoFechar={() => setEditandoAtividade(null)}>
        {editandoAtividade && (
          <FormAtividade
            key={editandoAtividade.a.id || `novo-${editandoAtividade.tipo ?? ""}`}
            inicial={editandoAtividade.a}
            tipoInicial={editandoAtividade.tipo}
            materias={materias}
            perfil={perfil}
            extras={extras.atividades[editandoAtividade.a.id]}
            aoSalvarExtras={(id, e) => mudarExtras((x) => ({ ...x, atividades: { ...x.atividades, [id]: e } }))}
            aoFechar={() => setEditandoAtividade(null)}
          />
        )}
      </Janela>

      <Confirmar titulo={t.materias.excluir} texto={excluindoMateria ? t.materias.confirmarExcluir(excluindoMateria.nome) : ""} confirmar={t.materias.excluir} aberta={excluindoMateria !== null} aoCancelar={() => setExcluindoMateria(null)} aoConfirmar={() => void excluirMateria()} />
      <Confirmar titulo={t.atividade.excluir} texto={excluindoAtividade ? `${t.atividade.excluir}: ${excluindoAtividade.titulo}?` : ""} confirmar={t.atividade.excluir} aberta={excluindoAtividade !== null} aoCancelar={() => setExcluindoAtividade(null)} aoConfirmar={() => void excluirAtividade()} />
    </div>
  );
}

// ---------- Escolha de nível ----------

function EscolhaNivel({ atual, nomeAtual, perfilAtual, aoEscolher, aoCancelar }: { atual?: NivelOuTodos; nomeAtual?: string; perfilAtual?: PerfilNivel; aoEscolher: (n: NivelOuTodos, personalizado?: { nome: string; perfil: PerfilNivel }) => void; aoCancelar?: () => void }) {
  // "Personalizado": a pessoa dá um nome e liga o que quer ver.
  const [montando, setMontando] = useState(false);
  const [nome, setNome] = useState(nomeAtual ?? "");
  const [perfil, setPerfil] = useState<PerfilNivel>(perfilAtual ?? PERFIL_PERSONALIZADO_PADRAO);
  const tp = t.nivel.personalizar;
  if (montando) {
    return (
      <section className="estudos-escolha" aria-labelledby="montar-nivel">
        <h2 id="montar-nivel" className="estudos-escolha-titulo">{tp.titulo}</h2>
        <p className="texto-suave">{tp.texto}</p>
        <div className="formulario">
          <Campo rotulo={tp.nome} valor={nome} aoMudar={setNome} maximo={40} semDitado autoFocus descricao={tp.nomeAjuda} />
          <Segmentado rotulo={tp.periodo} valor={perfil.periodo ?? "nenhum"} opcoes={[{ valor: "bimestre", nome: tp.bimestre }, { valor: "semestre", nome: tp.semestre }, { valor: "nenhum", nome: tp.semPeriodo }]} aoMudar={(v) => setPerfil({ ...perfil, periodo: v === "nenhum" ? null : (v as "bimestre" | "semestre") })} />
          <Segmentado rotulo={tp.vocabulario} valor={perfil.vocabulario} opcoes={[{ valor: "materia", nome: tp.materia }, { valor: "disciplina", nome: tp.disciplina }]} aoMudar={(v) => setPerfil({ ...perfil, vocabulario: v })} />
          <Interruptor rotulo={tp.notas} ligado={perfil.notas} aoMudar={(v) => setPerfil({ ...perfil, notas: v })} />
          <Interruptor rotulo={tp.creditos} ligado={perfil.creditos} aoMudar={(v) => setPerfil({ ...perfil, creditos: v })} />
          <Interruptor rotulo={tp.pesquisa} ligado={perfil.pesquisa} aoMudar={(v) => setPerfil({ ...perfil, pesquisa: v })} />
          <div className="botoes">
            <Button className="botao" onPress={() => setMontando(false)}>{textos.comum.voltar}</Button>
            <Button className="botao principal" onPress={() => aoEscolher("personalizado", { nome: nome.trim() || t.nivel.nomes.personalizado, perfil })}>{tp.usar}</Button>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="estudos-escolha" aria-labelledby="escolha-nivel">
      <h2 id="escolha-nivel" className="estudos-escolha-titulo">{t.nivel.perguntaTitulo}</h2>
      <p className="texto-suave">{t.nivel.perguntaTexto}</p>
      <ul className="estudos-niveis">
        {NIVEIS.map((n) => {
          const Icone = ICONE_NIVEL[n];
          const escolher = () => (n === "personalizado" ? setMontando(true) : aoEscolher(n));
          return (
            <li key={n}>
              <Button className={`estudos-nivel-cartao nivel-${n}${atual === n ? " atual" : ""}`} onPress={escolher} aria-label={t.nivel.escolher(t.nivel.nomes[n])} aria-pressed={atual === n}>
                <span className="estudos-nivel-icone" aria-hidden="true"><Icone size="1.6em" /></span>
                <span className="estudos-nivel-nome">{t.nivel.nomes[n]}</span>
                <span className="estudos-nivel-desc">{t.nivel.descricoes[n]}</span>
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="botoes">
        {aoCancelar && <Button className="botao" onPress={aoCancelar}>{t.nivel.cancelar}</Button>}
        <Button className="estudos-link" onPress={() => aoEscolher("todos")}>{t.nivel.depois}</Button>
      </div>
    </section>
  );
}

// ---------- Esta semana ----------

interface AcoesAtividade {
  marcar: (a: Atividade) => void;
  editar: (a: Atividade) => void;
  excluir: (a: Atividade) => void;
}

function AbaSemana({
  materias,
  atividades,
  aulas,
  extras,
  perfil,
  porMateria,
  tipoDe,
  acoes,
  aoAdicionar,
  aoMarcarPrazo,
  aoCriarMateria,
}: {
  materias: Materia[];
  atividades: Atividade[];
  aulas: Aula[];
  extras: ExtrasAcademico;
  perfil: PerfilNivel;
  porMateria: Map<string, Materia>;
  tipoDe: (a: Atividade) => TipoAtividade;
  acoes: AcoesAtividade;
  aoAdicionar: (tipo: TipoAtividade) => void;
  aoMarcarPrazo: (p: PrazoPesquisa) => void;
  aoCriarMateria: () => void;
}) {
  const agora = new Date();
  const hoje = chaveDia(agora);
  const diaHoje = agora.getDay();
  const aulasHoje = aulasDoDia(aulas, diaHoje);

  const porData = (a: { data: string }, b: { data: string }) => (a.data === b.data ? 0 : a.data === "" ? 1 : b.data === "" ? -1 : a.data < b.data ? -1 : 1);
  const abertas = atividades.filter((a) => !a.feita && (a.data === "" || a.data >= hoje)).sort(porData);
  const semana = abertas.filter((a) => a.data !== "" && diasAte(hoje, a.data) < 7);
  const adiante = abertas.filter((a) => a.data !== "" && diasAte(hoje, a.data) >= 7);
  const semData = abertas.filter((a) => a.data === "");
  const passadas = atividades.filter((a) => a.feita || (a.data !== "" && a.data < hoje)).sort((a, b) => (a.data < b.data ? 1 : -1));
  const prazos = perfil.pesquisa ? extras.pesquisa.prazos.filter((p) => !p.feito && p.data && p.data >= hoje) : [];
  const prazosSemana = prazos.filter((p) => diasAte(hoje, p.data) < 7);
  const prazosAdiante = prazos.filter((p) => diasAte(hoje, p.data) >= 7);

  type Entrada = { tipo: "atividade"; a: Atividade; data: string } | { tipo: "prazo"; p: PrazoPesquisa; data: string };
  const juntar = (as: Atividade[], ps: PrazoPesquisa[]): Entrada[] =>
    [...as.map((a) => ({ tipo: "atividade" as const, a, data: a.data })), ...ps.map((p) => ({ tipo: "prazo" as const, p, data: p.data }))].sort(porData);

  const desenhar = (e: Entrada) =>
    e.tipo === "atividade" ? (
      <CartaoAtividade key={e.a.id} a={e.a} m={porMateria.get(e.a.materiaId)} tipo={tipoDe(e.a)} perfil={perfil} hoje={hoje} acoes={acoes} />
    ) : (
      <CartaoPrazo key={e.p.id} p={e.p} hoje={hoje} aoMarcar={() => aoMarcarPrazo(e.p)} />
    );

  const listaSemana = juntar(semana, prazosSemana);
  const listaAdiante = juntar(adiante, prazosAdiante);

  return (
    <div className="estudos-semana">
      <section className="estudos-bloco estudos-hoje" aria-labelledby="estudos-hoje">
        <h2 id="estudos-hoje">{t.semana.hojeDia(t.grade.diasLongos[diaHoje])}</h2>
        {aulasHoje.length === 0 ? (
          <p className="texto-suave">{t.semana.semAulaHoje}</p>
        ) : (
          <ul className="estudos-hoje-aulas">
            {aulasHoje.map((a) => {
              const m = porMateria.get(a.materiaId);
              return (
                <li key={a.id} className={`estudos-hoje-aula cor-${m?.cor ?? "cinza"}`}>
                  <span className="estudos-hoje-hora">{t.grade.faixa(a.inicio, a.fim)}</span>
                  <span className="estudos-hoje-materia">{m?.nome ?? "—"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="estudos-bloco" aria-labelledby="vem-ai">
        <div className="estudos-bloco-cabeca">
          <h2 id="vem-ai">{t.proximas}</h2>
          {materias.length > 0 && (
            <MenuTrigger>
              <Button className="botao principal estudos-adicionar">
                <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
              </Button>
              <Popover className="menu-popover" placement="bottom end">
                <Menu className="menu" aria-label={t.adicionarAtividade} onAction={(k) => aoAdicionar(k as TipoAtividade)}>
                  {TIPOS_ATIVIDADE.map((tipo) => {
                    const Icone = ICONE_TIPO[tipo];
                    const nome = nomeTipo(tipo, perfil);
                    return (
                      <MenuItem key={tipo} id={tipo} className="menu-item estudos-menu-item" textValue={nome}>
                        <span className={`estudos-icone-tipo tipo-${tipo}`} aria-hidden="true"><Icone size="1em" /></span>
                        {nome}
                      </MenuItem>
                    );
                  })}
                </Menu>
              </Popover>
            </MenuTrigger>
          )}
        </div>

        {materias.length === 0 ? (
          <div className="estudos-vazio">
            <p>{t.semMateriaAinda}</p>
            <Button className="botao principal" onPress={aoCriarMateria}>
              <Plus aria-hidden="true" size="1.1em" /> {perfil.vocabulario === "disciplina" ? t.materias.adicionarDisciplina : t.materias.adicionar}
            </Button>
          </div>
        ) : abertas.length === 0 && prazos.length === 0 ? (
          <p className="estudos-vazio">{t.semProximas}</p>
        ) : (
          <>
            <h3 className="estudos-sub">{t.semana.proximosDias}</h3>
            {listaSemana.length === 0 ? <p className="texto-suave">{t.semana.tudoEmDia}</p> : <ul className="estudos-cartoes">{listaSemana.map(desenhar)}</ul>}
            {listaAdiante.length > 0 && (
              <>
                <h3 className="estudos-sub">{t.semana.maisAdiante}</h3>
                <ul className="estudos-cartoes compactos">{listaAdiante.map(desenhar)}</ul>
              </>
            )}
            {semData.length > 0 && (
              <>
                <h3 className="estudos-sub">{t.semana.semData}</h3>
                <ul className="estudos-cartoes compactos">{semData.map((a) => desenhar({ tipo: "atividade", a, data: "" }))}</ul>
              </>
            )}
          </>
        )}
      </section>

      {passadas.length > 0 && (
        <details className="estudos-bloco estudos-historico">
          <summary>{t.historicoResumo(passadas.length)}</summary>
          <ul className="estudos-cartoes compactos">
            {passadas.map((a) => (
              <CartaoAtividade key={a.id} a={a} m={porMateria.get(a.materiaId)} tipo={tipoDe(a)} perfil={perfil} hoje={hoje} acoes={acoes} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CartaoAtividade({ a, m, tipo, perfil, hoje, acoes }: { a: Atividade; m?: Materia; tipo: TipoAtividade; perfil: PerfilNivel; hoje: string; acoes: AcoesAtividade }) {
  const Icone = ICONE_TIPO[tipo];
  const dias = a.data ? diasAte(hoje, a.data) : null;
  const perto = dias != null && dias >= 0 && dias <= 1 && !a.feita;
  return (
    <li className={`estudos-cartao cor-${m?.cor ?? "cinza"}${a.feita ? " feito" : ""}`}>
      <div className="estudos-cartao-topo">
        <span className={`estudos-icone-tipo tipo-${tipo}`} aria-hidden="true"><Icone size="1.1em" /></span>
        <span className="estudos-cartao-tipo">
          {nomeTipo(tipo, perfil)}
          {m && <span className="estudos-cartao-materia"> · {m.nome}</span>}
        </span>
        {a.feita ? (
          <span className="estudos-contagem feito"><Check aria-hidden="true" size="0.9em" /> {t.feitoMarca}</span>
        ) : (
          dias != null && <span className={perto ? "estudos-contagem perto" : "estudos-contagem"}>{t.contagem(dias)}</span>
        )}
      </div>
      <p className="estudos-cartao-titulo">{a.titulo}</p>
      <div className="estudos-cartao-rodape">
        <span className="texto-suave">
          {dataLegivel(a.data)}
          {a.nota != null && ` · ${t.notaDe(numeroBonito(a.nota))}`}
        </span>
        <span className="estudos-acoes">
          <Button className="botao-icone estudos-toque" onPress={() => acoes.marcar(a)} aria-label={`${a.feita ? t.desmarcarFeita : t.marcarFeita}: ${a.titulo}`}>
            {a.feita ? <RotateCcw aria-hidden="true" size="1.1em" /> : <Check aria-hidden="true" size="1.1em" />}
          </Button>
          <Button className="botao-icone estudos-toque" onPress={() => acoes.editar(a)} aria-label={`${t.atividade.editar}: ${a.titulo}`}>
            <Pencil aria-hidden="true" size="1.1em" />
          </Button>
          <Button className="botao-icone estudos-toque" onPress={() => acoes.excluir(a)} aria-label={`${t.atividade.excluir}: ${a.titulo}`}>
            <Trash2 aria-hidden="true" size="1.1em" />
          </Button>
        </span>
      </div>
    </li>
  );
}

function CartaoPrazo({ p, hoje, aoMarcar }: { p: PrazoPesquisa; hoje: string; aoMarcar: () => void }) {
  const dias = diasAte(hoje, p.data);
  return (
    <li className="estudos-cartao estudos-cartao-prazo">
      <div className="estudos-cartao-topo">
        <span className="estudos-icone-tipo tipo-prazo" aria-hidden="true"><Flag size="1.1em" /></span>
        <span className="estudos-cartao-tipo">{t.semana.prazoPesquisa}</span>
        <span className={dias <= 1 ? "estudos-contagem perto" : "estudos-contagem"}>{t.contagem(dias)}</span>
      </div>
      <p className="estudos-cartao-titulo">{p.nome}</p>
      <div className="estudos-cartao-rodape">
        <span className="texto-suave">{dataLegivel(p.data)}</span>
        <span className="estudos-acoes">
          <Button className="botao-icone estudos-toque" onPress={aoMarcar} aria-label={`${t.marcarFeita}: ${p.nome}`}>
            <Check aria-hidden="true" size="1.1em" />
          </Button>
        </span>
      </div>
    </li>
  );
}

// ---------- Matérias / disciplinas ----------

function AbaMaterias({
  materias,
  atividades,
  extras,
  perfil,
  aprovacao,
  mostraNotas,
  aoAdicionar,
  aoEditar,
  aoExcluir,
}: {
  materias: Materia[];
  atividades: Atividade[];
  extras: ExtrasAcademico;
  perfil: PerfilNivel;
  aprovacao: number;
  mostraNotas: boolean;
  aoAdicionar: () => void;
  aoEditar: (m: Materia) => void;
  aoExcluir: (m: Materia) => void;
}) {
  const disciplina = perfil.vocabulario === "disciplina";
  const hoje = chaveDia(new Date());
  const totalCreditos = materias.reduce((s, m) => s + (extras.materias[m.id]?.creditos ?? 0), 0);

  return (
    <section className="estudos-bloco" aria-labelledby="materias">
      <div className="estudos-bloco-cabeca">
        <h2 id="materias">{disciplina ? t.materias.tituloDisciplinas : t.materias.titulo}</h2>
        <Button className="botao principal" onPress={aoAdicionar}>
          <Plus aria-hidden="true" size="1.1em" /> {disciplina ? t.materias.adicionarDisciplina : t.materias.adicionar}
        </Button>
      </div>
      <p className="texto-suave">
        {t.materias.intro}
        {perfil.creditos && totalCreditos > 0 && <> <strong className="estudos-creditos-total">{t.materias.creditosTotal(numeroCurto(totalCreditos))}</strong></>}
      </p>
      {materias.length === 0 ? (
        <p className="estudos-vazio">{t.materias.semMaterias}</p>
      ) : (
        <ul className="materia-grade">
          {materias.map((m) => {
            const dela = atividades.filter((a) => a.materiaId === m.id);
            const marcadas = dela.filter((a) => !a.feita && (a.data === "" || a.data >= hoje)).length;
            const media = mediaPonderada(dela);
            const ex = extras.materias[m.id];
            return (
              <li key={m.id} className={`materia-cartao cor-${m.cor}`}>
                <div className="materia-faixa" aria-hidden="true" />
                <div className="materia-corpo">
                  <h3 className="materia-nome">{m.nome}</h3>
                  {m.professor && <p className="texto-suave materia-prof">{m.professor}</p>}
                  <ul className="estudos-chips">
                    {perfil.periodo === "semestre" && ex?.periodo && <li className="estudos-chip">{ex.periodo}</li>}
                    {perfil.creditos && ex?.creditos != null && <li className="estudos-chip">{t.materias.creditosDe(numeroCurto(ex.creditos))}</li>}
                    <li className="estudos-chip">{t.materias.marcadas(marcadas)}</li>
                    {mostraNotas && media != null && <li className="estudos-chip">{t.notas.media(numeroBonito(media))}</li>}
                  </ul>
                  {mostraNotas && media != null && perfil.notas && <p className="texto-suave pequeno">{t.notas[situacao(media, aprovacao) as "acima" | "perto" | "abaixo"]}</p>}
                </div>
                <div className="materia-acoes">
                  <Button className="botao-icone estudos-toque" onPress={() => aoEditar(m)} aria-label={`${t.materias.editar}: ${m.nome}`}>
                    <Pencil aria-hidden="true" size="1.1em" />
                  </Button>
                  <Button className="botao-icone estudos-toque" onPress={() => aoExcluir(m)} aria-label={`${t.materias.excluir}: ${m.nome}`}>
                    <Trash2 aria-hidden="true" size="1.1em" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const numeroCurto = (n: number) => (Number.isInteger(n) ? String(n) : numeroBonito(n));

// ---------- Notas ----------

function AbaNotas({ materias, atividades, extras, perfil, aprovacao }: { materias: Materia[]; atividades: Atividade[]; extras: ExtrasAcademico; perfil: PerfilNivel; aprovacao: number }) {
  const bimestreDe = (a: Atividade): number | null => extras.atividades[a.id]?.bimestre ?? (a.data ? bimestreDaData(a.data) : null);

  let conteudo: ReactNode;
  if (materias.length === 0) {
    conteudo = <p className="estudos-vazio">{t.materias.semMaterias}</p>;
  } else if (perfil.periodo === "bimestre") {
    conteudo = (
      <div className="estudos-tabela-rolagem">
        <table className="estudos-tabela">
          <caption className="visualmente-oculto">{t.notas.porBimestre}</caption>
          <thead>
            <tr>
              <th scope="col">{perfil.vocabulario === "disciplina" ? t.atividade.disciplina : t.atividade.materia}</th>
              {[1, 2, 3, 4].map((b) => <th key={b} scope="col">{t.notas.bimestreCurto(b)}</th>)}
              <th scope="col">{t.notas.geral}</th>
            </tr>
          </thead>
          <tbody>
            {materias.map((m) => {
              const medias = mediasPorBimestre(atividades.filter((a) => a.materiaId === m.id), bimestreDe);
              return (
                <tr key={m.id} className={`cor-${m.cor}`}>
                  <th scope="row">
                    <span className="etiqueta-chip"><span className="etiqueta-cor" aria-hidden="true" />{m.nome}</span>
                  </th>
                  {medias.map((v, i) => (
                    <td key={i} className={i === 4 ? "estudos-tabela-geral" : undefined}>{v == null ? <span className="texto-suave" aria-label={t.notas.semNota}>{t.notas.vazio}</span> : numeroBonito(v)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  } else {
    conteudo = (
      <ul className="estudos-lista">
        {materias.map((m) => {
          const media = mediaPonderada(atividades.filter((a) => a.materiaId === m.id));
          const sit = situacao(media, aprovacao);
          return (
            <li key={m.id} className={`estudos-linha cor-${m.cor}`}>
              <span className="etiqueta-chip"><span className="etiqueta-cor" aria-hidden="true" /><strong>{m.nome}</strong></span>
              <span className="texto-suave">{media == null ? t.notas.semNota : `${t.notas.media(numeroBonito(media))} · ${t.notas[sit as "acima" | "perto" | "abaixo"]}`}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="estudos-bloco" aria-labelledby="como-vao">
      <h2 id="como-vao">{perfil.periodo === "bimestre" ? t.notas.porBimestre : t.notas.comoVai}</h2>
      <p className="campo-ajuda">{perfil.periodo === "bimestre" ? t.notas.porBimestreAjuda : t.notas.explicacao}</p>
      {conteudo}
      {perfil.periodo === "bimestre" && <p className="campo-ajuda">{t.notas.explicacao}</p>}
      {perfil.notas && <MediaAprovacao atual={aprovacao} />}
    </section>
  );
}

function MediaAprovacao({ atual }: { atual: number }) {
  const [valor, setValor] = useState(String(atual));
  const [erro, setErro] = useState<string | null>(null);
  const recado = useRecado();

  useEffect(() => setValor(String(atual)), [atual]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const n = Number(valor.trim().replace(",", "."));
    if (!Number.isFinite(n)) return;
    try {
      await api.definirMediaAprovacao(n);
      avisarMudanca();
      recado(t.notas.aprovacaoSalva);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario estudos-aprovacao" onSubmit={salvar}>
      <Campo rotulo={t.notas.aprovacaoRotulo} valor={valor} aoMudar={setValor} numerico descricao={t.notas.aprovacaoAjuda} semDitado />
      <Aviso>{erro}</Aviso>
      <div className="botoes">
        <Button className="botao" type="submit">{t.notas.salvarAprovacao}</Button>
      </div>
    </Form>
  );
}
