// Exporta o documento de texto para Word (.docx), com a biblioteca docx (MIT): página
// (tamanho e margens), estilo do documento (ABNT, APA...), títulos de verdade (o Word
// monta o sumário com eles), os estilos da pessoa como estilos do Word, listas,
// tabelas, imagens, links, cabeçalho, rodapé e número da página.
// Fica um pouco diferente do PDF: o Word refaz as linhas, e a capitular sai como letra
// comum. Para entregar exatamente como está na tela, o PDF é o certo.
import type { JSONContent } from "@tiptap/core";
import { CONJUNTOS, lerPt, medidaDocumento, type ConfigDocumento } from "../caderno/editor/estilos";
import type { EstiloProprio } from "../caderno/editor/meusEstilos";
import { familiasDaPilha } from "./fontesPdf";

const CM = 566.93; // twips por centímetro
const PX_EM_TWIP = 15; // 1 px (96 por polegada) = 15 twips
const SEM_HASH = (c?: string | null) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c.slice(1).toUpperCase() : undefined);
/** A primeira família real de uma pilha do CSS (o Word usa o nome). */
const fonteWord = (pilha?: string | null) => {
  const f = pilha ? familiasDaPilha(pilha).find((x) => !/^(serif|sans-serif|monospace|cursive|system-ui|-apple-system|ui-)/.test(x)) : undefined;
  return f?.replace(/ Variable$/, "");
};

/** Tamanho de uma imagem (data: URL), para pôr no Word na proporção certa. */
async function medidaDaImagem(src: string): Promise<{ w: number; h: number } | null> {
  const img = new Image();
  img.src = src;
  try { await img.decode(); return { w: img.naturalWidth, h: img.naturalHeight }; } catch { return null; }
}

export async function gerarDocx(json: JSONContent, config: ConfigDocumento, estilos: EstiloProprio[], titulo: string): Promise<Blob> {
  const d = await import("docx");
  const { AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel, ImageRun, LevelFormat, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } = d;
  type Filho = InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink> | InstanceType<typeof ImageRun>;
  type Bloco = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;

  const conj = CONJUNTOS[config.conjunto];
  const med = medidaDocumento(config.tamanho);
  const larguraUtil = med.largura * PX_EM_TWIP - (config.margens.esquerda + config.margens.direita) * CM;
  const alinhar = (a?: string | null) => (a === "center" ? AlignmentType.CENTER : a === "right" ? AlignmentType.RIGHT : a === "justify" ? AlignmentType.JUSTIFIED : a === "left" ? AlignmentType.LEFT : undefined);
  let instancia = 0;

  const runs = async (nos: JSONContent[] | undefined, base: Record<string, unknown> = {}): Promise<Filho[]> => {
    const saida: Filho[] = [];
    for (const n of nos ?? []) {
      if (n.type === "hardBreak") { saida.push(new TextRun({ text: "", break: 1 })); continue; }
      if (n.type === "image" && n.attrs?.src) { const im = await imagem(String(n.attrs.src)); if (im) saida.push(im); continue; }
      if (n.type !== "text" || !n.text) continue;
      const o: Record<string, unknown> = { ...base, text: n.text };
      let link: string | null = null;
      for (const m of n.marks ?? []) {
        if (m.type === "bold") o.bold = true;
        else if (m.type === "italic") o.italics = true;
        else if (m.type === "underline") o.underline = {};
        else if (m.type === "strike") o.strike = true;
        else if (m.type === "superscript") o.superScript = true;
        else if (m.type === "subscript") o.subScript = true;
        else if (m.type === "versalete") o.smallCaps = true;
        else if (m.type === "highlight") { const c = SEM_HASH(m.attrs?.color) ?? "FEF08A"; o.shading = { type: ShadingType.CLEAR, color: "auto", fill: c }; }
        else if (m.type === "link" && m.attrs?.href) link = String(m.attrs.href);
        else if (m.type === "estiloLetra" && m.attrs?.id && estilos.some((e) => e.letra && e.id === m.attrs?.id)) o.style = String(m.attrs.id);
        else if (m.type === "textStyle") {
          const f = fonteWord(m.attrs?.fontFamily as string | undefined);
          if (f) o.font = f;
          const pt = m.attrs?.fontSize ? lerPt(String(m.attrs.fontSize)) : 0;
          if (pt) o.size = pt * 2;
          const c = SEM_HASH(m.attrs?.color as string | undefined);
          if (c) o.color = c;
        }
      }
      if (link) saida.push(new ExternalHyperlink({ link, children: [new TextRun({ ...o, style: "Hyperlink" } as ConstructorParameters<typeof TextRun>[0])] }));
      else saida.push(new TextRun(o as ConstructorParameters<typeof TextRun>[0]));
    }
    return saida;
  };

  const imagem = async (src: string) => {
    if (!src.startsWith("data:image/")) return null;
    const tipo = /^data:image\/(png|jpe?g|gif|bmp)/i.exec(src)?.[1]?.toLowerCase();
    if (!tipo) return null;
    const m = await medidaDaImagem(src);
    if (!m) return null;
    const bytes = Uint8Array.from(atob(src.slice(src.indexOf(",") + 1)), (c) => c.charCodeAt(0));
    const maxPx = larguraUtil / PX_EM_TWIP;
    const k = Math.min(1, maxPx / m.w);
    return new ImageRun({ type: tipo === "jpeg" ? "jpg" : (tipo as "png" | "jpg" | "gif" | "bmp"), data: bytes, transformation: { width: Math.round(m.w * k), height: Math.round(m.h * k) } });
  };

  const paragrafo = async (n: JSONContent, extra: Record<string, unknown> = {}): Promise<InstanceType<typeof Paragraph>> => {
    const a = n.attrs ?? {};
    const o: Record<string, unknown> = { ...extra };
    if (n.type === "heading") {
      const nivel = Number(a.level) || 1;
      o.heading = a.estilo === "titulo" ? HeadingLevel.TITLE : [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][Math.min(3, nivel - 1)];
    }
    const al = alinhar(a.textAlign as string);
    if (al) o.alignment = al;
    if (a.entrelinha) o.spacing = { line: Math.round(240 * Number(a.entrelinha)) };
    if (a.recuo) o.indent = { left: Math.round(Number(a.recuo) * 1.25 * CM) };
    if (a.meuEstilo && estilos.some((e) => e.id === a.meuEstilo)) o.style = a.meuEstilo;
    const base: Record<string, unknown> = {};
    if (a.estilo === "subtitulo") { base.size = Math.round(conj.tamanho * 1.25 * 2); base.color = "4B5563"; }
    if (a.estilo === "legenda") { base.size = Math.round(conj.tamanho * 0.85 * 2); base.italics = true; o.alignment ??= AlignmentType.CENTER; }
    // Referência (ABNT): alinhada à esquerda, espaço simples, sem recuo, uma linha em branco depois.
    if (a.estilo === "referencia") { o.alignment = AlignmentType.LEFT; o.indent = { firstLine: 0 }; o.spacing = { line: 240, after: 240 }; }
    if (a.estilo === "destaque") o.shading = { type: ShadingType.CLEAR, color: "auto", fill: "EEF6F6" };
    o.children = await runs(n.content, base);
    return new Paragraph(o as ConstructorParameters<typeof Paragraph>[0]);
  };

  const blocos = async (nos: JSONContent[] | undefined, nivelLista = 0, lista?: { ref: string; inst: number }, extraP: Record<string, unknown> = {}): Promise<Bloco[]> => {
    const saida: Bloco[] = [];
    for (const n of nos ?? []) {
      if (n.type === "paragraph" || n.type === "heading") {
        saida.push(await paragrafo(n, { ...extraP, ...(lista ? { numbering: { reference: lista.ref, level: nivelLista, instance: lista.inst } } : {}) }));
      } else if (n.type === "blockquote") {
        // Citação longa (ABNT): recuo de 4 cm, letra menor, sem recuo da primeira linha.
        for (const f of n.content ?? []) saida.push(await paragrafo(f, { indent: { left: Math.round(4 * CM), firstLine: 0 }, spacing: { line: 240 } }));
      } else if (n.type === "bulletList" || n.type === "orderedList") {
        const ref = n.type === "bulletList" ? "marcadores" : "numeros";
        const inst = ++instancia;
        for (const item of n.content ?? []) {
          const [primeiro, ...resto] = item.content ?? [];
          if (primeiro) saida.push(...(await blocos([primeiro], nivelLista, { ref, inst })));
          // Listas dentro da lista sobem um nível.
          for (const r of resto) saida.push(...(await blocos([r], r.type === "bulletList" || r.type === "orderedList" ? nivelLista + 1 : nivelLista)));
        }
      } else if (n.type === "taskList") {
        for (const item of n.content ?? []) {
          const marcado = item.attrs?.checked === true;
          for (const f of item.content ?? []) {
            if (f.type !== "paragraph") { saida.push(...(await blocos([f], nivelLista))); continue; }
            saida.push(new Paragraph({ children: [new TextRun({ text: marcado ? "☑ " : "☐ " }), ...(await runs(f.content))], indent: { left: 360 + nivelLista * 360 } }));
          }
        }
      } else if (n.type === "table") {
        const linhas = await Promise.all((n.content ?? []).map(async (tr) => new TableRow({
          children: await Promise.all((tr.content ?? []).map(async (td) => new TableCell({
            // Na tabela, sem recuo da primeira linha e alinhado à esquerda.
            children: (await blocos(td.content, 0, undefined, { indent: { firstLine: 0 }, alignment: AlignmentType.LEFT })).filter((b): b is InstanceType<typeof Paragraph> => b instanceof Paragraph),
            columnSpan: Number(td.attrs?.colspan) || 1, rowSpan: Number(td.attrs?.rowspan) || 1,
            shading: td.type === "tableHeader" ? { type: ShadingType.CLEAR, color: "auto", fill: "F3F4F6" } : undefined,
          }))),
        })));
        if (linhas.length) saida.push(new Table({ rows: linhas, width: { size: 100, type: WidthType.PERCENTAGE } }));
        saida.push(new Paragraph({ children: [] }));
      } else if (n.type === "horizontalRule") {
        saida.push(new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "9CA3AF", space: 1 } } }));
      } else if (n.type === "image" && n.attrs?.src) {
        const im = await imagem(String(n.attrs.src));
        if (im) saida.push(new Paragraph({ children: [im], alignment: AlignmentType.CENTER }));
      } else if (n.type === "details") {
        for (const f of n.content ?? []) {
          if (f.type === "detailsSummary") saida.push(new Paragraph({ children: await runs(f.content, { bold: true }) }));
          else saida.push(...(await blocos(f.content, nivelLista)));
        }
      } else if (n.content) {
        saida.push(...(await blocos(n.content, nivelLista)));
      }
    }
    return saida;
  };

  const corpo = await blocos(json.content);
  const fonteDoc = fonteWord(conj.fonte) ?? "Calibri";
  const tamanhoDoc = conj.tamanho * 2;
  const recuo = conj.recuoPrimeira ? Math.round(conj.recuoPrimeira * CM) : 0;
  const numero = new TextRun({ children: [PageNumber.CURRENT] });
  const rodape: (InstanceType<typeof TextRun>)[] = [];
  if (config.rodape) rodape.push(new TextRun({ text: config.rodape }));
  const pe: InstanceType<typeof Paragraph>[] = [];
  if (config.numero === "baixo-centro") pe.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [...rodape, ...(rodape.length ? [new TextRun({ text: " · " })] : []), numero] }));
  else {
    if (rodape.length) pe.push(new Paragraph({ children: rodape }));
    if (config.numero === "baixo-direita") pe.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [numero] }));
  }
  const topo: InstanceType<typeof Paragraph>[] = [];
  if (config.cabecalho) topo.push(new Paragraph({ children: [new TextRun({ text: config.cabecalho })] }));
  if (config.numero === "cima-direita") topo.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT] })] }));

  const estiloWord = (e: EstiloProprio) => ({
    id: e.id, name: e.nome, basedOn: e.base === "p" ? "Normal" : `Heading${e.base.slice(1)}`, next: "Normal", quickFormat: true,
    run: {
      font: fonteWord(e.fonte), size: e.tamanho ? e.tamanho * 2 : undefined, color: SEM_HASH(e.cor), bold: e.negrito || undefined, italics: e.italico || undefined,
      underline: e.sublinhado ? {} : undefined, allCaps: e.caixa === "maiusculas" || undefined, smallCaps: e.caixa === "versalete" || undefined,
    },
    paragraph: {
      alignment: alinhar(e.alinhamento),
      spacing: { line: e.entrelinha ? Math.round(240 * e.entrelinha) : undefined, before: e.espacoAntes >= 0 ? e.espacoAntes * 20 : undefined, after: e.espacoDepois >= 0 ? e.espacoDepois * 20 : undefined },
      indent: { firstLine: e.recuoPrimeira >= 0 ? Math.round(e.recuoPrimeira * CM) : undefined, left: e.recuoEsquerda ? Math.round(e.recuoEsquerda * CM) : undefined },
    },
  });
  const titulos = [1, 2, 3].map((n) => ({
    id: `Heading${n}`, name: `Heading ${n}`, basedOn: "Normal", next: "Normal", quickFormat: true,
    run: { font: fonteWord(conj.fonteTitulos ?? conj.fonte) ?? fonteDoc, size: Math.round(conj.tamanho * (n === 1 ? 1.6 : n === 2 ? 1.3 : 1.1) * 2), bold: true, allCaps: conj.titulosMaiusculos || undefined, color: "1F2937" },
    paragraph: { spacing: { before: 240, after: 120 }, indent: { firstLine: 0 }, alignment: AlignmentType.LEFT },
  }));

  const doc = new Document({
    title: titulo, creator: "Órbita", description: "Exportado do Órbita",
    styles: {
      default: {
        document: { run: { font: fonteDoc, size: tamanhoDoc, color: "1F2937" }, paragraph: { spacing: { line: Math.round(240 * conj.entrelinha), after: Math.round(conj.espacoDepois * conj.tamanho * 20) }, indent: { firstLine: recuo }, alignment: alinhar(conj.alinhamento) } },
        title: { run: { font: fonteWord(conj.fonteTitulos ?? conj.fonte) ?? fonteDoc, size: Math.round(conj.tamanho * 2.2 * 2), bold: true, color: "1F2937" }, paragraph: { alignment: AlignmentType.CENTER } },
      },
      paragraphStyles: [...titulos, ...estilos.filter((e) => !e.letra).map(estiloWord)],
      // Estilos de letra da pessoa viram estilos de caractere do Word.
      characterStyles: estilos.filter((e) => e.letra).map((e) => ({
        id: e.id, name: e.nome, basedOn: "DefaultParagraphFont", quickFormat: true,
        run: {
          font: fonteWord(e.fonte), size: e.tamanho ? e.tamanho * 2 : undefined, color: SEM_HASH(e.cor), bold: e.negrito || undefined, italics: e.italico || undefined,
          underline: e.sublinhado ? {} : undefined, allCaps: e.caixa === "maiusculas" || undefined, smallCaps: e.caixa === "versalete" || undefined,
          shading: e.fundo ? { type: ShadingType.CLEAR, color: "auto", fill: SEM_HASH(e.fundo) } : undefined,
        },
      })),
    },
    numbering: {
      config: [
        { reference: "marcadores", levels: [0, 1, 2, 3].map((l) => ({ level: l, format: LevelFormat.BULLET, text: ["•", "◦", "▪", "•"][l], alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 + l * 360, hanging: 360 } } } })) },
        { reference: "numeros", levels: [0, 1, 2, 3].map((l) => ({ level: l, format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN, LevelFormat.DECIMAL][l], text: `%${l + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 + l * 360, hanging: 360 } } } })) },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: Math.round(med.largura * PX_EM_TWIP), height: Math.round(med.altura * PX_EM_TWIP) },
          margin: { top: Math.round(config.margens.topo * CM), bottom: Math.round(config.margens.baixo * CM), left: Math.round(config.margens.esquerda * CM), right: Math.round(config.margens.direita * CM), header: Math.round(1.25 * CM), footer: Math.round(1.25 * CM) },
        },
      },
      headers: topo.length ? { default: new Header({ children: topo }) } : undefined,
      footers: pe.length ? { default: new Footer({ children: pe }) } : undefined,
      children: corpo,
    }],
  });
  return Packer.toBlob(doc);
}
