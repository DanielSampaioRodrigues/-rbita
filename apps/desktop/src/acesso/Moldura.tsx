import type { ReactNode } from "react";
import { Marca } from "../app/Marca";
import { Interruptor } from "../componentes/Interruptor";
import { usePreferencias } from "../estado";
import { textos } from "../textos/pt-BR";

/** Moldura calma das telas de entrada: uma coisa por vez, no centro. */
export function MolduraAcesso({ passo, children }: { passo?: string; children: ReactNode }) {
  const { prefs, mudar } = usePreferencias();
  return (
    <div className="acesso">
      <header className="acesso-topo">
        <div className="lateral-marca">
          <Marca />
          <span>{textos.app.nome}</span>
        </div>
        <Interruptor
          compacto
          rotulo={textos.moldura.baixoEstimulo}
          ligado={prefs.baixoEstimulo}
          aoMudar={(baixoEstimulo) => mudar({ baixoEstimulo })}
        />
      </header>
      <main className="acesso-centro">
        <div className="acesso-cartao">
          {passo && <p className="acesso-passo">{passo}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}
