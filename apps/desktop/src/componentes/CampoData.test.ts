import { describe, expect, it } from "vitest";
import { dataPronta } from "./CampoData";

describe("dataPronta", () => {
  it("aceita vazio (apagar a data) e datas completas", () => {
    expect(dataPronta("")).toBe(true);
    expect(dataPronta("2026-11-02")).toBe(true);
  });
  it("ignora o ano pela metade, enquanto a pessoa digita", () => {
    expect(dataPronta("0002-11-02")).toBe(false);
    expect(dataPronta("0020-11-02")).toBe(false);
    expect(dataPronta("0202-11-02")).toBe(false);
  });
  it("ignora ano de 5 ou 6 dígitos", () => {
    expect(dataPronta("275760-11-02")).toBe(false);
    expect(dataPronta("20261-11-02")).toBe(false);
  });
});
