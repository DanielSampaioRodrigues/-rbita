const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "pkg");
const srv = http.createServer((q, s) => {
  const f = path.join(dir, q.url === "/" ? "index.html" : q.url.slice(1));
  const tipo = f.endsWith(".wasm") ? "application/wasm" : f.endsWith(".js") ? "text/javascript" : "text/html";
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200, { "content-type": tipo }); s.end(d); } });
}).listen(8765, async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on("console", (m) => console.log("console:", m.text()));
  await p.goto("http://localhost:8765/");
  await p.waitForFunction(() => document.getElementById("r").textContent !== "...", null, { timeout: 30000 });
  console.log(await p.textContent("#r")); await b.close(); srv.close();
});
