import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Form } from "react-aria-components";
import { Leitor, CONFIG_PADRAO, CORES_ANOTACAO, type ConfigLeitura, type CorFundo, type Localizacao, type ModoCaneta, type ResultadoBusca, type Traco } from "@orbita/leitor";
import atkinsonUrl from "@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url";
import lexendUrl from "@fontsource-variable/lexend/files/lexend-latin-wght-normal.woff2?url";
import dyslexicUrl from "../fontes/opendyslexic/OpenDyslexic-Regular.woff2?url";
import { api, type Anotacao, type CorEtiqueta, type Livro } from "../api";
import { lerComMigracao } from "../valores";
import { Aviso, Campo } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { EscolherCor } from "../ideias/etiquetas";
import { Bookmark, ChevronLeft, ChevronRight, Highlighter, List, Pause, PenLine, Play, Ruler, Search, SlidersHorizontal, StickyNote, Trash2, X } from "../icones";
import { dividirEmFrases, vozesEmPortugues } from "./voz";
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

// Ajustes do leitor e posição em cada livro ficam no cofre (antes, no localStorage; migram sozinhos).
const validarConfig = (bruto: unknown): ConfigLeitura => ({ ...CONFIG_PADRAO, ...(typeof bruto === "object" && bruto ? (bruto as Partial<ConfigLeitura>) : {}) });
const validarPos = (bruto: unknown): Localizacao | undefined => (typeof bruto === "object" && bruto ? (bruto as Localizacao) : undefined);
const lerConfig = () => lerComMigracao("leitura.config", CHAVE_CONFIG, validarConfig).then((c) => c ?? CONFIG_PADRAO, () => CONFIG_PADRAO);
const lerPos = (id: string) => lerComMigracao(`leitura.posicao.${id}`, chavePos(id), validarPos).then((p) => p ?? undefined, () => undefined);

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
  const [config, setConfig] = useState<ConfigLeitura>(CONFIG_PADRAO);
  // A posição muda a cada página virada: grava com uma pequena espera, e na hora ao fechar.
  const posPendente = useRef<Localizacao | null>(null);
  const posTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gravarPos = () => {
    if (posTimer.current) clearTimeout(posTimer.current);
    posTimer.current = null;
    const p = posPendente.current;
    if (!p) return;
    posPendente.current = null;
    void api.gravarValor(`leitura.posicao.${livro.id}`, p).catch(() => {});
  };
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
  // Busca no livro.
  const [buscando, setBuscando] = useState(false);
  // Régua de leitura: uma faixa que acompanha o ponteiro (ou as setas); o resto fica mais escuro.
  const [regua, setRegua] = useState(() => { try { return localStorage.getItem("leitor-regua") === "1"; } catch { return false; } });
  const [yRegua, setYRegua] = useState<number | null>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const mudarRegua = (v: boolean) => { setRegua(v); try { localStorage.setItem("leitor-regua", v ? "1" : "0"); } catch { /* só nesta sessão */ } };
  // Ler em voz alta (voz do aparelho).
  const [voz, setVoz] = useState<{ estado: "falando" | "pausado"; frase: string } | null>(null);
  const [velocidade, setVelocidade] = useState(1);
  const [nomeVoz, setNomeVoz] = useState("");
  const [vozes, setVozes] = useState<SpeechSynthesisVoice[]>([]);
  const fala = useRef<{ parar: boolean } | null>(null);
  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    const ler = () => setVozes(vozesEmPortugues(speechSynthesis.getVoices()));
    ler();
    speechSynthesis.addEventListener?.("voiceschanged", ler);
    return () => { speechSynthesis.removeEventListener?.("voiceschanged", ler); fala.current && (fala.current.parar = true); speechSynthesis.cancel(); };
  }, []);
  const falarFrase = (frase: string) => new Promise<void>((pronto) => {
    const u = new SpeechSynthesisUtterance(frase);
    u.lang = "pt-BR";
    u.rate = velocidade;
    const escolhida = vozes.find((v) => v.name === nomeVoz) ?? vozes[0];
    if (escolhida) u.voice = escolhida;
    u.onend = () => pronto();
    u.onerror = () => pronto();
    speechSynthesis.speak(u);
  });
  const ouvir = async () => {
    if (typeof speechSynthesis === "undefined" || !motor.current) { setErro(t.voz.semVoz); return; }
    speechSynthesis.cancel();
    const ctl = { parar: false };
    fala.current = ctl;
    try {
      do {
        const texto = await motor.current.textoAPartirDaqui();
        for (const frase of dividirEmFrases(texto)) {
          if (ctl.parar) break;
          setVoz({ estado: "falando", frase });
          await falarFrase(frase);
        }
        if (ctl.parar) break;
      } while (await motor.current.avancarParaLer());
    } finally {
      if (fala.current === ctl) { fala.current = null; setVoz(null); }
    }
  };
  const pararVoz = () => { if (fala.current) fala.current.parar = true; speechSynthesis.cancel(); setVoz(null); };
  const pausarVoz = () => {
    if (!voz) return;
    if (voz.estado === "falando") { speechSynthesis.pause(); setVoz({ ...voz, estado: "pausado" }); }
    else { speechSynthesis.resume(); setVoz({ ...voz, estado: "falando" }); }
  };

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
      posPendente.current = loc;
      if (posTimer.current) clearTimeout(posTimer.current);
      posTimer.current = setTimeout(gravarPos, 800);
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
        const [cfg, inicial] = await Promise.all([lerConfig(), lerPos(livro.id)]);
        if (!vivo) return;
        setConfig(cfg);
        await leitor.abrir(base64ParaBytes(b64), livro.formato as "epub" | "pdf", cfg, inicial);
        leitor.aoMoverPonteiro((y) => { if (vivo) setYRegua(y); });
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
      gravarPos();
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
    void api.gravarValor("leitura.config", novo).catch(() => {});
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
          <Button className={buscando ? "botao-icone principal" : "botao-icone"} onPress={() => setBuscando((v) => !v)} aria-label={t.busca.abrir} aria-pressed={buscando}><Search aria-hidden="true" size="1.2em" /></Button>
          <Button className={voz ? "botao-icone principal" : "botao-icone"} onPress={() => (voz ? pararVoz() : void ouvir())} aria-label={voz ? t.voz.parar : t.voz.ouvir} aria-pressed={!!voz}><Play aria-hidden="true" size="1.2em" /></Button>
          <Button className={regua ? "botao-icone principal" : "botao-icone"} onPress={() => mudarRegua(!regua)} aria-label={t.regua.alternar} aria-pressed={regua}><Ruler aria-hidden="true" size="1.2em" /></Button>
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

      {voz && (
        <div className="leitor-voz" role="group" aria-label={t.voz.titulo}>
          <Button className="botao pequeno com-icone" onPress={pausarVoz}>{voz.estado === "falando" ? <><Pause aria-hidden="true" size="1em" /> {t.voz.pausar}</> : <><Play aria-hidden="true" size="1em" /> {t.voz.continuar}</>}</Button>
          <Button className="botao pequeno" onPress={pararVoz}>{t.voz.parar}</Button>
          <label className="leitor-voz-campo">{t.voz.velocidade}
            <select className="entrada-texto sozinha" value={String(velocidade)} onChange={(e) => setVelocidade(Number(e.target.value))}>
              {[0.75, 0.9, 1, 1.15, 1.3, 1.5].map((v) => <option key={v} value={v}>{String(v).replace(".", ",")}×</option>)}
            </select>
          </label>
          {vozes.length > 1 && (
            <label className="leitor-voz-campo">{t.voz.voz}
              <select className="entrada-texto sozinha" value={nomeVoz} onChange={(e) => setNomeVoz(e.target.value)}>
                {vozes.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
            </label>
          )}
          <span className="leitor-voz-frase texto-suave" aria-live="off">{voz.frase}</span>
        </div>
      )}

      <div className="leitor-conteudo" ref={conteudo}>
        <Button className="leitor-seta" onPress={() => void motor.current?.anterior()} aria-label={t.anterior}><ChevronLeft aria-hidden="true" size="1.6em" /></Button>
        <div className="leitor-pagina" ref={alvo} />
        {regua && <Regua y={yRegua} caixa={conteudo} altura={Math.round(16 * (config.tamanho / 100) * (config.entrelinha || 1.6) * 1.6)} aoMover={setYRegua} />}
        <Button className="leitor-seta" onPress={() => void motor.current?.proxima()} aria-label={t.proxima}><ChevronRight aria-hidden="true" size="1.6em" /></Button>
      </div>

      {buscando && motor.current && <PainelBusca motor={motor.current} ehPdf={ehPdf} aoFechar={() => setBuscando(false)} />}

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

/** Busca no livro: digita, vê os trechos e vai até o achado. */
function PainelBusca({ motor, ehPdf, aoFechar }: { motor: Leitor; ehPdf: boolean; aoFechar: () => void }) {
  const tb = t.busca;
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<ResultadoBusca[] | null>(null);
  const [procurando, setProcurando] = useState(false);
  const procurar = async () => {
    if (termo.trim().length < 2) return;
    setProcurando(true);
    try { setAchados(await motor.buscar(termo)); } finally { setProcurando(false); }
  };
  return (
    <aside className="leitor-painel leitor-busca" aria-label={tb.titulo}>
      <div className="leitor-painel-topo">
        <h2>{tb.titulo}</h2>
        <Button className="botao-icone" onPress={aoFechar} aria-label={t.fechar}><X aria-hidden="true" size="1.1em" /></Button>
      </div>
      <Form className="leitor-busca-form" onSubmit={(e) => { e.preventDefault(); void procurar(); }}>
        <input className="entrada-texto" autoFocus value={termo} onChange={(e) => setTermo(e.target.value)} placeholder={tb.dica} aria-label={tb.campo} />
        <Button type="submit" className="botao principal" isDisabled={procurando || termo.trim().length < 2}>{procurando ? tb.procurando : tb.procurar}</Button>
      </Form>
      {achados && <p className="texto-suave pequeno" role="status">{tb.quantos(achados.length)}</p>}
      {achados && achados.length > 0 && (
        <ol className="leitor-busca-lista">
          {achados.map((a, i) => (
            <li key={`${a.destino}-${i}`}>
              <button type="button" className="leitor-busca-item" onClick={() => void motor.irParaResultado(a)}>
                {ehPdf && <span className="leitor-busca-onde">{a.onde}</span>}
                <span>{a.trecho}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

/** Régua de leitura: a faixa da linha fica clara e o resto, mais escuro. Setas (ou o ponteiro) movem. */
function Regua({ y, caixa, altura, aoMover }: { y: number | null; caixa: React.RefObject<HTMLDivElement | null>; altura: number; aoMover: (y: number) => void }) {
  const r = caixa.current?.getBoundingClientRect();
  const centro = y ?? (r ? r.top + r.height / 3 : 200);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select")) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      aoMover(centro + (e.key === "ArrowDown" ? 1 : -1) * altura * 0.6);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [centro, altura, aoMover]);
  if (!r) return null;
  const topo = Math.max(0, centro - r.top - altura / 2);
  return (
    <div className="leitor-regua" aria-hidden="true">
      <div className="leitor-regua-sombra" style={{ height: topo }} />
      <div className="leitor-regua-faixa" style={{ height: altura }} />
      <div className="leitor-regua-sombra resto" />
    </div>
  );
}
