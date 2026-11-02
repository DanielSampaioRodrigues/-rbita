import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, pointerWithin, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, GripVertical, List, Palette, BatteryMedium, BookOpen, Books, CalendarDays, FolderKanban, Heart, LayoutGrid, ListChecks, Quote, Sparkles, Timer, House, Keyboard, Lightbulb, Lock, PenLine, SlidersHorizontal, Wallet, type LucideIcon } from "../icones";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { api } from "../api";
import { Interruptor } from "../componentes/Interruptor";
import { usePreferencias } from "../estado";
import { SECOES_TRAVADAS, type SecaoMenu } from "../preferencias";
import { textos } from "../textos/pt-BR";
import { formatarRestante, useFoco } from "../foco/Foco";
import { useImersivo } from "./Imersivo";
import { Marca } from "./Marca";
import { ProvedorOrganizar, useOrganizar, type Organizar } from "./Organizar";
import { AvisoSincronia } from "../sincronia/AvisoSincronia";

/** As seções do app (a lista e a ordem de fábrica ficam em preferencias.ts, junto da validação do menu). */
export type Secao = SecaoMenu;

const ICONES: Record<Secao, LucideIcon> = {
  inicio: House, organizacao: LayoutGrid, ideias: Lightbulb, projetos: FolderKanban, agenda: CalendarDays,
  rotinas: ListChecks, foco: Timer, energia: BatteryMedium, dinheiro: Wallet, saude: Heart, cuidado: Quote,
  estudos: BookOpen, hobbies: Sparkles, leitura: Books, caderno: PenLine, aparencia: Palette, ajustes: SlidersHorizontal,
};

const tm = textos.moldura;
/** Id da caixinha "Módulos escondidos" do Início, que também recebe itens do menu arrastados. */
const CAIXA_ESCONDIDOS = "menu-escondidos";

/** Com o ponteiro em cima da caixinha, ela vence; fora dela, vale o item do menu mais perto. */
const colisaoMenu: CollisionDetection = (args) => {
  const naCaixa = pointerWithin(args).filter((c) => c.id === CAIXA_ESCONDIDOS);
  if (naCaixa.length) return naCaixa;
  return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => c.id !== CAIXA_ESCONDIDOS) });
};

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
  // Modo organizar: o mesmo do Início ("Organizar a tela inicial"). Sai sozinho ao deixar o Início.
  const [organizando, setOrganizando] = useState(false);
  useEffect(() => { if (secao !== "inicio") setOrganizando(false); }, [secao]);
  const [arrastando, setArrastando] = useState<{ id: Secao; ponteiro: boolean } | null>(null);
  const valorOrganizar = useMemo<Organizar>(
    () => ({ organizando, setOrganizando, arrastandoMenu: arrastando?.ponteiro && !SECOES_TRAVADAS.includes(arrastando.id) ? arrastando.id : null }),
    [organizando, arrastando],
  );
  const { ordem, ocultos } = prefs.menu;
  const visiveis = ordem.filter((s) => !ocultos.includes(s));
  const mudarMenu = (m: Partial<typeof prefs.menu>) => mudar({ menu: { ...prefs.menu, ...m } });
  const esconder = (s: Secao) => { if (!SECOES_TRAVADAS.includes(s) && !ocultos.includes(s)) mudarMenu({ ocultos: [...ocultos, s] }); };
  const mover = (s: Secao, delta: number) => {
    const alvo = visiveis[visiveis.indexOf(s) + delta];
    if (alvo) mudarMenu({ ordem: arrayMove(ordem, ordem.indexOf(s), ordem.indexOf(alvo)) });
  };
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const comecarArrastar = ({ active, activatorEvent }: DragStartEvent) =>
    setArrastando({ id: active.id as Secao, ponteiro: !(activatorEvent instanceof KeyboardEvent) });
  const soltar = ({ active, over }: DragEndEvent) => {
    setArrastando(null);
    if (!over || active.id === over.id) return;
    const id = active.id as Secao;
    if (over.id === CAIXA_ESCONDIDOS) esconder(id);
    else mudarMenu({ ordem: arrayMove(ordem, ordem.indexOf(id), ordem.indexOf(over.id as Secao)) });
  };
  const nomeDe = (id: unknown) => textos.secoes[id as Secao] ?? String(id);
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
    <ProvedorOrganizar valor={valorOrganizar}>
    <DndContext
      sensors={sensores}
      collisionDetection={colisaoMenu}
      onDragStart={comecarArrastar}
      onDragEnd={soltar}
      onDragCancel={() => setArrastando(null)}
      accessibility={{
        screenReaderInstructions: { draggable: tm.arrastarInstrucoes },
        announcements: {
          onDragStart: ({ active }) => tm.anuncioPegou(nomeDe(active.id)),
          onDragOver: ({ active, over }) => (over ? (over.id === CAIXA_ESCONDIDOS ? tm.anuncioSobreCaixa(nomeDe(active.id)) : tm.anuncioSobre(nomeDe(active.id), visiveis.indexOf(over.id as Secao) + 1)) : undefined),
          onDragEnd: ({ active, over }) => (over ? (over.id === CAIXA_ESCONDIDOS ? tm.anuncioEscondeu(nomeDe(active.id)) : tm.anuncioSoltou(nomeDe(active.id), visiveis.indexOf(over.id as Secao) + 1)) : tm.anuncioCancelou(nomeDe(active.id))),
          onDragCancel: ({ active }) => tm.anuncioCancelou(nomeDe(active.id)),
        },
      }}
    >
    <div className={`moldura${imersivo ? " imersivo" : ""}${!imersivo && recolhido ? " recolhida" : ""}${escondido && menuAberto ? " menu-aberto" : ""}${organizando ? " organizando-menu" : ""}`}>
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
          {organizando ? (
            <>
              <p className="lateral-organizar-dica">{tm.organizarDica}</p>
              <SortableContext items={visiveis} strategy={verticalListSortingStrategy}>
                <ul className="lateral-lista organizando">
                  {visiveis.map((id, i) => (
                    <ItemMenuOrganizar
                      key={id}
                      id={id}
                      primeiro={i === 0}
                      ultimo={i === visiveis.length - 1}
                      aoSubir={() => mover(id, -1)}
                      aoDescer={() => mover(id, 1)}
                      aoEsconder={() => esconder(id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </>
          ) : (
            <ul className="lateral-lista">
              {visiveis.map((id) => {
                const Icone = ICONES[id];
                return (
                  <li key={id}>
                    <Button
                      className="lateral-item"
                      onPress={() => escolher(id)}
                      aria-current={secao === id ? "page" : undefined}
                    >
                      <Icone aria-hidden="true" size="1.15em" strokeWidth={1.75} />
                      <span className="lateral-nome">{textos.secoes[id]}</span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
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
            <AvisoSincronia />
          </div>
        )}
        {children}
      </main>
    </div>
    {/* A cópia que acompanha o ponteiro vai para fora da barra, para poder chegar até a caixinha do Início. */}
    {createPortal(
      <DragOverlay dropAnimation={null}>
        {arrastando?.ponteiro ? <EtiquetaSecao id={arrastando.id} /> : null}
      </DragOverlay>,
      document.body,
    )}
    </DndContext>
    </ProvedorOrganizar>
  );
}

function EtiquetaSecao({ id }: { id: Secao }) {
  const Icone = ICONES[id];
  return (
    <div className="menu-etiqueta-arrastada">
      <Icone aria-hidden="true" size="1.15em" strokeWidth={1.75} />
      <span>{textos.secoes[id]}</span>
    </div>
  );
}

interface PropsItemMenu {
  id: Secao;
  primeiro: boolean;
  ultimo: boolean;
  aoSubir: () => void;
  aoDescer: () => void;
  aoEsconder: () => void;
}

/** Item do menu no modo organizar: alça para arrastar, subir, descer e esconder. Não navega, para nada acontecer sem querer. */
function ItemMenuOrganizar({ id, primeiro, ultimo, aoSubir, aoDescer, aoEsconder }: PropsItemMenu) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const Icone = ICONES[id];
  const nome = textos.secoes[id];
  const travada = SECOES_TRAVADAS.includes(id);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`lateral-org-item${isDragging ? " arrastando" : ""}`}
    >
      <div className="lateral-org-barra" role="group" aria-label={nome}>
        <button type="button" className="botao-icone alca" aria-label={tm.arrastar(nome)} {...attributes} {...listeners}>
          <GripVertical aria-hidden="true" size="1.05em" />
        </button>
        <Icone aria-hidden="true" size="1.1em" strokeWidth={1.75} className="lateral-org-icone" />
        <span className="lateral-org-nome">{nome}</span>
        <Button className="botao-icone" aria-label={tm.subir(nome)} isDisabled={primeiro} onPress={aoSubir}>
          <ArrowUp aria-hidden="true" size="1em" />
        </Button>
        <Button className="botao-icone" aria-label={tm.descer(nome)} isDisabled={ultimo} onPress={aoDescer}>
          <ArrowDown aria-hidden="true" size="1em" />
        </Button>
        {travada ? (
          <span className="lateral-org-travada" role="img" aria-label={`${nome}: ${tm.travada}`} title={tm.travada}>
            <Lock aria-hidden="true" size="0.95em" />
          </span>
        ) : (
          <Button className="botao-icone" aria-label={tm.esconder(nome)} onPress={aoEsconder}>
            <EyeOff aria-hidden="true" size="1em" />
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Caixinha "Módulos escondidos", mostrada no Início durante o modo organizar.
 * Recebe itens do menu arrastados com o mouse ou o dedo e devolve ao menu com um toque.
 */
export function ModulosEscondidos() {
  const { prefs, mudar } = usePreferencias();
  const { arrastandoMenu } = useOrganizar();
  const { ocultos } = prefs.menu;
  const { setNodeRef, isOver } = useDroppable({ id: CAIXA_ESCONDIDOS, disabled: !arrastandoMenu });
  const mostrar = (s: Secao) => mudar({ menu: { ...prefs.menu, ocultos: ocultos.filter((x) => x !== s) } });
  return (
    <section
      ref={setNodeRef}
      className={["grupo", "modulos-escondidos", arrastandoMenu && "recebendo", isOver && "por-cima"].filter(Boolean).join(" ")}
      aria-labelledby="modulos-escondidos"
    >
      <h2 id="modulos-escondidos">{tm.escondidosTitulo}</h2>
      <p className="texto-suave pequeno">{tm.escondidosTexto}</p>
      {arrastandoMenu && <p className="modulos-soltar" aria-hidden="true">{tm.soltarAqui}</p>}
      {ocultos.length === 0 ? (
        <p className="texto-suave pequeno">{tm.escondidosVazio}</p>
      ) : (
        <ul className="modulos-escondidos-lista">
          {ocultos.map((s) => {
            const Icone = ICONES[s];
            return (
              <li key={s}>
                <span className="com-icone">
                  <Icone aria-hidden="true" size="1.1em" strokeWidth={1.75} /> {textos.secoes[s]}
                </span>
                <Button className="botao" aria-label={tm.mostrarDeNovoNome(textos.secoes[s])} onPress={() => mostrar(s)}>
                  <Eye aria-hidden="true" size="1.05em" /> {tm.mostrarDeNovo}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
