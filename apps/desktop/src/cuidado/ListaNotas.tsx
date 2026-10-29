import { useEffect, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type Nota } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Check, Plus, Trash2, RotateCcw } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";

const tc = textos.cuidado;

interface Props {
  profissionalId: string;
  tipo: "pauta" | "pergunta";
  rotulos: { campo: string; adicionar: string; vazio: string; marcar: string; desmarcar: string; feitas?: string };
}

/** Lista de anotações curtas de um tipo, com captura rápida, marcar e apagar. */
export function ListaNotas({ profissionalId, tipo, rotulos }: Props) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();
  const recado = useRecado();

  useEffect(() => {
    api.listarNotasCuidado(profissionalId, tipo).then(setNotas, (e) => setErro(e instanceof Error ? e.message : String(e)));
  }, [profissionalId, tipo, mudancas]);

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setErro(null);
    try {
      await api.criarNotaCuidado(profissionalId, tipo, texto);
      setTexto("");
      avisarMudanca();
      recado(tc.adicionada);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  const marcar = async (n: Nota) => {
    await api.marcarNotaCuidado(n.id, !n.feita);
    avisarMudanca();
  };

  const apagar = async (id: string) => {
    await api.excluirNotaCuidado(id);
    avisarMudanca();
  };

  const abertas = notas.filter((n) => !n.feita);
  const feitas = notas.filter((n) => n.feita);

  const linha = (n: Nota) => (
    <li key={n.id} className={n.feita ? "linha-ajuste feito" : "linha-ajuste"}>
      <span className="quebra">{n.texto}</span>
      <span className="linha-ajuste">
        <Button
          className="botao-icone"
          onPress={() => void marcar(n)}
          aria-label={`${n.feita ? rotulos.desmarcar : rotulos.marcar}: ${n.texto}`}
        >
          {n.feita ? <RotateCcw aria-hidden="true" size="1.1em" /> : <Check aria-hidden="true" size="1.1em" />}
        </Button>
        <Button className="botao-icone" onPress={() => void apagar(n.id)} aria-label={`${tc.excluir}: ${n.texto}`}>
          <Trash2 aria-hidden="true" size="1.1em" />
        </Button>
      </span>
    </li>
  );

  return (
    <>
      <Form className="formulario cuidado-nota-form" onSubmit={adicionar}>
        <Campo rotulo={rotulos.campo} valor={texto} aoMudar={setTexto} multilinha />
        <div className="botoes">
          <Button className="botao" type="submit">
            <Plus aria-hidden="true" size="1.1em" /> {rotulos.adicionar}
          </Button>
        </div>
      </Form>
      <Aviso>{erro}</Aviso>
      {notas.length === 0 ? (
        <p className="texto-suave">{rotulos.vazio}</p>
      ) : (
        <>
          {abertas.length > 0 && <ul className="lista-simples sem-marcador cuidado-notas">{abertas.map(linha)}</ul>}
          {feitas.length > 0 && (
            <details className="cuidado-recolhivel">
              <summary>{rotulos.feitas ? `${rotulos.feitas} (${feitas.length})` : String(feitas.length)}</summary>
              <ul className="lista-simples sem-marcador cuidado-notas">{feitas.map(linha)}</ul>
            </details>
          )}
        </>
      )}
    </>
  );
}
