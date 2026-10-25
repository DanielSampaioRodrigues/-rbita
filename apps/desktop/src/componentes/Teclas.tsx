import { Fragment } from "react";
import { textos } from "../textos/pt-BR";

/** Mostra combinações como [Ctrl] + [B], separadas por "ou". */
export function Teclas({ combinacoes }: { combinacoes: string[][] }) {
  return (
    <span className="teclas">
      {combinacoes.map((combinacao, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="teclas-ou">{textos.atalhos.ou}</span>}
          {combinacao.map((tecla, j) => (
            <Fragment key={tecla}>
              {j > 0 && <span aria-hidden="true">+</span>}
              <kbd>{tecla}</kbd>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </span>
  );
}
