import { describe, expect, it } from "vitest";
import { AcessoNegado, SemInternet } from "./armazenamento";
import { criarLoginGoogle, ESCOPOS, EntradaCancelada, JanelaBloqueada, PrecisaEntrarDeNovo, type GoogleOauth2, type RespostaToken } from "./googleWeb";

const DRIVE = "https://www.googleapis.com/auth/drive.appdata";

/**
 * O `google.accounts.oauth2` de mentira. `responder` decide o que a "janela" devolve
 * a cada pedido (chamado na hora, como o Google faz depois que a janela fecha).
 */
function googleDeMentira(responder: (config: { prompt?: string; login_hint?: string }, n: number) => RespostaToken | { erroJanela: string }) {
  const pedidos: { prompt?: string; login_hint?: string }[] = [];
  const revogados: string[] = [];
  let iniciado: { client_id: string; scope: string } | null = null;
  const oauth2: GoogleOauth2 = {
    initTokenClient(config) {
      iniciado = config;
      return {
        requestAccessToken(c = {}) {
          pedidos.push(c);
          const r = responder(c, pedidos.length);
          queueMicrotask(() => ("erroJanela" in r ? config.error_callback?.({ type: r.erroJanela }) : config.callback(r)));
        },
      };
    },
    revoke(token, feito) {
      revogados.push(token);
      feito?.();
    },
  };
  return { oauth2, pedidos, revogados, iniciado: () => iniciado };
}

const perfilOk = async () => Response.json({ name: "Dan", email: "dan@exemplo.com", picture: "https://foto/dan.jpg" });

function montar(g: ReturnType<typeof googleDeMentira>, extra: { relogio?: { t: number }; fetch?: typeof fetch; carregado?: boolean } = {}) {
  const relogio = extra.relogio ?? { t: 1_000_000 };
  let cargas = 0;
  const login = criarLoginGoogle({
    clienteId: "123-abc.apps.googleusercontent.com",
    carregar: async () => (cargas++, g.oauth2),
    jaCarregado: () => (extra.carregado ? g.oauth2 : null),
    fetch: (extra.fetch ?? perfilOk) as typeof fetch,
    agora: () => relogio.t,
  });
  return { login, relogio, cargas: () => cargas };
}

const tokenOk = (n: number): RespostaToken => ({ access_token: `tok${n}`, expires_in: 3599, scope: `openid email profile ${DRIVE}` });

describe("login Google da versão de navegador", () => {
  it("sem ID do cliente, fica indisponível e não carrega nada", async () => {
    let cargas = 0;
    const login = criarLoginGoogle({ clienteId: "", carregar: async () => (cargas++, googleDeMentira(tokenOk.bind(null, 1)).oauth2) });
    expect(login.disponivel()).toBe(false);
    await login.preparar();
    await expect(login.entrar()).rejects.toBeInstanceOf(AcessoNegado);
    expect(cargas).toBe(0);
  });

  it("entra, pede os escopos certos, guarda o acesso e lê nome, e-mail e foto", async () => {
    const g = googleDeMentira((_, n) => tokenOk(n));
    const { login, cargas } = montar(g);
    expect(cargas()).toBe(0); // nada fala com o Google antes de pedir
    const perfil = await login.entrar();
    expect(perfil).toEqual({ nome: "Dan", email: "dan@exemplo.com", foto: "https://foto/dan.jpg" });
    expect(g.iniciado()).toMatchObject({ client_id: "123-abc.apps.googleusercontent.com", scope: ESCOPOS });
    expect(g.pedidos[0].prompt).toBe("select_account");
    expect(await login.pegarToken()).toBe("tok1");
    expect(g.pedidos).toHaveLength(1); // ainda válido: não pede de novo
    expect(login.entrou()).toBe(true);
  });

  it("com o script já carregado, chama o Google na hora (dentro do toque, para o Safari)", () => {
    const g = googleDeMentira((_, n) => tokenOk(n));
    const { login } = montar(g, { carregado: true });
    void login.entrar({ dica: "dan@exemplo.com" });
    expect(g.pedidos).toEqual([{ prompt: "", login_hint: "dan@exemplo.com" }]);
  });

  it("quando vence, renova sem perguntar nada (prompt vazio, com a conta como dica)", async () => {
    const g = googleDeMentira((_, n) => tokenOk(n));
    const { login, relogio } = montar(g);
    await login.entrar();
    relogio.t += 3599 * 1000 - 60 * 1000; // falta 1 min: dentro da folga
    expect(await login.pegarToken()).toBe("tok2");
    expect(g.pedidos[1]).toEqual({ prompt: "", login_hint: "dan@exemplo.com" });
    // Vários pedidos ao mesmo tempo esperam a mesma renovação.
    relogio.t += 3600 * 1000;
    const [a, b] = await Promise.all([login.pegarToken(), login.pegarToken()]);
    expect([a, b]).toEqual(["tok3", "tok3"]);
    expect(g.pedidos).toHaveLength(3);
  });

  it("forcarNovo renova mesmo com o acesso ainda válido (o Drive recusou)", async () => {
    const g = googleDeMentira((_, n) => tokenOk(n));
    const { login } = montar(g);
    await login.entrar();
    expect(await login.pegarToken(true)).toBe("tok2");
  });

  it("se o Google exigir interação ou bloquear a janela, avisa 'precisa entrar de novo'", async () => {
    let modo: "ok" | "interacao" | "janela" = "ok";
    const g = googleDeMentira((_, n) => (modo === "ok" ? tokenOk(n) : modo === "interacao" ? { error: "interaction_required" } : { erroJanela: "popup_failed_to_open" }));
    const { login, relogio } = montar(g);
    await login.entrar();
    relogio.t += 2 * 3600 * 1000;
    modo = "interacao";
    const e1 = await login.pegarToken().catch((x: Error) => x);
    expect(e1).toBeInstanceOf(PrecisaEntrarDeNovo);
    expect(e1).toBeInstanceOf(AcessoNegado); // o maestro trata como acesso negado
    modo = "janela";
    await expect(login.pegarToken()).rejects.toBeInstanceOf(PrecisaEntrarDeNovo);
    // Um toque depois resolve.
    modo = "ok";
    await login.entrar({ dica: "dan@exemplo.com" });
    expect(await login.pegarToken()).toMatch(/^tok/);
  });

  it("antes de entrar, pegarToken pede para entrar", async () => {
    const { login } = montar(googleDeMentira((_, n) => tokenOk(n)));
    await expect(login.pegarToken()).rejects.toBeInstanceOf(PrecisaEntrarDeNovo);
  });

  it("janela bloqueada ou fechada na entrada: erros próprios para a tela explicar", async () => {
    const bloq = montar(googleDeMentira(() => ({ erroJanela: "popup_failed_to_open" }))).login;
    await expect(bloq.entrar()).rejects.toBeInstanceOf(JanelaBloqueada);
    const fechada = montar(googleDeMentira(() => ({ erroJanela: "popup_closed" }))).login;
    await expect(fechada.entrar()).rejects.toBeInstanceOf(EntradaCancelada);
    const negou = montar(googleDeMentira(() => ({ error: "access_denied" }))).login;
    await expect(negou.entrar()).rejects.toBeInstanceOf(EntradaCancelada);
    expect(negou.entrou()).toBe(false);
  });

  it("sem a permissão do Drive marcada: recusa, revoga e explica", async () => {
    const g = googleDeMentira(() => ({ access_token: "tokX", expires_in: 3599, scope: "openid email profile" }));
    const { login } = montar(g);
    const e = await login.entrar().catch((x: Error) => x);
    expect(e).toBeInstanceOf(AcessoNegado);
    expect((e as Error).message).toContain("permissão do Drive");
    expect(g.revogados).toEqual(["tokX"]);
    expect(login.entrou()).toBe(false);
  });

  it("script do Google sem internet: SemInternet", async () => {
    const login = criarLoginGoogle({ clienteId: "id", carregar: () => Promise.reject(new Error("falhou")) });
    await expect(login.entrar()).rejects.toBeInstanceOf(SemInternet);
  });

  it("sair revoga o acesso e esquece a conta", async () => {
    const g = googleDeMentira((_, n) => tokenOk(n));
    const { login } = montar(g);
    await login.entrar();
    await login.sair();
    expect(g.revogados).toEqual(["tok1"]);
    expect(login.perfil()).toBeNull();
    await expect(login.pegarToken()).rejects.toBeInstanceOf(PrecisaEntrarDeNovo);
  });
});
