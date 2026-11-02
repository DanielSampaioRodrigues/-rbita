import { FolderPlus, Trash2, X } from "../icones";
import { CampoRico } from "../componentes/CampoRico";
import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { api, type CorEtiqueta, type Etiqueta, type Ideia, type ItemResumo } from "../api";
import { AnexosDoItem } from "../relacoes/Relacoes";
import { Aviso, Campo } from "../componentes/Campo";
import { Escolha } from "../componentes/Escolha";
import { Janela } from "../componentes/Janela";
import { textos } from "../textos/pt-BR";
import { avisarMudanca } from "../dados";
import { EscolherCorIdeia, EscolherEtiquetas } from "./etiquetas";

const t = textos.ideias;

/**
 * Tudo de uma ideia num lugar: texto, nota, etiquetas, cor e ligações.
 * Etiquetas e cor valem na hora (fechar a janela sem salvar não perde a marcação).
 * Texto, nota e ligações esperam o Salvar.
 */
export function JanelaIdeia({
  ideia,
  todas,
  etiquetas,
  aoFechar,
  aoSalvo,
  aoVirarProjeto,
  aoExcluir,
  aoCriarEtiqueta,
}: {
  ideia: Ideia | null;
  todas: Ideia[];
  etiquetas: Etiqueta[];
  aoFechar: () => void;
  aoSalvo: () => void;
  aoVirarProjeto: (i: Ideia) => void;
  aoExcluir: (i: Ideia) => void;
  aoCriarEtiqueta: (e: Etiqueta) => void;
}) {
  const [texto, setTexto] = useState("");
  const [nota, setNota] = useState("");
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [cor, setCor] = useState<CorEtiqueta | null>(null);
  // Uma gravação de cada vez, na ordem dos toques (marcar e desmarcar rápido não embaralha).
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const [ligadas, setLigadas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Projetos e tarefas ligados a esta ideia (a ligação se desfaz na página do projeto).
  const [outrosLigados, setOutrosLigados] = useState<ItemResumo[]>([]);

  useEffect(() => {
    if (!ideia) return;
    setTexto(ideia.texto);
    setNota(ideia.nota);
    setMarcadas(ideia.etiquetas);
    setCor(ideia.cor ?? null);
    setLigadas(ideia.ligadas);
    setErro(null);
    api.itensLigados(ideia.id).then((l) => setOutrosLigados(l.filter((x) => x.tipo !== "ideia")), () => setOutrosLigados([]));
  }, [ideia]);

  if (!ideia) return <Janela titulo={t.ideiaTitulo} aberta={false} aoFechar={aoFechar}>{null}</Janela>;

  const outras = todas.filter((i) => i.id !== ideia.id);
  const nomeDe = (id: string) => todas.find((i) => i.id === id)?.texto ?? "";

  const gravarNaHora = (acao: () => Promise<void>) => {
    setErro(null);
    fila.current = fila.current.then(acao).then(avisarMudanca, (e) => setErro(e instanceof Error ? e.message : String(e)));
  };
  const mudarEtiquetas = (ids: string[]) => {
    setMarcadas(ids);
    gravarNaHora(() => api.definirEtiquetasItem(ideia.id, ids));
  };
  const mudarCor = (c: CorEtiqueta | null) => {
    setCor(c);
    gravarNaHora(() => api.definirCorIdeia(ideia.id, c));
  };

  const salvar = async () => {
    if (!texto.trim()) return;
    setOcupado(true);
    setErro(null);
    try {
      if (texto.trim() !== ideia.texto) await api.editarIdeia(ideia.id, texto);
      if (nota.trim() !== ideia.nota) await api.salvarNotaIdeia(ideia.id, nota);
      await fila.current; // etiquetas e cor já gravadas na hora
      for (const o of ligadas.filter((x) => !ideia.ligadas.includes(x))) await api.ligarItens(ideia.id, o, true);
      for (const o of ideia.ligadas.filter((x) => !ligadas.includes(x))) await api.ligarItens(ideia.id, o, false);
      aoSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Janela titulo={t.ideiaTitulo} aberta aoFechar={aoFechar}>
      <div className="formulario">
        <Campo rotulo={t.texto} valor={texto} aoMudar={setTexto} autoFocus />
        <CampoRico rotulo={t.nota} valor={nota} aoMudar={setNota} descricao={t.notaAjuda} />
        <EscolherEtiquetas todas={etiquetas} marcadas={marcadas} aoMudar={mudarEtiquetas} aoCriar={aoCriarEtiqueta} ajuda={t.etiquetasNaHora} />
        <EscolherCorIdeia valor={cor} aoMudar={mudarCor} />

        <fieldset className="grupo-campos">
          <legend className="campo-rotulo">{t.ligadas}</legend>
          {ligadas.length === 0 ? (
            <p className="texto-suave pequeno">{t.nenhumaLigada}</p>
          ) : (
            <ul className="lista-ligadas">
              {ligadas.map((id) => (
                <li key={id}>
                  <span className="quebra">{nomeDe(id)}</span>
                  <Button className="botao-icone" onPress={() => setLigadas(ligadas.filter((x) => x !== id))} aria-label={t.desligar(nomeDe(id))}>
                    <X aria-hidden="true" size="1em" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {outrosLigados.length > 0 && (
            <p className="texto-suave pequeno">
              {textos.relacoes.ligacoes}: {outrosLigados.map((x) => `${textos.relacoes.tipos[x.tipo]} "${x.titulo}"`).join(", ")}
            </p>
          )}
          {outras.some((o) => !ligadas.includes(o.id)) && (
            <Escolha
              rotulo={t.ligarA}
              valor={null}
              vazio={t.escolhaIdeia}
              opcoes={outras.filter((o) => !ligadas.includes(o.id)).map((o) => ({ valor: o.id, nome: o.texto }))}
              aoMudar={(id) => setLigadas([...ligadas, id])}
            />
          )}
        </fieldset>

        <AnexosDoItem id={ideia.id} />

        <Aviso>{erro}</Aviso>
        <div className="janela-acoes">
          <Button className="botao separado com-icone" onPress={() => aoVirarProjeto(ideia)}>
            <FolderPlus aria-hidden="true" size="1em" /> {t.virarProjeto}
          </Button>
          <Button className="botao com-icone" onPress={() => aoExcluir(ideia)}>
            <Trash2 aria-hidden="true" size="1em" /> {t.excluir}
          </Button>
          <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
          <Button className="botao principal" onPress={salvar} isDisabled={ocupado || !texto.trim()}>{textos.comum.salvar}</Button>
        </div>
      </div>
    </Janela>
  );
}
