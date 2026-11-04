// Teste da IA na versão de navegador (iPad), na interface real, com Playwright.
// O provedor é de mentira: o Playwright responde no lugar da Anthropic e da
// Maritaca, então nada sai da máquina e nenhuma chave de verdade é usada.
//
// COMO USAR (o script NÃO monta o app; só serve o que já foi montado):
//   cd apps/desktop
//   pnpm motor && rm -rf dist-web && VITE_ORBITA_WEB=1 pnpm exec vite build
//   node scripts/teste-web-ia.cjs          (opções: --porta 8781, --mostrar)
//
// O roteiro: cria o cofre com PIN; cadastra o Claude em Ajustes (conferir a chave
// = pedir a lista de modelos); cria um projeto e usa "Planejar com a IA" até a
// proposta aparecer; usa "Separar com IA" na captura; confere que a chave foi nos
// cabeçalhos certos (com o aviso de navegador da Anthropic) e não apareceu na tela;
// confere a mensagem do Sabiá quando o provedor bloqueia o navegador.
// Termina com código 1 se algo falhou.

const http = require("http");
const fs = require("fs");
const path = require("path");

let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require("/opt/node-tools/node_modules/playwright");
}

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : padrao;
};
const PORTA = Number(arg("--porta", "8781"));
const MOSTRAR = process.argv.includes("--mostrar");
const DIST = path.resolve(__dirname, "../dist-web");
const URL_APP = `http://localhost:${PORTA}/`;
const PIN = "2580";
const CHAVE = "sk-ant-teste-1234567890-ABCD";

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error(`Não achei ${DIST}/index.html. Monte antes: pnpm motor && VITE_ORBITA_WEB=1 pnpm exec vite build`);
  process.exit(2);
}

const TIPOS = { ".wasm": "application/wasm", ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const servidor = http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split("?")[0]);
  if (u.endsWith("/")) u += "index.html";
  const f = path.join(DIST, u);
  if (!f.startsWith(DIST)) return s.writeHead(403), s.end();
  fs.readFile(f, (e, d) => {
    if (e) return s.writeHead(404), s.end();
    s.writeHead(200, { "content-type": TIPOS[path.extname(f)] || "application/octet-stream" });
    s.end(d);
  });
});

const falhas = [];
const erros = [];
let etapa = "início";
const passo = (nome) => {
  etapa = nome;
  console.log(`· ${nome}`);
};
const falhar = (msg) => {
  falhas.push(`[${etapa}] ${msg}`);
  console.log(`  ✗ ${msg}`);
};
const espera = (p, ms = 500) => p.waitForTimeout(ms);
const main = (p) => p.locator("main");
const dialogo = (p, nome) => (nome ? p.getByRole("dialog", { name: nome }) : p.getByRole("dialog"));
async function ir(p, modulo) {
  await p.locator("nav").getByRole("link", { name: modulo, exact: true }).or(p.locator("nav").getByRole("button", { name: modulo, exact: true })).first().click();
  await espera(p, 600);
}

// ── O provedor de mentira ────────────────────────────────────────────────────
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, OPTIONS" };
const pedidos = [];
async function anthropic(route) {
  const q = route.request();
  if (q.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
  const cab = q.headers();
  pedidos.push({ url: q.url(), metodo: q.method(), cab, corpo: q.postData() });
  const json = (corpo) => route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(corpo) });
  if (cab["x-api-key"] !== CHAVE) return route.fulfill({ status: 401, headers: CORS, body: '{"error":{"message":"invalid x-api-key"}}' });
  if (q.url().includes("/v1/models")) return json({ data: [{ id: "claude-opus-5-5" }, { id: "claude-haiku-5-5" }] });
  const corpo = JSON.parse(q.postData() || "{}");
  const texto = corpo.system?.includes("Proponha etapas")
    ? JSON.stringify({ explicacao: "Duas etapas para começar.", etapas: [{ titulo: "Separar as caixas", subtarefas: ["Comprar fita", "Montar as caixas"] }, { titulo: "Contratar o caminhão", subtarefas: ["Pedir três orçamentos"] }] })
    : corpo.system?.includes("Separe o texto em itens")
      ? JSON.stringify({ itens: [{ tipo: "ideia", texto: "Escrever um livro" }, { tipo: "tarefa", texto: "Comprar fita", projeto: "Mudança" }] })
      : "Texto.";
  return json({ content: [{ type: "text", text: texto }], stop_reason: "end_turn" });
}

(async () => {
  await new Promise((r) => servidor.listen(PORTA, r));
  const nav = await playwright.chromium.launch({ headless: !MOSTRAR });
  const ctx = await nav.newContext({ viewport: { width: 1180, height: 820 } });
  await ctx.route("https://api.anthropic.com/**", anthropic);
  // A Maritaca recusa pedidos de página (CORS): imitado com a conexão abortada.
  await ctx.route("https://chat.maritaca.ai/**", (route) => route.abort("failed"));
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::/.test(m.text()) && erros.push(`[${etapa}] console: ${m.text()}`));
  p.on("pageerror", (e) => erros.push(`[${etapa}] página: ${e}`));

  try {
    passo("criar o cofre com PIN");
    await p.goto(URL_APP);
    await espera(p, 1500);
    const semConta = p.getByRole("button", { name: "Usar sem conta" });
    if (await semConta.isVisible().catch(() => false)) await semConta.click();
    else await p.getByRole("button", { name: "Começar" }).click();
    await espera(p, 300);
    await p.getByRole("button", { name: "Continuar" }).click();
    await espera(p, 300);
    const pins = p.locator("input[type=password]");
    await pins.nth(0).fill(PIN);
    await pins.nth(1).fill(PIN);
    await p.getByRole("button", { name: "Continuar" }).click();
    await p.getByText("Guarde sua chave de recuperação").waitFor({ timeout: 20000 });
    await p.getByRole("button", { name: "Pronto, abrir o Órbita" }).click();
    await espera(p, 2000);
    const naoMostrar = p.getByRole("button", { name: "Não mostrar mais" });
    if (await naoMostrar.count()) await naoMostrar.first().click();

    passo("Ajustes > IA: o Sabiá bloqueado pelo navegador tem explicação clara");
    await ir(p, "Ajustes");
    await main(p).locator("button", { hasText: "Inteligência artificial" }).first().click();
    await espera(p, 700);
    await main(p).getByRole("button", { name: "Adicionar provedor" }).click();
    let d = dialogo(p, "Adicionar provedor de IA");
    await d.getByRole("radio", { name: "Sabiá" }).check({ force: true });
    await espera(p, 300);
    if (!(await d.innerText()).includes("pode não aceitar ser chamado pelo navegador")) falhar("a janela não avisa sobre o Sabiá no navegador");
    await d.getByLabel("Chave da API").fill("chave-sabia");
    await d.getByRole("button", { name: "Conferir e ver os modelos" }).click();
    await espera(p, 1500);
    if (!(await d.innerText()).includes("Este provedor não aceita ser chamado pelo navegador")) falhar(`o erro do Sabiá não explica o bloqueio: ${(await d.innerText()).slice(0, 400)}`);

    passo("Ajustes > IA: cadastrar o Claude (a conferência vai pelo navegador)");
    await d.getByRole("radio", { name: "Claude" }).check({ force: true });
    await espera(p, 300);
    await d.getByLabel("Chave da API").fill(CHAVE);
    await d.getByRole("button", { name: "Conferir e ver os modelos" }).click();
    await espera(p, 1500);
    if (!(await d.innerText()).includes("2")) falhar("a conferência não mostrou os modelos");
    await d.getByRole("button", { name: "Salvar" }).click();
    await espera(p, 1000);
    const ajustes = await main(p).innerText();
    if (!ajustes.includes("ABCD")) falhar("o provedor salvo não mostra o fim da chave");
    if (ajustes.includes(CHAVE)) falhar("a chave inteira apareceu na tela");
    const modelos = pedidos.find((x) => x.url.includes("/v1/models"));
    if (!modelos) falhar("nenhum pedido de modelos chegou ao provedor");
    else if (modelos.cab["anthropic-dangerous-direct-browser-access"] !== "true") falhar("faltou o aviso de navegador da Anthropic");

    passo("Projetos: Planejar com a IA até a proposta");
    await ir(p, "Projetos");
    await p.getByRole("button", { name: "Novo projeto" }).click();
    await dialogo(p).getByLabel("Nome do projeto").fill("Mudança");
    await dialogo(p).getByRole("button", { name: "Criar" }).click();
    await espera(p, 1000);
    const botao = main(p).getByRole("button", { name: "Planejar com a IA" }).first();
    await botao.waitFor({ timeout: 5000 }).catch(() => falhar("o botão Planejar com a IA não apareceu"));
    await botao.click();
    await espera(p, 500);
    d = dialogo(p, "Planejar com a IA: Mudança");
    await d.getByLabel("O que você quer contar sobre o projeto?").fill("Vou mudar de casa em dezembro");
    await d.getByRole("button", { name: "Enviar" }).click();
    await d.getByText("Separar as caixas").first().waitFor({ timeout: 10000 }).catch(() => falhar("a proposta não apareceu"));
    const plano = pedidos.filter((x) => x.metodo === "POST").pop();
    if (!plano?.corpo?.includes("Vou mudar de casa em dezembro") || !plano.corpo.includes("Mudança")) falhar("o pedido não levou o projeto e a conversa");
    await d.getByRole("button", { name: "Aprovar e criar" }).click();
    await espera(p, 1500);
    await d.getByRole("button", { name: "Fechar" }).first().click();
    await espera(p, 800);
    if (!(await main(p).innerText()).includes("Contratar o caminhão")) falhar("as etapas aprovadas não foram criadas no projeto");

    passo("Capturar > Separar com IA");
    await p.getByRole("button", { name: "Capturar" }).first().click();
    await espera(p, 800);
    d = dialogo(p, "Capturar");
    await d.getByLabel("O que você quer guardar?").fill("tive uma ideia de livro e preciso comprar fita");
    await d.getByRole("button", { name: "Separar com IA" }).click();
    // Depois de separar, a janela troca de título: procura na janela aberta.
    await p.waitForFunction(() => [...document.querySelectorAll("[role=dialog] input, [role=dialog] textarea")].some((c) => c.value === "Escrever um livro") || document.querySelector("[role=dialog]")?.innerText.includes("Escrever um livro"), null, { timeout: 10000 }).catch(async () => falhar(`a lista separada não apareceu: ${(await dialogo(p).innerText().catch(() => "")).slice(0, 400)}`));

    if (!pedidos.every((x) => x.cab["x-api-key"] === CHAVE)) falhar("algum pedido saiu sem a chave certa");
  } catch (e) {
    falhar(`parou: ${e.message.split("\n")[0]}`);
    await p.screenshot({ path: path.join(require("os").tmpdir(), "orbita-teste-web-ia.png") }).catch(() => {});
  }

  await nav.close();
  servidor.close();
  console.log(`\nPedidos ao provedor de mentira: ${pedidos.length}`);
  for (const e of erros) console.log(`  erro: ${e}`);
  if (falhas.length || erros.length) {
    console.log(`\n${falhas.length} falha(s), ${erros.length} erro(s) de página.`);
    process.exit(1);
  }
  console.log("\nTudo certo.");
})();
