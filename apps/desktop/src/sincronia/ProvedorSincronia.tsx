// Liga o maestro da sincronização ao app (ver docs/decisoes/0012-sincronizacao.md, etapas 2b e 2d).
// Fica montado só com o cofre aberto: bloquear desmonta e para tudo.
//
// Onde os aparelhos trocam arquivos (`armazenamentoAtual`):
//   - modo de teste: a pasta de mentira (`?sync-teste`);
//   - navegador: o Google Drive pelo login do Google (quando o ID do cliente existir);
//   - Windows: o Google Drive pela conta ligada em Ajustes (desde a 0.22.0).
// Sem login, o Drive responde "precisa entrar de novo" e o aviso mostra isso.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, MODO_WEB, noApp } from "../api";
import { avisarMudanca, ouvirMudancas } from "../dados";
import { agendarSincronia, type Agenda } from "./agenda";
import type { Armazenamento } from "./armazenamento";
import { criarDriveRest } from "./driveRest";
import { googleDisponivel, loginGoogle, type PerfilGoogle } from "./googleWeb";
import { tokenDoWindows } from "./googleWindows";
import { entrarComSenha, ligarComoPrimeiro, Maestro, type EstadoSincronia } from "./maestro";
import { PastaHttp } from "./pastaDeMentira";
import { AssistenteSincronia, type InicioAssistente } from "./TelasSincronia";

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
 * Se dá para usar uma conta nesta versão:
 * - "sim": dá (navegador com login do Google, Windows com o Google cadastrado, modo de teste);
 * - "sem-credencial": navegador sem o login do Google configurado ainda (nada de botão quebrado);
 * - "indisponivel": simulação, ou Windows sem o cadastro do Google.
 */
export type Disponibilidade = "sim" | "sem-credencial" | "indisponivel";

/** Onde estamos: muda o jeito de entrar na conta. */
export type Plataforma = "navegador" | "windows" | "teste" | "simulacao";

export function plataformaAtual(): Plataforma {
  if (modoTesteLigado()) return "teste";
  if (MODO_WEB) return "navegador";
  if (noApp) return "windows";
  return "simulacao";
}

/** O token do Windows é um só por aba (guarda o acesso de 1 hora em memória). */
let tokenWindows: ((forcarNovo?: boolean) => Promise<string>) | null = null;

/** O lugar onde os aparelhos trocam arquivos, ou null (sem sincronização nesta versão). */
export async function armazenamentoAtual(): Promise<Armazenamento | null> {
  switch (plataformaAtual()) {
    case "teste":
      return new PastaHttp();
    case "navegador":
      return googleDisponivel() ? criarDriveRest({ pegarToken: (f) => loginGoogle().pegarToken(f) }) : null;
    case "windows": {
      const disp = await api.nuvemDisponivel().catch(() => null);
      if (!disp?.google) return null;
      tokenWindows ??= tokenDoWindows();
      return criarDriveRest({ pegarToken: tokenWindows });
    }
    default:
      return null;
  }
}

/** Conta de mentira do modo de teste (só existe na memória desta aba). */
let contaDeTeste: PerfilGoogle | null = null;
const PERFIL_TESTE: PerfilGoogle = { nome: "Conta de teste", email: "teste@exemplo.com", foto: null };

export interface Sincronia {
  /** Há pasta e este aparelho tem a chave: o aviso aparece. */
  ligada: boolean;
  estado: EstadoSincronia;
  disponibilidade: Disponibilidade;
  plataforma: Plataforma;
  /** A pasta (Drive ou de mentira), ou null. */
  armazenamento: Armazenamento | null;
  /** A conta Google em uso (navegador: depois de entrar; Windows: a conta ligada). */
  conta: PerfilGoogle | null;
  /**
   * Entrar na conta. No navegador, chame direto do toque, sem `await` antes: o Safari do
   * iPad só abre a janela do Google se ela nascer do toque.
   */
  entrar: () => Promise<PerfilGoogle>;
  sincronizarAgora: () => Promise<void>;
  /** Pausa a sincronização enquanto a pessoa liga (nada sincroniza até ela escolher como juntar). */
  pausar: (sim: boolean) => void;
  /** Abre o assistente de ligar (Ajustes, primeira tela, "fazer as perguntas depois"). */
  abrirAssistente: (inicio?: InicioAssistente) => void;
  /** Muda sempre que algo da sincronização muda (para os cartões recarregarem). */
  versao: number;
  avisarQueMudou: () => void;
  /** Para os testes: primeiro aparelho cria a chave; aparelho novo entra. */
  ligarComoPrimeiro: (senha: string) => Promise<void>;
  entrarComSenha: (senha: string) => Promise<boolean>;
}

const parado: EstadoSincronia = { fase: "parado", ultima: null, motivo: null };
const semPasta = () => Promise.reject(new Error("A sincronização não está ligada neste aparelho."));
const Contexto = createContext<Sincronia>({
  ligada: false,
  estado: parado,
  disponibilidade: "indisponivel",
  plataforma: "simulacao",
  armazenamento: null,
  conta: null,
  entrar: semPasta,
  sincronizarAgora: async () => undefined,
  pausar: () => undefined,
  abrirAssistente: () => undefined,
  versao: 0,
  avisarQueMudou: () => undefined,
  ligarComoPrimeiro: semPasta,
  entrarComSenha: semPasta,
});

export const useSincronia = () => useContext(Contexto);

// ── Continuar depois de criar o cofre (primeira tela com Google) ──────────────────
/**
 * A primeira tela mostra "Entrar com Google" em destaque? Só no navegador com o login do
 * Google configurado (e no modo de teste). Sem a credencial, a primeira tela fica como
 * sempre, sem botão quebrado. No Windows, a conta liga depois, em Ajustes: lá o login do
 * Google guarda a renovação do acesso dentro do banco criptografado, que só existe depois
 * de criar o cofre.
 */
export function contaNaPrimeiraTela(): boolean {
  const p = plataformaAtual();
  return p === "teste" || (p === "navegador" && googleDisponivel());
}

/** Entrar no Google antes de existir cofre (primeira tela). Chame direto do toque. */
export function entrarAntesDoCofre(): Promise<PerfilGoogle> {
  if (plataformaAtual() === "teste") {
    contaDeTeste = PERFIL_TESTE;
    return Promise.resolve(PERFIL_TESTE);
  }
  return loginGoogle().entrar();
}

// O PIN fica só na memória, nunca em armazenamento do navegador.
let continuacao: { pin: string } | null = null;
/** A primeira tela entrou no Google e criou o cofre com este PIN: o app abre o assistente. */
export function continuarSincroniaDepois(pin: string) {
  continuacao = { pin };
}

function disponibilidadeInicial(p: Plataforma): Disponibilidade {
  if (p === "teste") return "sim";
  if (p === "navegador") return googleDisponivel() ? "sim" : "sem-credencial";
  return "indisponivel"; // Windows: confirma depois, pelo cadastro do Google
}

export function ProvedorSincronia({ children }: { children: ReactNode }) {
  const plataforma = useMemo(plataformaAtual, []);
  const [estado, setEstado] = useState<EstadoSincronia>(parado);
  const [arm, setArm] = useState<Armazenamento | null>(null);
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade>(() => disponibilidadeInicial(plataforma));
  const [conta, setConta] = useState<PerfilGoogle | null>(() => (plataforma === "navegador" && googleDisponivel() ? loginGoogle().perfil() : plataforma === "teste" ? contaDeTeste : null));
  const [versao, setVersao] = useState(0);
  const [assistente, setAssistente] = useState<{ inicio: InicioAssistente; pin?: string } | null>(() => {
    if (!continuacao) return null;
    const c = continuacao;
    continuacao = null;
    return { inicio: "ligar", pin: c.pin };
  });
  const agenda = useRef<Agenda | null>(null);
  const maestro = useRef<Maestro | null>(null);
  /** Pausa pedida pelo assistente (vale também para um maestro criado depois, quando a pasta chega). */
  const pausado = useRef(false);
  const avisarQueMudou = useCallback(() => setVersao((v) => v + 1), []);

  // A pasta e, no Windows, a conta ligada.
  useEffect(() => {
    let vivo = true;
    void armazenamentoAtual().then((a) => {
      if (!vivo) return;
      setArm(a);
      if (plataforma === "windows") setDisponibilidade(a ? "sim" : "indisponivel");
    });
    return () => void (vivo = false);
  }, [plataforma]);
  useEffect(() => {
    if (plataforma !== "windows") return;
    let vivo = true;
    api.nuvemSituacao().then(
      (s) => vivo && setConta(s?.provedor === "google" ? { nome: s.conta, email: s.conta, foto: null } : null),
      () => undefined,
    );
    return () => void (vivo = false);
  }, [plataforma, versao]);

  useEffect(() => {
    if (!arm) return;
    // O aviso de "os dados mudaram" que a própria sincronização dá não conta como mudança daqui.
    let daSincronia = false;
    const m = new Maestro({
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
    maestro.current = m;
    m.pausar(pausado.current);
    const pararDeOuvir = m.ouvir(setEstado);
    const a = agendarSincronia(m);
    agenda.current = a;
    const pararMudancas = ouvirMudancas(() => {
      if (!daSincronia) a.mudouAqui();
    });
    return () => {
      pararMudancas();
      pararDeOuvir();
      a.parar();
      agenda.current = null;
      maestro.current = null;
    };
  }, [arm]);

  const entrar = useCallback((): Promise<PerfilGoogle> => {
    if (plataforma === "navegador") {
      // Primeira coisa: chamar o Google (ainda dentro do toque).
      return loginGoogle()
        .entrar({ dica: loginGoogle().perfil()?.email || undefined })
        .then((p) => (setConta(p), p));
    }
    if (plataforma === "teste") {
      contaDeTeste = PERFIL_TESTE;
      setConta(PERFIL_TESTE);
      return Promise.resolve(PERFIL_TESTE);
    }
    if (plataforma === "windows") {
      // Liga a conta Google do jeito da 0.22.0 (abre o navegador do sistema).
      return api.nuvemConectar("google").then((s) => {
        const p = { nome: s.conta, email: s.conta, foto: null };
        setConta(p);
        tokenWindows = tokenDoWindows();
        return p;
      });
    }
    return semPasta();
  }, [plataforma]);

  const valor = useMemo<Sincronia>(
    () => ({
      ligada: arm !== null && estado.fase !== "parado" && estado.fase !== "sem-chave",
      estado,
      disponibilidade,
      plataforma,
      armazenamento: arm,
      conta,
      entrar,
      sincronizarAgora: async () => void (await agenda.current?.agora()),
      pausar: (sim) => {
        pausado.current = sim;
        maestro.current?.pausar(sim);
      },
      abrirAssistente: (inicio = "ligar") => setAssistente({ inicio }),
      versao,
      avisarQueMudou,
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
    [arm, estado, disponibilidade, plataforma, conta, entrar, versao, avisarQueMudou],
  );

  // Modo de teste: o teste de ponta a ponta usa a api e o estado por aqui.
  useEffect(() => {
    if (!arm || !modoTesteLigado()) return;
    const w = globalThis as unknown as { __orbitaSincronia?: unknown };
    w.__orbitaSincronia = { api, ligarComoPrimeiro: valor.ligarComoPrimeiro, entrarComSenha: valor.entrarComSenha, sincronizarAgora: valor.sincronizarAgora, estado: () => valor.estado };
    return () => void delete w.__orbitaSincronia;
  }, [arm, valor]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      {assistente && (
        <AssistenteSincronia
          inicio={assistente.inicio}
          pinConhecido={assistente.pin}
          aoFechar={() => {
            setAssistente(null);
            avisarQueMudou();
          }}
        />
      )}
    </Contexto.Provider>
  );
}
