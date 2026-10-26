import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type CorEtiqueta, type Materia } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { EscolherCor } from "../ideias/etiquetas";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";

const t = textos.estudos.materias;

export function novaMateria(): Materia {
  return { id: "", nome: "", professor: "", cor: "mar", criadoEm: 0 };
}

export function FormMateria({ inicial, aoFechar }: { inicial: Materia; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [professor, setProfessor] = useState(inicial.professor);
  const [cor, setCor] = useState<CorEtiqueta>((inicial.cor || "mar") as CorEtiqueta);
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarMateria({ ...inicial, nome, professor, cor });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.nome} valor={nome} aoMudar={setNome} autoFocus maximo={80} semDitado />
      <Campo rotulo={t.professor} valor={professor} aoMudar={setProfessor} maximo={80} semDitado />
      <EscolherCor valor={cor} aoMudar={setCor} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.salvarMudancas : t.salvar}</Button>
      </div>
    </Form>
  );
}
