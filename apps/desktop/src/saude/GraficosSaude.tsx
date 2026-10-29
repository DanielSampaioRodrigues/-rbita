import { useEffect, useMemo, useState } from "react";
import { api, type RegistroSaude } from "../api";
import { Segmentado } from "../componentes/Segmentado";
import { useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { COR_TIPO, TIPOS_BONS, TIPOS_DIFICEIS, equilibrio, janelas, resumoPorTipo } from "./visao";

const t = textos.saude.graficos;
const tr = textos.saude.registros;
const fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/** Painel holístico: equilíbrio ao longo do tempo e resumo por tipo. */
export function GraficosSaude({ periodo: periodoFixo }: { periodo?: "7" | "30" | "90" } = {}) {
  const [periodoProprio, setPeriodo] = useState<"7" | "30" | "90">("30");
  const periodo = periodoFixo ?? periodoProprio;
  const [registros, setRegistros] = useState<RegistroSaude[]>([]);
  const mudancas = useMudancas();

  const js = useMemo(() => janelas(new Date(), Number(periodo)), [periodo]);

  useEffect(() => {
    if (js.length === 0) return;
    const de = js[0].inicio;
    const ate = js[js.length - 1].fim;
    api.listarRegistrosSaude(de, ate).then(setRegistros, () => setRegistros([]));
  }, [js, mudancas]);

  const eq = useMemo(() => equilibrio(registros, js), [registros, js]);
  const resumo = useMemo(() => (js.length ? resumoPorTipo(registros, js[0].inicio, js[js.length - 1].fim) : []), [registros, js]);
  const maxBarra = Math.max(1, ...eq.map((b) => b.bons + b.dificeis));
  const vazio = registros.length === 0;

  const resumoDe = (tipos: readonly string[]) => tipos.map((tp) => resumo.find((r) => r.tipo === tp)).filter((r): r is NonNullable<typeof r> => !!r);

  return (
    <div className="saude-graficos">
      {!periodoFixo && <Segmentado
        rotulo={t.periodo}
        valor={periodo}
        aoMudar={setPeriodo}
        opcoes={[
          { valor: "7", nome: t.periodos[7] },
          { valor: "30", nome: t.periodos[30] },
          { valor: "90", nome: t.periodos[90] },
        ]}
      />}

      {vazio ? (
        <p className="texto-suave">{t.semDados}</p>
      ) : (
        <>
          <h3 className="campo-rotulo">{t.equilibrio}</h3>
          <div className="saude-barras-rolagem">
            <ol className="saude-barras" aria-label={t.equilibrioRotulo}>
              {eq.map((b) => (
                <li key={b.inicio} aria-label={`${fmtDia.format(b.inicio)}: ${t.bons} ${b.bons}, ${t.dificeis} ${b.dificeis}`}>
                  <span className="saude-coluna" aria-hidden="true">
                    {b.bons > 0 && <span className="saude-barra cor-musgo" style={{ height: `${Math.max(3, (b.bons / maxBarra) * 100)}%` }} />}
                    {b.dificeis > 0 && <span className="saude-barra cor-areia" style={{ height: `${Math.max(3, (b.dificeis / maxBarra) * 100)}%` }} />}
                  </span>
                  <span className="saude-barra-dia" aria-hidden="true">{fmtDia.format(b.inicio)}</span>
                </li>
              ))}
            </ol>
          </div>
          <ul className="saude-legenda" aria-hidden="true">
            <li><span className="etiqueta-cor cor-musgo" /> {t.bons}</li>
            <li><span className="etiqueta-cor cor-areia" /> {t.dificeis}</li>
          </ul>

          <h3 className="campo-rotulo">{t.resumoTitulo}</h3>
          <div className="graficos-lado-a-lado">
            <ColunaResumo titulo={tr.ladoDificil} itens={resumoDe(TIPOS_DIFICEIS)} />
            <ColunaResumo titulo={tr.ladoBom} itens={resumoDe(TIPOS_BONS)} />
          </div>
        </>
      )}
    </div>
  );
}

function ColunaResumo({ titulo, itens }: { titulo: string; itens: { tipo: string; total: number; media: number | null }[] }) {
  return (
    <div>
      <h4 className="campo-rotulo">{titulo}</h4>
      {itens.length === 0 ? (
        <p className="texto-suave pequeno">—</p>
      ) : (
        <ul className="lista-simples sem-marcador">
          {itens.map((r) => (
            <li key={r.tipo} className="linha-ajuste">
              <span className="etiqueta-chip">
                <span className={`etiqueta-cor cor-${COR_TIPO[r.tipo] ?? "cinza"}`} aria-hidden="true" />
                {tr.tipos[r.tipo as keyof typeof tr.tipos]}
              </span>
              <span className="texto-suave pequeno">
                {t.contagem(r.total)}{r.media != null ? ` · ${t.media(r.media.toFixed(1))}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
