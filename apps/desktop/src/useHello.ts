import { useEffect, useState } from "react";
import { api } from "./api";

/** Diz se o computador tem Windows Hello (null enquanto pergunta). */
export function useHelloDisponivel(): boolean | null {
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  useEffect(() => {
    api.helloDisponivel().then(setDisponivel, () => setDisponivel(false));
  }, []);
  return disponivel;
}
