import { FolderPlus, Trash2, X } from "lucide-react";
import { CampoRico } from "../componentes/CampoRico";
import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { api, type Etiqueta, type Ideia } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Escolha } from "../componentes/Escolha";
import { Janela } from "../componentes/Janela";
import { textos } from "../textos/pt-BR";
import { EscolherEtiquetas } from "./etiquetas";

const t = textos.ideias;

/**
 * Tudo de uma ideia num lugar: texto, nota, etiquetas e ligações.
 * Nada muda até apertar Salvar (exceto criar uma etiqueta nova, que fica disponível).
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
  const [ligadas, setLigadas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!ideia) return;
    setTexto(ideia.texto);
    setNota(ideia.nota);
    setMarcadas(ideia.etiquetas);
    setLigadas(ideia.ligadas);
    setErro(null);
  }, [ideia]);

  if (!ideia) return <Janela titulo={t.ideiaTitulo} aberta={false} aoFechar={aoFechar}>{null}</Janela>;

  const outras = todas.filter((i) => i.id !== ideia.id);
  const nomeDe = (id: string) => todas.find((i) => i.id === id)?.texto ?? "";

  const salvar = async () => {
    if (!texto.trim()) return;
    setOcupado(true);
    setErro(null);
    try {
      if (texto.trim() !== ideia.texto) await api.editarIdeia(ideia.id, texto);
      if (nota.trim() !== ideia.nota) await api.salvarNotaIdeia(ideia.id, nota);
      if (marcadas.join() !== ideia.etiquetas.join()) await api.definirEtiquetasItem(ideia.id, marcadas);
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
        <EscolherEtiquetas todas={etiquetas} marcadas={marcadas} aoMudar={setMarcadas} aoCriar={aoCriarEtiqueta} />

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
