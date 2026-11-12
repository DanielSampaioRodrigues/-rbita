import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, BatteryLow, BookOpen, Books, EyeOff, GripVertical, Heart, LayoutGrid, Lightbulb, ListChecks, MoveHorizontal, PenLine, Plus, Quote, Sparkles, Timer, Wallet, type LucideIcon } from "../icones";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "react-aria-components";
import { LinhaOcorrencia } from "../agenda/Agenda";
import { expandir, inicioDoDia, somarDias, type Ocorrencia } from "../agenda/datas";
import { api, type Projeto } from "../api";
import { diaCurto } from "../dinheiro/EsteMes";
import { formatarMoeda } from "../dinheiro/moeda";
import { contasAVencer, type ContaAVencer } from "../dinheiro/visao";
import { useMudancas } from "../dados";
import { RegistroRapido } from "../energia/Energia";
import { usePreferencias } from "../estado";
import { BLOCOS_ATALHO, type BLOCOS_INICIO } from "../preferencias";
import { textos } from "../textos/pt-BR";
import { ModulosEscondidos, type Secao } from "../app/Moldura";
import { useOrganizar } from "../app/Organizar";
import { CartaoProjeto } from "./Projetos";

const t = textos.inicio;
type Bloco = (typeof BLOCOS_INICIO)[number];
type Atalho = (typeof BLOCOS_ATALHO)[number];

/** Ícone de cada atalho de módulo (os mesmos do menu). */
const ICONE_ATALHO: Record<Atalho, LucideIcon> = {
  organizacao: LayoutGrid, rotinas: ListChecks, foco: Timer, dinheiro: Wallet, saude: Heart,
  cuidado: Quote, estudos: BookOpen, hobbies: Sparkles, leitura: Books, caderno: PenLine,
};

interface Props {
  aoCapturar: () => void;
  aoAbrirProjeto: (id: string) => void;
  aoIr: (secao: Secao) => void;
  aoLigarBaixa: () => void;
}

/** Retomar importa tanto quanto começar: o Início abre com o que está em andamento. Os blocos são da pessoa. */
export function Inicio({ aoCapturar, aoAbrirProjeto, aoIr, aoLigarBaixa }: Props) {
  const [ativos, setAtivos] = useState<Projeto[]>([]);
  const [ideias, setIdeias] = useState(0);
  const [hoje, setHoje] = useState<Ocorrencia[]>([]);
  const [aVencer, setAVencer] = useState<ContaAVencer[]>([]);
  // O mesmo modo organizar vale para o menu lateral (fica na Moldura).
  const { organizando, setOrganizando } = useOrganizar();
  const mudancas = useMudancas();
  const { prefs, mudar } = usePreferencias();
  const { ordem, ocultos, largos } = prefs.inicio;

  useEffect(() => {
    api.listarProjetos().then((ps) => setAtivos(ps.filter((p) => p.estado === "ativo")), () => {});
    api.listarIdeias().then((is) => setIdeias(is.length), () => {});
    const de = inicioDoDia(new Date());
    const ate = somarDias(de, 1);
    api.listarEventos(de.getTime(), ate.getTime()).then((es) => setHoje(expandir(es, de, ate)), () => {});
    // Contas fixas no prazo do aviso (só se o Dinheiro não estiver escondido do menu).
    if (prefs.menu.ocultos.includes("dinheiro")) setAVencer([]);
    else {
      const desde = new Date(de.getFullYear(), de.getMonth(), 1).getTime();
      Promise.all([api.listarContas(), api.listarGastos(desde, somarDias(de, 40).getTime())])
        .then(([cs, gs]) => setAVencer(contasAVencer(cs, gs, new Date())), () => {});
    }
  }, [mudancas, prefs.menu.ocultos]);

  // Atalhos para os módulos que não têm bloco próprio: um toque e a pessoa já está lá.
  const atalhos = Object.fromEntries(
    BLOCOS_ATALHO.map((id) => {
      const Icone = ICONE_ATALHO[id];
      return [id, (
        <Button className="cartao compacto bloco-atalho" onPress={() => aoIr(id)} aria-label={t.abrirModulo(t.blocos[id])}>
          <Icone aria-hidden="true" size="1.5em" strokeWidth={1.75} />
          <span>{t.blocos[id]}</span>
        </Button>
      )];
    }),
  ) as Record<Atalho, ReactNode>;

  const conteudo: Record<Bloco, ReactNode> = {
    ...atalhos,
    capturar: (
      <div className="bloco-centro">
        <Button className="botao principal grande" onPress={aoCapturar}>
          <PenLine aria-hidden="true" size="1.2em" /> {t.capturar}
        </Button>
      </div>
    ),
    energia: (
      <div className="cartao">
        <RegistroRapido />
        <div className="links">
          <Button className="link com-icone" onPress={aoLigarBaixa}>
            <BatteryLow aria-hidden="true" size="1.1em" /> {textos.energia.ligarBaixa}
          </Button>
        </div>
      </div>
    ),
    hoje: (
      <section className="grupo" aria-labelledby="bloco-hoje">
        <h2 id="bloco-hoje">{t.hoje}</h2>
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
        {aVencer.length > 0 && (
          <div className="inicio-contas">
            <h3>{t.contasAVencer}</h3>
            <ul className="lista-simples sem-marcador">
              {aVencer.map(({ conta: c, dias: n, vence }) => (
                <li key={c.id}>
                  <strong>{c.nome}</strong> <span className="texto-suave">· {textos.dinheiro.contas.faltamDias(n).toLocaleLowerCase("pt-BR")} ({diaCurto(vence)}) · {formatarMoeda(c.centavos)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="links">
          <Button className="link" onPress={() => aoIr("agenda")}>{t.verAgenda}</Button>
          {aVencer.length > 0 && <Button className="link" onPress={() => aoIr("dinheiro")}>{t.verDinheiro}</Button>}
        </div>
      </section>
    ),
    continuar: (
      <section className="grupo" aria-labelledby="bloco-continuar">
        <h2 id="bloco-continuar">{t.continuar}</h2>
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
    ),
    ideias: (
      <div className="cartao compacto">
        <div className="linha-ajuste">
          <p className="com-icone">
            <Lightbulb aria-hidden="true" size="1.2em" /> {t.ideiasGuardadas(ideias)}
          </p>
          <Button className="botao" onPress={() => aoIr("ideias")}>{t.verIdeias}</Button>
        </div>
      </div>
    ),
    novidades: (
      <section className="cartao">
        <h2>{t.novidadesTitulo(__VERSAO__)}</h2>
        <ul className="lista-simples">
          {t.novidades.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </section>
    ),
  };

  const visiveis = ordem.filter((b) => !ocultos.includes(b)) as Bloco[];
  const mudarInicio = (m: Partial<typeof prefs.inicio>) => mudar({ inicio: { ...prefs.inicio, ...m } });
  const mover = (b: Bloco, delta: number) => {
    const i = visiveis.indexOf(b);
    const alvo = visiveis[i + delta];
    if (!alvo) return;
    mudarInicio({ ordem: arrayMove(ordem, ordem.indexOf(b), ordem.indexOf(alvo)) });
  };
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const soltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    mudarInicio({ ordem: arrayMove(ordem, ordem.indexOf(active.id as string), ordem.indexOf(over.id as string)) });
  };

  return (
    <div className="pagina pagina-inicio">
      <div className="linha-ajuste esticado">
        <h1>{t.titulo}</h1>
        <Button className={organizando ? "botao principal" : "botao"} onPress={() => setOrganizando((v) => !v)}>
          <LayoutGrid aria-hidden="true" size="1.1em" /> {organizando ? t.pronto : t.organizar}
        </Button>
      </div>
      <p className="pagina-intro">{organizando ? `${t.organizarExplicacao} ${t.atalhosExplicacao} ${t.menuExplicacao}` : t.construcao}</p>
      {organizando && (
        <div className="inicio-escondidos esticado">
          {ocultos.length > 0 && (
            <section className="grupo" aria-labelledby="escondidos">
              <h2 id="escondidos">{t.escondidos}</h2>
              <div className="botoes">
                {ocultos.map((b) => (
                  <Button key={b} className="botao" onPress={() => mudarInicio({ ocultos: ocultos.filter((x) => x !== b) })}>
                    <Plus aria-hidden="true" size="1.1em" /> {t.mostrar(t.blocos[b as Bloco])}
                  </Button>
                ))}
              </div>
            </section>
          )}
          {/* Fica fora do arrastar dos blocos: recebe os itens arrastados do menu. */}
          <ModulosEscondidos />
        </div>
      )}
      {!organizando && ocultos.length > 0 && (
        <p className="texto-suave pequeno esticado">
          {t.escondidosFora(ocultos.length)}{" "}
          <Button className="link" onPress={() => setOrganizando(true)}>{t.verEscondidos}</Button>
        </p>
      )}

      <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltar}>
        <SortableContext items={visiveis} strategy={rectSortingStrategy} disabled={!organizando}>
          <div className="inicio-grade">
            {visiveis.map((b, i) => (
              <BlocoInicio
                key={b}
                id={b}
                largo={largos.includes(b)}
                organizando={organizando}
                primeiro={i === 0}
                ultimo={i === visiveis.length - 1}
                aoSubir={() => mover(b, -1)}
                aoDescer={() => mover(b, 1)}
                aoAlargar={() => mudarInicio({ largos: largos.includes(b) ? largos.filter((x) => x !== b) : [...largos, b] })}
                aoEsconder={() => mudarInicio({ ocultos: [...ocultos, b] })}
              >
                {conteudo[b]}
              </BlocoInicio>
            ))}
          </div>
        </SortableContext>
      </DndContext>


      {!organizando && <p className="dica">{t.dicaAtalhos}</p>}
    </div>
  );
}

interface PropsBloco {
  id: Bloco;
  largo: boolean;
  organizando: boolean;
  primeiro: boolean;
  ultimo: boolean;
  aoSubir: () => void;
  aoDescer: () => void;
  aoAlargar: () => void;
  aoEsconder: () => void;
  children: ReactNode;
}

function BlocoInicio({ id, largo, organizando, primeiro, ultimo, aoSubir, aoDescer, aoAlargar, aoEsconder, children }: PropsBloco) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const estilo = { transform: CSS.Translate.toString(transform), transition };
  const nome = t.blocos[id];
  return (
    <div
      ref={setNodeRef}
      style={estilo}
      className={["bloco-inicio", largo && "largo", organizando && "organizando", isDragging && "arrastando"].filter(Boolean).join(" ")}
    >
      {organizando && (
        <div className="bloco-barra" role="toolbar" aria-label={nome}>
          <button type="button" className="botao-icone alca" aria-label={t.arrastar(nome)} {...attributes} {...listeners}>
            <GripVertical aria-hidden="true" size="1.1em" />
          </button>
          <span className="bloco-nome">{nome}</span>
          <Button className="botao-icone" aria-label={`${t.subir}: ${nome}`} isDisabled={primeiro} onPress={aoSubir}>
            <ArrowUp aria-hidden="true" size="1.1em" />
          </Button>
          <Button className="botao-icone" aria-label={`${t.descer}: ${nome}`} isDisabled={ultimo} onPress={aoDescer}>
            <ArrowDown aria-hidden="true" size="1.1em" />
          </Button>
          <Button className="botao-icone" aria-label={`${largo ? t.estreito : t.largo}: ${nome}`} onPress={aoAlargar}>
            <MoveHorizontal aria-hidden="true" size="1.1em" />
          </Button>
          <Button className="botao-icone" aria-label={`${t.esconder}: ${nome}`} onPress={aoEsconder}>
            <EyeOff aria-hidden="true" size="1.1em" />
          </Button>
        </div>
      )}
      <div className="bloco-conteudo" inert={organizando || undefined}>{children}</div>
    </div>
  );
}
