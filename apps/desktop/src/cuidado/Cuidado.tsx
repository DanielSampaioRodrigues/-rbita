import { useEffect, useState } from "react";
import { Button, Form } from "react-aria-components";
import { somarDias, inicioDoDia } from "../agenda/datas";
import { api, type Remedio, type RegistroSessao } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Quote, Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { ListaNotas } from "./ListaNotas";

const t = textos.cuidado;
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function PaginaCuidado() {
  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <section className="cartao largura-leitura esticado" aria-labelledby="pauta">
        <h2 id="pauta">{t.pauta.titulo}</h2>
        <p className="texto-suave">{t.pauta.intro}</p>
        <ListaNotas
          tipo="pauta"
          rotulos={{ campo: t.pauta.campo, adicionar: t.pauta.adicionar, vazio: t.pauta.vazio, marcar: t.pauta.marcar, desmarcar: t.pauta.desmarcar }}
        />
      </section>

      <section className="cartao largura-leitura esticado" aria-labelledby="perguntas">
        <h2 id="perguntas">{t.perguntas.titulo}</h2>
        <p className="texto-suave">{t.perguntas.intro}</p>
        <ListaNotas
          tipo="pergunta"
          rotulos={{ campo: t.perguntas.campo, adicionar: t.perguntas.adicionar, vazio: t.perguntas.vazio, marcar: t.perguntas.marcar, desmarcar: t.perguntas.desmarcar }}
        />
        <RemediosAtuais />
      </section>

      <SessoesRegistro />
    </div>
  );
}

/** Lembra os remédios cadastrados na Saúde, para ajudar a perguntar. */
function RemediosAtuais() {
  const [remedios, setRemedios] = useState<Remedio[]>([]);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarRemedios().then((rs) => setRemedios(rs.filter((r) => r.estado === "ativo")), () => {});
  }, [mudancas]);

  return (
    <div className="campo">
      <span className="campo-rotulo">{t.perguntas.remediosAtuais}</span>
      <p className="campo-ajuda">{t.perguntas.ajudaRemedios}</p>
      {remedios.length === 0 ? (
        <p className="texto-suave">{t.perguntas.semRemedios}</p>
      ) : (
        <ul className="lista-simples sem-marcador">
          {remedios.map((r) => (
            <li key={r.id}>{t.perguntas.remedioLinha(r.nome, r.dose)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SessoesRegistro() {
  const [nota, setNota] = useState("");
  const [sessoes, setSessoes] = useState<RegistroSessao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();
  const recado = useRecado();

  useEffect(() => {
    const ate = somarDias(inicioDoDia(new Date()), 1);
    api.listarSessoes(somarDias(ate, -365).getTime(), ate.getTime()).then(setSessoes, () => {});
  }, [mudancas]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nota.trim()) return;
    setErro(null);
    try {
      await api.registrarSessao(nota);
      setNota("");
      avisarMudanca();
      recado(t.sessoes.salvo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  const apagar = async (id: string) => {
    await api.excluirSessao(id);
    avisarMudanca();
  };

  return (
    <section className="cartao largura-leitura esticado" aria-labelledby="sessoes">
      <h2 id="sessoes">
        <Quote aria-hidden="true" size="1em" /> {t.sessoes.titulo}
      </h2>
      <p className="texto-suave">{t.sessoes.intro}</p>
      <Form className="formulario" onSubmit={guardar}>
        <Campo rotulo={t.sessoes.campo} valor={nota} aoMudar={setNota} multilinha />
        <div className="botoes">
          <Button className="botao principal" type="submit">{t.sessoes.salvar}</Button>
        </div>
      </Form>
      <Aviso>{erro}</Aviso>
      {sessoes.length === 0 ? (
        <p className="texto-suave">{t.sessoes.vazio}</p>
      ) : (
        <ul className="lista-simples sem-marcador">
          {sessoes.map((s) => (
            <li key={s.id} className="linha-ajuste">
              <span className="quebra">
                <strong>{t.sessoes.em(fmtData.format(s.momento))}</strong>
                <br />
                <span>{s.nota}</span>
              </span>
              <Button className="botao-icone" onPress={() => void apagar(s.id)} aria-label={t.sessoes.excluir}>
                <Trash2 aria-hidden="true" size="1.1em" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
