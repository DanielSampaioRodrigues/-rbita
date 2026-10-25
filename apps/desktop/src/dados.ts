// Aviso simples de "os dados mudaram": quem mostra listas se atualiza sozinho
// (por exemplo, a lista de ideias quando algo é capturado por outra tela).
import { useEffect, useState } from "react";

const ouvintes = new Set<() => void>();

export function avisarMudanca(): void {
  for (const ouvir of ouvintes) ouvir();
}

/** Número que muda a cada aviso; use como dependência para recarregar. */
export function useMudancas(): number {
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    const ouvir = () => setVersao((v) => v + 1);
    ouvintes.add(ouvir);
    return () => void ouvintes.delete(ouvir);
  }, []);
  return versao;
}
