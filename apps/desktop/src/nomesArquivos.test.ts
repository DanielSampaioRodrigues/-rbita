// No Windows, "contas.ts" e "Contas.tsx" na mesma pasta são o mesmo nome para o
// sistema de arquivos e quebram o build do instalador (aqui no Linux passam).
// Este teste barra a colisão antes de ela chegar ao Windows.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function colisoes(pasta: string): string[] {
  const achadas: string[] = [];
  const vistos = new Map<string, string>();
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) {
      achadas.push(...colisoes(caminho));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(nome)) continue;
    const chave = nome.replace(/\.(test\.)?(ts|tsx)$/, (_m, t) => (t ? ".test" : "")).toLowerCase();
    const outro = vistos.get(chave);
    if (outro && outro !== nome) achadas.push(`${join(pasta, outro)} x ${nome}`);
    else vistos.set(chave, nome);
  }
  return achadas;
}

describe("nomes de arquivo", () => {
  it("não há dois arquivos .ts/.tsx com o mesmo nome ignorando maiúsculas (quebra no Windows)", () => {
    expect(colisoes(__dirname)).toEqual([]);
  });
});
