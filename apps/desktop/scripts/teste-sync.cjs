// Teste de ponta a ponta da sincronização (etapa 2b): dois navegadores separados (dois
// contextos do Playwright, que não dividem nada) trocando arquivos pela pasta de mentira.
//
// COMO USAR (o script NÃO monta o app; só serve o que já foi montado):
//   cd apps/desktop
//   pnpm motor && rm -rf dist-web && VITE_ORBITA_WEB=1 pnpm exec vite build
//   node scripts/teste-sync.cjs            (opções: --porta 8781, --mostrar)
//
// O roteiro (etapas 2b e 2d): três navegadores (com ?sync-teste: a pasta é a de
// scripts/pasta-teste.cjs, servida aqui mesmo). PELAS TELAS: o A liga em Ajustes (conta,
// senha, PIN, 6 perguntas); o B começa a ligar como "primeiro" ao mesmo tempo e, quando vai
// gravar, descobre a chave do A e vai para "entrar" (nunca troca a chave); entra com a senha,
// confirma o PIN e junta os dados; o C entra pela primeira tela com Google e por "Esqueci a
// senha" (PIN + respostas com acento e maiúscula diferentes). Depois: ideia criada no A aparece
// no B; editada no B muda no A;
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
const CAPTURAS = arg("--capturas", null); // pasta para salvar capturas de tela (aviso e telas da 2d)
const DIST = path.resolve(__dirname, "../dist-web");
const URL_APP = `http://localhost:${PORTA}/?sync-teste`;
const PIN = "2580";
const SENHA_SYNC = "senha de sincronia comprida";
const PERGUNTAS = ["Qual era o apelido do meu avô?", "Em que rua eu morava aos 7 anos?", "Nome do meu primeiro bicho?", "Comida preferida da infância?", "Música da minha formatura?", "Livro que mais me marcou?"];
const RESPOSTAS = ["Zé Pequeno", "Rua São João", "Pipoca", "Pão de queijo", "Ônibus", "Grande Sertão"];
// As mesmas respostas, com acento, maiúscula e espaços diferentes (precisam abrir).
const RESPOSTAS_PARECIDAS = ["ze pequeno", "RUA SAO JOAO", "  pipoca", "pao de QUEIJO", "onibus", "grande   sertao"];
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
  const painel = p.getByRole("dialog", { name: "Sincronização entre aparelhos" });
  if (!(await painel.count())) await p.locator(".sinc-botao").click();
  const b = painel.getByRole("button", { name: "Sincronizar agora" });
  await b.waitFor({ timeout: 5000 });
  await b.click();
  // Volta quando termina (ou vira "Entrar com Google", se a conta pediu para entrar de novo).
  await painel.getByRole("button", { name: "Sincronizar agora" }).or(painel.getByRole("button", { name: "Entrar com Google" })).waitFor({ timeout: 15000 });
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
async function fecharDicas(p) {
  const n = p.getByRole("button", { name: "Não mostrar mais" });
  if (await n.count()) await n.first().click();
}
/** Primeira tela, "Usar sem conta" (no modo de teste o Google aparece em destaque). */
async function criarCofre(p) {
  const semConta = p.getByRole("button", { name: "Usar sem conta" });
  if (await semConta.count()) await semConta.click();
  else await p.getByRole("button", { name: "Começar" }).click();
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
  await fecharDicas(p);
}
const foto = async (p, nome) => {
  if (CAPTURAS) await p.screenshot({ path: path.join(CAPTURAS, `${nome}.png`) });
};
const janela = (p) => p.getByRole("dialog");
async function abrirSincronizar(p) {
  // Tela estreita (iPad em pé): o menu fica recolhido atrás de um botão.
  const abrirMenu = p.getByRole("button", { name: "Abrir o menu" });
  if ((await abrirMenu.count()) && (await abrirMenu.first().isVisible())) {
    await abrirMenu.first().click();
    await espera(p, 400);
  }
  await ir(p, "Ajustes");
  await p.locator("main").locator("button", { hasText: "Sincronizar aparelhos" }).first().click();
  await espera(p, 600);
}
async function esperarTexto(loc, texto, ms = 30000) {
  await loc.getByText(texto, { exact: false }).first().waitFor({ timeout: ms });
}
const versaoNaPasta = (nome) => pasta.arquivos.get(nome)?.versao ?? null;

(async () => {
  await new Promise((r) => servidor.listen(PORTA, r));
  const navegador = await playwright.chromium.launch({ headless: !MOSTRAR });
  const pags = [];
  for (const nome of ["A", "B", "C"]) {
    // O C imita o iPad em pé (é por ele que Dan entra no navegador).
    const ctx = await navegador.newContext({ viewport: nome === "C" ? { width: 820, height: 1180 } : { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    p.on("console", (m) => {
      // As respostas 503/401 da pasta são de propósito (sem internet, acesso negado).
      if (m.type() === "error" && !(m.location()?.url ?? "").includes("/__pasta-teste/")) erros.push(`${nome} [${etapa}] console: ${m.text()}`);
    });
    p.on("pageerror", (e) => erros.push(`${nome} [${etapa}] página: ${e}`));
    pags.push(p);
  }
  const [A, B, C] = pags;
  pags.length = 2; // o C entra só no fim (primeira tela com Google e "Esqueci a senha")
  try {
    passo("criar os cofres do A e do B (sem conta); o B já tem uma ideia");
    for (const p of [A, B]) {
      await p.goto(URL_APP);
      await espera(p, 2500);
      await criarCofre(p);
    }
    ok(await A.evaluate(() => !!window.__orbitaSincronia), "gancho de teste presente no A");
    ok((await aviso(A).count()) === 0, "sem a sincronização ligada, o aviso não aparece");
    await sinc(B, (s, api) => api.criarIdeia("Ideia do B de antes"));

    passo("Ajustes: cartão desligado");
    await abrirSincronizar(A);
    ok(await A.locator("main").getByText("Desligada").first().isVisible(), "cartão diz \"Desligada\"");
    await foto(A, "01-ajustes-desligada");

    passo("B começa a ligar como primeiro aparelho (pasta ainda vazia)");
    await abrirSincronizar(B);
    await B.getByRole("button", { name: "Ligar a sincronização" }).click();
    await esperarTexto(janela(B), "Entre na sua conta Google");
    await B.getByRole("button", { name: "Entrar com Google" }).click();
    await esperarTexto(janela(B), "Crie a senha de sincronização");
    await janela(B).getByLabel("Senha de sincronização").fill("senha do B que não vale");
    await janela(B).getByLabel("Digite a senha de novo").fill("senha do B que não vale");
    await janela(B).getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(B), "Confirme o PIN do Órbita");
    await janela(B).getByLabel("PIN").fill(PIN);
    await janela(B).getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(B), "Perguntas para quando esquecer a senha");
    ok(!pasta.arquivos.has("chave.orbita-sync"), "nada foi gravado na pasta antes do fim");

    passo("A liga pelo fluxo de tela completo (conta, senha, PIN, 6 perguntas)");
    await A.getByRole("button", { name: "Ligar a sincronização" }).click();
    await esperarTexto(janela(A), "Entre na sua conta Google");
    await foto(A, "02-conta-entrar");
    await A.getByRole("button", { name: "Entrar com Google" }).click();
    await esperarTexto(janela(A), "Crie a senha de sincronização");
    await janela(A).getByLabel("Senha de sincronização").fill("curta");
    ok(await janela(A).getByRole("button", { name: "Continuar" }).isDisabled(), "senha curta não deixa seguir");
    await janela(A).getByLabel("Senha de sincronização").fill(SENHA_SYNC);
    await janela(A).getByLabel("Digite a senha de novo").fill(SENHA_SYNC);
    await foto(A, "03-senha-nova");
    await janela(A).getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(A), "Confirme o PIN do Órbita");
    await janela(A).getByLabel("PIN").fill("9999");
    await janela(A).getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(A), "não confere");
    ok(true, "PIN errado avisa sem seguir");
    await janela(A).getByLabel("PIN").fill(PIN);
    await foto(A, "04-confirmar-pin");
    await janela(A).getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(A), "Perguntas para quando esquecer a senha");
    ok(await janela(A).getByText("alguém muito próximo de você pode saber as respostas").isVisible(), "a tela avisa o limite com franqueza");
    await foto(A, "05a-perguntas-topo");
    for (let i = 0; i < 6; i++) {
      await janela(A).getByLabel(`Pergunta ${i + 1}`, { exact: true }).fill(PERGUNTAS[i]);
      await janela(A).getByLabel(`Resposta ${i + 1}`, { exact: true }).fill(RESPOSTAS[i]);
    }
    await foto(A, "05-perguntas");
    await janela(A).getByRole("button", { name: "Guardar e ligar" }).click();
    await esperarTexto(janela(A), "Pronto: a sincronização está ligada");
    await foto(A, "06-pronto-primeiro");
    ok(pasta.arquivos.has("chave.orbita-sync") && pasta.arquivos.has("recuperacao.orbita-sync") && pasta.arquivos.has("pin.orbita-sync"), "chave, recuperação e PIN na pasta");
    const recAberta = Buffer.from(pasta.arquivos.get("recuperacao.orbita-sync").conteudo, "base64").toString("utf8");
    ok(recAberta.includes(PERGUNTAS[0]) && !RESPOSTAS.some((r) => recAberta.includes(r)), "perguntas abertas no arquivo, respostas não");
    const envelopeDoA = pasta.arquivos.get("chave.orbita-sync").conteudo;
    await janela(A).getByRole("button", { name: "Fechar" }).click();
    ok(/Sincronizado/.test(await esperarAviso(A, /Sincronizado/)), "A mostra \"Sincronizado\"");
    ok(await A.locator("main").getByText("Ligada", { exact: true }).first().isVisible(), "cartão diz \"Ligada\"");
    await espera(A, 800);
    await foto(A, "07-ajustes-ligada");

    passo("B termina como \"primeiro\": acha a chave do A e vai para entrar (nunca troca a chave)");
    await janela(B).getByRole("button", { name: "Fazer depois" }).click();
    await esperarTexto(janela(B), "Tudo bem fazer depois");
    await foto(B, "08-pular-perguntas");
    await janela(B).getByRole("button", { name: "Ligar sem as perguntas" }).click();
    await esperarTexto(janela(B), "Digite a senha de sincronização");
    ok(await janela(B).getByText("Outro aparelho ligou a sincronização nesta conta").isVisible(), "B explica que outro aparelho ligou antes");
    ok(pasta.arquivos.get("chave.orbita-sync").conteudo === envelopeDoA, "a chave do A continua a mesma na pasta");
    ok(!(await sinc(B, (s, api) => api.sincroniaSituacao().then((x) => x.temChave))), "B não ficou com outra chave");
    await foto(B, "09-entrar-senha-ja-existe");
    await janela(B).getByLabel("Senha de sincronização").fill("senha errada qualquer");
    await janela(B).getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(B), "A senha não confere");
    await janela(B).getByLabel("Senha de sincronização").fill(SENHA_SYNC);
    await janela(B).getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(B), "O PIN deste aparelho");
    const pinsB = janela(B).locator("input[type=password]");
    await pinsB.nth(0).fill("1111");
    await pinsB.nth(1).fill("1111");
    await pinsB.nth(2).fill(PIN); // confirmar que é você (PIN atual deste aparelho)
    await janela(B).getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(B), "diferente do PIN dos seus outros aparelhos");
    ok(true, "PIN diferente do dos outros aparelhos é recusado");
    await pinsB.nth(0).fill(PIN);
    await pinsB.nth(1).fill(PIN);
    await foto(B, "10-pin-aparelho");
    await janela(B).getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(B), "Este aparelho já tem dados");
    await foto(B, "11-juntar");
    ok(await janela(B).getByRole("radio", { name: /Juntar tudo/ }).isChecked(), "\"Juntar tudo\" vem marcado");
    await janela(B).getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(B), "Pronto: a sincronização está ligada");
    await foto(B, "12-pronto-novo");
    await janela(B).getByRole("button", { name: "Fechar" }).click();
    ok(/Sincronizado/.test(await esperarAviso(B, /Sincronizado/)), "B mostra o aviso de sincronizado");
    await sincronizarAgora(A);
    const ideiasA0 = await sinc(A, (s, api) => api.listarIdeias().then((l) => l.map((i) => i.texto)));
    ok(ideiasA0.includes("Ideia do B de antes"), "\"Juntar tudo\": a ideia que o B já tinha chegou no A");
    const idA = await sinc(A, (s, api) => api.sincroniaSituacao().then((x) => x.aparelho));
    const idB = await sinc(B, (s, api) => api.sincroniaSituacao().then((x) => x.aparelho));
    ok(pasta.arquivos.has(`aparelho-${idA}.orbita-sync`) && pasta.arquivos.has(`aparelho-${idB}.orbita-sync`), "retratos do A e do B na pasta");
    const recusou = await sinc(B, (s, api, senha) => s.ligarComoPrimeiro(senha).then(() => "ligou", (e) => e.message), "mais uma senha comprida");
    ok(/Já existe uma sincronização/.test(recusou), "ligar como primeiro com chave na pasta é recusado");
    ok(pasta.arquivos.get("chave.orbita-sync").conteudo === envelopeDoA, "e a chave continua a mesma");
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

    passo("acesso negado pede para entrar de novo; o botão entra direto do toque");
    pasta.estado.negado = true;
    await sincronizarAgora(B);
    ok((await esperarAviso(B, /entrar de novo/)) === "Precisa entrar de novo na conta", "B mostra \"Precisa entrar de novo na conta\"");
    pasta.estado.negado = false;
    await B.locator(".sinc-botao").click();
    const entrarDeNovo = B.getByRole("dialog").getByRole("button", { name: "Entrar com Google" });
    await entrarDeNovo.waitFor({ timeout: 5000 });
    await foto(B, "13-entrar-de-novo");
    await entrarDeNovo.click();
    ok(/Sincronizado/.test(await esperarAviso(B, /Sincronizado/)), "B recupera depois de entrar de novo");
    await B.keyboard.press("Escape");

    passo("teclado: o aviso recebe foco e abre o painel");
    await A.locator(".sinc-botao").focus();
    await A.keyboard.press("Enter");
    ok(await A.getByRole("dialog", { name: "Sincronização entre aparelhos" }).isVisible(), "painel abre pelo teclado");
    if (CAPTURAS) await A.screenshot({ path: path.join(CAPTURAS, "sync-painel.png") });
    ok((await A.getByRole("dialog").innerText()).includes("Última vez: hoje às"), "painel mostra a última vez");
    await A.keyboard.press("Escape");

    passo("C: primeira tela com Google em destaque, PIN, e entra por \"Esqueci a senha\"");
    await C.goto(URL_APP);
    await espera(C, 2500);
    ok(await C.getByRole("button", { name: "Entrar com Google" }).isVisible(), "primeira tela mostra \"Entrar com Google\" em destaque");
    ok(await C.getByRole("button", { name: "Usar sem conta" }).isVisible(), "\"Usar sem conta\" continua, menor");
    await foto(C, "14-primeira-tela-google");
    await C.getByRole("button", { name: "Entrar com Google" }).click();
    await esperarTexto(C, "Escolha o PIN do Órbita");
    const pinsC = C.locator("input[type=password]");
    await pinsC.nth(0).fill(PIN);
    await pinsC.nth(1).fill(PIN);
    await foto(C, "15-primeira-tela-pin");
    await C.getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(C), "Digite a senha de sincronização", 40000);
    ok(true, "o app abre e já mostra a conta com sincronização: pede a senha");
    await janela(C).getByRole("button", { name: "Esqueci a senha" }).click();
    await esperarTexto(janela(C), "Entrar com o PIN e as perguntas");
    await janela(C).getByLabel(PERGUNTAS[0]).waitFor({ timeout: 10000 });
    await janela(C).getByLabel("PIN do Órbita").fill(PIN);
    for (let i = 0; i < 6; i++) await janela(C).getByLabel(PERGUNTAS[i]).fill(i === 3 ? "lasanha" : RESPOSTAS_PARECIDAS[i]);
    await janela(C).getByRole("button", { name: "Entrar", exact: true }).click();
    await esperarTexto(janela(C), "O PIN ou alguma das respostas não confere", 40000);
    ok(true, "uma resposta errada não abre");
    await janela(C).getByLabel(PERGUNTAS[3]).fill(RESPOSTAS_PARECIDAS[3]);
    await foto(C, "16-esqueci-a-senha");
    await janela(C).getByRole("button", { name: "Entrar", exact: true }).click();
    await esperarTexto(janela(C), "Quer criar uma senha nova?", 40000);
    ok(true, "PIN + respostas com acento e maiúscula diferentes abrem");
    await foto(C, "17-senha-nova-depois");
    await janela(C).getByRole("button", { name: "Agora não" }).click();
    await esperarTexto(janela(C), "Pronto: a sincronização está ligada", 40000);
    await janela(C).getByRole("button", { name: "Fechar" }).click();
    ok(/Sincronizado/.test(await esperarAviso(C, /Sincronizado/)), "C sincroniza");
    const ideiasC = await sinc(C, (s, api) => api.listarIdeias().then((l) => l.map((i) => i.texto).sort()));
    ok(ideiasC.includes("Ideia do B de antes"), "C recebeu os dados");
    ok((await sinc(C, (s, api) => api.situacao())).modo === "pin", "C abre com o PIN");
    ok(pasta.arquivos.get("chave.orbita-sync").conteudo === envelopeDoA, "a chave na pasta continua a do A");

    passo("C: Desligar neste aparelho (os dados ficam)");
    await abrirSincronizar(C);
    await C.locator("main").getByRole("button", { name: "Desligar neste aparelho" }).click();
    const conf = C.getByRole("alertdialog");
    await conf.waitFor({ timeout: 5000 });
    ok((await conf.innerText()).includes("Seus dados continuam neste aparelho e no seu Google Drive"), "a confirmação diz literalmente que os dados ficam");
    await foto(C, "18-desligar");
    await conf.getByRole("button", { name: "Desligar neste aparelho" }).click();
    await esperarTexto(C.locator("main"), "Sincronização desligada neste aparelho");
    ok(!(await sinc(C, (s, api) => api.sincroniaSituacao().then((x) => x.temChave))), "C não tem mais a chave");
    ok((await sinc(C, (s, api) => api.listarIdeias().then((l) => l.length))) === ideiasC.length, "as ideias continuam no C");
    ok((await aviso(C).count()) === 0, "o aviso do alto some");

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
