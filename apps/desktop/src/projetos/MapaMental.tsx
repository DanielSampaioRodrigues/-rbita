import { Check, CornerDownRight, Link2, Pencil, Plus, RotateCcw, Sparkles, Trash2, X } from "../icones";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "react-aria-components";
import { api, type Tarefa } from "../api";
import { Escolha } from "../componentes/Escolha";
import { Confirmar, Janela } from "../componentes/Janela";
import { EditarTexto } from "../paginas/Ideias";
import { textos } from "../textos/pt-BR";
import { lerComMigracao } from "../valores";
import { curva, enquadrar, moverPorTecla, paraMundo, paraTela, posicoesAutomaticas, toqueDuplo, zoomEm, type Ponto, type Toque, type Vista } from "./mapaGeometria";
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

// Posições e vista ficam no cofre de valores, uma chave por projeto (só números e ids,
// nada do conteúdo). Antes ficavam no localStorage (`orbita.mapa.<id>`); migram sozinhas.
interface Guardado {
  pos: Record<string, [number, number]>;
  vista?: Vista;
}
const chaveMapa = (projetoId: string) => `projetos.mapa.${projetoId.toLowerCase()}`;
const chaveMapaAntiga = (projetoId: string) => `orbita.mapa.${projetoId}`;

const numero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Aceita qualquer coisa vinda do armazenamento e devolve posições válidas. */
function validarGuardado(bruto: unknown): Guardado {
  if (!bruto || typeof bruto !== "object") return { pos: {} };
  const b = bruto as { pos?: unknown; vista?: unknown };
  const pos: Guardado["pos"] = {};
  if (b.pos && typeof b.pos === "object") {
    for (const [id, p] of Object.entries(b.pos as Record<string, unknown>)) {
      if (Array.isArray(p) && p.length === 2 && numero(p[0]) && numero(p[1])) pos[id] = [p[0], p[1]];
    }
  }
  const v = b.vista as Partial<Vista> | undefined;
  const vista = v && typeof v === "object" && numero(v.x) && numero(v.y) && numero(v.z) ? { x: v.x, y: v.y, z: v.z } : undefined;
  return vista ? { pos, vista } : { pos };
}

const lerMapa = (projetoId: string) => lerComMigracao(chaveMapa(projetoId), chaveMapaAntiga(projetoId), validarGuardado);

/** O que o ponteiro está fazendo agora. */
type Gesto =
  | { tipo: "fundo"; id: number; inicio: Ponto; vista0: Vista; moveu: boolean }
  | { tipo: "espera"; id: number; noId: string; inicio: Ponto; desloc: Ponto; timer: number }
  | { tipo: "no"; id: number; noId: string; inicio: Ponto; desloc: Ponto; moveu: boolean }
  | { tipo: "alca"; id: number; de: string }
  | { tipo: "pinca"; d0: number; meio0: Ponto; vista0: Vista };

const distancia = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * As mesmas etapas e subtarefas, num papel livre: arrastar itens, passear, aproximar, ligar.
 * Mouse e caneta pegam na hora; o dedo segura 150 ms (deslizar antes disso passeia pelo mapa).
 * Tudo também pelo teclado.
 */
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

  // Ordem de leitura (de cima para baixo): é também a ordem do Tab.
  const ordem = useMemo(() => {
    const lista: No[] = [];
    const andar = (n: No) => (lista.push(n), n.filhos.forEach(andar));
    andar(raiz);
    return lista;
  }, [raiz]);

  const automaticas = useMemo(() => posicoesAutomaticas(raiz), [raiz]);
  const [manuais, setManuais] = useState<Record<string, Ponto>>({});
  const [vista, setVista] = useState<Vista | null>(null);
  // Só grava depois de ler do cofre, para não apagar posições guardadas.
  const [lido, setLido] = useState(false);
  useEffect(() => {
    let vivo = true;
    setLido(false);
    lerMapa(projetoId).then(
      (g) => {
        if (!vivo) return;
        if (g) {
          setManuais(Object.fromEntries(Object.entries(g.pos).map(([id, [x, y]]) => [id, { x, y }])));
          if (g.vista) setVista(g.vista);
        }
        setLido(true);
      },
      () => {}, // cofre bloqueado: o mapa funciona, só não lembra
    );
    return () => void (vivo = false);
  }, [projetoId]);
  const posDe = useCallback((id: string): Ponto => manuais[id] ?? automaticas[id] ?? { x: 0, y: 0 }, [manuais, automaticas]);

  const [ligacoes, setLigacoes] = useState<[string, string][]>([]);
  const [selecionado, setSelecionado] = useState(projetoId);
  const [criando, setCriando] = useState<{ paiId: string; antesDe: string | null; pos?: Ponto } | null>(null);
  const [renomeando, setRenomeando] = useState<No | null>(null);
  const [excluindo, setExcluindo] = useState<No | null>(null);
  const [ligandoDe, setLigandoDe] = useState<No | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [movendo, setMovendo] = useState<string | null>(null);
  const [linhaAlca, setLinhaAlca] = useState<{ de: string; ate: Ponto; alvo: string | null } | null>(null);

  const tela = useRef<HTMLDivElement>(null);
  const nos = useRef(new Map<string, HTMLElement>());
  const ponteiros = useRef(new Map<number, Ponto>());
  const gesto = useRef<Gesto | null>(null);
  const ultimoToque = useRef<Toque | null>(null);
  const focoPendente = useRef<string | null>(null);

  // Os manipuladores do ponteiro leem sempre o estado mais novo por aqui.
  const atualRef = useRef({ vista, posDe });
  atualRef.current = { vista, posDe };

  const atual = ordem.find((n) => n.id === selecionado) ?? raiz;
  const noDe = (id: string) => ordem.find((n) => n.id === id);
  const ids = useMemo(() => new Set(ordem.map((n) => n.id)), [ordem]);

  // Ligações entre etapas e subtarefas deste projeto (as mesmas da seção "Ligações").
  useEffect(() => {
    let vivo = true;
    const tarefasIds = new Set(tarefas.map((x) => x.id));
    Promise.all(tarefas.map((x) => api.itensLigados(x.id).then((l) => l.filter((o) => tarefasIds.has(o.id)).map((o) => [x.id, o.id] as [string, string]))))
      .then((pares) => {
        if (!vivo) return;
        const vistos = new Set<string>();
        const unicos = pares.flat().filter(([a, b]) => {
          const k = a < b ? `${a}|${b}` : `${b}|${a}`;
          return vistos.has(k) ? false : (vistos.add(k), true);
        });
        setLigacoes(unicos);
      })
      .catch(() => vivo && setLigacoes([]));
    return () => void (vivo = false);
  }, [tarefas]);

  // Guarda posições e vista (um instante depois de parar de mexer).
  useEffect(() => {
    if (!lido) return;
    const id = window.setTimeout(() => {
      const pos = Object.fromEntries(Object.entries(manuais).filter(([k]) => ids.has(k)).map(([k, p]) => [k, [Math.round(p.x), Math.round(p.y)] as [number, number]]));
      const g: Guardado = vista ? { pos, vista } : { pos };
      api.gravarValor(chaveMapa(projetoId), g).catch(() => {});
    }, 300);
    return () => window.clearTimeout(id);
  }, [manuais, vista, ids, projetoId, lido]);

  const tamanhoTela = () => {
    const r = tela.current?.getBoundingClientRect();
    return { w: r?.width ?? 800, h: r?.height ?? 500 };
  };
  const verTudo = useCallback(() => {
    const { w, h } = tamanhoTela();
    setVista(enquadrar(ordem.map((n) => posDe(n.id)), w, h));
  }, [ordem, posDe]);

  // Primeira vez neste projeto: mostra tudo.
  useLayoutEffect(() => {
    if (!vista) verTudo();
  }, [vista, verTudo]);

  // Ctrl + roda (e a pinça do touchpad, que chega assim) aproxima em volta do ponteiro.
  // Sem Ctrl, a roda rola a página como sempre.
  useEffect(() => {
    const el = tela.current;
    if (!el) return;
    const aoRodar = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const v = atualRef.current.vista;
      if (v) setVista(zoomEm(v, Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top }));
    };
    el.addEventListener("wheel", aoRodar, { passive: false });
    return () => el.removeEventListener("wheel", aoRodar);
  }, []);

  useEffect(() => {
    const id = focoPendente.current;
    if (id && nos.current.has(id)) {
      focoPendente.current = null;
      nos.current.get(id)!.focus({ preventScroll: true });
    }
  }, [ordem]);

  const escolher = (id: string) => {
    setSelecionado(id);
    setAviso(null);
    const el = nos.current.get(id);
    if (el) requestAnimationFrame(() => el.focus({ preventScroll: true }));
    else focoPendente.current = id;
  };

  // Se o item focado pelo Tab está fora da vista, a vista anda até ele.
  const garantirVisivel = (id: string) => {
    if (!vista) return;
    const { w, h } = tamanhoTela();
    const p = paraTela(vista, posDe(id));
    const margem = 80;
    if (p.x >= margem && p.x <= w - margem && p.y >= margem && p.y <= h - margem) return;
    setVista({ ...vista, x: vista.x + (w / 2 - p.x), y: vista.y + (h / 2 - p.y) });
  };

  const criarDentro = (n: No, pos?: Ponto) => {
    if (n.nivel === 2) return setAviso(t.soDoisNiveis);
    setCriando({ paiId: n.id, antesDe: null, pos });
  };
  const criarAoLado = (n: No) => {
    if (n.nivel === 0) return criarDentro(n);
    const pai = noDe(n.paiId!)!;
    const i = pai.filhos.findIndex((x) => x.id === n.id);
    setCriando({ paiId: pai.id, antesDe: pai.filhos[i + 1]?.id ?? null });
  };
  const alternarFeito = (n: No) => n.tarefa && executar(() => api.mudarEstadoTarefa(n.tarefa!.id, n.tarefa!.estado === "feita" ? "a_fazer" : "feita"));

  const jaLigados = (a: string, b: string) => ligacoes.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const ligar = (a: string, b: string) => {
    if (a === projetoId || b === projetoId) return setAviso(t.soTarefas);
    if (jaLigados(a, b)) return setAviso(t.jaLigados);
    executar(async () => (await api.ligarItens(a, b, true), setAviso(t.ligou(noDe(a)?.titulo ?? "", noDe(b)?.titulo ?? ""))));
  };

  const mover = (id: string, p: Ponto) => setManuais((m) => ({ ...m, [id]: p }));
  const aproximar = (fator: number) => {
    if (!vista) return;
    const { w, h } = tamanhoTela();
    setVista(zoomEm(vista, fator, { x: w / 2, y: h / 2 }));
  };
  const arrumar = () => {
    setManuais({});
    setAviso(t.arrumado);
    const { w, h } = tamanhoTela();
    setVista(enquadrar(Object.values(automaticas), w, h));
  };

  // ——— Ponteiro: mouse, caneta e dedo pelo mesmo caminho ———

  const local = (e: { clientX: number; clientY: number }): Ponto => {
    const r = tela.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const aoApertar = (e: PointerEvent<HTMLDivElement>) => {
    const v = atualRef.current.vista;
    if (!v || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = e.target as Element;
    const p = local(e);
    tela.current!.setPointerCapture(e.pointerId);
    ponteiros.current.set(e.pointerId, p);

    // Dois dedos: pinça (aproxima e passeia ao mesmo tempo). Cancela o que o primeiro dedo fazia.
    if (ponteiros.current.size === 2) {
      const g = gesto.current;
      if (g?.tipo === "espera") window.clearTimeout(g.timer);
      setMovendo(null);
      setLinhaAlca(null);
      const [a, b] = [...ponteiros.current.values()];
      gesto.current = { tipo: "pinca", d0: Math.max(1, distancia(a, b)), meio0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, vista0: v };
      return;
    }
    if (ponteiros.current.size > 2) return;

    const alca = el.closest<HTMLElement>("[data-alca]");
    if (alca) {
      e.preventDefault();
      gesto.current = { tipo: "alca", id: e.pointerId, de: alca.dataset.alca! };
      setLinhaAlca({ de: alca.dataset.alca!, ate: paraMundo(v, p), alvo: null });
      return;
    }
    const no = el.closest<HTMLElement>("[data-no]");
    if (no) {
      e.preventDefault();
      const noId = no.dataset.no!;
      const centro = atualRef.current.posDe(noId);
      const m = paraMundo(v, p);
      const desloc = { x: m.x - centro.x, y: m.y - centro.y };
      if (e.pointerType === "touch") {
        // No dedo: segurar 150 ms pega o item; deslizar antes disso passeia pelo mapa.
        const timer = window.setTimeout(() => {
          const g = gesto.current;
          if (g?.tipo === "espera" && g.id === e.pointerId) {
            gesto.current = { tipo: "no", id: g.id, noId: g.noId, inicio: g.inicio, desloc: g.desloc, moveu: false };
            setMovendo(g.noId);
          }
        }, 150);
        gesto.current = { tipo: "espera", id: e.pointerId, noId, inicio: p, desloc, timer };
      } else {
        gesto.current = { tipo: "no", id: e.pointerId, noId, inicio: p, desloc, moveu: false };
      }
      return;
    }
    gesto.current = { tipo: "fundo", id: e.pointerId, inicio: p, vista0: v, moveu: false };
  };

  const aoMover = (e: PointerEvent<HTMLDivElement>) => {
    if (!ponteiros.current.has(e.pointerId)) return;
    const p = local(e);
    ponteiros.current.set(e.pointerId, p);
    const g = gesto.current;
    const v = atualRef.current.vista;
    if (!g || !v) return;

    if (g.tipo === "pinca") {
      const [a, b] = [...ponteiros.current.values()];
      if (!b) return;
      const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const base = zoomEm(g.vista0, distancia(a, b) / g.d0, g.meio0);
      setVista({ ...base, x: base.x + meio.x - g.meio0.x, y: base.y + meio.y - g.meio0.y });
      return;
    }
    if ("id" in g && g.id !== e.pointerId) return;

    if (g.tipo === "espera") {
      if (distancia(p, g.inicio) <= 8) return;
      window.clearTimeout(g.timer);
      gesto.current = { tipo: "fundo", id: g.id, inicio: g.inicio, vista0: v, moveu: true };
      setVista({ ...v, x: v.x + p.x - g.inicio.x, y: v.y + p.y - g.inicio.y });
      return;
    }
    if (g.tipo === "fundo") {
      if (!g.moveu && distancia(p, g.inicio) < 4) return;
      g.moveu = true;
      setVista({ ...g.vista0, x: g.vista0.x + p.x - g.inicio.x, y: g.vista0.y + p.y - g.inicio.y });
      return;
    }
    if (g.tipo === "no") {
      if (!g.moveu && distancia(p, g.inicio) < 4) return;
      if (!g.moveu) (g.moveu = true), setMovendo(g.noId);
      const m = paraMundo(v, p);
      mover(g.noId, { x: m.x - g.desloc.x, y: m.y - g.desloc.y });
      return;
    }
    if (g.tipo === "alca") {
      const sob = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-no]")?.dataset.no ?? null;
      setLinhaAlca({ de: g.de, ate: paraMundo(v, p), alvo: sob && sob !== g.de ? sob : null });
    }
  };

  const tocar = (alvo: string | null, p: Ponto) => {
    const agora: Toque = { t: performance.now(), x: p.x, y: p.y, alvo };
    const duplo = toqueDuplo(ultimoToque.current, agora);
    ultimoToque.current = duplo ? null : agora;
    return duplo;
  };

  const aoSoltar = (e: PointerEvent<HTMLDivElement>) => {
    if (!ponteiros.current.delete(e.pointerId)) return;
    const g = gesto.current;
    const v = atualRef.current.vista;
    if (!g || !v) return;
    if (g.tipo === "pinca") {
      if (ponteiros.current.size === 0) gesto.current = null;
      return;
    }
    if (g.id !== e.pointerId) return;
    gesto.current = null;
    const p = local(e);

    if (g.tipo === "espera" || (g.tipo === "no" && !g.moveu)) {
      if (g.tipo === "espera") window.clearTimeout(g.timer);
      setMovendo(null);
      const n = noDe(g.noId);
      if (n && tocar(n.id, p)) setRenomeando(n);
      else escolher(g.noId);
      return;
    }
    if (g.tipo === "no") {
      setMovendo(null);
      return;
    }
    if (g.tipo === "fundo") {
      // Toque duplo no fundo: item novo ali, dentro do escolhido (ou ao lado, se já é subtarefa).
      if (!g.moveu && tocar(null, p)) {
        const pai = atual.nivel === 2 ? noDe(atual.paiId!)! : atual;
        setCriando({ paiId: pai.id, antesDe: null, pos: paraMundo(v, p) });
      }
      return;
    }
    if (g.tipo === "alca") {
      const linha = linhaAlca;
      setLinhaAlca(null);
      const sob = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-no]")?.dataset.no ?? null;
      if (sob && sob !== g.de) return ligar(g.de, sob);
      const ate = paraMundo(v, p);
      const de = noDe(g.de);
      // Soltar no vazio, longe o bastante do próprio item: cria um item dentro, ali.
      if (de && !sob && linha && distancia(ate, posDe(de.id)) > 60) criarDentro(de, ate);
    }
  };

  const aoCancelar = (e: PointerEvent<HTMLDivElement>) => {
    ponteiros.current.delete(e.pointerId);
    const g = gesto.current;
    if (g?.tipo === "espera") window.clearTimeout(g.timer);
    gesto.current = null;
    setMovendo(null);
    setLinhaAlca(null);
  };

  // ——— Teclado ———

  const aoTeclar = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("[data-no]") === null) return;
    if (e.altKey) return;
    const novo = !e.ctrlKey && !e.metaKey ? moverPorTecla(posDe(atual.id), e.key, e.shiftKey) : null;
    if (novo) {
      e.preventDefault();
      mover(atual.id, novo);
      return;
    }
    const acoes: Record<string, () => void> = {
      F2: () => setRenomeando(atual),
      Delete: () => atual.nivel > 0 && setExcluindo(atual),
      " ": () => alternarFeito(atual),
      Enter: () => (e.ctrlKey || e.metaKey ? criarDentro(atual) : criarAoLado(atual)),
      l: () => atual.nivel > 0 && setLigandoDe(atual),
      L: () => atual.nivel > 0 && setLigandoDe(atual),
      "+": () => aproximar(1.2),
      "=": () => aproximar(1.2),
      "-": () => aproximar(1 / 1.2),
      "0": verTudo,
    };
    const acao = acoes[e.key];
    if (acao && !(e.key !== "Enter" && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      acao();
    }
  };

  // ——— Desenho ———

  const ligadosAoAtual = ligacoes
    .filter(([a, b]) => a === atual.id || b === atual.id)
    .map(([a, b]) => noDe(a === atual.id ? b : a))
    .filter((n): n is No => !!n);
  const linhasPai = ordem.filter((n) => n.paiId).map((n) => ({ id: n.id, d: curva(posDe(n.paiId!), posDe(n.id)) }));
  const linhasLigacao = ligacoes.filter(([a, b]) => ids.has(a) && ids.has(b)).map(([a, b]) => ({ id: `${a}|${b}`, d: curva(posDe(a), posDe(b)) }));
  const v = vista ?? { x: 0, y: 0, z: 1 };

  return (
    <div className="mapa-area">
      <p className="texto-suave pequeno" id="mapa-instrucoes">{t.instrucoes}</p>
      <p className="visualmente-oculto" id="mapa-teclado">{t.instrucoesTeclado}</p>
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
          <Button className="botao" onPress={() => alternarFeito(atual)}>
            <Check aria-hidden="true" size="1.1em" /> {atual.tarefa.estado === "feita" ? t.desfeito : t.feito}
          </Button>
        )}
        {atual.nivel > 0 && ordem.length > 2 && (
          <Button className="botao" onPress={() => setLigandoDe(atual)}>
            <Link2 aria-hidden="true" size="1.1em" /> {t.ligarA}
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
      {ligadosAoAtual.length > 0 && (
        <div className="mapa-ligados">
          <span className="texto-suave pequeno">{t.ligados}</span>
          {ligadosAoAtual.map((n) => (
            <span key={n.id} className="mapa-ligado">
              <span className="quebra">{n.titulo}</span>
              <Button className="botao-icone" aria-label={t.desligar(n.titulo)} onPress={() => executar(() => api.ligarItens(atual.id, n.id, false))}>
                <X aria-hidden="true" size="1em" />
              </Button>
            </span>
          ))}
        </div>
      )}
      {aviso && <p className="aviso" role="status">{aviso}</p>}

      <div className="mapa-moldura">
        <div
          ref={tela}
          className={movendo || linhaAlca ? "mapa-tela mexendo" : "mapa-tela"}
          role="application"
          aria-roledescription={t.papelTela}
          aria-label={titulo}
          aria-describedby="mapa-teclado"
          onPointerDown={aoApertar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoCancelar}
          onKeyDown={aoTeclar}
        >
          <div className="mapa-mundo" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.z})` }}>
            <svg className="mapa-linhas" width="1" height="1" aria-hidden="true">
              {linhasPai.map((l) => <path key={l.id} d={l.d} className="mapa-linha" />)}
              {linhasLigacao.map((l) => <path key={l.id} d={l.d} className="mapa-linha ligacao" />)}
              {linhaAlca && <path d={curva(posDe(linhaAlca.de), linhaAlca.ate)} className="mapa-linha puxando" />}
            </svg>
            {ordem.map((n) => {
              const p = posDe(n.id);
              const feito = n.tarefa?.estado === "feita";
              const escolhido = n.id === atual.id;
              return (
                <div
                  key={n.id}
                  data-no={n.id}
                  role="button"
                  aria-roledescription={t.papelNo}
                  aria-current={escolhido ? "true" : undefined}
                  tabIndex={0}
                  ref={(el) => void (el ? nos.current.set(n.id, el) : nos.current.delete(n.id))}
                  className={[
                    "mapa-no", "mapa-no-livre", `nivel-${n.nivel}`,
                    escolhido && "selecionado", feito && "feito",
                    movendo === n.id && "movendo", linhaAlca?.alvo === n.id && "alvo",
                  ].filter(Boolean).join(" ")}
                  style={{ left: p.x, top: p.y }}
                  onFocus={() => (setSelecionado(n.id), garantirVisivel(n.id))}
                >
                  {feito && <Check aria-hidden="true" size="1em" />}
                  <span className="quebra">{n.titulo}</span>
                  {n.tarefa?.prazo && <EtiquetaPrazo prazo={n.tarefa.prazo} />}
                  {feito && <span className="visualmente-oculto">({textos.projeto.estadosTarefa.feita})</span>}
                  {escolhido && <span className="mapa-alca" data-alca={n.id} title={t.alca} aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mapa-vista" role="group" aria-label={t.titulo}>
          <Button className="botao-icone" aria-label={t.afastar} onPress={() => aproximar(1 / 1.2)}>−</Button>
          <span className="texto-suave pequeno mapa-zoom" aria-hidden="true">{t.zoom(Math.round(v.z * 100))}</span>
          <Button className="botao-icone" aria-label={t.aproximar} onPress={() => aproximar(1.2)}>+</Button>
          <Button className="botao pequeno" onPress={verTudo}>{t.verTudo}</Button>
          {Object.keys(manuais).length > 0 && (
            <Button className="botao pequeno com-icone" onPress={arrumar}>
              <RotateCcw aria-hidden="true" size="1em" /> {t.arrumar}
            </Button>
          )}
        </div>
      </div>

      <Janela titulo={t.novoItem} aberta={!!criando} aoFechar={() => setCriando(null)}>
        {criando && (
          <EditarTexto
            inicial=""
            rotulo={t.nomeDoItem}
            aoCancelar={() => setCriando(null)}
            aoSalvar={(nome) =>
              executar(async () => {
                const nova = await api.criarTarefa(criando.paiId, nome);
                if (criando.antesDe) await api.moverTarefa(nova.id, criando.antesDe);
                if (criando.pos) mover(nova.id, criando.pos);
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
      <Janela titulo={t.ligarTitulo} aberta={!!ligandoDe} aoFechar={() => setLigandoDe(null)}>
        {ligandoDe && (
          <div className="formulario">
            <p className="quebra">{ligandoDe.titulo}</p>
            <Escolha
              rotulo={t.ligarEscolha}
              valor={null}
              vazio={t.escolhaItem}
              opcoes={ordem.filter((n) => n.nivel > 0 && n.id !== ligandoDe.id && !jaLigados(n.id, ligandoDe.id)).map((n) => ({ valor: n.id, nome: n.titulo }))}
              aoMudar={(id) => (ligar(ligandoDe.id, id), setLigandoDe(null), escolher(ligandoDe.id))}
            />
            <div className="janela-acoes">
              <Button className="botao" onPress={() => setLigandoDe(null)}>{textos.comum.cancelar}</Button>
            </div>
          </div>
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
