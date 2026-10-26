import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface ContextoImersivo {
  imersivo: boolean;
  setImersivo: (v: boolean) => void;
}

const Contexto = createContext<ContextoImersivo | null>(null);

/** Lê o estado imersivo (a lateral encolhida). Fora do provedor, assume que não. */
export const useImersivo = () => useContext(Contexto) ?? { imersivo: false, setImersivo: () => {} };

/** Quando uma tela quer o foco total (o caderno aberto), encolhe a lateral do app. */
export function ProvedorImersivo({ children }: { children: ReactNode }) {
  const [imersivo, setImersivo] = useState(false);
  return <Contexto.Provider value={{ imersivo, setImersivo }}>{children}</Contexto.Provider>;
}

/** Liga o modo imersivo enquanto o componente estiver montado. */
export function useEntrarImersivo() {
  const { setImersivo } = useImersivo();
  useEffect(() => {
    setImersivo(true);
    return () => setImersivo(false);
  }, [setImersivo]);
}
