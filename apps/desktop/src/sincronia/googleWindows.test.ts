import { describe, expect, it } from "vitest";
import { AcessoNegado, SemInternet } from "./armazenamento";
import { tokenDoWindows } from "./googleWindows";

describe("acesso ao Drive no Windows", () => {
  it("guarda o acesso até perto de vencer e renova quando pedem", async () => {
    const relogio = { t: 0 };
    let n = 0;
    const pegar = tokenDoWindows(async (c) => {
      expect(c).toBe("nuvem_token_google");
      n++;
      return { token: `t${n}`, expiraEm: relogio.t + 3600_000 };
    }, () => relogio.t);
    expect(await pegar()).toBe("t1");
    expect(await pegar()).toBe("t1");
    relogio.t += 3590_000;
    expect(await pegar()).toBe("t2");
    expect(await pegar(true)).toBe("t3");
  });

  it("traduz os erros do lado nativo", async () => {
    const com = (e: unknown) => tokenDoWindows(() => Promise.reject(e))();
    await expect(com({ codigo: "nuvem", motivo: "rede", mensagem: "x" })).rejects.toBeInstanceOf(SemInternet);
    await expect(com({ codigo: "nuvem", motivo: "acesso", mensagem: "expirou" })).rejects.toBeInstanceOf(AcessoNegado);
    await expect(com({ codigo: "nuvem", motivo: "desligada", mensagem: "sem conta" })).rejects.toBeInstanceOf(AcessoNegado);
    await expect(com({ codigo: "bloqueado", mensagem: "trancado" })).rejects.toBeInstanceOf(AcessoNegado);
  });
});
