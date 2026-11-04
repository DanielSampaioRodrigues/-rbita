// Documento de texto (modo "documento" da estante): um editor no estilo do Word e do
// Pages, com páginas de verdade (o texto passa sozinho para a página seguinte),
// estilos, cabeçalho, rodapé e número de página. O texto fica na cena da primeira
// página (`cena.documento`) e a configuração da página na folha dela
// (`papel.documento`), sem mudar o banco.
import { lerCena, serializarCena, type Cena } from "@orbita/caderno";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { PaginationPlus } from "tiptap-pagination-plus";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { api, type Caderno, type PaginaCaderno } from "../api";
import { Aviso } from "../componentes/Campo";
import { useEntrarImersivo } from "../app/Imersivo";
import { ChevronLeft, FileText, Minus, Plus } from "../icones";
import { textos } from "../textos/pt-BR";
import { FitaTexto } from "./editor/Fita";
import { cabecalhoRodape, cm, CONJUNTOS, lerConfigDocumento, medidaDocumento, varsDoConjunto, type ConfigDocumento } from "./editor/estilos";
import { extensoesBase } from "./editor/extensoes";
import { useTemaCaderno } from "./temaCaderno";

const t = textos.caderno;
const te = t.editor;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Lê uma cor do tema (para o espaço entre as páginas). */
const corDoTema = (nome: string, padrao: string) => {
  try { return getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || padrao; } catch { return padrao; }
};

function EditorPaginado({ html, config, aoMudar, aoEditor }: { html: string; config: ConfigDocumento; aoMudar: (html: string) => void; aoEditor: (e: Editor | null) => void }) {
  const med = medidaDocumento(config.tamanho);
  const cr = cabecalhoRodape(config);
  const aoMudarRef = useRef(aoMudar);
  aoMudarRef.current = aoMudar;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editor = useEditor({
    extensions: [
      ...extensoesBase(),
      PaginationPlus.configure({
        pageHeight: med.altura, pageWidth: med.largura, pageGap: 40, pageGapBorderSize: 0,
        pageBreakBackground: corDoTema("--cor-fundo", "#f3f1ec"),
        marginTop: cm(config.margens.topo) - 24, marginBottom: cm(config.margens.baixo) - 24,
        marginLeft: cm(config.margens.esquerda), marginRight: cm(config.margens.direita),
        contentMarginTop: 24, contentMarginBottom: 24,
        ...cr,
      }),
    ],
    content: html || "",
    editorProps: { attributes: { class: "doc-conteudo", "aria-label": te.documentoTitulo, spellcheck: "true", lang: "pt-BR" } },
    onUpdate: ({ editor: e }) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => aoMudarRef.current(e.getHTML()), 500);
    },
  });
  useEffect(() => { aoEditor(editor); }, [editor, aoEditor]);
  useEffect(() => () => {
    clearTimeout(timer.current);
    if (editor && !editor.isDestroyed) aoMudarRef.current(editor.getHTML());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);
  return <EditorContent editor={editor} />;
}

export function DocumentoAberto({ caderno, aoFechar }: { caderno: Caderno; aoFechar: () => void }) {
  useEntrarImersivo();
  const temaCaderno = useTemaCaderno();
  const [pagina, setPagina] = useState<PaginaCaderno | null>(null);
  const [cena, setCena] = useState<Cena | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [zoom, setZoom] = useState(() => {
    try { const z = Number(localStorage.getItem("documento-zoom")); return z >= 0.5 && z <= 2 ? z : 1; } catch { return 1; }
  });
  const mudarZoom = (z: number) => { const n = Math.min(2, Math.max(0.5, Math.round(z * 10) / 10)); setZoom(n); try { localStorage.setItem("documento-zoom", String(n)); } catch { /* ignora */ } };
  const [editor, setEditor] = useState<Editor | null>(null);
  // O texto mais recente (o editor é refeito quando a página muda de tamanho ou margem).
  const htmlRef = useRef("");

  // Carrega a primeira página (a do texto). Documentos da 0.50 com várias páginas de
  // texto: o texto de todas é juntado na primeira, uma vez, na ordem.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const pgs = await api.listarPaginasCaderno(caderno.id);
        if (!pgs.length || !vivo) return;
        const cenas = await Promise.all(pgs.map((p) => api.carregarCenaCaderno(p.id).then(lerCena)));
        let c = cenas[0];
        const extras = cenas.slice(1).map((x) => x.documento ?? "").filter(Boolean);
        if (extras.length) {
          c = { ...c, documento: [c.documento ?? "", ...extras].join("") };
          await api.salvarCenaCaderno(pgs[0].id, serializarCena(c));
          for (let i = 1; i < pgs.length; i++) if (cenas[i].documento) await api.salvarCenaCaderno(pgs[i].id, serializarCena({ ...cenas[i], documento: "" }));
        }
        if (!vivo) return;
        htmlRef.current = c.documento ?? "";
        setPagina(pgs[0]);
        setCena(c);
      } catch (e) {
        setErro(mensagem(e));
      }
    })();
    return () => { vivo = false; };
  }, [caderno.id]);

  const config = useMemo(() => lerConfigDocumento((pagina?.papel as { documento?: unknown } | null)?.documento), [pagina]);
  const guardarTexto = (html: string) => {
    htmlRef.current = html;
    if (!pagina || !cena) return;
    const nova = { ...cena, documento: html };
    setCena(nova);
    void api.salvarCenaCaderno(pagina.id, serializarCena(nova)).catch((e) => setErro(mensagem(e)));
  };
  // Cabeçalho e rodapé mudam a cada letra: espera um pouco antes de refazer as páginas.
  const timerConfig = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [configTela, setConfigTela] = useState<ConfigDocumento | null>(null);
  const mudarConfig = (c: ConfigDocumento) => {
    if (!pagina) return;
    if (editor && !editor.isDestroyed) htmlRef.current = editor.getHTML();
    setConfigTela(c);
    clearTimeout(timerConfig.current);
    timerConfig.current = setTimeout(() => {
      const nova = { ...pagina, papel: { ...((pagina.papel as object) ?? {}), texto: true, documento: c } };
      setPagina(nova);
      setConfigTela(null);
      void api.salvarPaginaCaderno(nova).catch((e) => setErro(mensagem(e)));
    }, 600);
  };
  const vista = configTela ?? config;
  const vars = varsDoConjunto(CONJUNTOS[config.conjunto]) as React.CSSProperties;
  // O editor é refeito só quando a página muda de verdade (tamanho, margens, cabeçalho...).
  const chave = JSON.stringify(config);

  return (
    <div className="documento-tela" style={temaCaderno.estilo}>
      <div className="leitor-barra caderno-barra-topo">
        <Button className="botao-icone" onPress={aoFechar} aria-label={t.voltarEstante}><ChevronLeft aria-hidden="true" size="1.2em" /></Button>
        <strong className="leitor-titulo quebra"><FileText aria-hidden="true" size="1em" /> {caderno.nome}</strong>
        <span className="linha-ajuste">
          <Button className="botao-icone" onPress={() => mudarZoom(zoom - 0.1)} aria-label={te.zoomMenos} isDisabled={zoom <= 0.5}><Minus aria-hidden="true" size="1.1em" /></Button>
          <Button className="botao pequeno caderno-zoom" onPress={() => mudarZoom(1)} aria-label={t.zoom.voltar(Math.round(zoom * 100))}>{Math.round(zoom * 100)}%</Button>
          <Button className="botao-icone" onPress={() => mudarZoom(zoom + 0.1)} aria-label={te.zoomMais} isDisabled={zoom >= 2}><Plus aria-hidden="true" size="1.1em" /></Button>
        </span>
      </div>
      {editor && <div className="documento-fita"><FitaTexto editor={editor} config={vista} aoConfig={mudarConfig} /></div>}
      {erro && <div className="leitor-aviso"><Aviso>{erro}</Aviso></div>}
      <div className="documento-rolagem">
        <div className="documento-folhas" style={{ ...vars, zoom }}>
          {cena && pagina && <EditorPaginado key={chave} html={htmlRef.current} config={config} aoMudar={guardarTexto} aoEditor={setEditor} />}
        </div>
      </div>
    </div>
  );
}
