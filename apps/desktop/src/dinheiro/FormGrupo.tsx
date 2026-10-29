import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, CORES_ETIQUETA, type CorEtiqueta, type Grupo } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { avisarMudanca } from "../dados";
import { EscolherCor } from "../ideias/etiquetas";
import { textos } from "../textos/pt-BR";

const t = textos.dinheiro.grupos;

/** Cores para grupos novos, em rodízio. O cinza fica para o "sem grupo". */
const CORES_GRUPO = CORES_ETIQUETA.filter((c) => c !== "cinza");
export function proximaCor(grupos: Grupo[]): CorEtiqueta {
  return CORES_GRUPO[grupos.length % CORES_GRUPO.length];
}

export function FormGrupo({ inicial, aoFechar }: { inicial: Grupo; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [cor, setCor] = useState<CorEtiqueta>((inicial.cor || "mar") as CorEtiqueta);
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarGrupoGasto({ ...inicial, nome, cor });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.nome} valor={nome} aoMudar={setNome} autoFocus maximo={40} semDitado />
      <EscolherCor valor={cor} aoMudar={setCor} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.salvarMudancas : t.salvar}</Button>
      </div>
    </Form>
  );
}
