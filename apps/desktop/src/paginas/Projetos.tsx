import { ChevronRight, Eye, Plus } from "../icones";
import { useEffect, useState } from "react";
import { Button, Form, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { LinhaDoTempo } from "../projetos/LinhaDoTempo";
import { api, type EstadoProjeto, type PastaProjeto, type Projeto } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { avisarMudanca, useMudancas } from "../dados";
import { useComLimite } from "../projetos/Limite";
import { SeletorLimite } from "../projetos/SeletorLimite";
import { CabecalhoPasta, corSugerida, FileiraPastas, FormPastaProjeto, lembrarPasta, MenuPorEmPasta, pastaLembrada } from "../projetos/Pastas";
import { contarNoLimite, haQuanto, horaDeOlhar, linhaPausa } from "../projetos/tempo";
import { textos } from "../textos/pt-BR";

const t = textos.projetos;
const tp = textos.pastasProjeto;
const pastaVazia = (pastas: PastaProjeto[]): PastaProjeto => ({ id: "", nome: "", cor: corSugerida(pastas), ordem: 0, criadoEm: 0 });

const GRUPOS: EstadoProjeto[] = ["ativo", "em_uso", "pausado", "concluido"];

export function Projetos({ aoAbrir }: { aoAbrir: (id: string) => void; aoMudarLimite?: () => void }) {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [limite, setLimite] = useState(3);
  const [criando, setCriando] = useState(false);
  const [visao, setVisao] = useState<"lista" | "linha">(() => {
    try {
      return localStorage.getItem("orbita.visao-projetos") === "linha" ? "linha" : "lista";
    } catch {
      return "lista";
    }
  });
  const [erro, setErro] = useState<string | null>(null);
  // Pastas: null enquanto carrega (para não esquecer a pasta lembrada antes da hora).
  const [pastas, setPastas] = useState<PastaProjeto[] | null>(null);
  const [pastaId, setPastaId] = useState<string | null>(pastaLembrada);
  const [editandoPasta, setEditandoPasta] = useState<PastaProjeto | null>(null);
  const [apagandoPasta, setApagandoPasta] = useState<PastaProjeto | null>(null);
  // Projeto que entra na pasta criada pelo menu "Pôr em pasta" do cartão.
  const [porNaNova, setPorNaNova] = useState<string | null>(null);
  const mudancas = useMudancas();

  useEffect(() => {
    Promise.all([api.listarProjetos(), api.limiteProjetos(), api.listarPastasProjeto()]).then(
      ([p, l, ps]) => (setProjetos(p), setLimite(l), setPastas(ps)),
      (e) => setErro(String(e?.message ?? e)),
    );
  }, [mudancas]);

  const escolherPasta = (id: string | null) => {
    setPastaId(id);
    lembrarPasta(id);
  };
  // Pasta apagada (aqui ou em outro aparelho): volta para Todos.
  const pasta = pastaId && pastas ? pastas.find((p) => p.id === pastaId) ?? null : null;
  useEffect(() => {
    if (pastas && pastaId && !pastas.some((p) => p.id === pastaId)) escolherPasta(null);
  }, [pastas, pastaId]);

  const executar = async (acao: () => Promise<unknown>) => {
    setErro(null);
    try {
      await acao();
      avisarMudanca();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };
  const moverPasta = (passo: -1 | 1) => {
    if (!pastas || !pasta) return;
    const ids = pastas.map((p) => p.id);
    const i = ids.indexOf(pasta.id);
    const j = i + passo;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setPastas(ids.map((id) => pastas.find((p) => p.id === id)!));
    void executar(() => api.reordenarPastasProjeto(ids));
  };

  // O resumo é sempre de todos os projetos; a pasta só filtra a lista.
  const ativos = contarNoLimite(projetos);
  const emUso = projetos.filter((p) => p.estado === "em_uso").length;
  const visiveis = pasta ? projetos.filter((p) => p.pastas.includes(pasta.id)) : projetos;

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro} {t.dicaVisoes}</p>
      <div className="botoes">
        <Button className="botao principal" onPress={() => setCriando(true)}>
          <Plus aria-hidden="true" size="1.1em" /> {t.novo}
        </Button>
        <span className="texto-suave">{t.resumo(ativos, limite, emUso)}</span>
      </div>
      <details className="limite-inline">
        <summary>{t.mudarLimite}</summary>
        <SeletorLimite
          valor={limite}
          aoMudar={async (n) => {
            setErro(null);
            try {
              await api.definirLimiteProjetos(n);
              setLimite(n);
            } catch (e) {
              setErro(e instanceof Error ? e.message : String(e));
            }
          }}
        />
        <p className="campo-ajuda">{textos.limite.explicacao}</p>
      </details>
      <Aviso>{erro}</Aviso>

      {pastas && (
        <FileiraPastas
          pastas={pastas}
          projetos={projetos}
          selecionada={pasta?.id ?? null}
          aoSelecionar={escolherPasta}
          aoNova={() => (setPorNaNova(null), setEditandoPasta(pastaVazia(pastas ?? [])))}
        />
      )}
      {pastas && pastas.length > 0 && !pasta && <p className="campo-ajuda">{tp.ajudaAtalho}</p>}
      {pasta && pastas && (
        <CabecalhoPasta
          pasta={pasta}
          posicao={pastas.indexOf(pasta)}
          total={pastas.length}
          aoVoltar={() => escolherPasta(null)}
          aoEditar={() => setEditandoPasta(pasta)}
          aoMover={moverPasta}
          aoApagar={() => setApagandoPasta(pasta)}
        />
      )}
      {pasta && visiveis.length === 0 && <p className="texto-suave largura-leitura">{tp.vazia}</p>}

      <ToggleButtonGroup
        aria-label={t.visualizacao}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[visao]}
        onSelectionChange={(k) => {
          const v = [...k][0] as "lista" | "linha";
          setVisao(v);
          try {
            localStorage.setItem("orbita.visao-projetos", v);
          } catch {
            // Só não lembra da escolha.
          }
        }}
        className="segmentado"
      >
        <ToggleButton id="lista" className="segmentado-opcao">{t.lista}</ToggleButton>
        <ToggleButton id="linha" className="segmentado-opcao">{t.linhaDoTempo}</ToggleButton>
      </ToggleButtonGroup>

      {visao === "linha" && (!pasta || visiveis.length > 0) && <LinhaDoTempo projetos={visiveis} aoAbrir={aoAbrir} />}

      {visao === "lista" && (!pasta || visiveis.length > 0) && GRUPOS.map((g) => {
        const lista = visiveis.filter((p) => p.estado === g);
        if ((g === "concluido" || g === "em_uso") && lista.length === 0) return null;
        return (
          <section key={g} className="grupo largura-leitura" aria-labelledby={`grupo-${g}`}>
            <h2 id={`grupo-${g}`}>{t.grupos[g]}</h2>
            {g === "em_uso" && <p className="texto-suave grupo-ajuda">{t.ajudaEmUso}</p>}
            {lista.length === 0 ? (
              <p className="texto-suave">{t.vazioGrupo[g]}</p>
            ) : (
              <ul className="lista-cartoes">
                {lista.map((p) => (
                  <li key={p.id} className="projeto-linha">
                    <CartaoProjeto projeto={p} aoAbrir={() => aoAbrir(p.id)} />
                    <MenuPorEmPasta projeto={p} pastas={pastas ?? []} aoNova={() => (setPorNaNova(p.id), setEditandoPasta(pastaVazia(pastas ?? [])))} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <Janela titulo={editandoPasta?.id ? tp.editarTitulo : tp.novaTitulo} aberta={editandoPasta !== null} aoFechar={() => setEditandoPasta(null)}>
        {editandoPasta && (
          <FormPastaProjeto
            key={editandoPasta.id || "nova"}
            inicial={editandoPasta}
            aoFechar={() => setEditandoPasta(null)}
            aoSalva={async (p) => {
              if (porNaNova) await api.definirPastaDoProjeto(porNaNova, p.id, true);
              setPorNaNova(null);
            }}
          />
        )}
      </Janela>
      <Confirmar
        titulo={tp.apagarTitulo}
        texto={apagandoPasta ? tp.apagarTexto(apagandoPasta.nome) : ""}
        confirmar={tp.apagar}
        aberta={apagandoPasta !== null}
        aoCancelar={() => setApagandoPasta(null)}
        aoConfirmar={() => {
          const id = apagandoPasta?.id;
          setApagandoPasta(null);
          if (id) void executar(async () => (await api.excluirPastaProjeto(id), escolherPasta(null)));
        }}
      />
      <NovoProjeto aberta={criando} aoFechar={() => setCriando(false)} aoCriado={(id) => (setCriando(false), aoAbrir(id))} />
    </div>
  );
}

/**
 * Resumo de um projeto: título, onde parou e progresso discreto. O cartão inteiro abre o projeto.
 * Pausado: "Pausado há 3 dias — última coisa: …", para lembrar o contexto sem precisar abrir.
 */
export function CartaoProjeto({ projeto: p, aoAbrir }: { projeto: Projeto; aoAbrir: () => void }) {
  const proximo = p.ondeParei?.proximoPasso;
  const pausa = linhaPausa(p);
  const olhar = horaDeOlhar(p);
  const emUso = p.estado === "em_uso" ? t.emUsoDesde(haQuanto(p.revisadoEm ?? p.alteradoEm)) : null;
  return (
    <Button
      className={`cartao compacto cartao-projeto projeto-${p.estado}${olhar ? " hora-de-olhar" : ""}`}
      onPress={aoAbrir}
      aria-label={`${t.abrir}: ${p.titulo}${olhar ? `. ${t.horaDeOlhar}` : ""}`}
    >
      <span className="cartao-projeto-texto">
        <span className="cartao-projeto-titulo quebra">{p.titulo}</span>
        {olhar && (
          <span className="aviso-olhar">
            <Eye aria-hidden="true" size="1em" /> {t.horaDeOlhar}
          </span>
        )}
        {pausa ? (
          <span className="projeto-contexto quebra">{pausa}</span>
        ) : emUso ? (
          <span className="projeto-contexto quebra">{emUso}</span>
        ) : (
          <span className={proximo ? "projeto-contexto quebra" : "texto-suave"}>{proximo ? t.proximo(proximo) : t.semProximo}</span>
        )}
        <span className="projeto-progresso">
          {p.tarefasTotal > 0 && (
            <span className="projeto-progresso-trilho" aria-hidden="true">
              <span className="projeto-progresso-feito" style={{ width: `${(p.tarefasFeitas / p.tarefasTotal) * 100}%` }} />
            </span>
          )}
          <span className="texto-suave pequeno">{t.progresso(p.tarefasFeitas, p.tarefasTotal)}</span>
        </span>
      </span>
      <ChevronRight aria-hidden="true" size="1.2em" className="cartao-projeto-seta" />
    </Button>
  );
}

function NovoProjeto({ aberta, aoFechar, aoCriado }: { aberta: boolean; aoFechar: () => void; aoCriado: (id: string) => void }) {
  const [titulo, setTitulo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const comLimite = useComLimite();

  const criar = async () => {
    setErro(null);
    try {
      await comLimite(
        async () => {
          const p = await api.criarProjeto(titulo, true);
          setTitulo("");
          avisarMudanca();
          aoCriado(p.id);
        },
        async () => {
          const p = await api.criarProjeto(titulo, false);
          setTitulo("");
          aoCriado(p.id);
        },
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Janela titulo={t.novoTitulo} aberta={aberta} aoFechar={aoFechar}>
      <Form className="formulario" onSubmit={(e) => (e.preventDefault(), titulo.trim() && criar())}>
        <Campo rotulo={t.nomeDoProjeto} valor={titulo} aoMudar={setTitulo} autoFocus />
        <Aviso>{erro}</Aviso>
        <div className="janela-acoes">
          <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
          <Button className="botao principal" type="submit" isDisabled={!titulo.trim()}>{t.criar}</Button>
        </div>
      </Form>
    </Janela>
  );
}
