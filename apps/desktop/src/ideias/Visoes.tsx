import { ChevronRight, Link2, StickyNote } from "lucide-react";
import { Button } from "react-aria-components";
import type { Etiqueta, Ideia } from "../api";
import { formatoData } from "../projetos/OndeParei";
import { textos } from "../textos/pt-BR";
import { ChipEtiqueta } from "./etiquetas";

const t = textos.ideias;

export type VisaoIdeias = "lista" | "mural" | "quadro" | "mapa";
export const VISOES_IDEIAS: VisaoIdeias[] = ["lista", "mural", "quadro", "mapa"];

interface Props {
  ideias: Ideia[];
  etiquetas: Etiqueta[];
  aoAbrir: (i: Ideia) => void;
}

const etiquetasDe = (i: Ideia, todas: Etiqueta[]) => i.etiquetas.map((id) => todas.find((e) => e.id === id)).filter((e): e is Etiqueta => !!e);

/** Sinais pequenos e escritos: etiquetas, nota e ligações. */
function Detalhes({ ideia, etiquetas }: { ideia: Ideia; etiquetas: Etiqueta[] }) {
  const minhas = etiquetasDe(ideia, etiquetas);
  if (!minhas.length && !ideia.nota && !ideia.ligadas.length) return null;
  return (
    <div className="ideia-detalhes">
      {minhas.map((e) => <ChipEtiqueta key={e.id} etiqueta={e} />)}
      {ideia.nota && <span className="texto-suave pequeno com-icone"><StickyNote aria-hidden="true" size="0.9em" /> {t.temNota}</span>}
      {ideia.ligadas.length > 0 && <span className="texto-suave pequeno com-icone"><Link2 aria-hidden="true" size="0.9em" /> {t.ligadasA(ideia.ligadas.length)}</span>}
    </div>
  );
}

export function ListaIdeias({ ideias, etiquetas, aoAbrir }: Props) {
  return (
    <ul className="lista-cartoes largura-leitura">
      {ideias.map((i) => (
        <li key={i.id}>
          <Button className="cartao compacto ideia-cartao" onPress={() => aoAbrir(i)} aria-label={t.abrir(i.texto)}>
            <span className="ideia-linha">
              <span className="quebra ideia-texto">{i.texto}</span>
              <ChevronRight aria-hidden="true" size="1.1em" />
            </span>
            <Detalhes ideia={i} etiquetas={etiquetas} />
            <span className="texto-suave pequeno">{t.guardadaEm(formatoData.format(i.criadoEm))}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Cartões em grade, com o começo da nota: bom para ver tudo de uma vez. */
export function MuralIdeias({ ideias, etiquetas, aoAbrir }: Props) {
  return (
    <ul className="mural">
      {ideias.map((i) => {
        const cor = etiquetasDe(i, etiquetas)[0]?.cor;
        return (
          <li key={i.id}>
            <Button className={cor ? `cartao mural-cartao borda-${cor}` : "cartao mural-cartao"} onPress={() => aoAbrir(i)} aria-label={t.abrir(i.texto)}>
              <span className="quebra ideia-texto">{i.texto}</span>
              {i.nota && <span className="texto-suave pequeno mural-nota">{i.nota}</span>}
              <Detalhes ideia={{ ...i, nota: "" }} etiquetas={etiquetas} />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** Grupos por etiqueta (e "Sem etiqueta"). Uma ideia pode estar em mais de um. */
function grupos(ideias: Ideia[], etiquetas: Etiqueta[]) {
  const lista = etiquetas
    .map((e) => ({ id: e.id, etiqueta: e as Etiqueta | null, ideias: ideias.filter((i) => i.etiquetas.includes(e.id)) }))
    .filter((g) => g.ideias.length > 0);
  const sem = ideias.filter((i) => !i.etiquetas.some((id) => etiquetas.some((e) => e.id === id)));
  if (sem.length) lista.push({ id: "sem", etiqueta: null, ideias: sem });
  return lista;
}

export function QuadroIdeias({ ideias, etiquetas, aoAbrir }: Props) {
  return (
    <>
      <p className="texto-suave pequeno">{t.quadroExplicacao}</p>
      <div className="quadro quadro-ideias">
        {grupos(ideias, etiquetas).map((g) => (
          <section key={g.id} className="quadro-coluna" aria-label={g.etiqueta?.nome ?? t.semEtiqueta}>
            <h3>{g.etiqueta ? <ChipEtiqueta etiqueta={g.etiqueta} /> : t.semEtiqueta} <span className="texto-suave">({g.ideias.length})</span></h3>
            <ul className="quadro-cartoes">
              {g.ideias.map((i) => (
                <li key={i.id}>
                  <Button className="quadro-cartao ideia-cartao-quadro" onPress={() => aoAbrir(i)} aria-label={t.abrir(i.texto)}>
                    <span className="quebra">{i.texto}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

/** Mapa: "Ideias" no centro, etiquetas em volta e as ideias de cada uma. */
export function MapaIdeias({ ideias, etiquetas, aoAbrir }: Props) {
  return (
    <div className="mapa-area">
      <p className="texto-suave pequeno">{t.mapaExplicacao}</p>
      <div className="mapa">
        <ul className="mapa-raiz">
          <li className="mapa-ramo">
            <span className="mapa-no nivel-0">{t.mapaRaiz}</span>
            <ul className="mapa-filhos">
              {grupos(ideias, etiquetas).map((g) => (
                <li key={g.id} className="mapa-ramo">
                  <span className="mapa-no nivel-1">{g.etiqueta ? <ChipEtiqueta etiqueta={g.etiqueta} /> : t.semEtiqueta}</span>
                  <ul className="mapa-filhos">
                    {g.ideias.map((i) => (
                      <li key={i.id} className="mapa-ramo">
                        <Button className="mapa-no" onPress={() => aoAbrir(i)} aria-label={t.abrir(i.texto)}>
                          <span className="quebra">{i.texto}</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
}
