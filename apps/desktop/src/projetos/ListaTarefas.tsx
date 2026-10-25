import { Plus } from "lucide-react";
import { useState } from "react";
import { Button, Checkbox, Form } from "react-aria-components";
import { api, type Tarefa } from "../api";
import { Campo } from "../componentes/Campo";
import { textos } from "../textos/pt-BR";
import { EtiquetaPeso, MenuTarefa } from "./acoesTarefa";

const t = textos.projeto;

interface Props {
  projetoId: string;
  tarefas: Tarefa[];
  executar: (acao: () => Promise<unknown>) => void;
}

/** Etapas com subtarefas, marcadas com caixa de seleção. */
export function ListaTarefas({ projetoId, tarefas, executar }: Props) {
  const etapas = tarefas.filter((x) => x.paiId === projetoId);
  return (
    <div className="lista-tarefas largura-leitura">
      <NovaTarefa paiId={projetoId} rotulo={t.novaTarefa} executar={executar} />
      {etapas.length === 0 ? (
        <p className="texto-suave">{t.semTarefas}</p>
      ) : (
        <ul className="tarefas">
          {etapas.map((e) => (
            <ItemTarefa key={e.id} tarefa={e} irmas={etapas} todas={tarefas} executar={executar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemTarefa({ tarefa, irmas, todas, executar }: { tarefa: Tarefa; irmas: Tarefa[]; todas: Tarefa[]; executar: Props["executar"] }) {
  const [abrindoSub, setAbrindoSub] = useState(false);
  const filhas = todas.filter((x) => x.paiId === tarefa.id);
  const eEtapa = !todas.some((x) => x.id === tarefa.paiId);
  return (
    <li className="tarefa">
      <div className="tarefa-linha">
        <Checkbox
          className="caixa"
          isSelected={tarefa.estado === "feita"}
          onChange={(feita) => executar(() => api.mudarEstadoTarefa(tarefa.id, feita ? "feita" : "a_fazer"))}
          aria-label={t.marcarFeita(tarefa.titulo)}
        >
          <span className="caixa-quadrado" aria-hidden="true">
            <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
          </span>
          <span className={tarefa.estado === "feita" ? "tarefa-titulo feita quebra" : "tarefa-titulo quebra"}>{tarefa.titulo}</span>
        </Checkbox>
        <EtiquetaPeso peso={tarefa.peso} />
        {tarefa.estado === "fazendo" && <span className="etiqueta-estado estado-fazendo">{t.estadosTarefa.fazendo}</span>}
        {eEtapa && (
          <Button className="botao-icone" aria-label={`${t.adicionarSubtarefa}: ${tarefa.titulo}`} onPress={() => setAbrindoSub((v) => !v)}>
            <Plus aria-hidden="true" size="1.1em" />
          </Button>
        )}
        <MenuTarefa tarefa={tarefa} irmas={irmas} executar={executar} />
      </div>
      {(filhas.length > 0 || abrindoSub) && (
        <ul className="tarefas subtarefas">
          {filhas.map((f) => (
            <ItemTarefa key={f.id} tarefa={f} irmas={filhas} todas={todas} executar={executar} />
          ))}
          {abrindoSub && (
            <li>
              <NovaTarefa paiId={tarefa.id} rotulo={t.novaSubtarefa} executar={executar} autoFocus />
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

function NovaTarefa({ paiId, rotulo, executar, autoFocus }: { paiId: string; rotulo: string; executar: Props["executar"]; autoFocus?: boolean }) {
  const [titulo, setTitulo] = useState("");
  return (
    <Form
      className="linha-campo"
      onSubmit={(e) => (e.preventDefault(), titulo.trim() && executar(async () => (await api.criarTarefa(paiId, titulo), setTitulo(""))))}
    >
      <Campo rotulo={rotulo} valor={titulo} aoMudar={setTitulo} autoFocus={autoFocus} />
      <Button className="botao" type="submit" isDisabled={!titulo.trim()}>{t.adicionar}</Button>
    </Form>
  );
}
