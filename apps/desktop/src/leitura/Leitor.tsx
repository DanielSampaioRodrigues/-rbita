import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { Leitor, CONFIG_PADRAO, type ConfigLeitura, type CorFundo, type Localizacao } from "@orbita/leitor";
import atkinsonUrl from "@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url";
import lexendUrl from "@fontsource-variable/lexend/files/lexend-latin-wght-normal.woff2?url";
import dyslexicUrl from "../fontes/opendyslexic/OpenDyslexic-Regular.woff2?url";
import { api, type Livro } from "../api";
import { Aviso } from "../componentes/Campo";
import { Segmentado } from "../componentes/Segmentado";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "../icones";
import { textos } from "../textos/pt-BR";

const t = textos.leitura.leitor;
const CHAVE_CONFIG = "orbita.leitura.config";
const chavePos = (id: string) => `orbita.leitura.pos.${id}`;

const FONTES: Record<string, string> = {
  atkinson: "Atkinson Hyperlegible Next",
  lexend: "Lexend",
  dislexia: "OpenDyslexic",
};
/** Fontes do app, com URL absoluta para resolverem dentro do iframe do EPUB. */
const FONTES_ARQUIVOS = [
  { family: "Atkinson Hyperlegible Next", url: new URL(atkinsonUrl, location.href).href },
  { family: "Lexend", url: new URL(lexendUrl, location.href).href },
  { family: "OpenDyslexic", url: new URL(dyslexicUrl, location.href).href },
];

const ENTRELINHAS: Record<string, number> = { apertada: 1.3, media: 1.6, solta: 2.0 };
const MARGENS: Record<string, number> = { estreita: 3, media: 6, larga: 10 };
const chaveProxima = (valor: number, mapa: Record<string, number>) =>
  Object.keys(mapa).reduce((a, b) => (Math.abs(mapa[b] - valor) < Math.abs(mapa[a] - valor) ? b : a));

function lerConfig(): ConfigLeitura {
  try {
    const salvo = localStorage.getItem(CHAVE_CONFIG);
    if (salvo) return { ...CONFIG_PADRAO, ...JSON.parse(salvo) };
  } catch {
    // Sem armazenamento: usa o padrão.
  }
  return CONFIG_PADRAO;
}

function base64ParaBytes(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** Tela cheia de leitura de um livro (EPUB ou PDF). */
export function LeitorLivro({ livro, aoFechar }: { livro: Livro; aoFechar: () => void }) {
  const alvo = useRef<HTMLDivElement>(null);
  const motor = useRef<Leitor | null>(null);
  const [config, setConfig] = useState<ConfigLeitura>(lerConfig);
  const [carregando, setCarregando] = useState(true);
  const [mostrarAjustes, setMostrarAjustes] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ehPdf = livro.formato === "pdf";

  useEffect(() => {
    let vivo = true;
    const container = alvo.current;
    if (!container) return;
    if (!livro.arquivoId || !livro.formato) {
      setErro(t.semArquivo);
      setCarregando(false);
      return;
    }
    const leitor = new Leitor(container);
    leitor.definirFontes(FONTES_ARQUIVOS);
    motor.current = leitor;
    leitor.aoMudarLocalizacao((loc) => {
      try {
        localStorage.setItem(chavePos(livro.id), JSON.stringify(loc));
      } catch {
        // Conveniência; se não der para guardar, tudo bem.
      }
    });
    (async () => {
      try {
        const b64 = await api.bytesAnexo(livro.arquivoId);
        if (!vivo) return;
        if (!b64) {
          setErro(t.semArquivoNavegador);
          setCarregando(false);
          return;
        }
        let inicial: Localizacao | undefined;
        try {
          const p = localStorage.getItem(chavePos(livro.id));
          if (p) inicial = JSON.parse(p);
        } catch {
          // sem posição guardada
        }
        await leitor.abrir(base64ParaBytes(b64), livro.formato as "epub" | "pdf", lerConfig(), inicial);
        if (vivo) setCarregando(false);
      } catch (e) {
        if (vivo) {
          setErro(e instanceof Error ? e.message : t.erro);
          setCarregando(false);
        }
      }
    })();
    return () => {
      vivo = false;
      leitor.destruir();
      motor.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livro.id]);

  const mudarConfig = (mudanca: Partial<ConfigLeitura>) => {
    const novo = { ...config, ...mudanca };
    setConfig(novo);
    try {
      localStorage.setItem(CHAVE_CONFIG, JSON.stringify(novo));
    } catch {
      // sem armazenamento
    }
    void motor.current?.aplicarConfig(novo);
  };

  const fonteAtual = Object.keys(FONTES).find((k) => FONTES[k] === config.fonte) ?? "atkinson";

  return (
    <div className="leitor-tela">
      <div className="leitor-barra">
        <Button className="botao-icone" onPress={aoFechar} aria-label={t.fechar}><X aria-hidden="true" size="1.2em" /></Button>
        <strong className="leitor-titulo quebra">{livro.titulo}</strong>
        <div className="leitor-controles">
          <Button className="botao-icone" onPress={() => mudarConfig({ tamanho: Math.max(60, config.tamanho - 10) })} aria-label={t.menor}>A−</Button>
          <Button className="botao-icone" onPress={() => mudarConfig({ tamanho: Math.min(300, config.tamanho + 10) })} aria-label={t.maior}>A+</Button>
          <Button className={mostrarAjustes ? "botao-icone principal" : "botao-icone"} onPress={() => setMostrarAjustes((v) => !v)} aria-label={t.ajustes} aria-pressed={mostrarAjustes}>
            <SlidersHorizontal aria-hidden="true" size="1.2em" />
          </Button>
        </div>
      </div>

      {mostrarAjustes && (
        <div className="leitor-ajustes">
          <Segmentado
            rotulo={t.fundo}
            valor={config.corFundo}
            aoMudar={(v) => mudarConfig({ corFundo: v as CorFundo })}
            opcoes={(["branco", "creme", "polen", "cinza", "escuro"] as CorFundo[]).map((c) => ({ valor: c, nome: t.fundos[c] }))}
          />
          {ehPdf ? (
            <p className="campo-ajuda">{t.soEpub}</p>
          ) : (
            <>
              <Segmentado
                rotulo={t.fonte}
                valor={fonteAtual}
                aoMudar={(v) => mudarConfig({ fonte: FONTES[v] })}
                opcoes={[
                  { valor: "atkinson", nome: t.fontes.atkinson },
                  { valor: "lexend", nome: t.fontes.lexend },
                  { valor: "dislexia", nome: t.fontes.dislexia },
                ]}
              />
              <Segmentado
                rotulo={t.entrelinha}
                valor={chaveProxima(config.entrelinha, ENTRELINHAS)}
                aoMudar={(v) => mudarConfig({ entrelinha: ENTRELINHAS[v] })}
                opcoes={[
                  { valor: "apertada", nome: t.entrelinhas.apertada },
                  { valor: "media", nome: t.entrelinhas.media },
                  { valor: "solta", nome: t.entrelinhas.solta },
                ]}
              />
              <Segmentado
                rotulo={t.margem}
                valor={chaveProxima(config.margem, MARGENS)}
                aoMudar={(v) => mudarConfig({ margem: MARGENS[v] })}
                opcoes={[
                  { valor: "estreita", nome: t.margens.estreita },
                  { valor: "media", nome: t.margens.media },
                  { valor: "larga", nome: t.margens.larga },
                ]}
              />
              <Segmentado
                rotulo={t.alinhamento}
                valor={config.alinhamento}
                aoMudar={(v) => mudarConfig({ alinhamento: v as "esquerda" | "justificado" })}
                opcoes={[
                  { valor: "esquerda", nome: t.alinhamentos.esquerda },
                  { valor: "justificado", nome: t.alinhamentos.justificado },
                ]}
              />
              <Segmentado
                rotulo={t.modo}
                valor={config.modo}
                aoMudar={(v) => mudarConfig({ modo: v as "paginas" | "rolagem" })}
                opcoes={[
                  { valor: "paginas", nome: t.modos.paginas },
                  { valor: "rolagem", nome: t.modos.rolagem },
                ]}
              />
            </>
          )}
        </div>
      )}

      {erro ? (
        <div className="leitor-aviso"><Aviso tipo="info">{erro}</Aviso></div>
      ) : (
        carregando && <p className="leitor-aviso texto-suave">{t.carregando}</p>
      )}

      <div className="leitor-conteudo">
        <Button className="leitor-seta" onPress={() => void motor.current?.anterior()} aria-label={t.anterior}><ChevronLeft aria-hidden="true" size="1.6em" /></Button>
        <div className="leitor-pagina" ref={alvo} />
        <Button className="leitor-seta" onPress={() => void motor.current?.proxima()} aria-label={t.proxima}><ChevronRight aria-hidden="true" size="1.6em" /></Button>
      </div>
    </div>
  );
}
