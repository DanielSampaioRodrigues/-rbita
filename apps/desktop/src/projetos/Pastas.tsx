// Pastas de projetos: atalhos criados pela pessoa (ex.: "Produtos da editora").
// Um projeto pode estar em várias pastas e continua sempre em "Todos".
// O desenho da pasta é o mesmo do Caderno (componentes/Pasta3D).
import { useEffect, useState } from "react";
import { Button, Checkbox, Form, Label, Menu, MenuItem, MenuSection, MenuTrigger, Popover, Radio, RadioGroup, type Selection } from "react-aria-components";
import { api, type PastaProjeto, type Projeto } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { CORES_PASTA, IconePasta, NOMES_COR_PASTA } from "../componentes/Pasta3D";
import { avisarMudanca, useMudancas } from "../dados";
import { ArrowLeft, ArrowRight, FolderOpen, FolderPlus, Pencil, Plus, Trash2 } from "../icones";
import { textos } from "../textos/pt-BR";

const t = textos.pastasProjeto;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Onde fica, no aparelho, a pasta aberta por último em Projetos. */
const CHAVE_PASTA = "orbita.pasta-projetos";

export function pastaLembrada(): string | null {
  try {
    return localStorage.getItem(CHAVE_PASTA) || null;
  } catch {
    return null;
  }
}

export function lembrarPasta(id: string | null): void {
  try {
    if (id) localStorage.setItem(CHAVE_PASTA, id);
    else localStorage.removeItem(CHAVE_PASTA);
  } catch {
    // Sem armazenamento: só não lembra da escolha.
  }
}

/** Cor da pasta criada às pressas (sem escolher): a primeira da paleta que ainda
 *  não está em uso; com todas em uso, vai dando a volta. Dá para mudar depois. */
export function corSugerida(pastas: PastaProjeto[]): string {
  return NOMES_COR_PASTA.find((c) => !pastas.some((p) => p.cor === c)) ?? NOMES_COR_PASTA[pastas.length % NOMES_COR_PASTA.length];
}

// ---------- Fileira de pastas (alto da página de Projetos) ----------

export function FileiraPastas({
  pastas,
  projetos,
  selecionada,
  aoSelecionar,
  aoNova,
}: {
  pastas: PastaProjeto[];
  projetos: Projeto[];
  selecionada: string | null;
  aoSelecionar: (id: string | null) => void;
  aoNova: () => void;
}) {
  const quantos = (id: string) => projetos.filter((p) => p.pastas.includes(id)).length;
  return (
    <section className="pastas-projeto" aria-labelledby="titulo-pastas-projeto">
      <h2 id="titulo-pastas-projeto" className="visualmente-oculto">{t.titulo}</h2>
      <ul className="pastas-projeto-grade">
        <li>
          <BotaoPasta nome={t.todos} cor="cinza" quantidade={projetos.length} rotulo={t.todosAjuda} ativa={selecionada === null} aoPress={() => aoSelecionar(null)} />
        </li>
        {pastas.map((p) => (
          <li key={p.id}>
            <BotaoPasta nome={p.nome} cor={p.cor} quantidade={quantos(p.id)} rotulo={t.abrirPasta(p.nome, quantos(p.id))} ativa={selecionada === p.id} aoPress={() => aoSelecionar(p.id)} />
          </li>
        ))}
        <li>
          <Button className="pasta-projeto pasta-projeto-nova" onPress={aoNova}>
            <span className="pasta-projeto-nova-icone" aria-hidden="true"><Plus size="1.6em" /></span>
            <span className="pasta-projeto-nome">{t.nova}</span>
          </Button>
        </li>
      </ul>
    </section>
  );
}

function BotaoPasta({ nome, cor, quantidade, rotulo, ativa, aoPress }: { nome: string; cor: string; quantidade: number; rotulo: string; ativa: boolean; aoPress: () => void }) {
  return (
    <Button className="pasta-projeto" aria-pressed={ativa} aria-label={rotulo} onPress={aoPress} data-ativa={ativa || undefined}>
      <IconePasta cor={cor} quantidade={quantidade} />
      <span className="pasta-projeto-nome quebra">{nome}</span>
    </Button>
  );
}

// ---------- Cabeçalho da pasta aberta ----------

export function CabecalhoPasta({
  pasta,
  posicao,
  total,
  aoVoltar,
  aoEditar,
  aoMover,
  aoApagar,
}: {
  pasta: PastaProjeto;
  posicao: number;
  total: number;
  aoVoltar: () => void;
  aoEditar: () => void;
  aoMover: (passo: -1 | 1) => void;
  aoApagar: () => void;
}) {
  return (
    <div className="pasta-aberta">
      <h2 className="pasta-aberta-titulo quebra">
        <FolderOpen aria-hidden="true" size="1em" /> {t.cabecalho(pasta.nome)}
      </h2>
      <div className="botoes pasta-aberta-acoes">
        <Button className="botao" onPress={aoVoltar}>
          <ArrowLeft aria-hidden="true" size="1.1em" /> {t.voltarTodos}
        </Button>
        <Button className="botao" onPress={aoEditar}>
          <Pencil aria-hidden="true" size="1.1em" /> {t.editar}
        </Button>
        <Button className="botao-icone" onPress={() => aoMover(-1)} isDisabled={posicao === 0} aria-label={t.paraEsquerda}>
          <ArrowLeft aria-hidden="true" size="1.1em" />
        </Button>
        <Button className="botao-icone" onPress={() => aoMover(1)} isDisabled={posicao >= total - 1} aria-label={t.paraDireita}>
          <ArrowRight aria-hidden="true" size="1.1em" />
        </Button>
        <Button className="botao" onPress={aoApagar}>
          <Trash2 aria-hidden="true" size="1.1em" /> {t.apagar}
        </Button>
      </div>
    </div>
  );
}

// ---------- Criar / editar pasta (nome e cor) ----------

export function FormPastaProjeto({ inicial, aoFechar, aoSalva }: { inicial: PastaProjeto; aoFechar: () => void; aoSalva?: (p: PastaProjeto) => void | Promise<void> }) {
  const [nome, setNome] = useState(inicial.nome);
  const [cor, setCor] = useState<string>(inicial.cor in CORES_PASTA ? inicial.cor : "areia");
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";
  const nomesCores = textos.caderno.pasta.cores as Record<string, string>;
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setErro(null);
    try {
      const salva = await api.salvarPastaProjeto({ ...inicial, nome, cor });
      await aoSalva?.(salva);
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(mensagem(err));
    }
  };
  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.nome} valor={nome} aoMudar={setNome} autoFocus maximo={60} semDitado />
      <RadioGroup className="campo" value={cor} onChange={setCor} orientation="horizontal">
        <Label className="campo-rotulo">{t.cor}</Label>
        <div className="caderno-pasta-cores">
          {NOMES_COR_PASTA.map((c) => (
            <Radio key={c} value={c} className="cor-opcao" aria-label={nomesCores[c]}>
              <span className="etiqueta-cor grande" style={{ background: CORES_PASTA[c] }} aria-hidden="true" />
            </Radio>
          ))}
        </div>
      </RadioGroup>
      <div className="caderno-pasta-previa">
        <IconePasta cor={cor} />
        <span className="quebra">{nome.trim() || t.nova}</span>
      </div>
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!nome.trim()}>{editando ? t.salvar : t.criar}</Button>
      </div>
    </Form>
  );
}

// ---------- Menu "Pôr em pasta" no cartão do projeto ----------

export function MenuPorEmPasta({ projeto, pastas, aoNova }: { projeto: Projeto; pastas: PastaProjeto[]; aoNova: () => void }) {
  const recado = useRecado();
  const mudar = async (chaves: Selection) => {
    const novas = chaves === "all" ? pastas.map((p) => p.id) : [...chaves].map(String);
    const entrou = novas.find((id) => !projeto.pastas.includes(id));
    const saiu = projeto.pastas.find((id) => !novas.includes(id));
    const alvo = entrou ?? saiu;
    if (!alvo) return;
    const nome = pastas.find((p) => p.id === alvo)?.nome ?? "";
    try {
      await api.definirPastaDoProjeto(projeto.id, alvo, Boolean(entrou));
      recado(entrou ? t.posto(nome) : t.tirado(nome));
      avisarMudanca();
    } catch (e) {
      recado(mensagem(e));
    }
  };
  return (
    <MenuTrigger>
      <Button className="botao-icone cartao-projeto-pasta" aria-label={t.porEmPastaDe(projeto.titulo)}>
        <FolderPlus aria-hidden="true" size="1.15em" />
      </Button>
      <Popover className="menu-popover" placement="bottom end">
        <Menu className="menu" aria-label={t.porEmPastaDe(projeto.titulo)} onAction={(k) => k === "nova" && aoNova()}>
          {pastas.length > 0 && (
            <MenuSection
              className="menu-secao"
              aria-label={t.titulo}
              selectionMode="multiple"
              selectedKeys={projeto.pastas}
              onSelectionChange={(k) => void mudar(k)}
              shouldCloseOnSelect={false}
            >
              {pastas.map((p) => (
                <MenuItem key={p.id} id={p.id} className="menu-item menu-item-pasta" textValue={p.nome}>
                  {({ isSelected }) => (
                    <>
                      <span className="caixa-quadrado" data-marcada={isSelected || undefined} aria-hidden="true">
                        <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                      </span>
                      <span className="etiqueta-cor" style={{ background: CORES_PASTA[p.cor as keyof typeof CORES_PASTA] ?? CORES_PASTA.areia }} aria-hidden="true" />
                      <span className="quebra">{p.nome}</span>
                    </>
                  )}
                </MenuItem>
              ))}
            </MenuSection>
          )}
          <MenuSection className="menu-secao" aria-label={t.nova}>
            <MenuItem id="nova" className="menu-item menu-item-pasta" textValue={t.novaComProjeto}>
              <Plus aria-hidden="true" size="1em" /> {t.novaComProjeto}
            </MenuItem>
          </MenuSection>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

// ---------- Dentro do projeto: linha "Pastas: …" e a janela das caixinhas ----------

export function PastasDoProjeto({ projeto }: { projeto: Projeto }) {
  const [pastas, setPastas] = useState<PastaProjeto[]>([]);
  const [aberta, setAberta] = useState(false);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarPastasProjeto().then(setPastas, () => setPastas([]));
  }, [mudancas]);

  const nomes = pastas.filter((p) => projeto.pastas.includes(p.id)).map((p) => p.nome);
  return (
    <div className="pastas-do-projeto largura-leitura">
      <FolderOpen aria-hidden="true" size="1.05em" className="texto-suave" />
      <span className="texto-suave quebra">{nomes.length ? t.linha(nomes.join(", ")) : t.linhaNenhuma}</span>
      <Button className="botao pequeno" onPress={() => setAberta(true)}>{t.botao}</Button>
      <Janela titulo={t.janelaTitulo} aberta={aberta} aoFechar={() => setAberta(false)}>
        <JanelaPastas projeto={projeto} pastas={pastas} aoFechar={() => setAberta(false)} />
      </Janela>
    </div>
  );
}

function JanelaPastas({ projeto, pastas, aoFechar }: { projeto: Projeto; pastas: PastaProjeto[]; aoFechar: () => void }) {
  const [nova, setNova] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const executar = async (acao: () => Promise<unknown>) => {
    setErro(null);
    try {
      await acao();
      avisarMudanca();
    } catch (e) {
      setErro(mensagem(e));
    }
  };
  const criar = () =>
    executar(async () => {
      const p = await api.salvarPastaProjeto({ id: "", nome: nova, cor: corSugerida(pastas), ordem: 0, criadoEm: 0 });
      await api.definirPastaDoProjeto(projeto.id, p.id, true);
      setNova("");
    });
  return (
    <div className="formulario">
      <p className="campo-ajuda">{t.janelaAjuda}</p>
      {pastas.length === 0 ? (
        <p className="texto-suave">{t.semPastas}</p>
      ) : (
        <ul className="pastas-caixinhas" aria-label={t.titulo}>
          {pastas.map((p) => {
            const dentro = projeto.pastas.includes(p.id);
            return (
              <li key={p.id}>
                <Checkbox className="caixa pasta-caixinha" isSelected={dentro} onChange={(v) => executar(() => api.definirPastaDoProjeto(projeto.id, p.id, v))}>
                  <span className="caixa-quadrado" aria-hidden="true">
                    <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                  </span>
                  <span className="pasta-caixinha-fig" aria-hidden="true"><IconePasta cor={p.cor} /></span>
                  <span className="quebra">{p.nome}</span>
                </Checkbox>
              </li>
            );
          })}
        </ul>
      )}
      <Form className="pastas-nova-linha" onSubmit={(e) => (e.preventDefault(), nova.trim() && criar())}>
        <Campo rotulo={t.nomeNova} valor={nova} aoMudar={setNova} maximo={60} semDitado />
        <Button className="botao" type="submit" isDisabled={!nova.trim()}>
          <Plus aria-hidden="true" size="1.1em" /> {t.criarEPor}
        </Button>
      </Form>
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao principal" onPress={aoFechar}>{t.fechar}</Button>
      </div>
    </div>
  );
}
