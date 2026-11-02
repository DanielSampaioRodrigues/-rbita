// Teste rápido da sincronização no navegador: duas páginas em contextos diferentes,
// pacotes trocados à mão pela API (servidor de desenvolvimento do Vite em modo web).
let playwright;
try { playwright = require("playwright"); } catch { playwright = require("/opt/node-tools/node_modules/playwright"); }
const URL_APP = process.argv[2] || "http://localhost:8790/";
const PIN = "2580";
const erros = [];
const falhas = [];
const ok = (c, m) => { if (!c) { falhas.push(m); console.log("  ✗ " + m); } else console.log("  ✓ " + m); };
const espera = (p, ms) => p.waitForTimeout(ms);
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
const api = (p, f, ...args) => p.evaluate(async ([fs, args]) => {
  const { api } = await import("/src/api.ts");
  return await (new Function("api", "args", `return (${fs})(api, ...args)`))(api, args);
}, [f.toString(), args]);

(async () => {
  const b = await playwright.chromium.launch();
  const pags = [];
  for (const nome of ["A", "B"]) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    p.on("console", (m) => m.type() === "error" && erros.push(`${nome} console: ${m.text()}`));
    p.on("pageerror", (e) => erros.push(`${nome} página: ${e}`));
    await p.goto(URL_APP);
    await espera(p, 3000);
    await criarCofre(p);
    pags.push(p);
  }
  const [A, B] = pags;
  try {
    console.log("· situação e chave");
    const sa = await api(A, (api) => api.sincroniaSituacao());
    ok(sa.temChave === false && sa.aparelho.length === 36, "A começa sem chave, com id de aparelho");
    let t = Date.now();
    const env = await api(A, (api) => api.sincroniaCriarChave("senha de sincronia comprida"));
    console.log(`    criar chave (Argon2 64 MB): ${Date.now() - t} ms`);
    const errada = await api(B, (api, e) => api.sincroniaEntrar(e, "senha errada errada").then(() => "abriu", (x) => x.codigo), env);
    ok(errada === "senha_errada", "senha errada recusada no B");
    await api(B, (api, e) => api.sincroniaEntrar(e, "senha de sincronia comprida"), env);
    ok((await api(B, (api) => api.sincroniaSituacao())).temChave, "B entrou com a senha certa");

    console.log("· dados diferentes nos dois, troca de pacotes");
    await api(A, async (api) => {
      await api.criarIdeia("Ideia criada no A, com acentuação");
      await api.gravarValor("foco.salvos", [{ id: "x", nome: "Estudar" }]);
      const i = await api.criarIdeia("Ideia com anexo");
      await api.anexarBytes(i.id, "nota.txt", btoa("conteúdo do anexo"));
    });
    await api(B, (api) => api.criarIdeia("Ideia criada no B"));
    t = Date.now();
    const pa = await api(A, (api) => api.sincroniaMeuPacote());
    const pb = await api(B, (api) => api.sincroniaMeuPacote());
    console.log(`    pacote A: ${pa.length} caracteres base64 (${Date.now() - t} ms para os dois)`);
    const rb = await api(B, (api, x) => api.sincroniaJuntar(x), pa);
    const ra = await api(A, (api, x) => api.sincroniaJuntar(x), pb);
    console.log("    resumo no B:", JSON.stringify(rb));
    ok(rb.entraram > 0 && ra.entraram > 0, "linhas entraram dos dois lados");
    ok(rb.faltamConteudos.length === 1, "B sabe que falta 1 conteúdo de anexo");

    console.log("· conteúdo do anexo");
    const sha = rb.faltamConteudos[0];
    const c = await api(A, (api, s) => api.sincroniaConteudo(s), sha);
    ok(typeof c === "string", "A entrega o conteúdo trancado");
    ok((await api(B, (api, s, c) => api.sincroniaGuardarConteudo(s, c), sha, c)) === 1, "B guardou o conteúdo em 1 anexo");

    const ia = await api(A, (api) => api.listarIdeias().then((l) => l.map((i) => i.texto).sort()));
    const ib = await api(B, (api) => api.listarIdeias().then((l) => l.map((i) => i.texto).sort()));
    console.log("    ideias A:", JSON.stringify(ia));
    ok(JSON.stringify(ia) === JSON.stringify(ib) && ia.length === 3, "as mesmas 3 ideias nos dois");
    ok(JSON.stringify(await api(B, (api) => api.lerValor("foco.salvos"))) === JSON.stringify([{ id: "x", nome: "Estudar" }]), "valor de módulo chegou no B");

    console.log("· juntar de novo não muda nada; pacote do A na tela do B");
    const r2 = await api(B, (api, x) => api.sincroniaJuntar(x), pa);
    ok(r2.entraram === 0 && r2.mudaram === 0, "repetir não muda");
    await B.locator("nav").getByRole("link", { name: "Ideias", exact: true }).or(B.locator("nav").getByRole("button", { name: "Ideias", exact: true })).first().click();
    await espera(B, 800);
    await B.reload();
    await espera(B, 2500);
    await B.getByLabel("PIN").fill(PIN);
    await B.getByRole("button", { name: "Entrar" }).click();
    await espera(B, 2500);
    await B.locator("nav").getByRole("link", { name: "Ideias", exact: true }).or(B.locator("nav").getByRole("button", { name: "Ideias", exact: true })).first().click();
    await espera(B, 1000);
    ok((await B.locator("main").innerText()).includes("Ideia criada no A"), "depois de recarregar, a ideia do A aparece na tela do B (ficou guardada)");

    console.log("· chave errada não estraga");
    const C = await (await b.newContext()).newPage();
    await C.goto(URL_APP); await espera(C, 3000); await criarCofre(C);
    await api(C, (api) => api.sincroniaCriarChave("outra senha qualquer longa"));
    const rc = await api(C, (api, x) => api.sincroniaJuntar(x).then(() => "abriu", (e) => e.codigo), pa);
    ok(rc === "interno", "pacote com outra chave recusado");
    ok((await api(C, (api) => api.listarIdeias())).length === 0, "C continua vazio");
  } catch (e) {
    falhas.push(String(e));
    console.log(e);
  }
  await b.close();
  console.log(`\nerros de console/página: ${erros.length}`);
  erros.forEach((e) => console.log("  " + e));
  console.log(falhas.length ? `FALHAS: ${falhas.length}` : "TUDO CERTO");
  process.exit(falhas.length ? 1 : 0);
})();
