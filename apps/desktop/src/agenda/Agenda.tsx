import { ChevronLeft, ChevronRight, Flag, Plus, Repeat } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { api, type Evento, type Prazo } from "../api";
import { Aviso } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { chaveDia, diasDaGradeDoMes, expandir, inicioDaSemana, inicioDoDia, porDia, somarDias, type Ocorrencia } from "./datas";
import { FormEvento, novoEvento } from "./FormEvento";

const t = textos.agenda;
type Visao = "dia" | "semana" | "mes" | "modelo";
const CHAVE_VISAO = "orbita.visao-agenda";

const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtDiaLongo = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const fmtDiaMes = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function visaoSalva(): Visao {
  try {
    const v = localStorage.getItem(CHAVE_VISAO);
    return v === "dia" || v === "mes" || v === "modelo" ? v : "semana";
  } catch {
    return "semana";
  }
}

/** Período visível de cada visualização: [de, ate). */
function periodo(visao: Visao, ref: Date): [Date, Date] {
  if (visao === "dia") return [inicioDoDia(ref), somarDias(inicioDoDia(ref), 1)];
  if (visao === "mes") {
    const g = diasDaGradeDoMes(ref);
    return [g[0], somarDias(g[g.length - 1], 1)];
  }
  const s = inicioDaSemana(ref);
  return [s, somarDias(s, 7)];
}

export function Agenda({ aoAbrirProjeto }: { aoAbrirProjeto: (id: string) => void }) {
  const [visao, setVisao] = useState<Visao>(visaoSalva);
  const [ref, setRef] = useState(() => inicioDoDia(new Date()));
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const [editando, setEditando] = useState<{ evento: Evento; dia: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();
  const [de, ate] = periodo(visao, ref);

  useEffect(() => {
    api.listarEventos(de.getTime(), ate.getTime()).then(setEventos, (e) => setErro(String(e?.message ?? e)));
    api.listarPrazos(chaveDia(de), chaveDia(somarDias(ate, -1))).then(setPrazos, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de.getTime(), ate.getTime(), mudancas]);

  const ocorrencias = useMemo(() => {
    const lista = expandir(eventos, de, ate);
    return visao === "modelo" ? lista.filter((o) => o.evento.modelo) : lista;
  }, [eventos, de, ate, visao]);

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    try {
      localStorage.setItem(CHAVE_VISAO, v);
    } catch {
      // Sem armazenamento: só não lembra da escolha.
    }
  };

  const andar = (sentido: 1 | -1) => {
    if (visao === "dia") setRef(somarDias(ref, sentido));
    else if (visao === "mes") setRef(new Date(ref.getFullYear(), ref.getMonth() + sentido, 1));
    else setRef(somarDias(ref, 7 * sentido));
  };

  const titulo =
    visao === "dia"
      ? maiuscula(fmtDiaLongo.format(ref))
      : visao === "mes"
        ? maiuscula(fmtMes.format(ref))
        : visao === "modelo"
          ? t.visoes.modelo
          : `${fmtDiaMes.format(de)} a ${fmtDiaMes.format(somarDias(ate, -1))}`;

  const abrir = (o: Ocorrencia) => setEditando({ evento: o.evento, dia: o.dia });

  return (
    <div className="pagina pagina-larga">
      <h1>{t.titulo}</h1>
      <div className="barra-agenda">
        <ToggleButtonGroup
          aria-label={t.visao}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[visao]}
          onSelectionChange={(k) => trocarVisao([...k][0] as Visao)}
          className="segmentado"
        >
          {(["dia", "semana", "mes", "modelo"] as const).map((v) => (
            <ToggleButton key={v} id={v} className="segmentado-opcao">{t.visoes[v]}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Button className="botao principal" onPress={() => setEditando({ evento: novoEvento(ref, visao === "modelo"), dia: null })}>
          <Plus aria-hidden="true" size="1.1em" /> {visao === "modelo" ? t.novoBloco : t.novo}
        </Button>
      </div>

      {visao !== "modelo" ? (
        <div className="navegacao-periodo">
          <Button className="botao-icone" aria-label={t.anterior} onPress={() => andar(-1)}>
            <ChevronLeft aria-hidden="true" size="1.2em" />
          </Button>
          <Button className="botao" onPress={() => setRef(inicioDoDia(new Date()))}>{t.hoje}</Button>
          <Button className="botao-icone" aria-label={t.proximo} onPress={() => andar(1)}>
            <ChevronRight aria-hidden="true" size="1.2em" />
          </Button>
          <h2 aria-live="polite">{titulo}</h2>
        </div>
      ) : (
        <p className="pagina-intro">{t.introModelo}</p>
      )}
      <Aviso>{erro}</Aviso>

      {visao === "dia" && <ListaDoDia ocorrencias={ocorrencias} prazos={prazos.filter((p) => p.data === chaveDia(ref))} aoAbrir={abrir} aoAbrirProjeto={aoAbrirProjeto} />}
      {(visao === "semana" || visao === "modelo") && (
        <Semana de={de} ocorrencias={ocorrencias} prazos={visao === "modelo" ? [] : prazos} modelo={visao === "modelo"} aoAbrir={abrir} aoAbrirProjeto={aoAbrirProjeto} />
      )}
      {visao === "mes" && (
        <Mes referencia={ref} ocorrencias={ocorrencias} prazos={prazos} aoAbrirDia={(d) => (setRef(d), trocarVisao("dia"))} />
      )}

      <Janela titulo={editando?.evento.id ? t.editarTitulo : t.novoTitulo} aberta={!!editando} aoFechar={() => setEditando(null)}>
        {editando && <FormEvento key={editando.evento.id || "novo"} inicial={editando.evento} dia={editando.dia} aoFechar={() => setEditando(null)} />}
      </Janela>
    </div>
  );
}

/** Um compromisso na lista: horário, título e marcas (repete, bloco fixo). */
export function LinhaOcorrencia({ o, aoAbrir, compacta }: { o: Ocorrencia; aoAbrir?: () => void; compacta?: boolean }) {
  const horario = o.evento.diaInteiro ? t.diaInteiro : t.horario(fmtHora.format(o.inicio), o.fim ? fmtHora.format(o.fim) : null);
  const conteudo = (
    <>
      <span className="ocorrencia-hora">{horario}</span>
      <span className={compacta ? "ocorrencia-titulo" : "ocorrencia-titulo quebra"}>{o.evento.titulo}</span>
      <span className="ocorrencia-marcas">
        {/* Na semana o bloco fixo já aparece tracejado; o texto fica para o leitor de tela. */}
        {o.evento.modelo && (compacta ? <span className="visualmente-oculto">{t.blocoFixo}</span> : <span className="etiqueta-estado">{t.blocoFixo}</span>)}
        {o.evento.repeticao && <Repeat aria-label={t.repete} size="0.95em" />}
      </span>
    </>
  );
  const classe = o.evento.modelo ? "ocorrencia modelo" : "ocorrencia";
  return aoAbrir ? (
    <Button className={classe} onPress={aoAbrir}>{conteudo}</Button>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

/** Prazo de projeto ou tarefa na agenda: abre o projeto. */
function LinhaPrazo({ p, aoAbrirProjeto }: { p: Prazo; aoAbrirProjeto: (id: string) => void }) {
  return (
    <Button className="ocorrencia prazo" onPress={() => aoAbrirProjeto(p.projetoId)}>
      <span className="ocorrencia-hora com-icone"><Flag aria-hidden="true" size="0.9em" /> {t.prazo}</span>
      <span className="ocorrencia-titulo quebra">{p.titulo}</span>
      {p.tipo === "tarefa" && <span className="texto-suave pequeno quebra ocorrencia-projeto">{t.doProjeto(p.projeto)}</span>}
    </Button>
  );
}

function ListaDoDia({ ocorrencias, prazos, aoAbrir, aoAbrirProjeto }: { ocorrencias: Ocorrencia[]; prazos: Prazo[]; aoAbrir: (o: Ocorrencia) => void; aoAbrirProjeto: (id: string) => void }) {
  if (ocorrencias.length === 0 && prazos.length === 0) return <p className="texto-suave">{t.nadaNoDia}</p>;
  return (
    <ul className="lista-ocorrencias largura-leitura">
      {prazos.map((p) => (
        <li key={p.id}>
          <LinhaPrazo p={p} aoAbrirProjeto={aoAbrirProjeto} />
        </li>
      ))}
      {ocorrencias.map((o) => (
        <li key={o.evento.id + o.dia}>
          <LinhaOcorrencia o={o} aoAbrir={() => aoAbrir(o)} />
        </li>
      ))}
    </ul>
  );
}

function Semana({ de, ocorrencias, prazos, modelo, aoAbrir, aoAbrirProjeto }: { de: Date; ocorrencias: Ocorrencia[]; prazos: Prazo[]; modelo: boolean; aoAbrir: (o: Ocorrencia) => void; aoAbrirProjeto: (id: string) => void }) {
  const grupos = porDia(ocorrencias);
  const hoje = chaveDia(new Date());
  if (modelo && ocorrencias.length === 0) return <p className="texto-suave largura-leitura">{t.nadaNaSemanaModelo}</p>;
  return (
    <div className="semana">
      {Array.from({ length: 7 }, (_, i) => somarDias(de, i)).map((d) => {
        const chave = chaveDia(d);
        const doDia = grupos.get(chave) ?? [];
        const eHoje = !modelo && chave === hoje;
        return (
          <section key={chave} className={eHoje ? "semana-dia hoje" : "semana-dia"} aria-label={modelo ? t.diasSemana[d.getDay()] : fmtDiaLongo.format(d)}>
            <h3>
              {modelo ? t.diasSemana[d.getDay()] : `${t.diasSemanaCurtos[d.getDay()]} ${d.getDate()}`}
              {eHoje && <span className="selo">{t.hoje}</span>}
            </h3>
            <ul className="lista-ocorrencias">
              {prazos.filter((p) => p.data === chave).map((p) => (
                <li key={p.id}>
                  <LinhaPrazo p={p} aoAbrirProjeto={aoAbrirProjeto} />
                </li>
              ))}
              {doDia.map((o) => (
                <li key={o.evento.id + o.dia}>
                  <LinhaOcorrencia o={o} aoAbrir={() => aoAbrir(o)} compacta />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Mes({ referencia, ocorrencias, prazos, aoAbrirDia }: { referencia: Date; ocorrencias: Ocorrencia[]; prazos: Prazo[]; aoAbrirDia: (d: Date) => void }) {
  const grupos = porDia(ocorrencias);
  const hoje = chaveDia(new Date());
  const dias = diasDaGradeDoMes(referencia);
  return (
    <div className="mes" role="grid" aria-label={fmtMes.format(referencia)}>
      <div className="mes-linha cabecalho" role="row">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <span key={d} role="columnheader" className="mes-cabecalho">{t.diasSemanaCurtos[d]}</span>
        ))}
      </div>
      {Array.from({ length: dias.length / 7 }, (_, s) => (
        <div key={s} className="mes-linha" role="row">
          {dias.slice(s * 7, s * 7 + 7).map((d) => {
            const chave = chaveDia(d);
            const doDia = [
              ...prazos.filter((p) => p.data === chave).map((p) => ({ id: p.id, titulo: t.prazoDe(p.titulo), prazo: true })),
              ...(grupos.get(chave) ?? []).filter((o) => !o.evento.modelo).map((o) => ({ id: o.evento.id, titulo: o.evento.titulo, prazo: false })),
            ];
            const fora = d.getMonth() !== referencia.getMonth();
            const classes = ["mes-dia", fora && "fora", chave === hoje && "hoje"].filter(Boolean).join(" ");
            return (
              <div key={chave} role="gridcell">
                <Button className={classes} onPress={() => aoAbrirDia(d)} aria-label={`${t.abrirDia(fmtDiaLongo.format(d))}${doDia.length ? `, ${doDia.length}` : ""}`}>
                  <span className="mes-numero">{d.getDate()}</span>
                  {doDia.slice(0, 3).map((o) => (
                    <span key={o.id} className={o.prazo ? "mes-evento prazo quebra" : "mes-evento quebra"}>{o.titulo}</span>
                  ))}
                  {doDia.length > 3 && <span className="texto-suave pequeno">{t.mais(doDia.length - 3)}</span>}
                </Button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
