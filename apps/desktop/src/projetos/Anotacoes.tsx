import { useEffect, useRef, useState } from "react";
import { api, type Projeto } from "../api";
import { Aviso } from "../componentes/Campo";
import { CampoRico } from "../componentes/CampoRico";
import { textos } from "../textos/pt-BR";

const t = textos.projeto;
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });
/** Espera depois da última tecla antes de gravar. */
const ESPERA_MS = 800;

/**
 * Anotações livres do projeto, guardadas sozinhas enquanto a pessoa escreve.
 * Projeto que veio de uma ideia começa com a nota dela.
 */
export function AnotacoesProjeto({ projeto }: { projeto: Projeto }) {
  const [texto, setTexto] = useState(projeto.anotacoes);
  const [situacao, setSituacao] = useState<"" | "guardando" | "guardado">("");
  const [erro, setErro] = useState<string | null>(null);
  const atual = useRef(projeto.anotacoes);
  const gravado = useRef(projeto.anotacoes);
  const relogio = useRef<number | null>(null);
  const id = projeto.id;

  const guardarAgora = async () => {
    if (relogio.current) (window.clearTimeout(relogio.current), (relogio.current = null));
    const v = atual.current;
    if (v === gravado.current) {
      setSituacao((s) => (s === "guardando" ? "guardado" : s));
      return;
    }
    try {
      await api.salvarAnotacoesProjeto(id, v);
      gravado.current = v;
      setErro(null);
      // Só diz "guardado" se nada novo foi escrito enquanto gravava.
      if (atual.current === v && !relogio.current) setSituacao("guardado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSituacao("");
    }
  };
  const guardarRef = useRef(guardarAgora);
  guardarRef.current = guardarAgora;

  const mudar = (md: string) => {
    atual.current = md;
    setTexto(md);
    setSituacao("guardando");
    if (relogio.current) window.clearTimeout(relogio.current);
    relogio.current = window.setTimeout(() => void guardarRef.current(), ESPERA_MS);
  };

  // Mudou por fora (outro aparelho, sincronização) e não há nada esperando para gravar: acompanha.
  useEffect(() => {
    if (!relogio.current && projeto.anotacoes !== gravado.current && atual.current === gravado.current) {
      gravado.current = projeto.anotacoes;
      atual.current = projeto.anotacoes;
      setTexto(projeto.anotacoes);
    }
  }, [projeto.anotacoes]);

  // Ao sair da página, grava o que faltava.
  useEffect(() => () => {
    if (relogio.current) void guardarRef.current();
  }, []);

  return (
    <section className="secao-anotacoes largura-leitura" aria-labelledby="titulo-anotacoes">
      <div className="linha-ajuste">
        <h2 id="titulo-anotacoes">{t.anotacoes}</h2>
        <span className="texto-suave pequeno" aria-live="polite">
          {situacao === "guardando" ? t.guardando : situacao === "guardado" ? t.guardado : ""}
        </span>
      </div>
      {projeto.ideiaCriadaEm !== null && <p className="texto-suave pequeno">{t.veioDaIdeia(fmtData.format(projeto.ideiaCriadaEm))}</p>}
      <CampoRico rotulo={t.anotacoes} valor={texto} aoMudar={mudar} descricao={t.anotacoesAjuda} placeholder={t.anotacoesDica} rotuloOculto />
      <Aviso>{erro}</Aviso>
    </section>
  );
}
