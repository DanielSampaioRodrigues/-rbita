import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/** Recado curto no rodapé ("Guardado em Ideias."), lido por leitores de tela. Sem animação. */
const Contexto = createContext<(texto: string) => void>(() => {});

export function ProvedorRecado({ children }: { children: ReactNode }) {
  const [recado, setRecado] = useState<{ texto: string; vez: number } | null>(null);
  const mostrar = useCallback((texto: string) => setRecado({ texto, vez: Date.now() }), []);

  useEffect(() => {
    if (!recado) return;
    const tempo = setTimeout(() => setRecado(null), 5000);
    return () => clearTimeout(tempo);
  }, [recado]);

  return (
    <Contexto.Provider value={mostrar}>
      {children}
      <div className="recado-area" role="status" aria-live="polite">
        {recado && <p className="recado" key={recado.vez}>{recado.texto}</p>}
      </div>
    </Contexto.Provider>
  );
}

export const useRecado = () => useContext(Contexto);
