// Janela "Referência" (aba Inserir): busca pelo DOI ou ISBN, ou preenche à mão, e
// mostra a referência pronta na norma escolhida (ABNT, APA ou Vancouver). Insere a
// referência e/ou a citação no texto onde está o cursor.
import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { Aviso } from "../../componentes/Campo";
import { Janela } from "../../componentes/Janela";
import { Segmentado } from "../../componentes/Segmentado";
import { textos } from "../../textos/pt-BR";
import { autoresEmTexto, buscarReferencia, citacaoNoTexto, formatarReferencia, lerAutores, type Norma, type Referencia, type TipoReferencia } from "./referencias";

const t = textos.caderno.editor.referencia;
const VAZIA: Referencia = { tipo: "book", autores: [], titulo: "", ano: "" };

export function JanelaReferencia({ editor, aberta, aoFechar, normaInicial }: { editor: Editor; aberta: boolean; aoFechar: () => void; normaInicial: Norma }) {
  const [norma, setNorma] = useState<Norma>(normaInicial);
  const [r, setR] = useState<Referencia>(VAZIA);
  const [autores, setAutores] = useState("");
  const [id, setId] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [previa, setPrevia] = useState<{ html: string; citacao: string } | null>(null);
  useEffect(() => { if (aberta) setNorma(normaInicial); }, [aberta, normaInicial]);
  const atual: Referencia = { ...r, autores: lerAutores(autores) };
  const pronta = !!atual.titulo.trim() && (atual.autores.length > 0 || atual.tipo === "webpage");
  // Prévia ao vivo (um instante depois de parar de digitar).
  useEffect(() => {
    if (!aberta || !pronta) { setPrevia(null); return; }
    let vivo = true;
    const tempo = setTimeout(() => {
      void Promise.all([formatarReferencia(atual, norma), citacaoNoTexto(atual, norma)])
        .then(([f, c]) => { if (vivo) setPrevia({ html: f.html, citacao: c }); }, () => { if (vivo) setPrevia(null); });
    }, 250);
    return () => { vivo = false; clearTimeout(tempo); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, norma, JSON.stringify(atual), pronta]);
  const mudar = (p: Partial<Referencia>) => setR((x) => ({ ...x, ...p }));
  const buscar = async () => {
    setErro(null); setBuscando(true);
    try {
      const achada = await buscarReferencia(id);
      if (!achada) { setErro(t.naoAchou); return; }
      setR(achada); setAutores(autoresEmTexto(achada.autores));
    } catch {
      setErro(t.naoAchou);
    } finally {
      setBuscando(false);
    }
  };
  const inserir = (html: string) => { editor.chain().focus().insertContent(html).run(); };
  const campo = (k: keyof Referencia, rotulo: string, tipo = "text") => (
    <label className="campo estilo-campo">
      <span className="campo-rotulo">{rotulo}</span>
      <input className="entrada-texto" type={tipo} value={(r[k] as string | undefined) ?? ""} onChange={(e) => mudar({ [k]: e.target.value } as Partial<Referencia>)} />
    </label>
  );
  const fechar = () => { aoFechar(); setErro(null); };
  return (
    <Janela titulo={t.titulo} aberta={aberta} aoFechar={fechar} larga>
      <div className="estilo-janela">
        <Segmentado rotulo={t.norma} valor={norma} aoMudar={(v) => setNorma(v as Norma)} opcoes={[{ valor: "abnt", nome: "ABNT" }, { valor: "apa", nome: "APA" }, { valor: "vancouver", nome: "Vancouver" }]} />
        <form className="painel-ia-linha" onSubmit={(e) => { e.preventDefault(); void buscar(); }}>
          <label className="campo estilo-campo referencia-busca">
            <span className="campo-rotulo">{t.buscar}</span>
            <input className="entrada-texto" value={id} onChange={(e) => setId(e.target.value)} placeholder={t.buscarExemplo} />
          </label>
          <Button type="submit" className="botao" isDisabled={!id.trim() || buscando}>{buscando ? t.buscando : t.buscarBotao}</Button>
        </form>
        <p className="campo-ajuda">{t.buscarAjuda}</p>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="estilo-grade">
          <label className="campo estilo-campo">
            <span className="campo-rotulo">{t.tipo}</span>
            <select className="entrada-texto sozinha" value={r.tipo} onChange={(e) => mudar({ tipo: e.target.value as TipoReferencia })}>
              {(Object.keys(t.tipos) as TipoReferencia[]).map((k) => <option key={k} value={k}>{t.tipos[k]}</option>)}
            </select>
          </label>
          {campo("ano", t.ano)}
          {campo("titulo", t.tituloObra)}
          {r.tipo === "article-journal" || r.tipo === "chapter" ? campo("container", r.tipo === "chapter" ? t.livro : t.revista) : null}
          {r.tipo === "article-journal" ? <>{campo("volume", t.volume)}{campo("numero", t.numero)}</> : null}
          {r.tipo !== "webpage" ? <>{campo("editora", t.editora)}{campo("local", t.local)}</> : null}
          {r.tipo === "book" ? campo("edicao", t.edicao) : null}
          {r.tipo !== "book" ? campo("paginas", t.paginas) : null}
          {campo("url", t.url)}
          {r.tipo === "webpage" ? campo("acesso", t.acesso, "date") : null}
        </div>
        <label className="campo">
          <span className="campo-rotulo">{t.autores}</span>
          <textarea className="entrada-texto" rows={3} value={autores} onChange={(e) => setAutores(e.target.value)} placeholder={t.autoresExemplo} />
          <span className="campo-ajuda">{t.autoresAjuda}</span>
        </label>
        {previa && (
          <div className="campo">
            <span className="campo-rotulo">{t.previa}</span>
            <div className="estilo-previa doc-conteudo"><p data-estilo="referencia" dangerouslySetInnerHTML={{ __html: previa.html }} /></div>
            <p className="texto-suave pequeno">{t.citacaoFica(previa.citacao)}</p>
          </div>
        )}
        <div className="janela-acoes">
          <Button className="botao" onPress={fechar}>{textos.comum.fechar}</Button>
          <Button className="botao" isDisabled={!previa} onPress={() => { if (previa) inserir(previa.citacao); }}>{t.inserirCitacao}</Button>
          <Button className="botao principal" isDisabled={!previa} onPress={() => { if (previa) { inserir(`<p data-estilo="referencia">${previa.html}</p>`); fechar(); } }}>{t.inserirReferencia}</Button>
        </div>
      </div>
    </Janela>
  );
}
