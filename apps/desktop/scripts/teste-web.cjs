// Teste de ponta a ponta da versão de navegador (iPad), na interface real, com Playwright.
//
// COMO USAR (o script NÃO monta o app; só serve o que já foi montado):
//   cd apps/desktop
//   pnpm motor && rm -rf dist-web && VITE_ORBITA_WEB=1 pnpm exec vite build
//   node scripts/teste-web.cjs            (opções: --porta 8780, --mostrar para abrir a janela)
//
// Teste cruzado com o Windows (opção --cruzado <pasta>):
//   1. no src-tauri: ORBITA_CRUZADO=<pasta> cargo test --release gerar_backup_do_windows -- --ignored
//      (grava do-windows.orbita-backup e do-windows.json na pasta);
//   2. node scripts/teste-web.cjs --cruzado <pasta>: abre o backup do Windows aqui (senha e 6 palavras)
//      e grava o backup feito no navegador em do-navegador.orbita-backup e do-navegador.json;
//   3. no src-tauri: ORBITA_CRUZADO=<pasta> cargo test --release abrir_backup_do_navegador -- --ignored
//
// Precisa do Playwright com o Chromium instalados (require("playwright")).
// O roteiro: cria o cofre com PIN e passa pelas 6 palavras; cria um dado em cada módulo;
// recarrega, abre numa aba nova, bloqueia e desbloqueia (PIN e 6 palavras), conferindo tudo;
// cria uma senha, faz backup, restaura num navegador limpo (senha e 6 palavras) e por cima
// dos dados (Ajustes). Junta os erros do console e da página. Termina com código 1 se algo falhou.
// Arquivos temporários (backup, imagem, capturas de tela) ficam numa pasta do sistema.

const http = require("http");
const fs = require("fs");
const os = require("os");
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
const PORTA = Number(arg("--porta", "8780"));
const MOSTRAR = process.argv.includes("--mostrar");
const DIST = path.resolve(__dirname, "../dist-web");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "orbita-teste-web-"));
const URL_APP = `http://localhost:${PORTA}/`;
const PIN = "2580";
const SENHA = "gato azul na lua";
const CRUZADO = arg("--cruzado", null);

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error(`Não achei ${DIST}/index.html. Monte antes: pnpm motor && VITE_ORBITA_WEB=1 pnpm exec vite build`);
  process.exit(2);
}

// Imagem de teste (PNG 1x1) e servidor estático simples.
const IMAGEM = path.join(TMP, "teste.png");
const LIVRO = path.join(__dirname, "fixtures", "livro-teste.epub");
fs.writeFileSync(IMAGEM, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPhfDwAFhAJ/wlseKgAAAABJRU5ErkJggg==", "base64"));
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

const erros = [];
const falhas = [];
let etapa = "início";
const passo = (nome) => {
  etapa = nome;
  console.log(`· ${nome}`);
};
const falhar = (msg) => {
  falhas.push(`[${etapa}] ${msg}`);
  console.log(`  ✗ ${msg}`);
};
const ligar = (p) => {
  p.on("console", (m) => m.type() === "error" && erros.push(`[${etapa}] console: ${m.text()}`));
  p.on("pageerror", (e) => erros.push(`[${etapa}] página: ${e}`));
};

// ── Ajudantes ────────────────────────────────────────────────────────────────
const espera = (p, ms = 500) => p.waitForTimeout(ms);
const main = (p) => p.locator("main");
const dialogo = (p, nome) => (nome ? p.getByRole("dialog", { name: nome }) : p.getByRole("dialog"));
const textoMain = (p) => main(p).innerText();
async function ir(p, modulo) {
  await p.locator("nav").getByRole("link", { name: modulo, exact: true }).or(p.locator("nav").getByRole("button", { name: modulo, exact: true })).first().click();
  await espera(p, 600);
}
async function escolherArquivo(p, botao, arquivo) {
  const [fc] = await Promise.all([p.waitForEvent("filechooser", { timeout: 8000 }), botao.click()]);
  await fc.setFiles(arquivo);
  await espera(p, 1000);
}
async function marcar(local, nome) {
  await local.getByRole("radio", { name: nome }).check({ force: true });
}
async function entrarComPin(p) {
  await p.getByLabel("PIN").fill(PIN);
  await p.getByRole("button", { name: "Entrar" }).click();
  await espera(p, 2000);
}
async function guardarIdeia(p, texto) {
  await ir(p, "Ideias");
  await p.getByLabel("O que você quer guardar?").fill(texto);
  await p.keyboard.press("Enter");
}
async function temIdeia(p, texto) {
  await ir(p, "Ideias");
  return (await textoMain(p)).includes(texto);
}
async function bloquear(p) {
  await p.locator("button.lateral-item", { hasText: "Bloquear" }).click();
  await espera(p, 1500);
}
async function digitarPalavras(p, palavras) {
  for (let i = 0; i < palavras.length; i++) await p.getByLabel(`Palavra ${i + 1}`).fill(palavras[i]);
}

// ── 1. Primeira abertura ────────────────────────────────────────────────────
async function criarCofre(p) {
  passo("criar o cofre com PIN");
  // Com o Google ligado (desde a 0.47.0), a primeira tela mostra "Entrar com Google"
  // em destaque e "Usar sem conta" menor; sem ele, o botão é "Começar".
  const semConta = p.getByRole("button", { name: "Usar sem conta" });
  if (await semConta.isVisible().catch(() => false)) await semConta.click();
  else await p.getByRole("button", { name: "Começar" }).click();
  await espera(p, 300);
  await p.getByRole("button", { name: "Continuar" }).click(); // PIN é o recomendado no navegador
  await espera(p, 300);
  const pins = p.locator("input[type=password]");
  await pins.nth(0).fill(PIN);
  await pins.nth(1).fill(PIN);
  await p.getByRole("button", { name: "Continuar" }).click();
  await p.getByText("Guarde sua chave de recuperação").waitFor({ timeout: 20000 });
  const palavras = (await p.locator("main, body").first().innerText())
    .split("\n")
    .map((l) => l.trim())
    .filter((l, i, a) => /^[1-6]$/.test(a[i - 1] ?? "") && /^[a-zà-ú]+$/.test(l));
  if (palavras.length !== 6) falhar(`não li as 6 palavras (li ${palavras.length})`);
  await p.getByRole("button", { name: "Pronto, abrir o Órbita" }).click();
  await espera(p, 2000);
  const naoMostrar = p.getByRole("button", { name: "Não mostrar mais" });
  if (await naoMostrar.count()) await naoMostrar.first().click();
  return palavras;
}

// ── 2. Um dado em cada módulo ───────────────────────────────────────────────
async function criarDados(p) {
  passo("Ideias: etiqueta criada no painel, na ficha sem Salvar, cor da ideia, nota e link");
  await guardarIdeia(p, "Ideia de teste com acentuação ção");
  await espera(p, 800);
  // Painel "Etiquetas das ideias": criar a primeira etiqueta ali mesmo; a lista atualiza na hora.
  await main(p).getByRole("button", { name: "Etiquetas", exact: true }).click();
  let d = dialogo(p, "Etiquetas das ideias");
  await d.getByLabel("Nome da etiqueta").fill("urgente");
  await marcar(d, "Mar");
  await d.getByRole("button", { name: "Criar etiqueta" }).click();
  await espera(p);
  if (!(await d.locator(".lista-ligadas").innerText().catch(() => "")).includes("urgente")) falhar("o painel não mostrou a etiqueta criada nele");
  await d.getByRole("button", { name: "Fechar" }).click();
  await espera(p);
  // Ficha: criar (à vista), marcar e escolher a cor, e fechar SEM Salvar: tem que ficar gravado.
  await p.getByRole("button", { name: /Abrir a ideia/ }).first().click();
  d = dialogo(p, "Ideia");
  await d.getByLabel("Nome da etiqueta").fill("casa");
  await d.getByRole("radiogroup", { name: "Cor", exact: true }).locator(".cor-opcao", { hasText: "Terra" }).click();
  await d.getByRole("button", { name: "Criar e marcar" }).click();
  await espera(p);
  await d.getByRole("button", { name: "urgente" }).click();
  await espera(p, 300);
  await d.getByRole("radiogroup", { name: "Cor da ideia" }).locator(".cor-opcao", { hasText: "Lavanda" }).click();
  await espera(p);
  await d.getByRole("button", { name: "Cancelar" }).click();
  await espera(p, 800);
  {
    const linha = main(p).locator("li.ideia-item", { hasText: "Ideia de teste com acentuação ção" });
    const txt = await linha.innerText().catch(() => "");
    if (!txt.includes("urgente") || !txt.includes("casa")) falhar(`a ficha fechada sem Salvar perdeu as etiquetas (linha: ${txt.replace(/\n/g, " | ")})`);
    if (!/borda-lavanda/.test((await linha.getAttribute("class").catch(() => "")) ?? "")) falhar("a cor da ideia não chegou na lista");
  }
  // Nota e link: esses ainda esperam o Salvar.
  await p.getByRole("button", { name: /Abrir a ideia/ }).first().click();
  d = dialogo(p, "Ideia");
  if ((await d.getByRole("button", { name: "urgente" }).getAttribute("aria-pressed")) !== "true") falhar("ao reabrir, a etiqueta não está marcada");
  await d.locator("[contenteditable=true]").first().click();
  await p.keyboard.type("Nota da ideia");
  await d.getByRole("button", { name: "Anexar link" }).click();
  const dl = dialogo(p, "Anexar link");
  await dl.getByLabel("Endereço").fill("example.com");
  await dl.getByRole("button", { name: "Anexar link" }).click();
  await espera(p);
  await d.getByRole("button", { name: "Salvar" }).click();
  await espera(p, 600);

  passo("Projetos: projeto, tarefa, onde parei, etiqueta, ligação e anexo");
  await ir(p, "Projetos");
  await p.getByRole("button", { name: "Novo projeto" }).click();
  await dialogo(p).getByLabel("Nome do projeto").fill("Projeto Teste");
  await dialogo(p).getByRole("button", { name: "Criar" }).click();
  await espera(p, 800);
  // Data digitada à mão (relato de Dan: digitando, o campo pulava e o ano virava 275760).
  await main(p).getByLabel("Começo (opcional)").click();
  await p.keyboard.press("Home");
  await p.keyboard.type("11022026", { delay: 120 });
  await espera(p, 800);
  {
    const v = await main(p).getByLabel("Começo (opcional)").inputValue();
    if (v !== "2026-11-02") falhar(`data digitada à mão ficou "${v}", esperado 2026-11-02`);
  }
  await main(p).getByLabel("Nova tarefa").fill("Tarefa um");
  await main(p).getByRole("button", { name: "Adicionar" }).click();
  await espera(p, 600);
  await main(p).getByRole("button", { name: "Anotar" }).click();
  await espera(p, 400);
  await dialogo(p).locator("[contenteditable=true], textarea").first().click();
  await p.keyboard.type("Parei no capítulo 2");
  await dialogo(p).getByRole("button", { name: "Salvar" }).click();
  await espera(p);
  await main(p).getByRole("button", { name: "Escolher etiquetas" }).click();
  await espera(p, 400);
  await dialogo(p).getByText("urgente").click();
  await espera(p, 400);
  await dialogo(p).getByRole("button", { name: "Fechar" }).click();
  await espera(p);
  await main(p).locator("select").first().selectOption({ label: "Ideia: Ideia de teste com acentuação ção" });
  await espera(p);
  await escolherArquivo(p, main(p).getByRole("button", { name: "Anexar arquivo" }), IMAGEM);
  if (!(await textoMain(p)).includes("teste.png")) falhar("anexo do projeto não apareceu");

  passo("Agenda: compromisso com cor, repetindo");
  await ir(p, "Agenda");
  await p.getByRole("button", { name: "Novo compromisso" }).click();
  d = dialogo(p);
  await d.getByLabel("O que é").fill("Consulta teste");
  await d.getByLabel("Começa").fill("14:00");
  await d.getByLabel("Termina").fill("15:00");
  await marcar(d, "Lavanda");
  await marcar(d, "Dias da semana");
  await d.getByRole("button", { name: "Salvar" }).click();
  await espera(p, 700);

  passo("Rotinas: rotina com passo, ícone e imagem");
  await ir(p, "Rotinas");
  await p.getByRole("button", { name: "Nova rotina" }).click();
  await dialogo(p).getByLabel("Nome da rotina").fill("Manhã");
  await dialogo(p).getByRole("button", { name: "Salvar" }).click();
  await espera(p, 600);
  await p.getByRole("button", { name: "Novo passo" }).click();
  d = dialogo(p);
  await d.getByLabel("O que fazer").fill("Beber água");
  await d.getByLabel("Minutos (opcional)").fill("2");
  await marcar(d, "Água");
  await escolherArquivo(p, d.getByRole("button", { name: "Escolher imagem" }), IMAGEM);
  const aviso = await d.innerText();
  if (aviso.includes("web-arquivo:")) falhar("a tela mostra a referência interna em vez do nome do arquivo");
  if (!aviso.includes("teste.png")) falhar("a tela não mostra o nome da imagem escolhida");
  await d.getByRole("button", { name: "Salvar" }).click();
  await espera(p, 800);

  passo("Foco: foco salvo; começar e parar");
  await ir(p, "Foco");
  await p.getByRole("button", { name: "Salvar um foco" }).click();
  d = dialogo(p);
  await d.getByLabel("Nome").fill("Estudar");
  await d.getByLabel("Minutos de foco").fill("45");
  await d.getByLabel(/Minutos de pausa/).fill("10");
  await d.getByRole("button", { name: "Salvar" }).click();
  await espera(p, 600);
  await main(p).getByRole("button", { name: "Começar" }).first().click();
  await espera(p, 1200);
  await p.getByRole("button", { name: "Parar" }).click();
  await espera(p);

  passo("Energia: registro, sinal, kit e camuflagem");
  await ir(p, "Energia");
  await main(p).locator('[aria-label="Energia boa, 4 de 5"]').click();
  await espera(p);
  await main(p).getByRole("textbox", { name: "Novo sinal" }).fill("Luz incomoda");
  await main(p).getByRole("form", { name: "Novo sinal" }).locator("button").click();
  await espera(p, 400);
  await main(p).locator('[aria-label="Adicionar Luz baixa"]').click();
  await espera(p, 400);
  await main(p).locator("button", { hasText: "Um pouco" }).click();
  await espera(p, 400);

  passo("Dinheiro: gasto com grupo novo, entrada, espera e conta fixa");
  await ir(p, "Dinheiro");
  await p.getByRole("button", { name: "Registrar um gasto" }).click();
  d = dialogo(p);
  await d.getByLabel("Quanto?").fill("12,50");
  await d.getByLabel("O que foi?").fill("Almoço");
  await d.getByRole("button", { name: "Novo grupo" }).click();
  await d.getByLabel("Nome do novo grupo").fill("Comida");
  await d.getByRole("button", { name: "Criar grupo" }).click();
  await espera(p);
  await d.getByRole("button", { name: "Guardar" }).click();
  await espera(p, 700);
  await p.getByRole("button", { name: "Registrar dinheiro que entrou" }).click();
  d = dialogo(p);
  await d.getByLabel("Quanto entrou?").fill("1000");
  await d.getByLabel("De onde veio?").fill("Salário");
  await d.getByRole("button", { name: "Guardar" }).click();
  await espera(p, 700);
  await main(p).getByText("Planejar", { exact: true }).click();
  await espera(p, 400);
  await main(p).getByLabel("O que você quer comprar?").fill("Fone");
  await main(p).getByRole("button", { name: "Pôr na espera" }).click();
  await espera(p);
  await main(p).getByRole("button", { name: "Adicionar conta fixa" }).click();
  d = dialogo(p);
  await d.getByLabel("Nome da conta").fill("Internet");
  await d.getByLabel("Quanto, por mês?").fill("100");
  await d.getByLabel("Dia do vencimento").fill("10");
  await d.getByLabel("Avisar quantos dias antes").fill("3");
  await d.getByRole("button", { name: "Salvar conta" }).click();
  await espera(p, 600);
  await main(p).getByText("Entender", { exact: true }).click();
  await espera(p, 600);

  passo("Saúde: remédio com horário, tomei e registro");
  await ir(p, "Saúde");
  await p.getByRole("tab", { name: "Remédios" }).click();
  await p.getByRole("button", { name: "Adicionar remédio" }).click();
  d = dialogo(p);
  await d.getByLabel("Nome do remédio").fill("Remédio X");
  await d.getByLabel("Dose").fill("1 comprimido");
  await d.getByRole("button", { name: "Adicionar horário" }).click();
  await d.locator("input[type=time]").first().fill("08:00");
  await d.getByRole("button", { name: "Salvar remédio" }).click();
  await espera(p, 600);
  await p.getByRole("tab", { name: "Hoje" }).click();
  await espera(p);
  await p.getByRole("button", { name: /Tomei: Remédio X/ }).click();
  await espera(p);
  await p.getByRole("button", { name: "Como estou agora" }).click();
  d = dialogo(p);
  await d.locator("button", { hasText: "Coisa boa" }).click();
  await d.locator('[aria-label="Nível 4 de 5"]').click();
  await d.locator("textarea").fill("Caminhada no sol");
  await d.locator("button", { hasText: "Registrar" }).click();
  await espera(p, 600);

  passo("Cuidado: profissional, anotação, pergunta e sessão");
  await ir(p, "Cuidado");
  await p.getByRole("button", { name: "Adicionar profissional" }).click();
  d = dialogo(p);
  await d.getByLabel("Nome").fill("Dra. Ana");
  await d.getByLabel("Especialidade").fill("psiquiatra");
  await d.getByLabel("Próxima consulta").fill("2026-12-20");
  await d.locator("[contenteditable=true]").click();
  await p.keyboard.type("Consultório centro");
  await d.getByRole("button", { name: "Adicionar" }).click();
  await espera(p, 700);
  await main(p).getByLabel("Escrever uma anotação").fill("Falar do sono");
  await main(p).getByRole("button", { name: "Adicionar", exact: true }).nth(0).click();
  await espera(p);
  await main(p).getByLabel("Escrever uma pergunta").fill("Posso mudar o horário?");
  await main(p).getByRole("button", { name: "Adicionar", exact: true }).last().click();
  await espera(p);
  await main(p).getByRole("button", { name: "Escrever sobre uma sessão" }).click();
  await espera(p);
  await main(p).locator("[contenteditable=true]").last().click();
  await p.keyboard.type("Sessão boa, falamos do sono");
  await main(p).getByRole("button", { name: "Guardar sessão" }).click();
  await espera(p, 600);

  passo("Estudos: nível, matéria e prova");
  await ir(p, "Estudos");
  await p.locator('[aria-label="Escolher Graduação"]').click();
  await espera(p, 700);
  await p.getByRole("button", { name: "Adicionar disciplina" }).click();
  d = dialogo(p);
  await d.getByLabel("Nome da disciplina").fill("Psicologia do desenvolvimento");
  await d.getByLabel(/Créditos/).fill("4");
  await marcar(d, "Céu");
  await d.getByRole("button", { name: "Salvar matéria" }).click();
  await espera(p, 700);
  await p.getByRole("tab", { name: "Esta semana" }).click();
  await espera(p);
  await main(p).getByRole("button", { name: "Adicionar", exact: true }).click();
  await p.getByRole("menuitem", { name: "Prova" }).or(p.getByRole("option", { name: "Prova" })).first().click();
  d = dialogo(p);
  await d.getByLabel("Título").fill("Prova 1");
  await d.getByLabel("Data").fill("2026-12-10");
  await d.getByRole("button", { name: "Salvar" }).click();
  await espera(p, 700);

  passo("Hobbies: interesse com cartão de texto e de imagem");
  await ir(p, "Hobbies");
  await p.getByRole("button", { name: "Adicionar interesse" }).click();
  d = dialogo(p);
  await d.getByLabel("Nome").fill("Origami");
  await d.locator("textarea").fill("Dobras de papel");
  await d.getByRole("button", { name: "Salvar" }).click();
  await espera(p, 700);
  await p.getByRole("button", { name: "Abrir o quadro" }).click();
  await espera(p, 800);
  await p.getByRole("button", { name: "Texto", exact: true }).click();
  await espera(p, 600);
  await p.getByRole("button", { name: "Toque para escrever…" }).click();
  await espera(p, 400); // o editor precisa ganhar o foco antes de digitar
  await p.keyboard.type("Cartão do origami");
  await main(p).getByRole("button", { name: "Guardar" }).click();
  await espera(p, 800);
  if (!(await textoMain(p)).includes("Cartão do origami")) falhar("Hobbies: o texto do cartão não ficou");
  await escolherArquivo(p, p.getByRole("button", { name: "Imagem", exact: true }), IMAGEM);
  await p.getByRole("button", { name: "Voltar para a lista" }).click();
  await espera(p);

  passo("Leitura: livro com arquivo EPUB (desde a 0.46.0)");
  await ir(p, "Leitura");
  await p.getByRole("button", { name: "Adicionar livro" }).click();
  d = dialogo(p);
  await d.getByLabel("Título").fill("Dom Casmurro");
  await d.getByLabel("Autor").fill("Machado de Assis");
  await d.locator("textarea").first().fill("Capítulo 3");
  await escolherArquivo(p, d.getByRole("button", { name: "Escolher arquivo" }), LIVRO);
  await espera(p, 1500);
  await d.getByRole("button", { name: "Salvar livro" }).click();
  await espera(p, 1000);

  passo("Caderno: caderno com um traço de caneta");
  await ir(p, "Caderno");
  await p.getByRole("button", { name: "Novo caderno" }).click();
  await dialogo(p).getByLabel("Nome do caderno").fill("Caderno de testes");
  await dialogo(p).getByRole("button", { name: "Criar caderno" }).click();
  await espera(p, 1000);
  await p.getByRole("button", { name: "Abrir: Caderno de testes" }).click();
  await espera(p, 1500);
  const entendi = p.getByRole("button", { name: "Entendi" });
  if (await entendi.count()) await entendi.click();
  // Desenha dentro da página (desde a 0.50 ela fica inteira e centralizada na tela).
  const folha = await p.locator(".caderno-folha-area").first().boundingBox();
  const x0 = folha.x + folha.width * 0.2, y0 = folha.y + folha.height * 0.45;
  await p.mouse.move(x0, y0);
  await p.mouse.down();
  for (let i = 0; i < 20; i++) {
    await p.mouse.move(x0 + i * 15, y0 + Math.sin(i / 3) * 60);
    await espera(p, 16);
  }
  await p.mouse.up();
  await espera(p, 2500);
  await p.getByRole("button", { name: "Voltar para a estante" }).click();
  await espera(p, 800);

  passo("Minha organização: quadro com colunas, etiqueta e cartão completo");
  await ir(p, "Minha organização");
  await p.getByRole("button", { name: "Novo quadro" }).click();
  d = dialogo(p);
  await d.getByLabel("Nome").fill("Casa");
  await marcar(d, "Menta");
  await d.getByRole("button", { name: "Criar" }).click();
  await espera(p, 1000);
  await p.getByRole("button", { name: "Abrir: Casa" }).click();
  await espera(p, 1000);
  // Colunas: renomear a primeira e criar uma nova.
  await p.getByRole("button", { name: "Renomear coluna: A fazer", exact: true }).click();
  await p.getByLabel("Nome da coluna").fill("Fazendo hoje – Geral");
  await p.getByLabel("Nome da coluna").press("Enter");
  await espera(p, 600);
  await p.getByRole("button", { name: "Nova coluna" }).click();
  await espera(p, 700);
  await p.getByRole("button", { name: "Renomear coluna: Coluna", exact: true }).click();
  await p.getByLabel("Nome da coluna").fill("Outros");
  await p.getByLabel("Nome da coluna").press("Enter");
  await espera(p, 600);
  // Etiqueta do quadro.
  await p.getByRole("button", { name: "Etiquetas", exact: true }).click();
  d = dialogo(p, "Etiquetas do quadro");
  await d.getByRole("button", { name: "Nova etiqueta" }).click();
  await espera(p, 300);
  await d.getByLabel(/Nome da etiqueta/).last().fill("Urgente");
  await d.getByRole("button", { name: "Pronto" }).click();
  await espera(p, 700);
  const novoCartao = p.getByRole("region", { name: "Fazendo hoje – Geral" }).getByLabel("Adicionar cartão");
  for (const x of ["Lavar louça", "Ver filme"]) {
    await novoCartao.fill(x);
    await novoCartao.press("Enter");
    await espera(p, 700);
  }
  // Cartão completo: descrição formatada, checklist, etiqueta, data, anexo e capa.
  await p.getByRole("button", { name: "Abrir o cartão: Lavar louça" }).click();
  await espera(p, 800);
  d = dialogo(p, "Lavar louça");
  await d.locator("[contenteditable=true]").first().click();
  await p.keyboard.press("Control+b");
  await p.keyboard.type("Detergente");
  await p.keyboard.press("Control+b");
  await p.keyboard.type(" acabou");
  await d.getByRole("button", { name: "Checklist", exact: true }).click();
  await espera(p, 500);
  const itemNovo = d.getByLabel("Adicionar item em Checklist");
  for (const x of ["Pratos", "Panelas"]) {
    await itemNovo.fill(x);
    await itemNovo.press("Enter");
    await espera(p, 400);
  }
  await d.getByRole("checkbox", { name: "Pratos", exact: true }).check();
  await d.getByRole("button", { name: "Etiquetas", exact: true }).click();
  await dialogo(p, "Etiquetas").getByRole("button", { name: "Urgente" }).click();
  await dialogo(p, "Etiquetas").getByRole("button", { name: "Pronto" }).click();
  await espera(p, 400);
  await d.getByRole("button", { name: "Data", exact: true }).click();
  await d.getByLabel("Data", { exact: true }).fill("2026-12-15");
  await d.getByLabel("Hora (opcional)").fill("09:30");
  await espera(p, 800);
  await escolherArquivo(p, d.getByRole("button", { name: "Anexar arquivo" }), IMAGEM);
  await d.getByRole("button", { name: "Capa", exact: true }).click();
  await espera(p, 500);
  await dialogo(p, "Capa do cartão").getByRole("button", { name: /^Usar teste\.png como capa$/ }).click();
  await dialogo(p, "Capa do cartão").getByRole("button", { name: "Pronto" }).click();
  await espera(p, 800);
  await d.getByRole("button", { name: "Fechar" }).first().click();
  await espera(p, 800);
  {
    const cartao = p.locator(".org-cartao", { hasText: "Lavar louça" });
    const txt = await cartao.innerText();
    for (const x of ["Urgente", "15 dez, 09:30", "1/2"]) if (!txt.includes(x)) falhar(`Minha organização: o cartão fechado não mostra "${x}"`);
    if (!(await cartao.locator(".org-capa-imagem img").count())) falhar("Minha organização: a capa de imagem não apareceu");
  }
  // Vista Lista e de volta.
  await p.getByRole("radio", { name: "Lista" }).check({ force: true });
  await espera(p, 800);
  if (!(await p.locator(".org-lista").count())) falhar("Minha organização: a vista Lista não abriu");
  if (!(await p.locator(".org-lista").innerText()).includes("Lavar louça")) falhar("Minha organização: a Lista não mostra os cartões");
  await p.getByRole("radio", { name: "Quadro" }).check({ force: true });
  await espera(p, 800);
  // Filtro: só a etiqueta Urgente.
  await p.getByRole("button", { name: "Filtro" }).click();
  await dialogo(p, "Filtrar os cartões").getByText("Urgente").click();
  await dialogo(p, "Filtrar os cartões").getByRole("button", { name: "Pronto" }).click();
  await espera(p, 600);
  {
    const txt = await p.locator(".org-tela").innerText();
    if (txt.includes("Ver filme") || !txt.includes("Lavar louça")) falhar("Minha organização: o filtro por etiqueta não funcionou");
  }
  await p.getByRole("button", { name: "Limpar o filtro" }).first().click();
  await espera(p, 500);
  // Arquivar e restaurar.
  await p.getByRole("button", { name: "Abrir o cartão: Ver filme" }).click();
  await espera(p, 600);
  await dialogo(p, "Ver filme").getByRole("button", { name: "Arquivar" }).click();
  await espera(p, 800);
  if ((await p.locator(".org-quadro").innerText()).includes("Ver filme")) falhar("Minha organização: o cartão arquivado continua no quadro");
  await p.getByRole("button", { name: "Arquivados" }).click();
  await dialogo(p, "Arquivados").getByRole("button", { name: "Restaurar Ver filme" }).click();
  await espera(p, 700);
  await dialogo(p, "Arquivados").getByRole("button", { name: "Fechar" }).click();
  await espera(p, 500);
  if (!(await p.locator(".org-quadro").innerText()).includes("Ver filme")) falhar("Minha organização: o cartão restaurado não voltou");
  // Fica na vista Lista (para conferir depois de recarregar que a escolha foi guardada).
  await p.getByRole("radio", { name: "Lista" }).check({ force: true });
  await espera(p, 800);
  await p.getByRole("button", { name: "Voltar para os quadros" }).click();
  await espera(p);

  passo("Aparência: tema Floresta");
  await ir(p, "Aparência");
  await marcar(p, "Floresta");
  await espera(p, 800);
  await p.getByRole("tab", { name: "Letras" }).click();
  await espera(p, 400);

  passo("Ajustes: abrir cada assunto");
  await ir(p, "Ajustes");
  for (const a of ["Segurança", "Avisos", "Projetos", "Backup e nuvem", "Sincronizar aparelhos", "Exportar", "Janela e atualizações", "Inteligência artificial", "Ditado"]) {
    await main(p).locator("button", { hasText: a }).first().click();
    await espera(p, 700);
  }

  passo("Ajustes > Exportar: os 5 arquivos baixam");
  await main(p).locator("button", { hasText: "Exportar" }).first().click();
  await espera(p);
  for (const n of ["Agenda (.ics)", "Gastos (.csv)", "Registros de saúde (.csv)", "Resumo legível (.md)", "Tudo (.json)"]) {
    const baixado = p.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await main(p).getByRole("button", { name: n }).click();
    const arq = await baixado;
    if (!arq) falhar(`exportar ${n}: nada baixou`);
    else {
      const f = path.join(TMP, arq.suggestedFilename());
      await arq.saveAs(f);
      if (fs.statSync(f).size < 20) falhar(`exportar ${n}: arquivo vazio`);
    }
    await espera(p, 300);
  }
}

// ── Conferência: tudo o que foi criado continua lá ──────────────────────────
async function conferir(p, onde) {
  passo(`conferir os dados (${onde})`);
  const antes = falhas.length;
  const ver = async (modulo, textos) => {
    await ir(p, modulo);
    const t = await textoMain(p);
    for (const x of textos) if (!t.includes(x)) falhar(`${modulo}: sumiu "${x}"`);
  };
  const imagens = () => main(p).locator("img").evaluateAll((es) => es.filter((e) => e.naturalWidth > 0).length);

  await ver("Ideias", ["Ideia de teste com acentuação ção", "urgente", "casa", "tem nota"]);
  if (!(await main(p).locator("li.ideia-item.borda-lavanda").count())) falhar("Ideias: sumiu a cor própria da ideia (Lavanda)");
  await ver("Projetos", ["Projeto Teste"]);
  await main(p).getByText("Projeto Teste").first().click();
  await espera(p, 600);
  const proj = await textoMain(p);
  for (const x of ["Tarefa um", "Parei no capítulo 2", "urgente", "Ideia: Ideia de teste", "teste.png"]) if (!proj.includes(x)) falhar(`Projeto: sumiu "${x}"`);
  await ver("Agenda", ["Consulta teste"]);
  await ver("Rotinas", ["Manhã", "Beber água"]);
  if (!(await imagens())) falhar("Rotinas: a imagem do passo não carregou");
  await ver("Foco", ["Estudar"]);
  await ver("Energia", ["Luz incomoda", "Luz baixa"]);
  await ver("Dinheiro", ["Almoço", "Salário", "R$ 1.000,00"]);
  await ver("Saúde", ["Remédio X", "Caminhada no sol"]);
  await ver("Cuidado", ["Dra. Ana", "Falar do sono", "Posso mudar o horário?", "Sessão boa"]);
  await ver("Estudos", ["Graduação", "Prova 1"]);
  await ver("Hobbies", ["Origami"]);
  await p.getByRole("button", { name: "Abrir o quadro" }).click();
  await espera(p, 1200);
  if (!(await textoMain(p)).includes("Cartão do origami")) falhar("Hobbies: sumiu o cartão de texto");
  if (!(await imagens())) falhar("Hobbies: a imagem do cartão não carregou");
  await p.getByRole("button", { name: "Voltar para a lista" }).click();
  await espera(p, 400);
  await ver("Leitura", ["Dom Casmurro"]);
  // O livro tem arquivo: tocar na capa abre o leitor com o texto do capítulo.
  await p.getByRole("button", { name: /^Dom Casmurro, de .*Abrir para ler$/ }).first().click();
  let achou = false;
  for (let i = 0; i < 20 && !achou; i++) {
    await espera(p, 500);
    for (const f of p.frames()) if ((await f.content().catch(() => "")).includes("órbita tranquila")) achou = true;
  }
  if (!achou) falhar("Leitura: o EPUB não abriu no leitor (texto do capítulo não apareceu)");
  await p.getByRole("button", { name: "Fechar o livro" }).click();
  await espera(p, 600);
  await ver("Caderno", ["Caderno de testes"]);
  await p.getByRole("button", { name: "Abrir: Caderno de testes" }).click();
  await espera(p, 1500);
  const tracos = await p.evaluate(() => [...document.querySelectorAll("svg.caderno-desenho path")].filter((x) => (x.getAttribute("d") || "").length > 100).length);
  if (!tracos) falhar("Caderno: o traço sumiu");
  await p.getByRole("button", { name: "Voltar para a estante" }).click();
  await espera(p, 500);
  await ver("Minha organização", ["Casa", "Lista"]);
  await p.getByRole("button", { name: "Abrir: Casa" }).click();
  await espera(p, 1000);
  {
    const org = await p.locator(".org-tela").innerText();
    for (const x of ["Fazendo hoje – Geral", "Outros", "Lavar louça", "Ver filme", "Urgente", "15 dez, 09:30", "1/2"]) if (!org.includes(x)) falhar(`Minha organização: sumiu "${x}"`);
    if (!(await p.locator(".org-lista").count())) falhar("Minha organização: a vista escolhida (Lista) não ficou guardada");
  }
  await p.getByRole("button", { name: "Abrir o cartão: Lavar louça" }).click();
  await espera(p, 1000);
  {
    const cd = dialogo(p, "Lavar louça");
    const txt = await cd.innerText();
    for (const x of ["Detergente acabou", "teste.png", "Urgente"]) if (!txt.includes(x)) falhar(`Minha organização: no cartão aberto, sumiu "${x}"`);
    // Os itens da checklist ficam em caixas de texto (editáveis): confere pelas caixinhas.
    if (!(await cd.getByRole("checkbox", { name: "Pratos", exact: true }).isChecked().catch(() => false))) falhar("Minha organização: o item feito da checklist sumiu");
    if (!(await cd.getByRole("checkbox", { name: "Panelas", exact: true }).count())) falhar("Minha organização: o item da checklist sumiu");
    if (!(await cd.locator(".texto-rico strong, .rico-conteudo strong").filter({ hasText: "Detergente" }).count())) falhar("Minha organização: o negrito da descrição sumiu");
    await cd.getByRole("button", { name: "Fechar" }).first().click();
    await espera(p, 500);
  }
  await p.getByRole("button", { name: "Voltar para os quadros" }).click();
  await espera(p, 400);
  if (falhas.length === antes) console.log("  ✓ tudo lá");
}

// ── Backup e restauração ────────────────────────────────────────────────────
async function restaurarNoInicio(b, arquivo, comPalavras, palavras, senha = SENHA) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  ligar(p);
  await p.goto(URL_APP);
  await espera(p, 2500);
  await p.getByRole("button", { name: "Já tenho um backup" }).click();
  await espera(p);
  await escolherArquivo(p, p.getByRole("button", { name: "Escolher o arquivo" }), arquivo);
  if (comPalavras) {
    await p.getByRole("button", { name: "Usar as 6 palavras" }).click();
    // Colar as 4 primeiras letras de cada palavra, todas no primeiro campo.
    await p.getByLabel("Palavra 1").fill(palavras.map((w) => w.slice(0, 4)).join(" "));
  } else {
    await p.getByLabel("Senha").fill(senha);
  }
  await p.getByRole("button", { name: "Restaurar" }).click();
  await p.getByRole("button", { name: "Abrir o Órbita" }).click({ timeout: 20000 });
  await espera(p, 2000);
  return { ctx, p };
}

// ── Roteiro ─────────────────────────────────────────────────────────────────
servidor.listen(PORTA, async () => {
  const b = await playwright.chromium.launch({ headless: !MOSTRAR });
  let p;
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    p = await ctx.newPage();
    ligar(p);
    await p.goto(URL_APP);
    await espera(p, 2500);

    const palavras = await criarCofre(p);
    await criarDados(p);

    passo("recarregar a página e entrar com o PIN");
    await p.reload();
    await espera(p, 2500);
    await entrarComPin(p);
    await conferir(p, "depois de recarregar");

    passo("guardar algo e fechar a aba logo em seguida; abrir numa aba nova");
    await guardarIdeia(p, "Ideia antes de fechar");
    await espera(p, 150);
    await p.close({ runBeforeUnload: true });
    p = await ctx.newPage();
    ligar(p);
    await p.goto(URL_APP);
    await espera(p, 2500);
    await entrarComPin(p);
    if (!(await temIdeia(p, "Ideia antes de fechar"))) falhar("o que foi guardado logo antes de fechar a aba se perdeu");
    await conferir(p, "numa aba nova");

    passo("bloquear; PIN errado; PIN certo");
    await guardarIdeia(p, "Ideia antes de bloquear");
    await espera(p, 100);
    await bloquear(p);
    await p.getByLabel("PIN").fill("1111");
    await p.getByRole("button", { name: "Entrar" }).click();
    await espera(p, 1500);
    if (!(await p.locator("body").innerText()).includes("O PIN não confere")) falhar("PIN errado não avisou");
    await entrarComPin(p);
    if (!(await temIdeia(p, "Ideia antes de bloquear"))) falhar("o que foi guardado logo antes de bloquear se perdeu");

    passo("bloquear e abrir com as 6 palavras");
    await bloquear(p);
    await p.getByRole("button", { name: "Usar a chave de recuperação" }).click();
    await p.getByRole("button", { name: "Digitar as 6 palavras" }).click();
    await digitarPalavras(p, palavras);
    await p.getByRole("button", { name: "Abrir" }).click();
    await espera(p, 2500);
    if (!(await temIdeia(p, "Ideia antes de bloquear"))) falhar("não abriu com as 6 palavras");

    passo("Ajustes > Segurança: ver a chave e criar uma senha");
    await ir(p, "Ajustes");
    await main(p).locator("button", { hasText: "Segurança" }).first().click();
    await espera(p);
    await p.getByRole("button", { name: "Ver a chave de recuperação" }).click();
    await dialogo(p).getByLabel("PIN").fill(PIN);
    await dialogo(p).getByRole("button", { name: "Continuar" }).click();
    await espera(p, 1200);
    const chave = await dialogo(p).innerText();
    if (!palavras.every((w) => chave.includes(w))) falhar("Ver a chave mostrou palavras diferentes");
    await dialogo(p).getByRole("button", { name: "Fechar" }).click();
    await espera(p, 400);
    await p.getByRole("button", { name: "Criar uma senha (opcional)" }).click();
    await dialogo(p).getByLabel("PIN").fill(PIN);
    await dialogo(p).getByLabel("Senha nova").fill(SENHA);
    await dialogo(p).getByLabel("Digite a senha de novo").fill(SENHA);
    await dialogo(p).getByRole("button", { name: "Salvar" }).click();
    await espera(p, 2000);

    passo("fazer backup agora");
    await guardarIdeia(p, "Ideia logo antes do backup");
    await espera(p, 100);
    await ir(p, "Ajustes");
    await main(p).locator("button", { hasText: "Backup e nuvem" }).first().click();
    await espera(p);
    const baixado = p.waitForEvent("download", { timeout: 15000 });
    await p.getByRole("button", { name: "Fazer backup agora" }).click();
    const arq = await baixado;
    const backup = path.join(TMP, "backup.orbita-backup");
    await arq.saveAs(backup);
    // O mesmo formato do Windows: ORBITABK + tamanho + cabeçalho JSON + banco trancado.
    const bruto = fs.readFileSync(backup);
    const cab = bruto.subarray(0, 8).toString() === "ORBITABK" ? JSON.parse(bruto.subarray(12, 12 + bruto.readUInt32LE(8)).toString()) : {};
    if (cab.versao !== 2 || cab.origem !== "navegador" || !cab.envelopes?.senha || !cab.envelopes?.recuperacao) falhar(`backup com formato inesperado: ${JSON.stringify(cab).slice(0, 120)}`);
    if (bruto.includes("Ideia logo antes do backup")) falhar("o backup tem texto aberto");
    if (CRUZADO) {
      fs.mkdirSync(CRUZADO, { recursive: true });
      fs.copyFileSync(backup, path.join(CRUZADO, "do-navegador.orbita-backup"));
      fs.writeFileSync(path.join(CRUZADO, "do-navegador.json"), JSON.stringify({ senha: SENHA, palavras }));
      console.log(`  backup do navegador em ${CRUZADO} (abra no Windows: cargo test abrir_backup_do_navegador)`);
    }

    passo("restaurar com a senha num navegador limpo");
    const r1 = await restaurarNoInicio(b, backup, false, palavras);
    await conferir(r1.p, "backup restaurado com a senha");
    if (!(await temIdeia(r1.p, "Ideia logo antes do backup"))) falhar("o backup não levou o que foi guardado logo antes dele");
    passo("depois de restaurar: guardar, recarregar e entrar com a senha");
    await guardarIdeia(r1.p, "Ideia depois de restaurar");
    await espera(r1.p, 900);
    await r1.p.reload();
    await espera(r1.p, 2500);
    await r1.p.getByLabel("Senha").fill(SENHA);
    await r1.p.getByRole("button", { name: "Entrar" }).click();
    await espera(r1.p, 2000);
    if (!(await temIdeia(r1.p, "Ideia depois de restaurar"))) falhar("o que foi guardado depois de restaurar se perdeu");
    await r1.ctx.close();

    passo("restaurar com as 6 palavras num navegador limpo");
    const r2 = await restaurarNoInicio(b, backup, true, palavras);
    await conferir(r2.p, "backup restaurado com as 6 palavras");

    passo("restaurar por cima dos dados (Ajustes) guarda uma cópia do que havia");
    await guardarIdeia(r2.p, "Ideia que vai sair com a restauração");
    await espera(r2.p, 100); // de propósito: o salvamento atrasado ainda está pendente
    await ir(r2.p, "Ajustes");
    await main(r2.p).locator("button", { hasText: "Backup e nuvem" }).first().click();
    await espera(r2.p);
    await r2.p.getByRole("button", { name: "Restaurar um backup" }).click();
    const dr = dialogo(r2.p);
    await escolherArquivo(r2.p, dr.getByRole("button", { name: "Escolher o arquivo" }), backup);
    await dr.locator("input[type=password]").fill(SENHA);
    await dr.getByRole("button", { name: "Restaurar" }).click();
    await r2.p.getByRole("button", { name: "Abrir o Órbita" }).click({ timeout: 20000 });
    await espera(r2.p, 1500);
    if (await temIdeia(r2.p, "Ideia que vai sair com a restauração")) falhar("restaurar por cima não trocou os dados");
    const chaves = await r2.p.evaluate(
      () =>
        new Promise((res) => {
          const q = indexedDB.open("orbita");
          q.onsuccess = () => {
            const d = q.result;
            const t = d.transaction(d.objectStoreNames[0]).objectStore(d.objectStoreNames[0]).getAllKeys();
            t.onsuccess = () => res(t.result);
          };
        }),
    );
    if (!chaves.some((k) => String(k).startsWith("antes-da-restauracao-"))) falhar("restaurar por cima não guardou a cópia de segurança");
    await r2.p.reload();
    await espera(r2.p, 2500);
    await r2.p.getByLabel("Senha").fill(SENHA);
    await r2.p.getByRole("button", { name: "Entrar" }).click();
    await espera(r2.p, 2000);
    await conferir(r2.p, "depois de restaurar por cima e recarregar");
    await r2.ctx.close();

    if (CRUZADO && fs.existsSync(path.join(CRUZADO, "do-windows.orbita-backup"))) {
      const doWindows = path.join(CRUZADO, "do-windows.orbita-backup");
      const w = JSON.parse(fs.readFileSync(path.join(CRUZADO, "do-windows.json"), "utf8"));
      const conferirWindows = async (pg, onde) => {
        if (!(await temIdeia(pg, "Ideia vinda do Windows"))) falhar(`${onde}: sem a ideia do Windows`);
        await ir(pg, "Agenda");
        if (!(await textoMain(pg)).includes("Compromisso vindo do Windows")) falhar(`${onde}: sem o compromisso do Windows`);
      };
      for (const comPalavras of [false, true]) {
        passo(`abrir o backup feito no Windows num navegador limpo (${comPalavras ? "6 palavras" : "senha"})`);
        const t0 = Date.now();
        const rw = await restaurarNoInicio(b, doWindows, comPalavras, w.palavras, w.senha);
        console.log(`  restaurado em ${((Date.now() - t0) / 1000).toFixed(1)} s (com as esperas do roteiro)`);
        await conferirWindows(rw.p, "backup do Windows");
        if (!comPalavras) {
          passo("depois: recarregar, entrar com a senha do Windows e ver a chave de recuperação");
          await rw.p.reload();
          await espera(rw.p, 2500);
          await rw.p.getByLabel("Senha").fill(w.senha);
          await rw.p.getByRole("button", { name: "Entrar" }).click();
          await espera(rw.p, 2500);
          await conferirWindows(rw.p, "depois de recarregar");
          await ir(rw.p, "Ajustes");
          await main(rw.p).locator("button", { hasText: "Segurança" }).first().click();
          await espera(rw.p);
          await rw.p.getByRole("button", { name: "Ver a chave de recuperação" }).click();
          await dialogo(rw.p).locator("input[type=password]").first().fill(w.senha);
          await dialogo(rw.p).getByRole("button", { name: "Continuar" }).click();
          await espera(rw.p, 1500);
          const ch = await dialogo(rw.p).innerText();
          if (!w.palavras.every((x) => ch.includes(x))) falhar("Ver a chave não mostrou as palavras do Windows");
          await dialogo(rw.p).getByRole("button", { name: "Fechar" }).click();
        }
        await rw.ctx.close();
      }
    } else if (CRUZADO) {
      console.log("· (sem do-windows.orbita-backup na pasta: pulei a abertura do backup do Windows)");
    }
  } catch (e) {
    falhar(`o roteiro parou: ${String(e).split("\n")[0]}`);
    if (p && !p.isClosed()) await p.screenshot({ path: path.join(TMP, "erro.png") }).catch(() => {});
  } finally {
    await b.close();
    servidor.close();
  }

  console.log("\n══ Resultado ══");
  console.log(`Erros no console/página: ${erros.length}`);
  for (const e of erros) console.log("  " + e);
  const foraDoMotor = erros.filter((e) => e.includes("fora do motor"));
  if (foraDoMotor.length) console.log("  (comando sem versão no navegador: crie em src/web/modoWeb.ts, seção `sobre`)");
  console.log(`Falhas: ${falhas.length}`);
  for (const f of falhas) console.log("  " + f);
  console.log(`Arquivos do teste em ${TMP}`);
  process.exit(erros.length || falhas.length ? 1 : 0);
});
