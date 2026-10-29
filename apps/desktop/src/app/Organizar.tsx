import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * "Organizar a tela inicial": um estado só, dividido entre o Início (blocos) e o
 * menu lateral (ordem e seções escondidas). Quem liga é o botão do Início.
 */
export interface Organizar {
  organizando: boolean;
  setOrganizando: (v: boolean | ((atual: boolean) => boolean)) => void;
  /** Seção do menu sendo arrastada com o mouse ou o dedo e que pode ser escondida (a caixinha do Início se acende). */
  arrastandoMenu: string | null;
}

const Contexto = createContext<Organizar | null>(null);

export function ProvedorOrganizar({ valor, children }: { valor: Organizar; children: ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Fora da moldura (sem provedor), cada tela guarda o próprio estado, como antes. */
export function useOrganizar(): Organizar {
  const ctx = useContext(Contexto);
  const [local, setLocal] = useState(false);
  return ctx ?? { organizando: local, setOrganizando: setLocal, arrastandoMenu: null };
}
