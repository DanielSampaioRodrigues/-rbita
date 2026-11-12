// O cofre de valores (api.lerValor/gravarValor) só aceita nomes com letras minúsculas,
// números, ponto, hífen e sublinhado (regra do banco, em src-tauri/src/banco/valores.rs).
// Um nome com maiúscula falha em silêncio e nada fica guardado (já aconteceu com o aviso
// de dado sensível). Este teste confere os nomes escritos no código.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const c = join(pasta, nome);
    if (statSync(c).isDirectory()) return arquivos(c);
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [c] : [];
  });
}

describe("nomes de valores do cofre", () => {
  it("todos os nomes fixos usam só minúsculas, números, ponto, hífen e sublinhado", () => {
    const ruins: string[] = [];
    const padroes = [/(?:lerValor|gravarValor|apagarValor)\(\s*"([^"]+)"/g, /const CHAVE\s*=\s*"([^"]+)"/g, /(?:lerValor|gravarValor|apagarValor)\(\s*`([^`$]+)\$\{/g];
    for (const f of arquivos(__dirname)) {
      const texto = readFileSync(f, "utf8");
      for (const re of padroes) for (const m of texto.matchAll(re)) if (!/^[a-z0-9._-]+$/.test(m[1])) ruins.push(`${f.replace(__dirname, "")}: ${m[1]}`);
    }
    expect(ruins).toEqual([]);
  });
});
