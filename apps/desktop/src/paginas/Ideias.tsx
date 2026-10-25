import { FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type Ideia } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { avisarMudanca, useMudancas } from "../dados";
import { useComLimite } from "../projetos/Limite";
import { formatoData } from "../projetos/OndeParei";
import { textos } from "../textos/pt-BR";

const t = textos.ideias;

export function Ideias() {
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [nova, setNova] = useState("");
  const [editando, setEditando] = useState<Ideia | null>(null);
  const [excluindo, setExcluindo] = useState<Ideia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();
  const recado = useRecado();
  const comLimite = useComLimite();

  useEffect(() => {
    api.listarIdeias().then(setIdeias, (e) => setErro(String(e?.message ?? e)));
  }, [mudancas]);

  const executar = async (acao: () => Promise<void>) => {
    setErro(null);
    try {
      await acao();
      avisarMudanca();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  const virarProjeto = (ideia: Ideia) =>
    executar(() =>
      comLimite(
        async () => (await api.ideiaParaProjeto(ideia.id, true), recado(t.virouProjeto(ideia.texto))),
        async () => (await api.ideiaParaProjeto(ideia.id, false), recado(t.virouProjeto(ideia.texto))),
      ),
    );

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <Form className="linha-campo largura-leitura" onSubmit={(e) => (e.preventDefault(), nova.trim() && executar(async () => (await api.criarIdeia(nova), setNova(""))))}>
        <Campo rotulo={textos.captura.campo} valor={nova} aoMudar={setNova} />
        <Button className="botao principal" type="submit" isDisabled={!nova.trim()}>{textos.captura.guardar}</Button>
      </Form>
      <Aviso>{erro}</Aviso>

      {ideias.length === 0 ? (
        <p className="texto-suave">{t.vazio}</p>
      ) : (
        <ul className="lista-cartoes largura-leitura">
          {ideias.map((i) => (
            <li key={i.id} className="cartao compacto">
              <p className="quebra">{i.texto}</p>
              <div className="linha-ajuste">
                <span className="texto-suave pequeno">{t.guardadaEm(formatoData.format(i.criadoEm))}</span>
                <div className="botoes">
                  <Button className="botao" onPress={() => virarProjeto(i)}>
                    <FolderPlus aria-hidden="true" size="1.1em" /> {t.virarProjeto}
                  </Button>
                  <Button className="botao-icone" aria-label={`${t.editar}: ${i.texto}`} onPress={() => setEditando(i)}>
                    <Pencil aria-hidden="true" size="1.1em" />
                  </Button>
                  <Button className="botao-icone" aria-label={`${t.excluir}: ${i.texto}`} onPress={() => setExcluindo(i)}>
                    <Trash2 aria-hidden="true" size="1.1em" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Janela titulo={t.editarTitulo} aberta={!!editando} aoFechar={() => setEditando(null)}>
        {editando && (
          <EditarTexto
            inicial={editando.texto}
            rotulo={textos.captura.campo}
            aoCancelar={() => setEditando(null)}
            aoSalvar={(texto) => executar(async () => (await api.editarIdeia(editando.id, texto), setEditando(null)))}
          />
        )}
      </Janela>
      <Confirmar
        titulo={t.excluirTitulo}
        texto={t.excluirTexto}
        confirmar={t.excluir}
        aberta={!!excluindo}
        aoCancelar={() => setExcluindo(null)}
        aoConfirmar={() => excluindo && executar(async () => (await api.excluirItem(excluindo.id), setExcluindo(null)))}
      />
    </div>
  );
}

/** Formulário de um campo só, para editar um texto. */
export function EditarTexto({ inicial, rotulo, aoCancelar, aoSalvar }: { inicial: string; rotulo: string; aoCancelar: () => void; aoSalvar: (t: string) => void }) {
  const [texto, setTexto] = useState(inicial);
  return (
    <Form className="formulario" onSubmit={(e) => (e.preventDefault(), texto.trim() && aoSalvar(texto))}>
      <Campo rotulo={rotulo} valor={texto} aoMudar={setTexto} autoFocus />
      <div className="janela-acoes">
        <Button className="botao" onPress={aoCancelar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!texto.trim()}>{textos.comum.salvar}</Button>
      </div>
    </Form>
  );
}
