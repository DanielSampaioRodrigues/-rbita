import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { aoMudarModoDoSistema, aplicarAparencia } from "./aparencia";
import { guardarImagens, juntarImagens, lerImagens, refsUsadas, separarImagens } from "./imagensFundo";
import { carregar, PADRAO, salvar, type Preferencias } from "./preferencias";

interface ContextoPreferencias {
  prefs: Preferencias;
  mudar: (mudanca: Partial<Preferencias>) => void;
  voltarAoPadrao: () => void;
}

const Contexto = createContext<ContextoPreferencias | null>(null);

export function ProvedorPreferencias({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(carregar);
  // As gravações saem uma de cada vez, na ordem (a mais nova sempre por último).
  const fila = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    aplicarAparencia(prefs);
    // A imagem de fundo vai para o IndexedDB; as preferências guardam só uma referência curta.
    const { leve, imagens } = separarImagens(prefs);
    if (imagens.size === 0) salvar(leve);
    fila.current = fila.current.then(async () => {
      try {
        await guardarImagens(imagens, refsUsadas(leve));
        if (imagens.size > 0) salvar(leve);
      } catch {
        // Sem IndexedDB (navegador muito restrito): tenta como antes, com a imagem junto.
        if (imagens.size > 0) salvar(prefs);
      }
    });
  }, [prefs]);

  // Ao abrir: traz de volta a imagem de fundo guardada à parte.
  useEffect(() => {
    const refs = refsUsadas(prefs);
    if (!refs.length) return;
    let vivo = true;
    lerImagens(refs).then(
      (mapa) => vivo && setPrefs((atual) => juntarImagens(atual, mapa)),
      () => {}, // Banco indisponível agora: fica a cor lisa, sem apagar a referência.
    );
    return () => {
      vivo = false;
    };
    // Só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
