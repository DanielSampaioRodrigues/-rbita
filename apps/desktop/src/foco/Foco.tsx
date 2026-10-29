import { Pause, Pencil, Play, Plus, Square, Trash2 } from "../icones";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Button, Form, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { useRecado } from "../app/Recado";
import { Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { usePreferencias } from "../estado";
import { notificar } from "../notificar";
import { ESTILOS_FOCO, type EstiloFoco } from "../preferencias";
import { textos } from "../textos/pt-BR";
import { Miniatura, Mostrador } from "./Mostradores";
import { limitarMinutos, lojaSalvos, MAXIMO_NOME, MAXIMO_SALVOS, novoId, type FocoSalvo } from "./salvos";
import { useLoja } from "../valores";

export { Relogio } from "./Mostradores";

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
  /** Minutos da pausa que fica pronta quando este foco terminar (de um foco salvo). */
  pausaDepois: number | null;
}

const PARADO: EstadoFoco = { modo: "foco", minutos: 25, assunto: "", terminaEm: null, restantePausado: null, pausaDepois: null };

function lerSalvo(): EstadoFoco {
  try {
    const e = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
    if (!e || typeof e.minutos !== "number") return PARADO;
    return { ...PARADO, ...e, pausaDepois: typeof e.pausaDepois === "number" ? e.pausaDepois : null };
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
  /** Começa um foco salvo: modo foco, com o nome como assunto e a pausa guardada para depois. */
  comecarSalvo: (f: FocoSalvo) => void;
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

  // Terminou: aviso discreto, sem som. Se o foco salvo tinha pausa, ela fica pronta
  // na tela, mas só começa quando a pessoa mandar (nada muda sozinho).
  useEffect(() => {
    if (estado.terminaEm && agora >= estado.terminaEm) {
      const pausa = estado.modo === "foco" && estado.pausaDepois ? estado.pausaDepois : null;
      const texto = estado.modo === "foco" ? (pausa ? t.terminouFocoComPausa(pausa) : t.terminouFoco) : t.terminouPausa;
      setEstado((e) => ({
        ...e,
        ...(pausa ? { modo: "pausa" as const, minutos: pausa } : {}),
        terminaEm: null,
        restantePausado: null,
        pausaDepois: null,
      }));
      recado(texto);
      void notificar(textos.app.nome, texto);
    }
  }, [agora, estado.terminaEm, estado.modo, estado.pausaDepois, recado]);

  const restante = estado.terminaEm ? Math.max(0, estado.terminaEm - agora) : estado.restantePausado;

  const configurar = useCallback<ContextoFoco["configurar"]>((m) => setEstado((e) => ({ ...e, ...m })), []);
  const comecar = useCallback((minutos?: number, assunto?: string) => {
    setAgora(Date.now());
    setEstado((e) => {
      const m = minutos ?? e.minutos;
      return { ...e, minutos: m, assunto: assunto ?? e.assunto, terminaEm: Date.now() + m * 60_000, restantePausado: null, pausaDepois: null };
    });
  }, []);
  const comecarSalvo = useCallback((f: FocoSalvo) => {
    setAgora(Date.now());
    setEstado({
      modo: "foco",
      minutos: f.minutos,
      assunto: f.nome,
      terminaEm: Date.now() + f.minutos * 60_000,
      restantePausado: null,
      pausaDepois: f.pausa > 0 ? f.pausa : null,
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
  const parar = useCallback(() => setEstado((e) => ({ ...e, terminaEm: null, restantePausado: null, pausaDepois: null })), []);

  return (
    <Contexto.Provider value={{ estado, restante, configurar, comecar, comecarSalvo, pausar, continuar, parar }}>
      {children}
    </Contexto.Provider>
  );
}

export function formatarRestante(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Botões pequenos com o desenho de cada estilo. Setas do teclado trocam; a escolha fica guardada. */
function EscolhaEstilo() {
  const { prefs, mudar } = usePreferencias();
  return (
    <ToggleButtonGroup
      aria-label={t.estilo}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[prefs.estiloFoco]}
      onSelectionChange={(k) => {
        const v = [...k][0] as EstiloFoco | undefined;
        if (v) mudar({ estiloFoco: v });
      }}
      className="segmentado foco-estilos"
    >
      {ESTILOS_FOCO.map((e) => (
        <ToggleButton key={e} id={e} className="segmentado-opcao foco-estilo" aria-label={t.estilos[e]}>
          <span title={t.estilos[e]} className="foco-estilo-desenho"><Miniatura estilo={e} /></span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

export function PaginaFoco() {
  const { estado, restante, configurar, comecar, pausar, continuar, parar } = useFoco();
  const { prefs } = usePreferencias();
  const ativo = restante != null;
  const total = estado.minutos * 60_000;
  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>
      <EscolhaEstilo />
      <div className={`foco foco-com-${prefs.estiloFoco}`}>
        <Mostrador
          estilo={prefs.estiloFoco}
          fracao={ativo ? restante / total : 1}
          rotulo={ativo ? t.restante(formatarRestante(restante)) : t.min(estado.minutos)}
          correndo={estado.terminaEm != null}
          baixoEstimulo={prefs.baixoEstimulo}
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
              <div className="campo">
                <label className="campo-rotulo" htmlFor="foco-outra">{t.outraDuracao}</label>
                <input
                  id="foco-outra"
                  type="number"
                  className="entrada-texto sozinha"
                  min={1}
                  max={180}
                  value={estado.minutos}
                  onChange={(e) => configurar({ minutos: Math.min(180, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
                />
                <p className="campo-ajuda">{t.outraDuracaoAjuda}</p>
              </div>
              {estado.modo === "foco" && <Campo rotulo={t.assunto} valor={estado.assunto} aoMudar={(assunto) => configurar({ assunto })} />}
              <div className="botoes">
                <Button className="botao principal" type="submit"><Play aria-hidden="true" size="1.1em" /> {t.comecar}</Button>
              </div>
            </Form>
          )}
        </div>
      </div>
      <FocosSalvos />
    </div>
  );
}

type Rascunho = { id: string | null; nome: string; minutos: string; pausa: string };

/** Lista de focos salvos: um toque começa; editar e excluir ficam no próprio cartão. */
function FocosSalvos() {
  const { estado, restante, comecarSalvo } = useFoco();
  const salvos = useLoja(lojaSalvos);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [excluindo, setExcluindo] = useState<FocoSalvo | null>(null);
  const ocupado = restante != null;

  const atualizar = (lista: FocoSalvo[]) => lojaSalvos.mudar(() => lista);

  const novo = () =>
    setRascunho({
      id: null,
      nome: estado.modo === "foco" ? estado.assunto : "",
      minutos: String(estado.modo === "foco" ? estado.minutos : 25),
      pausa: "5",
    });

  const salvar = () => {
    if (!rascunho || !rascunho.nome.trim()) return;
    const foco: FocoSalvo = {
      id: rascunho.id ?? novoId(),
      nome: rascunho.nome.trim().slice(0, MAXIMO_NOME),
      minutos: limitarMinutos(rascunho.minutos),
      pausa: limitarMinutos(rascunho.pausa, 0),
    };
    atualizar(rascunho.id ? salvos.map((f) => (f.id === foco.id ? foco : f)) : [...salvos, foco]);
    setRascunho(null);
  };

  return (
    <section className="foco-salvos" aria-labelledby="foco-salvos-titulo">
      <div className="foco-salvos-cabeca">
        <h2 id="foco-salvos-titulo">{t.salvos}</h2>
        <Button className="botao" onPress={novo} isDisabled={salvos.length >= MAXIMO_SALVOS}>
          <Plus aria-hidden="true" size="1.1em" /> {t.novoSalvo}
        </Button>
      </div>
      <p className="texto-suave">{salvos.length ? t.salvosIntro : t.salvosVazio}</p>
      {ocupado && salvos.length > 0 && <p className="texto-suave pequeno">{t.ocupado}</p>}
      {salvos.length > 0 && (
        <ul className="foco-salvos-lista">
          {salvos.map((f) => (
            <li key={f.id} className="cartao compacto foco-salvo">
              <Button className="foco-salvo-iniciar" onPress={() => comecarSalvo(f)} isDisabled={ocupado} aria-label={t.iniciarSalvo(f.nome)}>
                <Play aria-hidden="true" size="1.1em" className="foco-salvo-play" />
                <span className="foco-salvo-texto">
                  <span className="foco-salvo-nome quebra">{f.nome}</span>
                  <span className="texto-suave pequeno">{t.detalheSalvo(f.minutos, f.pausa)}</span>
                </span>
              </Button>
              <div className="foco-salvo-acoes">
                <Button
                  className="botao-icone"
                  aria-label={t.editar(f.nome)}
                  onPress={() => setRascunho({ id: f.id, nome: f.nome, minutos: String(f.minutos), pausa: String(f.pausa) })}
                >
                  <Pencil aria-hidden="true" size="1.1em" />
                </Button>
                <Button className="botao-icone" aria-label={t.excluir(f.nome)} onPress={() => setExcluindo(f)}>
                  <Trash2 aria-hidden="true" size="1.1em" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Janela titulo={rascunho?.id ? t.editarSalvo : t.novoSalvo} aberta={!!rascunho} aoFechar={() => setRascunho(null)}>
        {rascunho && (
          <Form className="formulario" onSubmit={(e) => (e.preventDefault(), salvar())}>
            <Campo rotulo={t.nomeSalvo} valor={rascunho.nome} aoMudar={(nome) => setRascunho({ ...rascunho, nome })} maximo={MAXIMO_NOME} autoFocus semDitado />
            <div className="campo">
              <label className="campo-rotulo" htmlFor="foco-salvo-minutos">{t.minutosFoco}</label>
              <input
                id="foco-salvo-minutos"
                type="number"
                className="entrada-texto sozinha"
                min={1}
                max={180}
                value={rascunho.minutos}
                onChange={(e) => setRascunho({ ...rascunho, minutos: e.target.value })}
                onBlur={() => setRascunho({ ...rascunho, minutos: String(limitarMinutos(rascunho.minutos)) })}
              />
              <p className="campo-ajuda">{t.minutosAjuda}</p>
            </div>
            <div className="campo">
              <label className="campo-rotulo" htmlFor="foco-salvo-pausa">{t.minutosPausa}</label>
              <input
                id="foco-salvo-pausa"
                type="number"
                className="entrada-texto sozinha"
                min={0}
                max={180}
                value={rascunho.pausa}
                onChange={(e) => setRascunho({ ...rascunho, pausa: e.target.value })}
                onBlur={() => setRascunho({ ...rascunho, pausa: String(limitarMinutos(rascunho.pausa, 0)) })}
              />
            </div>
            <div className="janela-acoes">
              <Button className="botao" onPress={() => setRascunho(null)}>{textos.comum.cancelar}</Button>
              <Button className="botao principal" type="submit" isDisabled={!rascunho.nome.trim()}>{textos.comum.salvar}</Button>
            </div>
          </Form>
        )}
      </Janela>

      <Confirmar
        titulo={t.excluirTitulo}
        texto={t.excluirTexto}
        confirmar={t.excluirConfirmar}
        aberta={!!excluindo}
        aoCancelar={() => setExcluindo(null)}
        aoConfirmar={() => {
          if (excluindo) atualizar(salvos.filter((f) => f.id !== excluindo.id));
          setExcluindo(null);
        }}
      />
    </section>
  );
}
