import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pacote from "./package.json" with { type: "json" };

// Porta fixa para o Tauri encontrar a interface durante o desenvolvimento.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  define: { __VERSAO__: JSON.stringify(pacote.version) },
  server: { port: 1420, strictPort: true },
  build: { target: "es2022" },
});
