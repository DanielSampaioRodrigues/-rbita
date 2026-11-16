// Página de texto: um editor no estilo do Pages ou do Word dentro da folha, com
// títulos, fontes, cores, listas, tabelas e alinhamento. O desenho à mão fica por
// cima (escreve-se com a caneta sobre o texto, como num papel impresso). O texto
// é guardado em HTML na cena da página (`cena.documento`).
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { DOMSerializer } from "@tiptap/pm/model";
import DOMPurify from "dompurify";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { textos } from "../textos/pt-BR";
import { FitaTexto } from "./editor/Fita";
import { extensoesBase } from "./editor/extensoes";

const t = textos.caderno.documento;

/** Margem da página de texto, em px de referência (cerca de 2 cm). */
export const MARGEM_DOCUMENTO = 72;

/** Extensões do editor de texto da página (as mesmas do documento de texto). */
export const extensoesDocumento = extensoesBase();

/** Limpa o HTML guardado antes de mostrar fora do editor (miniaturas). */
export const htmlSeguro = (html: string) => DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ["style", "img", "iframe", "form", "input"], FORBID_ATTR: ["srcset"] });


/** A folha de texto, desenhada no tamanho real e reduzida pela escala da página. */
/**
 * Corta o texto no fim da folha: tira do editor o que passou e devolve em HTML (ou null
 * se cabe tudo). O corte é sempre entre parágrafos (ou itens de lista), nunca no meio
 * de uma frase; se nem o primeiro parágrafo cabe, ele fica e o resto vai.
 */
export function cortarNoFim(editor: Editor, folha: HTMLElement, escala: number, altura: number): string | null {
  const view = editor.view;
  const doc = editor.state.doc;
  // Ao digitar além do fim, a folha rola por dentro para seguir o cursor: volta ao topo para medir.
  folha.scrollTop = 0;
  const r = folha.getBoundingClientRect();
  const limite = r.top + (altura - MARGEM_DOCUMENTO) * escala;
  const conteudo = view.dom.getBoundingClientRect();
  if (conteudo.bottom <= limite + 2) return null;
  let pos: number | null = null;
  const achado = view.posAtCoords({ left: conteudo.left + 4, top: limite - 2 });
  if (achado) {
    const $p = doc.resolve(achado.pos);
    let d = $p.depth;
    while (d > 0 && !$p.node(d).isTextblock) d--;
    // Sobe enquanto for o primeiro filho (o item de lista inteiro vai junto).
    while (d > 1 && $p.index(d - 1) === 0) d--;
    pos = d > 0 ? $p.before(d) : null;
    // A linha do limite pode ainda caber: se o bloco termina antes do limite, corta depois dele.
    if (pos !== null) {
      const dom = view.nodeDOM(pos) as HTMLElement | null;
      if (dom?.getBoundingClientRect && dom.getBoundingClientRect().bottom <= limite + 1) pos = pos + doc.resolve(pos).nodeAfter!.nodeSize;
    }
  }
  // Nada cabe antes do corte (ou não achou): leva do segundo bloco em diante.
  if (pos === null || pos <= 1) pos = doc.childCount > 1 ? doc.child(0).nodeSize : null;
  if (pos === null || pos >= doc.content.size) return null;
  const resto = doc.slice(pos, doc.content.size);
  const caixa = document.createElement("div");
  caixa.appendChild(DOMSerializer.fromSchema(editor.schema).serializeFragment(resto.content));
  const htmlResto = caixa.innerHTML;
  if (!caixa.textContent?.trim() && !caixa.querySelector("img, table, hr")) return null;
  editor.chain().deleteRange({ from: pos, to: doc.content.size }).run();
  return htmlResto;
}

export function CamadaDocumento({ html, editavel, escala, largura, altura, slot, slotAviso, aoMudar, aoContinuar, fluir }: {
  html: string; editavel: boolean; escala: number; largura: number; altura: number;
  /** Onde a barra de formatação aparece (a barra de contexto), só na página atual. */
  slot: HTMLElement | null;
  /** Onde fica o aviso "passou do fim" (por cima do desenho, para o botão receber o toque). */
  slotAviso: HTMLElement | null;
  aoMudar: (html: string) => void;
  /** O texto passou do fim da folha: o que sobrou vai para uma página de texto nova, depois desta. */
  aoContinuar: (resto: string) => void;
  /** Leva o que passou para a página seguinte sozinho (texto que a IA criou). */
  fluir?: boolean;
}) {
  const aoMudarRef = useRef(aoMudar);
  aoMudarRef.current = aoMudar;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editor = useEditor({
    extensions: extensoesDocumento,
    content: html || "",
    editable: editavel,
    editorProps: { attributes: { class: "caderno-doc-conteudo doc-conteudo", "aria-label": t.campo, spellcheck: "true", lang: "pt-BR" } },
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
  const continuar = () => {
    const el = miolo.current;
    if (!editor || !el) return;
    const resto = cortarNoFim(editor, el, escala, altura);
    if (resto === null) { setPassou(false); return; }
    clearTimeout(timer.current);
    aoMudarRef.current(editor.getHTML());
    aoContinuar(resto);
  };
  const continuarRef = useRef(continuar);
  continuarRef.current = continuar;
  const jaFluiu = useRef(false);
  useEffect(() => {
    if (!fluir || !passou || jaFluiu.current) return;
    jaFluiu.current = true;
    // Espera as fontes e as imagens assentarem antes de medir.
    const id = setTimeout(() => continuarRef.current(), 250);
    return () => clearTimeout(id);
  }, [fluir, passou]);
  return (
    <div className={editavel ? "caderno-doc editavel" : "caderno-doc"}>
      <div ref={miolo} className="caderno-doc-folha" style={{ width: largura, height: altura, padding: MARGEM_DOCUMENTO, transform: `scale(${escala})` }}>
        <EditorContent editor={editor} />
      </div>
      {passou && !fluir && slotAviso && createPortal(
        <div className="caderno-doc-passou">
          <span>{t.passou}</span>
          <button type="button" className="botao pequeno" onPointerDown={(e) => e.stopPropagation()} onClick={continuar}>{t.continuar}</button>
        </div>, slotAviso)}
      {editor && editavel && slot && createPortal(<FitaTexto editor={editor} compacta />, slot)}
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

