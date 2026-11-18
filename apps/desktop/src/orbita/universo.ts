// O Órbita visto como um sistema solar: no centro, o agora; em volta, o que é de hoje;
// mais longe, os espaços (Caderno, Estudos, Projetos…) como planetas, cada um com as
// coisas dele em órbita (os cadernos, os projetos, os livros). Este arquivo só monta a
// árvore e faz as contas das órbitas: não desenha nada (o desenho fica em cena.ts).
import type { SecaoMenu } from "../preferencias";

export type Mundo = "terra" | "selva" | "deserto" | "areia" | "rocha" | "rocha-lilas" | "gelo" | "gelo-claro" | "gas-rosa" | "gas-ouro" | "gas-violeta" | "gas-azul" | "gas-laranja" | "gas-magenta";

/** O que abrir quando a pessoa escolhe um corpo. */
export type Alvo = { tipo: "secao"; secao: SecaoMenu } | { tipo: "caderno" | "livro" | "projeto"; id: string; secao: SecaoMenu };

export interface No {
  id: string;
  nome: string;
  tipo: "agora" | "hoje" | "espaco" | "coisa" | "novo";
  cor: string;
  det?: string;
  alvo?: Alvo;
  mundo?: Mundo;
  aneis?: boolean;
  filhos: No[];
  // Contas da órbita (preenchidas por `arrumar`).
  prof: number;
  pai: No | null;
  /** 0: hoje; 1 e 2: os dois anéis de planetas (só nos filhos do centro). */
  anel: number;
  /** Raio da órbita em volta do pai, ângulo inicial, voltas por segundo (em radianos) e tamanho do corpo. */
  r: number; a0: number; w: number; s: number;
  /** Inclinação do plano das órbitas dos filhos e até onde o sistema dele vai. */
  incl: number; ext: number;
}

/** O que cada espaço vira no céu. */
export const ESPACOS: Partial<Record<SecaoMenu, { nome: string; cor: string; mundo: Mundo; aneis?: boolean }>> = {
  caderno: { nome: "Caderno", cor: "#8fb7ff", mundo: "terra" },
  estudos: { nome: "Estudos", cor: "#7fd4c1", mundo: "gelo" },
  projetos: { nome: "Projetos", cor: "#9ad37a", mundo: "selva" },
  ideias: { nome: "Ideias", cor: "#f5c869", mundo: "gas-ouro", aneis: true },
  agenda: { nome: "Agenda", cor: "#b9c2cf", mundo: "rocha" },
  leitura: { nome: "Leitura", cor: "#f0a46e", mundo: "deserto" },
  saude: { nome: "Saúde", cor: "#f29bb8", mundo: "gas-rosa" },
  dinheiro: { nome: "Dinheiro", cor: "#b7a2f2", mundo: "gas-violeta" },
  organizacao: { nome: "Organização", cor: "#8fc4e8", mundo: "gas-azul" },
  rotinas: { nome: "Rotinas", cor: "#e3cf9a", mundo: "areia" },
  foco: { nome: "Foco", cor: "#cfe6f2", mundo: "gelo-claro" },
  energia: { nome: "Energia", cor: "#f7b267", mundo: "gas-laranja" },
  cuidado: { nome: "Cuidado", cor: "#c9a8e0", mundo: "rocha-lilas" },
  hobbies: { nome: "Hobbies", cor: "#e58fd0", mundo: "gas-magenta" },
};

export interface CoisaEntrada { id: string; nome: string; det?: string; alvo: Alvo }
export interface EspacoEntrada { secao: SecaoMenu; coisas?: CoisaEntrada[]; novo?: string }
export interface HojeEntrada { id: string; nome: string; det?: string; cor?: string; alvo: Alvo }
export interface DadosOrbita { agora: string; hoje: HojeEntrada[]; espacos: EspacoEntrada[] }

/** Quantas luas aparecem em volta de um planeta; o resto vira um "+ N" que abre o espaço. */
export const MAXIMO_LUAS = 11;
export const MAXIMO_HOJE = 6;

const base = (id: string, nome: string, tipo: No["tipo"], cor: string, extra: Partial<No> = {}): No =>
  ({ id, nome, tipo, cor, filhos: [], prof: 0, pai: null, anel: 0, r: 0, a0: 0, w: 0, s: 1, incl: 0, ext: 1, ...extra });

/** Monta a árvore a partir dos dados da pessoa. */
export function montarUniverso(d: DadosOrbita): No {
  const raiz = base("agora", d.agora, "agora", "#ffd9a0");
  for (const h of d.hoje.slice(0, MAXIMO_HOJE)) raiz.filhos.push(base(`hoje:${h.id}`, h.nome, "hoje", h.cor || "#b9c2cf", { det: h.det, alvo: h.alvo }));
  for (const e of d.espacos) {
    const info = ESPACOS[e.secao];
    if (!info) continue;
    const planeta = base(`espaco:${e.secao}`, info.nome, "espaco", info.cor, { mundo: info.mundo, aneis: info.aneis, alvo: { tipo: "secao", secao: e.secao } });
    const coisas = e.coisas ?? [];
    if (e.novo) planeta.filhos.push(base(`novo:${e.secao}`, e.novo, "novo", info.cor, { alvo: { tipo: "secao", secao: e.secao } }));
    const cabem = coisas.length > MAXIMO_LUAS ? MAXIMO_LUAS - 1 : coisas.length;
    for (const c of coisas.slice(0, cabem)) planeta.filhos.push(base(`coisa:${e.secao}:${c.id}`, c.nome, "coisa", info.cor, { det: c.det, alvo: c.alvo }));
    if (coisas.length > cabem) planeta.filhos.push(base(`mais:${e.secao}`, `+ ${coisas.length - cabem} em ${info.nome}`, "novo", info.cor, { alvo: { tipo: "secao", secao: e.secao } }));
    raiz.filhos.push(planeta);
  }
  arrumar(raiz);
  return raiz;
}

/** Número entre 0 e 1 que depende só do texto (para cada planeta ter sempre o mesmo jeito). */
export function semente(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

const RAIO_HOJE = 15, RAIO_PLANETAS = [34, 54];
const VOLTA = 2 * Math.PI;

/** Calcula as órbitas: raio, ângulo, velocidade e tamanho de cada corpo, de cima para baixo. */
export function arrumar(n: No, prof = 0, pai: No | null = null): void {
  n.prof = prof; n.pai = pai;
  const f = n.filhos;
  if (prof === 0) {
    n.s = 6; n.incl = 0;
    const hoje = f.filter((k) => k.tipo === "hoje"), planetas = f.filter((k) => k.tipo !== "hoje");
    // Até 8 planetas cabem num anel só; com mais, o segundo anel recebe a outra metade.
    const dentro = planetas.length <= 8 ? planetas.length : Math.ceil(planetas.length / 2);
    hoje.forEach((k, i) => { k.anel = 0; k.r = RAIO_HOJE; k.a0 = (VOLTA * i) / hoje.length + 0.4; k.w = VOLTA / 80; k.s = 0.75; });
    planetas.forEach((k, i) => {
      const fora = i >= dentro, grupo = fora ? planetas.length - dentro : dentro, j = fora ? i - dentro : i;
      k.anel = fora ? 2 : 1; k.r = RAIO_PLANETAS[fora ? 1 : 0]; k.a0 = (VOLTA * j) / grupo + (fora ? 0.45 : 0.9);
      k.w = VOLTA / (fora ? 320 : 200); k.s = 2.1 + semente(k.id) * 1.1; k.incl = 0.2 + semente(`${k.id}i`) * 0.5;
    });
  } else {
    const aneis = f.length <= 7 ? [f] : [f.slice(0, Math.ceil(f.length / 2)), f.slice(Math.ceil(f.length / 2))];
    aneis.forEach((grupo, j) => grupo.forEach((k, i) => {
      k.anel = j; k.r = (j === 0 ? 2.6 : 3.7) * n.s; k.a0 = (VOLTA * i) / grupo.length + prof * 0.9 + j * 0.5;
      k.w = (VOLTA / (prof === 1 ? 50 : 28)) * (j ? 0.7 : 1); k.s = n.s * (k.tipo === "novo" ? 0.17 : 0.2); k.incl = 0.35;
    }));
  }
  for (const k of f) arrumar(k, prof + 1, n);
  n.ext = f.length ? Math.max(...f.map((k) => k.r + k.s * 2.5)) : n.s * 4;
}

/** Todos os corpos, de cima para baixo. */
export function todos(n: No, lista: No[] = []): No[] {
  lista.push(n);
  for (const k of n.filhos) todos(k, lista);
  return lista;
}

export const ancestral = (a: No, n: No | null): boolean => { for (; n; n = n.pai) if (n === a) return true; return false; };

/** Onde o corpo está no instante `t` (segundos), em relação ao pai. */
export function posicaoLocal(n: No, t: number): [number, number, number] {
  if (!n.pai) return [0, 0, 0];
  const a = n.a0 + n.w * t, x = n.r * Math.cos(a), z = n.r * Math.sin(a), i = n.pai.incl;
  return [x, -Math.sin(i) * z, Math.cos(i) * z];
}
