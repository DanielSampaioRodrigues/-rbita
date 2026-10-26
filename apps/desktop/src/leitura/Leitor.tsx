import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { Leitor, CONFIG_PADRAO, type ConfigLeitura, type CorFundo, type Localizacao } from "@orbita/leitor";
import { api, type Livro } from "../api";
import { Aviso } from "../componentes/Campo";
import { Segmentado } from "../componentes/Segmentado";
import { ChevronLeft, ChevronRight, X } from "../icones";
import { textos } from "../textos/pt-BR";

const t = textos.leitura.leitor;
const CHAVE_CONFIG = "orbita.leitura.config";
const chavePos = (id: string) => `orbita.leitura.pos.${id}`;

const FONTES: Record<string, string> = {
  atkinson: "Atkinson Hyperlegible Next",
  lexend: "Lexend",
  dislexia: "OpenDyslexic",
};

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
  const [erro, setErro] = useState<string | null>(null);

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
          <Segmentado
            rotulo={t.fundo}
            rotuloOculto
            valor={config.corFundo}
            aoMudar={(v) => mudarConfig({ corFundo: v as CorFundo })}
            opcoes={(["branco", "creme", "polen", "cinza", "escuro"] as CorFundo[]).map((c) => ({ valor: c, nome: t.fundos[c] }))}
          />
          <Segmentado
            rotulo={t.fonte}
            rotuloOculto
            valor={fonteAtual}
            aoMudar={(v) => mudarConfig({ fonte: FONTES[v] })}
            opcoes={[
              { valor: "atkinson", nome: t.fontes.atkinson },
              { valor: "lexend", nome: t.fontes.lexend },
              { valor: "dislexia", nome: t.fontes.dislexia },
            ]}
          />
          <Button className="botao-icone" onPress={() => mudarConfig({ tamanho: Math.max(60, config.tamanho - 10) })} aria-label={t.menor}>A−</Button>
          <Button className="botao-icone" onPress={() => mudarConfig({ tamanho: Math.min(300, config.tamanho + 10) })} aria-label={t.maior}>A+</Button>
          <Segmentado
            rotulo={t.modo}
            rotuloOculto
            valor={config.modo}
            aoMudar={(v) => mudarConfig({ modo: v as "paginas" | "rolagem" })}
            opcoes={[
              { valor: "paginas", nome: t.modos.paginas },
              { valor: "rolagem", nome: t.modos.rolagem },
            ]}
          />
        </div>
      </div>

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
