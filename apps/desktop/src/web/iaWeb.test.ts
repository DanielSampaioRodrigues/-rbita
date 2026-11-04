import { describe, expect, it, vi } from "vitest";
import { enviarPedido, rodarIa, type MotorIa, type PedidoIa } from "./iaWeb";

const pedido = (extra: Partial<PedidoIa> = {}): PedidoIa => ({
  metodo: "POST",
  url: "https://api.exemplo.com/v1/chat/completions",
  cabecalhos: [["authorization", "Bearer sk-segredo"], ["content-type", "application/json"]],
  corpo: '{"model":"x"}',
  binario: false,
  local: false,
  ...extra,
});

/** Motor de mentira: um pedido e depois o resultado com o que o provedor respondeu. */
function motorDeMentira(): MotorIa & { respostas: string[] } {
  const respostas: string[] = [];
  return {
    respostas,
    ia_avancar: (_comando, _args, resposta) => {
      if (!resposta) return JSON.stringify({ tipo: "pedir", pedido: pedido(), etapa: 0 });
      respostas.push(resposta);
      return JSON.stringify({ tipo: "pronto", valor: JSON.parse(resposta) });
    },
    ia_falha_de_rede: (url, local, demorou, semInternet) => JSON.stringify({ codigo: "ia", mensagem: `falhou ${url} ${local} ${demorou} ${semInternet}`, motivo: "rede" }),
  };
}

describe("IA no navegador", () => {
  it("envia o pedido do motor e devolve a resposta a ele", async () => {
    const motor = motorDeMentira();
    const buscar = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    const valor = await rodarIa<{ etapa: number; situacao: number; corpo: string }>(motor, "organizar_texto_ia", { texto: "oi" }, buscar);
    expect(valor).toEqual({ etapa: 0, situacao: 200, corpo: '{"choices":[]}' });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.exemplo.com/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual([["authorization", "Bearer sk-segredo"], ["content-type", "application/json"]]);
    expect(init.credentials).toBe("omit");
    expect(init.body).toBe('{"model":"x"}');
  });

  it("situação de erro do provedor volta ao motor, que explica", async () => {
    const motor = motorDeMentira();
    await rodarIa(motor, "x", {}, async () => new Response('{"error":{}}', { status: 401 }));
    expect(JSON.parse(motor.respostas[0]).situacao).toBe(401);
  });

  it("pedido que nem chega vira o erro explicado pelo motor (bloqueio do navegador ou sem internet)", async () => {
    const motor = motorDeMentira();
    const falha = enviarPedido(pedido({ url: "https://chat.maritaca.ai/api/chat/completions" }), motor, async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(falha).rejects.toBe(JSON.stringify({ codigo: "ia", mensagem: "falhou https://chat.maritaca.ai/api/chat/completions false false false", motivo: "rede" }));
  });

  it("demora demais vira o aviso de demora", async () => {
    const motor = motorDeMentira();
    const buscar = (_u: string, init: RequestInit) =>
      new Promise<Response>((_, rejeitar) => init.signal?.addEventListener("abort", () => rejeitar(new DOMException("abortado", "AbortError"))));
    await expect(enviarPedido(pedido({ local: true }), motor, buscar, 10)).rejects.toContain("true true false");
  });

  it("imagem baixada volta em base64", async () => {
    const motor = motorDeMentira();
    const r = await enviarPedido(pedido({ metodo: "GET", binario: true, corpo: null, cabecalhos: [] }), motor, async () => new Response(new Uint8Array([65, 66, 67])));
    expect(r).toEqual({ situacao: 200, corpo: "QUJD" });
  });
});
