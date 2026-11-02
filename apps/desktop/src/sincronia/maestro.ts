// O maestro da sincronização (ver docs/decisoes/0012-sincronizacao.md, etapa 2b).
// TypeScript puro, igual no Windows e no navegador: fala com o motor pela `api` e com
// a pasta (Drive ou pasta de mentira) pelo `Armazenamento`. Não sabe nada de tela.
//
// Um ciclo:
//   1. só segue se o motor diz que este aparelho tem a chave de sincronização;
//   2. lista a pasta (uma chamada só) e baixa os retratos dos outros aparelhos que
//      mudaram desde a última vez (pela `versao` de cada arquivo), juntando cada um;
//   3. busca os conteúdos de anexo que faltam aqui e guarda;
//   4. manda os conteúdos de anexo daqui que ainda não estão na pasta;
//   5. manda o próprio retrato se algo que viaja mudou desde o último envio (a "marca"
//      do motor: SHA-256 do retrato sem a hora; muda se, e só se, algo mudou).
//
// O que o maestro lembra (versões vistas, última marca enviada) fica só na memória:
// guardar no cofre de valores faria esse controle viajar junto (as chaves `valor:*`
// viajam) e mudar a própria marca a cada ciclo. Ao abrir o app, o primeiro ciclo baixa
// todos os retratos uma vez e manda o daqui uma vez; depois, só o que mudou.
import type { Api } from "../api";
import { AcessoNegado, SemInternet, type Armazenamento } from "./armazenamento";

export const ARQUIVO_CHAVE = "chave.orbita-sync";
const EXT = ".orbita-sync";
export const arquivoDoAparelho = (id: string) => `aparelho-${id}${EXT}`;
export const arquivoDoAnexo = (sha: string) => `anexo-${sha}${EXT}`;

/** O pedaço da `api` que o maestro usa (facilita a api falsa dos testes). */
export type ApiSincronia = Pick<
  Api,
  "sincroniaSituacao" | "sincroniaCriarChave" | "sincroniaEntrar" | "sincroniaMeuPacote" | "sincroniaJuntar" | "sincroniaConteudo" | "sincroniaGuardarConteudo" | "sincroniaMarca"
>;

export type Fase =
  /** Ainda não sincronizou nesta abertura. */
  | "parado"
  /** Este aparelho não tem a chave: a sincronização não está ligada aqui. */
  | "sem-chave"
  | "sincronizando"
  | "ok"
  /** Sem internet: o que mudou fica guardado aqui e vai depois. */
  | "sem-internet"
  /** A conta não dá mais acesso (login venceu ou foi tirado). */
  | "entrar-de-novo"
  | "erro";

export interface EstadoSincronia {
  fase: Fase;
  /** Fim do último ciclo que deu certo (ms), ou null. */
  ultima: number | null;
  /** Motivo simples, na fase "erro". */
  motivo: string | null;
}

export interface OpcoesMaestro {
  armazenamento: Armazenamento;
  api: ApiSincronia;
  /** Chamado depois de um ciclo que trouxe algo novo (as telas recarregam). */
  aoMudarDados?: () => void;
  agora?: () => number;
}

/** O que aconteceu num ciclo (para testes e diagnóstico). */
export interface RelatorioCiclo {
  baixados: string[];
  juntados: number;
  anexosRecebidos: number;
  anexosEnviados: number;
  enviouRetrato: boolean;
  mudouAqui: boolean;
}

/** Texto curto e simples de um erro qualquer, sem detalhes técnicos compridos. */
export function motivoSimples(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const limpo = m.trim().replace(/\.$/, "");
  if (!limpo || limpo.length > 140) return "erro inesperado";
  return limpo.charAt(0).toLowerCase() + limpo.slice(1);
}

export class Maestro {
  private readonly arm: Armazenamento;
  private readonly api: ApiSincronia;
  private readonly aoMudarDados?: () => void;
  private readonly agora: () => number;
  private estadoAtual: EstadoSincronia = { fase: "parado", ultima: null, motivo: null };
  private readonly ouvintes = new Set<(e: EstadoSincronia) => void>();
  /** nome do arquivo → versão vista (já juntada). */
  private readonly vistos = new Map<string, string>();
  private ultimaMarcaEnviada: string | null = null;
  private emCurso: Promise<RelatorioCiclo | null> | null = null;
  private deNovo = false;
  private parado = false;
  private pausado = false;

  constructor(o: OpcoesMaestro) {
    this.arm = o.armazenamento;
    this.api = o.api;
    this.aoMudarDados = o.aoMudarDados;
    this.agora = o.agora ?? Date.now;
  }

  get estado(): EstadoSincronia {
    return this.estadoAtual;
  }

  get ocupado(): boolean {
    return this.emCurso !== null;
  }

  ouvir(f: (e: EstadoSincronia) => void): () => void {
    this.ouvintes.add(f);
    return () => void this.ouvintes.delete(f);
  }

  /**
   * Pausa enquanto a pessoa liga a sincronização (etapa 2d): a chave já pode estar aqui,
   * mas nada sincroniza até ela escolher como juntar os dados. Pausado, `sincronizar`
   * não faz nada.
   */
  pausar(sim: boolean): void {
    this.pausado = sim;
  }

  /** Para de vez (bloqueou ou saiu): ciclos em curso terminam sem mexer no estado. */
  parar(): void {
    this.parado = true;
    this.deNovo = false;
  }

  private mudar(e: Partial<EstadoSincronia>) {
    if (this.parado) return;
    this.estadoAtual = { ...this.estadoAtual, ...e };
    for (const f of this.ouvintes) f(this.estadoAtual);
  }

  /**
   * Roda um ciclo. Nunca dois ao mesmo tempo: se já há um rodando, `repetir` (o padrão)
   * pede mais um logo depois (houve mudança nova); sem `repetir`, só espera o atual.
   * Nunca lança: o resultado fica no estado.
   */
  sincronizar({ repetir = true }: { repetir?: boolean } = {}): Promise<RelatorioCiclo | null> {
    if (this.parado || this.pausado) return this.emCurso ?? Promise.resolve(null);
    if (this.emCurso) {
      if (repetir) this.deNovo = true;
      return this.emCurso;
    }
    this.emCurso = (async () => {
      let rel: RelatorioCiclo | null = null;
      do {
        this.deNovo = false;
        rel = await this.umCiclo();
      } while (this.deNovo && !this.parado);
      this.emCurso = null;
      return rel;
    })();
    return this.emCurso;
  }

  private async umCiclo(): Promise<RelatorioCiclo | null> {
    try {
      const situacao = await this.api.sincroniaSituacao();
      if (!situacao.temChave) {
        this.mudar({ fase: "sem-chave", motivo: null });
        return null;
      }
      this.mudar({ fase: "sincronizando" });
      const rel = await this.ciclo(situacao.aparelho);
      this.mudar({ fase: rel.falha ? "erro" : "ok", motivo: rel.falha, ultima: rel.falha ? this.estadoAtual.ultima : this.agora() });
      if (rel.mudouAqui && !this.parado) this.aoMudarDados?.();
      return rel;
    } catch (e) {
      if (e instanceof SemInternet) this.mudar({ fase: "sem-internet", motivo: null });
      else if (e instanceof AcessoNegado) this.mudar({ fase: "entrar-de-novo", motivo: null });
      else this.mudar({ fase: "erro", motivo: motivoSimples(e) });
      return null;
    }
  }

  private async ciclo(meuId: string): Promise<RelatorioCiclo & { falha: string | null }> {
    const rel: RelatorioCiclo = { baixados: [], juntados: 0, anexosRecebidos: 0, anexosEnviados: 0, enviouRetrato: false, mudouAqui: false };
    let falha: string | null = null;
    // Erro de rede ou de acesso derruba o ciclo; outro erro num arquivo só pula esse arquivo.
    const cada = async (f: () => Promise<void>) => {
      try {
        await f();
      } catch (e) {
        if (e instanceof SemInternet || e instanceof AcessoNegado) throw e;
        falha ??= motivoSimples(e);
      }
    };

    const lista = await this.arm.listar();
    const naPasta = new Map(lista.map((a) => [a.nome, a]));
    const meuArquivo = arquivoDoAparelho(meuId);

    // 2. Retratos dos outros aparelhos que mudaram.
    for (const a of lista) {
      if (!a.nome.startsWith("aparelho-") || !a.nome.endsWith(EXT) || a.nome === meuArquivo) continue;
      if (this.vistos.get(a.nome) === a.versao) continue;
      await cada(async () => {
        const pacote = await this.arm.baixar(a.nome);
        rel.baixados.push(a.nome);
        if (pacote === null) return; // sumiu entre listar e baixar
        const r = await this.api.sincroniaJuntar(pacote);
        // Só marca como visto depois de juntar: se falhou, tenta de novo no próximo ciclo.
        this.vistos.set(a.nome, a.versao);
        rel.juntados++;
        if (r.entraram + r.mudaram + r.configuracoes > 0) rel.mudouAqui = true;
      });
    }

    // 3. Conteúdos de anexo que faltam aqui (os que ainda não estão na pasta ficam para depois).
    let marca = await this.api.sincroniaMarca();
    for (const sha of marca.faltam) {
      const nome = arquivoDoAnexo(sha);
      if (!naPasta.has(nome)) continue;
      await cada(async () => {
        const conteudo = await this.arm.baixar(nome);
        if (conteudo === null) return;
        const n = await this.api.sincroniaGuardarConteudo(sha, conteudo);
        if (n > 0) (rel.anexosRecebidos++, (rel.mudouAqui = true));
      });
    }
    if (rel.anexosRecebidos > 0) marca = await this.api.sincroniaMarca();

    // 4. Conteúdos daqui que faltam na pasta (antes do retrato, para quem ler o retrato já achar o anexo).
    for (const sha of marca.conteudos) {
      const nome = arquivoDoAnexo(sha);
      if (naPasta.has(nome)) continue;
      await cada(async () => {
        const conteudo = await this.api.sincroniaConteudo(sha);
        if (conteudo === null) return;
        const arq = await this.arm.enviar(nome, conteudo);
        naPasta.set(nome, arq);
        rel.anexosEnviados++;
      });
    }

    // 5. O retrato daqui, se mudou algo desde o último envio (ou se sumiu da pasta).
    if (marca.marca !== this.ultimaMarcaEnviada || !naPasta.has(meuArquivo)) {
      const pacote = await this.api.sincroniaMeuPacote();
      await this.arm.enviar(meuArquivo, pacote);
      this.ultimaMarcaEnviada = marca.marca;
      rel.enviouRetrato = true;
    }
    return { ...rel, falha };
  }
}

// ── Ligar a sincronização (para as telas da etapa 2d e para os testes) ──────────

/** Já existe uma chave na pasta: este aparelho precisa entrar, nunca criar outra. */
export class JaExisteChave extends Error {
  constructor() {
    super("Já existe uma sincronização nesta conta. Entre nela em vez de criar outra.");
  }
}

/**
 * Primeiro aparelho: cria a chave e guarda o arquivo dela na pasta. Sem senha (`null`), o
 * modo "só o Google" (padrão): o arquivo guarda a chave aberta. Com senha, a "proteção
 * extra": o envelope aberto pela senha.
 * Proteção: se a pasta já tem `chave.orbita-sync`, lança `JaExisteChave` e não mexe em
 * nada (trocar a chave deixaria os outros aparelhos de fora).
 */
export async function ligarComoPrimeiro(arm: Armazenamento, api: Pick<Api, "sincroniaCriarChave" | "sincroniaCriarChaveConta">, senha: string | null): Promise<void> {
  if ((await arm.baixar(ARQUIVO_CHAVE)) !== null) throw new JaExisteChave();
  const arquivo = senha === null ? await api.sincroniaCriarChaveConta() : await api.sincroniaCriarChave(senha);
  await arm.enviar(ARQUIVO_CHAVE, arquivo);
}

/**
 * Aparelho novo: baixa o arquivo da chave e entra. No modo senha, com a senha; no modo
 * conta, a senha não é usada. Devolve false se não há arquivo.
 */
export async function entrarComSenha(arm: Armazenamento, api: Pick<ApiSincronia, "sincroniaEntrar">, senha: string): Promise<boolean> {
  const envelope = await arm.baixar(ARQUIVO_CHAVE);
  if (envelope === null) return false;
  await api.sincroniaEntrar(envelope, senha);
  return true;
}
