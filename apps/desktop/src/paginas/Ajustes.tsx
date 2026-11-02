import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Input, Label, SearchField } from "react-aria-components";
import { Interruptor } from "../componentes/Interruptor";
import { Segmentado } from "../componentes/Segmentado";
import { usePreferencias } from "../estado";
import type { ModoAbrir } from "../api";
import { textos } from "../textos/pt-BR";
import { Backup } from "./Backup";
import { Exportar } from "./Exportar";
import { AjustesAtualizacao } from "../atualizacao/TelasAtualizacao";
import { AjustesNuvem } from "../nuvem/Nuvem";
import { AjustesSincronia } from "../sincronia/AjustesSincronia";
import { LimiteProjetos } from "./LimiteProjetos";
import { ANTECEDENCIAS } from "../preferencias";
import { Seguranca } from "./Seguranca";
import { AjustesIa } from "../ia/AjustesIa";
import { AjustesBandeja, AjustesBloqueio } from "../app/AjustesJanela";
import { AjustesDitado } from "../ditado/AjustesDitado";
import {
  ArrowLeft,
  BellRing,
  ChevronRight,
  CloudUpload,
  Download,
  FolderKanban,
  Laptop,
  Lock,
  Mic,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from "../icones";

const t = textos.ajustes;

type IdSecao = keyof typeof t.entradas;

const ICONES: Record<IdSecao, LucideIcon> = {
  seguranca: Lock,
  avisos: BellRing,
  projetos: FolderKanban,
  backup: CloudUpload,
  sincronizar: RefreshCw,
  exportar: Download,
  janela: Laptop,
  ia: Sparkles,
  ditado: Mic,
};

/** Ordem do menu: o que mais se mexe primeiro, o opcional por último. */
const ORDEM: IdSecao[] = ["seguranca", "avisos", "projetos", "backup", "sincronizar", "exportar", "janela", "ia", "ditado"];

/** Guarda a seção aberta só nesta sessão: reabrir Ajustes volta ao mesmo lugar. */
const CHAVE_SESSAO = "orbita.ajustes.secao";

function lerSecaoGuardada(): IdSecao | null {
  try {
    const v = sessionStorage.getItem(CHAVE_SESSAO);
    return v && (ORDEM as string[]).includes(v) ? (v as IdSecao) : null;
  } catch {
    return null;
  }
}

function guardarSecao(id: IdSecao | null) {
  try {
    if (id) sessionStorage.setItem(CHAVE_SESSAO, id);
    else sessionStorage.removeItem(CHAVE_SESSAO);
  } catch {
    /* sem sessionStorage: só não lembra */
  }
}

/** Minúsculas e sem acento, para "seguranca" achar "Segurança". */
function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

interface Props {
  modo: ModoAbrir | null;
  temSenha: boolean;
  aoMudarSeguranca: () => void;
  aoRestaurar: () => void;
}

/** O funcionamento do Órbita. O visual fica em Aparência.
 *  Menu curto de assuntos; toca num e entra. Em tela larga, menu à esquerda e assunto à direita. */
export function Ajustes({ modo, temSenha, aoMudarSeguranca, aoRestaurar }: Props) {
  const [aberta, setAberta] = useState<IdSecao | null>(lerSecaoGuardada);
  const [busca, setBusca] = useState("");
  const menuRef = useRef<HTMLElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const botoes = useRef(new Map<IdSecao, HTMLButtonElement>());
  // Para onde vai o foco depois de abrir ou fechar uma seção (só por ação da pessoa).
  const focoPendente = useRef<"titulo" | IdSecao | null>(null);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return ORDEM;
    return ORDEM.filter((id) => {
      const e = t.entradas[id];
      return normalizar(`${e.nome} ${e.descricao} ${e.palavras}`).includes(termo);
    });
  }, [busca]);

  const abrir = (id: IdSecao | null) => {
    focoPendente.current = id ? "titulo" : aberta;
    setAberta(id);
    guardarSecao(id);
  };

  useEffect(() => {
    const alvo = focoPendente.current;
    focoPendente.current = null;
    if (!alvo) return;
    // Menu escondido (tela estreita): o foco vai para o título da seção, para quem usa teclado ou leitor de tela.
    const menuVisivel = (menuRef.current?.getClientRects().length ?? 0) > 0;
    if (alvo === "titulo") {
      if (!menuVisivel) tituloRef.current?.focus();
    } else {
      botoes.current.get(alvo)?.focus();
    }
  }, [aberta]);

  // Setas para cima e para baixo andam pelo menu; Home e End vão às pontas.
  const aoTeclarMenu = (e: KeyboardEvent<HTMLElement>) => {
    const lista = visiveis.map((id) => botoes.current.get(id)).filter((b): b is HTMLButtonElement => !!b);
    const atual = lista.indexOf(document.activeElement as HTMLButtonElement);
    if (atual < 0) return;
    let proximo = -1;
    if (e.key === "ArrowDown") proximo = Math.min(atual + 1, lista.length - 1);
    else if (e.key === "ArrowUp") proximo = Math.max(atual - 1, 0);
    else if (e.key === "Home") proximo = 0;
    else if (e.key === "End") proximo = lista.length - 1;
    if (proximo < 0) return;
    e.preventDefault();
    lista[proximo].focus();
  };

  const conteudo: Record<IdSecao, ReactNode> = {
    seguranca: (
      <>
        <Seguranca modo={modo} temSenha={temSenha} aoMudar={aoMudarSeguranca} />
        <AjustesBloqueio />
      </>
    ),
    avisos: <CartaoAvisos />,
    projetos: <LimiteProjetos />,
    backup: (
      <>
        <Backup aoRestaurar={aoRestaurar} />
        <AjustesNuvem />
      </>
    ),
    sincronizar: <AjustesSincronia />,
    exportar: <Exportar />,
    janela: (
      <>
        <AjustesBandeja />
        <AjustesAtualizacao />
      </>
    ),
    ia: <AjustesIa />,
    ditado: <AjustesDitado />,
  };

  return (
    <div className="pagina">
      <div className={aberta ? "ajustes-nav com-secao" : "ajustes-nav"}>
        <div className="ajustes-topo">
          <h1>{t.titulo}</h1>
          <p className="pagina-intro">{t.descricao}</p>
        </div>

        <div className="ajustes-colunas">
          <nav ref={menuRef} className="ajustes-menu" aria-label={t.menuRotulo}>
            <SearchField className="ajustes-busca" value={busca} onChange={setBusca}>
              <Label className="visualmente-oculto">{t.procurar}</Label>
              <Input className="entrada-texto sozinha" placeholder={t.procurarDica} />
            </SearchField>
            {visiveis.length === 0 ? (
              <p className="texto-suave" role="status">{t.nadaEncontrado}</p>
            ) : (
              <ul className="ajustes-lista" onKeyDown={aoTeclarMenu}>
                {visiveis.map((id) => {
                  const Icone = ICONES[id];
                  const e = t.entradas[id];
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        ref={(b) => {
                          if (b) botoes.current.set(id, b);
                          else botoes.current.delete(id);
                        }}
                        className="ajustes-entrada"
                        aria-current={aberta === id ? "true" : undefined}
                        onClick={() => abrir(id)}
                      >
                        <span className="ajustes-entrada-icone" aria-hidden="true">
                          <Icone size="1.2em" strokeWidth={1.75} />
                        </span>
                        <span className="ajustes-entrada-texto">
                          <span className="ajustes-entrada-nome">{e.nome}</span>
                          <span className="ajustes-entrada-descricao">{e.descricao}</span>
                        </span>
                        <ChevronRight className="ajustes-entrada-seta" aria-hidden="true" size="1.1em" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>

          <div className="ajustes-conteudo">
            {aberta ? (
              <section aria-labelledby="ajustes-secao-titulo">
                <div className="ajustes-cabecalho">
                  <button type="button" className="ajustes-voltar" onClick={() => abrir(null)} aria-label={t.voltarMenuRotulo}>
                    <ArrowLeft aria-hidden="true" size="1.1em" /> {t.voltarMenu}
                  </button>
                  <h2 id="ajustes-secao-titulo" ref={tituloRef} tabIndex={-1}>
                    {t.entradas[aberta].nome}
                  </h2>
                </div>
                <div className="ajustes-conteudo-corpo">{conteudo[aberta]}</div>
              </section>
            ) : (
              <p className="ajustes-vazio texto-suave">{t.escolhaAssunto}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Avisos de transição: antes de cada compromisso da agenda. */
function CartaoAvisos() {
  const { prefs, mudar } = usePreferencias();
  return (
    <section className="cartao">
      <h2>{textos.avisos.titulo}</h2>
      <p className="campo-ajuda">{textos.avisos.explicacao}</p>
      <Interruptor
        rotulo={textos.avisos.ligado}
        ligado={prefs.avisos.ligado}
        aoMudar={(ligado) => mudar({ avisos: { ...prefs.avisos, ligado } })}
      />
      {prefs.avisos.ligado && (
        <>
          <Segmentado
            rotulo={textos.avisos.antecedencia}
            valor={String(prefs.avisos.minutos)}
            opcoes={ANTECEDENCIAS.map((m) => ({ valor: String(m), nome: textos.avisos.min(m) }))}
            aoMudar={(m) => mudar({ avisos: { ...prefs.avisos, minutos: Number(m) } })}
          />
          <div className="campo">
            <Interruptor
              rotulo={textos.avisos.notificacao}
              ligado={prefs.avisos.notificacao}
              aoMudar={(notificacao) => mudar({ avisos: { ...prefs.avisos, notificacao } })}
            />
            <p className="campo-ajuda">{textos.avisos.notificacaoExplicacao}</p>
          </div>
        </>
      )}
    </section>
  );
}
