import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { api, ErroOrbita, type EstadoIa, type ProvedorVisivel } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Escolha } from "../componentes/Escolha";
import { Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { textos } from "../textos/pt-BR";
import { MODELOS_PROVEDOR, modeloDe, type IdModelo } from "./provedores";

const t = textos.ia;

/** Adicionar ou editar um provedor: escolher qual, colar a chave, conferir e escolher o modelo. */
export function JanelaProvedor({
  editando,
  aberta,
  aoFechar,
  aoSalvar,
}: {
  /** null = provedor novo. */
  editando: ProvedorVisivel | null;
  aberta: boolean;
  aoFechar: () => void;
  aoSalvar: (estado: EstadoIa) => void;
}) {
  const [qual, setQual] = useState<IdModelo>("claude");
  const [nome, setNome] = useState("Claude");
  const [url, setUrl] = useState(MODELOS_PROVEDOR[0].url);
  const [chave, setChave] = useState("");
  const [modelos, setModelos] = useState<string[] | null>(null);
  const [modelo, setModelo] = useState("");
  const [memoria, setMemoria] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);

  useEffect(() => {
    if (!aberta) return;
    const m = editando ? modeloDe(editando.tipo, editando.url) : MODELOS_PROVEDOR[0];
    setQual(m.id);
    setNome(editando?.nome ?? m.nome);
    setUrl(editando?.url ?? m.url);
    setChave("");
    setModelos(editando ? [editando.modelo] : null);
    setModelo(editando?.modelo ?? "");
    setAviso(null);
  }, [aberta, editando]);

  const escolhido = MODELOS_PROVEDOR.find((m) => m.id === qual)!;

  useEffect(() => {
    if (aberta && qual === "ollama" && memoria === null) api.memoriaDoComputador().then((gb) => gb && setMemoria(Math.round(gb)), () => {});
  }, [aberta, qual, memoria]);

  const trocarQual = (id: IdModelo) => {
    const m = MODELOS_PROVEDOR.find((x) => x.id === id)!;
    setQual(id);
    setNome(m.nome);
    setUrl(m.url);
    setModelos(null);
    setModelo("");
    setAviso(null);
  };

  const provedor = () => ({ id: editando?.id ?? "", tipo: escolhido.tipo, nome: nome.trim() || escolhido.nome, url: url.trim(), modelo: modelo.trim() });
  // Ao editar sem colar chave nova, a parte nativa usa a guardada.
  const chaveParaEnviar = () => (chave.trim() ? chave.trim() : editando ? null : escolhido.precisaChave ? "" : null);

  const conferir = async () => {
    setOcupado(true);
    setAviso(null);
    try {
      const lista = await api.testarProvedorIa(provedor(), chaveParaEnviar());
      setModelos(lista);
      const preferido = lista.find((m) => m === escolhido.modeloSugerido) ?? (lista.includes(modelo) ? modelo : lista[0]) ?? "";
      setModelo(preferido);
      setAviso({ tipo: "ok", texto: lista.length ? t.conferido(lista.length) : t.semModelos });
    } catch (e) {
      setModelos(null);
      setAviso({ tipo: "erro", texto: e instanceof ErroOrbita ? e.message : String(e) });
    } finally {
      setOcupado(false);
    }
  };

  const salvar = async () => {
    if (!modelo.trim()) return setAviso({ tipo: "erro", texto: t.precisaConferir });
    setOcupado(true);
    try {
      aoSalvar(await api.salvarProvedorIa(provedor(), chave.trim() ? chave.trim() : null));
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof ErroOrbita ? e.message : String(e) });
    } finally {
      setOcupado(false);
    }
  };

  const precisaChave = escolhido.precisaChave && !(editando?.finalChave);

  return (
    <Janela titulo={editando ? t.editarTitulo(editando.nome) : t.novoTitulo} aberta={aberta} aoFechar={aoFechar}>
      <form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          if (modelos) salvar();
          else conferir();
        }}
      >
        {!editando && (
          <Segmentado<IdModelo> rotulo={t.qual} valor={qual} opcoes={MODELOS_PROVEDOR.map((m) => ({ valor: m.id, nome: m.nome }))} aoMudar={trocarQual} />
        )}
        {qual === "ollama" && (
          <div className="campo-ajuda">
            <p>{t.ollamaAjuda}</p>
            {memoria !== null && <p>{t.memoria(memoria)}</p>}
          </div>
        )}
        {qual === "outro" && <Campo rotulo={t.nome} valor={nome} aoMudar={setNome} />}
        {(qual === "outro" || qual === "ollama") && (
          <Campo rotulo={t.endereco} valor={url} aoMudar={(v) => (setUrl(v), setModelos(null))} descricao={t.enderecoAjuda} />
        )}
        {escolhido.precisaChave && (
          <Campo
            rotulo={t.chave}
            valor={chave}
            aoMudar={(v) => (setChave(v), setModelos(editando ? modelos : null))}
            secreto
            autoFocus={!!editando}
            descricao={editando?.finalChave ? t.chaveManter : escolhido.ondeChave ? t.chaveAjuda(escolhido.ondeChave) : t.chaveAjudaOutro}
          />
        )}
        <div className="botoes">
          <Button className="botao" isDisabled={ocupado || (precisaChave && !chave.trim()) || !url.trim()} onPress={conferir}>
            {ocupado && !modelos ? t.conferindo : t.conferir}
          </Button>
        </div>
        {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
        {modelos && modelos.length > 0 && (
          <Escolha rotulo={t.modelo} valor={modelo || null} opcoes={modelos.map((m) => ({ valor: m, nome: m }))} aoMudar={setModelo} descricao={t.modeloAjuda} />
        )}
        {modelos && modelos.length === 0 && <Campo rotulo={t.modeloEscrito} valor={modelo} aoMudar={setModelo} />}
        <div className="janela-acoes">
          <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
          <Button className="botao principal" isDisabled={ocupado || !modelos || !modelo.trim()} onPress={salvar}>
            {textos.comum.salvar}
          </Button>
        </div>
      </form>
    </Janela>
  );
}
