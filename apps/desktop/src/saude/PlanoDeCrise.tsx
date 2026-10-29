import { useEffect, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type PlanoSaude, type TipoPlano } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { avisarMudanca, useMudancas } from "../dados";
import { Pencil, Plus, Trash2 } from "../icones";
import { textos } from "../textos/pt-BR";

const t = textos.saude.plano;
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });

function planoVazio(tipo: TipoPlano): PlanoSaude {
  return { id: "", tipo, titulo: "", sinais: "", ajuda: "", contatos: "", atualizadoEm: 0 };
}

/** Janela dos planos de crise e estratégias (o atalho de crise abre esta). */
export function JanelaPlanoDeCrise({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  return (
    <Janela titulo={t.titulo} aberta={aberta} aoFechar={aoFechar} larga>
      <PlanosSaude />
    </Janela>
  );
}

/** Os planos, com criar, editar e apagar. Usado na janela do atalho e na aba "Planos e consultas". */
export function PlanosSaude({ semIntro }: { semIntro?: boolean }) {
  const [planos, setPlanos] = useState<PlanoSaude[]>([]);
  const [editando, setEditando] = useState<PlanoSaude | null>(null);
  const [excluindo, setExcluindo] = useState<PlanoSaude | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();
  const recado = useRecado();

  useEffect(() => {
    api.listarPlanos().then(
      // Os de crise primeiro: é o que se procura com pressa.
      (ps) => setPlanos([...ps].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "crise" ? -1 : 1))),
      (e) => setErro(e instanceof Error ? e.message : String(e)),
    );
  }, [mudancas]);

  const salvar = async (p: PlanoSaude) => {
    await api.salvarPlano(p);
    setEditando(null);
    avisarMudanca();
    recado(t.salvo);
  };

  const excluir = async () => {
    if (!excluindo) return;
    await api.excluirPlano(excluindo.id);
    setExcluindo(null);
    avisarMudanca();
  };

  if (editando) return <FormPlano inicial={editando} aoSalvar={salvar} aoCancelar={() => setEditando(null)} />;

  return (
    <div className="saude-planos">
      {!semIntro && <p className="texto-suave">{t.intro}</p>}
      {planos.length === 0 ? (
        <p>{t.semPlanos}</p>
      ) : (
        <ul className="lista-simples sem-marcador saude-planos-lista">
          {planos.map((p) => (
            <li key={p.id} className={`cartao compacto saude-plano saude-plano-${p.tipo}`}>
              <div className="linha-ajuste">
                <strong className="quebra">
                  <span className="livro-selo">{t.tipos[p.tipo]}</span> {p.titulo}
                </strong>
                <span className="linha-ajuste">
                  <Button className="botao-icone" onPress={() => setEditando(p)} aria-label={`${t.editar}: ${p.titulo}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
                  <Button className="botao-icone" onPress={() => setExcluindo(p)} aria-label={`${t.excluir}: ${p.titulo}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
                </span>
              </div>
              <Secao titulo={t.campos[p.tipo].sinais} texto={p.sinais} />
              <Secao titulo={t.campos[p.tipo].ajuda} texto={p.ajuda} />
              <Secao titulo={t.campos[p.tipo].contatos} texto={p.contatos} />
              {p.atualizadoEm > 0 && <p className="campo-ajuda">{t.atualizadoEm(fmtData.format(p.atualizadoEm))}</p>}
            </li>
          ))}
        </ul>
      )}
      <Aviso>{erro}</Aviso>
      <div className="botoes">
        <Button className="botao principal" onPress={() => setEditando(planoVazio("crise"))}><Plus aria-hidden="true" size="1.1em" /> {t.adicionarCrise}</Button>
        <Button className="botao" onPress={() => setEditando(planoVazio("estrategia"))}><Plus aria-hidden="true" size="1.1em" /> {t.adicionarEstrategia}</Button>
      </div>

      <Confirmar titulo={t.excluir} texto={excluindo ? t.confirmarExcluir(excluindo.titulo) : ""} confirmar={t.excluir} aberta={excluindo !== null} aoCancelar={() => setExcluindo(null)} aoConfirmar={() => void excluir()} />
    </div>
  );
}

function FormPlano({ inicial, aoSalvar, aoCancelar }: { inicial: PlanoSaude; aoSalvar: (p: PlanoSaude) => void; aoCancelar: () => void }) {
  const [plano, setPlano] = useState<PlanoSaude>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const campos = t.campos[plano.tipo];

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await aoSalvar(plano);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario saude-form" onSubmit={enviar}>
      <p className="texto-suave">{t.tipos[plano.tipo]}</p>
      <Campo rotulo={t.titulo_campo} valor={plano.titulo} aoMudar={(v) => setPlano((p) => ({ ...p, titulo: v }))} maximo={80} semDitado autoFocus />
      <Campo rotulo={campos.sinais} valor={plano.sinais} aoMudar={(v) => setPlano((p) => ({ ...p, sinais: v }))} multilinha descricao={campos.sinaisAjuda} />
      <Campo rotulo={campos.ajuda} valor={plano.ajuda} aoMudar={(v) => setPlano((p) => ({ ...p, ajuda: v }))} multilinha descricao={campos.ajudaAjuda} />
      <Campo rotulo={campos.contatos} valor={plano.contatos} aoMudar={(v) => setPlano((p) => ({ ...p, contatos: v }))} multilinha descricao={campos.contatosAjuda} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoCancelar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{t.salvar}</Button>
      </div>
    </Form>
  );
}

function Secao({ titulo, texto }: { titulo: string; texto: string }) {
  if (!texto) return null;
  return (
    <div className="campo">
      <span className="campo-rotulo">{titulo}</span>
      <p className="quebra">{texto}</p>
    </div>
  );
}
