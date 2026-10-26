import { useEffect, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type Profissional, type RegistroSessao, type Remedio } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { CampoRico } from "../componentes/CampoRico";
import { TextoRico } from "../componentes/TextoRico";
import { Confirmar, Janela } from "../componentes/Janela";
import { Pencil, Plus, Quote, Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { ListaNotas } from "./ListaNotas";

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

  const selecionado = profissionais.find((p) => p.id === selecionadoId) ?? null;

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <div className="botoes">
        <Button className="botao principal" onPress={() => setEditando(profNovo())}>
          <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
        </Button>
      </div>

      {profissionais.length === 0 ? (
        <section className="cartao largura-leitura esticado"><p className="texto-suave">{t.semProfissionais}</p></section>
      ) : (
        <>
          <div className="cuidado-abas" role="tablist" aria-label={t.escolher}>
            {profissionais.map((p) => (
              <Button
                key={p.id}
                className={p.id === selecionadoId ? "cuidado-aba ativa" : "cuidado-aba"}
                onPress={() => setSelecionadoId(p.id)}
                aria-pressed={p.id === selecionadoId}
              >
                <strong>{p.nome}</strong>
                {p.especialidade && <span className="texto-suave pequeno"> · {p.especialidade}</span>}
              </Button>
            ))}
          </div>

          {selecionado && (
            <PainelProfissional
              profissional={selecionado}
              aoEditar={() => setEditando(selecionado)}
              aoExcluir={() => setExcluindo(selecionado)}
            />
          )}
        </>
      )}

      <Aviso>{erro}</Aviso>

      <Janela titulo={editando && editando.id ? t.form.editarTitulo : t.form.novo} aberta={editando !== null} aoFechar={() => setEditando(null)}>
        {editando && <FormProfissional key={editando.id || "novo"} inicial={editando} aoSalvo={(id) => setSelecionadoId(id)} aoFechar={() => setEditando(null)} />}
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
    <Form className="formulario" onSubmit={enviar}>
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

function PainelProfissional({ profissional, aoEditar, aoExcluir }: { profissional: Profissional; aoEditar: () => void; aoExcluir: () => void }) {
  return (
    <>
      <section className="cartao largura-leitura esticado">
        <div className="linha-ajuste">
          <h2>{profissional.nome}{profissional.especialidade && <span className="texto-suave"> · {profissional.especialidade}</span>}</h2>
          <span className="linha-ajuste">
            <Button className="botao-icone" onPress={aoEditar} aria-label={`${t.editar}: ${profissional.nome}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
            <Button className="botao-icone" onPress={aoExcluir} aria-label={`${t.excluirProf}: ${profissional.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
          </span>
        </div>
        <p className={profissional.proximaConsulta ? "" : "texto-suave"}>
          {profissional.proximaConsulta ? t.proximaConsultaEm(dataLegivel(profissional.proximaConsulta)) : t.semProxima}
        </p>
        {profissional.sobre && <TextoRico markdown={profissional.sobre} />}
      </section>

      <section className="cartao largura-leitura esticado" aria-label={t.pauta.titulo}>
        <h2>{t.pauta.titulo}</h2>
        <p className="texto-suave">{t.pauta.intro}</p>
        <ListaNotas profissionalId={profissional.id} tipo="pauta" rotulos={{ campo: t.pauta.campo, adicionar: t.pauta.adicionar, vazio: t.pauta.vazio, marcar: t.pauta.marcar, desmarcar: t.pauta.desmarcar }} />
      </section>

      <section className="cartao largura-leitura esticado" aria-label={t.perguntas.titulo}>
        <h2>{t.perguntas.titulo}</h2>
        <p className="texto-suave">{t.perguntas.intro}</p>
        <ListaNotas profissionalId={profissional.id} tipo="pergunta" rotulos={{ campo: t.perguntas.campo, adicionar: t.perguntas.adicionar, vazio: t.perguntas.vazio, marcar: t.perguntas.marcar, desmarcar: t.perguntas.desmarcar }} />
        <RemediosAtuais />
      </section>

      <SessoesRegistro profissionalId={profissional.id} />
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
    <div className="campo">
      <span className="campo-rotulo">{t.perguntas.remediosAtuais}</span>
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
    </div>
  );
}

function SessoesRegistro({ profissionalId }: { profissionalId: string }) {
  const [data, setData] = useState("");
  const [nota, setNota] = useState("");
  const [sessoes, setSessoes] = useState<RegistroSessao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();
  const recado = useRecado();

  useEffect(() => {
    api.listarSessoes(profissionalId).then(setSessoes, () => {});
  }, [profissionalId, mudancas]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nota.trim()) return;
    setErro(null);
    try {
      await api.registrarSessao(profissionalId, data, nota);
      setNota("");
      setData("");
      avisarMudanca();
      recado(t.sessoes.salvo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  const apagar = async (id: string) => {
    await api.excluirSessao(id);
    avisarMudanca();
  };

  return (
    <section className="cartao largura-leitura esticado" aria-label={t.sessoes.titulo}>
      <h2><Quote aria-hidden="true" size="1em" /> {t.sessoes.titulo}</h2>
      <p className="texto-suave">{t.sessoes.intro}</p>
      <Form className="formulario" onSubmit={guardar}>
        <CampoData rotulo={t.sessoes.data} tipo="date" valor={data} aoMudar={setData} />
        <CampoRico rotulo={t.sessoes.campo} valor={nota} aoMudar={setNota} />
        <div className="botoes">
          <Button className="botao principal" type="submit">{t.sessoes.salvar}</Button>
        </div>
      </Form>
      <Aviso>{erro}</Aviso>
      {sessoes.length === 0 ? (
        <p className="texto-suave">{t.sessoes.vazio}</p>
      ) : (
        <ul className="lista-simples sem-marcador">
          {sessoes.map((s) => (
            <li key={s.id} className="cuidado-sessao">
              <div className="linha-ajuste">
                <strong>{s.data ? t.sessoes.em(dataLegivel(s.data)) : t.sessoes.semData}</strong>
                <Button className="botao-icone" onPress={() => void apagar(s.id)} aria-label={t.sessoes.excluir}><Trash2 aria-hidden="true" size="1.1em" /></Button>
              </div>
              <TextoRico markdown={s.nota} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
