// Versão de navegador (iPad) de verdade: usa a mesma lógica da simulação para
// as telas, mas guarda tudo, criptografado, no próprio aparelho (cofreWeb).
// Também troca o que na simulação é "de mentira" (IA, ditado, backup, arquivos)
// por versões reais ou por um aviso claro de que ainda não existe no navegador.

import type { Anexo, Api, Confirmacao, ErroOrbita as TipoErro, Guardavel, InfoBackup, ModoAbrir, SituacaoBackup } from "../api";
import { QUANTIDADE, reconhecer, separar, textoDaChave, LISTA } from "../palavras";
import {
  abrirAparelho,
  abrirEnvelope,
  aleatorio,
  chaveDosDados,
  deBase64,
  destrancarTexto,
  envelopar,
  gravar,
  ler,
  paraBase64,
  pedirArmazenamentoPersistente,
  rotuloDados,
  trancarAparelho,
  trancarTexto,
  type ArquivoCofreWeb,
  type Envelope,
  type Trancado,
} from "./cofreWeb";

type ClasseErro = new (codigo: TipoErro["codigo"], mensagem: string, tentativasRestantes?: number, posicoes?: number[], limite?: number, motivo?: string) => TipoErro;

export interface DependenciasWeb {
  ErroOrbita: ClasseErro;
  guardaveis: Map<string, Guardavel>;
}

const TENTATIVAS_DE_PIN = 5;
const MAXIMO_ARQUIVO = 25 * 1024 * 1024;
const FORMATO_BACKUP = "orbita-backup-web";

// ── Arquivos escolhidos pela pessoa (o navegador não tem "caminho") ────────────

const escolhidos = new Map<string, File>();

/** Abre o seletor de arquivos e devolve uma referência ("web-arquivo:…") ou null. */
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
      const ref = `web-arquivo:${crypto.randomUUID()}`;
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

// ── Backup em arquivo (só entre versões de navegador, por enquanto) ────────────

interface EnvelopeTexto { sal: string; iv: string; cifra: string; iteracoes: number }
interface TrancadoTexto { iv: string; cifra: string }
interface ArquivoBackupWeb {
  formato: typeof FORMATO_BACKUP;
  versao: 1;
  criadoEm: number;
  versaoApp: string;
  id: string;
  senha?: EnvelopeTexto;
  recuperacao: EnvelopeTexto;
  palavras: TrancadoTexto;
  dados: TrancadoTexto;
}
const envTexto = (e: Envelope): EnvelopeTexto => ({ sal: paraBase64(e.sal), iv: paraBase64(e.iv), cifra: paraBase64(e.cifra), iteracoes: e.iteracoes });
const envBytes = (e: EnvelopeTexto): Envelope => ({ sal: deBase64(e.sal), iv: deBase64(e.iv), cifra: deBase64(e.cifra), iteracoes: e.iteracoes });
const trTexto = (t: Trancado): TrancadoTexto => ({ iv: paraBase64(t.iv), cifra: paraBase64(t.cifra) });
const trBytes = (t: TrancadoTexto): Trancado => ({ iv: deBase64(t.iv), cifra: deBase64(t.cifra) });

// ── O modo web em si ───────────────────────────────────────────────────────────

export function modoWeb(base: Api, { ErroOrbita: E, guardaveis }: DependenciasWeb): Api {
  // Arquivos e áudios anexados (as imagens já ficam no estado da simulação).
  const arquivos = new Map<string, string>();
  guardaveis.set("web.arquivos", {
    ler: () => [...arquivos],
    escrever: (v) => {
      arquivos.clear();
      for (const [k, x] of (v as [string, string][]) ?? []) arquivos.set(k, x);
    },
    zerar: () => arquivos.clear(),
  });

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

  // Guardar os dados: um retrato de todas as listas, trancado com a chave dos dados.
  let pendente: ReturnType<typeof setTimeout> | null = null;
  let fila: Promise<void> = Promise.resolve();
  const retrato = () => JSON.stringify({ versao: 1, estado: Object.fromEntries([...guardaveis].map(([k, g]) => [k, g.ler()])) });
  const salvarAgora = (): Promise<void> => {
    if (pendente) clearTimeout(pendente);
    pendente = null;
    const k = chave;
    const id = cofre?.id;
    if (!k || !id) return fila;
    const json = retrato();
    fila = fila
      .then(async () => gravar("dados", await trancarTexto(k, json, rotuloDados(id))))
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

  const restaurar = (json: string | null) => {
    let estado: Record<string, unknown> = {};
    if (json) {
      try {
        estado = (JSON.parse(json) as { estado?: Record<string, unknown> }).estado ?? {};
      } catch {
        estado = {};
      }
    }
    for (const [k, g] of guardaveis) (k in estado ? g.escrever(estado[k]) : g.zerar());
  };
  const zerarTudo = () => {
    for (const g of guardaveis.values()) g.zerar();
  };

  const entrar = async (dek: Uint8Array, c: ArquivoCofreWeb) => {
    const k = await chaveDosDados(dek);
    const t = await ler<Trancado>("dados");
    let json: string | null = null;
    if (t) {
      json = await destrancarTexto(k, t, rotuloDados(c.id));
      if (json === null) throw new E("interno", "Os dados guardados neste aparelho não abriram com esta chave.");
    }
    restaurar(json);
    bruta = dek;
    chave = k;
    pedirArmazenamentoPersistente();
  };

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
  const zerarTentativas = async (c: ArquivoCofreWeb) => {
    if (c.aparelho && c.aparelho.erradas) await gravarCofre({ ...c, aparelho: { ...c.aparelho, erradas: 0 } });
  };

  const confirmar = async (conf: Confirmacao) => {
    const c = await exigirCofre();
    if (conf.tipo === "senha") await porSenha(conf.valor, c.senha);
    else if (conf.tipo === "palavras") await porPalavras(conf.valor, c.recuperacao);
    else if (conf.tipo === "pin") {
      if (!c.aparelho?.pin) throw semAparelho();
      const r = await abrirAparelho(c.aparelho, conf.valor);
      if (r === "sem-chave") throw semAparelho();
      if (!r) throw new E("pin_errado", "O PIN não confere.");
    } else if (c.modo !== "direto") throw semAparelho();
  };
  const palavrasAbertas = async () => {
    const c = await exigirCofre();
    if (!chave) throw new E("bloqueado", "O Órbita está bloqueado.");
    const s = await destrancarTexto(chave, c.palavras, `palavras:${c.id}`);
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

  const lerBackup = async (caminho: string): Promise<ArquivoBackupWeb> => {
    const f = escolhidos.get(caminho);
    if (!f) throw new E("backup_invalido", "Não deu para usar este backup: não encontrei o arquivo escolhido.");
    let a: ArquivoBackupWeb;
    try {
      a = JSON.parse(await f.text()) as ArquivoBackupWeb;
    } catch {
      throw new E("backup_invalido", "Não deu para usar este backup: este arquivo não é um backup da versão de navegador do Órbita (os backups feitos no Windows ainda não abrem aqui).");
    }
    if (a?.formato !== FORMATO_BACKUP) throw new E("backup_invalido", "Não deu para usar este backup: este arquivo não é um backup da versão de navegador do Órbita (os backups feitos no Windows ainda não abrem aqui).");
    return a;
  };

  const iaIndisponivel = () => Promise.reject(new E("ia", "A IA ainda não funciona na versão de navegador (iPad). Por enquanto, use no Windows.", undefined, undefined, undefined, "sem_provedor"));
  const ditadoIndisponivel = () => Promise.reject(new E("ditado", "O ditado do computador não existe na versão de navegador. No iPad, use o microfone do teclado."));

  const anexarBytes: Api["anexarBytes"] = async (item, nome, b64) => {
    const a = await base.anexarBytes(item, nome, b64);
    if (a.tipo !== "imagem") arquivos.set(a.id, b64);
    return a;
  };
  const bytesAnexo: Api["bytesAnexo"] = async (id) => {
    const b = arquivos.get(id);
    if (b) return b;
    const url = await base.imagemAnexo(id).catch(() => null);
    return url ? url.slice(url.indexOf(",") + 1) : "";
  };
  const blobDoAnexo = async (id: string, nome: string) => {
    const b64 = await bytesAnexo(id);
    if (!b64) throw new E("arquivo", "Não foi possível ler ou gravar um arquivo: este anexo não tem conteúdo guardado.");
    return new Blob([deBase64(b64) as unknown as BlobPart], { type: mimeDe(nome) });
  };
  const nomeDoAnexo = async (id: string) => {
    const lista = (guardaveis.get("anexos.anexos")?.ler() as (Anexo & { item: string })[] | undefined) ?? [];
    return lista.find((x) => x.id === id) ?? null;
  };

  const sobre: Partial<Api> = {
    // ── Cofre ──
    situacao: async () => {
      const c = await lerCofre();
      return { existe: !!c, modo: c?.modo ?? null, tentativasRestantes: TENTATIVAS_DE_PIN - (c?.aparelho?.erradas ?? 0), aberto: !!chave, temSenha: !!c?.senha };
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
      };
      await gravarCofre(c);
      zerarTudo();
      bruta = dek;
      chave = k;
      await salvarAgora();
      pedirArmazenamentoPersistente();
      return palavras;
    },
    abrirComSenha: async (senha) => {
      const c = await exigirCofre();
      const dek = await porSenha(senha, c.senha);
      await zerarTentativas(c);
      await entrar(dek, c);
    },
    abrirComPalavras: async (texto) => {
      const c = await exigirCofre();
      const dek = await porPalavras(texto, c.recuperacao);
      await zerarTentativas(c);
      await entrar(dek, c);
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
      await porPalavras(texto, c.recuperacao);
    },
    recuperar: async (texto, novaSenha) => {
      validarSenha(novaSenha);
      const c = await exigirCofre();
      const dek = await porPalavras(texto, c.recuperacao);
      const novo: ArquivoCofreWeb = { ...c, senha: await envelopar(normal(novaSenha), dek, "senha"), ...(c.aparelho ? { aparelho: { ...c.aparelho, erradas: 0 } } : {}) };
      await gravarCofre(novo);
      await entrar(dek, novo);
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
      await gravarCofre({ ...c, senha: await envelopar(normal(nova), bruta, "senha") });
    },
    mudarModo: async (conf, modo, pin) => {
      await confirmar(conf);
      if (!bruta) throw new E("bloqueado", "O Órbita está bloqueado.");
      if (modo === "hello") throw semHello();
      const c = await exigirCofre();
      if (modo === "senha" && !c.senha) throw new E("sem_senha", "Estes dados não têm senha. Use as 6 palavras da chave de recuperação.");
      if (modo === "pin") validarPin(pin);
      const { aparelho: _antigo, ...resto } = c;
      const aparelho = modo === "pin" || modo === "direto" ? await trancarAparelho(bruta, modo === "pin" ? pin! : null) : undefined;
      await gravarCofre({ ...resto, modo, ...(aparelho ? { aparelho } : {}) });
    },
    bloquear: async () => {
      await salvarAgora();
      zerarTudo();
      chave = null;
      bruta = null;
    },

    // ── Backup e exportação (baixar arquivos) ──
    fazerBackup: async (caminho) => {
      const c = await exigirCofre();
      if (!chave) throw new E("bloqueado", "O Órbita está bloqueado.");
      await salvarAgora();
      const dados = await ler<Trancado>("dados");
      if (!dados) throw new E("interno", "Ainda não há dados guardados para o backup.");
      const arquivo: ArquivoBackupWeb = {
        formato: FORMATO_BACKUP,
        versao: 1,
        criadoEm: Date.now(),
        versaoApp: __VERSAO__,
        id: c.id,
        ...(c.senha ? { senha: envTexto(c.senha) } : {}),
        recuperacao: envTexto(c.recuperacao),
        palavras: trTexto(c.palavras),
        dados: trTexto(dados),
      };
      baixar(nomeDe(caminho, `orbita-backup-${hoje()}.orbita-backup`), new Blob([JSON.stringify(arquivo)], { type: "application/octet-stream" }));
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
      const a = await lerBackup(caminho);
      return { criadoEm: a.criadoEm, versaoApp: a.versaoApp, temSenha: !!a.senha };
    },
    restaurarBackup: async (caminho, { senha, palavras }, escolha): Promise<ModoAbrir> => {
      const a = await lerBackup(caminho);
      const rec = envBytes(a.recuperacao);
      const envSenha = a.senha ? envBytes(a.senha) : undefined;
      const dek = palavras ? await porPalavras(palavras, rec) : await porSenha(senha ?? "", envSenha);
      if (!envSenha && (!escolha || escolha.modo === "senha")) throw new E("sem_senha", "Estes dados não têm senha. Use as 6 palavras da chave de recuperação.");
      const modo = escolha?.modo ?? "senha";
      if (modo === "hello") throw semHello();
      if (modo === "pin") validarPin(escolha?.pin);
      const k = await chaveDosDados(dek);
      const dados = trBytes(a.dados);
      const json = await destrancarTexto(k, dados, rotuloDados(a.id));
      if (json === null) throw new E("backup_invalido", "Não deu para usar este backup: os dados dentro dele não abriram.");
      const c: ArquivoCofreWeb = {
        versao: 1,
        id: a.id,
        modo,
        ...(envSenha ? { senha: envSenha } : {}),
        recuperacao: rec,
        palavras: trBytes(a.palavras),
        ...(modo === "pin" || modo === "direto" ? { aparelho: await trancarAparelho(dek, modo === "pin" ? escolha!.pin! : null) } : {}),
      };
      await gravarCofre(c);
      await gravar("dados", dados);
      restaurar(json);
      bruta = dek;
      chave = k;
      pedirArmazenamentoPersistente();
      return modo;
    },
    situacaoBackup: async (): Promise<SituacaoBackup> => ({ pasta: null, ultimo: ultimoBackup, erro: null }),
    definirBackupAutomatico: async (pasta) => {
      if (pasta) throw new E("arquivo", "O backup automático numa pasta não existe na versão de navegador. Use “Fazer backup agora” de vez em quando.");
      return { pasta: null, ultimo: ultimoBackup, erro: null };
    },

    // ── Anexos: guarda o conteúdo de verdade ──
    anexarArquivo: async (item, caminho) => {
      const f = escolhidos.get(caminho);
      if (!f) throw new E("arquivo", "Não foi possível ler ou gravar um arquivo: não encontrei o arquivo escolhido.");
      if (f.size > MAXIMO_ARQUIVO) throw new E("arquivo", "Não foi possível ler ou gravar um arquivo: na versão de navegador, cada arquivo pode ter até 25 MB.");
      return anexarBytes(item, f.name, await base64DoArquivo(f));
    },
    anexarBytes,
    bytesAnexo,
    excluirAnexo: async (id) => {
      arquivos.delete(id);
      await base.excluirAnexo(id);
    },
    salvarAnexo: async (id, caminho) => {
      const a = await nomeDoAnexo(id);
      const nome = nomeDe(caminho, a?.nome ?? "arquivo");
      baixar(nome, await blobDoAnexo(id, nome));
    },
    abrirAnexo: async (id) => {
      const a = await nomeDoAnexo(id);
      if (!a || a.tipo === "link") return base.abrirAnexo(id);
      window.open(URL.createObjectURL(await blobDoAnexo(id, a.nome)), "_blank", "noopener");
    },

    // ── O que ainda não existe no navegador ──
    estadoIa: async () => ({ provedores: [], funcoes: {}, modelos: {}, bloquearSensivel: true }),
    salvarProvedorIa: iaIndisponivel,
    removerProvedorIa: iaIndisponivel,
    definirFuncaoIa: iaIndisponivel,
    bloquearSensivelIa: iaIndisponivel,
    testarProvedorIa: iaIndisponivel,
    sugerirPassosIa: iaIndisponivel,
    organizarTextoIa: iaIndisponivel,
    ajustarOrganizacaoIa: iaIndisponivel,
    desenharIconesIa: iaIndisponivel,
    revisarTextoIa: iaIndisponivel,
    gerarTemaIa: iaIndisponivel,
    modelosImagemIa: iaIndisponivel,
    gerarImagemIa: iaIndisponivel,
    ditadoEstado: async () => ({ instalado: null, baixando: false, gravando: false }),
    ditadoBaixar: ditadoIndisponivel,
    ditadoComecar: ditadoIndisponivel,
  };

  const junto = { ...base, ...sobre } as Api;

  // Depois de cada ação que muda alguma coisa, guarda (com uma pequena espera,
  // para juntar várias mudanças seguidas numa gravação só).
  const SO_LEITURA = /^(listar|carregar|situacao|estado|ler|bytes|imagem|info|conferir|hello|bandejaLigada|memoria|ver|ouvir|testar|modelos|buscar|resumo|sugerir|organizarTexto|ajustarOrganizacao|gerar|revisar|desenhar|abrir|salvarAnexo|fazerBackup|exportar|bloquear|criarCofre|recuperar|restaurarBackup)/;
  const final = {} as Record<string, unknown>;
  for (const [nome, v] of Object.entries(junto)) {
    if (typeof v !== "function" || SO_LEITURA.test(nome)) {
      final[nome] = v;
      continue;
    }
    final[nome] = (...args: unknown[]) => {
      const r = (v as (...a: unknown[]) => unknown)(...args);
      if (r instanceof Promise) r.then(agendarSalvar, () => {});
      else agendarSalvar();
      return r;
    };
  }
  return final as unknown as Api;
}
