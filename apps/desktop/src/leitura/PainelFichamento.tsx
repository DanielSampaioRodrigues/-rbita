// Painel "Fichamento" do leitor: as fichas do livro (citação direta, paráfrase, resumo,
// comentário), a referência em ABNT e a exportação para Word ou texto. As fichas são
// anotações do livro (tipo "ficha"); a referência e o ano ficam no cofre de valores.
import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { api, type Anotacao, type Livro, type TipoFicha } from "../api";
import { useRecado } from "../app/Recado";
import { Campo } from "../componentes/Campo";
import { Segmentado } from "../componentes/Segmentado";
import { entregarArquivo, nomeDeArquivo } from "../exportar/entregar";
import { Copy, FileText, Pencil, Trash2, X } from "../icones";
import { textos } from "../textos/pt-BR";
import { fichamentoEmDocx, fichamentoEmTexto, formatarFicha, referenciaSugerida, type CabecalhoFichamento } from "./fichamento";

const t = textos.leitura.leitor.fichamento;
const chave = (livroId: string) => `leitura.fichamento.${livroId}`;

/** Ficha começada fora do painel (de um grifo ou de um trecho escolhido). */
export interface RascunhoFicha {
  ficha: TipoFicha;
  texto: string;
  pagina: string;
  pdfPagina: number;
  epubCfi: string;
}

export function PainelFichamento({ livro, fichas, rascunho, local, aoMudou, aoIr, aoFechar }: {
  livro: Livro;
  fichas: Anotacao[];
  rascunho: RascunhoFicha | null;
  /** Onde a pessoa está agora (para a página e o "Ir para"). */
  local: () => { pdfPagina: number; epubCfi: string };
  aoMudou: () => void;
  aoIr: (a: Anotacao) => void;
  aoFechar: () => void;
}) {
  const recado = useRecado();
  const [cab, setCab] = useState<CabecalhoFichamento>({ referencia: "", ano: "" });
  const carregado = useRef(false);
  const [editando, setEditando] = useState<Anotacao | null>(null);
  const [tipo, setTipo] = useState<TipoFicha>(rascunho?.ficha ?? "citacao");
  const [texto, setTexto] = useState(rascunho?.texto ?? "");
  const [pagina, setPagina] = useState(rascunho?.pagina ?? "");
  const [origem, setOrigem] = useState({ pdfPagina: rascunho?.pdfPagina ?? 0, epubCfi: rascunho?.epubCfi ?? "" });
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!rascunho) return;
    setEditando(null); setTipo(rascunho.ficha); setTexto(rascunho.texto); setPagina(rascunho.pagina);
    setOrigem({ pdfPagina: rascunho.pdfPagina, epubCfi: rascunho.epubCfi });
  }, [rascunho]);

  useEffect(() => {
    void api.lerValor(chave(livro.id)).then((v) => {
      const c = (v ?? {}) as Partial<CabecalhoFichamento>;
      setCab({ referencia: typeof c.referencia === "string" ? c.referencia : "", ano: typeof c.ano === "string" ? c.ano : "" });
      carregado.current = true;
    }, () => { carregado.current = true; });
  }, [livro.id]);
  // A referência e o ano são gravados logo depois de a pessoa parar de digitar.
  useEffect(() => {
    if (!carregado.current) return;
    const id = window.setTimeout(() => void api.gravarValor(chave(livro.id), cab).catch(() => {}), 600);
    return () => window.clearTimeout(id);
  }, [cab, livro.id]);

  const limpar = () => {
    setEditando(null); setTexto(""); setPagina("");
    setOrigem({ pdfPagina: 0, epubCfi: "" });
  };

  const guardar = async () => {
    if (!texto.trim()) { setErro(t.semTexto); return; }
    setErro(null);
    const l = editando ? { pdfPagina: editando.pdfPagina, epubCfi: editando.epubCfi } : (origem.pdfPagina || origem.epubCfi ? origem : local());
    try {
      await api.salvarAnotacao({
        id: editando?.id ?? "", livroId: livro.id, tipo: "ficha", epubCfi: l.epubCfi, epubCfiRange: "", pdfPagina: l.pdfPagina,
        cor: "", texto, trecho: "", pontos: [], espessura: 0, ficha: tipo, paginaRef: pagina, criadoEm: editando?.criadoEm ?? 0,
      });
      recado(editando ? t.atualizada : t.guardada);
      limpar();
      aoMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  const editar = (f: Anotacao) => {
    setEditando(f); setTipo((f.ficha || "comentario") as TipoFicha); setTexto(f.texto); setPagina(f.paginaRef ?? (f.pdfPagina ? String(f.pdfPagina) : ""));
  };
  const apagar = async (f: Anotacao) => {
    await api.excluirAnotacao(f.id);
    if (editando?.id === f.id) limpar();
    recado(t.apagada);
    aoMudou();
  };

  const exportar = async (como: "docx" | "md" | "copiar") => {
    setErro(null);
    try {
      if (como === "copiar") {
        await navigator.clipboard.writeText(fichamentoEmTexto(livro.titulo, livro.autor, cab, fichas));
        recado(t.copiado);
        return;
      }
      const nome = nomeDeArquivo(`Fichamento - ${livro.titulo || "livro"}`, como);
      const r = como === "docx"
        ? await entregarArquivo(nome, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", await fichamentoEmDocx(livro.titulo, livro.autor, cab, fichas), { nome: "Word", extensao: "docx" })
        : await entregarArquivo(nome, "text/markdown", new Blob([fichamentoEmTexto(livro.titulo, livro.autor, cab, fichas)], { type: "text/markdown;charset=utf-8" }), { nome: "Markdown", extensao: "md" });
      if (r.como !== "cancelado") recado(r.onde ? t.salvoEm(r.onde) : t.exportado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  const rotuloTexto = { citacao: t.textoCitacao, parafrase: t.textoParafrase, resumo: t.textoResumo, comentario: t.textoComentario }[tipo];

  return (
    <aside className="leitor-painel leitor-fichamento" aria-label={t.titulo}>
      <div className="leitor-painel-topo">
        <strong>{t.titulo}</strong>
        <Button className="botao-icone" onPress={aoFechar} aria-label={textos.leitura.leitor.fecharPainel}><X aria-hidden="true" size="1.1em" /></Button>
      </div>

      <details className="leitor-fichamento-ref">
        <summary>{t.referencia}</summary>
        <Campo rotulo={t.referencia} valor={cab.referencia || referenciaSugerida(livro.titulo, livro.autor, cab.ano)} aoMudar={(referencia) => setCab((c) => ({ ...c, referencia }))} multilinha semDitado descricao={t.referenciaAjuda} />
        <Campo rotulo={t.ano} valor={cab.ano} aoMudar={(ano) => setCab((c) => ({ ...c, ano }))} maximo={12} semDitado descricao={t.anoAjuda} />
      </details>

      <section className="leitor-fichamento-form" aria-label={editando ? t.editar : t.nova}>
        <Segmentado<TipoFicha> rotulo={t.tipo} valor={tipo} aoMudar={setTipo}
          opcoes={[{ valor: "citacao", nome: t.tipos.citacao }, { valor: "parafrase", nome: t.tipos.parafrase }, { valor: "resumo", nome: t.tipos.resumo }, { valor: "comentario", nome: t.tipos.comentario }]} />
        <Campo rotulo={rotuloTexto} valor={texto} aoMudar={setTexto} multilinha />
        <Campo rotulo={t.pagina} valor={pagina} aoMudar={setPagina} maximo={20} semDitado descricao={local().pdfPagina ? t.paginaAjudaPdf : t.paginaAjuda} />
        {erro && <p className="aviso aviso-erro" role="alert">{erro}</p>}
        <div className="linha-ajuste">
          {editando && <Button className="botao" onPress={limpar}>{textos.comum.cancelar}</Button>}
          <Button className="botao principal" onPress={() => void guardar()}>{editando ? t.salvarMudancas : t.guardar}</Button>
        </div>
      </section>

      {fichas.length === 0 ? <p className="texto-suave">{t.vazio}</p> : (
        <>
          <ol className="lista-simples sem-marcador leitor-fichas">
            {fichas.map((f) => {
              const x = formatarFicha(f, livro.autor, cab.ano);
              return (
                <li key={f.id} className={editando?.id === f.id ? "leitor-ficha editando" : "leitor-ficha"}>
                  <span className="texto-suave pequeno">{x.rotulo}</span>
                  <p className={x.longa ? "quebra leitor-ficha-longa" : "quebra"}>{x.texto}{x.chamada ? ` ${x.chamada}` : ""}</p>
                  <span className="linha-ajuste">
                    {(f.pdfPagina > 0 || f.epubCfi) && <Button className="botao pequeno" onPress={() => aoIr(f)}>{textos.leitura.leitor.irPara}</Button>}
                    <span>
                      <Button className="botao-icone" onPress={() => editar(f)} aria-label={`${t.editar}: ${x.rotulo}`}><Pencil aria-hidden="true" size="1em" /></Button>
                      <Button className="botao-icone" onPress={() => void apagar(f)} aria-label={`${t.apagar}: ${x.rotulo}`}><Trash2 aria-hidden="true" size="1em" /></Button>
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="leitor-fichamento-exportar">
            <span className="texto-suave pequeno">{t.exportar}</span>
            <div className="linha-ajuste">
              <Button className="botao pequeno com-icone" onPress={() => void exportar("docx")}><FileText aria-hidden="true" size="1em" /> Word</Button>
              <Button className="botao pequeno" onPress={() => void exportar("md")}>{t.texto}</Button>
              <Button className="botao pequeno com-icone" onPress={() => void exportar("copiar")}><Copy aria-hidden="true" size="1em" /> {t.copiar}</Button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
