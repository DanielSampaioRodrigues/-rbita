// Ponte com a parte nativa (Rust). Fora do app (navegador, testes de tela),
// usa uma simulação em memória para a interface poder ser vista e testada.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export type ModoAbrir = "hello" | "pin" | "senha" | "direto";

export interface Situacao {
  existe: boolean;
  modo: ModoAbrir | null;
  tentativasRestantes: number;
  aberto: boolean;
}

export interface Ideia {
  id: string;
  texto: string;
  criadoEm: number;
}

export interface OndeParei {
  texto: string;
  proximoPasso: string;
  links: string[];
  atualizadoEm: number;
}

export type EstadoProjeto = "ativo" | "pausado" | "concluido";
export type EstadoTarefa = "a_fazer" | "fazendo" | "feita";

export interface Projeto {
  id: string;
  titulo: string;
  estado: EstadoProjeto;
  ondeParei: OndeParei | null;
  pausadoEm: number | null;
  tarefasFeitas: number;
  tarefasTotal: number;
  alteradoEm: number;
}

export interface Tarefa {
  id: string;
  paiId: string;
  titulo: string;
  estado: EstadoTarefa;
  ordem: number;
}

export interface SituacaoBackup {
  pasta: string | null;
  ultimo: number | null;
  erro: string | null;
}

export interface InfoBackup {
  criadoEm: number;
  versaoApp: string;
}

export type CodigoErro =
  | "senha_errada"
  | "pin_errado"
  | "pin_bloqueado"
  | "palavras_erradas"
  | "chave_errada"
  | "senha_curta"
  | "pin_invalido"
  | "cofre_existe"
  | "cofre_ausente"
  | "bloqueado"
  | "aparelho_sem_chave"
  | "hello_cancelado"
  | "hello_indisponivel"
  | "backup_invalido"
  | "limite_projetos"
  | "texto_vazio"
  | "nao_encontrado"
  | "arquivo"
  | "interno";

export class ErroOrbita extends Error {
  constructor(
    public codigo: CodigoErro,
    mensagem: string,
    public tentativasRestantes?: number,
    public posicoes?: number[],
    public limite?: number,
  ) {
    super(mensagem);
  }
}

function comoErro(e: unknown): ErroOrbita {
  if (e instanceof ErroOrbita) return e;
  if (typeof e === "object" && e && "codigo" in e) {
    const x = e as { codigo: CodigoErro; mensagem: string; tentativasRestantes?: number; posicoes?: number[]; limite?: number };
    return new ErroOrbita(x.codigo, x.mensagem, x.tentativasRestantes, x.posicoes, x.limite);
  }
  return new ErroOrbita("interno", String(e));
}

interface Api {
  situacao(): Promise<Situacao>;
  criarCofre(senha: string, modo: ModoAbrir, pin?: string): Promise<string[]>;
  abrirComSenha(senha: string): Promise<void>;
  abrirComPin(pin: string): Promise<void>;
  abrirDireto(): Promise<void>;
  helloDisponivel(): Promise<boolean>;
  abrirComHello(): Promise<void>;
  conferirPalavras(texto: string): Promise<void>;
  recuperar(texto: string, novaSenha: string): Promise<void>;
  lerArquivoRecuperacao(caminho: string): Promise<string>;
  gravarArquivoRecuperacao(caminho: string): Promise<void>;
  verPalavras(senha: string): Promise<string[]>;
  trocarSenha(atual: string, nova: string): Promise<void>;
  mudarModo(senha: string, modo: ModoAbrir, pin?: string): Promise<void>;
  bloquear(): Promise<void>;
  listarIdeias(): Promise<Ideia[]>;
  criarIdeia(texto: string): Promise<Ideia>;
  editarIdeia(id: string, texto: string): Promise<void>;
  ideiaParaProjeto(id: string, ativo: boolean): Promise<Projeto>;
  excluirItem(id: string): Promise<void>;
  listarProjetos(): Promise<Projeto[]>;
  obterProjeto(id: string): Promise<Projeto>;
  criarProjeto(titulo: string, ativo: boolean): Promise<Projeto>;
  renomear(id: string, titulo: string): Promise<void>;
  mudarEstadoProjeto(id: string, novo: EstadoProjeto, ondeParei?: Omit<OndeParei, "atualizadoEm">): Promise<Projeto>;
  salvarOndeParei(id: string, ondeParei: Omit<OndeParei, "atualizadoEm">): Promise<void>;
  limiteProjetos(): Promise<number>;
  definirLimiteProjetos(limite: number): Promise<void>;
  listarTarefas(projetoId: string): Promise<Tarefa[]>;
  criarTarefa(paiId: string, titulo: string): Promise<Tarefa>;
  mudarEstadoTarefa(id: string, novo: EstadoTarefa): Promise<void>;
  moverTarefa(id: string, antesDe: string | null): Promise<void>;
  fazerBackup(caminho: string): Promise<void>;
  infoBackup(caminho: string): Promise<InfoBackup>;
  restaurarBackup(caminho: string, segredo: { senha?: string; palavras?: string }): Promise<ModoAbrir>;
  situacaoBackup(): Promise<SituacaoBackup>;
  definirBackupAutomatico(pasta: string | null): Promise<SituacaoBackup>;
}

const chamar = async <T>(comando: string, args?: Record<string, unknown>): Promise<T> => {
  try {
    return await invoke<T>(comando, args);
  } catch (e) {
    throw comoErro(e);
  }
};

const nativa: Api = {
  situacao: () => chamar("situacao"),
  criarCofre: (senha, modo, pin) => chamar("criar_cofre", { senha, modo, pin: pin ?? null }),
  abrirComSenha: (senha) => chamar("abrir_com_senha", { senha }),
  abrirComPin: (pin) => chamar("abrir_com_pin", { pin }),
  abrirDireto: () => chamar("abrir_direto"),
  helloDisponivel: () => chamar("hello_disponivel"),
  abrirComHello: () => chamar("abrir_com_hello"),
  conferirPalavras: (texto) => chamar("conferir_palavras", { texto }),
  recuperar: (texto, novaSenha) => chamar("recuperar", { texto, novaSenha }),
  lerArquivoRecuperacao: (caminho) => chamar("ler_arquivo_recuperacao", { caminho }),
  gravarArquivoRecuperacao: (caminho) => chamar("gravar_arquivo_recuperacao", { caminho }),
  verPalavras: (senha) => chamar("ver_palavras", { senha }),
  trocarSenha: (atual, nova) => chamar("trocar_senha", { atual, nova }),
  mudarModo: (senha, modo, pin) => chamar("mudar_modo", { senha, modo, pin: pin ?? null }),
  bloquear: () => chamar("bloquear"),
  listarIdeias: () => chamar("listar_ideias"),
  criarIdeia: (texto) => chamar("criar_ideia", { texto }),
  editarIdeia: (id, texto) => chamar("editar_ideia", { id, texto }),
  ideiaParaProjeto: (id, ativo) => chamar("ideia_para_projeto", { id, ativo }),
  excluirItem: (id) => chamar("excluir_item", { id }),
  listarProjetos: () => chamar("listar_projetos"),
  obterProjeto: (id) => chamar("obter_projeto", { id }),
  criarProjeto: (titulo, ativo) => chamar("criar_projeto", { titulo, ativo }),
  renomear: (id, titulo) => chamar("renomear", { id, titulo }),
  mudarEstadoProjeto: (id, novo, ondeParei) =>
    chamar("mudar_estado_projeto", { id, novo, ondeParei: ondeParei ? { ...ondeParei, atualizadoEm: 0 } : null }),
  salvarOndeParei: (id, ondeParei) => chamar("salvar_onde_parei", { id, ondeParei: { ...ondeParei, atualizadoEm: 0 } }),
  limiteProjetos: () => chamar("limite_projetos"),
  definirLimiteProjetos: (limite) => chamar("definir_limite_projetos", { limite }),
  listarTarefas: (projetoId) => chamar("listar_tarefas", { projetoId }),
  criarTarefa: (paiId, titulo) => chamar("criar_tarefa", { paiId, titulo }),
  mudarEstadoTarefa: (id, novo) => chamar("mudar_estado_tarefa", { id, novo }),
  moverTarefa: (id, antesDe) => chamar("mover_tarefa", { id, antesDe }),
  fazerBackup: (caminho) => chamar("fazer_backup", { caminho }),
  infoBackup: (caminho) => chamar("info_backup", { caminho }),
  restaurarBackup: (caminho, { senha, palavras }) =>
    chamar("restaurar_backup", { caminho, senha: senha ?? null, palavras: palavras ?? null }),
  situacaoBackup: () => chamar("situacao_backup"),
  definirBackupAutomatico: (pasta) => chamar("definir_backup_automatico", { pasta }),
};

/** Parte da simulação que cuida de ideias, projetos e tarefas (mesmas regras da parte nativa). */
function simularItens() {
  type Item = { id: string; tipo: "ideia" | "projeto" | "tarefa"; texto: string; estado: string; paiId: string | null; ordem: number; criadoEm: number; alteradoEm: number; ondeParei: OndeParei | null; pausadoEm: number | null };
  const itens: Item[] = [];
  let limite = 3;
  const agora = () => Date.now();
  const novo = (x: Partial<Item> & Pick<Item, "tipo" | "texto" | "estado">): Item => {
    const item: Item = { id: crypto.randomUUID(), paiId: null, ordem: 0, criadoEm: agora(), alteradoEm: agora(), ondeParei: null, pausadoEm: null, ...x };
    itens.push(item);
    return item;
  };
  const vazio = (t: string) => {
    if (!t.trim()) throw new ErroOrbita("texto_vazio", "Escreva alguma coisa antes de salvar.");
    return t.trim();
  };
  const tarefasDe = (pid: string) => {
    const etapas = itens.filter((i) => i.tipo === "tarefa" && i.paiId === pid);
    return [...etapas, ...itens.filter((i) => i.tipo === "tarefa" && etapas.some((e) => e.id === i.paiId))];
  };
  const comoProjeto = (p: Item): Projeto => {
    const t = tarefasDe(p.id);
    return { id: p.id, titulo: p.texto, estado: p.estado as EstadoProjeto, ondeParei: p.ondeParei, pausadoEm: p.pausadoEm,
      tarefasFeitas: t.filter((x) => x.estado === "feita").length, tarefasTotal: t.length, alteradoEm: p.alteradoEm };
  };
  const achar = (id: string) => {
    const i = itens.find((x) => x.id === id);
    if (!i) throw new ErroOrbita("nao_encontrado", "Não encontrei esse item.");
    return i;
  };
  const conferirLimite = () => {
    if (itens.filter((i) => i.tipo === "projeto" && i.estado === "ativo").length >= limite)
      throw new ErroOrbita("limite_projetos", `Já existem ${limite} projetos ativos, o limite que você definiu.`, undefined, undefined, limite);
  };
  const criarProjeto = async (titulo: string, ativo: boolean) => {
    if (ativo) conferirLimite();
    return comoProjeto(novo({ tipo: "projeto", texto: vazio(titulo), estado: ativo ? "ativo" : "pausado", pausadoEm: ativo ? null : agora() }));
  };
  const projetoDa = (paiId: string) => {
    const pai = achar(paiId);
    return pai.tipo === "projeto" ? pai : achar(pai.paiId!);
  };
  // Exemplo para as telas não começarem vazias.
  if (new URLSearchParams(globalThis.location?.search ?? "").get("exemplo")) {
    novo({ tipo: "ideia", texto: "Podcast sobre neurodivergência e trabalho", estado: "guardada" });
    novo({ tipo: "ideia", texto: "Aprender encadernação japonesa", estado: "guardada" });
    const tcc = novo({ tipo: "projeto", texto: "TCC: atenção e interesses especiais", estado: "ativo",
      ondeParei: { texto: "Fichando o artigo da Grandin", proximoPasso: "Abrir o PDF na página 12 e terminar o fichamento", links: ["https://scholar.google.com"], atualizadoEm: agora() - 3_600_000 } });
    const e1 = novo({ tipo: "tarefa", texto: "Revisão de literatura", estado: "fazendo", paiId: tcc.id, ordem: 1 });
    novo({ tipo: "tarefa", texto: "Fichar 5 artigos", estado: "feita", paiId: e1.id, ordem: 1 });
    novo({ tipo: "tarefa", texto: "Organizar as citações", estado: "a_fazer", paiId: e1.id, ordem: 2 });
    novo({ tipo: "tarefa", texto: "Escrever a introdução", estado: "a_fazer", paiId: tcc.id, ordem: 2 });
    novo({ tipo: "tarefa", texto: "Marcar reunião com a orientadora", estado: "feita", paiId: tcc.id, ordem: 3 });
    novo({ tipo: "projeto", texto: "Reformar a estante", estado: "ativo" });
    novo({ tipo: "projeto", texto: "Curso de ilustração", estado: "pausado", pausadoEm: agora() - 86_400_000 * 9,
      ondeParei: { texto: "Terminei o módulo 3", proximoPasso: "Assistir a aula sobre luz e sombra", links: [], atualizadoEm: agora() - 86_400_000 * 9 } });
  }
  return {
    listarIdeias: async () =>
      itens.filter((i) => i.tipo === "ideia" && i.estado === "guardada").sort((a, b) => b.criadoEm - a.criadoEm)
        .map((i) => ({ id: i.id, texto: i.texto, criadoEm: i.criadoEm })),
    criarIdeia: async (texto: string) => {
      const i = novo({ tipo: "ideia", texto: vazio(texto), estado: "guardada" });
      return { id: i.id, texto: i.texto, criadoEm: i.criadoEm };
    },
    editarIdeia: async (id: string, texto: string) => void (achar(id).texto = vazio(texto)),
    ideiaParaProjeto: async (id: string, ativo: boolean) => {
      const ideia = achar(id);
      const p = await criarProjeto(ideia.texto, ativo);
      ideia.estado = "virou_projeto";
      return p;
    },
    excluirItem: async (id: string) => {
      const fora = new Set([id]);
      let mudou = true;
      while (mudou) {
        mudou = false;
        for (const i of itens) if (i.paiId && fora.has(i.paiId) && !fora.has(i.id)) (fora.add(i.id), (mudou = true));
      }
      for (let k = itens.length - 1; k >= 0; k--) if (fora.has(itens[k].id)) itens.splice(k, 1);
    },
    listarProjetos: async () => itens.filter((i) => i.tipo === "projeto").sort((a, b) => b.alteradoEm - a.alteradoEm).map(comoProjeto),
    obterProjeto: async (id: string) => comoProjeto(achar(id)),
    criarProjeto,
    renomear: async (id: string, titulo: string) => void (achar(id).texto = vazio(titulo)),
    mudarEstadoProjeto: async (id: string, estado: EstadoProjeto, ondeParei?: Omit<OndeParei, "atualizadoEm">) => {
      const p = achar(id);
      if (estado === "ativo" && p.estado !== "ativo") conferirLimite();
      if (ondeParei) p.ondeParei = { ...ondeParei, atualizadoEm: agora() };
      Object.assign(p, { estado, pausadoEm: estado === "pausado" ? agora() : null, alteradoEm: agora() });
      return comoProjeto(p);
    },
    salvarOndeParei: async (id: string, o: Omit<OndeParei, "atualizadoEm">) =>
      void (achar(id).ondeParei = { ...o, links: o.links.filter((l) => l.trim()), atualizadoEm: agora() }),
    limiteProjetos: async () => limite,
    definirLimiteProjetos: async (n: number) => void (limite = n),
    listarTarefas: async (pid: string) =>
      tarefasDe(pid).sort((a, b) => a.ordem - b.ordem)
        .map((t) => ({ id: t.id, paiId: t.paiId!, titulo: t.texto, estado: t.estado as EstadoTarefa, ordem: t.ordem })),
    criarTarefa: async (paiId: string, titulo: string) => {
      const ordem = Math.max(0, ...itens.filter((i) => i.paiId === paiId).map((i) => i.ordem)) + 1;
      const t = novo({ tipo: "tarefa", texto: vazio(titulo), estado: "a_fazer", paiId, ordem });
      projetoDa(paiId).alteradoEm = agora();
      return { id: t.id, paiId, titulo: t.texto, estado: "a_fazer" as EstadoTarefa, ordem };
    },
    mudarEstadoTarefa: async (id: string, estado: EstadoTarefa) => {
      const t = achar(id);
      t.estado = estado;
      projetoDa(t.paiId!).alteradoEm = agora();
    },
    moverTarefa: async (id: string, antesDe: string | null) => {
      const t = achar(id);
      const irmas = itens.filter((i) => i.paiId === t.paiId && i.id !== id).sort((a, b) => a.ordem - b.ordem);
      const pos = antesDe ? irmas.findIndex((i) => i.id === antesDe) : -1;
      irmas.splice(pos < 0 ? irmas.length : pos, 0, t);
      irmas.forEach((i, k) => (i.ordem = k + 1));
    },
  };
}

/** Simulação para ver as telas no navegador. Nada aqui é seguro nem guardado. */
function criarSimulacao(): Api {
  const PALAVRAS = ["janela", "cometa", "farol", "bambu", "orvalho", "tijolo"];
  const s = { existe: false, modo: null as ModoAbrir | null, senha: "", pin: "", erradas: 0, aberto: false };
  const backup: SituacaoBackup = { pasta: null, ultimo: null, erro: null };
  const espera = () => new Promise((r) => setTimeout(r, 250));
  const falha = (codigo: CodigoErro, msg: string, extra?: number) => Promise.reject(new ErroOrbita(codigo, msg, extra));
  const conferir = async (texto: string) => {
    await espera();
    if (texto.trim().toLowerCase().split(/\s+/).join(" ") !== PALAVRAS.join(" "))
      throw new ErroOrbita("chave_errada", "A chave de recuperação não abre estes dados.");
  };
  const params = new URLSearchParams(globalThis.location?.search ?? "");
  if (params.get("cofre")) Object.assign(s, { existe: true, modo: params.get("cofre"), senha: "gato azul na janela", pin: "2468" });
  if (params.get("aberto")) s.aberto = true;
  return {
    situacao: async () => ({ existe: s.existe, modo: s.modo, tentativasRestantes: 5 - s.erradas, aberto: s.aberto }),
    criarCofre: async (senha, modo, pin) => {
      await espera();
      Object.assign(s, { existe: true, modo, senha, pin: pin ?? "", aberto: true });
      return PALAVRAS;
    },
    abrirComSenha: async (senha) => {
      await espera();
      if (senha !== s.senha) return falha("senha_errada", "A senha não confere.");
      s.erradas = 0;
      s.aberto = true;
    },
    abrirComPin: async (pin) => {
      await espera();
      if (s.erradas >= 5) return falha("pin_bloqueado", "Muitas tentativas com o PIN. Use a senha para abrir.");
      if (pin !== s.pin) {
        s.erradas++;
        return s.erradas >= 5
          ? falha("pin_bloqueado", "Muitas tentativas com o PIN. Use a senha para abrir.")
          : falha("pin_errado", "O PIN não confere.", 5 - s.erradas);
      }
      s.erradas = 0;
      s.aberto = true;
    },
    abrirDireto: async () => {
      s.aberto = true;
    },
    helloDisponivel: async () => params.get("hello") === "1",
    abrirComHello: async () => {
      await espera();
      s.aberto = true;
    },
    conferirPalavras: conferir,
    recuperar: async (texto, novaSenha) => {
      await conferir(texto);
      Object.assign(s, { senha: novaSenha, erradas: 0, aberto: true });
    },
    lerArquivoRecuperacao: async () => PALAVRAS.join(" "),
    gravarArquivoRecuperacao: async () => {},
    verPalavras: async (senha) => {
      await espera();
      if (senha !== s.senha) return falha("senha_errada", "A senha não confere.");
      return PALAVRAS;
    },
    trocarSenha: async (atual, nova) => {
      await espera();
      if (atual !== s.senha) return falha("senha_errada", "A senha não confere.");
      s.senha = nova;
    },
    mudarModo: async (senha, modo, pin) => {
      await espera();
      if (senha !== s.senha) return falha("senha_errada", "A senha não confere.");
      Object.assign(s, { modo, pin: pin ?? "" });
    },
    bloquear: async () => {
      s.aberto = false;
    },
    ...simularItens(),
    fazerBackup: async () => {
      await espera();
    },
    infoBackup: async () => ({ criadoEm: Date.now() - 86_400_000, versaoApp: "0.5.0" }),
    restaurarBackup: async (_c, { senha, palavras }) => {
      if (palavras) await conferir(palavras);
      else if (senha !== "gato azul na janela") return falha("senha_errada", "A senha não confere.");
      Object.assign(s, { existe: true, modo: "senha", senha: "gato azul na janela", aberto: true });
      return "senha";
    },
    situacaoBackup: async () => ({ ...backup }),
    definirBackupAutomatico: async (pasta) => {
      await espera();
      Object.assign(backup, { pasta, ultimo: pasta ? Date.now() : backup.ultimo, erro: null });
      return { ...backup };
    },
  };
}

export const noApp = isTauri();
export const api: Api = noApp ? nativa : criarSimulacao();

/** Pergunta onde salvar o arquivo de recuperação e grava. Devolve false se a pessoa cancelar. */
export async function salvarArquivoRecuperacao(): Promise<boolean> {
  if (!noApp) return true;
  const caminho = await save({
    defaultPath: "orbita-chave-de-recuperacao.txt",
    filters: [{ name: "Texto", extensions: ["txt"] }],
  });
  if (!caminho) return false;
  await api.gravarArquivoRecuperacao(caminho);
  return true;
}

/** Pede para escolher o arquivo de recuperação e devolve as palavras lidas. */
export async function escolherArquivoRecuperacao(): Promise<string | null> {
  if (!noApp) return api.lerArquivoRecuperacao("");
  const caminho = await open({ multiple: false, directory: false, filters: [{ name: "Texto", extensions: ["txt"] }] });
  if (!caminho || Array.isArray(caminho)) return null;
  return api.lerArquivoRecuperacao(caminho);
}

const hoje = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD

/** Pergunta onde salvar um backup. Devolve null se a pessoa cancelar. */
export async function escolherOndeSalvarBackup(): Promise<string | null> {
  if (!noApp) return "simulacao.orbita-backup";
  return save({
    defaultPath: `orbita-backup-${hoje()}.orbita-backup`,
    filters: [{ name: "Backup do Órbita", extensions: ["orbita-backup"] }],
  });
}

export async function escolherBackup(): Promise<string | null> {
  if (!noApp) return "simulacao.orbita-backup";
  const caminho = await open({ multiple: false, directory: false, filters: [{ name: "Backup do Órbita", extensions: ["orbita-backup"] }] });
  return typeof caminho === "string" ? caminho : null;
}

export async function escolherPasta(): Promise<string | null> {
  if (!noApp) return "C:\\Users\\Dan\\Google Drive\\Órbita";
  const caminho = await open({ multiple: false, directory: true });
  return typeof caminho === "string" ? caminho : null;
}
