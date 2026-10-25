import { Flag } from "../icones";
import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type Tarefa } from "../api";
import { Aviso } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { Janela } from "../componentes/Janela";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";

const t = textos.projeto;
const fmtCurto = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });

/** "AAAA-MM-DD" para Date local (sem fuso). */
export function dataLocal(d: string): Date {
  const [a, m, dia] = d.split("-").map(Number);
  return new Date(a, m - 1, dia);
}

export const formatarDataCurta = (d: string) => fmtCurto.format(dataLocal(d)).replace(".", "");

export function EtiquetaPrazo({ prazo }: { prazo: string | null }) {
  if (!prazo) return null;
  return (
    <span className="etiqueta-estado prazo">
      <Flag aria-hidden="true" size="0.85em" /> {t.prazoAte(formatarDataCurta(prazo))}
    </span>
  );
}

/** Janela para definir (ou tirar) o prazo de uma tarefa. */
export function JanelaPrazo({ tarefa, aoFechar }: { tarefa: Tarefa | null; aoFechar: () => void }) {
  return (
    <Janela titulo={t.prazoTitulo} aberta={!!tarefa} aoFechar={aoFechar} pequena>
      {tarefa && <FormPrazo key={tarefa.id} tarefa={tarefa} aoFechar={aoFechar} />}
    </Janela>
  );
}

function FormPrazo({ tarefa, aoFechar }: { tarefa: Tarefa; aoFechar: () => void }) {
  const [data, setData] = useState(tarefa.prazo ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const salvar = async (prazo: string | null) => {
    try {
      await api.definirPrazoTarefa(tarefa.id, prazo);
      avisarMudanca();
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Form className="formulario" onSubmit={(e) => (e.preventDefault(), data && salvar(data))}>
      <p className="campo-rotulo quebra">{tarefa.titulo}</p>
      <CampoData rotulo={t.prazo} tipo="date" valor={data} aoMudar={setData} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        {tarefa.prazo && <Button className="botao separado" onPress={() => salvar(null)}>{t.tirarPrazo}</Button>}
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!data}>{textos.comum.salvar}</Button>
      </div>
    </Form>
  );
}
