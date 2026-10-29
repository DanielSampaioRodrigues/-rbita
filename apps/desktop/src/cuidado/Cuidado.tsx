import { useEffect, useState } from "react";
import { Button, Form, Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { chaveDia } from "../agenda/datas";
import { api, type Profissional, type RegistroSessao, type Remedio } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { CampoRico } from "../componentes/CampoRico";
import { TextoRico } from "../componentes/TextoRico";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { CalendarDays, Pencil, Plus, Quote, StickyNote, Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { diasAte } from "./consulta";
import { ListaNotas } from "./ListaNotas";
import { JanelaMarcarConsulta, dataPorExtenso } from "./MarcarConsulta";

const t = textos.cuidado;
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
const dataLegivel = (iso: string) => (iso ? fmtData.format(new Date(`${iso}T00:00:00`)) : "");

function profNovo(): Profissional {
  return { id: "", nome: "", especialidade: "", sobre: "", proximaConsulta: "", criadoEm: 0 };
}

export function PaginaCuidado() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [editando, setEditando] = useState<Profissional | null>(null);
  const [excluindo, setExcluindo] = useState<Profissional | null>(null);
  const [lembrar, setLembrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarProfissionais().then(
      (ps) => {
        setProfissionais(ps);
        setSelecionadoId((atual) => (atual && ps.some((p) => p.id === atual) ? atual : ps[0]?.id ?? null));
      },
      (e) => setErro(e instanceof Error ? e.message : String(e)),
    );
  }, [mudancas]);

  const excluir = async () => {
    if (!excluindo) return;
    await api.excluirProfissional(excluindo.id);
    setExcluindo(null);
    avisarMudanca();
  };

  return (
    <div className="pagina cuidado-pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      {profissionais.length === 0 ? (
        <section className="cartao cuidado-cartao cuidado-vazio">
          <h2>{t.vazio.titulo}</h2>
          <p>{t.vazio.texto}</p>
          <p className="texto-suave">{t.vazio.exemplos}</p>
          <div className="botoes">
            <Button className="botao principal" onPress={() => setEditando(profNovo())}>
              <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
            </Button>
          </div>
        </section>
      ) : (
        <Tabs
          className="cuidado-tabs"
          selectedKey={selecionadoId ?? undefined}
          onSelectionChange={(k) => setSelecionadoId(String(k))}
        >
          <div className="cuidado-barra">
            <TabList className="cuidado-abas" aria-label={t.escolher} items={profissionais}>
              {(p) => (
                <Tab id={p.id} className="cuidado-aba">
                  <strong>{p.nome}</strong>
                  {p.especialidade && <span className="cuidado-aba-esp">{p.especialidade}</span>}
                </Tab>
              )}
            </TabList>
            <Button className="botao" onPress={() => setEditando(profNovo())}>
              <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
            </Button>
          </div>
          {profissionais.map((p) => (
            <TabPanel key={p.id} id={p.id} className="cuidado-painel">
              <PainelProfissional profissional={p} aoEditar={() => setEditando(p)} aoExcluir={() => setExcluindo(p)} />
            </TabPanel>
          ))}
        </Tabs>
      )}

      <Aviso>{erro}</Aviso>

      {profissionais.length > 0 && (
        <div className="cuidado-flutuante">
          <Button className="botao principal cuidado-botao-lembrar" onPress={() => setLembrar(true)}>
            <StickyNote aria-hidden="true" size="1.2em" /> {t.lembrar.botao}
          </Button>
        </div>
      )}

      <Janela titulo={editando && editando.id ? t.form.editarTitulo : t.form.novo} aberta={editando !== null} aoFechar={() => setEditando(null)}>
        {editando && <FormProfissional key={editando.id || "novo"} inicial={editando} aoSalvo={(id) => setSelecionadoId(id)} aoFechar={() => setEditando(null)} />}
      </Janela>

      <Janela titulo={t.lembrar.titulo} aberta={lembrar} aoFechar={() => setLembrar(false)}>
        <FormLembrar profissionais={profissionais} inicialId={selecionadoId} aoFechar={() => setLembrar(false)} />
      </Janela>

      <Confirmar titulo={t.excluirProf} texto={excluindo ? t.confirmarExcluirProf(excluindo.nome) : ""} confirmar={t.excluirProf} aberta={excluindo !== null} aoCancelar={() => setExcluindo(null)} aoConfirmar={() => void excluir()} />
    </div>
  );
}

function FormProfissional({ inicial, aoSalvo, aoFechar }: { inicial: Profissional; aoSalvo: (id: string) => void; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [especialidade, setEspecialidade] = useState(inicial.especialidade);
  const [proximaConsulta, setProximaConsulta] = useState(inicial.proximaConsulta);
  const [sobre, setSobre] = useState(inicial.sobre);
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      const salvo = await api.salvarProfissional({ ...inicial, nome, especialidade, proximaConsulta, sobre });
      avisarMudanca();
      aoSalvo(salvo.id);
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario cuidado-form" onSubmit={enviar}>
      <Campo rotulo={t.form.nome} valor={nome} aoMudar={setNome} autoFocus maximo={80} semDitado />
      <Campo rotulo={t.form.especialidade} valor={especialidade} aoMudar={setEspecialidade} maximo={60} semDitado descricao={t.form.especialidadeAjuda} />
      <CampoData rotulo={t.proximaConsulta} tipo="date" valor={proximaConsulta} aoMudar={setProximaConsulta} />
      <CampoRico rotulo={t.sobre} valor={sobre} aoMudar={setSobre} descricao={t.sobreAjuda} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.form.salvarMudancas : t.form.salvar}</Button>
      </div>
    </Form>
  );
}

/** "Quero lembrar de falar disso": captura rápida, de qualquer ponto do módulo. */
function FormLembrar({ profissionais, inicialId, aoFechar }: { profissionais: Profissional[]; inicialId: string | null; aoFechar: () => void }) {
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<"pauta" | "pergunta">("pauta");
  const [quem, setQuem] = useState(inicialId ?? profissionais[0]?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const recado = useRecado();

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) {
      setErro(t.lembrar.semTexto);
      return;
    }
    setErro(null);
    try {
      await api.criarNotaCuidado(quem, tipo, texto);
      avisarMudanca();
      const nome = profissionais.find((p) => p.id === quem)?.nome ?? "";
      recado(tipo === "pauta" ? t.lembrar.guardadoPauta(nome) : t.lembrar.guardadoPergunta(nome));
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario cuidado-form" onSubmit={enviar}>
      <Campo rotulo={t.lembrar.campo} valor={texto} aoMudar={setTexto} multilinha autoFocus />
      {profissionais.length > 1 && (
        <Segmentado rotulo={t.lembrar.comQuem} valor={quem} aoMudar={setQuem} opcoes={profissionais.map((p) => ({ valor: p.id, nome: p.nome }))} />
      )}
      <Segmentado
        rotulo={t.lembrar.ondeGuardar}
        valor={tipo}
        aoMudar={setTipo}
        opcoes={[
          { valor: "pauta", nome: t.pauta.titulo },
          { valor: "pergunta", nome: t.perguntas.titulo },
        ]}
      />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{t.lembrar.guardar}</Button>
      </div>
    </Form>
  );
}

function PainelProfissional({ profissional: p, aoEditar, aoExcluir }: { profissional: Profissional; aoEditar: () => void; aoExcluir: () => void }) {
  const [marcando, setMarcando] = useState(false);
  const hoje = chaveDia(new Date());
  const dias = diasAte(hoje, p.proximaConsulta);

  return (
    <>
      <section className="cartao cuidado-cartao cuidado-cabecalho" aria-labelledby={`prof-${p.id}`}>
        <div className="linha-ajuste">
          <div className="quebra">
            <h2 id={`prof-${p.id}`}>{p.nome}</h2>
            {p.especialidade && <p className="texto-suave">{p.especialidade}</p>}
          </div>
          <span className="linha-ajuste">
            <Button className="botao-icone" onPress={aoEditar} aria-label={`${t.editar}: ${p.nome}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
            <Button className="botao-icone" onPress={aoExcluir} aria-label={`${t.excluirProf}: ${p.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
          </span>
        </div>

        <div className="cuidado-consulta">
          <CalendarDays aria-hidden="true" size="1.6em" className="cuidado-consulta-icone" />
          <div className="cuidado-consulta-texto">
            <span className="campo-rotulo">{t.proximaConsulta}</span>
            {dias === null ? (
              <span className="texto-suave">{t.semProxima}</span>
            ) : dias < 0 ? (
              <span>{t.consulta.passou(dataLegivel(p.proximaConsulta))}</span>
            ) : (
              <>
                <strong className="cuidado-consulta-data">{dataPorExtenso(p.proximaConsulta)}</strong>
                <span className="texto-suave">{t.consulta.contagem(dias)}</span>
              </>
            )}
          </div>
          <Button className={dias === null || dias < 0 ? "botao principal" : "botao"} onPress={() => setMarcando(true)}>
            {dias === null || dias < 0 ? t.consulta.marcar : t.consulta.mudar}
          </Button>
        </div>

        <details className="cuidado-recolhivel">
          <summary>{t.sobre}</summary>
          {p.sobre ? <TextoRico markdown={p.sobre} /> : <p className="texto-suave">{t.semSobre}</p>}
        </details>
      </section>

      <section className="cartao cuidado-cartao" aria-labelledby={`pauta-${p.id}`}>
        <h2 id={`pauta-${p.id}`}>{t.pauta.titulo}</h2>
        <p className="texto-suave">{t.pauta.intro}</p>
        <ListaNotas profissionalId={p.id} tipo="pauta" rotulos={{ campo: t.pauta.campo, adicionar: t.pauta.adicionar, vazio: t.pauta.vazio, marcar: t.pauta.marcar, desmarcar: t.pauta.desmarcar, feitas: t.pauta.feitas }} />
      </section>

      <section className="cartao cuidado-cartao" aria-labelledby={`perguntas-${p.id}`}>
        <h2 id={`perguntas-${p.id}`}>{t.perguntas.titulo}</h2>
        <p className="texto-suave">{t.perguntas.intro}</p>
        <ListaNotas profissionalId={p.id} tipo="pergunta" rotulos={{ campo: t.perguntas.campo, adicionar: t.perguntas.adicionar, vazio: t.perguntas.vazio, marcar: t.perguntas.marcar, desmarcar: t.perguntas.desmarcar, feitas: t.perguntas.feitas }} />
        <RemediosAtuais />
      </section>

      <SessoesRegistro profissionalId={p.id} />

      <JanelaMarcarConsulta aberta={marcando} aoFechar={() => setMarcando(false)} fixo={p} />
    </>
  );
}

/** Lembra os remédios cadastrados na Saúde, para ajudar a perguntar. */
function RemediosAtuais() {
  const [remedios, setRemedios] = useState<Remedio[]>([]);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarRemedios().then((rs) => setRemedios(rs.filter((r) => r.estado === "ativo")), () => {});
  }, [mudancas]);

  return (
    <details className="cuidado-recolhivel">
      <summary>{t.perguntas.remediosAtuais}</summary>
      <p className="campo-ajuda">{t.perguntas.ajudaRemedios}</p>
      {remedios.length === 0 ? (
        <p className="texto-suave">{t.perguntas.semRemedios}</p>
      ) : (
        <ul className="lista-simples sem-marcador">
          {remedios.map((r) => (
            <li key={r.id}>{t.perguntas.remedioLinha(r.nome, r.dose)}</li>
          ))}
        </ul>
      )}
    </details>
  );
}

function SessoesRegistro({ profissionalId }: { profissionalId: string }) {
  const [escrevendo, setEscrevendo] = useState(false);
  const [data, setData] = useState(() => chaveDia(new Date()));
  const [nota, setNota] = useState("");
  const [sessoes, setSessoes] = useState<RegistroSessao[]>([]);
  const [apagando, setApagando] = useState<RegistroSessao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();
  const recado = useRecado();

  useEffect(() => {
    api.listarSessoes(profissionalId).then(setSessoes, () => {});
  }, [profissionalId, mudancas]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nota.trim()) {
      setErro(t.sessoes.semTexto);
      return;
    }
    setErro(null);
    try {
      await api.registrarSessao(profissionalId, data, nota);
      setNota("");
      setData(chaveDia(new Date()));
      setEscrevendo(false);
      avisarMudanca();
      recado(t.sessoes.salvo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  const apagar = async () => {
    if (!apagando) return;
    await api.excluirSessao(apagando.id);
    setApagando(null);
    avisarMudanca();
  };

  return (
    <section className="cartao cuidado-cartao" aria-labelledby={`sessoes-${profissionalId}`}>
      <div className="linha-ajuste">
        <h2 id={`sessoes-${profissionalId}`}><Quote aria-hidden="true" size="1em" /> {t.sessoes.titulo}</h2>
        {!escrevendo && (
          <Button className="botao principal" onPress={() => setEscrevendo(true)}>
            <Plus aria-hidden="true" size="1.1em" /> {t.sessoes.nova}
          </Button>
        )}
      </div>
      <p className="texto-suave">{t.sessoes.intro}</p>
      {escrevendo && (
        <Form className="formulario cuidado-sessao-form" onSubmit={guardar}>
          <CampoData rotulo={t.sessoes.data} tipo="date" valor={data} aoMudar={setData} />
          <CampoRico rotulo={t.sessoes.campo} valor={nota} aoMudar={setNota} />
          <Aviso>{erro}</Aviso>
          <div className="botoes">
            <Button className="botao" onPress={() => { setEscrevendo(false); setErro(null); }}>{textos.comum.cancelar}</Button>
            <Button className="botao principal" type="submit">{t.sessoes.salvar}</Button>
          </div>
        </Form>
      )}
      {sessoes.length === 0 ? (
        !escrevendo && <p className="texto-suave">{t.sessoes.vazio}</p>
      ) : (
        <ul className="lista-simples sem-marcador">
          {sessoes.map((s) => (
            <li key={s.id} className="cuidado-sessao">
              <div className="linha-ajuste">
                <strong>{s.data ? t.sessoes.em(dataLegivel(s.data)) : t.sessoes.semData}</strong>
                <Button className="botao-icone" onPress={() => setApagando(s)} aria-label={`${t.sessoes.excluir}${s.data ? `: ${dataLegivel(s.data)}` : ""}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
              </div>
              <TextoRico markdown={s.nota} />
            </li>
          ))}
        </ul>
      )}
      <Confirmar
        titulo={t.sessoes.excluir}
        texto={apagando ? t.sessoes.confirmarExcluir(dataLegivel(apagando.data)) : ""}
        confirmar={t.sessoes.excluir}
        aberta={apagando !== null}
        aoCancelar={() => setApagando(null)}
        aoConfirmar={() => void apagar()}
      />
    </section>
  );
}
