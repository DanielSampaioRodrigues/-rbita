// Página de texto: um editor no estilo do Pages ou do Word dentro da folha, com
// títulos, fontes, cores, listas, tabelas e alinhamento. O desenho à mão fica por
// cima (escreve-se com a caneta sobre o texto, como num papel impresso). O texto
// é guardado em HTML na cena da página (`cena.documento`).
import { EditorContent, useEditor } from "@tiptap/react";
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

