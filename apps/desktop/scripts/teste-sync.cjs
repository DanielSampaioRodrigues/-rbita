// Teste de ponta a ponta da sincronização (etapa 2b): dois navegadores separados (dois
// contextos do Playwright, que não dividem nada) trocando arquivos pela pasta de mentira.
//
// COMO USAR (o script NÃO monta o app; só serve o que já foi montado):
//   cd apps/desktop
//   pnpm motor && rm -rf dist-web && VITE_ORBITA_WEB=1 pnpm exec vite build
//   node scripts/teste-sync.cjs            (opções: --porta 8781, --mostrar)
//
// O roteiro: cria um cofre em cada navegador (com ?sync-teste: a pasta é a de
// scripts/pasta-teste.cjs, servida aqui mesmo); liga a sincronização no A com uma senha e
// entra no B com a mesma senha; ideia criada no A aparece no B; editada no B muda no A;
// apagada no A some no B; imagem anexada viaja; bloqueado não sincroniza e, ao abrir,
// busca; sem internet e acesso negado mostram o aviso certo e depois recuperam.
// Termina com código 1 se algo falhou.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { criarPasta } = require("./pasta-teste.cjs");

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
const CAPTURAS = arg("--capturas", null); // pasta para salvar capturas de tela do aviso
const DIST = path.resolve(__dirname, "../dist-web");
const URL_APP = `http://localhost:${PORTA}/?sync-teste`;
const PIN = "2580";
const SENHA_SYNC = "senha de sincronia comprida";
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPhfDwAFhAJ/wlseKgAAAABJRU5ErkJggg==";

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error(`Não achei ${DIST}/index.html. Monte antes: pnpm motor && VITE_ORBITA_WEB=1 pnpm exec vite build`);
  process.exit(2);
}

const pasta = criarPasta();
const TIPOS = { ".wasm": "application/wasm", ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const servidor = http.createServer((q, s) => {
  if (pasta.atender(q, s)) return;
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

const erros = [];
const falhas = [];
let etapa = "início";
const passo = (nome) => ((etapa = nome), console.log(`· ${nome}`));
const ok = (c, m) => (c ? console.log(`  ✓ ${m}`) : (falhas.push(`[${etapa}] ${m}`), console.log(`  ✗ ${m}`)));
const espera = (p, ms = 500) => p.waitForTimeout(ms);

/** Chama o gancho do modo de teste (window.__orbitaSincronia) dentro da página. */
const sinc = (p, f, ...args) =>
  p.evaluate(async ([fs, args]) => {
    const s = window.__orbitaSincronia;
    if (!s) throw new Error("sem o gancho de teste da sincronização");
    return await new Function("s", "api", "args", `return (${fs})(s, api, ...args)`)(s, s.api, args);
  }, [f.toString(), args]);

const aviso = (p) => p.locator(".sinc-botao .sinc-texto");
async function esperarAviso(p, re, ms = 15000) {
  const fim = Date.now() + ms;
  let t = "";
  while (Date.now() < fim) {
    t = (await aviso(p).count()) ? await aviso(p).innerText() : "";
    if (re.test(t)) return t;
    await espera(p, 250);
  }
  return t;
}
async function sincronizarAgora(p) {
  await p.locator(".sinc-botao").click();
  const b = p.getByRole("button", { name: "Sincronizar agora" });
  await b.waitFor({ timeout: 5000 });
  await b.click();
  await p.getByRole("button", { name: "Sincronizar agora" }).waitFor({ timeout: 15000 }); // volta quando termina
  await p.keyboard.press("Escape");
  await espera(p, 400);
}
async function ir(p, modulo) {
  await p.locator("nav").getByRole("button", { name: modulo, exact: true }).first().click();
  await espera(p, 600);
}
async function textoMainTem(p, texto, ms = 8000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if ((await p.locator("main").innerText()).includes(texto)) return true;
    await espera(p, 250);
  }
  return false;
}
async function textoMainSemIsso(p, texto, ms = 8000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (!(await p.locator("main").innerText()).includes(texto)) return true;
    await espera(p, 250);
  }
  return false;
}
async function criarCofre(p) {
  await p.getByRole("button", { name: "Começar" }).click();
  await espera(p, 300);
  await p.getByRole("button", { name: "Continuar" }).click();
  await espera(p, 300);
  const pins = p.locator("input[type=password]");
  await pins.nth(0).fill(PIN);
  await pins.nth(1).fill(PIN);
  await p.getByRole("button", { name: "Continuar" }).click();
  await p.getByText("Guarde sua chave de recuperação").waitFor({ timeout: 30000 });
  await p.getByRole("button", { name: "Pronto, abrir o Órbita" }).click();
  await espera(p, 2000);
  const n = p.getByRole("button", { name: "Não mostrar mais" });
  if (await n.count()) await n.first().click();
}
const versaoNaPasta = (nome) => pasta.arquivos.get(nome)?.versao ?? null;

(async () => {
  await new Promise((r) => servidor.listen(PORTA, r));
  const navegador = await playwright.chromium.launch({ headless: !MOSTRAR });
  const pags = [];
  for (const nome of ["A", "B"]) {
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    p.on("console", (m) => {
      // As respostas 503/401 da pasta são de propósito (sem internet, acesso negado).
      if (m.type() === "error" && !(m.location()?.url ?? "").includes("/__pasta-teste/")) erros.push(`${nome} [${etapa}] console: ${m.text()}`);
    });
    p.on("pageerror", (e) => erros.push(`${nome} [${etapa}] página: ${e}`));
    pags.push(p);
  }
  const [A, B] = pags;
  try {
    passo("criar os dois cofres (modo de teste da sincronização)");
    for (const p of pags) {
      await p.goto(URL_APP);
      await espera(p, 2500);
      await criarCofre(p);
    }
    ok(await A.evaluate(() => !!window.__orbitaSincronia), "gancho de teste presente no A");
    ok((await aviso(A).count()) === 0, "sem a sincronização ligada, o aviso não aparece");

    passo("ligar no A com a senha; entrar no B com a mesma senha");
    await sinc(A, (s, api, senha) => s.ligarComoPrimeiro(senha), SENHA_SYNC);
    ok(/Sincronizado agora/.test(await esperarAviso(A, /Sincronizado/)), "A mostra \"Sincronizado agora\"");
    ok(pasta.arquivos.has("chave.orbita-sync"), "envelope da chave na pasta");
    const idA = await sinc(A, (s, api) => api.sincroniaSituacao().then((x) => x.aparelho));
    const idB = await sinc(B, (s, api) => api.sincroniaSituacao().then((x) => x.aparelho));
    ok(pasta.arquivos.has(`aparelho-${idA}.orbita-sync`), "retrato do A na pasta");
    const entrou = await sinc(B, (s, api, senha) => s.entrarComSenha(senha), SENHA_SYNC);
    ok(entrou === true, "B entrou com a senha");
    ok(/Sincronizado/.test(await esperarAviso(B, /Sincronizado/)), "B mostra o aviso de sincronizado");
    ok(pasta.arquivos.has(`aparelho-${idB}.orbita-sync`), "retrato do B na pasta");
    ok((await A.locator(".sinc-aviso [role=status][aria-live=polite]").count()) === 1, "aviso tem role=status e aria-live polite");
    for (const p of pags) await ir(p, "Ideias");

    passo("ideia criada no A (pela tela) aparece no B");
    const antes = versaoNaPasta(`aparelho-${idA}.orbita-sync`);
    await A.getByLabel("O que você quer guardar?").fill("Ideia que viaja do A");
    await A.keyboard.press("Enter");
    let mandou = false;
    for (let i = 0; i < 40 && !mandou; i++) (await espera(A, 250), (mandou = versaoNaPasta(`aparelho-${idA}.orbita-sync`) !== antes));
    ok(mandou, "A mandou sozinho uns 3 s depois da mudança");
    await sincronizarAgora(B);
    ok(await textoMainTem(B, "Ideia que viaja do A"), "a ideia aparece na tela do B (sem recarregar)");

    passo("editada no B muda no A (A busca ao voltar para o app)");
    const id = await sinc(B, (s, api) => api.listarIdeias().then((l) => l.find((i) => i.texto === "Ideia que viaja do A").id));
    await sinc(B, (s, api, id) => api.editarIdeia(id, "Ideia editada no B"), id);
    await sinc(B, (s) => s.sincronizarAgora());
    await espera(A, 5500); // a folga de "voltar para o app" (5 s desde o último pedido)
    await A.evaluate(() => window.dispatchEvent(new Event("focus")));
    ok(await textoMainTem(A, "Ideia editada no B"), "A mostra a edição do B");

    passo("apagada no A some no B");
    await sinc(A, (s, api, id) => api.excluirItem(id), id);
    await sincronizarAgora(A);
    await sincronizarAgora(B);
    ok(await textoMainSemIsso(B, "Ideia editada no B"), "a ideia sumiu da tela do B");

    passo("imagem anexada no A chega no B");
    const anexo = await sinc(A, async (s, api, png) => {
      const i = await api.criarIdeia("Ideia com imagem");
      const a = await api.anexarBytes(i.id, "foto.png", png);
      return { item: i.id, anexo: a.id, url: await api.imagemAnexo(a.id) };
    }, PNG);
    await sincronizarAgora(A);
    ok([...pasta.arquivos.keys()].some((n) => n.startsWith("anexo-")), "conteúdo do anexo na pasta (trancado)");
    ok(!pasta.arquivos.get([...pasta.arquivos.keys()].find((n) => n.startsWith("anexo-"))).conteudo.includes(PNG.slice(0, 20)), "o conteúdo na pasta não é a imagem aberta");
    await sincronizarAgora(B);
    const urlB = await sinc(B, (s, api, a) => api.imagemAnexo(a).catch((e) => "erro: " + e.message), anexo.anexo);
    ok(urlB === anexo.url, "B mostra a mesma imagem");
    ok((await sinc(B, (s, api) => api.sincroniaMarca())).faltam.length === 0, "nada faltando no B");
    ok(await textoMainTem(B, "Ideia com imagem"), "a ideia com imagem aparece no B");

    passo("bloqueado não sincroniza; ao abrir, busca");
    await B.locator("button.lateral-item", { hasText: "Bloquear" }).click();
    await espera(B, 1500);
    await sinc(A, (s, api) => api.criarIdeia("Feita com o B bloqueado"));
    await sincronizarAgora(A);
    await B.getByLabel("PIN").fill(PIN);
    await B.getByRole("button", { name: "Entrar" }).click();
    await espera(B, 2000);
    await ir(B, "Ideias");
    ok(await textoMainTem(B, "Feita com o B bloqueado"), "B busca ao abrir de novo");

    passo("sem internet: aviso certo, guarda e manda depois");
    pasta.estado.semInternet = true;
    await sinc(A, (s, api) => api.criarIdeia("Feita sem internet"));
    await sincronizarAgora(A);
    if (CAPTURAS) await A.screenshot({ path: path.join(CAPTURAS, "sync-sem-internet.png") });
    ok((await esperarAviso(A, /Sem internet/)) === "Sem internet: guardado neste aparelho", "A mostra \"Sem internet: guardado neste aparelho\"");
    ok(await A.getByRole("status").filter({ hasText: "Sem internet" }).count() === 1, "o leitor de tela recebe o aviso");
    pasta.estado.semInternet = false;
    await sincronizarAgora(A);
    ok(/Sincronizado agora/.test(await esperarAviso(A, /Sincronizado/)), "A volta para \"Sincronizado agora\"");
    await sincronizarAgora(B);
    ok(await textoMainTem(B, "Feita sem internet"), "o que foi feito sem internet chega no B");

    passo("acesso negado pede para entrar de novo");
    pasta.estado.negado = true;
    await sincronizarAgora(B);
    ok((await esperarAviso(B, /entrar de novo/)) === "Precisa entrar de novo na conta", "B mostra \"Precisa entrar de novo na conta\"");
    pasta.estado.negado = false;
    await sincronizarAgora(B);
    ok(/Sincronizado/.test(await esperarAviso(B, /Sincronizado/)), "B recupera");

    passo("teclado: o aviso recebe foco e abre o painel");
    await A.locator(".sinc-botao").focus();
    await A.keyboard.press("Enter");
    ok(await A.getByRole("dialog", { name: "Sincronização entre aparelhos" }).isVisible(), "painel abre pelo teclado");
    if (CAPTURAS) await A.screenshot({ path: path.join(CAPTURAS, "sync-painel.png") });
    ok((await A.getByRole("dialog").innerText()).includes("Última vez: hoje às"), "painel mostra a última vez");
    await A.keyboard.press("Escape");

    passo("os dois ficam iguais");
    const ideias = (p) => sinc(p, (s, api) => api.listarIdeias().then((l) => l.map((i) => i.texto).sort()));
    await sincronizarAgora(A);
    await sincronizarAgora(B);
    const ia = await ideias(A);
    const ib = await ideias(B);
    console.log("    ideias:", JSON.stringify(ia));
    ok(JSON.stringify(ia) === JSON.stringify(ib), "mesmas ideias nos dois");
  } catch (e) {
    falhas.push(`[${etapa}] ${e && e.stack ? e.stack.split("\n").slice(0, 3).join(" ") : e}`);
    console.log(e);
  }
  await navegador.close();
  servidor.close();
  console.log(`\nerros de console/página: ${erros.length}`);
  erros.forEach((e) => console.log("  " + e));
  const total = falhas.length + erros.length;
  console.log(total ? `FALHAS: ${falhas.length}` : "TUDO CERTO");
  process.exit(total ? 1 : 0);
})();
