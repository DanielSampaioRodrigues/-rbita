import { useId, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type Atividade, type Materia } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { Interruptor } from "../componentes/Interruptor";
import { Segmentado } from "../componentes/Segmentado";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";

const t = textos.estudos.atividade;
type Tipo = "prova" | "trabalho" | "dever";

export function novaAtividade(materiaId: string): Atividade {
  return { id: "", materiaId, tipo: "prova", titulo: "", data: "", peso: null, nota: null, feita: false, criadoEm: 0 };
}

export function FormAtividade({ inicial, materias, aoFechar }: { inicial: Atividade; materias: Materia[]; aoFechar: () => void }) {
  const [tipo, setTipo] = useState<Tipo>((inicial.tipo as Tipo) || "prova");
  const [materiaId, setMateriaId] = useState(inicial.materiaId || materias[0]?.id || "");
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [data, setData] = useState(inicial.data);
  const [peso, setPeso] = useState(inicial.peso == null ? "" : String(inicial.peso));
  const [nota, setNota] = useState(inicial.nota == null ? "" : String(inicial.nota));
  const [feita, setFeita] = useState(inicial.feita);
  const [erro, setErro] = useState<string | null>(null);
  const idMateria = useId();
  const editando = inicial.id !== "";

  const numero = (txt: string): number | null => {
    const limpo = txt.trim().replace(",", ".");
    if (limpo === "") return null;
    const n = Number(limpo);
    return Number.isFinite(n) ? n : null;
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarAtividade({
        ...inicial,
        materiaId,
        tipo,
        titulo,
        data,
        // Dever de casa não entra na média: sem peso nem nota.
        peso: tipo === "dever" ? null : numero(peso),
        nota: tipo === "dever" ? null : numero(nota),
        feita,
      });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <Segmentado
        rotulo={t.tipo}
        valor={tipo}
        aoMudar={(v) => setTipo(v as Tipo)}
        opcoes={[
          { valor: "prova", nome: textos.estudos.tipos.prova },
          { valor: "trabalho", nome: textos.estudos.tipos.trabalho },
          { valor: "dever", nome: textos.estudos.tipos.dever },
        ]}
      />
      <div className="campo">
        <label className="campo-rotulo" htmlFor={idMateria}>{t.materia}</label>
        <select id={idMateria} className="entrada-texto sozinha" value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
          {materias.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </select>
      </div>
      <Campo rotulo={t.titulo} valor={titulo} aoMudar={setTitulo} autoFocus maximo={120} semDitado />
      <CampoData rotulo={t.data} tipo="date" valor={data} aoMudar={setData} />
      {tipo !== "dever" && (
        <>
          <Campo rotulo={t.peso} valor={peso} aoMudar={setPeso} numerico descricao={t.pesoAjuda} semDitado />
          <Campo rotulo={t.nota} valor={nota} aoMudar={setNota} numerico descricao={t.notaAjuda} semDitado />
        </>
      )}
      <Interruptor rotulo={t.feita} ligado={feita} aoMudar={setFeita} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.salvarMudancas : t.salvar}</Button>
      </div>
    </Form>
  );
}
