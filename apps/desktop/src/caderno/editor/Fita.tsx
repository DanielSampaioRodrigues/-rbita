// A barra do editor de texto, no estilo do Word e do Pages: abas Início, Inserir,
// Página (só no documento de texto) e Revisar. Cada botão tem nome escrito para o
// leitor de tela e dica ao passar o mouse; tocar não tira o cursor do texto.
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { useRef, useState } from "react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { reduzirImagem } from "../../fundo";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, ChevronDown, Highlighter, ImagePlus, Italic, Link2, List, ListChecks, ListOrdered,
  Minus, Plus, Quote, Redo2, Search, Strikethrough, Table, Underline, Undo2, X,
} from "../../icones";
import { FONTES } from "../../preferencias";
import { textos } from "../../textos/pt-BR";
import { CONJUNTOS, MARGENS, ocorrencias, type ConfigDocumento, type ConjuntoEstilo, type EstiloParagrafo } from "./estilos";

const t = textos.caderno.editor;

const TAMANHOS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];
const CORES_TEXTO = ["#1f2937", "#6b7280", "#991b1b", "#dc2626", "#c2410c", "#ca8a04", "#15803d", "#0f766e", "#0e7490", "#1d4ed8", "#4338ca", "#7e22ce", "#be185d", "#ffffff"];
const CORES_MARCA = ["#fef08a", "#fde68a", "#bbf7d0", "#a7f3d0", "#bae6fd", "#c7d2fe", "#fbcfe8", "#fed7aa", "#e9d5ff", "#e5e7eb"];
const ENTRELINHAS = ["1", "1.15", "1.5", "2", "2.5", "3"];
/** Fontes do documento: as do app e as clássicas de trabalho acadêmico. */
const FONTES_DOC: { chave: string; nome: string; css: string }[] = [
  { chave: "times", nome: "Times New Roman", css: '"Times New Roman", Times, "Liberation Serif", serif' },
  { chave: "arial", nome: "Arial", css: 'Arial, "Helvetica Neue", "Liberation Sans", sans-serif' },
  { chave: "georgia", nome: "Georgia", css: 'Georgia, "Times New Roman", serif' },
  { chave: "verdana", nome: "Verdana", css: "Verdana, Geneva, sans-serif" },
  { chave: "mono", nome: "Monoespaçada", css: '"Courier New", ui-monospace, monospace' },
  ...Object.entries(FONTES).map(([chave, f]) => ({ chave, nome: f.nome, css: f.css })),
];

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

/** Lê um tamanho guardado ("18pt", "24px" ou "calc(24px * …)") em pontos. */
export function lerPt(v: string): number {
  const m = /([\d.]+)\s*(pt|px)/.exec(v);
  if (!m) return 0;
  const n = Number(m[1]);
  return Math.round(m[2] === "px" ? n * 0.75 : n);
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
        sobre: ed.isActive("superscript"), sub: ed.isActive("subscript"),
        lista: ed.isActive("bulletList"), numerada: ed.isActive("orderedList"), tarefas: ed.isActive("taskList"),
        alinhar: (["left", "center", "right", "justify"] as const).find((a) => ed.isActive({ textAlign: a })) ?? "left",
        fonte: (ts.fontFamily as string | undefined) ?? "", tamanho: (ts.fontSize as string | undefined) ?? "", cor: (ts.color as string | undefined) ?? "",
        marca: (ed.getAttributes("highlight").color as string | undefined) ?? "",
        entrelinha: (bloco.entrelinha as string | null) ?? "", recuo: (bloco.recuo as number) ?? 0,
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

  const fonteAtual = FONTES_DOC.find((f) => f.css === e.fonte)?.chave ?? "";
  const abas: { id: Aba; nome: string }[] = [
    { id: "inicio", nome: t.abas.inicio }, { id: "inserir", nome: t.abas.inserir },
    ...(config && !compacta ? [{ id: "pagina" as Aba, nome: t.abas.pagina }] : []),
    { id: "revisar", nome: t.abas.revisar },
  ];
  const sep = <span className="fita-sep" aria-hidden="true" />;
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
            <select className="fita-select largo" aria-label={t.estilo} value={e.estilo} onChange={(ev) => aplicarEstilo(ev.target.value as EstiloParagrafo)}>
              {(Object.keys(t.estilos) as EstiloParagrafo[]).map((k) => <option key={k} value={k}>{t.estilos[k]}</option>)}
            </select>
            <select className="fita-select largo" aria-label={t.fonte} value={fonteAtual} onChange={(ev) => {
              const f = FONTES_DOC.find((x) => x.chave === ev.target.value);
              if (f) c().setFontFamily(f.css).run(); else c().unsetFontFamily().run();
            }}>
              <option value="">{t.fontePadrao}</option>
              {FONTES_DOC.map((f) => <option key={f.chave} value={f.chave}>{f.nome}</option>)}
            </select>
            <span className="fita-grupo">
              <B rotulo={t.diminuir} texto="A−" acao={() => mudarTamanho(-1)} />
              <select className="fita-select curto" aria-label={t.tamanho} value={tamanhoAtual ? String(tamanhoAtual) : ""} onChange={(ev) => {
                if (ev.target.value) c().setFontSize(tamanhoCss(Number(ev.target.value))).run(); else c().unsetFontSize().run();
              }}>
                <option value="">{t.tamanhoPadrao}</option>
                {TAMANHOS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <B rotulo={t.aumentar} texto="A+" acao={() => mudarTamanho(1)} />
            </span>
            {sep}
            <span className="fita-grupo">
              <B rotulo={`${textos.rico.negrito} (Ctrl + B)`} icone={Bold} ativo={e.b} acao={() => c().toggleBold().run()} />
              <B rotulo={`${textos.rico.italico} (Ctrl + I)`} icone={Italic} ativo={e.i} acao={() => c().toggleItalic().run()} />
              <B rotulo={`${textos.rico.sublinhado} (Ctrl + U)`} icone={Underline} ativo={e.u} acao={() => c().toggleUnderline().run()} />
              <B rotulo={t.tachado} icone={Strikethrough} ativo={e.s} acao={() => c().toggleStrike().run()} />
              <B rotulo={t.sobrescrito} texto="x²" ativo={e.sobre} acao={() => c().toggleSuperscript().run()} />
              <B rotulo={t.subscrito} texto="x₂" ativo={e.sub} acao={() => c().toggleSubscript().run()} />
              <MenuCores rotulo={t.cor} icone={Baseline} cores={CORES_TEXTO} atual={e.cor} semNome={t.corPadrao} aoEscolher={(k) => c().setColor(k).run()} aoTirar={() => c().unsetColor().run()} />
              <MenuCores rotulo={t.marcaTexto} icone={Highlighter} cores={CORES_MARCA} atual={e.marca} semNome={t.semMarca} aoEscolher={(k) => c().setHighlight({ color: k }).run()} aoTirar={() => c().unsetHighlight().run()} />
              <B rotulo={t.limpar} texto="T×" acao={() => c().unsetAllMarks().updateAttributes("paragraph", { estilo: null, entrelinha: null }).run()} />
            </span>
            {sep}
            <span className="fita-grupo">
              <B rotulo={t.alinhar.esquerda} icone={AlignLeft} ativo={e.alinhar === "left"} acao={() => c().setTextAlign("left").run()} />
              <B rotulo={t.alinhar.centro} icone={AlignCenter} ativo={e.alinhar === "center"} acao={() => c().setTextAlign("center").run()} />
              <B rotulo={t.alinhar.direita} icone={AlignRight} ativo={e.alinhar === "right"} acao={() => c().setTextAlign("right").run()} />
              <B rotulo={t.alinhar.justificar} icone={AlignJustify} ativo={e.alinhar === "justify"} acao={() => c().setTextAlign("justify").run()} />
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
              <button type="button" className="fita-botao largo" onClick={() => c().insertContent(new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })).run()}><Plus size="1.05em" aria-hidden="true" /> {t.data}</button>
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
    </div>
  );
}
