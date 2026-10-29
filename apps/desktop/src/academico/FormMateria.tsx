import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type CorEtiqueta, type Materia } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { EscolherCor } from "../ideias/etiquetas";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";
import type { ExtrasMateria } from "./extras";
import type { PerfilNivel } from "./nivel";

const t = textos.estudos.materias;

export function novaMateria(): Materia {
  return { id: "", nome: "", professor: "", cor: "mar", criadoEm: 0 };
}

export function FormMateria({
  inicial,
  aoFechar,
  perfil,
  extras,
  aoSalvarExtras,
}: {
  inicial: Materia;
  aoFechar: () => void;
  perfil?: PerfilNivel;
  extras?: ExtrasMateria;
  aoSalvarExtras?: (id: string, extras: ExtrasMateria) => void;
}) {
  const [nome, setNome] = useState(inicial.nome);
  const [professor, setProfessor] = useState(inicial.professor);
  const [cor, setCor] = useState<CorEtiqueta>((inicial.cor || "mar") as CorEtiqueta);
  const [creditos, setCreditos] = useState(extras?.creditos == null ? "" : String(extras.creditos));
  const [periodo, setPeriodo] = useState(extras?.periodo ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";
  const disciplina = perfil?.vocabulario === "disciplina";
  const comCreditos = perfil?.creditos ?? false;
  const comSemestre = perfil?.periodo === "semestre";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      const salva = await api.salvarMateria({ ...inicial, nome, professor, cor });
      if (aoSalvarExtras) {
        const n = Number(creditos.trim().replace(",", "."));
        aoSalvarExtras(salva.id, {
          creditos: creditos.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : comCreditos ? null : (extras?.creditos ?? null),
          periodo: comSemestre ? periodo.trim() : (extras?.periodo ?? ""),
        });
      }
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={disciplina ? t.nomeDisciplina : t.nome} valor={nome} aoMudar={setNome} autoFocus maximo={80} semDitado />
      <Campo rotulo={t.professor} valor={professor} aoMudar={setProfessor} maximo={80} semDitado />
      {comSemestre && <Campo rotulo={t.periodo} valor={periodo} aoMudar={setPeriodo} maximo={40} descricao={t.periodoAjuda} semDitado />}
      {comCreditos && <Campo rotulo={t.creditos} valor={creditos} aoMudar={setCreditos} numerico maximo={6} descricao={t.creditosAjuda} semDitado />}
      <EscolherCor valor={cor} aoMudar={setCor} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.salvarMudancas : t.salvar}</Button>
      </div>
    </Form>
  );
}
