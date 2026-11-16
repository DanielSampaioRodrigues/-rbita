// Aba "IA" do painel lateral do caderno. A pessoa pede o que quiser sobre a página (ou
// o caderno todo): organizar, resumir, passar a escrita à mão para texto, mapa mental,
// ABNT, organizar fotos do quadro... A IA lê o texto digitado e, se a pessoa deixar, a
// imagem da página (escrita à mão e desenhos) e as fotos que ela mandar. A resposta
// aparece como proposta: só vai para o caderno quando a pessoa escolhe onde pôr
// (a IA propõe, a pessoa confirma), e nunca apaga o que já estava.
import DOMPurify from "dompurify";
import { useEffect, useRef, useState } from "react";
import { Button, Checkbox, Dialog, DialogTrigger, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { api, ErroOrbita, type EstadoIa } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso } from "../componentes/Campo";
import { Interruptor } from "../componentes/Interruptor";
import { Segmentado } from "../componentes/Segmentado";
import { reduzirImagem } from "../fundo";
import { modelosDe } from "../ia/AjustesIa";
import { maisNovos } from "../ia/modelos";
import { Janela } from "../componentes/Janela";
import { pareceSensivel } from "../ia/sensivel";
import { ArrowUp, Check, ChevronDown, Copy, Plus, X } from "../icones";
import { textos } from "../textos/pt-BR";
import { guardarNaBiblioteca } from "./biblioteca";
import { gravarFontes, lerFontes, type FonteCaderno } from "./fontes";
import { iaDoCaderno, nomeCurtoModelo, type IaDoCaderno } from "./iaModelo";
import { gravarMinhaLetra, lerMinhaLetra } from "./minhaLetra";
import { EnsinarLetra } from "./EnsinarLetra";

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

/** "hoje, 13:10", "ontem, 9:02" ou "3 de nov.". */
function quandoCurto(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms), hoje = new Date();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dia = (x: Date) => x.toDateString();
  if (dia(d) === dia(hoje)) return `hoje, ${hora}`;
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
  if (dia(d) === dia(ontem)) return `ontem, ${hora}`;
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

/** Uma mensagem da conversa com a IA do caderno. */
type Mensagem =
  | { id: number; papel: "pessoa"; texto: string; fotos: string[] }
  | { id: number; papel: "ia"; tipo: "proposta"; html: string; pedido: string; rotulo: string }
  | { id: number; papel: "ia"; tipo: "feito"; resposta: string; feitas: number }
  | { id: number; papel: "ia"; tipo: "erro"; texto: string };

export function PainelIa({ cadernoId, obterContexto, temDesenho, aoPorNaPagina, aoPorEmPaginaNova, aoCriarImagem, aoMapaMental, aoConferirEscrita, marcasAtivas = 0, aoTirarMarcas, aoAgir, desfazer, aoDesfazer, temFontes = false, quadro = false }: {
  /** Para ler e marcar as fontes do caderno (a escolha das fontes fica na conversa). */
  cadernoId: string;
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
  /** A IA com liberdade total: aplica as mudanças direto no caderno (com cópia antes). */
  aoAgir?: (pedido: string, alcance: Alcance, imagens: string[], sensivel: boolean, usarFontes: boolean) => Promise<{ resposta: string; feitas: number }>;
  /** O caderno tem fontes com texto (aba Fontes). */
  temFontes?: boolean;
  /** No quadro infinito: "Pôr no quadro" (no meio do que está à vista), sem página nova. */
  quadro?: boolean;
  /** A última mudança da IA que dá para desfazer. */
  desfazer?: { resumo: string; quando: number } | null;
  aoDesfazer?: () => void;
}) {
  const recado = useRecado();
  const [estado, setEstado] = useState<EstadoIa | null>(null);
  const [alcance, setAlcance] = useState<Alcance>("pagina");
  const [lerEscrita, setLerEscrita] = useState(true);
  const [fotos, setFotos] = useState<{ nome: string; url: string }[]>([]);
  const [pedido, setPedido] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [conversa, setConversa] = useState<Mensagem[]>([]);
  const [fontes, setFontes] = useState<FonteCaderno[]>([]);
  const [letraAberta, setLetraAberta] = useState<"palavras" | "alfabeto" | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const proximo = useRef(1);
  useEffect(() => { api.estadoIa().then(setEstado, () => setEstado(null)); }, []);
  useEffect(() => { void lerFontes(cadernoId).then(setFontes, () => setFontes([])); }, [cadernoId, temFontes]);
  // A conversa desce sozinha até a última mensagem (sem animação).
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [conversa, ocupado]);
  // A caixa de escrever cresce com o texto (até um limite).
  useEffect(() => {
    const c = campo.current;
    if (!c) return;
    c.style.height = "auto";
    c.style.height = `${Math.min(c.scrollHeight, 200)}px`;
  }, [pedido]);
  const ia = iaDoCaderno(estado);
  const fontesComTexto = fontes.filter((f) => !f.semTexto);
  const fontesLigadas = fontesComTexto.filter((f) => f.ligada);
  const novaId = () => proximo.current++;
  const juntar = (m: Mensagem) => setConversa((c) => [...c, m]);

  const enviar = async (texto: string, rotulo: string) => {
    if (!ia || ocupado || !texto.trim()) return;
    const fotosAgora = fotos.map((f) => f.url);
    juntar({ id: novaId(), papel: "pessoa", texto: rotulo, fotos: fotosAgora });
    setPedido("");
    setFotos([]);
    setOcupado(true);
    try {
      const ctx = await obterContexto(alcance, temDesenho && lerEscrita && alcance === "pagina");
      const imagens = [...ctx.imagens, ...fotosAgora];
      const sensivel = pareceSensivel(`${texto}\n${ctx.texto}`);
      if (aoAgir) {
        const feito = await aoAgir(texto, alcance, imagens, sensivel, fontesLigadas.length > 0);
        juntar({ id: novaId(), papel: "ia", tipo: "feito", ...feito });
        return;
      }
      const r = await api.iaCaderno(texto, ctx.texto, imagens, sensivel);
      juntar({ id: novaId(), papel: "ia", tipo: "proposta", html: htmlDaIa(r.html), pedido: texto, rotulo });
    } catch (e) {
      juntar({ id: novaId(), papel: "ia", tipo: "erro", texto: e instanceof ErroOrbita ? e.message : e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado(false);
    }
  };
  const conferir = async () => {
    if (!ia || ocupado || !aoConferirEscrita) return;
    setOcupado(true);
    try {
      const ctx = await obterContexto("pagina", false);
      await aoConferirEscrita(pareceSensivel(ctx.texto));
    } catch (e) {
      juntar({ id: novaId(), papel: "ia", tipo: "erro", texto: e instanceof ErroOrbita ? e.message : e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado(false);
    }
  };
  const sugestao = (a: Acao) => void enviar(t.pedidos[a as keyof typeof t.pedidos], t.acoes[a]);
  const juntarFotos = async (lista: FileList | null) => {
    if (!lista) return;
    const novas: { nome: string; url: string }[] = [];
    for (const f of Array.from(lista).slice(0, 6 - fotos.length)) {
      const u = URL.createObjectURL(f);
      try { novas.push({ nome: f.name, url: await reduzirImagem(u, 1600) }); } catch { /* não era imagem */ } finally { URL.revokeObjectURL(u); }
    }
    setFotos((x) => [...x, ...novas].slice(0, 6));
  };
  const ligarFonte = async (id: string, ligada: boolean) => {
    const lista = (await lerFontes(cadernoId)).map((f) => (f.id === id ? { ...f, ligada } : f));
    await gravarFontes(cadernoId, lista);
    setFontes(lista);
  };
  const ligarTodas = async (ligada: boolean) => {
    const lista = (await lerFontes(cadernoId)).map((f) => (f.semTexto ? f : { ...f, ligada }));
    await gravarFontes(cadernoId, lista);
    setFontes(lista);
  };
  const escolherModelo = async (provedorId: string | null, modelo: string | null) => {
    try { setEstado(await api.definirFuncaoIa("caderno", provedorId, modelo)); } catch (e) { recado(e instanceof Error ? e.message : String(e)); }
  };

  if (estado && !ia) {
    return <div className="ia-chat"><p className="texto-suave ia-chat-vazio-texto">{t.semProvedor}</p></div>;
  }
  const sugestoes = (Object.keys(t.pedidos) as Acao[]);
  return (
    <div className="ia-chat">
      <div className="ia-chat-mensagens" aria-live="polite">
        {desfazer && aoDesfazer && (
          <div className="ia-chat-desfazer">
            <span className="texto-suave pequeno">{t.ultima(desfazer.resumo, quandoCurto(desfazer.quando))}</span>
            <Button className="botao pequeno" onPress={aoDesfazer}>{t.desfazerTudo}</Button>
          </div>
        )}
        {marcasAtivas > 0 && aoTirarMarcas && (
          <div className="ia-chat-desfazer">
            <span className="texto-suave pequeno">{textos.caderno.correcao.marcas(marcasAtivas)}</span>
            <Button className="botao pequeno" onPress={aoTirarMarcas}>{textos.caderno.correcao.tirarMarcas}</Button>
          </div>
        )}
        {conversa.length === 0 && !ocupado && (
          <div className="ia-chat-vazio">
            <p className="ia-chat-saudacao">{alcance === "pagina" ? t.saudacaoPagina : t.saudacaoCaderno}</p>
            <div className="ia-chat-sugestoes" role="group" aria-label={t.acoesTitulo}>
              {sugestoes.map((a) => <Button key={a} className="ia-chat-sugestao" onPress={() => sugestao(a)}>{t.acoes[a]}</Button>)}
            </div>
            {aoAgir && <p className="texto-suave pequeno">{t.liberdade}</p>}
          </div>
        )}
        {conversa.map((m) => {
          if (m.papel === "pessoa") {
            return (
              <div key={m.id} className="ia-chat-pessoa">
                {m.fotos.length > 0 && <div className="ia-chat-fotos-enviadas">{m.fotos.map((u, i) => <img key={i} src={u} alt="" />)}</div>}
                <p>{m.texto}</p>
              </div>
            );
          }
          if (m.tipo === "erro") return <div key={m.id} className="ia-chat-ia"><Aviso>{m.texto}</Aviso></div>;
          if (m.tipo === "feito") {
            return (
              <div key={m.id} className="ia-chat-ia" role="status">
                {m.resposta && <p>{m.resposta}</p>}
                <p className="texto-suave pequeno">{t.mudancas(m.feitas)}</p>
              </div>
            );
          }
          const ehMapa = /^\s*<ul>\s*<li>[\s\S]*<ul>/i.test(m.html);
          return (
            <div key={m.id} className="ia-chat-ia">
              <div className="ia-chat-previa doc-conteudo" dangerouslySetInnerHTML={{ __html: m.html }} />
              <div className="ia-chat-acoes">
                {ehMapa && aoMapaMental && <Button className="botao pequeno principal" onPress={() => aoMapaMental(m.html)}>{t.desenharMapa}</Button>}
                {quadro ? (
                  <Button className={ehMapa ? "botao pequeno" : "botao pequeno principal"} onPress={() => { aoPorNaPagina(m.html); recado(t.postoQuadro); }}>{t.porQuadro}</Button>
                ) : (<>
                  <Button className={ehMapa ? "botao pequeno" : "botao pequeno principal"} onPress={() => { aoPorEmPaginaNova(m.html); recado(t.postoNova); }}>{t.porNova}</Button>
                  <Button className="botao pequeno" onPress={() => { aoPorNaPagina(m.html); recado(t.postoAqui); }}>{t.porAqui}</Button>
                </>)}
                <Button className="botao-icone pequeno" aria-label={t.copiar} onPress={() => {
                  const tmp = document.createElement("div"); tmp.innerHTML = m.html;
                  void navigator.clipboard?.writeText(tmp.innerText).then(() => recado(t.copiado), () => undefined);
                }}><Copy aria-hidden="true" size="1em" /></Button>
                <Button className="botao pequeno" onPress={() => void guardarNaBiblioteca(m.rotulo.slice(0, 60), "trecho", { html: m.html }).then(() => recado(textos.caderno.biblioteca.guardado), (e) => recado(textos.caderno.biblioteca.erro(e instanceof Error ? e.message : String(e))))}>{textos.caderno.biblioteca.guardarIa}</Button>
                <Button className="botao pequeno" isDisabled={ocupado} onPress={() => void enviar(m.pedido, m.rotulo)}>{t.deNovo}</Button>
              </div>
            </div>
          );
        })}
        {ocupado && <p role="status" className="ia-chat-pensando texto-suave">{t.pensando(ia?.provedor.nome ?? "")}</p>}
        <div ref={fim} />
      </div>

      <form className="ia-chat-caixa" onSubmit={(e) => { e.preventDefault(); void enviar(pedido, pedido); }}>
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
        <textarea ref={campo} className="ia-chat-campo" rows={1} maxLength={2000} value={pedido} placeholder={t.escreva} aria-label={t.livre}
          onChange={(e) => setPedido(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviar(pedido, pedido); } }} />
        <div className="ia-chat-ferramentas">
          <MenuTrigger>
            <Button className="ia-chat-chip redondo" aria-label={t.mais}><Plus aria-hidden="true" size="1.05em" /></Button>
            <Popover className="menu-popover" placement="top start">
              <Menu className="menu-lista" aria-label={t.mais} onAction={(k) => {
                if (k === "foto") arquivo.current?.click();
                else if (k === "imagem") aoCriarImagem();
                else if (k === "conferir") void conferir();
                else if (k === "palavras") setLetraAberta("palavras");
                else if (k === "alfabeto") setLetraAberta("alfabeto");
              }}>
                <MenuItem id="foto" className="menu-item" isDisabled={fotos.length >= 6}>{t.anexarFoto}</MenuItem>
                <MenuItem id="imagem" className="menu-item">{t.acoes.imagem}</MenuItem>
                {aoConferirEscrita && temDesenho && <MenuItem id="conferir" className="menu-item">{t.acoes.conferir}</MenuItem>}
                {aoConferirEscrita && <MenuItem id="palavras" className="menu-item">{textos.caderno.correcao.minhaLetra(0)}</MenuItem>}
                {aoConferirEscrita && <MenuItem id="alfabeto" className="menu-item">{textos.caderno.correcao.ensinarLetraCurto}</MenuItem>}
              </Menu>
            </Popover>
          </MenuTrigger>
          <input ref={arquivo} type="file" accept="image/*" multiple hidden onChange={(e) => { void juntarFotos(e.target.files); e.target.value = ""; }} />

          <DialogTrigger>
            <Button className="ia-chat-chip">{alcance === "pagina" ? t.pagina : t.caderno}<ChevronDown aria-hidden="true" size="0.85em" /></Button>
            <Popover className="menu-popover ia-chat-pop" placement="top start">
              <Dialog className="ia-chat-dialogo" aria-label={t.alcance}>
                <Segmentado rotulo={t.alcance} valor={alcance} aoMudar={(v) => setAlcance(v as Alcance)} opcoes={[{ valor: "pagina", nome: t.pagina }, { valor: "caderno", nome: t.caderno }]} />
                {temDesenho && alcance === "pagina" && <Interruptor rotulo={t.lerEscrita} ligado={lerEscrita} aoMudar={setLerEscrita} compacto />}
              </Dialog>
            </Popover>
          </DialogTrigger>

          {aoAgir && fontesComTexto.length > 0 && (
            <DialogTrigger>
              <Button className={fontesLigadas.length ? "ia-chat-chip ligado" : "ia-chat-chip"}>{t.fontesChip(fontesLigadas.length, fontesComTexto.length)}<ChevronDown aria-hidden="true" size="0.85em" /></Button>
              <Popover className="menu-popover ia-chat-pop" placement="top start">
                <Dialog className="ia-chat-dialogo" aria-label={t.fontesTitulo}>
                  <p className="campo-rotulo">{t.fontesTitulo}</p>
                  <p className="texto-suave pequeno">{t.fontesAjuda}</p>
                  <div className="ia-chat-fontes">
                    {fontesComTexto.map((f) => (
                      <Checkbox key={f.id} className="ia-chat-fonte" isSelected={f.ligada} onChange={(v) => void ligarFonte(f.id, v)}>
                        <span className="ia-chat-marca" aria-hidden="true"><Check size="0.8em" /></span>
                        <span className="ia-chat-fonte-nome">{f.nome}</span>
                      </Checkbox>
                    ))}
                  </div>
                  <div className="painel-ia-linha">
                    <Button className="botao pequeno" onPress={() => void ligarTodas(true)}>{t.todasFontes}</Button>
                    <Button className="botao pequeno" onPress={() => void ligarTodas(false)}>{t.nenhumaFonte}</Button>
                  </div>
                </Dialog>
              </Popover>
            </DialogTrigger>
          )}

          <span className="ia-chat-direita">
            {estado && ia && <EscolherModelo estado={estado} atual={ia} aoEscolher={escolherModelo} />}
            <Button type="submit" className="ia-chat-enviar" isDisabled={ocupado || !pedido.trim()} aria-label={t.pedir}><ArrowUp aria-hidden="true" size="1.1em" /></Button>
          </span>
        </div>
      </form>

      <Janela titulo={textos.caderno.correcao.minhaLetra(0)} aberta={letraAberta === "palavras"} aoFechar={() => setLetraAberta(null)} pequena>
        {letraAberta === "palavras" && <MinhaLetra />}
      </Janela>
      <EnsinarLetra aberta={letraAberta === "alfabeto"} aoFechar={() => setLetraAberta(null)} />
    </div>
  );
}

/** Botão do modelo (como no Claude): mostra qual IA responde e deixa trocar. */
function EscolherModelo({ estado, atual, aoEscolher }: { estado: EstadoIa; atual: IaDoCaderno; aoEscolher: (provedorId: string | null, modelo: string | null) => Promise<void> }) {
  const [listas, setListas] = useState<Record<string, string[] | "erro" | undefined>>({});
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    for (const p of estado.provedores) {
      if (listas[p.id]) continue;
      modelosDe(p).then((l) => setListas((x) => ({ ...x, [p.id]: l })), () => setListas((x) => ({ ...x, [p.id]: "erro" })));
    }
  }, [aberto, estado.provedores, listas]);
  return (
    <DialogTrigger isOpen={aberto} onOpenChange={setAberto}>
      <Button className="ia-chat-chip modelo" aria-label={t.modeloAtual(atual.provedor.nome, atual.modelo)}>
        <span className="ia-chat-modelo-nome">{nomeCurtoModelo(atual.modelo)}</span><ChevronDown aria-hidden="true" size="0.85em" />
      </Button>
      <Popover className="menu-popover ia-chat-pop" placement="top end">
        <Dialog className="ia-chat-dialogo ia-chat-modelos" aria-label={t.modeloTitulo}>
          <p className="campo-rotulo">{t.modeloTitulo}</p>
          <button type="button" className={!atual.propria ? "ia-chat-modelo atual" : "ia-chat-modelo"} onClick={() => void aoEscolher(null, null).then(() => setAberto(false))}>
            <span>{t.igualConversa}</span>{!atual.propria && <Check aria-hidden="true" size="0.9em" />}
          </button>
          {estado.provedores.map((p) => {
            const l = listas[p.id];
            const todos = Array.isArray(l) ? (p.local ? l : maisNovos(l, [p.modelo])) : [];
            const modelos = [...new Set([p.modelo, ...todos])];
            return (
              <div key={p.id} className="ia-chat-provedor">
                <p className="ia-chat-provedor-nome">{p.nome}{p.local && <span className="texto-suave pequeno"> · {t.noAparelho}</span>}</p>
                {modelos.map((m) => {
                  const esse = atual.propria && atual.provedor.id === p.id && atual.modelo === m;
                  return (
                    <button key={m} type="button" className={esse ? "ia-chat-modelo atual" : "ia-chat-modelo"} onClick={() => void aoEscolher(p.id, m === p.modelo ? null : m).then(() => setAberto(false))}>
                      <span>{m}</span>{esse && <Check aria-hidden="true" size="0.9em" />}
                    </button>
                  );
                })}
                {l === undefined && <p className="texto-suave pequeno">{textos.ia.carregandoModelos}</p>}
              </div>
            );
          })}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

/** A lista "minha letra" do corretor: ver, acrescentar e tirar palavras. */
function MinhaLetra() {
  const tc = textos.caderno.correcao;
  const recado = useRecado();
  const [lista, setLista] = useState<string[] | null>(null);
  const [texto, setTexto] = useState("");
  const carregar = () => void lerMinhaLetra().then((l) => { setLista(l); setTexto(l.join("\n")); }, () => setLista([]));
  useEffect(carregar, []);
  const guardar = async () => {
    // Junta com o que foi ensinado enquanto a caixa estava aberta ("Está certa: lembrar"), sem perder nada
    // (o que a pessoa tirou da caixa e que já estava antes sai mesmo).
    const antes = new Set(lista ?? []);
    const novasDeFora = (await lerMinhaLetra()).filter((p) => !antes.has(p));
    const l = await gravarMinhaLetra([texto, ...novasDeFora]);
    setLista(l); setTexto(l.join("\n"));
    recado(tc.minhaLetraSalva);
  };
  return (
    <div className="painel-ia-letra">
      <label className="campo-rotulo" htmlFor="painel-ia-letra">{tc.minhaLetraCampo}</label>
      <textarea id="painel-ia-letra" className="entrada-texto sozinha" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <p className="campo-ajuda">{tc.minhaLetraAjuda}</p>
      <Button className="botao pequeno" onPress={() => void guardar()}>{tc.minhaLetraSalvar}</Button>
    </div>
  );
}
