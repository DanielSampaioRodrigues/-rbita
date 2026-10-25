import { Pause, Play, Square } from "../icones";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Button, Form } from "react-aria-components";
import { useRecado } from "../app/Recado";
import { Campo } from "../componentes/Campo";
import { Segmentado } from "../componentes/Segmentado";
import { notificar } from "../notificar";
import { textos } from "../textos/pt-BR";

const t = textos.foco;
const CHAVE = "orbita.foco";
export const DURACOES = { foco: [10, 15, 25, 45, 60], pausa: [5, 10, 15] } as const;

type Modo = "foco" | "pausa";

interface EstadoFoco {
  modo: Modo;
  minutos: number;
  assunto: string;
  /** Quando termina (ms), se estiver correndo. */
  terminaEm: number | null;
  /** Quanto falta (ms), se estiver pausado. */
  restantePausado: number | null;
}

const PARADO: EstadoFoco = { modo: "foco", minutos: 25, assunto: "", terminaEm: null, restantePausado: null };

function lerSalvo(): EstadoFoco {
  try {
    const e = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
    return e && typeof e.minutos === "number" ? { ...PARADO, ...e } : PARADO;
  } catch {
    return PARADO;
  }
}

interface ContextoFoco {
  estado: EstadoFoco;
  /** Quanto falta, em ms (null se não começou). */
  restante: number | null;
  configurar: (m: Partial<Pick<EstadoFoco, "modo" | "minutos" | "assunto">>) => void;
  comecar: (minutos?: number, assunto?: string) => void;
  pausar: () => void;
  continuar: () => void;
  parar: () => void;
}

const Contexto = createContext<ContextoFoco | null>(null);

export const useFoco = () => {
  const c = useContext(Contexto);
  if (!c) throw new Error("useFoco fora do ProvedorFoco");
  return c;
};

/** O timer vive acima das páginas: continua contando enquanto a pessoa navega. */
export function ProvedorFoco({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoFoco>(lerSalvo);
  const [agora, setAgora] = useState(Date.now());
  const recado = useRecado();

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch {
      // Sem armazenamento: o timer só não sobrevive a fechar o app.
    }
  }, [estado]);

  useEffect(() => {
    if (!estado.terminaEm) return;
    const intervalo = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [estado.terminaEm]);

  // Terminou: aviso discreto, sem som.
  useEffect(() => {
    if (estado.terminaEm && agora >= estado.terminaEm) {
      const texto = estado.modo === "foco" ? t.terminouFoco : t.terminouPausa;
      setEstado((e) => ({ ...e, terminaEm: null, restantePausado: null }));
      recado(texto);
      void notificar(textos.app.nome, texto);
    }
  }, [agora, estado.terminaEm, estado.modo, recado]);

  const restante = estado.terminaEm ? Math.max(0, estado.terminaEm - agora) : estado.restantePausado;

  const configurar = useCallback<ContextoFoco["configurar"]>((m) => setEstado((e) => ({ ...e, ...m })), []);
  const comecar = useCallback((minutos?: number, assunto?: string) => {
    setAgora(Date.now());
    setEstado((e) => {
      const m = minutos ?? e.minutos;
      return { ...e, minutos: m, assunto: assunto ?? e.assunto, terminaEm: Date.now() + m * 60_000, restantePausado: null };
    });
  }, []);
  const pausar = useCallback(
    () => setEstado((e) => (e.terminaEm ? { ...e, restantePausado: Math.max(0, e.terminaEm - Date.now()), terminaEm: null } : e)),
    [],
  );
  const continuar = useCallback(() => {
    setAgora(Date.now());
    setEstado((e) => (e.restantePausado != null ? { ...e, terminaEm: Date.now() + e.restantePausado, restantePausado: null } : e));
  }, []);
  const parar = useCallback(() => setEstado((e) => ({ ...e, terminaEm: null, restantePausado: null })), []);

  return (
    <Contexto.Provider value={{ estado, restante, configurar, comecar, pausar, continuar, parar }}>{children}</Contexto.Provider>
  );
}

export function formatarRestante(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Disco que diminui conforme o tempo passa (como um timer de cozinha visto de cima). */
export function Relogio({ fracao, rotulo }: { fracao: number; rotulo: string }) {
  const f = Math.min(1, Math.max(0, fracao));
  const angulo = f * 2 * Math.PI;
  const x = 50 + 45 * Math.sin(angulo);
  const y = 50 - 45 * Math.cos(angulo);
  const caminho =
    f >= 0.9999 ? "M50 5 A45 45 0 1 1 49.99 5 Z" : f <= 0 ? "" : `M50 50 L50 5 A45 45 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y} Z`;
  return (
    <svg className="relogio" viewBox="0 0 100 100" role="img" aria-label={rotulo}>
      <circle cx="50" cy="50" r="47" className="relogio-fundo" />
      {caminho && <path d={caminho} className="relogio-tempo" />}
      <circle cx="50" cy="50" r="47" className="relogio-borda" />
    </svg>
  );
}

export function PaginaFoco() {
  const { estado, restante, configurar, comecar, pausar, continuar, parar } = useFoco();
  const ativo = restante != null;
  const total = estado.minutos * 60_000;
  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>
      <div className="foco">
        <Relogio
          fracao={ativo ? restante / total : 1}
          rotulo={ativo ? t.restante(formatarRestante(restante)) : t.min(estado.minutos)}
        />
        <div className="foco-controles">
          {ativo ? (
            <>
              <p className="foco-tempo" aria-live="off">{formatarRestante(restante)}</p>
              <p className="texto-suave">
                {t.modos[estado.modo]}
                {estado.assunto ? `: ${estado.assunto}` : ""}
                {estado.terminaEm == null ? ` · ${t.pausado}` : ""}
              </p>
              <div className="botoes">
                {estado.terminaEm != null ? (
                  <Button className="botao principal" onPress={pausar}><Pause aria-hidden="true" size="1.1em" /> {t.pausar}</Button>
                ) : (
                  <Button className="botao principal" onPress={continuar}><Play aria-hidden="true" size="1.1em" /> {t.continuar}</Button>
                )}
                <Button className="botao" onPress={parar}><Square aria-hidden="true" size="1.1em" /> {t.parar}</Button>
              </div>
            </>
          ) : (
            <Form className="formulario" onSubmit={(e) => (e.preventDefault(), comecar())}>
              <Segmentado<Modo>
                rotulo={t.modo}
                valor={estado.modo}
                opcoes={(["foco", "pausa"] as const).map((m) => ({ valor: m, nome: t.modos[m] }))}
                aoMudar={(modo) => configurar({ modo, minutos: modo === "foco" ? 25 : 5 })}
              />
              <Segmentado
                rotulo={t.duracao}
                valor={String(estado.minutos)}
                opcoes={DURACOES[estado.modo].map((m) => ({ valor: String(m), nome: t.min(m) }))}
                aoMudar={(m) => configurar({ minutos: Number(m) })}
              />
              {estado.modo === "foco" && <Campo rotulo={t.assunto} valor={estado.assunto} aoMudar={(assunto) => configurar({ assunto })} />}
              <div className="botoes">
                <Button className="botao principal" type="submit"><Play aria-hidden="true" size="1.1em" /> {t.comecar}</Button>
              </div>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
