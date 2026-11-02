// Teste de ponta a ponta da sincronização (etapa 2b): dois navegadores separados (dois
// contextos do Playwright, que não dividem nada) trocando arquivos pela pasta de mentira.
//
// COMO USAR (o script NÃO monta o app; só serve o que já foi montado):
//   cd apps/desktop
//   pnpm motor && rm -rf dist-web && VITE_ORBITA_WEB=1 pnpm exec vite build
//   node scripts/teste-sync.cjs            (opções: --porta 8781, --mostrar)
//
// O roteiro (etapas 2b e 2d, e a senha opcional de 03/11/2026): quatro navegadores (com
// ?sync-teste: a pasta é a de scripts/pasta-teste.cjs, servida aqui mesmo). PELAS TELAS: o A
// liga em Ajustes SEM senha (padrão "só o Google": conta, caixinha da proteção extra desligada,
// PIN); o B começa a ligar como "primeiro" ao mesmo tempo e, quando vai gravar, descobre a chave
// do A e entra nela sem senha (nunca troca a chave), confirma o PIN e junta os dados. Depois o A
// liga a proteção extra (senha + 6 perguntas) e o B segue sincronizando; o C entra pela primeira
// tela com Google, precisa da senha e entra por "Esqueci a senha" (PIN + respostas com acento e
// maiúscula diferentes); o A desliga a proteção e o D entra só com a conta. Também: ideia criada
// no A aparece no B; editada no B muda no A;
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

    passo("B começa a ligar como primeiro aparelho (pasta ainda vazia), sem a proteção extra");
    await abrirSincronizar(B);
    await B.getByRole("button", { name: "Ligar a sincronização" }).click();
    await esperarTexto(janela(B), "Entre na sua conta Google");
    await B.getByRole("button", { name: "Entrar com Google" }).click();
    await esperarTexto(janela(B), "Como trancar seus dados");
    await janela(B).getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(B), "Confirme o PIN do Órbita");
    await janela(B).getByLabel("PIN").fill(PIN);
    ok(!pasta.arquivos.has("chave.orbita-sync"), "nada foi gravado na pasta antes do fim");

    passo("A liga pelas telas SEM senha (padrão: só o Google): conta, caixinha desligada, PIN");
    await A.getByRole("button", { name: "Ligar a sincronização" }).click();
    await esperarTexto(janela(A), "Entre na sua conta Google");
    await foto(A, "02-conta-entrar");
    await A.getByRole("button", { name: "Entrar com Google" }).click();
    await esperarTexto(janela(A), "Como trancar seus dados");
    const caixa = janela(A).getByRole("checkbox", { name: "Proteção extra: trancar também com uma senha minha" });
    ok(!(await caixa.isChecked()), "a caixinha da proteção extra vem desligada");
    ok(await janela(A).getByText("Passo 2 de 3").isVisible(), "sem a proteção extra: Passo 2 de 3");
    ok(await janela(A).getByText("quem entrar na sua conta Google poderia abrir seus dados").isVisible(), "a tela explica a troca (sem ela)");
    ok(await janela(A).getByText("Mas é uma senha a mais para lembrar").isVisible(), "a tela explica a troca (com ela)");
    await foto(A, "03-protecao-extra-desligada");
    const rotuloCaixa = janela(A).locator("label.caixa"); // o input fica escondido; o toque é no rótulo
    await rotuloCaixa.click();
    ok(await caixa.isChecked(), "a caixinha marca com um toque");
    ok(await janela(A).getByText("Passo 2 de 5").isVisible(), "com a proteção extra: Passo 2 de 5 (senha e perguntas)");
    await foto(A, "03b-protecao-extra-marcada");
    await rotuloCaixa.click();
    await janela(A).getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(A), "Confirme o PIN do Órbita");
    ok(await janela(A).getByText("Passo 3 de 3").isVisible(), "PIN é o último passo: Passo 3 de 3");
    await janela(A).getByLabel("PIN").fill("9999");
    await janela(A).getByRole("button", { name: "Ligar a sincronização" }).click();
    await esperarTexto(janela(A), "não confere");
    ok(true, "PIN errado avisa sem seguir");
    await janela(A).getByLabel("PIN").fill(PIN);
    await foto(A, "04-confirmar-pin");
    await janela(A).getByRole("button", { name: "Ligar a sincronização" }).click();
    await esperarTexto(janela(A), "Pronto: a sincronização está ligada");
    ok(await janela(A).getByText("entre com a mesma conta Google e use o mesmo PIN").isVisible(), "o pronto não fala de senha");
    await foto(A, "06-pronto-primeiro");
    ok(pasta.arquivos.has("chave.orbita-sync") && pasta.arquivos.has("pin.orbita-sync"), "chave e PIN na pasta");
    ok(!pasta.arquivos.has("recuperacao.orbita-sync"), "sem a proteção extra, não há perguntas na pasta");
    const chaveAberta = JSON.parse(Buffer.from(pasta.arquivos.get("chave.orbita-sync").conteudo, "base64").toString("utf8"));
    ok(chaveAberta.formato === "orbita-chave" && chaveAberta.versao === 2 && chaveAberta.modo === "conta" && typeof chaveAberta.chave === "string", "arquivo da chave no modo conta, versionado e explícito");
    const envelopeDoA = pasta.arquivos.get("chave.orbita-sync").conteudo;
    await janela(A).getByRole("button", { name: "Fechar" }).click();
    ok(/Sincronizado/.test(await esperarAviso(A, /Sincronizado/)), "A mostra \"Sincronizado\"");
    ok(await A.locator("main").getByText("Ligada", { exact: true }).first().isVisible(), "cartão diz \"Ligada\"");
    await esperarTexto(A.locator("main"), "Desligada: aparelhos novos entram só com a conta Google");
    ok(true, "cartão diz \"Proteção extra: Desligada\"");
    ok(!(await A.locator("main").getByRole("button", { name: "Criar senha nova" }).count()), "sem a proteção, não há \"Criar senha nova\"");
    await espera(A, 800);
    await foto(A, "07-ajustes-ligada-sem-protecao");

    passo("B termina como \"primeiro\": acha a chave do A e entra nela SEM senha (nunca troca a chave)");
    await janela(B).getByRole("button", { name: "Ligar a sincronização" }).click();
    await esperarTexto(janela(B), "O PIN deste aparelho");
    ok(await janela(B).getByText("este aparelho entra na mesma sincronização").isVisible(), "B explica que outro aparelho ligou antes");
    ok(!(await janela(B).getByText("Digite a senha de sincronização").count()), "B não pede senha");
    ok(pasta.arquivos.get("chave.orbita-sync").conteudo === envelopeDoA, "a chave do A continua a mesma na pasta");
    await foto(B, "09-entrar-sem-senha");
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
    const recusou = await sinc(B, (s) => s.ligarComoPrimeiro(null).then(() => "ligou", (e) => e.message));
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

    passo("Minha organização: quadro com etiqueta e cartão com checklist vão do A para o B");
    const org = await sinc(A, async (s, api) => {
      const q = await api.salvarQuadro({ id: "", nome: "Quadro que viaja", estilo: "quadro", criadoEm: 0 });
      const comEtiqueta = await api.salvarQuadro({ ...q, vista: "lista", etiquetas: [{ id: "", nome: "Urgente", cor: "pessego" }], fundo: { tipo: "gradiente", valor: "aurora" } });
      const col = (await api.listarColunas(q.id))[0];
      await api.salvarColuna({ ...col, recolhida: true });
      const c = await api.salvarCartaoOrg({
        id: "", colunaId: col.id, texto: "Cartão com checklist", feito: false, cor: "", prazo: "2026-12-15", hora: "09:30", ordem: 0, criadoEm: 0,
        descricao: "**Detergente** acabou", etiquetas: [comEtiqueta.etiquetas[0].id], capa: { tipo: "cor", valor: "ceu" },
        checklists: [{ id: "", nome: "Passos", itens: [{ id: "", texto: "Pratos", feito: true }, { id: "", texto: "Panelas", feito: false }] }],
      });
      return { quadro: q.id, cartao: c.id, etiqueta: comEtiqueta.etiquetas[0].id };
    });
    await sincronizarAgora(A);
    await sincronizarAgora(B);
    const noB = await sinc(B, async (s, api, o) => {
      const q = (await api.listarQuadros()).find((x) => x.id === o.quadro);
      const cols = await api.listarColunas(o.quadro);
      const c = (await api.listarCartoesOrg(o.quadro)).find((x) => x.id === o.cartao);
      return { q, col: cols[0], c };
    }, org);
    ok(noB.q && noB.q.vista === "lista" && noB.q.fundo?.tipo === "gradiente" && noB.q.etiquetas?.[0]?.nome === "Urgente", "o quadro chega com vista, fundo e etiqueta");
    ok(noB.col?.recolhida === true, "a coluna chega recolhida");
    ok(
      noB.c && noB.c.descricao === "**Detergente** acabou" && noB.c.hora === "09:30" && noB.c.etiquetas?.[0] === org.etiqueta && noB.c.capa?.valor === "ceu" && noB.c.checklists?.[0]?.itens.map((i) => `${i.texto}:${i.feito}`).join() === "Pratos:true,Panelas:false",
      "o cartão chega com descrição, data e hora, etiqueta, capa e checklist",
    );
    // Marcar um item no B volta para o A.
    await sinc(B, (s, api, c) => api.salvarCartaoOrg({ ...c, checklists: [{ ...c.checklists[0], itens: c.checklists[0].itens.map((i) => ({ ...i, feito: true })) }] }), noB.c);
    await sincronizarAgora(B);
    await sincronizarAgora(A);
    const noA = await sinc(A, (s, api, o) => api.listarCartoesOrg(o.quadro).then((l) => l.find((x) => x.id === o.cartao)), org);
    ok(noA?.checklists?.[0]?.itens.every((i) => i.feito), "o item marcado no B aparece marcado no A");

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

    passo("A liga a proteção extra em Ajustes (senha nova + 6 perguntas); o B continua sem fazer nada");
    await abrirSincronizar(A);
    await A.locator("main").getByRole("button", { name: "Ligar a proteção extra" }).click();
    await esperarTexto(janela(A), "Ligar a proteção extra");
    await janela(A).getByLabel("Senha de sincronização").fill("curta");
    ok(await janela(A).getByRole("button", { name: "Ligar a proteção" }).isDisabled(), "senha curta não deixa seguir");
    await janela(A).getByLabel("Senha de sincronização").fill(SENHA_SYNC);
    await janela(A).getByLabel("Digite a senha de novo").fill(SENHA_SYNC);
    await foto(A, "20-ligar-protecao-senha");
    await janela(A).getByRole("button", { name: "Ligar a proteção" }).click();
    await esperarTexto(janela(A), "Perguntas para quando esquecer a senha");
    const modoNaPasta = () => {
      const j = JSON.parse(Buffer.from(pasta.arquivos.get("chave.orbita-sync").conteudo, "base64").toString("utf8"));
      return j.formato === "orbita-chave" ? j.modo : j.versao === 1 && j.cifra ? "senha" : "?";
    };
    ok(modoNaPasta() === "senha", "a pasta já guarda a chave no envelope com senha");
    ok(!pasta.arquivos.get("chave.orbita-sync").conteudo.includes(chaveAberta.chave) && !Buffer.from(pasta.arquivos.get("chave.orbita-sync").conteudo, "base64").toString("utf8").includes(chaveAberta.chave), "a chave aberta saiu da pasta");
    ok(await janela(A).getByText("alguém muito próximo de você pode saber as respostas").isVisible(), "a tela das perguntas avisa o limite com franqueza");
    await janela(A).getByLabel("PIN do Órbita").fill(PIN);
    for (let i = 0; i < 6; i++) {
      await janela(A).getByLabel(`Pergunta ${i + 1}`, { exact: true }).fill(PERGUNTAS[i]);
      await janela(A).getByLabel(`Resposta ${i + 1}`, { exact: true }).fill(RESPOSTAS[i]);
    }
    await foto(A, "21-ligar-protecao-perguntas");
    await janela(A).getByRole("button", { name: "Guardar as perguntas" }).click();
    await esperarTexto(janela(A), "Proteção extra ligada.");
    await foto(A, "22-protecao-ligada");
    ok(pasta.arquivos.has("recuperacao.orbita-sync"), "perguntas na pasta");
    const recAberta = Buffer.from(pasta.arquivos.get("recuperacao.orbita-sync").conteudo, "base64").toString("utf8");
    ok(recAberta.includes(PERGUNTAS[0]) && !RESPOSTAS.some((r) => recAberta.includes(r)), "perguntas abertas no arquivo, respostas não");
    await janela(A).getByRole("button", { name: "Fechar" }).click();
    await esperarTexto(A.locator("main"), "Ligada: aparelhos novos pedem a senha de sincronização");
    ok(await A.locator("main").getByRole("button", { name: "Desligar a proteção extra" }).isVisible(), "Ajustes oferece desligar a proteção");
    await espera(A, 600);
    await foto(A, "23-ajustes-protecao-ligada");
    const envelopeComSenha = pasta.arquivos.get("chave.orbita-sync").conteudo;
    await sinc(A, (s, api) => api.criarIdeia("Depois da proteção extra"));
    await sincronizarAgora(A);
    await sincronizarAgora(B);
    ok((await sinc(B, (s, api) => api.listarIdeias().then((l) => l.map((i) => i.texto)))).includes("Depois da proteção extra"), "o B continua sincronizando (a chave é a mesma)");

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
    ok(true, "com a proteção extra, o aparelho novo precisa da senha");
    await foto(C, "15b-precisa-da-senha");
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
    ok(pasta.arquivos.get("chave.orbita-sync").conteudo === envelopeComSenha, "a chave na pasta continua a do A");

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

    passo("A desliga a proteção extra (confirmação literal); D entra só com a conta Google");
    await abrirSincronizar(A);
    await A.locator("main").getByRole("button", { name: "Desligar a proteção extra" }).click();
    const confP = A.getByRole("alertdialog");
    await confP.waitFor({ timeout: 5000 });
    ok((await confP.innerText()).includes("Seus dados continuam trancados, mas quem entrar na sua conta Google poderá abri-los"), "a confirmação diz literalmente o que muda");
    await foto(A, "24-desligar-protecao");
    await confP.getByRole("button", { name: "Desligar a proteção extra" }).click();
    await esperarTexto(A.locator("main"), "Proteção extra desligada. Aparelhos novos entram só com a conta Google.");
    ok(modoNaPasta() === "conta", "a pasta volta a guardar a chave aberta (modo conta)");
    ok(pasta.arquivos.get("chave.orbita-sync").conteudo === envelopeDoA, "é a mesma chave do começo");
    await esperarTexto(A.locator("main"), "Desligada: aparelhos novos entram só com a conta Google");
    await foto(A, "25-ajustes-protecao-desligada");

    const ctxD = await navegador.newContext({ viewport: { width: 820, height: 1180 } });
    const D = await ctxD.newPage();
    D.on("console", (m) => {
      if (m.type() === "error" && !(m.location()?.url ?? "").includes("/__pasta-teste/")) erros.push(`D [${etapa}] console: ${m.text()}`);
    });
    D.on("pageerror", (e) => erros.push(`D [${etapa}] página: ${e}`));
    await D.goto(URL_APP);
    await espera(D, 2500);
    await D.getByRole("button", { name: "Entrar com Google" }).click();
    await esperarTexto(D, "Escolha o PIN do Órbita");
    const pinsD = D.locator("input[type=password]");
    await pinsD.nth(0).fill(PIN);
    await pinsD.nth(1).fill(PIN);
    await D.getByRole("button", { name: "Continuar" }).click();
    await esperarTexto(janela(D), "Pronto: a sincronização está ligada", 40000);
    ok(true, "D entra sem pedir senha (direto para o PIN e juntar)");
    await foto(D, "26-d-pronto-sem-senha");
    await janela(D).getByRole("button", { name: "Fechar" }).click();
    ok(/Sincronizado/.test(await esperarAviso(D, /Sincronizado/)), "D sincroniza");
    const ideiasD = await sinc(D, (s, api) => api.listarIdeias().then((l) => l.map((i) => i.texto)));
    ok(ideiasD.includes("Depois da proteção extra") && ideiasD.includes("Ideia do B de antes"), "D recebeu os dados");

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
