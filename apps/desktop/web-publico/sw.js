// Service worker da versão de navegador (iPad). Gerado no build: VERSAO e
// ARQUIVOS são preenchidos pelo vite.config.ts.
//
// Princípio 1 (nada muda sem aviso): cada versão fica guardada no seu próprio
// cache, e o app continua abrindo a versão "ativa" até a pessoa aceitar a nova
// (o app pede pelo aviso de atualização). Assim funciona sem internet e nunca
// troca de versão sozinho.

const VERSAO = "__VERSAO__";
const ARQUIVOS = __ARQUIVOS__;

const CACHE = `orbita-${VERSAO}`;
const GALERIA = "orbita-galeria";
const PONTEIRO = "orbita-ativa";
const BASE = new URL("./", self.location).href;
const CHAVE_ATIVA = `${BASE}__versao-ativa`;

async function lerAtiva() {
  const r = await (await caches.open(PONTEIRO)).match(CHAVE_ATIVA);
  return r ? r.text() : null;
}
async function definirAtiva(v) {
  await (await caches.open(PONTEIRO)).put(CHAVE_ATIVA, new Response(v));
}
async function limpar(ativa) {
  const manter = new Set([CACHE, GALERIA, PONTEIRO, `orbita-${ativa}`]);
  for (const nome of await caches.keys()) if (nome.startsWith("orbita-") && !manter.has(nome)) await caches.delete(nome);
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll(ARQUIVOS.map((a) => new Request(BASE + a, { cache: "reload" })));
      if (!(await lerAtiva())) await definirAtiva(VERSAO);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      await limpar((await lerAtiva()) ?? VERSAO);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (e) => {
  if (e.data?.tipo !== "usar-ultima") return;
  e.waitUntil(
    (async () => {
      await definirAtiva(VERSAO);
      await limpar(VERSAO);
      e.source?.postMessage({ tipo: "versao-trocada", versao: VERSAO });
    })(),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(BASE)) return;
  const caminho = req.url.slice(BASE.length).split(/[?#]/)[0];

  // A versão publicada mais nova: sempre da internet, nunca guardada.
  if (caminho === "versao.json") return;

  // Abrir o app: a página da versão ativa (funciona sem internet).
  if (req.mode === "navigate") {
    e.respondWith(
      (async () => {
        const ativa = (await lerAtiva()) ?? VERSAO;
        const r = (await (await caches.open(`orbita-${ativa}`)).match(`${BASE}index.html`)) ?? (await (await caches.open(CACHE)).match(`${BASE}index.html`));
        return r ?? fetch(req);
      })(),
    );
    return;
  }

  // Capas e figurinhas da galeria: guardadas na primeira vez que aparecem.
  if (caminho.startsWith("galeria/")) {
    e.respondWith(
      (async () => {
        const c = await caches.open(GALERIA);
        const achado = await c.match(req);
        if (achado) return achado;
        const r = await fetch(req);
        if (r.ok) await c.put(req, r.clone());
        return r;
      })(),
    );
    return;
  }

  // O resto (scripts, estilos, fontes, ícones): de qualquer versão guardada.
  e.respondWith((async () => (await caches.match(req)) ?? fetch(req))());
});
