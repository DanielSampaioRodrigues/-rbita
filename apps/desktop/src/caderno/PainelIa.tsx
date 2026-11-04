// Aba "IA" do painel lateral do caderno. A pessoa pede o que quiser sobre a página (ou
// o caderno todo): organizar, resumir, passar a escrita à mão para texto, mapa mental,
// ABNT, organizar fotos do quadro... A IA lê o texto digitado e, se a pessoa deixar, a
// imagem da página (escrita à mão e desenhos) e as fotos que ela mandar. A resposta
// aparece como proposta: só vai para o caderno quando a pessoa escolhe onde pôr
// (a IA propõe, a pessoa confirma), e nunca apaga o que já estava.
import DOMPurify from "dompurify";
import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { api, ErroOrbita, type EstadoIa, type RespostaIaCaderno } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso } from "../componentes/Campo";
import { Interruptor } from "../componentes/Interruptor";
import { Segmentado } from "../componentes/Segmentado";
import { reduzirImagem } from "../fundo";
import { marcarAvisado, precisaAvisar } from "../ia/avisoSensivel";
import { pareceSensivel } from "../ia/sensivel";
import { Copy, ImagePlus, Sparkles, X } from "../icones";
import { textos } from "../textos/pt-BR";
import { guardarNaBiblioteca } from "./biblioteca";

const t = textos.caderno.ia;

/** Só as marcas de texto que a IA pode devolver (nada de script, estilo ou imagem). */
export const htmlDaIa = (html: string) =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["h1", "h2", "h3", "p", "ul", "ol", "li", "strong", "em", "b", "i", "u", "s", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "hr", "br"],
    ALLOWED_ATTR: [],
  });

export type Alcance = "pagina" | "caderno";
export interface ContextoIa { texto: string; imagens: string[] }
type Acao = keyof typeof t.acoes;

export function PainelIa({ obterContexto, temDesenho, aoPorNaPagina, aoPorEmPaginaNova, aoCriarImagem, aoMapaMental, aoConferirEscrita, marcasAtivas = 0, aoTirarMarcas }: {
  /** Junta o texto (e, se pedir, a imagem da página) do alcance escolhido. */
  obterContexto: (alcance: Alcance, comImagem: boolean) => Promise<ContextoIa>;
  /** A página atual tem escrita à mão, desenho ou imagem? */
  temDesenho: boolean;
  aoPorNaPagina: (html: string) => void;
  aoPorEmPaginaNova: (html: string) => void;
  aoCriarImagem: () => void;
  /** Desenha uma lista aninhada como mapa mental numa página nova. */
  aoMapaMental?: (html: string) => void;
  /** Corretor da escrita à mão (sublinha as palavras erradas na página). */
  aoConferirEscrita?: (sensivel: boolean) => Promise<void>;
  /** Quantas palavras estão sublinhadas agora na página. */
  marcasAtivas?: number;
  aoTirarMarcas?: () => void;
}) {
  const recado = useRecado();
  const [estado, setEstado] = useState<EstadoIa | null>(null);
  const [alcance, setAlcance] = useState<Alcance>("pagina");
  const [lerEscrita, setLerEscrita] = useState(true);
  const [fotos, setFotos] = useState<{ nome: string; url: string }[]>([]);
  const [pedido, setPedido] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ continuar: () => void } | null>(null);
  const [resposta, setResposta] = useState<(RespostaIaCaderno & { pedido: string; rotulo: string }) | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  useEffect(() => { api.estadoIa().then(setEstado, () => setEstado(null)); }, []);
  const provedor = estado?.provedores.find((p) => p.id === estado.funcoes.conversa) ?? null;
  const vaiImagem = (temDesenho && lerEscrita && alcance === "pagina") || fotos.length > 0;

  const enviar = async (texto: string, rotulo: string, confirmou = false) => {
    if (!provedor || ocupado || !texto.trim()) return;
    setErro(null);
    setOcupado(true);
    try {
      const ctx = await obterContexto(alcance, temDesenho && lerEscrita && alcance === "pagina");
      const imagens = [...ctx.imagens, ...fotos.map((f) => f.url)];
      const sensivel = pareceSensivel(`${texto}\n${ctx.texto}`);
      if (!confirmou && (await precisaAvisar(sensivel, provedor, estado?.bloquearSensivel ?? false))) {
        setAviso({ continuar: () => void enviar(texto, rotulo, true) });
        return;
      }
      if (confirmou) void marcarAvisado(provedor.id);
      const r = await api.iaCaderno(texto, ctx.texto, imagens, sensivel);
      setResposta({ ...r, html: htmlDaIa(r.html), pedido: texto, rotulo });
    } catch (e) {
      setErro(e instanceof ErroOrbita ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };
  const conferir = async (confirmou = false) => {
    if (!provedor || ocupado || !aoConferirEscrita) return;
    setErro(null);
    setOcupado(true);
    try {
      const ctx = await obterContexto("pagina", false);
      const sensivel = pareceSensivel(ctx.texto);
      if (!confirmou && (await precisaAvisar(sensivel, provedor, estado?.bloquearSensivel ?? false))) {
        setAviso({ continuar: () => void conferir(true) });
        return;
      }
      if (confirmou) void marcarAvisado(provedor.id);
      await aoConferirEscrita(sensivel);
    } catch (e) {
      setErro(e instanceof ErroOrbita ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };
  const acao = (a: Acao) => {
    if (a === "imagem") { aoCriarImagem(); return; }
    if (a === "conferir") { void conferir(); return; }
    void enviar(t.pedidos[a], t.acoes[a]);
  };
  const juntarFotos = async (lista: FileList | null) => {
    if (!lista) return;
    const novas: { nome: string; url: string }[] = [];
    for (const f of Array.from(lista).slice(0, 6 - fotos.length)) {
      const u = URL.createObjectURL(f);
      try { novas.push({ nome: f.name, url: await reduzirImagem(u, 1600) }); } catch { /* não era imagem */ } finally { URL.revokeObjectURL(u); }
    }
    setFotos((x) => [...x, ...novas].slice(0, 6));
  };
  const ehMapa = !!resposta && /^\s*<ul>\s*<li>[\s\S]*<ul>/i.test(resposta.html);

  if (estado && !provedor) {
    return <div className="painel-ia"><p className="texto-suave">{t.semProvedor}</p></div>;
  }
  return (
    <div className="painel-ia">
      <Segmentado rotulo={t.alcance} valor={alcance} aoMudar={(v) => setAlcance(v as Alcance)} opcoes={[{ valor: "pagina", nome: t.pagina }, { valor: "caderno", nome: t.caderno }]} />
      {temDesenho && alcance === "pagina" && <Interruptor rotulo={t.lerEscrita} ligado={lerEscrita} aoMudar={setLerEscrita} compacto />}
      {provedor && <p className="texto-suave pequeno">{provedor.local ? t.local : t.vaiPara(provedor.nome, vaiImagem)}</p>}

      <div className="painel-ia-acoes" role="group" aria-label={t.acoesTitulo}>
        {(Object.keys(t.acoes) as Acao[]).filter((a) => a !== "conferir" || (aoConferirEscrita && temDesenho)).map((a) => (
          <Button key={a} className="botao pequeno painel-ia-acao" isDisabled={ocupado} onPress={() => acao(a)}>{t.acoes[a]}</Button>
        ))}
      </div>

      <form className="painel-ia-livre" onSubmit={(e) => { e.preventDefault(); void enviar(pedido, pedido); }}>
        <label className="campo-rotulo" htmlFor="painel-ia-pedido">{t.livre}</label>
        <textarea id="painel-ia-pedido" className="entrada-texto" rows={3} maxLength={2000} value={pedido} placeholder={t.livreExemplo}
          onChange={(e) => setPedido(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void enviar(pedido, pedido); } }} />
        <div className="painel-ia-linha">
          <Button className="botao pequeno com-icone" onPress={() => arquivo.current?.click()} isDisabled={fotos.length >= 6}><ImagePlus aria-hidden="true" size="1em" /> {t.fotos}</Button>
          <input ref={arquivo} type="file" accept="image/*" multiple hidden onChange={(e) => { void juntarFotos(e.target.files); e.target.value = ""; }} />
          <Button type="submit" className="botao pequeno principal com-icone" isDisabled={ocupado || !pedido.trim()}><Sparkles aria-hidden="true" size="1em" /> {t.pedir}</Button>
        </div>
        {fotos.length > 0 && (
          <ul className="painel-ia-fotos" aria-label={t.fotosLista}>
            {fotos.map((f, i) => (
              <li key={i}>
                <img src={f.url} alt={f.nome} />
                <Button className="botao-icone" aria-label={t.tirarFoto(f.nome)} onPress={() => setFotos((x) => x.filter((_, j) => j !== i))}><X aria-hidden="true" size="0.9em" /></Button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {ocupado && <p role="status" className="texto-suave">{t.pensando(provedor?.nome ?? "")}</p>}
      {aviso && provedor && (
        <div className="painel-ia-aviso">
          <Aviso tipo="info">{textos.ia.sensivelAvisoCaderno(provedor.nome)}</Aviso>
          <div className="painel-ia-linha">
            <Button className="botao pequeno" onPress={() => setAviso(null)}>{textos.comum.cancelar}</Button>
            <Button className="botao pequeno principal" onPress={() => { const a = aviso; setAviso(null); a.continuar(); }}>{t.continuar}</Button>
          </div>
        </div>
      )}
      {erro && <Aviso>{erro}</Aviso>}
      {marcasAtivas > 0 && aoTirarMarcas && (
        <div className="painel-ia-linha">
          <span className="texto-suave pequeno">{textos.caderno.correcao.marcas(marcasAtivas)}</span>
          <Button className="botao pequeno" onPress={aoTirarMarcas}>{textos.caderno.correcao.tirarMarcas}</Button>
        </div>
      )}

      {resposta && (
        <section className="painel-ia-resposta" aria-label={t.proposta}>
          <h3 className="painel-ia-titulo">{t.proposta}: {resposta.rotulo.length > 60 ? `${resposta.rotulo.slice(0, 60)}…` : resposta.rotulo}</h3>
          <div className="painel-ia-previa doc-conteudo" dangerouslySetInnerHTML={{ __html: resposta.html }} />
          <div className="painel-ia-linha">
            {ehMapa && aoMapaMental && <Button className="botao pequeno principal" onPress={() => aoMapaMental(resposta.html)}>{t.desenharMapa}</Button>}
            <Button className={ehMapa ? "botao pequeno" : "botao pequeno principal"} onPress={() => { aoPorEmPaginaNova(resposta.html); recado(t.postoNova); }}>{t.porNova}</Button>
            <Button className="botao pequeno" onPress={() => { aoPorNaPagina(resposta.html); recado(t.postoAqui); }}>{t.porAqui}</Button>
            <Button className="botao pequeno com-icone" onPress={() => {
              const tmp = document.createElement("div"); tmp.innerHTML = resposta.html;
              void navigator.clipboard?.writeText(tmp.innerText).then(() => recado(t.copiado), () => undefined);
            }}><Copy aria-hidden="true" size="1em" /> {t.copiar}</Button>
            <Button className="botao pequeno" onPress={() => void guardarNaBiblioteca(resposta.rotulo.slice(0, 60), "trecho", { html: resposta.html }).then(() => recado(textos.caderno.biblioteca.guardado), (e) => recado(textos.caderno.biblioteca.erro(e instanceof Error ? e.message : String(e))))}>{textos.caderno.biblioteca.guardarIa}</Button>
            <Button className="botao pequeno" isDisabled={ocupado} onPress={() => void enviar(resposta.pedido, resposta.rotulo)}>{t.deNovo}</Button>
            <Button className="botao pequeno" onPress={() => setResposta(null)}>{t.descartar}</Button>
          </div>
          <p className="texto-suave pequeno">{t.conferir}</p>
        </section>
      )}
    </div>
  );
}
