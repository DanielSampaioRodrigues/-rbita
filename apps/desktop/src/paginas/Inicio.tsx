import { ArrowRight } from "lucide-react";
import { Button } from "react-aria-components";
import { textos } from "../textos/pt-BR";
import { Notas } from "./Notas";

const t = textos.inicio;

export function Inicio({ aoIrAjustes }: { aoIrAjustes: () => void }) {
  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.construcao}</p>
      <Button className="botao principal" onPress={aoIrAjustes}>
        {t.irAjustes}
        <ArrowRight aria-hidden="true" size="1.1em" />
      </Button>

      <Notas />

      <section className="cartao">
        <h2>{t.novidadesTitulo(__VERSAO__)}</h2>
        <ul className="lista-simples">
          {t.novidades.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </section>

      <p className="dica">{t.dicaAtalhos}</p>
    </div>
  );
}
