import { describe, expect, it, vi } from "vitest";
import type { SituacaoSincronia } from "../api";
import {
  ARQUIVO_PIN,
  ARQUIVO_RECUPERACAO,
  avaliarPerguntas,
  conferirPin,
  entrarPorRecuperacao,
  guardarPin,
  guardarRecuperacao,
  normalizarResposta,
  olharPasta,
  perguntasDaPasta,
  trocarSenha,
  type ApiFluxo,
} from "./fluxo";
import { ARQUIVO_CHAVE, JaExisteChave, ligarComoPrimeiro, Maestro, type ApiSincronia } from "./maestro";
import { PastaNaMemoria } from "./pastaDeMentira";

/** Motor de mentira só com a parte da chave, da recuperação e do PIN (sem cripto de verdade). */
class MotorChave implements ApiFluxo {
  chave: string | null = null;
  criarChave = vi.fn();
  constructor(readonly id: string) {}
  sincroniaSituacao = async (): Promise<SituacaoSincronia> => ({ temChave: this.chave !== null, aparelho: this.id });
  sincroniaCriarChave = async (senha: string) => {
    this.criarChave(senha);
    this.chave ??= `chave-de-${this.id}`;
    return JSON.stringify({ chave: this.chave, senha });
  };
  sincroniaEntrar = async (envelope: string, senha: string) => {
    const e = JSON.parse(envelope) as { chave: string; senha: string };
    if (e.senha !== senha) throw new Error("senha_errada");
    this.chave = e.chave;
  };
  sincroniaCriarRecuperacao = async (pin: string, perguntas: string[], respostas: string[]) => {
    if (!this.chave) throw new Error("sem chave");
    return JSON.stringify({ perguntas, segredo: [pin, ...respostas.map(normalizarResposta)].join("|"), chave: this.chave });
  };
  sincroniaPerguntas = async (r: string) => (JSON.parse(r) as { perguntas: string[] }).perguntas;
  sincroniaEntrarPorRecuperacao = async (r: string, pin: string, respostas: string[]) => {
    const x = JSON.parse(r) as { segredo: string; chave: string };
    if (x.segredo !== [pin, ...respostas.map(normalizarResposta)].join("|")) throw new Error("respostas_erradas");
    this.chave = x.chave;
  };
  sincroniaMarcaDoPin = async (pin: string) => {
    if (!this.chave) throw new Error("sem chave");
    return `${this.chave}:${pin}`;
  };
  sincroniaConferirPin = async (marca: string, pin: string) => {
    if (!this.chave || !marca.startsWith(`${this.chave}:`)) throw new Error("outra chave");
    return marca === `${this.chave}:${pin}`;
  };
}

const PERGUNTAS = ["Apelido do avô?", "Rua aos 7 anos?", "Primeiro bicho?", "Comida da infância?", "Música da formatura?", "Livro que marcou?"];
const RESPOSTAS = ["Zé Pequeno", "Rua São João", "Pipoca", "Pão de queijo", "Ônibus", "Grande Sertão"];

describe("ligar a sincronização (etapa 2d)", () => {
  it("primeiro aparelho cria a chave; se a pasta já tem chave, recusa e não troca a chave dos outros", async () => {
    const pasta = new PastaNaMemoria();
    const a = new MotorChave("a");
    const b = new MotorChave("b");
    expect(await olharPasta(pasta)).toEqual({ temChave: false, temRecuperacao: false });
    await ligarComoPrimeiro(pasta, a, "senha comprida de teste");
    const envelope = pasta.arquivos.get(ARQUIVO_CHAVE)!.conteudo;
    expect((await olharPasta(pasta)).temChave).toBe(true);

    // O segundo aparelho tenta "ligar como primeiro": recusa antes de criar qualquer chave.
    await expect(ligarComoPrimeiro(pasta, b, "outra senha qualquer")).rejects.toBeInstanceOf(JaExisteChave);
    expect(b.criarChave).not.toHaveBeenCalled();
    expect(b.chave).toBeNull();
    expect(pasta.arquivos.get(ARQUIVO_CHAVE)!.conteudo).toBe(envelope);
    // O caminho certo é entrar com a senha de lá.
    await b.sincroniaEntrar(envelope, "senha comprida de teste");
    expect(b.chave).toBe(a.chave);
  });

  it("trocar a senha faz outro envelope da MESMA chave; sem chave aqui, recusa", async () => {
    const pasta = new PastaNaMemoria();
    const a = new MotorChave("a");
    await expect(trocarSenha(pasta, a, "senha nova bem longa")).rejects.toThrow();
    await ligarComoPrimeiro(pasta, a, "senha comprida de teste");
    const chave = a.chave;
    await trocarSenha(pasta, a, "senha nova bem longa");
    const c = new MotorChave("c");
    await expect(c.sincroniaEntrar(pasta.arquivos.get(ARQUIVO_CHAVE)!.conteudo, "senha comprida de teste")).rejects.toThrow("senha_errada");
    await c.sincroniaEntrar(pasta.arquivos.get(ARQUIVO_CHAVE)!.conteudo, "senha nova bem longa");
    expect(c.chave).toBe(chave);
  });

  it("esqueci a senha: entra com PIN + respostas (acento e maiúscula não importam)", async () => {
    const pasta = new PastaNaMemoria();
    const a = new MotorChave("a");
    const b = new MotorChave("b");
    await ligarComoPrimeiro(pasta, a, "senha comprida de teste");
    expect(await perguntasDaPasta(pasta, b)).toBeNull();
    await guardarRecuperacao(pasta, a, "2580", PERGUNTAS, RESPOSTAS);
    expect(pasta.arquivos.has(ARQUIVO_RECUPERACAO)).toBe(true);
    expect((await olharPasta(pasta)).temRecuperacao).toBe(true);
    expect(await perguntasDaPasta(pasta, b)).toEqual(PERGUNTAS);

    const umaErrada = [...RESPOSTAS];
    umaErrada[2] = "Bolinha";
    await expect(entrarPorRecuperacao(pasta, b, "2580", umaErrada)).rejects.toThrow("respostas_erradas");
    expect(b.chave).toBeNull();
    await entrarPorRecuperacao(pasta, b, "2580", ["ze  pequeno", "RUA SAO JOAO", "pipoca", "pao de QUEIJO", "onibus", " grande sertao "]);
    expect(b.chave).toBe(a.chave);
  });

  it("PIN igual em todos os aparelhos: sem resumo, null; depois, confere só o mesmo PIN", async () => {
    const pasta = new PastaNaMemoria();
    const a = new MotorChave("a");
    const b = new MotorChave("b");
    await ligarComoPrimeiro(pasta, a, "senha comprida de teste");
    expect(await conferirPin(pasta, a, "2580")).toBeNull();
    await guardarPin(pasta, a, "2580");
    expect(pasta.arquivos.has(ARQUIVO_PIN)).toBe(true);
    await b.sincroniaEntrar(pasta.arquivos.get(ARQUIVO_CHAVE)!.conteudo, "senha comprida de teste");
    expect(await conferirPin(pasta, b, "2580")).toBe(true);
    expect(await conferirPin(pasta, b, "1234")).toBe(false);
  });

  it("normaliza respostas e avalia as 6 perguntas", () => {
    expect(normalizarResposta("  Ração   de PEIXE ")).toBe("racao de peixe");
    expect(normalizarResposta("Ônibus São João")).toBe("onibus sao joao");
    expect(avaliarPerguntas(PERGUNTAS, RESPOSTAS)).toEqual({ ok: true, faltam: 0, repetidas: false });
    const sem = [...RESPOSTAS];
    sem[5] = "   ";
    expect(avaliarPerguntas(PERGUNTAS, sem)).toMatchObject({ ok: false, faltam: 1 });
    const repetidas = [...PERGUNTAS];
    repetidas[1] = "apelido do AVÔ?";
    expect(avaliarPerguntas(repetidas, RESPOSTAS)).toMatchObject({ ok: false, repetidas: true });
  });

  it("pausado, o maestro não sincroniza (a pessoa ainda está escolhendo como juntar)", async () => {
    const pasta = new PastaNaMemoria();
    const api = { sincroniaSituacao: vi.fn(async () => ({ temChave: true, aparelho: "x" })) } as unknown as ApiSincronia;
    const m = new Maestro({ armazenamento: pasta, api });
    m.pausar(true);
    expect(await m.sincronizar()).toBeNull();
    expect(api.sincroniaSituacao).not.toHaveBeenCalled();
    expect(pasta.contas.listar).toBe(0);
  });
});
