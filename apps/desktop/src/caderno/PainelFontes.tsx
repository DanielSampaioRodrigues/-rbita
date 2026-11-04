// Aba "Fontes" do painel lateral (algo como o NotebookLM, dentro do Órbita). A pessoa
// junta PDFs, livros, Word, textos e fotos ao caderno; o texto é lido no aparelho. Ao
// perguntar, só os trechos que importam vão para a IA, e a resposta cita de onde veio
// cada coisa: tocar na etiqueta [F2 p.14] mostra a página da fonte e o trecho usado.
import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { api, ErroOrbita, type EstadoIa, type Livro } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { reduzirImagem } from "../fundo";
import { marcarAvisado, precisaAvisar } from "../ia/avisoSensivel";
import { pareceSensivel } from "../ia/sensivel";
import { ChevronLeft, ChevronRight, Copy, FilePlus, FileText, Sparkles, X } from "../icones";
import { textos } from "../textos/pt-BR";
import { htmlDaIa } from "./PainelIa";
import {
  amostrar, apagarTrechos, buscar, citacoesEmBotoes, deBase64, dividir, gravarFontes, gravarTrechos, lerCitacoes, lerFontes, lerTrechos, montarTrechos,
  novoIdFonte, paraBase64, textoDoArquivo, tipoDoArquivo, type Achado, type FonteCaderno, type Trecho,
} from "./fontes";

const t = textos.caderno.fontes;
/** Pedidos que precisam da visão geral (não de uma busca). */
const GERAL = new Set(["resumo", "fichamento", "guia", "glossario", "mapa"]);
const MAXIMO_ARQUIVO = 20 * 1024 * 1024;
const bytesDoAnexo = new Map<string, ArrayBuffer>();
async function lerBytesDoAnexo(id: string): Promise<ArrayBuffer> {
  const c = bytesDoAnexo.get(id);
  if (c) return c;
  const b = deBase64(await api.bytesAnexo(id));
  bytesDoAnexo.set(id, b);
  return b;
}
const textoPuro = (html: string) => { const d = document.createElement("div"); d.innerHTML = html; return (d.innerText || d.textContent || "").trim(); };

interface Resposta { html: string; pedido: string; rotulo: string; acao?: string; achados: Achado[] }
interface Ver { fonte: number; p?: number; cap?: number }

export function PainelFontes({ cadernoId, aoPorEmPaginaNova, aoMapaMental }: {
  cadernoId: string;
  aoPorEmPaginaNova: (html: string) => void;
  aoMapaMental: (html: string) => void;
}) {
  const recado = useRecado();
  const [fontes, setFontes] = useState<FonteCaderno[]>([]);
  const fontesRef = useRef(fontes);
  fontesRef.current = fontes;
  const [estado, setEstado] = useState<EstadoIa | null>(null);
  const [lendo, setLendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pedido, setPedido] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ continuar: () => void } | null>(null);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [colando, setColando] = useState<{ nome: string; texto: string } | null>(null);
  const [livros, setLivros] = useState<Livro[] | null>(null);
  const [tirando, setTirando] = useState<FonteCaderno | null>(null);
  const [ver, setVer] = useState<Ver | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const cartao = useRef<HTMLElement>(null);
  useEffect(() => { void lerFontes(cadernoId).then(setFontes); api.estadoIa().then(setEstado, () => setEstado(null)); }, [cadernoId]);
  useEffect(() => { if (resposta) cartao.current?.scrollIntoView({ block: "nearest" }); }, [resposta]);
  const provedor = estado?.provedores.find((p) => p.id === estado.funcoes.conversa) ?? null;

  const salvarLista = async (lista: FonteCaderno[]) => { setFontes(lista); await gravarFontes(cadernoId, lista); };
  const juntar = async (f: FonteCaderno, trechos: Trecho[]) => {
    const pedacos = await gravarTrechos(f.id, trechos);
    await salvarLista([...fontesRef.current, { ...f, pedacos, caracteres: trechos.reduce((s, x) => s + x.t.length, 0) }]);
  };

  const adicionarArquivos = async (lista: FileList | null) => {
    if (!lista) return;
    setErro(null);
    for (const arq of Array.from(lista)) {
      const tipo = tipoDoArquivo(arq.name, arq.type);
      if (!tipo) { setErro(t.naoSuportado(arq.name)); continue; }
      setLendo(t.lendo(arq.name, 0, 0));
      try {
        const id = novoIdFonte();
        let anexoId: string | undefined;
        if (tipo === "imagem") {
          const u = URL.createObjectURL(arq);
          try {
            const reduzida = await reduzirImagem(u, 2000);
            anexoId = (await api.anexarBytes(cadernoId, arq.name, reduzida.split(",")[1] ?? "")).id;
          } finally { URL.revokeObjectURL(u); }
          await juntar({ id, nome: arq.name, tipo, anexoId, partes: 0, caracteres: 0, ligada: true, semTexto: true, pedacos: 1, criadaEm: Date.now() }, []);
          continue;
        }
        const bytes = await arq.arrayBuffer();
        const r = await textoDoArquivo(tipo, bytes, (feitas, total) => setLendo(t.lendo(arq.name, feitas, total)));
        if (tipo === "pdf" || tipo === "epub") {
          if (bytes.byteLength <= MAXIMO_ARQUIVO) { anexoId = (await api.anexarBytes(cadernoId, arq.name, paraBase64(bytes))).id; bytesDoAnexo.set(anexoId, bytes); }
          else setErro(t.grandeDemais(arq.name));
        }
        await juntar({ id, nome: arq.name.replace(/\.[^.]+$/, ""), tipo, anexoId, partes: r.partes, caracteres: 0, ligada: true, semTexto: r.semTexto, pedacos: 1, criadaEm: Date.now() }, r.trechos);
      } catch {
        setErro(t.erroLer(arq.name));
      }
    }
    setLendo(null);
  };
  const guardarColado = async () => {
    if (!colando || !colando.texto.trim()) return;
    const c = colando;
    setColando(null);
    await juntar({ id: novoIdFonte(), nome: c.nome.trim() || t.colarNomePadrao, tipo: "nota", partes: 0, caracteres: 0, ligada: true, pedacos: 1, criadaEm: Date.now() }, dividir(c.texto));
  };
  const abrirLeitura = async () => {
    try { setLivros((await api.listarLivros()).filter((l) => l.arquivoId && (l.formato === "pdf" || l.formato === "epub"))); } catch (e) { setErro(mensagem(e)); }
  };
  const usarLivro = async (l: Livro) => {
    setLivros(null);
    setLendo(t.lendo(l.titulo, 0, 0));
    try {
      const bytes = await lerBytesDoAnexo(l.arquivoId);
      const tipo = l.formato === "pdf" ? "pdf" : "epub";
      const r = await textoDoArquivo(tipo, bytes, (feitas, total) => setLendo(t.lendo(l.titulo, feitas, total)));
      // O arquivo é o da Leitura (não duplica; tirar a fonte não apaga o livro).
      await juntar({ id: novoIdFonte(), nome: l.autor ? `${l.titulo} (${l.autor})` : l.titulo, tipo, anexoId: l.arquivoId, doLivro: true, partes: r.partes, caracteres: 0, ligada: true, semTexto: r.semTexto, pedacos: 1, criadaEm: Date.now() }, r.trechos);
    } catch {
      setErro(t.erroLer(l.titulo));
    } finally {
      setLendo(null);
    }
  };
  const lerFoto = async (f: FonteCaderno) => {
    if (!f.anexoId || !provedor) return;
    setLendo(t.lendoFoto);
    setErro(null);
    try {
      const url = await api.imagemAnexo(f.anexoId);
      const r = await api.iaCaderno(textos.caderno.ia.pedidos.transcrever, "", [url], false);
      const trechos = dividir(textoPuro(htmlDaIa(r.html)));
      const pedacos = await gravarTrechos(f.id, trechos);
      await salvarLista(fontesRef.current.map((x) => (x.id === f.id ? { ...x, semTexto: !trechos.length, pedacos, caracteres: trechos.reduce((s, y) => s + y.t.length, 0) } : x)));
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setLendo(null);
    }
  };
  const tirar = async (f: FonteCaderno) => {
    setTirando(null);
    await apagarTrechos(f);
    if (f.anexoId && !f.doLivro) await api.excluirAnexo(f.anexoId).catch(() => {});
    await salvarLista(fontesRef.current.filter((x) => x.id !== f.id));
    setResposta(null);
  };

  const perguntar = async (texto: string, rotulo: string, acao?: string, confirmou = false) => {
    if (!provedor || ocupado || !texto.trim()) return;
    const usaveis = fontes.map((f) => f.ligada && !f.semTexto);
    if (!usaveis.some(Boolean)) { setErro(t.semLigada); return; }
    setErro(null);
    setOcupado(true);
    try {
      // A etiqueta F(n) é a posição da fonte na lista (a mesma que aparece aqui).
      const listas = await Promise.all(fontes.map((f, i) => (usaveis[i] ? lerTrechos(f) : Promise.resolve([] as Trecho[]))));
      let achados = acao && GERAL.has(acao) ? amostrar(listas, 90_000) : buscar(listas, texto, 14, 6);
      // A pergunta não bateu com palavra nenhuma: manda uma visão geral menor.
      if (!achados.length) achados = amostrar(listas, 30_000);
      const trechos = montarTrechos(achados, fontes.map((f) => f.nome));
      // Sensível olha o pedido: as fontes são material de estudo (um texto de psicologia
      // fala de terapia sem ser dado de saúde da pessoa).
      const sensivel = pareceSensivel(texto);
      if (!confirmou && (await precisaAvisar(sensivel, provedor, estado?.bloquearSensivel ?? false))) {
        setAviso({ continuar: () => void perguntar(texto, rotulo, acao, true) });
        return;
      }
      if (confirmou) void marcarAvisado(provedor.id);
      const r = await api.iaFontes(texto, trechos, sensivel);
      setResposta({ html: htmlDaIa(r.html), pedido: texto, rotulo, acao, achados });
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  };

  /** A resposta para pôr no caderno: com a lista das fontes citadas no fim. */
  const paraOCaderno = (r: Resposta) => {
    const citadas = [...new Set(lerCitacoes(r.html).map((c) => c.fonte))].filter((i) => fontes[i]).sort((a, b) => a - b);
    if (!citadas.length || r.acao === "mapa") return r.html;
    const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return `${r.html}<h3>Fontes</h3><ul>${citadas.map((i) => `<li>F${i + 1}: ${esc(fontes[i].nome)} (${esc(t.tipo[fontes[i].tipo] ?? "")})</li>`).join("")}</ul>`;
  };
  const aoTocarResposta = (e: React.MouseEvent<HTMLDivElement>) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".fonte-citacao");
    if (!b) return;
    const d = b.dataset;
    setVer({ fonte: Number(d.fonte), p: d.p ? Number(d.p) : undefined, cap: d.cap ? Number(d.cap) : undefined });
  };

  // Sem IA, as fontes ainda podem ser guardadas; só a pergunta precisa da IA.
  return (
    <div className="painel-ia painel-fontes">
      <p className="texto-suave pequeno">{t.explicacao}</p>
      <div className="painel-ia-linha">
        <Button className="botao pequeno com-icone" isDisabled={!!lendo} onPress={() => arquivo.current?.click()}><FilePlus aria-hidden="true" size="1em" /> {t.adicionar}</Button>
        <input ref={arquivo} type="file" multiple hidden accept=".pdf,.epub,.docx,.txt,.md,.markdown,.csv,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*"
          onChange={(e) => { void adicionarArquivos(e.target.files); e.target.value = ""; }} />
        <Button className="botao pequeno" isDisabled={!!lendo} onPress={() => setColando({ nome: "", texto: "" })}>{t.colar}</Button>
        <Button className="botao pequeno" isDisabled={!!lendo} onPress={() => void abrirLeitura()}>{t.daLeitura}</Button>
      </div>
      {lendo && <p role="status" className="texto-suave pequeno">{lendo}</p>}

      {fontes.length === 0 ? <p className="texto-suave pequeno">{t.nenhuma}</p> : (
        <ul className="fontes-lista">
          {fontes.map((f, i) => (
            <li key={f.id} className={f.ligada ? "fonte-item" : "fonte-item desligada"}>
              <label className="fonte-usar">
                <input type="checkbox" checked={f.ligada} aria-label={t.usar(f.nome)}
                  onChange={(e) => void salvarLista(fontes.map((x) => (x.id === f.id ? { ...x, ligada: e.target.checked } : x)))} />
                <span className="fonte-etiqueta" aria-hidden="true">F{i + 1}</span>
              </label>
              <div className="fonte-sobre">
                <span className="fonte-nome">{f.nome}</span>
                <span className="texto-suave pequeno">{[t.tipo[f.tipo], t.partes(f.tipo, f.partes)].filter(Boolean).join(" · ")}</span>
                {f.semTexto && <span className="texto-suave pequeno">{f.tipo === "imagem" ? t.semTextoFoto : f.tipo === "pdf" ? t.semTextoPdf : t.semTextoOutro}</span>}
                {f.semTexto && f.tipo === "imagem" && provedor && <Button className="botao pequeno" isDisabled={!!lendo} onPress={() => void lerFoto(f)}>{t.lerFoto}</Button>}
              </div>
              <Button className="botao-icone" aria-label={t.tirar(f.nome)} onPress={() => setTirando(f)}><X aria-hidden="true" size="0.95em" /></Button>
            </li>
          ))}
        </ul>
      )}

      {!provedor ? (estado && <p className="texto-suave pequeno">{t.semIa}</p>) : fontes.length > 0 && (
        <>
          <p className="texto-suave pequeno">{t.vaiPara(provedor.nome, provedor.local)}</p>
          <div className="painel-ia-acoes" role="group" aria-label={t.perguntar}>
            {Object.keys(t.acoes).map((a) => (
              <Button key={a} className="botao pequeno painel-ia-acao" isDisabled={ocupado} onPress={() => void perguntar(t.pedidos[a], t.acoes[a], a)}>{t.acoes[a]}</Button>
            ))}
          </div>
          <form className="painel-ia-livre" onSubmit={(e) => { e.preventDefault(); void perguntar(pedido, pedido); }}>
            <label className="campo-rotulo" htmlFor="painel-fontes-pedido">{t.perguntar}</label>
            <textarea id="painel-fontes-pedido" className="entrada-texto" rows={3} maxLength={2000} value={pedido} placeholder={t.perguntarExemplo}
              onChange={(e) => setPedido(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void perguntar(pedido, pedido); } }} />
            <div className="painel-ia-linha">
              <Button type="submit" className="botao pequeno principal com-icone" isDisabled={ocupado || !pedido.trim()}><Sparkles aria-hidden="true" size="1em" /> {t.enviar}</Button>
            </div>
          </form>
        </>
      )}

      {ocupado && <p role="status" className="texto-suave">{textos.caderno.ia.pensando(provedor?.nome ?? "")}</p>}
      {aviso && provedor && (
        <div className="painel-ia-aviso">
          <Aviso tipo="info">{textos.ia.sensivelAvisoCaderno(provedor.nome)}</Aviso>
          <div className="painel-ia-linha">
            <Button className="botao pequeno" onPress={() => setAviso(null)}>{textos.comum.cancelar}</Button>
            <Button className="botao pequeno principal" onPress={() => { const a = aviso; setAviso(null); a.continuar(); }}>{textos.caderno.ia.continuar}</Button>
          </div>
        </div>
      )}
      {erro && <Aviso>{erro}</Aviso>}

      {resposta && (
        <section className="painel-ia-resposta" aria-label={t.resposta} ref={cartao}>
          <h3 className="painel-ia-titulo">{t.resposta}: {resposta.rotulo.length > 60 ? `${resposta.rotulo.slice(0, 60)}…` : resposta.rotulo}</h3>
          <div className="painel-ia-previa doc-conteudo" onClick={aoTocarResposta} dangerouslySetInnerHTML={{ __html: citacoesEmBotoes(resposta.html, fontes.length) }} />
          <div className="painel-ia-linha">
            {resposta.acao === "mapa" && <Button className="botao pequeno principal" onPress={() => aoMapaMental(resposta.html)}>{t.desenharMapa}</Button>}
            <Button className={resposta.acao === "mapa" ? "botao pequeno" : "botao pequeno principal"} onPress={() => { aoPorEmPaginaNova(paraOCaderno(resposta)); recado(t.postoNova); }}>{t.porNova}</Button>
            <Button className="botao pequeno com-icone" onPress={() => void navigator.clipboard?.writeText(textoPuro(paraOCaderno(resposta))).then(() => recado(t.copiado), () => undefined)}><Copy aria-hidden="true" size="1em" /> {t.copiar}</Button>
            <Button className="botao pequeno" isDisabled={ocupado} onPress={() => void perguntar(resposta.pedido, resposta.rotulo, resposta.acao)}>{t.deNovo}</Button>
            <Button className="botao pequeno" onPress={() => setResposta(null)}>{t.descartar}</Button>
          </div>
          <p className="texto-suave pequeno">{t.conferir}</p>
        </section>
      )}

      {colando && (
        <Janela titulo={t.colarTitulo} aberta aoFechar={() => setColando(null)}>
          <form onSubmit={(e) => { e.preventDefault(); void guardarColado(); }} className="formulario">
            <Campo rotulo={t.colarNome} valor={colando.nome} aoMudar={(v) => setColando({ ...colando, nome: v })} autoFocus maximo={120} />
            <Campo rotulo={t.colarTexto} valor={colando.texto} aoMudar={(v) => setColando({ ...colando, texto: v })} multilinha maximo={1_000_000} />
            <div className="janela-acoes">
              <Button className="botao" onPress={() => setColando(null)}>{t.cancelar}</Button>
              <Button type="submit" className="botao principal" isDisabled={!colando.texto.trim()}>{t.guardar}</Button>
            </div>
          </form>
        </Janela>
      )}
      {livros && (
        <Janela titulo={t.leituraTitulo} aberta aoFechar={() => setLivros(null)}>
          {livros.length === 0 ? <p className="texto-suave">{t.leituraVazia}</p> : (
            <ul className="fontes-livros">
              {livros.map((l) => (
                <li key={l.id}><Button className="botao com-icone" onPress={() => void usarLivro(l)}><FileText aria-hidden="true" size="1em" /> {l.titulo}{l.autor ? ` (${l.autor})` : ""}</Button></li>
              ))}
            </ul>
          )}
          <div className="janela-acoes"><Button className="botao" onPress={() => setLivros(null)}>{t.fechar}</Button></div>
        </Janela>
      )}
      <Confirmar titulo={t.tirarTitulo} texto={tirando ? t.tirarTexto(tirando.nome) : ""} confirmar={t.tirarSim} aberta={tirando !== null}
        aoCancelar={() => setTirando(null)} aoConfirmar={() => { if (tirando) void tirar(tirando); }} />
      {ver && fontes[ver.fonte] && <VerFonte fonte={fontes[ver.fonte]} n={ver.fonte} alvo={ver} achados={resposta?.achados ?? []} aoFechar={() => setVer(null)} />}
    </div>
  );
}

function mensagem(e: unknown): string {
  return e instanceof ErroOrbita ? e.message : e instanceof Error ? e.message : String(e);
}

/** De onde veio a citação: a página do PDF (ou a foto) e o trecho que a IA usou. */
function VerFonte({ fonte, n, alvo, achados, aoFechar }: { fonte: FonteCaderno; n: number; alvo: Ver; achados: Achado[]; aoFechar: () => void }) {
  const [pagina, setPagina] = useState(alvo.p ?? 1);
  const [total, setTotal] = useState(fonte.partes);
  const [trechos, setTrechos] = useState<Trecho[]>([]);
  const [foto, setFoto] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => { void lerTrechos(fonte).then(setTrechos); }, [fonte]);
  useEffect(() => {
    if (fonte.tipo === "imagem" && fonte.anexoId) void api.imagemAnexo(fonte.anexoId).then(setFoto, () => setFoto(null));
  }, [fonte]);
  useEffect(() => {
    if (fonte.tipo !== "pdf" || !fonte.anexoId) return;
    let vivo = true;
    void (async () => {
      try {
        const { desenharPaginaPdf } = await import("@orbita/leitor");
        const largura = Math.min(560, (caixa.current?.clientWidth || 560));
        const r = await desenharPaginaPdf(await lerBytesDoAnexo(fonte.anexoId!), pagina, largura);
        if (!vivo || !caixa.current) return;
        caixa.current.replaceChildren(r.canvas);
        r.canvas.setAttribute("role", "img");
        r.canvas.setAttribute("aria-label", `${fonte.nome}, ${t.paginaDe(pagina, r.total)}`);
        setTotal(r.total);
      } catch { if (caixa.current) caixa.current.replaceChildren(); }
    })();
    return () => { vivo = false; };
  }, [fonte, pagina]);
  // O trecho usado: o que a IA recebeu daquela página (ou capítulo); senão, o começo dela.
  const daqui = (x: Trecho) => (alvo.cap ? x.cap === alvo.cap : fonte.tipo === "pdf" ? x.p === pagina : true);
  const usados = achados.filter((a) => a.fonte === n && daqui(a.trecho)).map((a) => a.trecho.t);
  const mostrar = usados.length ? usados : trechos.filter(daqui).slice(0, 2).map((x) => x.t);
  const ehPdf = fonte.tipo === "pdf" && !!fonte.anexoId;
  return (
    <Janela titulo={`F${n + 1}: ${fonte.nome}`} aberta aoFechar={aoFechar} larga>
      {mostrar.length > 0 && (
        <section aria-label={t.trecho}>
          <h3 className="painel-ia-titulo">{t.trecho}{alvo.p && fonte.tipo === "pdf" ? ` (p. ${pagina})` : alvo.cap ? ` (cap. ${alvo.cap})` : ""}</h3>
          {mostrar.map((x, i) => <blockquote key={i} className="fonte-ver-trecho">{x}</blockquote>)}
        </section>
      )}
      {foto && <img className="fonte-ver-foto" src={foto} alt={fonte.nome} />}
      {ehPdf && (
        <div className="fonte-ver-pdf">
          <div className="painel-ia-linha">
            <Button className="botao-icone" aria-label={t.anterior} isDisabled={pagina <= 1} onPress={() => setPagina((p) => p - 1)}><ChevronLeft aria-hidden="true" size="1.1em" /></Button>
            <span>{t.paginaDe(pagina, total || 1)}</span>
            <Button className="botao-icone" aria-label={t.proxima} isDisabled={!!total && pagina >= total} onPress={() => setPagina((p) => p + 1)}><ChevronRight aria-hidden="true" size="1.1em" /></Button>
          </div>
          <div ref={caixa} className="fonte-ver-pagina" />
        </div>
      )}
      {!ehPdf && !foto && !fonte.anexoId && fonte.tipo !== "nota" && fonte.tipo !== "word" && fonte.tipo !== "texto" && <p className="texto-suave pequeno">{t.semArquivo}</p>}
      <div className="janela-acoes"><Button className="botao" onPress={aoFechar}>{t.fechar}</Button></div>
    </Janela>
  );
}
