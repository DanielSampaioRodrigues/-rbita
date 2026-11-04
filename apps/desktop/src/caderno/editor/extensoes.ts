// Extensões do editor de texto do caderno (TipTap, MIT). O mesmo conjunto serve a
// página de texto (dentro do caderno) e o documento de texto (com páginas de verdade).
import { Extension } from "@tiptap/core";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Typography } from "@tiptap/extension-typography";
import { CharacterCount } from "@tiptap/extensions";
import { StarterKit } from "@tiptap/starter-kit";
import { AtalhoCaixa, Versalete } from "./maiusculas";
import { AtalhosWord } from "./atalhosWord";
import { EspacoLetras } from "./espacoLetras";
import { EstiloLetra } from "./meusEstilos";

/** Atributos do parágrafo (e dos títulos): estilo, entrelinha e recuo. Ficam no HTML
 *  como `data-*` e `style`, para o texto guardado abrir igual em qualquer lugar. */
export const AtributosParagrafo = Extension.create({
  name: "atributosParagrafo",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          estilo: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute("data-estilo"),
            renderHTML: (a: { estilo?: string | null }) => (a.estilo ? { "data-estilo": a.estilo } : {}),
          },
          entrelinha: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
            renderHTML: (a: { entrelinha?: string | null }) => (a.entrelinha ? { style: `line-height: ${a.entrelinha}` } : {}),
          },
          // Estilo próprio da pessoa (ver meusEstilos.ts): só o id; o visual vem do CSS gerado.
          meuEstilo: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              const v = el.getAttribute("data-meu-estilo");
              return v && /^[a-z0-9-]{1,40}$/.test(v) ? v : null;
            },
            renderHTML: (a: { meuEstilo?: string | null }) => (a.meuEstilo ? { "data-meu-estilo": a.meuEstilo } : {}),
          },
          // Capitular: a primeira letra ocupa 2 a 5 linhas.
          capitular: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              const n = Number(el.getAttribute("data-capitular"));
              return n >= 2 && n <= 5 ? n : null;
            },
            renderHTML: (a: { capitular?: number | null }) => (a.capitular ? { "data-capitular": String(a.capitular) } : {}),
          },
          recuo: {
            default: 0,
            parseHTML: (el: HTMLElement) => Math.max(0, Math.min(8, Number(el.getAttribute("data-recuo")) || 0)),
            renderHTML: (a: { recuo?: number }) => (a.recuo ? { "data-recuo": String(a.recuo), style: `margin-left: ${a.recuo * 1.25}cm` } : {}),
          },
        },
      },
    ];
  },
});

/** Todas as extensões do editor (sem a paginação, que só o documento de texto usa). */
export const extensoesBase = () => [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https" }, codeBlock: false }),
  TextStyleKit,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: true } }),
  Image.configure({ allowBase64: true, resize: { enabled: true, minWidth: 40, minHeight: 40, alwaysPreserveAspectRatio: true } }),
  Subscript,
  Superscript,
  Typography,
  Details.configure({ persist: true }),
  DetailsSummary,
  DetailsContent,
  CharacterCount,
  AtributosParagrafo,
  Versalete,
  AtalhoCaixa,
  AtalhosWord,
  EspacoLetras,
  EstiloLetra,
];
