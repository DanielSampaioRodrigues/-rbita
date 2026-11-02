import { describe, expect, it } from "vitest";
import { AcessoNegado, SemInternet } from "./armazenamento";
import { criarDriveRest, DriveOcupado } from "./driveRest";

interface Arq {
  id: string;
  name: string;
  conteudo: string;
  modifiedTime: string;
  version: string;
}

/** Um Drive de mentira, só com a pasta do app, que responde como a API REST v3. */
function driveDeMentira() {
  const arquivos = new Map<string, Arq>();
  const pedidos: { metodo: string; url: string; token: string }[] = [];
  /** Respostas forçadas para os próximos pedidos (erros, falta de rede). */
  const forcadas: (Response | "rede")[] = [];
  let relogio = Date.parse("2026-11-02T10:00:00Z");
  let proximoId = 1;
  const tokensValidos = new Set(["t1"]);

  const meta = (a: Arq) => ({ id: a.id, name: a.name, modifiedTime: a.modifiedTime, version: a.version });
  const tocar = (a: Arq) => {
    relogio += 1000;
    a.modifiedTime = new Date(relogio).toISOString();
    a.version = String(Number(a.version) + 1);
  };

  const fetch = async (entrada: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(entrada));
    const metodo = init.method ?? "GET";
    const token = ((init.headers as Record<string, string>)?.Authorization ?? "").replace("Bearer ", "");
    pedidos.push({ metodo, url: url.toString(), token });
    const f = forcadas.shift();
    if (f === "rede") throw new TypeError("Failed to fetch");
    if (f) return f;
    if (!tokensValidos.has(token)) return new Response('{"error":{"code":401}}', { status: 401 });

    const caminho = url.pathname;
    if (metodo === "GET" && caminho === "/drive/v3/files") {
      expect(url.searchParams.get("spaces")).toBe("appDataFolder");
      expect(url.searchParams.get("fields")).toContain("files(id,name,modifiedTime,version)");
      const q = url.searchParams.get("q") ?? "";
      const igual = /name = '((?:[^'\\]|\\.)*)'/.exec(q)?.[1]?.replace(/\\(.)/g, "$1");
      const contem = /name contains '((?:[^'\\]|\\.)*)'/.exec(q)?.[1]?.replace(/\\(.)/g, "$1");
      const files = [...arquivos.values()]
        .filter((a) => (igual === undefined || a.name === igual) && (contem === undefined || a.name.includes(contem)))
        .map(meta);
      return Response.json({ files });
    }
    const idMedia = /^\/drive\/v3\/files\/([^/]+)$/.exec(caminho)?.[1];
    if (metodo === "GET" && idMedia && url.searchParams.get("alt") === "media") {
      const a = [...arquivos.values()].find((x) => x.id === idMedia);
      return a ? new Response(a.conteudo) : new Response("", { status: 404 });
    }
    if (metodo === "DELETE" && idMedia) {
      const a = [...arquivos.values()].find((x) => x.id === idMedia);
      if (!a) return new Response("", { status: 404 });
      arquivos.delete(a.id);
      return new Response(null, { status: 204 });
    }
    if (metodo === "POST" && caminho === "/upload/drive/v3/files") {
      expect(url.searchParams.get("uploadType")).toBe("multipart");
      const tipo = (init.headers as Record<string, string>)["Content-Type"];
      const limite = /boundary=(.+)$/.exec(tipo)![1];
      const partes = String(init.body).split(`--${limite}`).slice(1, -1).map((p) => p.split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/\r\n$/, ""));
      const m = JSON.parse(partes[0]) as { name: string; parents: string[] };
      expect(m.parents).toEqual(["appDataFolder"]);
      const a: Arq = { id: `id${proximoId++}`, name: m.name, conteudo: partes[1], modifiedTime: "", version: "0" };
      tocar(a);
      arquivos.set(a.id, a);
      return Response.json(meta(a));
    }
    const idEnvio = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(caminho)?.[1];
    if (metodo === "PATCH" && idEnvio) {
      expect(url.searchParams.get("uploadType")).toBe("media");
      const a = [...arquivos.values()].find((x) => x.id === idEnvio);
      if (!a) return new Response("", { status: 404 });
      a.conteudo = String(init.body);
      tocar(a);
      return Response.json(meta(a));
    }
    return new Response("rota desconhecida", { status: 400 });
  };

  return { arquivos, pedidos, forcadas, fetch: fetch as typeof globalThis.fetch, tokensValidos };
}

function montar(d = driveDeMentira(), proximoToken = "t1") {
  const esperas: number[] = [];
  const renovacoes: boolean[] = [];
  let atual = "t1";
  const drive = criarDriveRest({
    fetch: d.fetch,
    esperar: async (ms) => void esperas.push(ms),
    pegarToken: async (forcar) => {
      renovacoes.push(!!forcar);
      if (forcar) atual = proximoToken;
      return atual;
    },
  });
  return { d, drive, esperas, renovacoes };
}

describe("adaptador do Google Drive", () => {
  it("cria, lista, baixa, substitui e apaga na pasta do app", async () => {
    const { d, drive } = montar();
    expect(await drive.listar()).toEqual([]);
    expect(await drive.baixar("chave.orbita-sync")).toBeNull();

    const a = await drive.enviar("aparelho-a.orbita-sync", "QUJD");
    expect(a.nome).toBe("aparelho-a.orbita-sync");
    await drive.enviar("chave.orbita-sync", "ZW52ZWxvcGU=");
    expect(d.arquivos.size).toBe(2);
    expect(await drive.baixar("aparelho-a.orbita-sync")).toBe("QUJD");

    // Substituir usa o id guardado (PATCH), sem criar outro arquivo.
    const b = await drive.enviar("aparelho-a.orbita-sync", "REVG");
    expect(d.arquivos.size).toBe(2);
    expect(b.versao).not.toBe(a.versao);
    expect(b.alteradoEm).toBeGreaterThan(a.alteradoEm);
    expect(d.pedidos.filter((p) => p.metodo === "PATCH")).toHaveLength(1);
    expect(await drive.baixar("aparelho-a.orbita-sync")).toBe("REVG");

    const lista = await drive.listar("aparelho-");
    expect(lista.map((x) => x.nome)).toEqual(["aparelho-a.orbita-sync"]);
    expect(lista[0].versao).toBe(b.versao);

    await drive.apagar("aparelho-a.orbita-sync");
    await drive.apagar("aparelho-a.orbita-sync"); // não falha se já não existe
    expect((await drive.listar()).map((x) => x.nome)).toEqual(["chave.orbita-sync"]);
  });

  it("o prefixo filtra pelo começo do nome, não só por 'contém'", async () => {
    const { drive } = montar();
    await drive.enviar("aparelho-1.orbita-sync", "a");
    await drive.enviar("anexo-aparelho-x.orbita-sync", "b");
    expect((await drive.listar("aparelho-")).map((x) => x.nome)).toEqual(["aparelho-1.orbita-sync"]);
  });

  it("acha arquivo criado por outro aparelho e substitui em vez de duplicar", async () => {
    const d = driveDeMentira();
    const outro = montar(d).drive;
    await outro.enviar("chave.orbita-sync", "v1");
    const { drive } = montar(d);
    await drive.enviar("chave.orbita-sync", "v2");
    expect(d.arquivos.size).toBe(1);
    expect(await outro.baixar("chave.orbita-sync")).toBe("v2");
  });

  it("se outro aparelho apagou o arquivo, enviar cria de novo e baixar devolve null", async () => {
    const d = driveDeMentira();
    const { drive } = montar(d);
    await drive.enviar("aparelho-a.orbita-sync", "v1");
    d.arquivos.clear();
    expect(await drive.baixar("aparelho-a.orbita-sync")).toBeNull();
    await drive.enviar("aparelho-a.orbita-sync", "v2");
    d.arquivos.clear();
    await drive.enviar("aparelho-a.orbita-sync", "v3");
    expect([...d.arquivos.values()].map((a) => a.conteudo)).toEqual(["v3"]);
  });

  it("acesso recusado (401): renova o acesso uma vez e segue", async () => {
    const d = driveDeMentira();
    d.tokensValidos.clear();
    d.tokensValidos.add("t2");
    const { drive, renovacoes } = montar(d, "t2");
    await drive.enviar("chave.orbita-sync", "x");
    expect(renovacoes).toEqual([false, true, false]);
    expect(d.pedidos.at(-1)!.token).toBe("t2");
  });

  it("recusa mesmo depois de renovar: AcessoNegado, com o motivo em linguagem simples", async () => {
    const d = driveDeMentira();
    d.tokensValidos.clear();
    const { drive } = montar(d, "t-ainda-ruim");
    await expect(drive.listar()).rejects.toBeInstanceOf(AcessoNegado);

    const e = driveDeMentira();
    const corpo = '{"error":{"code":403,"errors":[{"reason":"insufficientPermissions"}]}}';
    e.forcadas.push(new Response(corpo, { status: 403 }), new Response(corpo, { status: 403 }));
    const erro = await montar(e).drive.listar().catch((x: Error) => x);
    expect(erro).toBeInstanceOf(AcessoNegado);
    expect((erro as Error).message).toContain("permissão do Drive ficou desmarcada");
  });

  it("sem internet: SemInternet", async () => {
    const d = driveDeMentira();
    d.forcadas.push("rede");
    await expect(montar(d).drive.baixar("chave.orbita-sync")).rejects.toBeInstanceOf(SemInternet);
  });

  it("429 e 5xx: espera um pouco e tenta de novo (no máximo 3 vezes)", async () => {
    const d = driveDeMentira();
    d.forcadas.push(new Response("", { status: 429 }), new Response("", { status: 503 }));
    const { drive, esperas } = montar(d);
    await drive.enviar("chave.orbita-sync", "x");
    expect(esperas).toEqual([500, 1500]);
    expect(d.arquivos.size).toBe(1);

    const e = driveDeMentira();
    e.forcadas.push(new Response("", { status: 429, headers: { "Retry-After": "2" } }));
    const m = montar(e);
    await m.drive.listar();
    expect(m.esperas).toEqual([2000]);

    const f = driveDeMentira();
    for (let i = 0; i < 4; i++) f.forcadas.push(new Response("", { status: 500 }));
    const n = montar(f);
    const erro = await n.drive.listar().catch((x: Error) => x);
    expect(erro).toBeInstanceOf(DriveOcupado);
    expect(erro).toBeInstanceOf(SemInternet); // o maestro trata como "tente mais tarde"
    expect(n.esperas).toHaveLength(3);
  });

  it("403 de limite de uso conta como 'espere', não como acesso negado", async () => {
    const d = driveDeMentira();
    d.forcadas.push(new Response('{"error":{"errors":[{"reason":"userRateLimitExceeded"}]}}', { status: 403 }));
    const { drive, esperas, renovacoes } = montar(d);
    await drive.listar();
    expect(esperas).toEqual([500]);
    expect(renovacoes).toEqual([false]);
  });

  it("dois envios seguidos do mesmo nome não criam arquivos repetidos", async () => {
    const { d, drive } = montar();
    await Promise.all([drive.enviar("chave.orbita-sync", "1"), drive.enviar("chave.orbita-sync", "2")]);
    expect(d.arquivos.size).toBe(1);
    expect([...d.arquivos.values()][0].conteudo).toBe("2");
  });

  it("nomes com aspas não quebram a consulta", async () => {
    const { drive } = montar();
    await drive.enviar("nome'estranho.orbita-sync", "z");
    expect(await drive.baixar("nome'estranho.orbita-sync")).toBe("z");
  });
});
