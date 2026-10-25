import { BatteryLow, Lightbulb, PenLine } from "lucide-react";
import { RegistroRapido } from "../energia/Energia";
import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { expandir, inicioDoDia, somarDias, type Ocorrencia } from "../agenda/datas";
import { LinhaOcorrencia } from "../agenda/Agenda";
import { api, type Projeto } from "../api";
import { useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { CartaoProjeto } from "./Projetos";

const t = textos.inicio;

interface Props {
  aoCapturar: () => void;
  aoAbrirProjeto: (id: string) => void;
  aoIr: (secao: "ideias" | "projetos" | "agenda") => void;
  aoLigarBaixa: () => void;
}

/** Retomar importa tanto quanto começar: o Início abre com os projetos ativos e o próximo passo de cada um. */
export function Inicio({ aoCapturar, aoAbrirProjeto, aoIr, aoLigarBaixa }: Props) {
  const [ativos, setAtivos] = useState<Projeto[]>([]);
  const [ideias, setIdeias] = useState(0);
  const [hoje, setHoje] = useState<Ocorrencia[]>([]);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarProjetos().then((ps) => setAtivos(ps.filter((p) => p.estado === "ativo")), () => {});
    api.listarIdeias().then((is) => setIdeias(is.length), () => {});
    const de = inicioDoDia(new Date());
    const ate = somarDias(de, 1);
    api.listarEventos(de.getTime(), ate.getTime()).then((es) => setHoje(expandir(es, de, ate)), () => {});
  }, [mudancas]);

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.construcao}</p>
      <Button className="botao principal" onPress={aoCapturar}>
        <PenLine aria-hidden="true" size="1.1em" /> {t.capturar}
      </Button>

      <section className="cartao largura-leitura esticado">
        <RegistroRapido />
        <div className="links">
          <Button className="link com-icone" onPress={aoLigarBaixa}>
            <BatteryLow aria-hidden="true" size="1.1em" /> {textos.energia.ligarBaixa}
          </Button>
        </div>
      </section>

      <section className="grupo largura-leitura" aria-labelledby="hoje">
        <h2 id="hoje">{t.hoje}</h2>
        {hoje.length === 0 ? (
          <p className="texto-suave">{t.nadaHoje}</p>
        ) : (
          <ul className="lista-ocorrencias">
            {hoje.map((o) => (
              <li key={o.evento.id + o.dia}>
                <LinhaOcorrencia o={o} />
              </li>
            ))}
          </ul>
        )}
        <div className="links">
          <Button className="link" onPress={() => aoIr("agenda")}>{t.verAgenda}</Button>
        </div>
      </section>

      <section className="grupo largura-leitura" aria-labelledby="continuar">
        <h2 id="continuar">{t.continuar}</h2>
        {ativos.length === 0 ? (
          <p className="texto-suave">{t.nenhumAtivo}</p>
        ) : (
          <ul className="lista-cartoes">
            {ativos.map((p) => (
              <li key={p.id}>
                <CartaoProjeto projeto={p} aoAbrir={() => aoAbrirProjeto(p.id)} />
              </li>
            ))}
          </ul>
        )}
        <div className="links">
          <Button className="link" onPress={() => aoIr("projetos")}>{t.verProjetos}</Button>
        </div>
      </section>

      <section className="cartao compacto largura-leitura esticado">
        <div className="linha-ajuste">
          <p className="com-icone">
            <Lightbulb aria-hidden="true" size="1.2em" /> {t.ideiasGuardadas(ideias)}
          </p>
          <Button className="botao" onPress={() => aoIr("ideias")}>{t.verIdeias}</Button>
        </div>
      </section>

      <section className="cartao largura-leitura esticado">
        <h2>{t.novidadesTitulo(__VERSAO__)}</h2>
        <ul className="lista-simples">
          {t.novidades.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </section>

      <p className="dica">{t.dicaAtalhos}</p>
    </div>
  );
}
