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

export interface Nota {
  id: string;
  texto: string;
  criadoEm: number;
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
  | "arquivo"
  | "interno";

export class ErroOrbita extends Error {
  constructor(
    public codigo: CodigoErro,
    mensagem: string,
    public tentativasRestantes?: number,
    public posicoes?: number[],
  ) {
    super(mensagem);
  }
}

function comoErro(e: unknown): ErroOrbita {
  if (e instanceof ErroOrbita) return e;
  if (typeof e === "object" && e && "codigo" in e) {
    const x = e as { codigo: CodigoErro; mensagem: string; tentativasRestantes?: number; posicoes?: number[] };
    return new ErroOrbita(x.codigo, x.mensagem, x.tentativasRestantes, x.posicoes);
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
  listarNotas(): Promise<Nota[]>;
  criarNota(texto: string): Promise<Nota>;
  excluirNota(id: string): Promise<void>;
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
  listarNotas: () => chamar("listar_notas"),
  criarNota: (texto) => chamar("criar_nota", { texto }),
  excluirNota: (id) => chamar("excluir_nota", { id }),
  fazerBackup: (caminho) => chamar("fazer_backup", { caminho }),
  infoBackup: (caminho) => chamar("info_backup", { caminho }),
  restaurarBackup: (caminho, { senha, palavras }) =>
    chamar("restaurar_backup", { caminho, senha: senha ?? null, palavras: palavras ?? null }),
  situacaoBackup: () => chamar("situacao_backup"),
  definirBackupAutomatico: (pasta) => chamar("definir_backup_automatico", { pasta }),
};

/** Simulação para ver as telas no navegador. Nada aqui é seguro nem guardado. */
function criarSimulacao(): Api {
  const PALAVRAS = ["janela", "cometa", "farol", "bambu", "orvalho", "tijolo"];
  const s = { existe: false, modo: null as ModoAbrir | null, senha: "", pin: "", erradas: 0, aberto: false };
  const notas: Nota[] = [];
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
    listarNotas: async () => [...notas],
    criarNota: async (texto) => {
      const nota = { id: crypto.randomUUID(), texto: texto.trim(), criadoEm: Date.now() };
      notas.unshift(nota);
      return nota;
    },
    excluirNota: async (id) => {
      const i = notas.findIndex((n) => n.id === id);
      if (i >= 0) notas.splice(i, 1);
    },
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
