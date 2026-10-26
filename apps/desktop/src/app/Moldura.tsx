import { ArrowLeft, ArrowRight, Palette, BatteryMedium, BookOpen, Books, CalendarDays, FolderKanban, Heart, ListChecks, Quote, Sparkles, Timer, House, Keyboard, Lightbulb, Lock, PenLine, SlidersHorizontal, Wallet, type LucideIcon } from "../icones";
import type { ReactNode } from "react";
import { Button } from "react-aria-components";
import { Interruptor } from "../componentes/Interruptor";
import { usePreferencias } from "../estado";
import { textos } from "../textos/pt-BR";
import { formatarRestante, useFoco } from "../foco/Foco";
import { Marca } from "./Marca";

export type Secao = "inicio" | "ideias" | "projetos" | "agenda" | "rotinas" | "foco" | "energia" | "dinheiro" | "saude" | "cuidado" | "estudos" | "hobbies" | "leitura" | "aparencia" | "ajustes";

const SECOES: { id: Secao; icone: LucideIcon; nome: string }[] = [
  { id: "inicio", icone: House, nome: textos.secoes.inicio },
  { id: "ideias", icone: Lightbulb, nome: textos.secoes.ideias },
  { id: "projetos", icone: FolderKanban, nome: textos.secoes.projetos },
  { id: "agenda", icone: CalendarDays, nome: textos.secoes.agenda },
  { id: "rotinas", icone: ListChecks, nome: textos.secoes.rotinas },
  { id: "foco", icone: Timer, nome: textos.secoes.foco },
  { id: "energia", icone: BatteryMedium, nome: textos.secoes.energia },
  { id: "dinheiro", icone: Wallet, nome: textos.secoes.dinheiro },
  { id: "saude", icone: Heart, nome: textos.secoes.saude },
  { id: "cuidado", icone: Quote, nome: textos.secoes.cuidado },
  { id: "estudos", icone: BookOpen, nome: textos.secoes.estudos },
  { id: "hobbies", icone: Sparkles, nome: textos.secoes.hobbies },
  { id: "leitura", icone: Books, nome: textos.secoes.leitura },
  { id: "aparencia", icone: Palette, nome: textos.secoes.aparencia },
  { id: "ajustes", icone: SlidersHorizontal, nome: textos.secoes.ajustes },
];

interface Props {
  secao: Secao;
  aoEscolherSecao: (secao: Secao) => void;
  aoVerAtalhos: () => void;
  aoBloquear: () => void;
  aoCapturar: () => void;
  /** Setas de voltar e avançar entre as funções (como num navegador). */
  navegacao: { podeVoltar: boolean; podeAvancar: boolean; voltar: () => void; avancar: () => void };
  children: ReactNode;
}

export function Moldura({ secao, aoEscolherSecao, aoVerAtalhos, aoBloquear, aoCapturar, navegacao, children }: Props) {
  const { prefs, mudar } = usePreferencias();
  const foco = useFoco();

  return (
    <div className="moldura">
      <aside className="lateral">
        <div className="lateral-marca">
          <Marca />
          <span>{textos.app.nome}</span>
        </div>

        <Button className="botao principal capturar" onPress={aoCapturar}>
          <PenLine aria-hidden="true" size="1.1em" />
          {textos.moldura.capturar}
        </Button>

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

        {foco.restante != null && (
          <Button className="lateral-item foco-mini" onPress={() => aoEscolherSecao("foco")}>
            <Timer aria-hidden="true" size="1.15em" strokeWidth={1.75} />
            {(foco.estado.modo === "foco" ? textos.foco.naBarra : textos.foco.naBarraPausa)(formatarRestante(foco.restante))}
          </Button>
        )}

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
        {/* Ficam sempre no mesmo lugar; sem para onde ir, aparecem apagadas. */}
        <div className="setas-navegacao">
          <Button className="botao-icone" aria-label={`${textos.navegacao.voltar} (Alt + ←)`} isDisabled={!navegacao.podeVoltar} onPress={navegacao.voltar}>
            <ArrowLeft aria-hidden="true" size="1.1em" />
          </Button>
          <Button className="botao-icone" aria-label={`${textos.navegacao.avancar} (Alt + →)`} isDisabled={!navegacao.podeAvancar} onPress={navegacao.avancar}>
            <ArrowRight aria-hidden="true" size="1.1em" />
          </Button>
        </div>
        {children}
      </main>
    </div>
  );
}
