import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarcaSincronia, ResumoSincronia, SituacaoSincronia } from "../api";
import { agendarSincronia } from "./agenda";
import { ARQUIVO_CHAVE, arquivoDoAnexo, arquivoDoAparelho, entrarComSenha, ligarComoPrimeiro, Maestro, motivoSimples, type ApiSincronia } from "./maestro";
import { PastaNaMemoria } from "./pastaDeMentira";
import { rotuloDoAviso, tempoDesde } from "./rotulo";

// Motor de mentira: linhas com "vale a mais recente", anexos por SHA, pacote em JSON aberto.
interface Linha {
  texto: string;
  alt: number;
  excluido: boolean;
}
class MotorFalso implements ApiSincronia {
  temChave = false;
  linhas = new Map<string, Linha>();
  /** anexo id → sha; conteúdos por sha. */
  anexos = new Map<string, string>();
  conteudos = new Map<string, string>();
  emCurso = 0;
  maxEmCurso = 0;
  constructor(readonly id: string) {}

  private async passo<T>(f: () => T): Promise<T> {
    this.emCurso++;
    this.maxEmCurso = Math.max(this.maxEmCurso, this.emCurso);
    await Promise.resolve();
    try {
      return f();
    } finally {
      this.emCurso--;
    }
  }
  escrever(id: string, texto: string, alt: number, excluido = false) {
    this.linhas.set(id, { texto, alt, excluido });
  }
  anexar(id: string, sha: string, conteudo: string) {
    this.anexos.set(id, sha);
    this.conteudos.set(sha, conteudo);
  }
  sincroniaSituacao = () => this.passo<SituacaoSincronia>(() => ({ temChave: this.temChave, aparelho: this.id }));
  sincroniaCriarChave = (senha: string) => this.passo(() => ((this.temChave = true), `envelope:${senha}`));
  sincroniaEntrar = (envelope: string, senha: string) =>
    this.passo(() => {
      if (envelope !== `envelope:${senha}`) throw new Error("senha_errada");
      this.temChave = true;
    });
  sincroniaMeuPacote = () => this.passo(() => JSON.stringify({ aparelho: this.id, linhas: [...this.linhas], anexos: [...this.anexos] }));
  sincroniaJuntar = (pacote: string) =>
    this.passo<ResumoSincronia>(() => {
      const p = JSON.parse(pacote) as { aparelho: string; linhas: [string, Linha][]; anexos: [string, string][] };
      let entraram = 0;
      let mudaram = 0;
      for (const [id, l] of p.linhas) {
        const aqui = this.linhas.get(id);
        if (!aqui) (this.linhas.set(id, l), entraram++);
        else if (l.alt > aqui.alt) (this.linhas.set(id, l), mudaram++);
      }
      for (const [id, sha] of p.anexos) if (!this.anexos.has(id)) this.anexos.set(id, sha);
      return { aparelho: p.aparelho, entraram, mudaram, ignoradas: 0, configuracoes: 0, faltamConteudos: this.faltam() };
    });
  private faltam = () => [...new Set(this.anexos.values())].filter((s) => !this.conteudos.has(s)).sort();
  sincroniaConteudo = (sha: string) => this.passo(() => (this.conteudos.has(sha) ? `trancado:${this.conteudos.get(sha)}` : null));
  sincroniaGuardarConteudo = (sha: string, c: string) =>
    this.passo(() => {
      if (!this.faltam().includes(sha)) return 0;
      this.conteudos.set(sha, c.replace(/^trancado:/, ""));
      return 1;
    });
  sincroniaMarca = () =>
    this.passo<MarcaSincronia>(() => ({
      marca: JSON.stringify([[...this.linhas].sort(), [...this.anexos].sort(), [...this.conteudos.keys()].sort()]),
      conteudos: [...this.conteudos.keys()].sort(),
      faltam: this.faltam(),
    }));
  texto = (id: string) => (this.linhas.get(id)?.excluido ? null : (this.linhas.get(id)?.texto ?? null));
}

function montar() {
  const pasta = new PastaNaMemoria();
  const a = new MotorFalso("aaa");
  const b = new MotorFalso("bbb");
  const mudouB = vi.fn();
  const ma = new Maestro({ armazenamento: pasta, api: a });
  const mb = new Maestro({ armazenamento: pasta, api: b, aoMudarDados: mudouB });
  return { pasta, a, b, ma, mb, mudouB };
}

describe("maestro da sincronização", () => {
  it("sem chave neste aparelho, não mexe na pasta", async () => {
    const { pasta, ma } = montar();
    expect(await ma.sincronizar()).toBeNull();
    expect(ma.estado.fase).toBe("sem-chave");
    expect(pasta.contas.listar).toBe(0);
  });

  it("liga pelo primeiro aparelho e o outro entra com a mesma senha", async () => {
    const { pasta, a, b } = montar();
    await ligarComoPrimeiro(pasta, a, "senha comprida de teste");
    expect(pasta.arquivos.has(ARQUIVO_CHAVE)).toBe(true);
    await expect(entrarComSenha(pasta, b, "outra senha")).rejects.toThrow("senha_errada");
    expect(await entrarComSenha(pasta, b, "senha comprida de teste")).toBe(true);
    expect(b.temChave).toBe(true);
    expect(await entrarComSenha(new PastaNaMemoria(), b, "x")).toBe(false);
  });

  it("criar, editar e apagar viajam entre dois aparelhos; quem recebe avisa as telas", async () => {
    const { a, b, ma, mb, mudouB, pasta } = montar();
    a.temChave = b.temChave = true;
    a.escrever("i1", "ideia do A", 1);
    await ma.sincronizar();
    expect(ma.estado.fase).toBe("ok");
    expect(ma.estado.ultima).not.toBeNull();
    expect(pasta.arquivos.has(arquivoDoAparelho("aaa"))).toBe(true);

    await mb.sincronizar();
    expect(b.texto("i1")).toBe("ideia do A");
    expect(mudouB).toHaveBeenCalledTimes(1);

    b.escrever("i1", "editada no B", 2);
    await mb.sincronizar();
    await ma.sincronizar();
    expect(a.texto("i1")).toBe("editada no B");

    a.escrever("i1", "editada no B", 3, true);
    await ma.sincronizar();
    await mb.sincronizar();
    expect(b.texto("i1")).toBeNull();
  });

  it("só baixa o que mudou e só envia quando algo mudou aqui", async () => {
    const { a, b, ma, mb, pasta } = montar();
    a.temChave = b.temChave = true;
    a.escrever("i1", "x", 1);
    await ma.sincronizar();
    const r1 = await mb.sincronizar();
    expect(r1?.baixados).toEqual([arquivoDoAparelho("aaa")]);
    expect(r1?.enviouRetrato).toBe(true);

    const r2 = await mb.sincronizar();
    expect(r2?.baixados).toEqual([]);
    expect(r2?.enviouRetrato).toBe(false);
    // A vê o retrato novo do B uma vez; como nada muda no A, não reenvia.
    const r3 = await ma.sincronizar();
    expect(r3?.baixados).toEqual([arquivoDoAparelho("bbb")]);
    expect(r3?.enviouRetrato).toBe(false);
    const enviosAntes = pasta.contas.enviar;
    await ma.sincronizar();
    await mb.sincronizar();
    expect(pasta.contas.enviar).toBe(enviosAntes);
  });

  it("anexo vai uma vez só e chega no outro aparelho", async () => {
    const { a, b, ma, mb, pasta } = montar();
    a.temChave = b.temChave = true;
    a.anexar("x1", "sha1", "imagem");
    const ra = await ma.sincronizar();
    expect(ra?.anexosEnviados).toBe(1);
    expect(pasta.arquivos.get(arquivoDoAnexo("sha1"))?.conteudo).toBe("trancado:imagem");
    const rb = await mb.sincronizar();
    expect(rb?.anexosRecebidos).toBe(1);
    expect(b.conteudos.get("sha1")).toBe("imagem");
    expect(rb?.anexosEnviados).toBe(0);
    expect((await ma.sincronizar())?.anexosEnviados).toBe(0);
  });

  it("anexo que ainda não chegou na pasta é buscado num ciclo seguinte", async () => {
    const { a, b, ma, mb, pasta } = montar();
    a.temChave = b.temChave = true;
    a.anexar("x1", "sha1", "imagem");
    await ma.sincronizar();
    pasta.arquivos.delete(arquivoDoAnexo("sha1"));
    expect((await mb.sincronizar())?.anexosRecebidos).toBe(0);
    await new Maestro({ armazenamento: pasta, api: a }).sincronizar(); // A abre de novo e reenvia
    expect((await mb.sincronizar())?.anexosRecebidos).toBe(1);
  });

  it("sem internet: avisa, guarda e manda quando volta", async () => {
    const { a, ma, pasta } = montar();
    a.temChave = true;
    await ma.sincronizar();
    const ultima = ma.estado.ultima;
    a.escrever("i1", "feito sem internet", 5);
    pasta.semInternet = true;
    await ma.sincronizar();
    expect(ma.estado.fase).toBe("sem-internet");
    expect(ma.estado.ultima).toBe(ultima);
    pasta.semInternet = false;
    const r = await ma.sincronizar();
    expect(ma.estado.fase).toBe("ok");
    expect(r?.enviouRetrato).toBe(true);
    expect(pasta.arquivos.get(arquivoDoAparelho("aaa"))?.conteudo).toContain("feito sem internet");
  });

  it("acesso negado pede para entrar de novo", async () => {
    const { a, ma, pasta } = montar();
    a.temChave = true;
    pasta.negado = true;
    await ma.sincronizar();
    expect(ma.estado.fase).toBe("entrar-de-novo");
  });

  it("retrato estragado de outro aparelho não trava o resto e é tentado de novo", async () => {
    const { a, ma, pasta } = montar();
    a.temChave = true;
    await pasta.enviar(arquivoDoAparelho("ccc"), "isso não é um pacote");
    const r = await ma.sincronizar();
    expect(ma.estado.fase).toBe("erro");
    expect(ma.estado.motivo).toBeTruthy();
    expect(r?.enviouRetrato).toBe(true);
    expect((await ma.sincronizar())?.baixados).toEqual([arquivoDoAparelho("ccc")]);
  });

  it("nunca roda dois ciclos ao mesmo tempo; mudança no meio pede mais um", async () => {
    const { a, ma } = montar();
    a.temChave = true;
    const espiar = vi.spyOn(a, "sincroniaSituacao");
    await Promise.all([ma.sincronizar(), ma.sincronizar({ repetir: false }), ma.sincronizar(), ma.sincronizar()]);
    expect(a.maxEmCurso).toBe(1);
    expect(espiar).toHaveBeenCalledTimes(2);
  });

  it("depois de parar, não muda mais o estado", async () => {
    const { a, ma } = montar();
    a.temChave = true;
    const p = ma.sincronizar();
    ma.parar();
    await p;
    expect(ma.estado.fase).toBe("parado");
    expect(await ma.sincronizar()).toBeNull();
  });

  it("motivo simples: curto, sem ponto final", () => {
    expect(motivoSimples(new Error("A pasta respondeu 500."))).toBe("a pasta respondeu 500");
    expect(motivoSimples("x".repeat(300))).toBe("erro inesperado");
    expect(motivoSimples(null)).toBe("erro inesperado");
  });
});

describe("textos do aviso", () => {
  const ok = { fase: "ok" as const, ultima: 0, motivo: null };
  it("conta o tempo de forma curta", () => {
    expect(tempoDesde(0, 30_000)).toBeNull();
    expect(tempoDesde(0, 60_000)).toBe("1 min");
    expect(tempoDesde(0, 3 * 3_600_000)).toBe("3 h");
    expect(tempoDesde(0, 26 * 3_600_000)).toBe("1 dia");
  });
  it("frases literais para cada estado", () => {
    expect(rotuloDoAviso(ok, 10_000, false)).toBe("Sincronizado agora");
    expect(rotuloDoAviso(ok, 61_000, false)).toBe("Sincronizado há 1 min");
    expect(rotuloDoAviso({ ...ok, fase: "sincronizando" }, 61_000, false)).toBe("Sincronizado há 1 min");
    expect(rotuloDoAviso({ ...ok, fase: "sincronizando" }, 61_000, true)).toBe("Sincronizando…");
    expect(rotuloDoAviso({ ...ok, fase: "sem-internet" }, 0, false)).toBe("Sem internet: guardado neste aparelho");
    expect(rotuloDoAviso({ ...ok, fase: "entrar-de-novo" }, 0, false)).toBe("Precisa entrar de novo na conta");
    expect(rotuloDoAviso({ ...ok, fase: "erro", motivo: "a pasta respondeu 500" }, 0, false)).toBe("Não deu para sincronizar: a pasta respondeu 500");
  });
});

describe("quando sincroniza", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function alvo() {
    const ouvintes = new Map<string, () => void>();
    const doc = { visibilityState: "visible" as DocumentVisibilityState, addEventListener: (n: string, f: () => void) => ouvintes.set(n, f), removeEventListener: (n: string) => ouvintes.delete(n) };
    const jan = { addEventListener: (n: string, f: () => void) => ouvintes.set(n, f), removeEventListener: (n: string) => ouvintes.delete(n) };
    return { doc, jan, ouvintes };
  }

  it("ao ligar, a cada minuto com o app visível, ao voltar e 3 s depois de mudar algo", async () => {
    const { a, ma } = montar();
    a.temChave = true;
    const sinc = vi.spyOn(ma, "sincronizar");
    const { doc, jan, ouvintes } = alvo();
    const ag = agendarSincronia(ma, { documento: doc as unknown as Document, janela: jan as unknown as Window });
    expect(sinc).toHaveBeenCalledTimes(1); // ao ligar

    await vi.advanceTimersByTimeAsync(60_000);
    expect(sinc).toHaveBeenCalledTimes(2); // um minuto

    doc.visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sinc).toHaveBeenCalledTimes(2); // escondido, não

    doc.visibilityState = "visible";
    ouvintes.get("visibilitychange")!();
    ouvintes.get("focus")!(); // vem junto: não pede outro
    expect(sinc).toHaveBeenCalledTimes(3);

    ag.mudouAqui();
    await vi.advanceTimersByTimeAsync(1_000);
    ag.mudouAqui(); // várias mudanças seguidas viram um ciclo só
    await vi.advanceTimersByTimeAsync(2_900);
    expect(sinc).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(200);
    expect(sinc).toHaveBeenCalledTimes(4);

    ag.parar();
    expect(ouvintes.size).toBe(0);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(sinc).toHaveBeenCalledTimes(4);
  });
});
