// "Minha organização": quadros como no Trello. Cada quadro tem colunas com cartões;
// a forma de ver (Quadro ou Lista) é só exibição e troca a qualquer momento.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type CartaoOrg, type Coluna, type EtiquetaOrg, type FundoOrg, type Quadro } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { estiloFundo } from "../hobbies/aparencia";
import { Archive, ChevronLeft, ImagePlus, LayoutGrid, List, Pencil, Plus, Search, SlidersHorizontal, Tags, Trash2, X } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { CartaoAberto, type AcoesCartao } from "./CartaoAberto";
import { classeCor, estiloCor } from "./cores";
import { PainelArquivados, PainelEtiquetas, PainelFiltro, PainelFundo } from "./Paineis";
import { EscolherCor, useImagemAnexo } from "./partes";
import { colunaVisivel, filtroVazio, partesDoFiltro, passaNoFiltro, vistaDe, type Filtro } from "./regras";
import { VistaLista } from "./VistaLista";
import { VistaQuadro, type AcoesVista } from "./VistaQuadro";

const t = textos.organizacao;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------- Página principal ----------

export function PaginaOrganizacao() {
  const [quadros, setQuadros] = useState<Quadro[]>([]);
  const [editando, setEditando] = useState<Quadro | null>(null);
  const [excluindo, setExcluindo] = useState<Quadro | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarQuadros().then(setQuadros, (e) => setErro(mensagem(e)));
  }, [mudancas]);

  const excluir = async () => {
    if (!excluindo) return;
    await api.excluirQuadro(excluindo.id);
    setExcluindo(null);
    avisarMudanca();
  };

  const abertoAtual = aberto ? quadros.find((q) => q.id === aberto) : null;
  if (abertoAtual) return <QuadroAberto quadro={abertoAtual} aoFechar={() => setAberto(null)} />;

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <div className="botoes">
        <Button className="botao principal" onPress={() => setEditando({ id: "", nome: "", estilo: "quadro", criadoEm: 0, cor: "" })}>
          <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
        </Button>
      </div>

      {quadros.length === 0 ? (
        <section className="cartao largura-leitura esticado"><p className="texto-suave">{t.vazio}</p></section>
      ) : (
        <ul className="org-paineis">
          {quadros.map((q) => {
            const vista = vistaDe(q);
            return (
              <li key={q.id} className={"org-painel" + classeCor(q.cor ?? "")} style={estiloCor(q.cor ?? "")}>
                <button type="button" className="org-painel-abrir" onClick={() => setAberto(q.id)} aria-label={`${t.abrir}: ${q.nome}`}>
                  <span className="org-painel-icone" aria-hidden="true">{vista === "quadro" ? <LayoutGrid size="1.15em" /> : <List size="1.15em" />}</span>
                  <span className="org-painel-nome quebra">{q.nome}</span>
                  <span className="org-painel-tipo">{t.vista[vista]}</span>
                </button>
                <span className="org-painel-acoes">
                  <Button className="botao-icone org-icone" onPress={() => setEditando(q)} aria-label={`${t.editar}: ${q.nome}`}><Pencil aria-hidden="true" size="1em" /></Button>
                  <Button className="botao-icone org-icone" onPress={() => setExcluindo(q)} aria-label={`${t.excluir}: ${q.nome}`}><Trash2 aria-hidden="true" size="1em" /></Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Aviso>{erro}</Aviso>

      <Janela titulo={editando && editando.id ? t.form.editarTitulo : t.form.novo} aberta={editando !== null} aoFechar={() => setEditando(null)}>
        {editando && <FormQuadro key={editando.id || "novo"} inicial={editando} aoFechar={() => setEditando(null)} />}
      </Janela>

      <Confirmar titulo={t.excluir} texto={excluindo ? t.confirmarExcluir(excluindo.nome) : ""} confirmar={t.excluir} aberta={excluindo !== null} aoCancelar={() => setExcluindo(null)} aoConfirmar={() => void excluir()} />
    </div>
  );
}

/** Novo quadro (sem perguntar o tipo) ou editar nome e cor. */
function FormQuadro({ inicial, aoFechar }: { inicial: Quadro; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [cor, setCor] = useState(inicial.cor ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarQuadro({ ...inicial, nome, cor });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(mensagem(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.form.nome} valor={nome} aoMudar={setNome} autoFocus maximo={80} semDitado descricao={editando ? undefined : t.form.novoAjuda} />
      <EscolherCor rotulo={t.cor} valor={cor} aoMudar={setCor} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.form.salvarMudancas : t.form.salvar}</Button>
      </div>
    </Form>
  );
}

// ---------- Quadro aberto ----------

type Painel = "" | "filtro" | "arquivados" | "etiquetas" | "fundo" | "corColuna";

function QuadroAberto({ quadro: doBanco, aoFechar }: { quadro: Quadro; aoFechar: () => void }) {
  const recado = useRecado();
  const mudancas = useMudancas();
  const [quadro, setQuadro] = useState(doBanco);
  const quadroRef = useRef(quadro);
  quadroRef.current = quadro;
  useEffect(() => setQuadro(doBanco), [doBanco]);

  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [cartoes, setCartoes] = useState<CartaoOrg[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>(filtroVazio);
  const [painel, setPainel] = useState<Painel>("");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [pintandoColuna, setPintandoColuna] = useState<Coluna | null>(null);
  const [excluindoColuna, setExcluindoColuna] = useState<Coluna | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const busca = useRef<HTMLInputElement>(null);

  // A data de "agora" anda sozinha (para "vence hoje" virar a tempo), sem nada se mexer na tela.
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const carregar = useCallback(async () => {
    try {
      const [cols, cards] = await Promise.all([api.listarColunas(doBanco.id), api.listarCartoesOrg(doBanco.id)]);
      setColunas(cols);
      setCartoes(cards);
    } catch (e) {
      setErro(mensagem(e));
    }
  }, [doBanco.id]);
  useEffect(() => void carregar(), [carregar, mudancas]);

  // Tecla "/" vai para a busca (fora de caixas de texto).
  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.closest("input, textarea, select, [contenteditable='true']") || alvo.closest("[role='dialog']"))) return;
      e.preventDefault();
      busca.current?.focus();
    };
    window.addEventListener("keydown", ouvir);
    return () => window.removeEventListener("keydown", ouvir);
  }, []);

  const vista = vistaDe(quadro);
  const etiquetas = quadro.etiquetas ?? [];
  const fundo: FundoOrg = quadro.fundo ?? { tipo: "tema", valor: "" };
  const urlFundo = useImagemAnexo(fundo.tipo === "imagem" ? fundo.valor : "");
  const estiloDoFundo = useMemo(
    () => estiloFundo({ tipo: fundo.tipo, cor: fundo.valor, gradiente: fundo.valor, imagem: fundo.valor, padrao: "nenhum" }, urlFundo),
    [fundo.tipo, fundo.valor, urlFundo],
  );

  /** Grava mudanças do quadro (vista, etiquetas, fundo): a tela muda na hora. */
  const mudarQuadro = async (parcial: Partial<Quadro>) => {
    const novo = { ...quadroRef.current, ...parcial };
    setQuadro(novo);
    quadroRef.current = novo;
    try {
      await api.salvarQuadro(novo);
      avisarMudanca();
    } catch (e) {
      setErro(mensagem(e));
    }
  };

  const colunasVisiveis = colunas.filter(colunaVisivel);
  const idsVisiveis = new Set(colunasVisiveis.map((c) => c.id));
  const visivel = useCallback((c: CartaoOrg) => !c.arquivado && passaNoFiltro(c, filtro, agora), [filtro, agora]);
  const partes = partesDoFiltro(filtro);
  const escondidos = partes ? cartoes.filter((c) => idsVisiveis.has(c.colunaId) && !c.arquivado && !visivel(c)).length : 0;
  const nomeColuna = (id: string) => colunas.find((c) => c.id === id)?.nome || t.coluna.semNome;

  // ── Cartões ──
  const adicionar = async (colunaId: string, texto: string) => {
    try {
      await api.salvarCartaoOrg({ id: "", colunaId, texto, feito: false, cor: "", prazo: "", ordem: 0, criadoEm: 0 });
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  const marcar = async (c: CartaoOrg, feito: boolean) => {
    setCartoes((cs) => cs.map((x) => (x.id === c.id ? { ...x, feito } : x)));
    try {
      await api.marcarCartaoOrg(c.id, feito);
    } catch (e) {
      setErro(mensagem(e));
      await carregar();
    }
  };
  const apagar = async (c: CartaoOrg) => {
    await api.excluirCartaoOrg(c.id);
    await carregar();
  };
  /**
   * Guarda a nova posição: `id` passa para a coluna `colunaId`, e `ids` é a ordem final completa dessa coluna.
   * A tela muda na hora; se o banco recusar, volta ao que está guardado.
   */
  const posicionar = async (id: string, colunaId: string, ids: string[]) => {
    const antes = cartoes.find((c) => c.id === id);
    const posicao = new Map(ids.map((x, i) => [x, i + 1]));
    setCartoes((cs) => cs.map((c) => (c.id === id ? { ...c, colunaId } : c)).map((c) => (posicao.has(c.id) ? { ...c, ordem: posicao.get(c.id)! } : c)).sort((a, b) => a.ordem - b.ordem));
    try {
      if (antes && antes.colunaId !== colunaId) await api.moverCartaoOrg(id, colunaId, posicao.get(id) ?? 1);
      await api.reordenarCartoesOrg(ids);
    } catch (e) {
      setErro(mensagem(e));
      await carregar();
    }
  };
  const guardarCartao = async (c: CartaoOrg) => {
    const salvo = await api.salvarCartaoOrg(c);
    setCartoes((cs) => cs.map((x) => (x.id === salvo.id ? { ...salvo, anexos: c.anexos ?? x.anexos } : x)));
    return salvo;
  };
  const arquivarFeitos = async (cs: CartaoOrg[]) => {
    try {
      for (const c of cs) await api.salvarCartaoOrg({ ...c, arquivado: true });
      recado(t.lista.arquivouFeitos(cs.length));
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  };

  /** Ao levar um cartão para outro quadro, as etiquetas dele vão junto (as que faltarem lá são criadas). */
  const levarEtiquetas = async (c: CartaoOrg, quadroId: string) => {
    if (quadroId === quadro.id || !(c.etiquetas ?? []).length) return;
    const destino = (await api.listarQuadros()).find((q) => q.id === quadroId);
    if (!destino) return;
    const ja = new Set((destino.etiquetas ?? []).map((e) => e.id));
    const faltam = etiquetas.filter((e) => c.etiquetas!.includes(e.id) && !ja.has(e.id));
    if (faltam.length) await api.salvarQuadro({ ...destino, etiquetas: [...(destino.etiquetas ?? []), ...faltam] });
  };
  const fimDaColuna = async (quadroId: string, colunaId: string) => {
    const lista = quadroId === quadro.id ? cartoes : await api.listarCartoesOrg(quadroId);
    return Math.max(0, ...lista.filter((x) => x.colunaId === colunaId).map((x) => x.ordem)) + 1;
  };

  const acoesCartao: AcoesCartao = {
    quadro,
    colunas,
    etiquetas,
    agora,
    aoGuardar: guardarCartao,
    aoRecarregar: () => void carregar(),
    aoCriarEtiqueta: async (nome, cor) => {
      const nova: EtiquetaOrg = { id: crypto.randomUUID(), nome: nome.trim(), cor };
      await mudarQuadro({ etiquetas: [...(quadroRef.current.etiquetas ?? []), nova] });
      return nova;
    },
    aoMover: async (c, quadroId, colunaId) => {
      await levarEtiquetas(c, quadroId);
      await api.moverCartaoOrg(c.id, colunaId, await fimDaColuna(quadroId, colunaId));
      recado(t.mover.moveu(c.texto, quadroId === quadro.id ? nomeColuna(colunaId) : (await api.listarColunas(quadroId)).find((x) => x.id === colunaId)?.nome || t.coluna.semNome));
      await carregar();
      avisarMudanca();
    },
    aoCopiar: async (c, quadroId, colunaId, titulo) => {
      await levarEtiquetas(c, quadroId);
      await api.salvarCartaoOrg({
        ...c,
        id: "",
        colunaId,
        texto: titulo.trim() || c.texto,
        ordem: 0,
        criadoEm: 0,
        arquivado: false,
        anexos: 0,
        // A imagem da capa é um anexo deste cartão: não vai na cópia.
        capa: c.capa?.tipo === "cor" ? c.capa : { tipo: "", valor: "" },
        checklists: (c.checklists ?? []).map((cl) => ({ ...cl, id: "", itens: cl.itens.map((i) => ({ ...i, id: "" })) })),
      });
      recado(t.mover.copiou(c.texto, quadroId === quadro.id ? nomeColuna(colunaId) : t.coluna.semNome));
      await carregar();
    },
    aoApagar: apagar,
  };

  // ── Colunas ──
  const salvarColuna = async (col: Coluna) => {
    try {
      await api.salvarColuna(col);
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  // Mudar a coluna de lugar: troca a ordem com a vizinha visível e guarda as duas.
  const moverColuna = async (col: Coluna, delta: number) => {
    const i = colunasVisiveis.findIndex((c) => c.id === col.id);
    const vizinha = colunasVisiveis[i + delta];
    if (!vizinha) return;
    try {
      // Ordens iguais (dados antigos) usariam a posição na lista para desempatar.
      const ordemA = col.ordem === vizinha.ordem ? i + delta : vizinha.ordem;
      const ordemB = col.ordem === vizinha.ordem ? i : col.ordem;
      await api.salvarColuna({ ...col, ordem: ordemA });
      await api.salvarColuna({ ...vizinha, ordem: ordemB });
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  };

  const acoes: AcoesVista = {
    etiquetas,
    agora,
    visivel,
    aoAdicionar: adicionar,
    aoMarcar: (c, feito) => void marcar(c, feito),
    aoAbrir: (c) => setAbertoId(c.id),
    aoApagar: (c) => void apagar(c),
    aoPosicionar: posicionar,
    coluna: {
      renomear: (col, nome) => {
        const n = nome.trim();
        if (n && n !== col.nome) void salvarColuna({ ...col, nome: n });
      },
      mover: (col, delta) => void moverColuna(col, delta),
      pintar: (col) => (setPintandoColuna(col), setPainel("corColuna")),
      recolher: (col, recolhida) => {
        setColunas((cs) => cs.map((x) => (x.id === col.id ? { ...x, recolhida } : x)));
        void salvarColuna({ ...col, recolhida });
      },
      arquivar: (col) => {
        void salvarColuna({ ...col, arquivada: true });
        recado(t.coluna.arquivou(col.nome || t.coluna.semNome));
      },
      excluir: (col) => setExcluindoColuna(col),
      adicionar: () => void salvarColuna({ id: "", quadroId: quadro.id, nome: t.coluna.semNome, ordem: 0 }),
    },
  };

  const aberto = abertoId ? cartoes.find((c) => c.id === abertoId) ?? null : null;
  const temFundo = fundo.tipo !== "tema";

  return (
    <div className="org-tela">
      <div className="leitor-barra org-barra">
        <Button className="botao-icone" onPress={aoFechar} aria-label={t.voltar}><ChevronLeft aria-hidden="true" size="1.2em" /></Button>
        <strong className="leitor-titulo quebra org-barra-titulo">{quadro.nome}</strong>
        <div className="org-ferramentas" role="group" aria-label={t.barra.ferramentas}>
          <div className="org-vista">
            <Segmentado
              rotulo={t.vista.rotulo}
              rotuloOculto
              valor={vista}
              aoMudar={(v) => void mudarQuadro({ vista: v })}
              opcoes={[
                { valor: "quadro", nome: t.vista.quadro },
                { valor: "lista", nome: t.vista.lista },
              ]}
            />
          </div>
          <label className="org-busca">
            <Search aria-hidden="true" size="1em" />
            <span className="visualmente-oculto">{t.barra.buscar}</span>
            <input ref={busca} type="search" value={filtro.texto} onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })} placeholder={t.barra.buscarDica} aria-keyshortcuts="/" title={t.barra.atalhoBuscar} />
          </label>
          <Button className={"botao com-icone org-ferramenta" + (partes ? " ligado" : "")} onPress={() => setPainel("filtro")} aria-label={partes ? t.barra.filtroLigado(partes) : t.barra.filtro}>
            <SlidersHorizontal aria-hidden="true" size="1em" /> <span className="org-ferramenta-nome">{partes ? t.barra.filtroLigado(partes) : t.barra.filtro}</span>
          </Button>
          <Button className="botao com-icone org-ferramenta" onPress={() => setPainel("etiquetas")} aria-label={t.barra.etiquetas}>
            <Tags aria-hidden="true" size="1em" /> <span className="org-ferramenta-nome">{t.barra.etiquetas}</span>
          </Button>
          <Button className="botao com-icone org-ferramenta" onPress={() => setPainel("fundo")} aria-label={t.barra.fundo}>
            <ImagePlus aria-hidden="true" size="1em" /> <span className="org-ferramenta-nome">{t.barra.fundo}</span>
          </Button>
          <Button className="botao com-icone org-ferramenta" onPress={() => setPainel("arquivados")} aria-label={t.barra.arquivados}>
            <Archive aria-hidden="true" size="1em" /> <span className="org-ferramenta-nome">{t.barra.arquivados}</span>
          </Button>
        </div>
      </div>

      {partes > 0 && (
        <div className="org-aviso-filtro" role="status">
          <span>{escondidos ? t.filtro.escondidos(escondidos) : t.barra.filtroLigado(partes)}</span>
          <Button className="botao pequeno com-icone" onPress={() => setFiltro(filtroVazio())}><X aria-hidden="true" size="1em" /> {t.filtro.limpar}</Button>
        </div>
      )}
      {erro && <div className="leitor-aviso"><Aviso>{erro}</Aviso></div>}

      <div className={"org-palco" + (temFundo ? " org-com-fundo" : "")}>
        {temFundo && <div className={`org-fundo-camada org-fundo-${fundo.tipo}`} style={estiloDoFundo} aria-hidden="true" />}
        <div className="org-corpo">
          {vista === "quadro" ? (
            <VistaQuadro colunas={colunasVisiveis} cartoes={cartoes.filter((c) => idsVisiveis.has(c.colunaId))} acoes={acoes} />
          ) : (
            <VistaLista colunas={colunasVisiveis} cartoes={cartoes.filter((c) => idsVisiveis.has(c.colunaId))} acoes={acoes} aoArquivarFeitos={(cs) => void arquivarFeitos(cs)} />
          )}
        </div>
      </div>

      <CartaoAberto inicial={aberto} acoes={acoesCartao} aoFechar={() => setAbertoId(null)} />

      <Janela titulo={t.filtro.titulo} aberta={painel === "filtro"} aoFechar={() => setPainel("")} pequena>
        <PainelFiltro filtro={filtro} etiquetas={etiquetas} aoMudar={setFiltro} aoLimpar={() => setFiltro(filtroVazio())} aoFechar={() => setPainel("")} />
      </Janela>

      <Janela titulo={t.arquivados.titulo} aberta={painel === "arquivados"} aoFechar={() => setPainel("")}>
        <PainelArquivados
          colunas={colunas}
          cartoes={cartoes}
          aoRestaurarColuna={(c) => void salvarColuna({ ...c, arquivada: false })}
          aoApagarColuna={(c) => void api.excluirColuna(c.id).then(carregar, (e) => setErro(mensagem(e)))}
          aoRestaurarCartao={(c) => void guardarCartao({ ...c, arquivado: false }).then(carregar, (e) => setErro(mensagem(e)))}
          aoApagarCartao={(c) => void apagar(c)}
          aoFechar={() => setPainel("")}
        />
      </Janela>

      <Janela titulo={t.etiquetas.titulo} aberta={painel === "etiquetas"} aoFechar={() => setPainel("")}>
        <PainelEtiquetas etiquetas={etiquetas} aoMudar={(lista) => void mudarQuadro({ etiquetas: lista })} aoFechar={() => setPainel("")} />
      </Janela>

      <Janela titulo={t.fundo.titulo} aberta={painel === "fundo"} aoFechar={() => setPainel("")}>
        <PainelFundo quadro={quadro} fundo={fundo} aoMudar={(f) => void mudarQuadro({ fundo: f })} aoFechar={() => setPainel("")} />
      </Janela>

      <Janela titulo={t.coluna.cor} aberta={painel === "corColuna" && pintandoColuna !== null} aoFechar={() => setPainel("")} pequena>
        {pintandoColuna && (
          <div className="formulario">
            <EscolherCor
              rotulo={pintandoColuna.nome || t.coluna.semNome}
              valor={pintandoColuna.cor ?? ""}
              aoMudar={(cor) => {
                const col = { ...pintandoColuna, cor };
                setPintandoColuna(col);
                void salvarColuna(col);
              }}
            />
            <div className="janela-acoes"><Button className="botao principal" onPress={() => setPainel("")}>{t.coluna.pronto}</Button></div>
          </div>
        )}
      </Janela>

      <Confirmar
        titulo={t.coluna.excluir}
        texto={excluindoColuna ? t.coluna.confirmarExcluir(excluindoColuna.nome || t.coluna.semNome) : ""}
        confirmar={t.coluna.excluir}
        aberta={excluindoColuna !== null}
        aoCancelar={() => setExcluindoColuna(null)}
        aoConfirmar={() => {
          const col = excluindoColuna;
          setExcluindoColuna(null);
          if (col) void api.excluirColuna(col.id).then(carregar, (e) => setErro(mensagem(e)));
        }}
      />
    </div>
  );
}
