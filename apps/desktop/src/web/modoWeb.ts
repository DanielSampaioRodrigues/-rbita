// Versão de navegador (iPad) de verdade: roda o MESMO motor do Windows (o banco
// em Rust, compilado para WebAssembly; ver docs/decisoes/0011-motor-unico.md) e
// guarda o banco inteiro, criptografado, no próprio aparelho (cofreWeb).
// O que depende do sistema (cofre, backup, ditado, arquivos) tem versão
// própria aqui, ou um aviso claro de que ainda não existe no navegador. A IA
// usa o motor para montar e conferir e envia o pedido com fetch (iaWeb.ts).

import type { Anexo, Api, Chamar, Confirmacao, ErroOrbita as TipoErro, InfoBackup, ModoAbrir, SituacaoBackup } from "../api";
import { carregarMotor, type Motor } from "./motor";
import { rodarIa } from "./iaWeb";
import { QUANTIDADE, reconhecer, separar, textoDaChave, LISTA } from "../palavras";
import {
  abrirAparelho,
  abrirEnvelope,
  aleatorio,
  chaveDosDados,
  deBase64,
  destrancar,
  destrancarTexto,
  envelopar,
  gravar,
  ler,
  paraBase64,
  pedirArmazenamentoPersistente,
  rotuloDados,
  trancar,
  trancarAparelho,
  trancarTexto,
  type ArquivoCofreWeb,
  type Envelope,
  type Portateis,
  type Trancado,
} from "./cofreWeb";

type ClasseErro = new (codigo: TipoErro["codigo"], mensagem: string, tentativasRestantes?: number, posicoes?: number[], limite?: number, motivo?: string) => TipoErro;

export interface DependenciasWeb {
  ErroOrbita: ClasseErro;
  /** Converte o erro que o motor devolve (o mesmo objeto do Windows) em ErroOrbita. */
  comoErro: (e: unknown) => TipoErro;
}

const TENTATIVAS_DE_PIN = 5;
const MAXIMO_ARQUIVO = 25 * 1024 * 1024;
const FORMATO_BACKUP = "orbita-backup-web";

// ── Arquivos escolhidos pela pessoa (o navegador não tem "caminho") ────────────

const escolhidos = new Map<string, File>();

/** Abre o seletor de arquivos e devolve uma referência ("web-arquivo:<id>/<nome>") ou null. */
export function escolherArquivoWeb(aceitar = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (aceitar) input.accept = aceitar;
    let resolvido = false;
    const fim = (v: string | null) => {
      if (resolvido) return;
      resolvido = true;
      window.removeEventListener("focus", aoVoltar);
      resolve(v);
    };
    input.addEventListener("change", () => {
      const f = input.files?.[0];
      if (!f) return fim(null);
      // O nome do arquivo vai no fim da referência: as telas mostram só o que
      // vem depois da última barra (como num caminho do Windows).
      const ref = `web-arquivo:${crypto.randomUUID()}/${f.name}`;
      escolhidos.set(ref, f);
      fim(ref);
    });
    input.addEventListener("cancel", () => fim(null));
    // Alguns navegadores não avisam quando a pessoa cancela: ao voltar o foco
    // para a página sem arquivo escolhido, conta como cancelado.
    const aoVoltar = () => setTimeout(() => !input.files?.length && fim(null), 1500);
    window.addEventListener("focus", aoVoltar);
    input.click();
  });
}

/** Baixa um arquivo (no iPad, o Safari pergunta onde guardar). */
export function baixar(nome: string, conteudo: Blob): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(conteudo);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

const nomeDe = (caminho: string, padrao: string) => caminho.split(/[\\/]/).pop() || padrao;
const hoje = () => new Date().toLocaleDateString("sv-SE");

const MIMES: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", webm: "audio/webm", txt: "text/plain",
};
const mimeDe = (nome: string) => MIMES[nome.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

async function base64DoArquivo(f: File): Promise<string> {
  return paraBase64(new Uint8Array(await f.arrayBuffer()));
}

// ── Backup em arquivo ──────────────────────────────────────────────────────────
// O backup novo é o mesmo arquivo do Windows (`.orbita-backup` versão 2, começa com
// "ORBITABK"; formato em src-tauri/src/portatil.rs), montado e aberto pelo motor.
// O JSON "orbita-backup-web" versão 2 (até a 0.45) continua abrindo aqui.

interface EnvelopeTexto { sal: string; iv: string; cifra: string; iteracoes: number }
interface TrancadoTexto { iv: string; cifra: string }
interface ArquivoBackupWeb {
  formato: typeof FORMATO_BACKUP;
  /** 1 = retrato da simulação (até a 0.45, não abre mais); 2 = o banco do motor, em bytes. */
  versao: 1 | 2;
  criadoEm: number;
  versaoApp: string;
  id: string;
  senha?: EnvelopeTexto;
  recuperacao: EnvelopeTexto;
  palavras: TrancadoTexto;
  dados: TrancadoTexto;
}
const envBytes = (e: EnvelopeTexto): Envelope => ({ sal: deBase64(e.sal), iv: deBase64(e.iv), cifra: deBase64(e.cifra), iteracoes: e.iteracoes });
const trBytes = (t: TrancadoTexto): Trancado => ({ iv: deBase64(t.iv), cifra: deBase64(t.cifra) });

const MAGICA = "ORBITABK";
const ehPortatil = (b: Uint8Array) => b.length >= 8 && [...MAGICA].every((ch, i) => b[i] === ch.charCodeAt(0));
type BackupLido = { tipo: "portatil"; bytes: Uint8Array } | { tipo: "web"; a: ArquivoBackupWeb };

// ── O modo web em si ───────────────────────────────────────────────────────────

export function modoWeb(criarBase: (chamar: Chamar) => Api, { ErroOrbita: E, comoErro }: DependenciasWeb): Api {
  const motor = carregarMotor();

  let cofre: ArquivoCofreWeb | null | undefined;
  let bruta: Uint8Array | null = null;
  let chave: CryptoKey | null = null;

  const lerCofre = async () => {
    if (cofre === undefined) cofre = (await ler<ArquivoCofreWeb>("cofre")) ?? null;
    return cofre;
  };
  const exigirCofre = async () => {
    const c = await lerCofre();
    if (!c) throw new E("cofre_ausente", "Ainda não há dados protegidos neste aparelho.");
    return c;
  };
  const gravarCofre = async (c: ArquivoCofreWeb) => {
    cofre = c;
    await gravar("cofre", c);
  };

  // Guardar: o banco inteiro em bytes, trancado com a chave dos dados. (A chave
  // antiga "dados", da simulação, até a 0.45, é ignorada: eram dados de teste.)
  let aberto = false;
  let pendente: ReturnType<typeof setTimeout> | null = null;
  let fila: Promise<void> = Promise.resolve();
  const salvarAgora = (): Promise<void> => {
    if (pendente) clearTimeout(pendente);
    pendente = null;
    const k = chave;
    const id = cofre?.id;
    if (!k || !id || !aberto) return fila;
    fila = fila
      .then(async () => {
        const m = await motor;
        if (!aberto) return;
        await gravar("banco", await trancar(k, m.exportar(), rotuloDados(id)));
      })
      .catch((e) => console.error("Órbita: não consegui guardar os dados", e));
    return fila;
  };
  const agendarSalvar = () => {
    if (!chave) return;
    if (pendente) clearTimeout(pendente);
    pendente = setTimeout(() => void salvarAgora(), 600);
  };
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && void salvarAgora());
  window.addEventListener("pagehide", () => void salvarAgora());

  const abrirDados = async (bytes: Uint8Array | null) => {
    const m = await motor;
    if (bytes) m.abrir_de_bytes(bytes);
    else m.abrir_vazio();
    aberto = true;
  };
  const fecharDados = async () => {
    aberto = false;
    (await motor).fechar();
  };

  const entrar = async (dek: Uint8Array, c: ArquivoCofreWeb) => {
    const k = await chaveDosDados(dek);
    const t = await ler<Trancado>("banco");
    let bytes: Uint8Array | null = null;
    if (t) {
      bytes = await destrancar(k, t, rotuloDados(c.id));
      if (bytes === null) throw new E("interno", "Os dados guardados neste aparelho não abriram com esta chave.");
    }
    await abrirDados(bytes);
    bruta = dek;
    chave = k;
    pedirArmazenamentoPersistente();
  };

  // Os comandos vão para o motor, com o mesmo nome e argumentos do Windows.
  const lerErro = (e: unknown) => {
    if (typeof e !== "string") return e;
    try {
      return JSON.parse(e) as unknown;
    } catch {
      return e;
    }
  };
  let ordensDeIa: Set<string> | null = null;
  const chamar: Chamar = async <T>(comando: string, args?: Record<string, unknown>): Promise<T> => {
    const m = await motor;
    // IA: o motor monta o pedido e confere a resposta; o envio é pelo navegador.
    ordensDeIa ??= new Set(m.ia_comandos());
    if (ordensDeIa.has(comando)) {
      try {
        return await rodarIa<T>(m, comando, args);
      } catch (e) {
        throw comoErro(lerErro(e));
      }
    }
    let saida: string;
    try {
      saida = m.executar(comando, JSON.stringify(args ?? {}));
    } catch (e) {
      throw comoErro(lerErro(e));
    }
    const { r, mudou } = JSON.parse(saida) as { r: T; mudou: boolean };
    if (mudou) agendarSalvar();
    return r;
  };
  const base = criarBase(chamar);

  /** Chama uma função do motor fora da ponte de comandos, convertendo o erro dele. */
  const doMotor = async <T>(f: (m: Motor) => T): Promise<T> => {
    const m = await motor;
    try {
      return f(m);
    } catch (e) {
      throw comoErro(lerErro(e));
    }
  };

  // Anexos: o navegador não tem "buscar um anexo pelo id"; lembra os que as telas listam.
  const anexosVistos = new Map<string, Anexo>();
  const lembrar = (a: Anexo) => (anexosVistos.set(a.id, a), a);

  // Regras iguais às do cofre nativo.
  const validarSenha = (s: string) => {
    if ([...s.trim()].length < 12) throw new E("senha_curta", "A senha precisa ter pelo menos 12 caracteres.");
  };
  const validarPin = (p?: string) => {
    if (!/^\d{4,8}$/.test(p ?? "")) throw new E("pin_invalido", "O PIN precisa ter de 4 a 8 números.");
  };
  const normal = (s: string) => s.normalize("NFC");
  const sortear = () => {
    const n = crypto.getRandomValues(new Uint32Array(QUANTIDADE));
    return [...n].map((x) => LISTA[x % LISTA.length]);
  };
  const lerPalavras = (texto: string) => {
    const partes = separar(texto);
    const rec = Array.from({ length: QUANTIDADE }, (_, i) => (partes[i] ? reconhecer(partes[i]) : null));
    const erradas = rec.flatMap((p, i) => (p ? [] : [i + 1]));
    for (let i = QUANTIDADE; i < partes.length; i++) erradas.push(i + 1);
    if (erradas.length) throw new E("palavras_erradas", "Algumas palavras da chave de recuperação não foram reconhecidas.", undefined, erradas);
    return rec.join(" ");
  };
  const semAparelho = () => new E("aparelho_sem_chave", "Este aparelho não guardou a chave para abrir sem senha. Use a chave de recuperação (ou a senha, se você criou uma).");
  const semHello = () => new E("hello_indisponivel", "O Windows Hello não existe no navegador. Use a chave de recuperação (ou a senha, se você criou uma).");

  const porPalavras = async (texto: string, rec: Envelope) => {
    const dek = await abrirEnvelope(lerPalavras(texto), rec, "recuperacao");
    if (!dek) throw new E("chave_errada", "A chave de recuperação não abre estes dados.");
    return dek;
  };
  const porSenha = async (senha: string, env: Envelope | undefined) => {
    if (!env) throw new E("sem_senha", "Estes dados não têm senha. Use as 6 palavras da chave de recuperação.");
    const dek = await abrirEnvelope(normal(senha), env, "senha");
    if (!dek) throw new E("senha_errada", "A senha não confere.");
    return dek;
  };
  // ── Envelopes portáteis (os do backup, iguais aos do Windows; Argon2id no motor) ──
  const envelopesJson = (c: ArquivoCofreWeb, p: Portateis = c.portateis ?? {}) => JSON.stringify({ id: c.id, ...p });
  const portatilSenha = (dek: Uint8Array, senha: string, id: string) => doMotor((m) => JSON.parse(m.portatil_envelope_senha(dek, senha, id)) as Record<string, unknown>);
  const portatilPalavras = (dek: Uint8Array, palavras: string, id: string) => doMotor((m) => JSON.parse(m.portatil_envelope_palavras(dek, palavras, id)) as Record<string, unknown>);
  const temSenha = (c: ArquivoCofreWeb | null | undefined) => !!(c?.senha || c?.portateis?.senha);
  const semSenha = () => new E("sem_senha", "Estes dados não têm senha. Use as 6 palavras da chave de recuperação.");

  /** A chave dos dados pela senha: envelope do dia a dia (PBKDF2) ou, se ele ainda não existe, o portátil. */
  const dekPorSenha = async (c: ArquivoCofreWeb, senha: string) => {
    if (c.senha || !c.portateis?.senha || !c.portateis.recuperacao) return porSenha(senha, c.senha);
    return doMotor((m) => m.portatil_abrir(envelopesJson(c), senha, null));
  };
  const dekPorPalavras = async (c: ArquivoCofreWeb, texto: string) => {
    if (c.recuperacao || !c.portateis?.recuperacao) {
      if (!c.recuperacao) throw new E("chave_errada", "A chave de recuperação não abre estes dados.");
      return porPalavras(texto, c.recuperacao);
    }
    return doMotor((m) => m.portatil_abrir(envelopesJson(c), null, texto));
  };

  /** As 6 palavras abertas: do cofre ou, se não estiverem lá, de dentro do banco (como no Windows). */
  const palavrasDoCofre = async (c: ArquivoCofreWeb, dek: Uint8Array): Promise<string | null> => {
    if (c.palavras) return destrancarTexto(await chaveDosDados(dek), c.palavras, `palavras:${c.id}`);
    if (!aberto) return null;
    const noBanco = await doMotor((m) => m.palavras_no_banco());
    try {
      return noBanco ? lerPalavras(noBanco) : null;
    } catch {
      return null;
    }
  };

  /** Completa o que falta no cofre depois de abrir: os envelopes do dia a dia (se o cofre veio
   *  de um backup), os portáteis (cofres de antes da 0.46) e as palavras dentro do banco. */
  const completarCofre = async (dek: Uint8Array, digitado: { senha?: string; palavras?: string }) => {
    const c = await exigirCofre();
    const novo: ArquivoCofreWeb = { ...c, portateis: { ...(c.portateis ?? {}) } };
    let mudou = false;
    const k = await chaveDosDados(dek);
    if (digitado.senha !== undefined && !novo.senha && novo.portateis?.senha) {
      novo.senha = await envelopar(normal(digitado.senha), dek, "senha");
      mudou = true;
    }
    if (digitado.palavras !== undefined && !novo.palavras) {
      const lidas = lerPalavras(digitado.palavras);
      novo.recuperacao = await envelopar(lidas, dek, "recuperacao");
      novo.palavras = await trancarTexto(k, lidas, `palavras:${c.id}`);
      mudou = true;
    }
    const palavras = await palavrasDoCofre(novo, dek);
    if (!novo.portateis!.recuperacao && palavras) {
      novo.portateis!.recuperacao = await portatilPalavras(dek, palavras, c.id);
      mudou = true;
    }
    if (digitado.senha !== undefined && !novo.portateis!.senha) {
      novo.portateis!.senha = await portatilSenha(dek, digitado.senha, c.id);
      mudou = true;
    }
    if (mudou) await gravarCofre(novo);
    if (palavras && aberto && (await doMotor((m) => m.guardar_palavras_no_banco(palavras)))) agendarSalvar();
    return novo;
  };

  const zerarTentativas = async (c: ArquivoCofreWeb) => {
    if (c.aparelho && c.aparelho.erradas) await gravarCofre({ ...c, aparelho: { ...c.aparelho, erradas: 0 } });
  };

  const confirmar = async (conf: Confirmacao) => {
    const c = await exigirCofre();
    if (conf.tipo === "senha") await dekPorSenha(c, conf.valor);
    else if (conf.tipo === "palavras") await dekPorPalavras(c, conf.valor);
    else if (conf.tipo === "pin") {
      if (!c.aparelho?.pin) throw semAparelho();
      const r = await abrirAparelho(c.aparelho, conf.valor);
      if (r === "sem-chave") throw semAparelho();
      if (!r) throw new E("pin_errado", "O PIN não confere.");
    } else if (c.modo !== "direto") throw semAparelho();
  };
  const palavrasAbertas = async () => {
    const c = await exigirCofre();
    if (!chave || !bruta) throw new E("bloqueado", "O Órbita está bloqueado.");
    const s = await palavrasDoCofre(c, bruta);
    if (!s) throw new E("interno", "Não consegui ler a chave de recuperação.");
    return s.split(" ");
  };

  let ultimoBackup: number | null = (() => {
    try {
      return Number(localStorage.getItem("orbita-ultimo-backup")) || null;
    } catch {
      return null;
    }
  })();

  const naoEBackup = () => new E("backup_invalido", "Não deu para usar este backup: este arquivo não é um backup do Órbita.");
  const lerBackup = async (caminho: string): Promise<BackupLido> => {
    const f = escolhidos.get(caminho);
    if (!f) throw new E("backup_invalido", "Não deu para usar este backup: não encontrei o arquivo escolhido.");
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (ehPortatil(bytes)) return { tipo: "portatil", bytes };
    let a: ArquivoBackupWeb;
    try {
      a = JSON.parse(new TextDecoder().decode(bytes)) as ArquivoBackupWeb;
    } catch {
      throw naoEBackup();
    }
    if (a?.formato !== FORMATO_BACKUP) throw naoEBackup();
    if (a.versao !== 2) throw new E("backup_invalido", "Não deu para usar este backup: ele é de uma versão de navegador anterior à 0.46, de antes da troca de motor, e não abre mais. Backups novos abrem normalmente.");
    return { tipo: "web", a };
  };

  const nuvemIndisponivel = () => Promise.reject(new E("nuvem", "Guardar na conta ainda não existe na versão de navegador. Vem junto com o login do Google.", undefined, undefined, undefined, "indisponivel"));
  const ditadoIndisponivel = () => Promise.reject(new E("ditado", "O ditado do computador não existe na versão de navegador. No iPad, use o microfone do teclado."));

  const blobDoAnexo = async (id: string, nome: string) => {
    const b64 = await base.bytesAnexo(id);
    if (!b64) throw new E("arquivo", "Não foi possível ler ou gravar um arquivo: este anexo não tem conteúdo guardado.");
    return new Blob([deBase64(b64) as unknown as BlobPart], { type: mimeDe(nome) });
  };
  const anexoVisto = (id: string) => {
    const a = anexosVistos.get(id);
    if (!a) throw new E("arquivo", "Não foi possível abrir este anexo agora. Feche e abra a tela de novo.");
    return a;
  };

  const sobre: Partial<Api> = {
    // ── Cofre ──
    situacao: async () => {
      const c = await lerCofre();
      return { existe: !!c, modo: c?.modo ?? null, tentativasRestantes: TENTATIVAS_DE_PIN - (c?.aparelho?.erradas ?? 0), aberto: !!chave, temSenha: temSenha(c) };
    },
    criarCofre: async (senha, modo, pin) => {
      if (await lerCofre()) throw new E("cofre_existe", "Já existem dados protegidos neste aparelho.");
      if (modo === "hello") throw semHello();
      if (senha !== null) validarSenha(senha);
      else if (modo === "senha") throw new E("sem_senha", "Estes dados não têm senha. Use as 6 palavras da chave de recuperação.");
      if (modo === "pin") validarPin(pin);
      const dek = aleatorio(32);
      const palavras = sortear();
      const id = crypto.randomUUID();
      const k = await chaveDosDados(dek);
      const c: ArquivoCofreWeb = {
        versao: 1,
        id,
        modo,
        recuperacao: await envelopar(palavras.join(" "), dek, "recuperacao"),
        palavras: await trancarTexto(k, palavras.join(" "), `palavras:${id}`),
        ...(senha !== null ? { senha: await envelopar(normal(senha), dek, "senha") } : {}),
        ...(modo === "pin" || modo === "direto" ? { aparelho: await trancarAparelho(dek, modo === "pin" ? pin! : null) } : {}),
        portateis: {
          recuperacao: await portatilPalavras(dek, palavras.join(" "), id),
          ...(senha !== null ? { senha: await portatilSenha(dek, senha, id) } : {}),
        },
      };
      await gravarCofre(c);
      await abrirDados(null);
      await doMotor((m) => m.guardar_palavras_no_banco(palavras.join(" ")));
      bruta = dek;
      chave = k;
      await salvarAgora();
      pedirArmazenamentoPersistente();
      return palavras;
    },
    abrirComSenha: async (senha) => {
      const c = await exigirCofre();
      const dek = await dekPorSenha(c, senha);
      await zerarTentativas(c);
      await entrar(dek, c);
      await completarCofre(dek, { senha });
    },
    abrirComPalavras: async (texto) => {
      const c = await exigirCofre();
      const dek = await dekPorPalavras(c, texto);
      await zerarTentativas(c);
      await entrar(dek, c);
      await completarCofre(dek, { palavras: texto });
    },
    abrirComPin: async (pin) => {
      const c = await exigirCofre();
      if (!c.aparelho?.pin) throw semAparelho();
      const bloqueado = () => new E("pin_bloqueado", "Muitas tentativas com o PIN. Use a chave de recuperação (ou a senha, se você criou uma) para abrir.");
      if (c.aparelho.erradas >= TENTATIVAS_DE_PIN) throw bloqueado();
      const r = await abrirAparelho(c.aparelho, pin);
      if (r === "sem-chave") throw semAparelho();
      if (!r) {
        const erradas = c.aparelho.erradas + 1;
        await gravarCofre({ ...c, aparelho: { ...c.aparelho, erradas } });
        if (erradas >= TENTATIVAS_DE_PIN) throw bloqueado();
        throw new E("pin_errado", "O PIN não confere.", TENTATIVAS_DE_PIN - erradas);
      }
      await zerarTentativas(c);
      await entrar(r, c);
      await completarCofre(r, {});
    },
    abrirDireto: async () => {
      const c = await exigirCofre();
      if (!c.aparelho || c.aparelho.pin) throw semAparelho();
      const r = await abrirAparelho(c.aparelho, null);
      if (!r || r === "sem-chave") throw semAparelho();
      await entrar(r, c);
    },
    helloDisponivel: async () => false,
    abrirComHello: async () => {
      throw semHello();
    },
    conferirPalavras: async (texto) => {
      const c = await exigirCofre();
      await dekPorPalavras(c, texto);
    },
    recuperar: async (texto, novaSenha) => {
      validarSenha(novaSenha);
      const c = await exigirCofre();
      const dek = await dekPorPalavras(c, texto);
      const novo: ArquivoCofreWeb = {
        ...c,
        senha: await envelopar(normal(novaSenha), dek, "senha"),
        portateis: { ...(c.portateis ?? {}), senha: await portatilSenha(dek, novaSenha, c.id) },
        ...(c.aparelho ? { aparelho: { ...c.aparelho, erradas: 0 } } : {}),
      };
      await gravarCofre(novo);
      await entrar(dek, novo);
      await completarCofre(dek, { palavras: texto });
    },
    lerArquivoRecuperacao: async (caminho) => {
      const f = escolhidos.get(caminho);
      if (!f) throw new E("arquivo", "Não foi possível ler ou gravar um arquivo: não encontrei o arquivo escolhido.");
      const t = await f.text();
      // Igual ao nativo: usa só as linhas numeradas ("1. abacate"), se houver.
      const numeradas = t.split(/\r?\n/).filter((l) => /^\s*\d+[.)]\s*\S/.test(l)).map((l) => l.replace(/^\s*\d+[.)]\s*/, ""));
      return (numeradas.length ? numeradas : [t]).join(" ");
    },
    gravarArquivoRecuperacao: async (caminho) => {
      baixar(nomeDe(caminho, "orbita-chave-de-recuperacao.txt"), new Blob([textoDaChave(await palavrasAbertas())], { type: "text/plain;charset=utf-8" }));
    },
    verPalavras: async (conf) => {
      await confirmar(conf);
      return palavrasAbertas();
    },
    definirSenha: async (conf, nova) => {
      await confirmar(conf);
      validarSenha(nova);
      if (!bruta) throw new E("bloqueado", "O Órbita está bloqueado.");
      const c = await exigirCofre();
      await gravarCofre({
        ...c,
        senha: await envelopar(normal(nova), bruta, "senha"),
        portateis: { ...(c.portateis ?? {}), senha: await portatilSenha(bruta, nova, c.id) },
      });
    },
    mudarModo: async (conf, modo, pin) => {
      await confirmar(conf);
      if (!bruta) throw new E("bloqueado", "O Órbita está bloqueado.");
      if (modo === "hello") throw semHello();
      const c = await exigirCofre();
      if (modo === "senha" && !temSenha(c)) throw semSenha();
      if (modo === "pin") validarPin(pin);
      const { aparelho: _antigo, ...resto } = c;
      const aparelho = modo === "pin" || modo === "direto" ? await trancarAparelho(bruta, modo === "pin" ? pin! : null) : undefined;
      await gravarCofre({ ...resto, modo, ...(aparelho ? { aparelho } : {}) });
    },
    bloquear: async () => {
      await salvarAgora();
      await fecharDados();
      chave = null;
      bruta = null;
    },

    // ── Backup e exportação (baixar arquivos) ──
    fazerBackup: async (caminho) => {
      await exigirCofre();
      if (!chave || !bruta) throw new E("bloqueado", "O Órbita está bloqueado.");
      const dek = bruta;
      const c = await completarCofre(dek, {});
      if (!c.portateis?.recuperacao) throw new E("interno", "Não consegui preparar a chave de recuperação para o backup.");
      // O mesmo arquivo do Windows: abre lá e aqui.
      const arquivo = await doMotor((m) => m.backup_montar(dek, envelopesJson(c), __VERSAO__));
      baixar(nomeDe(caminho, `orbita-backup-${hoje()}.orbita-backup`), new Blob([arquivo as unknown as BlobPart], { type: "application/octet-stream" }));
      ultimoBackup = Date.now();
      try {
        localStorage.setItem("orbita-ultimo-backup", String(ultimoBackup));
      } catch {
        /* ignora */
      }
    },
    exportarTexto: async (caminho, conteudo) => {
      baixar(nomeDe(caminho, "orbita-exportacao.txt"), new Blob([conteudo], { type: `${mimeDe(caminho)};charset=utf-8` }));
    },
    infoBackup: async (caminho): Promise<InfoBackup> => {
      const lido = await lerBackup(caminho);
      if (lido.tipo === "portatil") {
        const i = JSON.parse(await doMotor((m) => m.backup_info(lido.bytes))) as InfoBackup;
        return { criadoEm: i.criadoEm, versaoApp: i.versaoApp, temSenha: i.temSenha };
      }
      return { criadoEm: lido.a.criadoEm, versaoApp: lido.a.versaoApp, temSenha: !!lido.a.senha };
    },
    restaurarBackup: async (caminho, { senha, palavras }, escolha): Promise<ModoAbrir> => {
      const lido = await lerBackup(caminho);
      const conferirEscolha = (temSenhaNoBackup: boolean) => {
        if (!temSenhaNoBackup && (!escolha || escolha.modo === "senha")) throw semSenha();
        const modo = escolha?.modo ?? "senha";
        if (modo === "hello") throw semHello();
        if (modo === "pin") validarPin(escolha?.pin);
        return modo;
      };
      const aparelhoDe = async (modo: ModoAbrir, dek: Uint8Array) =>
        modo === "pin" || modo === "direto" ? { aparelho: await trancarAparelho(dek, modo === "pin" ? escolha!.pin! : null) } : {};

      let c: ArquivoCofreWeb;
      let dek: Uint8Array;
      let bytes: Uint8Array;
      let dados: Trancado;
      if (lido.tipo === "portatil") {
        // Backup do Windows ou do navegador (versão 2): o motor confere e abre.
        conferirEscolha(true); // a senha do backup só se sabe depois; o motor recusa "sem senha" abaixo
        const ab = await doMotor((m) => m.backup_abrir(lido.bytes, palavras ? null : (senha ?? ""), palavras ?? null));
        const envs = JSON.parse(ab.envelopes) as { id: string } & Portateis;
        const noBanco = ab.palavras;
        dek = ab.dek;
        bytes = ab.banco;
        ab.free();
        const modo = conferirEscolha(!!envs.senha);
        let lidas: string | null = null;
        try {
          lidas = palavras ? lerPalavras(palavras) : noBanco ? lerPalavras(noBanco) : null;
        } catch {
          lidas = null;
        }
        // A chave dos dados do backup passa a ser a deste aparelho: assim os envelopes do backup
        // (senha e 6 palavras) continuam valendo, e o próximo backup abre com os mesmos segredos.
        const k = await chaveDosDados(dek);
        const id = envs.id;
        c = {
          versao: 1,
          id,
          modo,
          ...(lidas ? { recuperacao: await envelopar(lidas, dek, "recuperacao"), palavras: await trancarTexto(k, lidas, `palavras:${id}`) } : {}),
          ...(!palavras && senha && envs.senha ? { senha: await envelopar(normal(senha), dek, "senha") } : {}),
          ...(await aparelhoDe(modo, dek)),
          portateis: { ...(envs.senha ? { senha: envs.senha } : {}), ...(envs.recuperacao ? { recuperacao: envs.recuperacao } : {}) },
        };
        dados = await trancar(k, bytes, rotuloDados(id));
      } else {
        // Backup antigo do navegador (JSON "orbita-backup-web" versão 2).
        const a = lido.a;
        const rec = envBytes(a.recuperacao);
        const envSenha = a.senha ? envBytes(a.senha) : undefined;
        dek = palavras ? await porPalavras(palavras, rec) : await porSenha(senha ?? "", envSenha);
        const modo = conferirEscolha(!!envSenha);
        const k = await chaveDosDados(dek);
        dados = trBytes(a.dados);
        const abertos = await destrancar(k, dados, rotuloDados(a.id));
        if (abertos === null) throw new E("backup_invalido", "Não deu para usar este backup: os dados dentro dele não abriram.");
        bytes = abertos;
        c = {
          versao: 1,
          id: a.id,
          modo,
          ...(envSenha ? { senha: envSenha } : {}),
          recuperacao: rec,
          palavras: trBytes(a.palavras),
          ...(await aparelhoDe(modo, dek)),
        };
      }
      // Antes de trocar: para de guardar o banco aberto (um salvamento atrasado
      // gravaria os dados antigos por cima do backup, trancados com a chave antiga)
      // e guarda uma cópia do que havia, como a "pasta de segurança" do Windows.
      if (pendente) clearTimeout(pendente);
      pendente = null;
      await fila;
      aberto = false;
      chave = null;
      bruta = null;
      const cofreAntes = await lerCofre();
      const bancoAntes = await ler<Trancado>("banco");
      if (cofreAntes && bancoAntes) await gravar(`antes-da-restauracao-${Date.now()}`, { cofre: cofreAntes, banco: bancoAntes });
      await gravarCofre(c);
      await gravar("banco", dados);
      await abrirDados(bytes);
      bruta = dek;
      chave = await chaveDosDados(dek);
      pedirArmazenamentoPersistente();
      // Envelopes portáteis que faltarem (backup antigo do navegador) e as palavras dentro do banco.
      await completarCofre(dek, palavras ? { palavras } : { senha: senha ?? undefined });
      return c.modo;
    },
    situacaoBackup: async (): Promise<SituacaoBackup> => ({ pasta: null, ultimo: ultimoBackup, erro: null }),
    definirBackupAutomatico: async (pasta) => {
      if (pasta) throw new E("arquivo", "O backup automático numa pasta não existe na versão de navegador. Use “Fazer backup agora” de vez em quando.");
      return { pasta: null, ultimo: ultimoBackup, erro: null };
    },

    // ── Anexos: o conteúdo fica no banco do motor; aqui só entra e sai o arquivo ──
    listarAnexos: async (item) => (await base.listarAnexos(item)).map(lembrar),
    anexarLink: async (item, nome, endereco) => lembrar(await base.anexarLink(item, nome, endereco)),
    anexarBytes: async (item, nome, b64) => lembrar(await base.anexarBytes(item, nome, b64)),
    anexarArquivo: async (item, caminho) => {
      const f = escolhidos.get(caminho);
      if (!f) throw new E("arquivo", "Não foi possível ler ou gravar um arquivo: não encontrei o arquivo escolhido.");
      if (f.size > MAXIMO_ARQUIVO) throw new E("arquivo", "Não foi possível ler ou gravar um arquivo: na versão de navegador, cada arquivo pode ter até 25 MB.");
      return lembrar(await base.anexarBytes(item, f.name, await base64DoArquivo(f)));
    },
    salvarAnexo: async (id, caminho) => {
      const a = anexoVisto(id);
      const nome = nomeDe(caminho, a.nome || "arquivo");
      baixar(nome, await blobDoAnexo(id, nome));
    },
    abrirAnexo: async (id) => {
      const a = anexoVisto(id);
      if (a.tipo === "link") {
        window.open(a.endereco, "_blank", "noopener");
        return;
      }
      window.open(URL.createObjectURL(await blobDoAnexo(id, a.nome)), "_blank", "noopener");
    },

    // ── O que ainda não existe no navegador ──
    // (A IA funciona: passa pelo `chamar` acima, como no Windows.)
    ditadoEstado: async () => ({ instalado: null, baixando: false, gravando: false }),
    ditadoBaixar: ditadoIndisponivel,
    ditadoComecar: ditadoIndisponivel,
    ouvirProgressoDitado: async () => () => undefined,
    ditadoCancelarDownload: async () => undefined,
    ditadoRemover: async () => ({ instalado: null, baixando: false, gravando: false }),
    ditadoParar: ditadoIndisponivel,
    ditadoDescartar: async () => undefined,
    // A memória serve para recomendar o modelo do Ollama no computador; o navegador não sabe dizer.
    memoriaDoComputador: async () => null,
    // Bandeja do Windows: não existe no navegador.
    bandejaLigada: async () => false,
    definirBandeja: async () => undefined,
    // Arquivo escolhido pela pessoa (o navegador não tem "caminho").
    bytesArquivo: async (caminho) => {
      const f = escolhidos.get(caminho);
      if (!f) throw new E("arquivo", "Não foi possível ler ou gravar um arquivo: não encontrei o arquivo escolhido.");
      if (f.size > MAXIMO_ARQUIVO) throw new E("arquivo", "Não foi possível ler ou gravar um arquivo: na versão de navegador, cada arquivo pode ter até 25 MB.");
      return base64DoArquivo(f);
    },
    // Conta Google no navegador: chega com o login (etapa 2 da sincronização).
    nuvemDisponivel: async () => ({ google: false, microsoft: false }),
    nuvemSituacao: async () => null,
    nuvemEnviar: async () => null,
    nuvemConectar: nuvemIndisponivel,
    nuvemDesconectar: async () => undefined,
    nuvemBuscarParaRecuperar: nuvemIndisponivel,
    nuvemConcluirRecuperacao: nuvemIndisponivel,
  };

  return { ...base, ...sobre } as Api;
}
