import { Tags, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Form, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { api, type CorEtiqueta, type Etiqueta, type Ideia } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { avisarMudanca, useMudancas } from "../dados";
import { EscolherCor, ChipEtiqueta } from "../ideias/etiquetas";
import { JanelaIdeia } from "../ideias/JanelaIdeia";
import { ListaIdeias, MapaIdeias, MuralIdeias, QuadroIdeias, VISOES_IDEIAS, type VisaoIdeias } from "../ideias/Visoes";
import { useComLimite } from "../projetos/Limite";
import { textos } from "../textos/pt-BR";

const t = textos.ideias;
const CHAVE_VISAO = "orbita.visao-ideias";

function visaoSalva(): VisaoIdeias {
  try {
    const v = localStorage.getItem(CHAVE_VISAO) as VisaoIdeias | null;
    return v && VISOES_IDEIAS.includes(v) ? v : "lista";
  } catch {
    return "lista";
  }
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Ideias() {
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [nova, setNova] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string | null>(null);
  const [visao, setVisao] = useState<VisaoIdeias>(visaoSalva);
  const [aberta, setAberta] = useState<Ideia | null>(null);
  const [excluindo, setExcluindo] = useState<Ideia | null>(null);
  const [gerenciando, setGerenciando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();
  const recado = useRecado();
  const comLimite = useComLimite();

  useEffect(() => {
    Promise.all([api.listarIdeias(), api.listarEtiquetas()]).then(
      ([i, e]) => (setIdeias(i), setEtiquetas(e)),
      (e) => setErro(String(e?.message ?? e)),
    );
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
        async () => (await api.ideiaParaProjeto(ideia.id, true), setAberta(null), recado(t.virouProjeto(ideia.texto))),
        async () => (await api.ideiaParaProjeto(ideia.id, false), setAberta(null), recado(t.virouProjeto(ideia.texto))),
      ),
    );

  const trocarVisao = (v: VisaoIdeias) => {
    setVisao(v);
    try {
      localStorage.setItem(CHAVE_VISAO, v);
    } catch {
      // Sem armazenamento: só não lembra a escolha.
    }
  };

  // A busca olha o texto, a nota e o nome das etiquetas, sem ligar para acentos.
  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return ideias.filter((i) => {
      if (filtro && !i.etiquetas.includes(filtro)) return false;
      if (!termo) return true;
      const nomes = i.etiquetas.map((id) => etiquetas.find((e) => e.id === id)?.nome ?? "").join(" ");
      return semAcento(`${i.texto} ${i.nota} ${nomes}`).includes(termo);
    });
  }, [ideias, etiquetas, busca, filtro]);

  const propsVisao = { ideias: visiveis, etiquetas, aoAbrir: setAberta };

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
        <>
          <div className="barra-ideias">
            <div className="barra-ideias-busca">
              <Campo rotulo={t.buscar} valor={busca} aoMudar={setBusca} semDitado />
            </div>
            <ToggleButtonGroup
              aria-label={t.visualizacao}
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[visao]}
              onSelectionChange={(k) => trocarVisao([...k][0] as VisaoIdeias)}
              className="segmentado"
            >
              {VISOES_IDEIAS.map((v) => (
                <ToggleButton key={v} id={v} className="segmentado-opcao">{t.visoes[v]}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>

          <div className="filtro-etiquetas" role="group" aria-label={t.filtrar}>
            <ToggleButton className="etiqueta-alternar" isSelected={filtro === null} onChange={() => setFiltro(null)}>{t.todas}</ToggleButton>
            {etiquetas.map((e) => (
              <ToggleButton key={e.id} className="etiqueta-alternar" isSelected={filtro === e.id} onChange={(sim) => setFiltro(sim ? e.id : null)}>
                <ChipEtiqueta etiqueta={e} />
              </ToggleButton>
            ))}
            <Button className="botao pequeno com-icone" onPress={() => setGerenciando(true)}>
              <Tags aria-hidden="true" size="1em" /> {t.gerenciarEtiquetas}
            </Button>
          </div>

          <p className="texto-suave pequeno" role="status">{t.contagem(visiveis.length, ideias.length)}</p>

          {visiveis.length === 0 ? (
            <p className="texto-suave">
              {t.nenhumaEncontrada}{" "}
              <Button className="link" onPress={() => (setBusca(""), setFiltro(null))}>{t.limparFiltro}</Button>
            </p>
          ) : visao === "mural" ? (
            <MuralIdeias {...propsVisao} />
          ) : visao === "quadro" ? (
            <QuadroIdeias {...propsVisao} />
          ) : visao === "mapa" ? (
            <MapaIdeias {...propsVisao} />
          ) : (
            <ListaIdeias {...propsVisao} />
          )}
        </>
      )}

      <JanelaIdeia
        ideia={aberta}
        todas={ideias}
        etiquetas={etiquetas}
        aoFechar={() => setAberta(null)}
        aoSalvo={() => (setAberta(null), avisarMudanca(), recado(t.salvo))}
        aoVirarProjeto={virarProjeto}
        aoExcluir={(i) => (setAberta(null), setExcluindo(i))}
        aoCriarEtiqueta={(e) => setEtiquetas((lista) => (lista.some((x) => x.id === e.id) ? lista : [...lista, e]))}
      />
      <Confirmar
        titulo={t.excluirTitulo}
        texto={t.excluirTexto}
        confirmar={t.excluir}
        aberta={!!excluindo}
        aoCancelar={() => setExcluindo(null)}
        aoConfirmar={() => excluindo && executar(async () => (await api.excluirItem(excluindo.id), setExcluindo(null)))}
      />
      <GerenciarEtiquetas aberta={gerenciando} etiquetas={etiquetas} aoFechar={() => setGerenciando(false)} executar={executar} />
    </div>
  );
}

/** Mudar nome e cor das etiquetas, ou excluir. */
function GerenciarEtiquetas({
  aberta,
  etiquetas,
  aoFechar,
  executar,
}: {
  aberta: boolean;
  etiquetas: Etiqueta[];
  aoFechar: () => void;
  executar: (acao: () => Promise<void>) => void;
}) {
  const [editando, setEditando] = useState<{ id: string; nome: string; cor: CorEtiqueta } | null>(null);
  const [excluindo, setExcluindo] = useState<Etiqueta | null>(null);
  return (
    <Janela titulo={t.gerenciarTitulo} aberta={aberta} aoFechar={aoFechar}>
      <p className="texto-suave">{t.gerenciarAjuda}</p>
      {etiquetas.length === 0 ? (
        <p className="texto-suave">{t.semEtiquetas}</p>
      ) : (
        <ul className="lista-ligadas">
          {etiquetas.map((e) => (
            <li key={e.id}>
              {editando?.id === e.id ? (
                <Form
                  className="formulario esticado"
                  onSubmit={(ev) => (ev.preventDefault(), executar(async () => (await api.editarEtiqueta(e.id, editando.nome, editando.cor), setEditando(null))))}
                >
                  <Campo rotulo={t.nomeEtiqueta} valor={editando.nome} aoMudar={(nome) => setEditando({ ...editando, nome })} semDitado autoFocus />
                  <EscolherCor valor={editando.cor} aoMudar={(cor) => setEditando({ ...editando, cor })} />
                  <div className="botoes">
                    <Button className="botao" onPress={() => setEditando(null)}>{textos.comum.cancelar}</Button>
                    <Button className="botao principal" type="submit" isDisabled={!editando.nome.trim()}>{textos.comum.salvar}</Button>
                  </div>
                </Form>
              ) : (
                <>
                  <ChipEtiqueta etiqueta={e} />
                  <span className="botoes">
                    <Button className="botao pequeno" onPress={() => setEditando({ id: e.id, nome: e.nome, cor: e.cor })}>{t.editar}</Button>
                    <Button className="botao-icone" onPress={() => setExcluindo(e)} aria-label={t.excluirEtiqueta(e.nome)}>
                      <Trash2 aria-hidden="true" size="1em" />
                    </Button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="janela-acoes">
        <Button className="botao principal" onPress={aoFechar}>{textos.comum.fechar}</Button>
      </div>
      <Confirmar
        titulo={excluindo ? t.excluirEtiquetaTitulo(excluindo.nome) : ""}
        texto={t.excluirEtiquetaTexto}
        confirmar={t.excluir}
        aberta={!!excluindo}
        aoCancelar={() => setExcluindo(null)}
        aoConfirmar={() => excluindo && executar(async () => (await api.excluirEtiqueta(excluindo.id), setExcluindo(null)))}
      />
    </Janela>
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
