import { ChevronRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Form, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { LinhaDoTempo } from "../projetos/LinhaDoTempo";
import { api, type EstadoProjeto, type Projeto } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { avisarMudanca, useMudancas } from "../dados";
import { useComLimite } from "../projetos/Limite";
import { formatoDia } from "../projetos/OndeParei";
import { textos } from "../textos/pt-BR";

const t = textos.projetos;
const GRUPOS: EstadoProjeto[] = ["ativo", "pausado", "concluido"];

export function Projetos({ aoAbrir, aoMudarLimite }: { aoAbrir: (id: string) => void; aoMudarLimite: () => void }) {
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
  const mudancas = useMudancas();

  useEffect(() => {
    Promise.all([api.listarProjetos(), api.limiteProjetos()]).then(
      ([p, l]) => (setProjetos(p), setLimite(l)),
      (e) => setErro(String(e?.message ?? e)),
    );
  }, [mudancas]);

  const ativos = projetos.filter((p) => p.estado === "ativo").length;

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro} {t.dicaVisoes}</p>
      <div className="botoes">
        <Button className="botao principal" onPress={() => setCriando(true)}>
          <Plus aria-hidden="true" size="1.1em" /> {t.novo}
        </Button>
        <span className="texto-suave">{t.ativosDe(ativos, limite)}</span>
        <Button className="link" onPress={aoMudarLimite}>{t.mudarLimite}</Button>
      </div>
      <Aviso>{erro}</Aviso>

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

      {visao === "linha" && <LinhaDoTempo projetos={projetos} aoAbrir={aoAbrir} />}

      {visao === "lista" && GRUPOS.map((g) => {
        const lista = projetos.filter((p) => p.estado === g);
        if (g === "concluido" && lista.length === 0) return null;
        return (
          <section key={g} className="grupo largura-leitura" aria-labelledby={`grupo-${g}`}>
            <h2 id={`grupo-${g}`}>{t.grupos[g]}</h2>
            {lista.length === 0 ? (
              <p className="texto-suave">{t.vazioGrupo[g]}</p>
            ) : (
              <ul className="lista-cartoes">
                {lista.map((p) => (
                  <li key={p.id}>
                    <CartaoProjeto projeto={p} aoAbrir={() => aoAbrir(p.id)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <NovoProjeto aberta={criando} aoFechar={() => setCriando(false)} aoCriado={(id) => (setCriando(false), aoAbrir(id))} />
    </div>
  );
}

/** Resumo de um projeto: título, próximo passo e progresso. O cartão inteiro abre o projeto. */
export function CartaoProjeto({ projeto: p, aoAbrir }: { projeto: Projeto; aoAbrir: () => void }) {
  const proximo = p.ondeParei?.proximoPasso;
  return (
    <Button className="cartao compacto cartao-projeto" onPress={aoAbrir} aria-label={`${t.abrir}: ${p.titulo}`}>
      <span className="cartao-projeto-texto">
        <span className="cartao-projeto-titulo quebra">{p.titulo}</span>
        <span className={proximo ? "quebra" : "texto-suave"}>{proximo ? t.proximo(proximo) : t.semProximo}</span>
        <span className="texto-suave pequeno">
          {t.progresso(p.tarefasFeitas, p.tarefasTotal)}
          {p.estado === "pausado" && p.pausadoEm ? ` · ${t.pausadoEm(formatoDia.format(p.pausadoEm))}` : ""}
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
