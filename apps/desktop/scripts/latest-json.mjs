// Monta o latest.json que o Órbita consulta para saber se há versão nova.
// Uso: node latest-json.mjs <versão> <endereço do instalador> <arquivo .sig> <notas.md>
import { readFileSync } from "node:fs";

const [versao, url, assinatura, notas] = process.argv.slice(2);
if (!versao || !url || !assinatura || !notas) {
  console.error("Uso: node latest-json.mjs <versão> <url> <arquivo .sig> <notas.md>");
  process.exit(1);
}
const json = {
  version: versao,
  notes: readFileSync(notas, "utf8").trim(),
  pub_date: new Date().toISOString(),
  platforms: { "windows-x86_64": { signature: readFileSync(assinatura, "utf8").trim(), url } },
};
process.stdout.write(JSON.stringify(json, null, 2));
