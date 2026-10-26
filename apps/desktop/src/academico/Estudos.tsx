import { useEffect, useMemo, useState } from "react";
import { Button, Form } from "react-aria-components";
import { chaveDia } from "../agenda/datas";
import { api, type Atividade, type Materia } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { Check, Pencil, Plus, RotateCcw, Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { FormMateria, novaMateria } from "./FormMateria";
import { FormAtividade, novaAtividade } from "./FormAtividade";
import { GradeHorario } from "./Grade";
import { mediaPonderada, situacao } from "./media";

const t = textos.estudos;
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const numeroBonito = (n: number) => n.toFixed(1).replace(".", ",");
const dataLegivel = (iso: string) => (iso ? fmtData.format(new Date(`${iso}T00:00:00`)) : t.semData);

export function PaginaEstudos() {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [aprovacao, setAprovacao] = useState(6);
  const [editandoMateria, setEditandoMateria] = useState<Materia | null>(null);
  const [editandoAtividade, setEditandoAtividade] = useState<Atividade | null>(null);
  const [excluindoMateria, setExcluindoMateria] = useState<Materia | null>(null);
  const [excluindoAtividade, setExcluindoAtividade] = useState<Atividade | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarMaterias().then(setMaterias, (e) => setErro(e instanceof Error ? e.message : String(e)));
    api.listarAtividades().then(setAtividades, () => {});
    api.mediaAprovacao().then(setAprovacao, () => {});
  }, [mudancas]);

  const porMateria = useMemo(() => new Map(materias.map((m) => [m.id, m])), [materias]);
  const hoje = chaveDia(new Date());

  // "O que vem aí": por fazer e (sem data ou de hoje em diante). As com data primeiro.
  const proximas = atividades
    .filter((a) => !a.feita && (a.data === "" || a.data >= hoje))
    .sort((a, b) => (a.data === b.data ? 0 : a.data === "" ? 1 : b.data === "" ? -1 : a.data < b.data ? -1 : 1));
  const passadas = atividades
    .filter((a) => a.feita || (a.data !== "" && a.data < hoje))
    .sort((a, b) => (a.data < b.data ? 1 : -1));

  const marcar = async (a: Atividade, feita: boolean) => {
    await api.marcarAtividade(a.id, feita);
    avisarMudanca();
  };

  const excluirMateria = async () => {
    if (!excluindoMateria) return;
    await api.excluirMateria(excluindoMateria.id);
    setExcluindoMateria(null);
    avisarMudanca();
  };
  const excluirAtividade = async () => {
    if (!excluindoAtividade) return;
    await api.excluirAtividade(excluindoAtividade.id);
    setExcluindoAtividade(null);
    avisarMudanca();
  };

  const Linha = ({ a }: { a: Atividade }) => {
    const m = porMateria.get(a.materiaId);
    return (
      <li className={a.feita ? "linha-ajuste feito" : "linha-ajuste"}>
        <span className="quebra">
          <span className="etiqueta-chip">
            {m && <span className={`etiqueta-cor cor-${m.cor}`} aria-hidden="true" />}
            <strong>{a.titulo}</strong>
          </span>
          <br />
          <span className="texto-suave">
            {t.tipos[a.tipo as "prova" | "trabalho" | "dever"]}
            {m ? ` · ${m.nome}` : ""} · {dataLegivel(a.data)}
            {a.nota != null && ` · ${t.notaDe(numeroBonito(a.nota))}`}
          </span>
        </span>
        <span className="linha-ajuste">
          <Button className="botao-icone" onPress={() => void marcar(a, !a.feita)} aria-label={a.feita ? t.desmarcarFeita : t.marcarFeita}>
            {a.feita ? <RotateCcw aria-hidden="true" size="1.1em" /> : <Check aria-hidden="true" size="1.1em" />}
          </Button>
          <Button className="botao-icone" onPress={() => setEditandoAtividade(a)} aria-label={`${t.atividade.editar}: ${a.titulo}`}>
            <Pencil aria-hidden="true" size="1.1em" />
          </Button>
          <Button className="botao-icone" onPress={() => setExcluindoAtividade(a)} aria-label={`${t.atividade.excluir}: ${a.titulo}`}>
            <Trash2 aria-hidden="true" size="1.1em" />
          </Button>
        </span>
      </li>
    );
  };

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <section className="cartao largura-leitura esticado" aria-labelledby="vem-ai">
        <h2 id="vem-ai">{t.proximas}</h2>
        {materias.length === 0 ? (
          <p className="texto-suave">{t.semMateriaAinda}</p>
        ) : proximas.length === 0 ? (
          <p className="texto-suave">{t.semProximas}</p>
        ) : (
          <ul className="lista-simples sem-marcador">{proximas.map((a) => <Linha key={a.id} a={a} />)}</ul>
        )}
        {materias.length > 0 && (
          <div className="botoes">
            <Button className="botao principal" onPress={() => setEditandoAtividade(novaAtividade(materias[0].id))}>
              <Plus aria-hidden="true" size="1.1em" /> {t.adicionarAtividade}
            </Button>
          </div>
        )}
      </section>

      {passadas.length > 0 && (
        <section className="cartao largura-leitura esticado" aria-labelledby="ja-passou">
          <h2 id="ja-passou">{t.historico}</h2>
          <ul className="lista-simples sem-marcador">{passadas.map((a) => <Linha key={a.id} a={a} />)}</ul>
        </section>
      )}

      {materias.length > 0 && (
        <section className="cartao largura-leitura esticado" aria-labelledby="como-vao">
          <h2 id="como-vao">{t.notas.comoVai}</h2>
          <p className="campo-ajuda">{t.notas.explicacao}</p>
          <ul className="lista-simples sem-marcador">
            {materias.map((m) => {
              const media = mediaPonderada(atividades.filter((a) => a.materiaId === m.id));
              const sit = situacao(media, aprovacao);
              return (
                <li key={m.id} className="linha-ajuste">
                  <span className="etiqueta-chip">
                    <span className={`etiqueta-cor cor-${m.cor}`} aria-hidden="true" />
                    {m.nome}
                  </span>
                  <span className="quebra texto-suave">
                    {media == null ? t.notas.semNota : `${t.notas.media(numeroBonito(media))} · ${t.notas[sit as "acima" | "perto" | "abaixo"]}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <MediaAprovacao atual={aprovacao} />
        </section>
      )}

      {materias.length > 0 && (
        <section className="cartao largura-leitura esticado" aria-labelledby="grade">
          <h2 id="grade">{t.grade.titulo}</h2>
          <p className="texto-suave">{t.grade.intro}</p>
          <GradeHorario materias={materias} />
        </section>
      )}

      <section className="cartao largura-leitura esticado" aria-labelledby="materias">
        <h2 id="materias">{t.materias.titulo}</h2>
        <p className="texto-suave">{t.materias.intro}</p>
        {materias.length === 0 ? (
          <p className="texto-suave">{t.materias.semMaterias}</p>
        ) : (
          <ul className="lista-simples sem-marcador">
            {materias.map((m) => (
              <li key={m.id} className="linha-ajuste">
                <span className="etiqueta-chip">
                  <span className={`etiqueta-cor cor-${m.cor}`} aria-hidden="true" />
                  <strong>{m.nome}</strong>
                  {m.professor && <span className="texto-suave"> · {m.professor}</span>}
                </span>
                <span className="linha-ajuste">
                  <Button className="botao-icone" onPress={() => setEditandoMateria(m)} aria-label={`${t.materias.editar}: ${m.nome}`}>
                    <Pencil aria-hidden="true" size="1.1em" />
                  </Button>
                  <Button className="botao-icone" onPress={() => setExcluindoMateria(m)} aria-label={`${t.materias.excluir}: ${m.nome}`}>
                    <Trash2 aria-hidden="true" size="1.1em" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="botoes">
          <Button className="botao principal" onPress={() => setEditandoMateria(novaMateria())}>
            <Plus aria-hidden="true" size="1.1em" /> {t.materias.adicionar}
          </Button>
        </div>
      </section>

      <Aviso>{erro}</Aviso>

      <Janela titulo={editandoMateria && editandoMateria.id ? t.materias.editar : t.materias.novo} aberta={editandoMateria !== null} aoFechar={() => setEditandoMateria(null)}>
        {editandoMateria && <FormMateria key={editandoMateria.id || "novo"} inicial={editandoMateria} aoFechar={() => setEditandoMateria(null)} />}
      </Janela>

      <Janela titulo={editandoAtividade && editandoAtividade.id ? t.atividade.editar : t.atividade.novo} aberta={editandoAtividade !== null} aoFechar={() => setEditandoAtividade(null)}>
        {editandoAtividade && <FormAtividade key={editandoAtividade.id || "novo"} inicial={editandoAtividade} materias={materias} aoFechar={() => setEditandoAtividade(null)} />}
      </Janela>

      <Confirmar titulo={t.materias.excluir} texto={excluindoMateria ? t.materias.confirmarExcluir(excluindoMateria.nome) : ""} confirmar={t.materias.excluir} aberta={excluindoMateria !== null} aoCancelar={() => setExcluindoMateria(null)} aoConfirmar={() => void excluirMateria()} />
      <Confirmar titulo={t.atividade.excluir} texto={excluindoAtividade ? `${t.atividade.excluir}: ${excluindoAtividade.titulo}?` : ""} confirmar={t.atividade.excluir} aberta={excluindoAtividade !== null} aoCancelar={() => setExcluindoAtividade(null)} aoConfirmar={() => void excluirAtividade()} />
    </div>
  );
}

function MediaAprovacao({ atual }: { atual: number }) {
  const [valor, setValor] = useState(String(atual));
  const [erro, setErro] = useState<string | null>(null);
  const recado = useRecado();

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const n = Number(valor.trim().replace(",", "."));
    if (!Number.isFinite(n)) return;
    try {
      await api.definirMediaAprovacao(n);
      avisarMudanca();
      recado(textos.estudos.notas.aprovacaoSalva);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={salvar}>
      <Campo rotulo={textos.estudos.notas.aprovacaoRotulo} valor={valor} aoMudar={setValor} numerico descricao={textos.estudos.notas.aprovacaoAjuda} semDitado />
      <Aviso>{erro}</Aviso>
      <div className="botoes">
        <Button className="botao" type="submit">{textos.estudos.notas.salvarAprovacao}</Button>
      </div>
    </Form>
  );
}
