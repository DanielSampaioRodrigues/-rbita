import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import pacote from "./package.json" with { type: "json" };

// Versão de navegador (iPad): só quando VITE_ORBITA_WEB=1. Acrescenta o que faz
// o site virar um app na tela de início (manifesto, ícones, tela cheia) e o
// service worker que guarda os arquivos para abrir sem internet.
const WEB = process.env.VITE_ORBITA_WEB === "1";

function versaoDeNavegador(): Plugin {
  const pasta = new URL("./web-publico/", import.meta.url);
  const icones = ["icone-180.png", "icone-192.png", "icone-512.png", "icone-maskable-512.png"];
  return {
    name: "orbita-web",
    apply: "build",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace(
          "</head>",
          [
            '    <link rel="manifest" href="./manifest.webmanifest" />',
            '    <link rel="apple-touch-icon" href="./icone-180.png" />',
            '    <meta name="apple-mobile-web-app-capable" content="yes" />',
            '    <meta name="mobile-web-app-capable" content="yes" />',
            '    <meta name="apple-mobile-web-app-title" content="Órbita" />',
            '    <meta name="apple-mobile-web-app-status-bar-style" content="default" />',
            '    <meta name="theme-color" content="#f3efe6" />',
            "  </head>",
          ].join("\n"),
        );
    },
    generateBundle(_opcoes, bundle) {
      for (const nome of icones) this.emitFile({ type: "asset", fileName: nome, source: readFileSync(new URL(nome, pasta)) });
      this.emitFile({
        type: "asset",
        fileName: "manifest.webmanifest",
        source: JSON.stringify(
          {
            name: "Órbita",
            short_name: "Órbita",
            description: "Organização da vida, com calma, para pessoas neurodivergentes.",
            lang: "pt-BR",
            start_url: "./",
            scope: "./",
            display: "standalone",
            background_color: "#f3efe6",
            theme_color: "#f3efe6",
            icons: [
              { src: "./icone-192.png", sizes: "192x192", type: "image/png" },
              { src: "./icone-512.png", sizes: "512x512", type: "image/png" },
              { src: "./icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            ],
          },
          null,
          2,
        ),
      });
      // O que mudou nesta versão: o primeiro bloco das notas (antes do primeiro "---").
      const notas = readFileSync(new URL("./notas-da-versao.md", import.meta.url), "utf8").split(/\n---\n/)[0].trim();
      this.emitFile({ type: "asset", fileName: "versao.json", source: JSON.stringify({ versao: pacote.version, notas }) });
      const arquivos = [...new Set([...Object.keys(bundle), "index.html", ...icones, "manifest.webmanifest"])].filter((f) => f !== "versao.json" && f !== "sw.js").sort();
      const sw = readFileSync(new URL("sw.js", pasta), "utf8").replace("__VERSAO__", pacote.version).replace("__ARQUIVOS__", JSON.stringify(arquivos));
      this.emitFile({ type: "asset", fileName: "sw.js", source: sw });
    },
  };
}

// Em desenvolvimento, a "pasta de mentira" da sincronização em /__pasta-teste/ (só com
// localStorage "orbita-sync-teste" ligado ou ?sync-teste no endereço; ver src/sincronia/).
function pastaDeTeste(): Plugin {
  return {
    name: "orbita-pasta-teste",
    apply: "serve",
    configureServer(servidor) {
      const { criarPasta } = createRequire(import.meta.url)("./scripts/pasta-teste.cjs") as { criarPasta: () => { atender: (q: unknown, s: unknown) => boolean } };
      const pasta = criarPasta();
      servidor.middlewares.use((q, s, seguir) => {
        if (!pasta.atender(q, s)) seguir();
      });
    },
  };
}

// Porta fixa para o Tauri encontrar a interface durante o desenvolvimento.
export default defineConfig({
  plugins: [react(), pastaDeTeste(), ...(WEB ? [versaoDeNavegador()] : [])],
  clearScreen: false,
  define: { __VERSAO__: JSON.stringify(pacote.version) },
  // Na web, caminhos relativos: o app funciona em qualquer subpasta do site.
  base: WEB ? "./" : "/",
  server: { port: 1420, strictPort: true },
  build: { target: "es2022", ...(WEB ? { outDir: "dist-web" } : {}) },
});
