// Campo "Matéria (opcional)" do caderno e do livro. Some quando ainda não há matéria.
import { useEffect, useId, useState } from "react";
import { api, type Materia } from "../api";
import { textos } from "../textos/pt-BR";

const t = textos.estudos.assunto;

export function EscolherMateria({ valor, aoMudar }: { valor: string; aoMudar: (id: string) => void }) {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const id = useId();
  useEffect(() => { api.listarMaterias().then(setMaterias, () => {}); }, []);
  if (!materias.length) return null;
  return (
    <div className="campo">
      <label className="campo-rotulo" htmlFor={id}>{t.rotulo}</label>
      <select id={id} className="entrada-texto sozinha" value={materias.some((m) => m.id === valor) ? valor : ""} onChange={(e) => aoMudar(e.target.value)}>
        <option value="">{t.nenhuma}</option>
        {materias.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
      <p className="campo-ajuda">{t.ajuda}</p>
    </div>
  );
}
