import { useEffect, useId, useMemo, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type Aula, type Materia } from "../api";
import { Aviso } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { Plus, Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";

const t = textos.estudos.grade;

export function novaAula(materiaId: string): Aula {
  return { id: "", materiaId, diaSemana: 1, inicio: "08:00", fim: "", criadoEm: 0 };
}

/** Grade de horário semanal: as aulas como blocos fixos por dia, por matéria. */
export function GradeHorario({ materias }: { materias: Materia[] }) {
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [editando, setEditando] = useState<Aula | null>(null);
  const [excluindo, setExcluindo] = useState<Aula | null>(null);
  const mudancas = useMudancas();
  const porMateria = useMemo(() => new Map(materias.map((m) => [m.id, m])), [materias]);

  useEffect(() => {
    api.listarAulas().then(setAulas, () => {});
  }, [mudancas]);

  const excluir = async () => {
    if (!excluindo) return;
    await api.excluirAula(excluindo.id);
    setExcluindo(null);
    avisarMudanca();
  };

  const porDia = (dia: number) => aulas.filter((a) => a.diaSemana === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));

  return (
    <>
      {aulas.length === 0 && <p className="texto-suave">{t.semAulas}</p>}
      <div className="grade-semana">
        {t.dias.map((nome, dia) => (
          <div key={dia} className="grade-dia">
            <h3 className="grade-dia-nome">{nome}</h3>
            <ul className="lista-simples sem-marcador">
              {porDia(dia).map((a) => {
                const m = porMateria.get(a.materiaId);
                return (
                  <li key={a.id}>
                    <button className={`grade-aula borda-${m?.cor ?? "cinza"}`} onClick={() => setEditando(a)} aria-label={`${t.editarTitulo}: ${m?.nome ?? ""}`}>
                      <span className="grade-aula-hora">{t.faixa(a.inicio, a.fim)}</span>
                      <span className="quebra">{m?.nome ?? "—"}</span>
                    </button>
                  </li>
                );
              })}
              {porDia(dia).length === 0 && <li className="texto-suave pequeno grade-vazio">{t.semAula}</li>}
            </ul>
          </div>
        ))}
      </div>

      <div className="botoes">
        <Button className="botao principal" isDisabled={materias.length === 0} onPress={() => setEditando(novaAula(materias[0]?.id ?? ""))}>
          <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
        </Button>
      </div>
      {materias.length === 0 && <p className="campo-ajuda">{t.precisaMateria}</p>}

      <Janela titulo={editando && editando.id ? t.editarTitulo : t.novo} aberta={editando !== null} aoFechar={() => setEditando(null)}>
        {editando && (
          <FormAula
            key={editando.id || "novo"}
            inicial={editando}
            materias={materias}
            aoFechar={() => setEditando(null)}
            aoExcluir={editando.id ? () => { setExcluindo(editando); setEditando(null); } : undefined}
          />
        )}
      </Janela>

      <Confirmar titulo={t.excluir} texto={excluindo ? t.excluir : ""} confirmar={t.excluir} aberta={excluindo !== null} aoCancelar={() => setExcluindo(null)} aoConfirmar={() => void excluir()} />
    </>
  );
}

function FormAula({ inicial, materias, aoFechar, aoExcluir }: { inicial: Aula; materias: Materia[]; aoFechar: () => void; aoExcluir?: () => void }) {
  const [materiaId, setMateriaId] = useState(inicial.materiaId || materias[0]?.id || "");
  const [diaSemana, setDiaSemana] = useState(inicial.diaSemana);
  const [inicio, setInicio] = useState(inicial.inicio);
  const [fim, setFim] = useState(inicial.fim);
  const [erro, setErro] = useState<string | null>(null);
  const idMateria = useId();
  const idDia = useId();
  const idInicio = useId();
  const idFim = useId();
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarAula({ ...inicial, materiaId, diaSemana, inicio, fim });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <div className="campo">
        <label className="campo-rotulo" htmlFor={idMateria}>{t.materia}</label>
        <select id={idMateria} className="entrada-texto sozinha" value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </div>
      <div className="campo">
        <label className="campo-rotulo" htmlFor={idDia}>{t.dia}</label>
        <select id={idDia} className="entrada-texto sozinha" value={diaSemana} onChange={(e) => setDiaSemana(Number(e.target.value))}>
          {t.dias.map((nome, dia) => <option key={dia} value={dia}>{nome}</option>)}
        </select>
      </div>
      <div className="campo">
        <label className="campo-rotulo" htmlFor={idInicio}>{t.inicio}</label>
        <input id={idInicio} type="time" className="entrada-texto sozinha" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
      </div>
      <div className="campo">
        <label className="campo-rotulo" htmlFor={idFim}>{t.fim}</label>
        <input id={idFim} type="time" className="entrada-texto sozinha" value={fim} onChange={(e) => setFim(e.target.value)} />
      </div>
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        {aoExcluir && <Button className="botao com-icone" onPress={aoExcluir}><Trash2 aria-hidden="true" size="1em" /> {t.excluir}</Button>}
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.salvarMudancas : t.salvar}</Button>
      </div>
    </Form>
  );
}
