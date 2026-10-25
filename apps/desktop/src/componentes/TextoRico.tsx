import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { extensoesTexto } from "./CampoRico";

/** Mostra um texto em Markdown já formatado, só para ler. */
export function TextoRico({ markdown, className }: { markdown: string; className?: string }) {
  const editor = useEditor({
    extensions: extensoesTexto(),
    content: markdown,
    contentType: "markdown",
    editable: false,
    // Só para ler: sem papel de caixa de texto (o leitor de tela lê como texto comum).
    editorProps: { attributes: { class: `texto-rico ${className ?? ""}`, role: "document" } },
  });
  useEffect(() => {
    if (editor && editor.getMarkdown() !== markdown) editor.commands.setContent(markdown, { contentType: "markdown", emitUpdate: false });
  }, [markdown, editor]);
  return <EditorContent editor={editor} />;
}
