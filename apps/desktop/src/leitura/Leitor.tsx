import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Form } from "react-aria-components";
import { Leitor, CONFIG_PADRAO, CORES_ANOTACAO, type ConfigLeitura, type CorFundo, type Localizacao, type ModoCaneta, type Traco } from "@orbita/leitor";
import atkinsonUrl from "@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url";
import lexendUrl from "@fontsource-variable/lexend/files/lexend-latin-wght-normal.woff2?url";
import dyslexicUrl from "../fontes/opendyslexic/OpenDyslexic-Regular.woff2?url";
import { api, type Anotacao, type CorEtiqueta, type Livro } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { EscolherCor } from "../ideias/etiquetas";
import { Bookmark, ChevronLeft, ChevronRight, Highlighter, List, PenLine, SlidersHorizontal, StickyNote, Trash2, X } from "../icones";
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
// Espessuras da caneta, relativas à largura da página. A grossa (marca-texto) fica translúcida.
const ESPESSURAS: Record<string, number> = { fina: 0.004, media: 0.007, grossa: 0.011 };
const ESPESSURA_MARCA = 0.022;
const chaveProxima = (valor: number, mapa: Record<string, number>) =>
  Object.keys(mapa).reduce((a, b) => (Math.abs(mapa[b] - valor) < Math.abs(mapa[a] - valor) ? b : a));

const corHex = (nome: string) => CORES_ANOTACAO[nome] ?? CORES_ANOTACAO.mar;
/** Converte as anotações de traço guardadas no formato que o motor desenha. */
const tracosDoLivro = (lista: Anotacao[]): Traco[] =>
  lista
    .filter((a) => a.tipo === "traco")
    .map((a) => ({ id: a.id, pagina: a.pdfPagina, cor: corHex(a.cor), espessura: a.espessura, pontos: a.pontos }));

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
  const [mostrarAnotacoes, setMostrarAnotacoes] = useState(false);
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [selecao, setSelecao] = useState<{ cfiRange: string; texto: string } | null>(null);
  const [notaAberta, setNotaAberta] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Caneta do PDF.
  const [ferramenta, setFerramenta] = useState<ModoCaneta>("ler");
  const [corCaneta, setCorCaneta] = useState<CorEtiqueta>("mar");
  const [espessura, setEspessura] = useState("media");
  const ehPdf = livro.formato === "pdf";

  const recarregar = () => api.listarAnotacoes(livro.id).then(setAnotacoes).catch(() => {});

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
    // Selecionar texto no EPUB abre o painel de grifar.
    leitor.aoSelecionarTexto((s) => {
      if (vivo) setSelecao(s);
    });
    // Novo traço da caneta no PDF: guarda e redesenha já salvo.
    leitor.aoTracarNovo(async (tr) => {
      try {
        await api.salvarAnotacao({
          id: "", livroId: livro.id, tipo: "traco", epubCfi: "", epubCfiRange: "",
          pdfPagina: tr.pagina, cor: nomeDaCor(tr.cor), texto: "", trecho: "", pontos: tr.pontos, espessura: tr.espessura, criadoEm: 0,
        });
        const lista = await api.listarAnotacoes(livro.id);
        if (!vivo) return;
        setAnotacoes(lista);
        motor.current?.desenharTracos(tracosDoLivro(lista));
      } catch {
        // Se não salvar, o traço some; a pessoa tenta de novo.
      }
    });
    leitor.aoApagarTracoGuardado(async (id) => {
      try {
        await api.excluirAnotacao(id);
      } catch {
        // Ignora; recarrega mesmo assim.
      }
      if (vivo) recarregar();
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
        const lista = await api.listarAnotacoes(livro.id);
        if (!vivo) return;
        setAnotacoes(lista);
        if (livro.formato === "pdf") {
          leitor.desenharTracos(tracosDoLivro(lista));
        } else {
          leitor.aplicarGrifos(lista.filter((a) => a.tipo === "grifo").map((a) => ({ cfiRange: a.epubCfiRange, cor: corHex(a.cor) })));
        }
        setCarregando(false);
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

  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(null), 2500);
    return () => clearTimeout(id);
  }, [aviso]);

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

  // Troca a ferramenta da caneta e repassa ao motor.
  const mudarFerramenta = (f: ModoCaneta) => {
    setFerramenta(f);
    motor.current?.definirModoCaneta(f);
    motor.current?.definirCorTraco(corHex(corCaneta));
    motor.current?.definirEspessuraTraco(f === "marcaTexto" ? ESPESSURA_MARCA : ESPESSURAS[espessura]);
  };
  const mudarCorCaneta = (c: CorEtiqueta) => {
    setCorCaneta(c);
    motor.current?.definirCorTraco(corHex(c));
  };
  const mudarEspessura = (e: string) => {
    setEspessura(e);
    if (ferramenta !== "marcaTexto") motor.current?.definirEspessuraTraco(ESPESSURAS[e]);
  };

  const marcarPagina = async () => {
    const loc = motor.current?.localizacaoAtual() ?? {};
    await api.salvarAnotacao({
      id: "", livroId: livro.id, tipo: "marcador", epubCfi: loc.epubCfi ?? "", epubCfiRange: "",
      pdfPagina: loc.pdfPagina ?? 0, cor: "", texto: "", trecho: "", pontos: [], espessura: 0, criadoEm: 0,
    });
    setAviso(t.marcarAqui);
    recarregar();
  };

  const salvarNota = async (texto: string) => {
    const loc = motor.current?.localizacaoAtual() ?? {};
    await api.salvarAnotacao({
      id: "", livroId: livro.id, tipo: "nota", epubCfi: loc.epubCfi ?? "", epubCfiRange: "",
      pdfPagina: loc.pdfPagina ?? 0, cor: "", texto, trecho: "", pontos: [], espessura: 0, criadoEm: 0,
    });
    setNotaAberta(false);
    recarregar();
  };

  const confirmarGrifo = async (cor: CorEtiqueta, nota: string) => {
    if (!selecao) return;
    await api.salvarAnotacao({
      id: "", livroId: livro.id, tipo: "grifo", epubCfi: "", epubCfiRange: selecao.cfiRange,
      pdfPagina: 0, cor, texto: nota, trecho: selecao.texto, pontos: [], espessura: 0, criadoEm: 0,
    });
    motor.current?.grifar(selecao.cfiRange, corHex(cor));
    motor.current?.limparSelecao();
    setSelecao(null);
    recarregar();
  };

  const irPara = (a: Anotacao) => {
    const destino = ehPdf ? String(a.pdfPagina) : a.epubCfiRange || a.epubCfi;
    void motor.current?.irPara(destino);
    setMostrarAnotacoes(false);
  };

  const apagarAnotacao = async (a: Anotacao) => {
    await api.excluirAnotacao(a.id);
    if (a.tipo === "grifo") motor.current?.removerGrifo(a.epubCfiRange);
    const lista = await api.listarAnotacoes(livro.id);
    setAnotacoes(lista);
    if (ehPdf) motor.current?.desenharTracos(tracosDoLivro(lista));
  };

  const fonteAtual = Object.keys(FONTES).find((k) => FONTES[k] === config.fonte) ?? "atkinson";

  return (
    <div className="leitor-tela">
      <div className="leitor-barra">
        <Button className="botao-icone" onPress={aoFechar} aria-label={t.fechar}><X aria-hidden="true" size="1.2em" /></Button>
        <strong className="leitor-titulo quebra">{livro.titulo}</strong>
        <div className="leitor-controles">
          <Button className="botao-icone" onPress={() => void marcarPagina()} aria-label={t.marcar}><Bookmark aria-hidden="true" size="1.2em" /></Button>
          <Button className="botao-icone" onPress={() => setNotaAberta(true)} aria-label={t.notaAqui}><StickyNote aria-hidden="true" size="1.2em" /></Button>
          <Button className={mostrarAnotacoes ? "botao-icone principal" : "botao-icone"} onPress={() => setMostrarAnotacoes((v) => !v)} aria-label={t.verAnotacoes} aria-pressed={mostrarAnotacoes}><List aria-hidden="true" size="1.2em" /></Button>
          <Button className="botao-icone" onPress={() => mudarConfig({ tamanho: Math.max(60, config.tamanho - 10) })} aria-label={t.menor}>A−</Button>
          <Button className="botao-icone" onPress={() => mudarConfig({ tamanho: Math.min(300, config.tamanho + 10) })} aria-label={t.maior}>A+</Button>
          <Button className={mostrarAjustes ? "botao-icone principal" : "botao-icone"} onPress={() => setMostrarAjustes((v) => !v)} aria-label={t.ajustes} aria-pressed={mostrarAjustes}>
            <SlidersHorizontal aria-hidden="true" size="1.2em" />
          </Button>
        </div>
      </div>

      {ehPdf && (
        <div className="leitor-caneta-barra" role="toolbar" aria-label={t.caneta.titulo}>
          <Segmentado
            rotulo={t.caneta.titulo}
            rotuloOculto
            valor={ferramenta}
            aoMudar={(v) => mudarFerramenta(v as ModoCaneta)}
            opcoes={[
              { valor: "ler", nome: t.caneta.ler },
              { valor: "caneta", nome: t.caneta.caneta },
              { valor: "marcaTexto", nome: t.caneta.marcaTexto },
              { valor: "borracha", nome: t.caneta.borracha },
            ]}
          />
          {(ferramenta === "caneta" || ferramenta === "marcaTexto") && (
            <div className="leitor-caneta-opcoes">
              <EscolherCor valor={corCaneta} aoMudar={mudarCorCaneta} rotulo={t.caneta.cor} />
              {ferramenta === "caneta" && (
                <Segmentado
                  rotulo={t.caneta.espessura}
                  valor={espessura}
                  aoMudar={mudarEspessura}
                  opcoes={[
                    { valor: "fina", nome: t.caneta.espessuras.fina },
                    { valor: "media", nome: t.caneta.espessuras.media },
                    { valor: "grossa", nome: t.caneta.espessuras.grossa },
                  ]}
                />
              )}
            </div>
          )}
        </div>
      )}

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

      {aviso && <div className="leitor-aviso"><Aviso tipo="ok">{aviso}</Aviso></div>}
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

      {mostrarAnotacoes && (
        <PainelAnotacoes anotacoes={anotacoes} ehPdf={ehPdf} aoIr={irPara} aoApagar={(a) => void apagarAnotacao(a)} aoFechar={() => setMostrarAnotacoes(false)} />
      )}

      {selecao && (
        <FormGrifo texto={selecao.texto} aoConfirmar={(cor, nota) => void confirmarGrifo(cor, nota)} aoCancelar={() => { motor.current?.limparSelecao(); setSelecao(null); }} />
      )}

      <Janela titulo={t.nota.titulo} aberta={notaAberta} aoFechar={() => setNotaAberta(false)}>
        <FormNota aoSalvar={(texto) => void salvarNota(texto)} aoFechar={() => setNotaAberta(false)} />
      </Janela>
    </div>
  );
}

function nomeDaCor(hex: string): string {
  const achado = Object.entries(CORES_ANOTACAO).find(([, h]) => h === hex);
  return achado ? achado[0] : "mar";
}

const ICONE_TIPO = { marcador: Bookmark, nota: StickyNote, grifo: Highlighter, traco: PenLine } as const;

function PainelAnotacoes({ anotacoes, ehPdf, aoIr, aoApagar, aoFechar }: {
  anotacoes: Anotacao[];
  ehPdf: boolean;
  aoIr: (a: Anotacao) => void;
  aoApagar: (a: Anotacao) => void;
  aoFechar: () => void;
}) {
  const fmt = useMemo(() => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }), []);
  const rotulo = (a: Anotacao) => {
    if (a.trecho) return `“${a.trecho}”`;
    if (a.texto) return a.texto;
    if (ehPdf && a.pdfPagina) return `Página ${a.pdfPagina}`;
    return t.tipos[a.tipo];
  };
  return (
    <aside className="leitor-painel" aria-label={t.anotacoes}>
      <div className="leitor-painel-topo">
        <strong>{t.anotacoes}</strong>
        <Button className="botao-icone" onPress={aoFechar} aria-label={t.fechar}><X aria-hidden="true" size="1.1em" /></Button>
      </div>
      {anotacoes.length === 0 ? (
        <p className="texto-suave">{t.semAnotacoes}</p>
      ) : (
        <ul className="lista-simples sem-marcador">
          {anotacoes.map((a) => {
            const Icone = ICONE_TIPO[a.tipo];
            return (
              <li key={a.id} className="leitor-anotacao">
                <span className="leitor-anotacao-topo">
                  <Icone aria-hidden="true" size="1.1em" />
                  {a.cor && <span className={`etiqueta-cor cor-${a.cor}`} aria-hidden="true" />}
                  <span className="texto-suave pequeno">{t.tipos[a.tipo]} · {fmt.format(new Date(a.criadoEm))}</span>
                </span>
                <p className="quebra">{rotulo(a)}</p>
                {a.trecho && a.texto && <p className="campo-ajuda quebra">{a.texto}</p>}
                <span className="linha-ajuste">
                  <Button className="botao pequeno" onPress={() => aoIr(a)}>{t.irPara}</Button>
                  <Button className="botao-icone" onPress={() => aoApagar(a)} aria-label={`${t.apagar}: ${t.tipos[a.tipo]}`}><Trash2 aria-hidden="true" size="1.05em" /></Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function FormGrifo({ texto, aoConfirmar, aoCancelar }: { texto: string; aoConfirmar: (cor: CorEtiqueta, nota: string) => void; aoCancelar: () => void }) {
  const [cor, setCor] = useState<CorEtiqueta>("areia");
  const [nota, setNota] = useState("");
  return (
    <div className="leitor-grifo-popup" role="dialog" aria-label={t.grifo.titulo}>
      {texto && <p className="quebra leitor-grifo-trecho">“{texto}”</p>}
      <EscolherCor valor={cor} aoMudar={setCor} rotulo={t.grifo.escolhaCor} />
      <Campo rotulo={t.grifo.comNota} valor={nota} aoMudar={setNota} multilinha />
      <div className="janela-acoes">
        <Button className="botao" onPress={aoCancelar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" onPress={() => aoConfirmar(cor, nota)}><Highlighter aria-hidden="true" size="1.1em" /> {t.grifo.confirmar}</Button>
      </div>
    </div>
  );
}

function FormNota({ aoSalvar, aoFechar }: { aoSalvar: (texto: string) => void; aoFechar: () => void }) {
  const [texto, setTexto] = useState("");
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (texto.trim()) aoSalvar(texto);
  };
  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.nota.campo} valor={texto} aoMudar={setTexto} autoFocus multilinha />
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{t.nota.salvar}</Button>
      </div>
    </Form>
  );
}
