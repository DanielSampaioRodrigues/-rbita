import { GRADIENTES, gravarArquivoTema, lerArquivoTema, limparSvg, PADROES, paletaFinal, SvgInvalido, TEMAS, camadaDeFundo, type Fundo, type Tema } from "@orbita/temas";
import { Download, ImagePlus, Palette, Shapes, Trash2, Upload } from "../icones";
import { Button } from "react-aria-components";
import { exportarTema } from "../api";
import { useRecado } from "../app/Recado";
import { temaDasPreferencias } from "../preferencias";
import { useEffect, useRef, useState } from "react";
import { Label, Radio, RadioGroup, Slider, SliderOutput, SliderThumb, SliderTrack } from "react-aria-components";
import { modoEfetivo, paletaAtual } from "../aparencia";
import { Aviso } from "../componentes/Campo";
import { Interruptor } from "../componentes/Interruptor";
import { usePreferencias } from "../estado";
import { prepararFoto } from "../fundo";
import { textos } from "../textos/pt-BR";

const t = textos.temaFundo;

/** Chave única de cada opção de fundo, para o grupo de escolha. */
const chaveDe = (f: Fundo | null) =>
  !f ? "tema" : f.tipo === "gradiente" || f.tipo === "padrao" ? `${f.tipo}:${f.nome}` : f.tipo;

function Controle({ rotulo, valor, min, max, passo, formatar, aoMudar }: { rotulo: string; valor: number; min: number; max: number; passo: number; formatar: (v: number) => string; aoMudar: (v: number) => void }) {
  return (
    <Slider className="controle-deslizante" value={valor} minValue={min} maxValue={max} step={passo} onChange={aoMudar}>
      <div className="linha-ajuste">
        <Label className="campo-rotulo">{rotulo}</Label>
        <SliderOutput className="texto-suave">{({ state }) => formatar(state.values[0])}</SliderOutput>
      </div>
      <SliderTrack className="trilho">
        {({ state }) => (
          <>
            <div className="trilho-preenchido" style={{ width: `${state.getThumbPercent(0) * 100}%` }} />
            <SliderThumb className="botao-deslizante" />
          </>
        )}
      </SliderTrack>
    </Slider>
  );
}

export function TemaFundo({ aoEditarTema }: { aoEditarTema: (tema: Tema) => void }) {
  const { prefs, mudar } = usePreferencias();
  const recado = useRecado();
  const entradaTema = useRef<HTMLInputElement>(null);
  const temaAtual = temaDasPreferencias(prefs);
  const proprio = temaAtual.id.startsWith("proprio-");
  const [erro, setErro] = useState<string | null>(null);
  const [opacidade, setOpacidade] = useState(1);
  const entradaImagem = useRef<HTMLInputElement>(null);
  const entradaSvg = useRef<HTMLInputElement>(null);
  const modo = modoEfetivo(prefs);
  const paleta = paletaAtual(prefs);
  const fundo = prefs.fundo;

  // Lê a opacidade calculada pelo contraste automático, para avisar o que mudou.
  useEffect(() => {
    const ler = () => setOpacidade(Number(getComputedStyle(document.documentElement).getPropertyValue("--opacidade-paineis")) || 1);
    ler();
    const intervalo = setInterval(ler, 400);
    const parar = setTimeout(() => clearInterval(intervalo), 3000);
    return () => (clearInterval(intervalo), clearTimeout(parar));
  }, [prefs.fundo, prefs.tema, prefs.fundoVisivel, modo]);

  const miniatura = (f: Fundo) => {
    const c = camadaDeFundo(f, paleta, { baixoEstimulo: false, reduzirAnimacao: true });
    return {
      backgroundColor: paleta.fundo,
      backgroundImage: c.imagem,
      backgroundSize: c.tamanho === "cover" ? "cover" : c.tamanho,
      backgroundRepeat: c.repetir,
    };
  };

  const escolher = (chave: string) => {
    setErro(null);
    if (chave === "tema") return mudar({ fundo: null });
    if (chave === "cor") return mudar({ fundo: { tipo: "cor" } });
    if (chave === "imagem") return entradaImagem.current?.click();
    if (chave === "svg") return entradaSvg.current?.click();
    const [tipo, nome] = chave.split(":");
    mudar({ fundo: { tipo: tipo as "gradiente" | "padrao", nome } });
  };

  const opcoes: { chave: string; nome: string; estilo?: React.CSSProperties; icone?: React.ReactNode }[] = [
    { chave: "tema", nome: t.fundoDoTema, estilo: miniatura(temaAtual.fundoPadrao ?? { tipo: "cor" }) },
    { chave: "cor", nome: t.cor, estilo: miniatura({ tipo: "cor" }) },
    ...Object.entries(GRADIENTES).map(([nome, g]) => ({ chave: `gradiente:${nome}`, nome: g.nome, estilo: miniatura({ tipo: "gradiente", nome }) })),
    ...Object.entries(PADROES).map(([nome, pd]) => ({ chave: `padrao:${nome}`, nome: pd.nome, estilo: miniatura({ tipo: "padrao", nome }) })),
    {
      chave: "imagem",
      nome: t.imagem,
      estilo: fundo?.tipo === "imagem" ? { backgroundImage: `url("${fundo.dados}")`, backgroundSize: "cover" } : undefined,
      icone: fundo?.tipo === "imagem" ? undefined : <ImagePlus aria-hidden="true" size="1.4em" />,
    },
    {
      chave: "svg",
      nome: t.svg,
      estilo: fundo?.tipo === "svg" ? miniatura(fundo) : undefined,
      icone: fundo?.tipo === "svg" ? undefined : <Shapes aria-hidden="true" size="1.4em" />,
    },
  ];

  return (
    <section className="cartao">
      <h2>{t.titulo}</h2>

      <RadioGroup className="campo" value={prefs.tema} onChange={(tema) => mudar({ tema })}>
        <Label className="campo-rotulo">{t.tema}</Label>
        <div className="grade-temas">
          {[...TEMAS, ...prefs.temasProprios].map((tema) => {
            const p = paletaFinal(tema, modo, false);
            return (
              <Radio key={tema.id} value={tema.id} className="opcao-tema">
                <span className="amostra-tema" aria-hidden="true" style={{ background: p.fundo, borderRadius: `calc(0.5rem * ${tema.cantos ?? 1})` }}>
                  <span style={{ background: p.superficie, borderColor: p.borda }} className="amostra-painel">
                    <span style={{ background: p.texto }} className="amostra-linha" />
                    <span style={{ background: p.textoSuave }} className="amostra-linha curta" />
                    <span style={{ background: p.destaque }} className="amostra-botao" />
                  </span>
                </span>
                <span>{tema.nome}</span>
              </Radio>
            );
          })}
        </div>
      </RadioGroup>

      <div className="botoes">
        <Button className="botao" onPress={() => aoEditarTema(proprio ? temaAtual : { ...temaAtual, id: `proprio-${Date.now().toString(36)}`, nome: `${temaAtual.nome} (meu)`, fundoPadrao: prefs.fundo?.tipo === "imagem" ? temaAtual.fundoPadrao : (prefs.fundo ?? temaAtual.fundoPadrao) })}>
          <Palette aria-hidden="true" size="1.1em" /> {proprio ? t.editar : t.criarAPartir}
        </Button>
        <Button className="botao" onPress={async () => { if (await exportarTema(temaAtual.nome, gravarArquivoTema(temaAtual))) recado(t.exportado); }}>
          <Download aria-hidden="true" size="1.1em" /> {t.exportar}
        </Button>
        <Button className="botao" onPress={() => entradaTema.current?.click()}>
          <Upload aria-hidden="true" size="1.1em" /> {t.importar}
        </Button>
        {proprio && (
          <Button className="botao" onPress={() => mudar({ tema: "papel", temasProprios: prefs.temasProprios.filter((x) => x.id !== temaAtual.id) })}>
            <Trash2 aria-hidden="true" size="1.1em" /> {t.excluir}
          </Button>
        )}
      </div>
      <input
        ref={entradaTema}
        type="file"
        accept=".orbita-tema,application/json"
        hidden
        onChange={async (e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (!arquivo) return;
          try {
            const { tema, ajustado } = lerArquivoTema(await arquivo.text());
            mudar({ temasProprios: [...prefs.temasProprios, tema], tema: tema.id });
            recado(ajustado ? t.importadoAjustado(tema.nome) : t.importado(tema.nome));
          } catch (err) {
            setErro(err instanceof Error ? err.message : String(err));
          }
        }}
      />

      <RadioGroup className="campo" value={chaveDe(fundo)} onChange={escolher}>
        <Label className="campo-rotulo">{t.fundo}</Label>
        <div className="grade-fundos">
          {opcoes.map((o) => (
            <Radio key={o.chave} value={o.chave} className="opcao-fundo">
              <span className="amostra-fundo" aria-hidden="true" style={o.estilo}>{o.icone}</span>
              <span>{o.nome}</span>
            </Radio>
          ))}
        </div>
      </RadioGroup>

      <input
        ref={entradaImagem}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={async (e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (!arquivo) return;
          try {
            const dados = await prepararFoto(arquivo);
            mudar({ fundo: { tipo: "imagem", dados, desfoque: 0, escurecimento: 0 } });
          } catch {
            setErro(t.erroImagem);
          }
        }}
      />
      <input
        ref={entradaSvg}
        type="file"
        accept=".svg,image/svg+xml"
        hidden
        onChange={async (e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (!arquivo) return;
          try {
            const conteudo = limparSvg(await arquivo.text());
            mudar({ fundo: { tipo: "svg", conteudo, repetir: true, animar: false } });
          } catch (err) {
            setErro(err instanceof SvgInvalido ? err.message : String(err));
          }
        }}
      />

      {fundo?.tipo === "imagem" && (
        <div className="formulario">
          <Controle rotulo={t.desfoque} valor={fundo.desfoque} min={0} max={20} passo={1} formatar={(v) => `${v} px`} aoMudar={(desfoque) => mudar({ fundo: { ...fundo, desfoque } })} />
          <Controle
            rotulo={t.escurecimento}
            valor={Math.round(fundo.escurecimento * 100)}
            min={0}
            max={60}
            passo={5}
            formatar={(v) => `${v}%`}
            aoMudar={(v) => mudar({ fundo: { ...fundo, escurecimento: v / 100 } })}
          />
        </div>
      )}
      {fundo?.tipo === "svg" && (
        <div className="formulario">
          <p className="campo-ajuda">{t.svgLimpo}</p>
          <Interruptor rotulo={t.repetir} ligado={fundo.repetir} aoMudar={(repetir) => mudar({ fundo: { ...fundo, repetir } })} />
          <div className="campo">
            <Interruptor rotulo={t.animar} ligado={fundo.animar} aoMudar={(animar) => mudar({ fundo: { ...fundo, animar } })} />
            <p className="campo-ajuda">{t.animarExplicacao}</p>
          </div>
        </div>
      )}

      {!prefs.baixoEstimulo && (fundo ?? temaAtual.fundoPadrao ?? { tipo: "cor" }).tipo !== "cor" && (
        <div className="formulario">
          <div className="campo">
            <Controle rotulo={t.visivel} valor={prefs.fundoVisivel} min={0} max={100} passo={10} formatar={t.visivelValor} aoMudar={(fundoVisivel) => mudar({ fundoVisivel })} />
            <p className="campo-ajuda">{prefs.fundoVisivel > 0 ? t.visivelAviso : t.visivelAjuda}</p>
          </div>
        </div>
      )}

      {prefs.baixoEstimulo ? (
        <p className="campo-ajuda">{t.baixoEstimulo}</p>
      ) : (
        opacidade < 1 && opacidade > 0 && <p className="campo-ajuda">{t.opacidade(Math.round(opacidade * 100))}</p>
      )}
      <Aviso>{erro}</Aviso>
    </section>
  );
}
