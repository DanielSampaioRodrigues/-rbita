// Servidor da "pasta de mentira" da sincronização (ver src/sincronia/pastaDeMentira.ts, PastaHttp).
// Guarda os arquivos na memória. Usado pelo teste de ponta a ponta (scripts/teste-sync.cjs)
// e pelo `pnpm dev` (vite.config.ts), sempre em /__pasta-teste/.
//
//   GET    /__pasta-teste/lista?prefixo=x   → [{ nome, versao, alteradoEm }]
//   GET    /__pasta-teste/arquivo/<nome>    → texto (404 se não existe)
//   PUT    /__pasta-teste/arquivo/<nome>    → { nome, versao, alteradoEm }
//   DELETE /__pasta-teste/arquivo/<nome>
//   POST   /__pasta-teste/estado            → { semInternet, negado } (fingir falhas)
// Com `semInternet`, responde 503 (o app entende "sem internet"); com `negado`, 401.

const PREFIXO = "/__pasta-teste/";

function criarPasta() {
  const arquivos = new Map();
  const estado = { semInternet: false, negado: false };
  let contador = 0;

  /** Atende o pedido se for da pasta; devolve false se não for. */
  function atender(q, s) {
    const url = new URL(q.url, "http://x");
    if (!url.pathname.startsWith(PREFIXO)) return false;
    const resto = url.pathname.slice(PREFIXO.length);
    const json = (codigo, v) => (s.writeHead(codigo, { "content-type": "application/json", "cache-control": "no-store" }), s.end(JSON.stringify(v)));
    let corpo = "";
    q.setEncoding("utf8");
    q.on("data", (c) => (corpo += c));
    q.on("end", () => {
      if (resto === "estado" && q.method === "POST") {
        Object.assign(estado, JSON.parse(corpo || "{}"));
        return json(200, estado);
      }
      if (estado.semInternet) return (s.writeHead(503), s.end());
      if (estado.negado) return (s.writeHead(401), s.end());
      if (resto === "lista" && q.method === "GET") {
        const p = url.searchParams.get("prefixo") || "";
        return json(200, [...arquivos].filter(([n]) => n.startsWith(p)).map(([nome, a]) => ({ nome, versao: String(a.versao), alteradoEm: a.alteradoEm })));
      }
      if (resto.startsWith("arquivo/")) {
        const nome = decodeURIComponent(resto.slice("arquivo/".length));
        if (!/^[\w.-]+$/.test(nome)) return (s.writeHead(400), s.end());
        if (q.method === "GET") {
          const a = arquivos.get(nome);
          if (!a) return (s.writeHead(404), s.end());
          s.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
          return s.end(a.conteudo);
        }
        if (q.method === "PUT") {
          const a = { conteudo: corpo, versao: ++contador, alteradoEm: Date.now() };
          arquivos.set(nome, a);
          return json(200, { nome, versao: String(a.versao), alteradoEm: a.alteradoEm });
        }
        if (q.method === "DELETE") {
          arquivos.delete(nome);
          return (s.writeHead(204), s.end());
        }
      }
      s.writeHead(404);
      s.end();
    });
    return true;
  }

  return { atender, arquivos, estado };
}

module.exports = { criarPasta, PREFIXO };
