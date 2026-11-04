// A barra do editor de texto, no estilo do Word e do Pages: abas Início, Inserir,
// Página (só no documento de texto) e Revisar. Cada botão tem nome escrito para o
// leitor de tela e dica ao passar o mouse; tocar não tira o cursor do texto.
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { reduzirImagem } from "../../fundo";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, ChevronDown, Highlighter, ImagePlus, Italic, Link2, List, ListChecks, ListOrdered,
  Minus, Plus, Quote, Redo2, Search, Strikethrough, Table, Underline, Undo2, X,
} from "../../icones";
import { textos } from "../../textos/pt-BR";
import { ESPACOS_LETRAS, lerEspaco, nomeDoEspaco } from "./espacoLetras";
import { CONJUNTOS, lerPt, MARGENS, ocorrencias, type ConfigDocumento, type ConjuntoEstilo, type EstiloParagrafo } from "./estilos";
import { aplicarCaixa, type Caixa } from "./maiusculas";
import { JanelaEstilo, JanelaMeusEstilos } from "./JanelaEstilos";
import { JanelaReferencia } from "./JanelaReferencia";
import { aplicarEstiloLetra, aplicarMeuEstilo, ESTILO_VAZIO, estiloDaSelecao, estiloDoParagrafo, salvarEstilo, tirarEstiloLetra, useMeusEstilos, type EstiloProprio } from "./meusEstilos";
import { SeletorFonte } from "./SeletorFonte";
import { ligarMenuFlutuante, useMenuFlutuante, useMenuFlutuanteLigado } from "./menuFlutuante";

const t = textos.caderno.editor;

const TAMANHOS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];
const CORES_TEXTO = ["#1f2937", "#6b7280", "#991b1b", "#dc2626", "#c2410c", "#ca8a04", "#15803d", "#0f766e", "#0e7490", "#1d4ed8", "#4338ca", "#7e22ce", "#be185d", "#ffffff"];
const CORES_MARCA = ["#fef08a", "#fde68a", "#bbf7d0", "#a7f3d0", "#bae6fd", "#c7d2fe", "#fbcfe8", "#fed7aa", "#e9d5ff", "#e5e7eb"];
const ENTRELINHAS = ["1", "1.15", "1.5", "2", "2.5", "3"];
type Aba = "inicio" | "inserir" | "pagina" | "revisar";

/** Botão pequeno da barra (ícone com nome). */
function B({ rotulo, icone: Icone, ativo, desligado, acao, texto }: { rotulo: string; icone?: React.ComponentType<{ size?: string; "aria-hidden"?: "true" }>; ativo?: boolean; desligado?: boolean; acao: () => void; texto?: string }) {
  return (
    <button type="button" className={ativo ? "fita-botao ativo" : "fita-botao"} aria-label={rotulo} title={rotulo} aria-pressed={ativo ?? undefined} disabled={desligado} onClick={acao}>
      {Icone ? <Icone size="1.05em" aria-hidden="true" /> : <span className="fita-botao-texto" aria-hidden="true">{texto}</span>}
    </button>
  );
}

/** Grade de cores num menu (cor do texto, marca-texto). */
function MenuCores({ rotulo, icone: Icone, cores, atual, semNome, aoEscolher, aoTirar }: { rotulo: string; icone: React.ComponentType<{ size?: string; "aria-hidden"?: "true" }>; cores: string[]; atual?: string; semNome: string; aoEscolher: (c: string) => void; aoTirar: () => void }) {
  return (
    <MenuTrigger>
      <Button className="fita-botao" aria-label={rotulo}>
        <Icone size="1.05em" aria-hidden="true" />
        <span className="fita-cor-traco" style={{ background: atual || "currentColor" }} aria-hidden="true" />
      </Button>
      <Popover className="caderno-popover" placement="bottom">
        <Menu className="fita-cores" aria-label={rotulo} onAction={(k) => (k === "tirar" ? aoTirar() : aoEscolher(String(k)))}>
          <MenuItem id="tirar" className="fita-cor padrao" aria-label={semNome}>×</MenuItem>
          {cores.map((c) => <MenuItem key={c} id={c} className="fita-cor" aria-label={c} style={{ background: c }} />)}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

export { lerPt } from "./estilos";

/** Espaço entre letras do trecho (Normal, condensado ou expandido, em pt). */
export function SeletorEspaco({ valor, aoMudar }: { valor: number; aoMudar: (pt: number) => void }) {
  const opcoes = ESPACOS_LETRAS.includes(valor) || valor === 0 ? ESPACOS_LETRAS : [...ESPACOS_LETRAS, valor].sort((a, b) => a - b);
  return (
    <select className="fita-select curto" aria-label={textos.caderno.editor.espacoLetras} title={textos.caderno.editor.espacoLetras} value={String(valor)} onChange={(ev) => aoMudar(Number(ev.target.value))}>
      <option value="0">{textos.caderno.editor.espacoNormal}</option>
      {opcoes.filter((n) => n !== 0).map((n) => <option key={n} value={String(n)}>{nomeDoEspaco(n)}</option>)}
    </select>
  );
}

export function FitaTexto({ editor, compacta, config, aoConfig, tamanhoCss = (n) => `${n}pt`, extra }: {
  editor: Editor;
  /** Dentro do caderno (barra de contexto): sem a aba Página. */
  compacta?: boolean;
  /** Documento de texto: tamanho, margens, cabeçalho e rodapé. */
  config?: ConfigDocumento;
  aoConfig?: (c: ConfigDocumento) => void;
  /** Como escrever o tamanho da letra (a caixa do caderno acompanha o zoom da página). */
  tamanhoCss?: (pt: number) => string;
  /** Botões a mais no fim da aba Início (ditado, fundo da nota, apagar, pronto...). */
  extra?: React.ReactNode;
}) {
  const [aba, setAba] = useState<Aba>("inicio");
  const [link, setLink] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [troca, setTroca] = useState("");
  const [achados, setAchados] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const e = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const estilo: EstiloParagrafo = ed.isActive("heading", { level: 1 }) ? (ed.getAttributes("heading").estilo === "titulo" ? "titulo" : "h1")
        : ed.isActive("heading", { level: 2 }) ? "h2" : ed.isActive("heading", { level: 3 }) ? "h3" : ed.isActive("blockquote") ? "citacao"
        : (["subtitulo", "legenda", "destaque"].includes(ed.getAttributes("paragraph").estilo) ? ed.getAttributes("paragraph").estilo : "p");
      const ts = ed.getAttributes("textStyle");
      const bloco = ed.isActive("heading") ? ed.getAttributes("heading") : ed.getAttributes("paragraph");
      // Contagem pelo texto do documento (a mesma regra do Word: palavras separadas por espaço).
      const texto = ed.state.doc.textBetween(0, ed.state.doc.content.size, " ", " ");
      const palavras = (texto.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
      return {
        estilo, b: ed.isActive("bold"), i: ed.isActive("italic"), u: ed.isActive("underline"), s: ed.isActive("strike"),
        sobre: ed.isActive("superscript"), sub: ed.isActive("subscript"), versalete: ed.isActive("versalete"),
        lista: ed.isActive("bulletList"), numerada: ed.isActive("orderedList"), tarefas: ed.isActive("taskList"),
        alinhar: (["left", "center", "right", "justify"] as const).find((a) => ed.isActive({ textAlign: a })) ?? "left",
        fonte: (ts.fontFamily as string | undefined) ?? "", tamanho: (ts.fontSize as string | undefined) ?? "", cor: (ts.color as string | undefined) ?? "",
        espaco: lerEspaco(ts.letterSpacing),
        marca: (ed.getAttributes("highlight").color as string | undefined) ?? "",
        entrelinha: (bloco.entrelinha as string | null) ?? "", recuo: (bloco.recuo as number) ?? 0,
        meuEstilo: (bloco.meuEstilo as string | null) ?? "", capitular: (bloco.capitular as number | null) ?? 0,
        letra: (ed.getAttributes("estiloLetra").id as string | null) ?? "",
        tabela: ed.isActive("table"), linkAtivo: ed.isActive("link"),
        desfazer: ed.can().undo(), refazer: ed.can().redo(),
        palavras, caracteres: texto.replace(/\s+/g, " ").trim().length,
      };
    },
  });
  const c = () => editor.chain().focus();
  // Tocar nos botões não tira o cursor do texto (os campos e as listas, sim).
  const segurar = (ev: React.PointerEvent | React.MouseEvent) => {
    if (!(ev.target as HTMLElement).closest("select, input, [role='tab']")) ev.preventDefault();
  };
  const paragrafo = (attrs: Record<string, unknown>) => c().updateAttributes("paragraph", attrs).updateAttributes("heading", attrs).run();
  const aplicarEstilo = (v: EstiloParagrafo) => {
    const ch = c();
    if (v === "p") ch.setParagraph().updateAttributes("paragraph", { estilo: null });
    else if (v === "titulo") ch.setHeading({ level: 1 }).updateAttributes("heading", { estilo: "titulo" });
    else if (v === "h1" || v === "h2" || v === "h3") ch.setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).updateAttributes("heading", { estilo: null });
    else if (v === "citacao") ch.setParagraph().setBlockquote();
    else ch.setParagraph().updateAttributes("paragraph", { estilo: v });
    ch.run();
  };
  // Estilos da pessoa: aplicar, criar a partir do parágrafo, atualizar e ver a lista.
  const todos = useMeusEstilos();
  const meus = todos.filter((m) => !m.letra);
  const letras = todos.filter((m) => m.letra);
  const meuAtual = meus.find((m) => m.id === e.meuEstilo);
  const [novoEstilo, setNovoEstilo] = useState<(Omit<EstiloProprio, "id"> & { id?: string }) | null>(null);
  const [verEstilos, setVerEstilos] = useState(false);
  const [referencia, setReferencia] = useState(false);
  const noAtual = () => {
    const { $from } = editor.state.selection;
    return { no: $from.parent, alinhamento: (editor.getAttributes($from.parent.type.name).textAlign as string | null) ?? null };
  };
  const escolherEstilo = (v: string) => {
    if (v.startsWith("meu:")) {
      const m = meus.find((x) => x.id === v.slice(4));
      if (m) aplicarMeuEstilo(editor, m);
    } else if (v === "acao:criar") {
      const { no, alinhamento } = noAtual();
      setNovoEstilo({ ...estiloDoParagrafo(no, alinhamento), nome: t.meus.nomePadrao(meus.length + 1) });
    } else if (v === "acao:atualizar" && meuAtual) {
      // O que foi mudado à mão neste parágrafo passa para o estilo (o resto do estilo fica).
      const { no, alinhamento } = noAtual();
      const lido = estiloDoParagrafo(no, alinhamento);
      const mudado = Object.fromEntries(Object.entries(lido).filter(([k, val]) => k !== "base" && val !== ESTILO_VAZIO[k as keyof typeof ESTILO_VAZIO]));
      const novo = { ...meuAtual, ...mudado } as EstiloProprio;
      void salvarEstilo(novo).then(() => aplicarMeuEstilo(editor, novo));
    } else if (v === "acao:gerenciar") {
      setVerEstilos(true);
    } else {
      c().updateAttributes("paragraph", { meuEstilo: null }).updateAttributes("heading", { meuEstilo: null }).run();
      aplicarEstilo(v as EstiloParagrafo);
    }
  };
  // Sem alinhamento posto à mão, os botões mostram o do estilo da pessoa.
  const alinhar = e.alinhar === "left" && meuAtual?.alinhamento ? meuAtual.alinhamento : e.alinhar;
  const tamanhoAtual = lerPt(e.tamanho);
  const mudarTamanho = (passo: number) => {
    const base = tamanhoAtual || 12;
    const prox = passo > 0 ? TAMANHOS.find((n) => n > base) ?? base : [...TAMANHOS].reverse().find((n) => n < base) ?? base;
    c().setFontSize(tamanhoCss(prox)).run();
  };
  const inserirImagem = async (f: File) => {
    const u = URL.createObjectURL(f);
    try {
      const src = await reduzirImagem(u, 1400);
      c().setImage({ src, alt: f.name.replace(/\.[^.]+$/, "") }).run();
    } finally {
      URL.revokeObjectURL(u);
    }
  };
  // Localizar e substituir (sem ligar para acentos e maiúsculas).
  const posicoes = () => {
    const achadas: { de: number; ate: number }[] = [];
    if (!busca) return achadas;
    editor.state.doc.descendants((no, pos) => {
      if (!no.isText || !no.text) return;
      for (const i of ocorrencias(no.text, busca)) achadas.push({ de: pos + i, ate: pos + i + busca.length });
    });
    return achadas;
  };
  const proximo = () => {
    const ps = posicoes();
    setAchados(t.revisar.achados(ps.length));
    if (!ps.length) return;
    const depois = editor.state.selection.to;
    const alvo = ps.find((p) => p.de >= depois) ?? ps[0];
    c().setTextSelection({ from: alvo.de, to: alvo.ate }).scrollIntoView().run();
  };
  const substituir = () => {
    const { from, to } = editor.state.selection;
    const sel = editor.state.doc.textBetween(from, to);
    if (busca && ocorrencias(sel, busca)[0] === 0 && sel.length === busca.length) c().insertContentAt({ from, to }, troca).run();
    proximo();
  };
  const substituirTudo = () => {
    const ps = posicoes().reverse(); // de trás para frente: as posições não andam
    if (!ps.length) { setAchados(t.revisar.achados(0)); return; }
    let ch = editor.chain().focus();
    for (const p of ps) ch = ch.insertContentAt({ from: p.de, to: p.ate }, troca);
    ch.run();
    setAchados(t.revisar.trocados(ps.length));
  };

  const abas: { id: Aba; nome: string }[] = [
    { id: "inicio", nome: t.abas.inicio }, { id: "inserir", nome: t.abas.inserir },
    ...(config && !compacta ? [{ id: "pagina" as Aba, nome: t.abas.pagina }] : []),
    { id: "revisar", nome: t.abas.revisar },
  ];
  const sep = <span className="fita-sep" aria-hidden="true" />;
  // Menu flutuante ao selecionar texto (como a mini barra do Word).
  const flutuanteLigado = useMenuFlutuanteLigado();
  const menuRef = useRef<HTMLDivElement>(null);
  const flutuante = useMenuFlutuante(editor, flutuanteLigado, menuRef);
  const tf = t.flutuante;
  return (
    <div className={compacta ? "fita compacta" : "fita"} onPointerDown={segurar} onMouseDown={segurar}>
      <div className="fita-abas" role="tablist" aria-label={t.titulo}>
        {abas.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={aba === a.id ? "fita-aba ativa" : "fita-aba"} onClick={() => setAba(a.id)}>{a.nome}</button>
        ))}
        <span className="fita-abas-fim">
          <B rotulo={t.desfazer} icone={Undo2} desligado={!e.desfazer} acao={() => c().undo().run()} />
          <B rotulo={t.refazer} icone={Redo2} desligado={!e.refazer} acao={() => c().redo().run()} />
        </span>
      </div>
      <div className="fita-miolo" role="toolbar" aria-label={abas.find((a) => a.id === aba)?.nome}>
        {aba === "inicio" && (
          <>
            <select className="fita-select largo" aria-label={t.estilo} value={meuAtual ? `meu:${meuAtual.id}` : e.estilo} onChange={(ev) => escolherEstilo(ev.target.value)}>
              <optgroup label={t.meus.grupoPadrao}>
                {(Object.keys(t.estilos) as EstiloParagrafo[]).map((k) => <option key={k} value={k}>{t.estilos[k]}</option>)}
              </optgroup>
              {meus.length > 0 && (
                <optgroup label={t.meus.grupo}>
                  {meus.map((m) => <option key={m.id} value={`meu:${m.id}`}>{m.nome}</option>)}
                </optgroup>
              )}
              <optgroup label={t.meus.opcoes}>
                <option value="acao:criar">{t.meus.criar}</option>
                {meuAtual && <option value="acao:atualizar">{t.meus.atualizar(meuAtual.nome)}</option>}
                <option value="acao:gerenciar">{t.meus.gerenciar}</option>
              </optgroup>
            </select>
            <SeletorFonte atual={e.fonte} aoEscolher={(css) => (css ? c().setFontFamily(css).run() : c().unsetFontFamily().run())} />
            <span className="fita-grupo">
              <B rotulo={t.diminuir} texto="A−" acao={() => mudarTamanho(-1)} />
              <select className="fita-select curto" aria-label={t.tamanho} value={tamanhoAtual ? String(tamanhoAtual) : ""} onChange={(ev) => {
                if (ev.target.value) c().setFontSize(tamanhoCss(Number(ev.target.value))).run(); else c().unsetFontSize().run();
              }}>
                <option value="">{t.tamanhoPadrao}</option>
                {TAMANHOS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <B rotulo={t.aumentar} texto="A+" acao={() => mudarTamanho(1)} />
              <SeletorEspaco valor={e.espaco} aoMudar={(pt) => (pt ? c().setLetterSpacing(`${pt}pt`).run() : c().unsetLetterSpacing().run())} />
            </span>
            {sep}
            <span className="fita-grupo">
              <B rotulo={`${textos.rico.negrito} (Ctrl + B)`} icone={Bold} ativo={e.b} acao={() => c().toggleBold().run()} />
              <B rotulo={`${textos.rico.italico} (Ctrl + I)`} icone={Italic} ativo={e.i} acao={() => c().toggleItalic().run()} />
              <B rotulo={`${textos.rico.sublinhado} (Ctrl + U)`} icone={Underline} ativo={e.u} acao={() => c().toggleUnderline().run()} />
              <B rotulo={t.tachado} icone={Strikethrough} ativo={e.s} acao={() => c().toggleStrike().run()} />
              <B rotulo={t.sobrescrito} texto="x²" ativo={e.sobre} acao={() => c().toggleSuperscript().run()} />
              <B rotulo={t.subscrito} texto="x₂" ativo={e.sub} acao={() => c().toggleSubscript().run()} />
              <MenuTrigger>
                <Button className={e.versalete ? "fita-botao ativo" : "fita-botao"} aria-label={t.caixa.titulo}>
                  <span className="fita-botao-texto" aria-hidden="true">Aa</span>
                </Button>
                <Popover className="menu-popover" placement="bottom">
                  <Menu className="menu-lista" aria-label={t.caixa.titulo} onAction={(k) => {
                    if (k === "versalete") c().toggleMark("versalete").run();
                    else aplicarCaixa(editor, k as Caixa);
                  }}>
                    <MenuItem id="frase" className="menu-item">{t.caixa.frase}</MenuItem>
                    <MenuItem id="minusculas" className="menu-item">{t.caixa.minusculas}</MenuItem>
                    <MenuItem id="maiusculas" className="menu-item">{t.caixa.maiusculas}</MenuItem>
                    <MenuItem id="iniciais" className="menu-item">{t.caixa.iniciais}</MenuItem>
                    <MenuItem id="inverter" className="menu-item">{t.caixa.inverter}</MenuItem>
                    <MenuItem id="versalete" className="menu-item" textValue={t.caixa.versalete}>
                      <span style={{ fontVariant: "small-caps" }}>{t.caixa.versalete}</span>{e.versalete ? " ✓" : ""}
                    </MenuItem>
                  </Menu>
                </Popover>
              </MenuTrigger>
              <MenuTrigger>
                <Button className={e.letra ? "fita-botao ativo" : "fita-botao"} aria-label={t.meus.letrasMenu}>
                  <span className="fita-botao-texto fita-letra-icone" aria-hidden="true">A</span>
                </Button>
                <Popover className="menu-popover" placement="bottom">
                  <Menu className="menu-lista" aria-label={t.meus.letrasMenu} onAction={(k) => {
                    const id = String(k);
                    if (id === "acao:criar") setNovoEstilo({ ...estiloDaSelecao(editor), nome: t.meus.nomePadraoLetra(letras.length + 1) });
                    else if (id === "acao:gerenciar") setVerEstilos(true);
                    else if (id === "acao:tirar") tirarEstiloLetra(editor);
                    else { const m = letras.find((x) => x.id === id); if (m) aplicarEstiloLetra(editor, m); }
                  }}>
                    {letras.map((m) => (
                      <MenuItem key={m.id} id={m.id} className="menu-item" textValue={m.nome}>
                        <span className="doc-conteudo fita-letra-amostra"><span data-meu-estilo-letra={m.id}>{m.nome}</span></span>{e.letra === m.id ? " ✓" : ""}
                      </MenuItem>
                    ))}
                    {e.letra ? <MenuItem id="acao:tirar" className="menu-item">{t.meus.semLetra}</MenuItem> : null}
                    <MenuItem id="acao:criar" className="menu-item">{t.meus.criarLetra}</MenuItem>
                    <MenuItem id="acao:gerenciar" className="menu-item">{t.meus.gerenciar}</MenuItem>
                  </Menu>
                </Popover>
              </MenuTrigger>
              <MenuCores rotulo={t.cor} icone={Baseline} cores={CORES_TEXTO} atual={e.cor} semNome={t.corPadrao} aoEscolher={(k) => c().setColor(k).run()} aoTirar={() => c().unsetColor().run()} />
              <MenuCores rotulo={t.marcaTexto} icone={Highlighter} cores={CORES_MARCA} atual={e.marca} semNome={t.semMarca} aoEscolher={(k) => c().setHighlight({ color: k }).run()} aoTirar={() => c().unsetHighlight().run()} />
              <B rotulo={t.limpar} texto="T×" acao={() => c().unsetAllMarks().updateAttributes("paragraph", { estilo: null, entrelinha: null }).run()} />
            </span>
            {sep}
            <span className="fita-grupo">
              <B rotulo={t.alinhar.esquerda} icone={AlignLeft} ativo={alinhar === "left"} acao={() => c().setTextAlign("left").run()} />
              <B rotulo={t.alinhar.centro} icone={AlignCenter} ativo={alinhar === "center"} acao={() => c().setTextAlign("center").run()} />
              <B rotulo={t.alinhar.direita} icone={AlignRight} ativo={alinhar === "right"} acao={() => c().setTextAlign("right").run()} />
              <B rotulo={t.alinhar.justificar} icone={AlignJustify} ativo={alinhar === "justify"} acao={() => c().setTextAlign("justify").run()} />
              <select className="fita-select curto" aria-label={t.entrelinha} title={t.entrelinha} value={e.entrelinha} onChange={(ev) => paragrafo({ entrelinha: ev.target.value || null })}>
                <option value="">{t.entrelinhaPadrao}</option>
                {ENTRELINHAS.map((n) => <option key={n} value={n}>{n.replace(".", ",")}</option>)}
              </select>
              <B rotulo={t.recuoMenos} texto="⇤" desligado={!e.recuo} acao={() => paragrafo({ recuo: Math.max(0, e.recuo - 1) })} />
              <B rotulo={t.recuoMais} texto="⇥" acao={() => paragrafo({ recuo: Math.min(8, e.recuo + 1) })} />
            </span>
            {sep}
            <span className="fita-grupo">
              <B rotulo={textos.rico.lista} icone={List} ativo={e.lista} acao={() => c().toggleBulletList().run()} />
              <B rotulo={textos.rico.numerada} icone={ListOrdered} ativo={e.numerada} acao={() => c().toggleOrderedList().run()} />
              <B rotulo={t.tarefas} icone={ListChecks} ativo={e.tarefas} acao={() => c().toggleTaskList().run()} />
            </span>
            {extra && <>{sep}{extra}</>}
          </>
        )}
        {aba === "inserir" && (
          <>
            <span className="fita-grupo">
              <MenuTrigger>
                <Button className={e.tabela ? "fita-botao largo ativo" : "fita-botao largo"} aria-label={t.tabela.titulo}><Table size="1.05em" aria-hidden="true" /> {t.tabela.titulo} <ChevronDown size="0.8em" aria-hidden="true" /></Button>
                <Popover className="menu-popover" placement="bottom">
                  <Menu className="menu-lista" aria-label={t.tabela.titulo} onAction={(k) => {
                    const ch = c();
                    if (k === "inserir") ch.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
                    else if (k === "linhaAntes") ch.addRowBefore(); else if (k === "linhaDepois") ch.addRowAfter();
                    else if (k === "colunaAntes") ch.addColumnBefore(); else if (k === "colunaDepois") ch.addColumnAfter();
                    else if (k === "cabecalho") ch.toggleHeaderRow(); else if (k === "juntar") ch.mergeOrSplit();
                    else if (k === "tirarLinha") ch.deleteRow(); else if (k === "tirarColuna") ch.deleteColumn(); else if (k === "apagar") ch.deleteTable();
                    ch.run();
                  }}>
                    {!e.tabela && <MenuItem id="inserir" className="menu-item">{t.tabela.inserir}</MenuItem>}
                    {e.tabela && <MenuItem id="linhaAntes" className="menu-item">{t.tabela.linhaAntes}</MenuItem>}
                    {e.tabela && <MenuItem id="linhaDepois" className="menu-item">{t.tabela.linhaDepois}</MenuItem>}
                    {e.tabela && <MenuItem id="colunaAntes" className="menu-item">{t.tabela.colunaAntes}</MenuItem>}
                    {e.tabela && <MenuItem id="colunaDepois" className="menu-item">{t.tabela.colunaDepois}</MenuItem>}
                    {e.tabela && <MenuItem id="cabecalho" className="menu-item">{t.tabela.cabecalho}</MenuItem>}
                    {e.tabela && <MenuItem id="juntar" className="menu-item">{t.tabela.juntar}</MenuItem>}
                    {e.tabela && <MenuItem id="tirarLinha" className="menu-item">{t.tabela.tirarLinha}</MenuItem>}
                    {e.tabela && <MenuItem id="tirarColuna" className="menu-item">{t.tabela.tirarColuna}</MenuItem>}
                    {e.tabela && <MenuItem id="apagar" className="menu-item perigo">{t.tabela.apagar}</MenuItem>}
                  </Menu>
                </Popover>
              </MenuTrigger>
              <button type="button" className="fita-botao largo" onClick={() => arquivo.current?.click()}><ImagePlus size="1.05em" aria-hidden="true" /> {t.imagem}</button>
              <input ref={arquivo} type="file" accept="image/*" hidden onChange={(ev) => { const f = ev.target.files?.[0]; if (f) void inserirImagem(f); ev.target.value = ""; }} />
              <button type="button" className={e.linkAtivo ? "fita-botao largo ativo" : "fita-botao largo"} onClick={() => setLink(editor.getAttributes("link").href ?? "")}><Link2 size="1.05em" aria-hidden="true" /> {t.link}</button>
            </span>
            {sep}
            <span className="fita-grupo">
              <button type="button" className="fita-botao largo" onClick={() => c().toggleBlockquote().run()}><Quote size="1.05em" aria-hidden="true" /> {t.citacao}</button>
              <button type="button" className="fita-botao largo" onClick={() => c().setHorizontalRule().run()}><Minus size="1.05em" aria-hidden="true" /> {t.linha}</button>
              <button type="button" className="fita-botao largo" onClick={() => c().setDetails().run()}><ChevronDown size="1.05em" aria-hidden="true" /> {t.recolhivel}</button>
              <MenuTrigger>
                <Button className={e.capitular ? "fita-botao largo ativo" : "fita-botao largo"} aria-label={t.capitular.titulo}>
                  <span className="fita-capitular-icone" aria-hidden="true">A</span> {t.capitular.titulo} <ChevronDown size="0.8em" aria-hidden="true" />
                </Button>
                <Popover className="menu-popover" placement="bottom">
                  <Menu className="menu-lista" aria-label={t.capitular.titulo} onAction={(k) => paragrafo({ capitular: Number(k) || null })}>
                    {[0, 2, 3, 4].map((n) => (
                      <MenuItem key={n} id={String(n)} className="menu-item">{n ? t.capitular.linhas(n) : t.capitular.sem}{(e.capitular || 0) === n ? " ✓" : ""}</MenuItem>
                    ))}
                  </Menu>
                </Popover>
              </MenuTrigger>
              <button type="button" className="fita-botao largo" onClick={() => c().insertContent(new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })).run()}><Plus size="1.05em" aria-hidden="true" /> {t.data}</button>
              <button type="button" className="fita-botao largo" onClick={() => setReferencia(true)}><Quote size="1.05em" aria-hidden="true" /> {t.referencia.botao}</button>
            </span>
          </>
        )}
        {aba === "pagina" && config && aoConfig && (
          <>
            <select className="fita-select largo" aria-label={t.pagina.conjunto} value={config.conjunto} onChange={(ev) => {
              const conjunto = ev.target.value as ConjuntoEstilo;
              aoConfig({ ...config, conjunto, margens: CONJUNTOS[conjunto].margens });
            }}>
              {(Object.keys(CONJUNTOS) as ConjuntoEstilo[]).map((k) => <option key={k} value={k}>{t.pagina.conjuntos[k]}</option>)}
            </select>
            <select className="fita-select" aria-label={t.pagina.tamanho} value={config.tamanho} onChange={(ev) => aoConfig({ ...config, tamanho: ev.target.value as ConfigDocumento["tamanho"] })}>
              <option value="a4">A4</option><option value="a5">A5</option><option value="carta">{t.pagina.carta}</option>
            </select>
            <select className="fita-select largo" aria-label={t.pagina.margens} value={(Object.keys(MARGENS) as (keyof typeof MARGENS)[]).find((k) => JSON.stringify(MARGENS[k]) === JSON.stringify(config.margens)) ?? "propria"}
              onChange={(ev) => { const k = ev.target.value as keyof typeof MARGENS; if (MARGENS[k]) aoConfig({ ...config, margens: MARGENS[k] }); }}>
              {(Object.keys(MARGENS) as (keyof typeof MARGENS)[]).map((k) => <option key={k} value={k}>{t.pagina.margensNomes[k]}</option>)}
              <option value="propria" disabled>{t.pagina.margensPropria}</option>
            </select>
            <select className="fita-select largo" aria-label={t.pagina.numero} value={config.numero} onChange={(ev) => aoConfig({ ...config, numero: ev.target.value as ConfigDocumento["numero"] })}>
              {(["nenhum", "baixo-direita", "baixo-centro", "cima-direita"] as const).map((k) => <option key={k} value={k}>{t.pagina.numeros[k]}</option>)}
            </select>
            <label className="fita-campo">{t.pagina.cabecalho}
              <input className="entrada-texto" value={config.cabecalho} maxLength={200} onChange={(ev) => aoConfig({ ...config, cabecalho: ev.target.value })} placeholder={t.pagina.cabecalhoExemplo} />
            </label>
            <label className="fita-campo">{t.pagina.rodape}
              <input className="entrada-texto" value={config.rodape} maxLength={200} onChange={(ev) => aoConfig({ ...config, rodape: ev.target.value })} />
            </label>
          </>
        )}
        {aba === "revisar" && (
          <>
            <span className="fita-grupo fita-busca">
              <Search size="1em" aria-hidden="true" />
              <input className="entrada-texto" value={busca} onChange={(ev) => { setBusca(ev.target.value); setAchados(null); }} placeholder={t.revisar.localizar} aria-label={t.revisar.localizar}
                onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); proximo(); } }} />
              <input className="entrada-texto" value={troca} onChange={(ev) => setTroca(ev.target.value)} placeholder={t.revisar.substituirPor} aria-label={t.revisar.substituirPor} />
              <button type="button" className="fita-botao largo" onClick={proximo}>{t.revisar.proximo}</button>
              <button type="button" className="fita-botao largo" onClick={substituir}>{t.revisar.substituir}</button>
              <button type="button" className="fita-botao largo" onClick={substituirTudo}>{t.revisar.substituirTudo}</button>
              {achados && <span className="fita-info" role="status">{achados}</span>}
            </span>
            {sep}
            <span className="fita-info">{t.revisar.contagem(e.palavras, e.caracteres)}</span>
            {sep}
            <button type="button" className={flutuanteLigado ? "fita-botao largo ativo" : "fita-botao largo"} aria-pressed={flutuanteLigado} onClick={() => ligarMenuFlutuante(!flutuanteLigado)}>
              {flutuanteLigado ? tf.ligado : tf.desligado}
            </button>
          </>
        )}
      </div>
      {link !== null && (
        <div className="fita-link" role="group" aria-label={t.link}>
          <input className="entrada-texto" autoFocus value={link} onChange={(ev) => setLink(ev.target.value)} placeholder="https://" aria-label={t.linkEndereco}
            onKeyDown={(ev) => {
              if (ev.key === "Escape") setLink(null);
              if (ev.key === "Enter") {
                ev.preventDefault();
                const end = link.trim();
                if (end) c().extendMarkRange("link").setLink({ href: /^[a-z]+:/i.test(end) ? end : `https://${end}` }).run(); else c().unsetLink().run();
                setLink(null);
              }
            }} />
          <button type="button" className="fita-botao largo" onClick={() => {
            const end = link.trim();
            if (end) c().extendMarkRange("link").setLink({ href: /^[a-z]+:/i.test(end) ? end : `https://${end}` }).run(); else c().unsetLink().run();
            setLink(null);
          }}>{t.linkPronto}</button>
          {e.linkAtivo && <button type="button" className="fita-botao largo" onClick={() => { c().unsetLink().run(); setLink(null); }}>{t.linkTirar}</button>}
          <B rotulo={textos.comum.fechar} icone={X} acao={() => setLink(null)} />
        </div>
      )}
      {flutuante.visivel && createPortal(
        <div ref={menuRef} className="menu-flutuante" role="toolbar" aria-label={tf.titulo} onPointerDown={segurar} onMouseDown={segurar}
          style={flutuante.lugar ? { left: flutuante.lugar.left, top: flutuante.lugar.top } : { left: -9999, top: -9999 }}>
          <div className="menu-flutuante-linha">
            <select className="fita-select" aria-label={t.estilo} value={meuAtual ? `meu:${meuAtual.id}` : e.estilo} onChange={(ev) => escolherEstilo(ev.target.value)}>
              <optgroup label={t.meus.grupoPadrao}>
                {(Object.keys(t.estilos) as EstiloParagrafo[]).map((k) => <option key={k} value={k}>{t.estilos[k]}</option>)}
              </optgroup>
              {meus.length > 0 && (
                <optgroup label={t.meus.grupo}>
                  {meus.map((m) => <option key={m.id} value={`meu:${m.id}`}>{m.nome}</option>)}
                </optgroup>
              )}
            </select>
            <SeletorFonte atual={e.fonte} aoEscolher={(css) => (css ? c().setFontFamily(css).run() : c().unsetFontFamily().run())} />
            <select className="fita-select curto" aria-label={t.tamanho} value={tamanhoAtual ? String(tamanhoAtual) : ""} onChange={(ev) => {
              if (ev.target.value) c().setFontSize(tamanhoCss(Number(ev.target.value))).run(); else c().unsetFontSize().run();
            }}>
              <option value="">{t.tamanhoPadrao}</option>
              {TAMANHOS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <B rotulo={t.diminuir} texto="A−" acao={() => mudarTamanho(-1)} />
            <B rotulo={t.aumentar} texto="A+" acao={() => mudarTamanho(1)} />
          </div>
          <div className="menu-flutuante-linha">
            <B rotulo={`${textos.rico.negrito} (Ctrl + B)`} icone={Bold} ativo={e.b} acao={() => c().toggleBold().run()} />
            <B rotulo={`${textos.rico.italico} (Ctrl + I)`} icone={Italic} ativo={e.i} acao={() => c().toggleItalic().run()} />
            <B rotulo={`${textos.rico.sublinhado} (Ctrl + U)`} icone={Underline} ativo={e.u} acao={() => c().toggleUnderline().run()} />
            <B rotulo={t.tachado} icone={Strikethrough} ativo={e.s} acao={() => c().toggleStrike().run()} />
            <MenuCores rotulo={t.cor} icone={Baseline} cores={CORES_TEXTO} atual={e.cor} semNome={t.corPadrao} aoEscolher={(k) => c().setColor(k).run()} aoTirar={() => c().unsetColor().run()} />
            <MenuCores rotulo={t.marcaTexto} icone={Highlighter} cores={CORES_MARCA} atual={e.marca} semNome={t.semMarca} aoEscolher={(k) => c().setHighlight({ color: k }).run()} aoTirar={() => c().unsetHighlight().run()} />
            <MenuTrigger>
              <Button className={e.versalete ? "fita-botao ativo" : "fita-botao"} aria-label={t.caixa.titulo}>
                <span className="fita-botao-texto" aria-hidden="true">Aa</span>
              </Button>
              <Popover className="menu-popover" placement="bottom">
                <Menu className="menu-lista" aria-label={t.caixa.titulo} onAction={(k) => { if (k === "versalete") c().toggleMark("versalete").run(); else aplicarCaixa(editor, k as Caixa); }}>
                  <MenuItem id="frase" className="menu-item">{t.caixa.frase}</MenuItem>
                  <MenuItem id="minusculas" className="menu-item">{t.caixa.minusculas}</MenuItem>
                  <MenuItem id="maiusculas" className="menu-item">{t.caixa.maiusculas}</MenuItem>
                  <MenuItem id="iniciais" className="menu-item">{t.caixa.iniciais}</MenuItem>
                  <MenuItem id="versalete" className="menu-item" textValue={t.caixa.versalete}><span style={{ fontVariant: "small-caps" }}>{t.caixa.versalete}</span>{e.versalete ? " ✓" : ""}</MenuItem>
                </Menu>
              </Popover>
            </MenuTrigger>
            <B rotulo={textos.rico.lista} icone={List} ativo={e.lista} acao={() => c().toggleBulletList().run()} />
            <B rotulo={textos.rico.numerada} icone={ListOrdered} ativo={e.numerada} acao={() => c().toggleOrderedList().run()} />
            <B rotulo={t.link} icone={Link2} ativo={e.linkAtivo} acao={() => setLink((editor.getAttributes("link").href as string | undefined) ?? "")} />
            <B rotulo={t.limpar} texto="T×" acao={() => c().unsetAllMarks().run()} />
          </div>
        </div>,
        document.body,
      )}
      <JanelaEstilo inicial={novoEstilo} aberta={!!novoEstilo} aoFechar={() => setNovoEstilo(null)} aoSalvar={(m) => (m.letra ? aplicarEstiloLetra(editor, m) : aplicarMeuEstilo(editor, m))} />
      <JanelaMeusEstilos aberta={verEstilos} aoFechar={() => setVerEstilos(false)} />
      <JanelaReferencia editor={editor} aberta={referencia} aoFechar={() => setReferencia(false)} normaInicial={config?.conjunto === "apa" ? "apa" : "abnt"} />
    </div>
  );
}
