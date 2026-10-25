import { Check, CornerDownRight, Pencil, Plus, Trash2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "react-aria-components";
import { api, type Tarefa } from "../api";
import { Confirmar, Janela } from "../componentes/Janela";
import { EditarTexto } from "../paginas/Ideias";
import { textos } from "../textos/pt-BR";
import { EtiquetaPrazo } from "./prazos";

const t = textos.mapa;

interface No {
  id: string;
  titulo: string;
  nivel: 0 | 1 | 2;
  paiId: string | null;
  tarefa: Tarefa | null;
  filhos: No[];
}

interface Props {
  projetoId: string;
  titulo: string;
  tarefas: Tarefa[];
  executar: (acao: () => Promise<unknown>) => void;
  /** Com a IA ligada: sugerir passos para o projeto ou a etapa escolhida. */
  aoSugerirPassos?: (alvo: { id: string; titulo: string }) => void;
}

/** As mesmas etapas e subtarefas, em árvore da esquerda para a direita. */
export function MapaMental({ projetoId, titulo, tarefas, executar, aoSugerirPassos }: Props) {
  const raiz = useMemo<No>(() => {
    const etapas = tarefas.filter((x) => x.paiId === projetoId);
    return {
      id: projetoId, titulo, nivel: 0, paiId: null, tarefa: null,
      filhos: etapas.map((e) => ({
        id: e.id, titulo: e.titulo, nivel: 1, paiId: projetoId, tarefa: e,
        filhos: tarefas.filter((x) => x.paiId === e.id).map((s) => ({ id: s.id, titulo: s.titulo, nivel: 2, paiId: e.id, tarefa: s, filhos: [] })),
      })),
    };
  }, [projetoId, titulo, tarefas]);

  // Ordem de leitura (de cima para baixo), para as setas.
  const ordem = useMemo(() => {
    const lista: No[] = [];
    const andar = (n: No) => (lista.push(n), n.filhos.forEach(andar));
    andar(raiz);
    return lista;
  }, [raiz]);

  const [selecionado, setSelecionado] = useState(projetoId);
  const [criando, setCriando] = useState<{ paiId: string; antesDe: string | null } | null>(null);
  const [renomeando, setRenomeando] = useState<No | null>(null);
  const [excluindo, setExcluindo] = useState<No | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const botoes = useRef(new Map<string, HTMLElement>());

  // Se o item escolhido sumiu (excluído), vale o principal; se ainda vai aparecer (acabou de ser criado), espera.
  const atual = ordem.find((n) => n.id === selecionado) ?? raiz;
  const focoPendente = useRef<string | null>(null);

  useEffect(() => {
    const id = focoPendente.current;
    if (id && botoes.current.has(id)) {
      focoPendente.current = null;
      botoes.current.get(id)!.focus();
    }
  }, [ordem]);

  const escolher = (id: string) => {
    setSelecionado(id);
    setAviso(null);
    const botao = botoes.current.get(id);
    if (botao) requestAnimationFrame(() => botao.focus());
    else focoPendente.current = id;
  };

  const criarDentro = (n: No) => {
    if (n.nivel === 2) return setAviso(t.soDoisNiveis);
    setCriando({ paiId: n.id, antesDe: null });
  };
  const criarAoLado = (n: No) => {
    if (n.nivel === 0) return criarDentro(n);
    const pai = ordem.find((x) => x.id === n.paiId)!;
    const i = pai.filhos.findIndex((x) => x.id === n.id);
    setCriando({ paiId: pai.id, antesDe: pai.filhos[i + 1]?.id ?? null });
  };

  const aoTeclar = (e: KeyboardEvent) => {
    const i = ordem.findIndex((n) => n.id === atual.id);
    const pai = ordem.find((n) => n.id === atual.paiId);
    const acoes: Record<string, () => void> = {
      ArrowDown: () => ordem[i + 1] && escolher(ordem[i + 1].id),
      ArrowUp: () => ordem[i - 1] && escolher(ordem[i - 1].id),
      ArrowRight: () => atual.filhos[0] && escolher(atual.filhos[0].id),
      ArrowLeft: () => pai && escolher(pai.id),
      F2: () => setRenomeando(atual),
      Delete: () => atual.nivel > 0 && setExcluindo(atual),
      " ": () => atual.tarefa && executar(() => api.mudarEstadoTarefa(atual.tarefa!.id, atual.tarefa!.estado === "feita" ? "a_fazer" : "feita")),
      Enter: () => (e.ctrlKey || e.metaKey ? criarDentro(atual) : criarAoLado(atual)),
    };
    const acao = acoes[e.key];
    if (acao) {
      e.preventDefault();
      acao();
    }
  };

  const desenhar = (n: No) => {
    const feito = n.tarefa?.estado === "feita";
    return (
      <li key={n.id} className={`mapa-ramo nivel-${n.nivel}`} role="none">
        {/* Árvore de verdade (treeitem/group) para o leitor de tela entrar no modo de setas sozinho. */}
        <div
          role="treeitem"
          aria-level={n.nivel + 1}
          aria-selected={n.id === atual.id}
          aria-expanded={n.filhos.length > 0 ? true : undefined}
          ref={(el) => void (el ? botoes.current.set(n.id, el) : botoes.current.delete(n.id))}
          className={["mapa-no", `nivel-${n.nivel}`, n.id === atual.id && "selecionado", feito && "feito"].filter(Boolean).join(" ")}
          tabIndex={n.id === atual.id ? 0 : -1}
          onClick={() => escolher(n.id)}
        >
          {feito && <Check aria-hidden="true" size="1em" />}
          <span className="quebra">{n.titulo}</span>
          {n.tarefa?.prazo && <EtiquetaPrazo prazo={n.tarefa.prazo} />}
          {feito && <span className="visualmente-oculto">({textos.projeto.estadosTarefa.feita})</span>}
        </div>
        {n.filhos.length > 0 && <ul className="mapa-filhos" role="group">{n.filhos.map(desenhar)}</ul>}
      </li>
    );
  };

  return (
    <div className="mapa-area">
      <p className="texto-suave pequeno">{t.instrucoes}</p>
      <div className="botoes barra-mapa" role="toolbar" aria-label={t.titulo}>
        <Button className="botao" onPress={() => criarAoLado(atual)} isDisabled={atual.nivel === 0}>
          <Plus aria-hidden="true" size="1.1em" /> {t.novoAoLado}
        </Button>
        <Button className="botao" onPress={() => criarDentro(atual)} isDisabled={atual.nivel === 2}>
          <CornerDownRight aria-hidden="true" size="1.1em" /> {t.novoDentro}
        </Button>
        <Button className="botao" onPress={() => setRenomeando(atual)}>
          <Pencil aria-hidden="true" size="1.1em" /> {t.renomear}
        </Button>
        {atual.tarefa && (
          <Button className="botao" onPress={() => executar(() => api.mudarEstadoTarefa(atual.tarefa!.id, atual.tarefa!.estado === "feita" ? "a_fazer" : "feita"))}>
            <Check aria-hidden="true" size="1.1em" /> {atual.tarefa.estado === "feita" ? t.desfeito : t.feito}
          </Button>
        )}
        {aoSugerirPassos && atual.nivel < 2 && (
          <Button className="botao" onPress={() => aoSugerirPassos({ id: atual.id, titulo: atual.titulo })}>
            <Sparkles aria-hidden="true" size="1.1em" /> {atual.nivel === 0 ? textos.ia.sugerirEtapas : textos.ia.sugerirPassos}
          </Button>
        )}
        {atual.nivel > 0 && (
          <Button className="botao" onPress={() => setExcluindo(atual)}>
            <Trash2 aria-hidden="true" size="1.1em" /> {t.excluir}
          </Button>
        )}
      </div>
      {aviso && <p className="aviso" role="status">{aviso}</p>}
      <div className="mapa" onKeyDown={aoTeclar}>
        <ul className="mapa-raiz" role="tree" aria-label={t.titulo}>{desenhar(raiz)}</ul>
      </div>

      <Janela titulo={t.novoItem} aberta={!!criando} aoFechar={() => setCriando(null)}>
        {criando && (
          <EditarTexto
            inicial=""
            rotulo={t.nomeDoItem}
            aoCancelar={() => setCriando(null)}
            aoSalvar={(titulo) =>
              executar(async () => {
                const nova = await api.criarTarefa(criando.paiId, titulo);
                if (criando.antesDe) await api.moverTarefa(nova.id, criando.antesDe);
                setCriando(null);
                escolher(nova.id);
              })
            }
          />
        )}
      </Janela>
      <Janela titulo={t.renomear} aberta={!!renomeando} aoFechar={() => setRenomeando(null)}>
        {renomeando && (
          <EditarTexto
            inicial={renomeando.titulo}
            rotulo={t.nomeDoItem}
            aoCancelar={() => setRenomeando(null)}
            aoSalvar={(novo) => executar(async () => (await api.renomear(renomeando.id, novo), setRenomeando(null), escolher(renomeando.id)))}
          />
        )}
      </Janela>
      <Confirmar
        titulo={textos.ideias.excluirTitulo.replace("ideia", "item")}
        texto={excluindo?.titulo ?? ""}
        confirmar={t.excluir}
        aberta={!!excluindo}
        aoCancelar={() => setExcluindo(null)}
        aoConfirmar={() => excluindo && executar(async () => (await api.excluirItem(excluindo.id), escolher(excluindo.paiId ?? projetoId), setExcluindo(null)))}
      />
    </div>
  );
}
