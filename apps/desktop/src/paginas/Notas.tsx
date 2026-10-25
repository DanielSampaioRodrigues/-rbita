import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type Nota } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { textos } from "../textos/pt-BR";

const t = textos.notas;

const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function Notas() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.listarNotas().then(setNotas, (e) => setErro(String(e?.message ?? e)));
  }, []);

  const adicionar = async () => {
    if (!texto.trim()) return;
    try {
      const nota = await api.criarNota(texto);
      setNotas((n) => [nota, ...n]);
      setTexto("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  const excluir = async (id: string) => {
    try {
      await api.excluirNota(id);
      setNotas((n) => n.filter((x) => x.id !== id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="cartao">
      <h2>{t.titulo}</h2>
      <p className="texto-suave">{t.explicacao}</p>
      <Form className="linha-campo" onSubmit={(e) => (e.preventDefault(), adicionar())}>
        <Campo rotulo={t.campo} valor={texto} aoMudar={setTexto} />
        <Button className="botao principal" type="submit" isDisabled={!texto.trim()}>{t.adicionar}</Button>
      </Form>
      <Aviso>{erro}</Aviso>
      {notas.length === 0 ? (
        <p className="texto-suave">{t.vazio}</p>
      ) : (
        <ul className="lista-notas">
          {notas.map((n) => (
            <li key={n.id}>
              <span className="nota-texto">{n.texto}</span>
              <span className="nota-data">{formatoData.format(n.criadoEm)}</span>
              <Button className="botao-icone" aria-label={`${t.excluir}: ${n.texto}`} onPress={() => excluir(n.id)}>
                <Trash2 aria-hidden="true" size="1.1em" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
