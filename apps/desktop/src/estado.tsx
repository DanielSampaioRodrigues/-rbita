import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { aoMudarModoDoSistema, aplicarAparencia } from "./aparencia";
import { carregar, PADRAO, salvar, type Preferencias } from "./preferencias";

interface ContextoPreferencias {
  prefs: Preferencias;
  mudar: (mudanca: Partial<Preferencias>) => void;
  voltarAoPadrao: () => void;
}

const Contexto = createContext<ContextoPreferencias | null>(null);

export function ProvedorPreferencias({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(carregar);

  useEffect(() => {
    aplicarAparencia(prefs);
    salvar(prefs);
  }, [prefs]);

  // Quando a pessoa escolheu "igual ao Windows", acompanha a troca do sistema.
  useEffect(() => aoMudarModoDoSistema(() => aplicarAparencia(prefs)), [prefs]);

  const mudar = useCallback((mudanca: Partial<Preferencias>) => setPrefs((atual) => ({ ...atual, ...mudanca })), []);
  const voltarAoPadrao = useCallback(() => setPrefs(PADRAO), []);

  return <Contexto.Provider value={{ prefs, mudar, voltarAoPadrao }}>{children}</Contexto.Provider>;
}

export function usePreferencias(): ContextoPreferencias {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("usePreferencias fora do ProvedorPreferencias");
  return contexto;
}
