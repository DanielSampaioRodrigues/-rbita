// Liga o maestro da sincronização ao app (ver docs/decisoes/0012-sincronizacao.md, etapa 2b).
// Fica montado só com o cofre aberto: bloquear desmonta e para tudo.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../api";
import { avisarMudanca, ouvirMudancas } from "../dados";
import { agendarSincronia, type Agenda } from "./agenda";
import type { Armazenamento } from "./armazenamento";
import { entrarComSenha, ligarComoPrimeiro, Maestro, type EstadoSincronia } from "./maestro";
import { PastaHttp } from "./pastaDeMentira";

const CHAVE_TESTE = "orbita-sync-teste";

/** Modo de teste: localStorage "orbita-sync-teste" = "1", ou ?sync-teste no endereço (fica lembrado). */
export function modoTesteLigado(): boolean {
  try {
    if (new URLSearchParams(globalThis.location?.search ?? "").has("sync-teste")) {
      globalThis.localStorage?.setItem(CHAVE_TESTE, "1");
      return true;
    }
    return globalThis.localStorage?.getItem(CHAVE_TESTE) === "1";
  } catch {
    return false;
  }
}

/**
 * O lugar onde os aparelhos trocam arquivos. O Drive (etapa 2c) entra aqui; até lá,
 * null (sem sincronização), ou a pasta de mentira no modo de teste.
 */
export function armazenamentoAtual(): Armazenamento | null {
  if (modoTesteLigado()) return new PastaHttp();
  return null;
}

export interface Sincronia {
  /** Há pasta e este aparelho tem a chave: o aviso aparece. */
  ligada: boolean;
  estado: EstadoSincronia;
  sincronizarAgora: () => Promise<void>;
  /** Para a tela de ligar (etapa 2d): primeiro aparelho cria a chave; aparelho novo entra. */
  ligarComoPrimeiro: (senha: string) => Promise<void>;
  entrarComSenha: (senha: string) => Promise<boolean>;
}

const parado: EstadoSincronia = { fase: "parado", ultima: null, motivo: null };
const semPasta = () => Promise.reject(new Error("A sincronização não está ligada neste aparelho."));
const Contexto = createContext<Sincronia>({ ligada: false, estado: parado, sincronizarAgora: async () => undefined, ligarComoPrimeiro: semPasta, entrarComSenha: semPasta });

export const useSincronia = () => useContext(Contexto);

export function ProvedorSincronia({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSincronia>(parado);
  const [arm] = useState(armazenamentoAtual);
  const agenda = useRef<Agenda | null>(null);

  useEffect(() => {
    if (!arm) return;
    // O aviso de "os dados mudaram" que a própria sincronização dá não conta como mudança daqui.
    let daSincronia = false;
    const maestro = new Maestro({
      armazenamento: arm,
      api,
      aoMudarDados: () => {
        daSincronia = true;
        try {
          avisarMudanca();
        } finally {
          daSincronia = false;
        }
      },
    });
    const pararDeOuvir = maestro.ouvir(setEstado);
    const a = agendarSincronia(maestro);
    agenda.current = a;
    const pararMudancas = ouvirMudancas(() => {
      if (!daSincronia) a.mudouAqui();
    });
    return () => {
      pararMudancas();
      pararDeOuvir();
      a.parar();
      agenda.current = null;
    };
  }, [arm]);

  const valor = useMemo<Sincronia>(
    () => ({
      ligada: arm !== null && estado.fase !== "parado" && estado.fase !== "sem-chave",
      estado,
      sincronizarAgora: async () => void (await agenda.current?.agora()),
      ligarComoPrimeiro: async (senha) => {
        if (!arm) return semPasta();
        await ligarComoPrimeiro(arm, api, senha);
        await agenda.current?.agora();
      },
      entrarComSenha: async (senha) => {
        if (!arm) return semPasta();
        const ok = await entrarComSenha(arm, api, senha);
        if (ok) await agenda.current?.agora();
        return ok;
      },
    }),
    [arm, estado],
  );

  // Modo de teste: o teste de ponta a ponta liga a sincronização por aqui (a tela é da etapa 2d).
  useEffect(() => {
    if (!arm || !modoTesteLigado()) return;
    const w = globalThis as unknown as { __orbitaSincronia?: unknown };
    w.__orbitaSincronia = { api, ligarComoPrimeiro: valor.ligarComoPrimeiro, entrarComSenha: valor.entrarComSenha, sincronizarAgora: valor.sincronizarAgora, estado: () => valor.estado };
    return () => void delete w.__orbitaSincronia;
  }, [arm, valor]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
