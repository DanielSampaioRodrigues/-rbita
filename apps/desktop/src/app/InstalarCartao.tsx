// Cartão discreto "Instalar o Órbita", só na versão de navegador e só enquanto o
// app ainda não está na tela de início. Aparece uma vez por visita; "Agora não"
// esconde por 7 dias e "Não mostrar mais" esconde para sempre. No iPhone e no
// iPad não existe botão de instalar: o cartão explica o caminho pelo Compartilhar.

import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { Download, X } from "../icones";
import { MODO_WEB } from "../api";
import { textos } from "../textos/pt-BR";

const CHAVE = "orbita-instalar";
const CHAVE_VISITA = "orbita-instalar-visto";
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// O navegador dispara "beforeinstallprompt" cedo, antes de o cartão existir: guardamos o evento.
let pedidoInstalar: EventoInstalar | null = null;
if (typeof window !== "undefined" && MODO_WEB) {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    pedidoInstalar = e as EventoInstalar;
  });
}

const t = textos.instalar;

function jaInstalado(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || (globalThis.matchMedia?.("(display-mode: standalone)").matches ?? false);
}

/** iPhone e iPad (o iPadOS se apresenta como Mac, mas tem toque). */
function ehIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function deveMostrar(): boolean {
  if (!MODO_WEB || jaInstalado()) return false;
  try {
    if (sessionStorage.getItem(CHAVE_VISITA)) return false;
    const v = localStorage.getItem(CHAVE);
    if (v === "nunca") return false;
    if (v && Date.now() - Number(v) < SETE_DIAS) return false;
  } catch { /* sem armazenamento: mostra mesmo assim */ }
  return true;
}

export function InstalarCartao() {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    if (!deveMostrar()) return;
    setVisivel(true);
    try { sessionStorage.setItem(CHAVE_VISITA, "1"); } catch { /* ignora */ }
  }, []);
  if (!visivel) return null;

  const fechar = (valor: string) => {
    try { localStorage.setItem(CHAVE, valor); } catch { /* ignora */ }
    setVisivel(false);
  };
  const instalar = async () => {
    const p = pedidoInstalar;
    if (!p) return;
    pedidoInstalar = null;
    await p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome === "accepted") fechar("nunca");
  };
  const ios = ehIos();

  return (
    <aside className="cartao instalar-cartao" aria-label={t.titulo}>
      <div className="instalar-texto">
        <p className="instalar-titulo com-icone"><Download aria-hidden="true" size="1.1em" /> {t.titulo}</p>
        <p className="texto-suave pequeno">{t.texto}</p>
        <p className="pequeno">{ios ? t.ios : pedidoInstalar ? null : t.outros}</p>
      </div>
      <div className="botoes">
        {!ios && pedidoInstalar && <Button className="botao principal" onPress={() => void instalar()}>{t.instalar}</Button>}
        <Button className="botao" onPress={() => fechar(String(Date.now()))}>{t.agoraNao}</Button>
        <Button className="link" onPress={() => fechar("nunca")}>{t.nuncaMais}</Button>
      </div>
      <Button className="botao-icone instalar-fechar" aria-label={t.agoraNao} onPress={() => fechar(String(Date.now()))}>
        <X aria-hidden="true" size="1.1em" />
      </Button>
    </aside>
  );
}
