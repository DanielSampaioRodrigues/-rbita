import { House, Keyboard, Lock, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "react-aria-components";
import { Interruptor } from "../componentes/Interruptor";
import { usePreferencias } from "../estado";
import { textos } from "../textos/pt-BR";
import { Marca } from "./Marca";

export type Secao = "inicio" | "ajustes";

const SECOES: { id: Secao; icone: LucideIcon; nome: string }[] = [
  { id: "inicio", icone: House, nome: textos.secoes.inicio },
  { id: "ajustes", icone: SlidersHorizontal, nome: textos.secoes.ajustes },
];

interface Props {
  secao: Secao;
  aoEscolherSecao: (secao: Secao) => void;
  aoVerAtalhos: () => void;
  aoBloquear: () => void;
  children: ReactNode;
}

export function Moldura({ secao, aoEscolherSecao, aoVerAtalhos, aoBloquear, children }: Props) {
  const { prefs, mudar } = usePreferencias();

  return (
    <div className="moldura">
      <aside className="lateral">
        <div className="lateral-marca">
          <Marca />
          <span>{textos.app.nome}</span>
        </div>

        <nav aria-label={textos.app.navegacao}>
          <ul className="lateral-lista">
            {SECOES.map(({ id, icone: Icone, nome }) => (
              <li key={id}>
                <Button
                  className="lateral-item"
                  onPress={() => aoEscolherSecao(id)}
                  aria-current={secao === id ? "page" : undefined}
                >
                  <Icone aria-hidden="true" size="1.15em" strokeWidth={1.75} />
                  {nome}
                </Button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lateral-rodape">
          <Interruptor
            compacto
            rotulo={textos.moldura.baixoEstimulo}
            ligado={prefs.baixoEstimulo}
            aoMudar={(ligado) => mudar({ baixoEstimulo: ligado })}
          />
          <Button className="lateral-item discreto" onPress={aoVerAtalhos}>
            <Keyboard aria-hidden="true" size="1.15em" strokeWidth={1.75} />
            {textos.moldura.verAtalhos}
            <kbd className="lateral-dica">F1</kbd>
          </Button>
          <Button className="lateral-item discreto" onPress={aoBloquear}>
            <Lock aria-hidden="true" size="1.15em" strokeWidth={1.75} />
            {textos.moldura.bloquear}
          </Button>
          <p className="lateral-versao">{textos.app.versao(__VERSAO__)}</p>
        </div>
      </aside>

      <main className="conteudo" id="conteudo">
        {children}
      </main>
    </div>
  );
}
