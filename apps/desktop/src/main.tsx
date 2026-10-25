import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/atkinson-hyperlegible-next/wght.css";
import "@fontsource-variable/lexend/wght.css";
import "./fontes/opendyslexic/opendyslexic.css";
import { aplicarAparencia } from "./aparencia";
import { App } from "./app/App";
import { ProvedorPreferencias } from "./estado";
import { carregar } from "./preferencias";
import "./estilos/base.css";
import "./estilos/componentes.css";
import "./estilos/moldura.css";
import "./estilos/paginas.css";

// Aplica a aparência antes do primeiro desenho, para a tela não piscar com outras cores.
aplicarAparencia(carregar());

// No app instalado, F5 e Ctrl+R recarregariam a janela como num navegador.
if (import.meta.env.PROD) {
  window.addEventListener("keydown", (e) => {
    const recarregar = e.key === "F5" || ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R"));
    if (recarregar) e.preventDefault();
  });
}

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <ProvedorPreferencias>
      <App />
    </ProvedorPreferencias>
  </StrictMode>,
);
