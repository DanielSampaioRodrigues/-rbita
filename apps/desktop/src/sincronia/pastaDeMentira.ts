// Pastas de mentira para testar a sincronização sem Google (ver armazenamento.ts).
//
// - PastaNaMemoria: tudo num Map, para os testes do maestro (vitest). Dá para fingir
//   "sem internet" e "acesso negado".
// - PastaHttp: fala com o servidor de teste (apps/desktop/scripts/pasta-teste.cjs), que
//   o teste de ponta a ponta (scripts/teste-sync.cjs) e o `pnpm dev` servem em
//   `/__pasta-teste/`. Assim dois navegadores separados (dois contextos do Playwright,
//   que não dividem nada entre si) trocam arquivos pela mesma pasta.
import { AcessoNegado, SemInternet, type ArquivoRemoto, type Armazenamento } from "./armazenamento";

export class PastaNaMemoria implements Armazenamento {
  readonly arquivos = new Map<string, { conteudo: string; versao: number; alteradoEm: number }>();
  semInternet = false;
  negado = false;
  /** Quantas vezes cada operação foi chamada (para conferir nos testes). */
  readonly contas = { listar: 0, baixar: 0, enviar: 0, apagar: 0 };
  private contador = 0;

  private conferir() {
    if (this.semInternet) throw new SemInternet();
    if (this.negado) throw new AcessoNegado();
  }

  async listar(prefixo = ""): Promise<ArquivoRemoto[]> {
    this.contas.listar++;
    this.conferir();
    return [...this.arquivos]
      .filter(([nome]) => nome.startsWith(prefixo))
      .map(([nome, a]) => ({ nome, versao: String(a.versao), alteradoEm: a.alteradoEm }));
  }

  async baixar(nome: string): Promise<string | null> {
    this.contas.baixar++;
    this.conferir();
    return this.arquivos.get(nome)?.conteudo ?? null;
  }

  async enviar(nome: string, conteudo: string): Promise<ArquivoRemoto> {
    this.contas.enviar++;
    this.conferir();
    const a = { conteudo, versao: ++this.contador, alteradoEm: Date.now() };
    this.arquivos.set(nome, a);
    return { nome, versao: String(a.versao), alteradoEm: a.alteradoEm };
  }

  async apagar(nome: string): Promise<void> {
    this.contas.apagar++;
    this.conferir();
    this.arquivos.delete(nome);
  }
}

/** Endereço da pasta de teste no mesmo site (nunca outro site: os dados não saem dali). */
export const ENDERECO_PASTA_TESTE = "/__pasta-teste/";

export class PastaHttp implements Armazenamento {
  constructor(private readonly base = ENDERECO_PASTA_TESTE) {}

  private async pedir(caminho: string, init?: RequestInit): Promise<Response> {
    let r: Response;
    try {
      r = await fetch(this.base + caminho, { cache: "no-store", ...init });
    } catch {
      throw new SemInternet();
    }
    if (r.status === 503) throw new SemInternet();
    if (r.status === 401 || r.status === 403) throw new AcessoNegado();
    return r;
  }

  private static async ok(r: Response): Promise<Response> {
    if (!r.ok) throw new Error(`a pasta de teste respondeu ${r.status}`);
    return r;
  }

  async listar(prefixo = ""): Promise<ArquivoRemoto[]> {
    const r = await PastaHttp.ok(await this.pedir(`lista?prefixo=${encodeURIComponent(prefixo)}`));
    return (await r.json()) as ArquivoRemoto[];
  }

  async baixar(nome: string): Promise<string | null> {
    const r = await this.pedir(`arquivo/${encodeURIComponent(nome)}`);
    if (r.status === 404) return null;
    return (await PastaHttp.ok(r)).text();
  }

  async enviar(nome: string, conteudo: string): Promise<ArquivoRemoto> {
    const r = await PastaHttp.ok(await this.pedir(`arquivo/${encodeURIComponent(nome)}`, { method: "PUT", body: conteudo, headers: { "content-type": "text/plain" } }));
    return (await r.json()) as ArquivoRemoto;
  }

  async apagar(nome: string): Promise<void> {
    const r = await this.pedir(`arquivo/${encodeURIComponent(nome)}`, { method: "DELETE" });
    if (r.status !== 404) await PastaHttp.ok(r);
  }
}
