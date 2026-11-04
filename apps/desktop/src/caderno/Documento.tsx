// Página de texto: um editor no estilo do Pages ou do Word dentro da folha, com
// títulos, fontes, cores, listas, tabelas e alinhamento. O desenho à mão fica por
// cima (escreve-se com a caneta sobre o texto, como num papel impresso). O texto
// é guardado em HTML na cena da página (`cena.documento`).
import { Highlight } from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import DOMPurify from "dompurify";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, Highlighter, Italic, List, ListChecks, ListOrdered, Minus, Plus, Quote, Redo2, Strikethrough, Table, Underline, Undo2,
} from "../icones";
import { FONTES } from "../preferencias";
import { textos } from "../textos/pt-BR";

const t = textos.caderno.documento;

/** Margem da página de texto, em px de referência (cerca de 2 cm). */
export const MARGEM_DOCUMENTO = 72;

/** Extensões do editor de texto da página. Links nunca abrem ao tocar. */
export const extensoesDocumento = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https" }, codeBlock: false }),
  TextStyleKit,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: false } }),
];

/** Limpa o HTML guardado antes de mostrar fora do editor (miniaturas). */
export const htmlSeguro = (html: string) => DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ["style", "img", "iframe", "form", "input"], FORBID_ATTR: ["srcset"] });

const TAMANHOS = [11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 60];
const CORES_TEXTO = ["#1f2937", "#6b7280", "#b91c1c", "#c2410c", "#a16207", "#15803d", "#0e7490", "#1d4ed8", "#7e22ce", "#be185d"];
const CORES_MARCA = ["#fef08a", "#bbf7d0", "#bae6fd", "#fbcfe8", "#fed7aa", "#e9d5ff"];

/** A folha de texto, desenhada no tamanho real e reduzida pela escala da página. */
export function CamadaDocumento({ html, editavel, escala, largura, altura, slot, aoMudar, aoContinuar }: {
  html: string; editavel: boolean; escala: number; largura: number; altura: number;
  /** Onde a barra de formatação aparece (a barra de contexto), só na página atual. */
  slot: HTMLElement | null;
  aoMudar: (html: string) => void;
  /** O texto passou do fim da folha: criar uma página de texto depois desta. */
  aoContinuar: () => void;
}) {
  const aoMudarRef = useRef(aoMudar);
  aoMudarRef.current = aoMudar;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editor = useEditor({
    extensions: extensoesDocumento,
    content: html || "",
    editable: editavel,
    editorProps: { attributes: { class: "caderno-doc-conteudo", "aria-label": t.campo, spellcheck: "true" } },
    onUpdate: ({ editor: e }) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => aoMudarRef.current(e.getHTML()), 400);
    },
  });
  useEffect(() => () => {
    // Ao sair (trocar de página, fechar), grava o que faltava.
    clearTimeout(timer.current);
    if (editor && !editor.isDestroyed) aoMudarRef.current(editor.getHTML());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);
  useEffect(() => { editor?.setEditable(editavel); }, [editor, editavel]);
  // Mudou de fora (desfazer do caderno, sincronização): atualiza sem perder o cursor à toa.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    if ((html || "") !== editor.getHTML()) editor.commands.setContent(html || "", { emitUpdate: false });
  }, [editor, html]);
  // O texto passou do fim da folha?
  const miolo = useRef<HTMLDivElement>(null);
  const [passou, setPassou] = useState(false);
  useLayoutEffect(() => {
    const el = miolo.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => setPassou(el.scrollHeight > el.clientHeight + 2);
    const ro = new ResizeObserver(medir);
    const pm = el.querySelector(".caderno-doc-conteudo");
    if (pm) ro.observe(pm);
    medir();
    return () => ro.disconnect();
  }, [editor]);
  return (
    <div className={editavel ? "caderno-doc editavel" : "caderno-doc"}>
      <div ref={miolo} className="caderno-doc-folha" style={{ width: largura, height: altura, padding: MARGEM_DOCUMENTO, transform: `scale(${escala})` }}>
        <EditorContent editor={editor} />
      </div>
      {passou && (
        <div className="caderno-doc-passou">
          <span>{t.passou}</span>
          <button type="button" className="botao pequeno" onClick={aoContinuar}>{t.continuar}</button>
        </div>
      )}
      {editor && editavel && slot && createPortal(<BarraDocumento editor={editor} />, slot)}
    </div>
  );
}

/** O texto da página de texto, só para ver (miniaturas). */
export const DocumentoEstatico = memo(function DocumentoEstatico({ html, largura, altura }: { html: string; largura: number; altura: number }) {
  return (
    <div className="caderno-doc-folha caderno-doc-conteudo" style={{ width: largura, height: altura, padding: MARGEM_DOCUMENTO, position: "absolute", left: 0, top: 0 }}
      dangerouslySetInnerHTML={{ __html: htmlSeguro(html) }} />
  );
});

/** Barra de formatação da página de texto (vai na barra de contexto). */
function BarraDocumento({ editor }: { editor: Editor }) {
  const e = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      estilo: ed.isActive("heading", { level: 1 }) ? "h1" : ed.isActive("heading", { level: 2 }) ? "h2" : ed.isActive("heading", { level: 3 }) ? "h3" : ed.isActive("blockquote") ? "citacao" : "p",
      b: ed.isActive("bold"), i: ed.isActive("italic"), u: ed.isActive("underline"), s: ed.isActive("strike"),
      lista: ed.isActive("bulletList"), numerada: ed.isActive("orderedList"), tarefas: ed.isActive("taskList"),
      alinhar: (["left", "center", "right", "justify"] as const).find((a) => ed.isActive({ textAlign: a })) ?? "left",
      fonte: (ed.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
      tamanho: (ed.getAttributes("textStyle").fontSize as string | undefined) ?? "",
      cor: (ed.getAttributes("textStyle").color as string | undefined) ?? "",
      tabela: ed.isActive("table"),
      desfazer: ed.can().undo(), refazer: ed.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  const segurar = (ev: React.PointerEvent | React.MouseEvent) => {
    // Tocar nos botões não tira o cursor do texto (os campos de escolha, sim).
    if (!(ev.target as HTMLElement).closest("select, input")) ev.preventDefault();
  };
  const botao = (rotulo: string, Icone: React.ComponentType<{ size?: string; "aria-hidden"?: "true" }>, ativo: boolean | undefined, acao: () => void, desligado = false) => (
    <button type="button" className={ativo ? "caderno-fmt ativo" : "caderno-fmt"} aria-label={rotulo} title={rotulo} aria-pressed={ativo ?? undefined} disabled={desligado} onClick={acao}>
      <Icone size="1em" aria-hidden="true" />
    </button>
  );
  const fontes = Object.entries(FONTES);
  return (
    <div className="caderno-fmt-barra caderno-doc-barra" role="toolbar" aria-label={t.formatar} onPointerDown={segurar} onMouseDown={segurar}>
      <span className="caderno-fmt-grupo">
        {botao(t.desfazer, Undo2, undefined, () => c().undo().run(), !e.desfazer)}
        {botao(t.refazer, Redo2, undefined, () => c().redo().run(), !e.refazer)}
      </span>
      <select className="caderno-doc-select" aria-label={t.estilo} value={e.estilo} onChange={(ev) => {
        const v = ev.target.value;
        if (v === "p") c().setParagraph().run();
        else if (v === "citacao") c().setParagraph().setBlockquote().run();
        else c().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
      }}>
        <option value="p">{t.estilos.p}</option>
        <option value="h1">{t.estilos.h1}</option>
        <option value="h2">{t.estilos.h2}</option>
        <option value="h3">{t.estilos.h3}</option>
        <option value="citacao">{t.estilos.citacao}</option>
      </select>
      <select className="caderno-doc-select" aria-label={t.fonte} value={fontes.find(([, f]) => f.css === e.fonte)?.[0] ?? ""} onChange={(ev) => {
        const f = FONTES[ev.target.value as keyof typeof FONTES];
        if (f) c().setFontFamily(f.css).run(); else c().unsetFontFamily().run();
      }}>
        <option value="">{t.fontePadrao}</option>
        {fontes.map(([k, f]) => <option key={k} value={k}>{f.nome}</option>)}
      </select>
      <select className="caderno-doc-select curto" aria-label={t.tamanho} value={e.tamanho.replace("px", "")} onChange={(ev) => {
        if (ev.target.value) c().setFontSize(`${ev.target.value}px`).run(); else c().unsetFontSize().run();
      }}>
        <option value="">{t.tamanhoPadrao}</option>
        {TAMANHOS.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <span className="caderno-fmt-grupo">
        {botao(textos.rico.negrito, Bold, e.b, () => c().toggleBold().run())}
        {botao(textos.rico.italico, Italic, e.i, () => c().toggleItalic().run())}
        {botao(textos.rico.sublinhado, Underline, e.u, () => c().toggleUnderline().run())}
        {botao(t.tachado, Strikethrough, e.s, () => c().toggleStrike().run())}
      </span>
      <span className="caderno-fmt-grupo">
        <MenuTrigger>
          <Button className="caderno-fmt" aria-label={t.cor}><Baseline size="1em" aria-hidden="true" /><span className="caderno-doc-cor-traco" style={{ background: e.cor || "#1f2937" }} aria-hidden="true" /></Button>
          <Popover className="caderno-popover" placement="top">
            <Menu className="caderno-doc-cores" aria-label={t.cor} onAction={(k) => (k === "padrao" ? c().unsetColor().run() : c().setColor(String(k)).run())}>
              <MenuItem id="padrao" className="caderno-doc-cor padrao" aria-label={t.corPadrao}>A</MenuItem>
              {CORES_TEXTO.map((cor) => <MenuItem key={cor} id={cor} className="caderno-doc-cor" aria-label={cor} style={{ background: cor }} />)}
            </Menu>
          </Popover>
        </MenuTrigger>
        <MenuTrigger>
          <Button className="caderno-fmt" aria-label={t.marcaTexto}><Highlighter size="1em" aria-hidden="true" /></Button>
          <Popover className="caderno-popover" placement="top">
            <Menu className="caderno-doc-cores" aria-label={t.marcaTexto} onAction={(k) => (k === "nenhum" ? c().unsetHighlight().run() : c().setHighlight({ color: String(k) }).run())}>
              <MenuItem id="nenhum" className="caderno-doc-cor padrao" aria-label={t.semMarca}>×</MenuItem>
              {CORES_MARCA.map((cor) => <MenuItem key={cor} id={cor} className="caderno-doc-cor" aria-label={cor} style={{ background: cor }} />)}
            </Menu>
          </Popover>
        </MenuTrigger>
      </span>
      <span className="caderno-fmt-grupo">
        {botao(t.alinhar.esquerda, AlignLeft, e.alinhar === "left", () => c().setTextAlign("left").run())}
        {botao(t.alinhar.centro, AlignCenter, e.alinhar === "center", () => c().setTextAlign("center").run())}
        {botao(t.alinhar.direita, AlignRight, e.alinhar === "right", () => c().setTextAlign("right").run())}
        {botao(t.alinhar.justificar, AlignJustify, e.alinhar === "justify", () => c().setTextAlign("justify").run())}
      </span>
      <span className="caderno-fmt-grupo">
        {botao(textos.rico.lista, List, e.lista, () => c().toggleBulletList().run())}
        {botao(textos.rico.numerada, ListOrdered, e.numerada, () => c().toggleOrderedList().run())}
        {botao(t.tarefas, ListChecks, e.tarefas, () => c().toggleTaskList().run())}
        {botao(t.citacao, Quote, e.estilo === "citacao", () => c().toggleBlockquote().run())}
        {botao(t.linha, Minus, undefined, () => c().setHorizontalRule().run())}
      </span>
      <MenuTrigger>
        <Button className={e.tabela ? "caderno-fmt ativo" : "caderno-fmt"} aria-label={t.tabela.titulo}><Table size="1em" aria-hidden="true" /></Button>
        <Popover className="menu-popover" placement="top">
          <Menu className="menu-lista" aria-label={t.tabela.titulo} onAction={(k) => {
            if (k === "inserir") c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            else if (k === "linhaDepois") c().addRowAfter().run();
            else if (k === "colunaDepois") c().addColumnAfter().run();
            else if (k === "tirarLinha") c().deleteRow().run();
            else if (k === "tirarColuna") c().deleteColumn().run();
            else if (k === "apagar") c().deleteTable().run();
          }}>
            {!e.tabela && <MenuItem id="inserir" className="menu-item"><Plus size="0.9em" aria-hidden="true" /> {t.tabela.inserir}</MenuItem>}
            {e.tabela && <MenuItem id="linhaDepois" className="menu-item">{t.tabela.linhaDepois}</MenuItem>}
            {e.tabela && <MenuItem id="colunaDepois" className="menu-item">{t.tabela.colunaDepois}</MenuItem>}
            {e.tabela && <MenuItem id="tirarLinha" className="menu-item">{t.tabela.tirarLinha}</MenuItem>}
            {e.tabela && <MenuItem id="tirarColuna" className="menu-item">{t.tabela.tirarColuna}</MenuItem>}
            {e.tabela && <MenuItem id="apagar" className="menu-item perigo">{t.tabela.apagar}</MenuItem>}
          </Menu>
        </Popover>
      </MenuTrigger>
    </div>
  );
}
