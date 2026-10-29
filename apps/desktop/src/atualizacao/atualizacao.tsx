import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { MODO_WEB, noApp } from "../api";
import { textos } from "../textos/pt-BR";

// Atualização dentro do app (princípio 1: nada muda sem aviso).
// O Órbita só consulta se há versão nova; baixar e instalar é sempre a pessoa que manda.

export interface Atualizacao {
  versao: string;
  /** O que mudou, em Markdown. */
  notas: string;
  /** Baixa, instala e abre de novo. `aoProgresso` recebe a fração baixada (0 a 1) ou null se não der para saber. */
  instalar: (aoProgresso: (fracao: number | null) => void) => Promise<void>;
}

const t = textos.atualizacao;

/** Versão de navegador: pede ao service worker para passar a abrir a versão
 *  mais nova (que ele já guardou) e espera a troca. */
async function trocarParaUltimaVersao(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  await reg.update().catch(() => {});
  const novo = reg.installing ?? reg.waiting;
  if (novo && novo.state !== "activated") {
    await new Promise<void>((pronto) => {
      const ver = () => (novo.state === "activated" || novo.state === "redundant") && pronto();
      novo.addEventListener("statechange", ver);
      ver();
    });
  }
  const ativo = reg.active;
  if (!ativo) return;
  await new Promise<void>((pronto) => {
    const limite = setTimeout(pronto, 8000);
    const ouvir = (e: MessageEvent) => {
      if (e.data?.tipo !== "versao-trocada") return;
      clearTimeout(limite);
      navigator.serviceWorker.removeEventListener("message", ouvir);
      pronto();
    };
    navigator.serviceWorker.addEventListener("message", ouvir);
    ativo.postMessage({ tipo: "usar-ultima" });
  });
}

async function consultar(): Promise<Atualizacao | null> {
  if (MODO_WEB) {
    // A versão publicada no site; a que está aberta só muda se a pessoa instalar.
    const r = await fetch("./versao.json", { cache: "no-store" });
    if (!r.ok) throw new Error(`versao.json: ${r.status}`);
    const { versao, notas } = (await r.json()) as { versao: string; notas: string };
    if (versao === __VERSAO__) return null;
    return {
      versao,
      notas,
      instalar: async (aoProgresso) => {
        aoProgresso(null);
        await trocarParaUltimaVersao();
        location.reload();
      },
    };
  }
  if (!noApp) {
    // Simulação no navegador: `?atualizacao=1` mostra uma versão nova.
    if (!new URLSearchParams(globalThis.location?.search ?? "").get("atualizacao")) return null;
    return {
      versao: "0.20.1",
      notas: "- Procurar atualização em Ajustes.\n- Correções pequenas no quadro de ideias.",
      instalar: async (aoProgresso) => {
        for (let i = 1; i <= 10; i++) {
          await new Promise((r) => setTimeout(r, 150));
          aoProgresso(i / 10);
        }
      },
    };
  }
  const { check } = await import("@tauri-apps/plugin-updater");
  const encontrada = await check();
  if (!encontrada) return null;
  return {
    versao: encontrada.version,
    notas: encontrada.body ?? "",
    instalar: async (aoProgresso) => {
      let total: number | null = null;
      let baixado = 0;
      await encontrada.downloadAndInstall((e) => {
        if (e.event === "Started") total = e.data.contentLength ?? null;
        else if (e.event === "Progress") {
          baixado += e.data.chunkLength;
          aoProgresso(total ? Math.min(1, baixado / total) : null);
        }
      });
      // No Windows o instalador já fecha o Órbita; nos outros sistemas, abre de novo aqui.
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}

type Estado =
  | { fase: "parado" }
  | { fase: "procurando" }
  | { fase: "em-dia" }
  | { fase: "erro"; mensagem: string }
  | { fase: "disponivel"; atualizacao: Atualizacao };

interface Contexto {
  estado: Estado;
  /** A pessoa disse "agora não": o aviso some até o Órbita abrir de novo. */
  adiada: boolean;
  procurar: () => Promise<void>;
  adiar: () => void;
}

const Ctx = createContext<Contexto>({ estado: { fase: "parado" }, adiada: false, procurar: async () => {}, adiar: () => {} });
export const useAtualizacao = () => useContext(Ctx);

export function ProvedorAtualizacao({ procurarAoAbrir, children }: { procurarAoAbrir: boolean; children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ fase: "parado" });
  const [adiada, setAdiada] = useState(false);

  const procurar = useCallback(async () => {
    setEstado({ fase: "procurando" });
    try {
      const a = await consultar();
      setEstado(a ? { fase: "disponivel", atualizacao: a } : { fase: "em-dia" });
    } catch {
      setEstado({ fase: "erro", mensagem: t.erroProcurar });
    }
  }, []);

  // Ao abrir, uma consulta só, um pouco depois, para não pesar no começo. Erro aqui fica quieto.
  useEffect(() => {
    if (!procurarAoAbrir) return;
    const id = setTimeout(async () => {
      try {
        const a = await consultar();
        if (a) setEstado({ fase: "disponivel", atualizacao: a });
      } catch {
        // Sem internet, por exemplo: tenta de novo na próxima vez que abrir.
      }
    }, 8000);
    return () => clearTimeout(id);
  }, [procurarAoAbrir]);

  return <Ctx.Provider value={{ estado, adiada, procurar, adiar: () => setAdiada(true) }}>{children}</Ctx.Provider>;
}
