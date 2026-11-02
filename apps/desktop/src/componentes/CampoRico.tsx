import { Highlight } from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Highlighter,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  Underline,
  Undo2,
} from "../icones";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Form, Toolbar, ToggleButton } from "react-aria-components";
import { useDitar } from "../ditado/Ditar";
import { useReescrever } from "../ia/Reescrever";
import { textos } from "../textos/pt-BR";
import { Janela } from "./Janela";

const t = textos.rico;

/** Extensões do editor. Links nunca abrem ao clicar (o Órbita não navega para fora). */
export const extensoesTexto = (placeholder?: string) => [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
    code: false,
    codeBlock: false,
  }),
  Highlight,
  TaskList,
  TaskItem.configure({ nested: true }),
  Markdown,
  ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
];

interface Props {
  rotulo: string;
  /** Texto em Markdown. */
  valor: string;
  aoMudar: (markdown: string) => void;
  descricao?: string;
  autoFocus?: boolean;
  placeholder?: string;
  /** Esconde o rótulo da vista (continua para leitor de tela), quando um título já diz o mesmo. */
  rotuloOculto?: boolean;
}

/**
 * Caixa de texto com formatação (negrito, títulos, listas, tarefas, citação,
 * link, destaque), guardada em Markdown, um formato aberto. Atalhos de
 * teclado de sempre (Ctrl + B, Ctrl + I, Ctrl + U, Ctrl + Z), microfone e IA.
 */
export function CampoRico({ rotulo, valor, aoMudar, descricao, autoFocus, placeholder, rotuloOculto }: Props) {
  const id = useId();
  const ultimo = useRef(valor);
  const editor = useEditor({
    extensions: extensoesTexto(placeholder),
    content: valor,
    contentType: "markdown",
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: { class: "rico-conteudo", "aria-labelledby": `${id}-rotulo`, "aria-describedby": descricao ? `${id}-ajuda` : "", "aria-multiline": "true", role: "textbox" },
    },
    onUpdate: ({ editor: e }) => {
      const md = e.getMarkdown();
      ultimo.current = md;
      aoMudar(md);
    },
  });

  // O valor pode mudar por fora (ditado, IA, desfazer): o editor acompanha.
  useEffect(() => {
    if (editor && valor !== ultimo.current) {
      ultimo.current = valor;
      editor.commands.setContent(valor, { contentType: "markdown", emitUpdate: false });
    }
  }, [valor, editor]);

  const ativo = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            negrito: e.isActive("bold"),
            italico: e.isActive("italic"),
            sublinhado: e.isActive("underline"),
            destaque: e.isActive("highlight"),
            titulo: e.isActive("heading"),
            lista: e.isActive("bulletList"),
            numerada: e.isActive("orderedList"),
            tarefas: e.isActive("taskList"),
            citacao: e.isActive("blockquote"),
            link: e.isActive("link"),
            podeDesfazer: e.can().undo(),
            podeRefazer: e.can().redo(),
          }
        : null,
  });

  const focar = () => editor?.commands.focus();
  const ditar = useDitar(valor, aoMudar, true);
  const reescrever = useReescrever(valor, aoMudar, true, focar);
  const [link, setLink] = useState<string | null>(null);

  if (!editor || !ativo) return null;
  const cadeia = () => editor.chain().focus();

  const alternar = (rotuloBotao: string, Icone: typeof Bold, ligado: boolean, acao: () => void, atalho?: string) => (
    <ToggleButton className="rico-botao" isSelected={ligado} onChange={acao} aria-label={atalho ? `${rotuloBotao} (${atalho})` : rotuloBotao}>
      <Icone aria-hidden="true" size="1.05em" />
    </ToggleButton>
  );

  return (
    <div className="campo rico" onKeyDown={(e) => ditar.aoTeclar(e)}>
      <span className={rotuloOculto ? "visualmente-oculto" : "campo-rotulo"} id={`${id}-rotulo`}>{rotulo}</span>
      <div className="rico-caixa">
        <Toolbar className="rico-barra" aria-label={t.barra(rotulo)}>
          {alternar(t.negrito, Bold, ativo.negrito, () => cadeia().toggleBold().run(), "Ctrl + B")}
          {alternar(t.italico, Italic, ativo.italico, () => cadeia().toggleItalic().run(), "Ctrl + I")}
          {alternar(t.sublinhado, Underline, ativo.sublinhado, () => cadeia().toggleUnderline().run(), "Ctrl + U")}
          {alternar(t.destaque, Highlighter, ativo.destaque, () => cadeia().toggleHighlight().run())}
          <span className="rico-separador" aria-hidden="true" />
          {alternar(t.titulo, Heading2, ativo.titulo, () => cadeia().toggleHeading({ level: 2 }).run())}
          {alternar(t.lista, List, ativo.lista, () => cadeia().toggleBulletList().run())}
          {alternar(t.numerada, ListOrdered, ativo.numerada, () => cadeia().toggleOrderedList().run())}
          {alternar(t.tarefas, ListChecks, ativo.tarefas, () => cadeia().toggleTaskList().run())}
          {alternar(t.citacao, Quote, ativo.citacao, () => cadeia().toggleBlockquote().run())}
          {alternar(t.link, Link2, ativo.link, () => (ativo.link ? cadeia().unsetLink().run() : setLink(editor.getAttributes("link").href ?? "")))}
          <span className="rico-separador" aria-hidden="true" />
          <Button className="rico-botao" onPress={() => cadeia().undo().run()} isDisabled={!ativo.podeDesfazer} aria-label={`${t.desfazer} (Ctrl + Z)`}>
            <Undo2 aria-hidden="true" size="1.05em" />
          </Button>
          <Button className="rico-botao" onPress={() => cadeia().redo().run()} isDisabled={!ativo.podeRefazer} aria-label={`${t.refazer} (Ctrl + Y)`}>
            <Redo2 aria-hidden="true" size="1.05em" />
          </Button>
          <span className="rico-espaco" />
          {reescrever.botao}
          {ditar.botao}
        </Toolbar>
        <EditorContent editor={editor} />
      </div>
      {descricao && <span className="campo-ajuda" id={`${id}-ajuda`}>{descricao}</span>}
      {ditar.situacao}
      {reescrever.janelas}
      <Janela titulo={t.linkTitulo} aberta={link !== null} aoFechar={() => (setLink(null), focar())} pequena>
        <Form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault();
            const endereco = (link ?? "").trim();
            if (endereco) cadeia().extendMarkRange("link").setLink({ href: /^[a-z]+:/i.test(endereco) ? endereco : `https://${endereco}` }).run();
            setLink(null);
          }}
        >
          <label className="campo">
            <span className="campo-rotulo">{t.endereco}</span>
            <input className="entrada-texto sozinha" value={link ?? ""} onChange={(e) => setLink(e.target.value)} autoFocus placeholder="https://" />
            <span className="campo-ajuda">{t.linkAjuda}</span>
          </label>
          <div className="janela-acoes">
            <Button className="botao" onPress={() => (setLink(null), focar())}>{textos.comum.cancelar}</Button>
            <Button className="botao principal" type="submit" isDisabled={!link?.trim()}>{t.colocarLink}</Button>
          </div>
        </Form>
      </Janela>
    </div>
  );
}
