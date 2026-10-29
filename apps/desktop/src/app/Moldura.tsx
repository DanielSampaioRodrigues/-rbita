import { ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, List, Palette, BatteryMedium, BookOpen, Books, CalendarDays, FolderKanban, Heart, LayoutGrid, ListChecks, Quote, Sparkles, Timer, House, Keyboard, Lightbulb, Lock, PenLine, SlidersHorizontal, Wallet, type LucideIcon } from "../icones";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { api } from "../api";
import { Interruptor } from "../componentes/Interruptor";
import { usePreferencias } from "../estado";
import { textos } from "../textos/pt-BR";
import { formatarRestante, useFoco } from "../foco/Foco";
import { useImersivo } from "./Imersivo";
import { Marca } from "./Marca";

export type Secao = "inicio" | "organizacao" | "ideias" | "projetos" | "agenda" | "rotinas" | "foco" | "energia" | "dinheiro" | "saude" | "cuidado" | "estudos" | "hobbies" | "leitura" | "caderno" | "aparencia" | "ajustes";

const SECOES: { id: Secao; icone: LucideIcon; nome: string }[] = [
  { id: "inicio", icone: House, nome: textos.secoes.inicio },
  { id: "organizacao", icone: LayoutGrid, nome: textos.secoes.organizacao },
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
  { id: "caderno", icone: PenLine, nome: textos.secoes.caderno },
  { id: "aparencia", icone: Palette, nome: textos.secoes.aparencia },
  { id: "ajustes", icone: SlidersHorizontal, nome: textos.secoes.ajustes },
];

/** Um lugar por onde a pessoa passou (seção e, se for o caso, o projeto aberto). */
export type Lugar = { secao: Secao; projeto: string | null };

interface Props {
  secao: Secao;
  aoEscolherSecao: (secao: Secao) => void;
  aoVerAtalhos: () => void;
  aoBloquear: () => void;
  aoCapturar: () => void;
  /** Setas de voltar e avançar entre as funções (como num navegador), mais a lista das últimas telas. */
  navegacao: { podeVoltar: boolean; podeAvancar: boolean; voltar: () => void; avancar: () => void; lugares: Lugar[]; posicao: number; irParaPosicao: (i: number) => void };
  children: ReactNode;
}

/** Lista das últimas telas, entre as setas: toca e pula direto. Segurar "voltar" também abre. */
function HistoricoNavegacao({ lugares, posicao, irParaPosicao, aberto, aoMudarAberto }: { lugares: Lugar[]; posicao: number; irParaPosicao: (i: number) => void; aberto: boolean; aoMudarAberto: (v: boolean) => void }) {
  const [titulos, setTitulos] = useState<Record<string, string>>({});
  // Nome dos projetos, só quando a lista abre (é raro e barato).
  useEffect(() => {
    if (!aberto || !lugares.some((l) => l.projeto)) return;
    api.listarProjetos().then((ps) => setTitulos(Object.fromEntries(ps.map((p) => [p.id, p.titulo]))), () => {});
  }, [aberto, lugares]);
  // Mais recente primeiro; a tela atual fica marcada.
  const itens = lugares.map((l, i) => ({ i, l })).reverse();
  const rotulo = (l: Lugar) => (l.projeto ? `${textos.secoes.projetos} › ${titulos[l.projeto] ?? textos.navegacao.projeto}` : textos.secoes[l.secao]);
  return (
    <MenuTrigger isOpen={aberto} onOpenChange={aoMudarAberto}>
      <Button className="botao-icone seta-nav historico-botao" aria-label={textos.navegacao.historico} isDisabled={lugares.length < 2}>
        <ChevronDown aria-hidden="true" size="1.35em" strokeWidth={2.25} />
      </Button>
      <Popover className="menu-popover" placement="bottom start">
        <Menu className="menu" aria-label={textos.navegacao.historico} onAction={(k) => irParaPosicao(Number(k))}>
          {itens.map(({ i, l }) => (
            <MenuItem key={i} id={String(i)} className={`menu-item${i === posicao ? " atual" : ""}`} textValue={rotulo(l)}>
              {rotulo(l)} {i === posicao && <span className="texto-suave">{textos.navegacao.atual}</span>}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

const CHAVE_MENU = "orbita-menu-recolhido";
function lerMenuRecolhido(): boolean {
  try {
    const v = localStorage.getItem(CHAVE_MENU);
    if (v === "1" || v === "0") return v === "1";
  } catch { /* usa o padrão */ }
  return (globalThis.innerWidth ?? 1200) < 900;
}

export function Moldura({ secao, aoEscolherSecao, aoVerAtalhos, aoBloquear, aoCapturar, navegacao, children }: Props) {
  const { prefs, mudar } = usePreferencias();
  const foco = useFoco();
  const { imersivo } = useImersivo();
  const [menuAberto, setMenuAberto] = useState(false);
  // Menu recolhido: some e volta por um botão, por cima da tela. Começa assim em
  // telas estreitas (celular, tablet em pé); a escolha fica lembrada no aparelho.
  const [recolhido, setRecolhido] = useState(lerMenuRecolhido);
  const recolher = (v: boolean) => {
    setRecolhido(v);
    setMenuAberto(false);
    try { localStorage.setItem(CHAVE_MENU, v ? "1" : "0"); } catch { /* ignora */ }
  };
  const escondido = imersivo || recolhido;
  // Ao sair do modo imersivo (fechar o caderno), o menu volta ao normal.
  useEffect(() => { if (!imersivo) setMenuAberto(false); }, [imersivo]);
  // Esc fecha o menu aberto por cima.
  useEffect(() => {
    if (!menuAberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setMenuAberto(false);
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [menuAberto]);
  const escolher = (id: Secao) => { aoEscolherSecao(id); setMenuAberto(false); };
  // Segurar a seta "voltar" por meio segundo abre a lista das últimas telas.
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const segurando = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comecarSegurar = () => { segurando.current = setTimeout(() => { segurando.current = null; setHistoricoAberto(true); }, 500); };
  const pararSegurar = () => { if (segurando.current) { clearTimeout(segurando.current); segurando.current = null; return false; } return true; };

  return (
    <div className={`moldura${imersivo ? " imersivo" : ""}${!imersivo && recolhido ? " recolhida" : ""}${escondido && menuAberto ? " menu-aberto" : ""}`}>
      <aside className="lateral">
        <div className="lateral-marca">
          <Marca />
          <span>{textos.app.nome}</span>
          {!imersivo && (
            <Button
              className="botao-icone lateral-recolher"
              onPress={() => recolher(!recolhido)}
              aria-label={recolhido ? textos.moldura.fixarMenu : textos.moldura.recolherMenu}
            >
              {recolhido ? <ChevronRight aria-hidden="true" size="1.1em" /> : <ChevronLeft aria-hidden="true" size="1.1em" />}
            </Button>
          )}
        </div>

        <Button className="botao principal capturar" onPress={aoCapturar}>
          <PenLine aria-hidden="true" size="1.1em" />
          <span className="lateral-nome">{textos.moldura.capturar}</span>
        </Button>

        <nav aria-label={textos.app.navegacao}>
          <ul className="lateral-lista">
            {SECOES.map(({ id, icone: Icone, nome }) => (
              <li key={id}>
                <Button
                  className="lateral-item"
                  onPress={() => escolher(id)}
                  aria-current={secao === id ? "page" : undefined}
                >
                  <Icone aria-hidden="true" size="1.15em" strokeWidth={1.75} />
                  <span className="lateral-nome">{nome}</span>
                </Button>
              </li>
            ))}
          </ul>
        </nav>

        {foco.restante != null && (
          <Button className="lateral-item foco-mini" onPress={() => escolher("foco")}>
            <Timer aria-hidden="true" size="1.15em" strokeWidth={1.75} />
            <span className="lateral-nome">{(foco.estado.modo === "foco" ? textos.foco.naBarra : textos.foco.naBarraPausa)(formatarRestante(foco.restante))}</span>
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
            <span className="lateral-nome">{textos.moldura.verAtalhos}</span>
            <kbd className="lateral-dica">F1</kbd>
          </Button>
          <Button className="lateral-item discreto" onPress={aoBloquear}>
            <Lock aria-hidden="true" size="1.15em" strokeWidth={1.75} />
            <span className="lateral-nome">{textos.moldura.bloquear}</span>
          </Button>
          <p className="lateral-versao">{textos.app.versao(__VERSAO__)}</p>
        </div>
      </aside>

      <main className="conteudo" id="conteudo">
        {imersivo && (
          <Button className="imersivo-menu" onPress={() => setMenuAberto((v) => !v)} aria-label={textos.moldura.menu} aria-expanded={menuAberto}>
            <List aria-hidden="true" size="1.2em" />
          </Button>
        )}
        {escondido && menuAberto && <Button className="imersivo-fundo" aria-label={textos.comum.fechar} onPress={() => setMenuAberto(false)} />}
        {/* Ficam sempre no mesmo lugar; sem para onde ir, aparecem apagadas.
            No modo imersivo (caderno aberto) somem, para não ficar por cima da
            barra do caderno e bloquear o botão de voltar. */}
        {!imersivo && (
          <div className="setas-navegacao">
            {recolhido && (
              <Button className="menu-recolhido" onPress={() => setMenuAberto((v) => !v)} aria-label={textos.moldura.menu} aria-expanded={menuAberto}>
                <List aria-hidden="true" size="1.35em" />
                <span aria-hidden="true">{textos.moldura.menuCurto}</span>
              </Button>
            )}
            <Button
              className="botao-icone seta-nav"
              aria-label={`${textos.navegacao.voltar} (Alt + ←)`}
              isDisabled={!navegacao.podeVoltar}
              onPressStart={comecarSegurar}
              onPressEnd={() => { pararSegurar(); }}
              onPress={() => { if (!historicoAberto) navegacao.voltar(); }}
            >
              <ArrowLeft aria-hidden="true" size="1.5em" strokeWidth={2.25} />
            </Button>
            <HistoricoNavegacao lugares={navegacao.lugares} posicao={navegacao.posicao} irParaPosicao={navegacao.irParaPosicao} aberto={historicoAberto} aoMudarAberto={setHistoricoAberto} />
            <Button className="botao-icone seta-nav" aria-label={`${textos.navegacao.avancar} (Alt + →)`} isDisabled={!navegacao.podeAvancar} onPress={navegacao.avancar}>
              <ArrowRight aria-hidden="true" size="1.5em" strokeWidth={2.25} />
            </Button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
