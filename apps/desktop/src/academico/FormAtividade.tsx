import { useId, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type Atividade, type Materia } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { Interruptor } from "../componentes/Interruptor";
import { Segmentado } from "../componentes/Segmentado";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";
import type { ExtrasAtividade } from "./extras";
import { aceitaNota, bimestreDaData, perfilDoNivel, tipoMostrado, tipoNativo, TIPOS_ATIVIDADE, type PerfilNivel, type TipoAtividade } from "./nivel";

const t = textos.estudos.atividade;

export function novaAtividade(materiaId: string): Atividade {
  return { id: "", materiaId, tipo: "prova", titulo: "", data: "", peso: null, nota: null, feita: false, criadoEm: 0 };
}

/** Nome do tipo no vocabulário do nível ("dever de casa" na escola, "lista" na faculdade). */
export function nomeTipo(tipo: TipoAtividade, perfil: PerfilNivel): string {
  if (tipo === "dever" && perfil.vocabulario === "disciplina") return textos.estudos.tiposFaculdade.dever;
  return textos.estudos.tipos[tipo];
}

export function FormAtividade({
  inicial,
  materias,
  aoFechar,
  perfil = perfilDoNivel("todos"),
  extras,
  tipoInicial,
  aoSalvarExtras,
}: {
  inicial: Atividade;
  materias: Materia[];
  aoFechar: () => void;
  perfil?: PerfilNivel;
  extras?: ExtrasAtividade;
  /** Tipo já escolhido no botão "+ Adicionar". */
  tipoInicial?: TipoAtividade;
  aoSalvarExtras?: (id: string, extras: ExtrasAtividade) => void;
}) {
  const [tipo, setTipo] = useState<TipoAtividade>(tipoInicial ?? tipoMostrado(inicial.tipo || "prova", extras?.tipo));
  const [materiaId, setMateriaId] = useState(inicial.materiaId || materias[0]?.id || "");
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [data, setData] = useState(inicial.data);
  const [peso, setPeso] = useState(inicial.peso == null ? "" : String(inicial.peso));
  const [nota, setNota] = useState(inicial.nota == null ? "" : String(inicial.nota));
  const [bimestre, setBimestre] = useState<string>(extras?.bimestre ? String(extras.bimestre) : "");
  const [feita, setFeita] = useState(inicial.feita);
  const [erro, setErro] = useState<string | null>(null);
  const idMateria = useId();
  const idBimestre = useId();
  const editando = inicial.id !== "";
  const comBimestre = perfil.periodo === "bimestre";
  // A nota aparece quando o nível usa notas — ou quando já existe uma (nunca esconder dado lançado).
  const comNota = aceitaNota(tipo) && (perfil.notas || inicial.nota != null || inicial.peso != null);
  // Sem bimestre escolhido, a data sugere um.
  const bimestreSugerido = bimestre === "" && data ? String(bimestreDaData(data)) : bimestre;

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
      const salva = await api.salvarAtividade({
        ...inicial,
        materiaId,
        tipo: tipoNativo(tipo),
        titulo,
        data,
        // Dever e leitura não entram na média: sem peso nem nota.
        peso: aceitaNota(tipo) ? numero(peso) : null,
        nota: aceitaNota(tipo) ? numero(nota) : null,
        feita,
      });
      aoSalvarExtras?.(salva.id, {
        tipo,
        bimestre: comBimestre && bimestreSugerido ? Number(bimestreSugerido) : (extras?.bimestre ?? null),
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
        aoMudar={(v) => setTipo(v as TipoAtividade)}
        opcoes={TIPOS_ATIVIDADE.map((v) => ({ valor: v, nome: nomeTipo(v, perfil) }))}
      />
      <div className="campo">
        <label className="campo-rotulo" htmlFor={idMateria}>{perfil.vocabulario === "disciplina" ? t.disciplina : t.materia}</label>
        <select id={idMateria} className="entrada-texto sozinha" value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
          {materias.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </select>
      </div>
      <Campo rotulo={t.titulo} valor={titulo} aoMudar={setTitulo} autoFocus maximo={120} semDitado />
      <CampoData rotulo={t.data} tipo="date" valor={data} aoMudar={setData} />
      {comBimestre && (
        <div className="campo">
          <label className="campo-rotulo" htmlFor={idBimestre}>{t.bimestre}</label>
          <select id={idBimestre} className="entrada-texto sozinha" value={bimestreSugerido} onChange={(e) => setBimestre(e.target.value)} aria-describedby={`${idBimestre}-ajuda`}>
            <option value="">{t.semBimestre}</option>
            {[1, 2, 3, 4].map((n) => <option key={n} value={String(n)}>{t.bimestreNome(n)}</option>)}
          </select>
          <p id={`${idBimestre}-ajuda`} className="campo-ajuda">{t.bimestreAjuda}</p>
        </div>
      )}
      {comNota && (
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
