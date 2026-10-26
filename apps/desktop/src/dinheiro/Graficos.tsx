import { fatiasPizza, type LinhaTabela } from "./visao";
import { formatarMoeda } from "./moeda";
import { textos } from "../textos/pt-BR";

const t = textos.dinheiro.visao;
const fmtMesCurto = new Intl.DateTimeFormat("pt-BR", { month: "short" });

function nomeMes(chave: string): string {
  const [a, m] = chave.split("-").map(Number);
  return fmtMesCurto.format(new Date(a, m - 1, 1)).replace(".", "");
}

/** Pizza da distribuição por grupo, com legenda escrita (as cores não ficam sozinhas). */
export function Pizza({ linhas }: { linhas: LinhaTabela[] }) {
  const fatias = fatiasPizza(linhas.map((l) => ({ label: l.nome, cor: l.cor, centavos: l.total })));
  if (fatias.length === 0) return <p className="texto-suave">{t.semDados}</p>;
  return (
    <div className="grafico-pizza">
      <svg viewBox="0 0 120 120" width="140" height="140" role="img" aria-label={t.pizzaRotulo}>
        {fatias.map((f) => (
          <path key={f.label} d={f.d} style={{ fill: `var(--etq-${f.cor})` }} stroke="var(--cor-fundo)" strokeWidth="1" />
        ))}
      </svg>
      <ul className="lista-simples sem-marcador grafico-legenda">
        {fatias.map((f) => (
          <li key={f.label} className="linha-ajuste">
            <span className="etiqueta-chip">
              <span className={`etiqueta-cor cor-${f.cor}`} aria-hidden="true" />
              {f.label}
            </span>
            <span className="texto-suave">{formatarMoeda(f.centavos)} · {f.porcentagem}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras verticais do total gasto por mês. */
export function BarrasPorMes({ meses, totaisMes }: { meses: string[]; totaisMes: Record<string, number> }) {
  const valores = meses.map((m) => totaisMes[m] ?? 0);
  const max = Math.max(1, ...valores);
  if (valores.every((v) => v === 0)) return <p className="texto-suave">{t.semDados}</p>;
  return (
    <ol className="grafico-barras" aria-label={t.barrasRotulo}>
      {meses.map((m) => {
        const v = totaisMes[m] ?? 0;
        const altura = Math.round((v / max) * 100);
        return (
          <li key={m} aria-label={`${nomeMes(m)}: ${formatarMoeda(v)}`}>
            <span className="grafico-coluna" aria-hidden="true">
              {v > 0 && <span className="grafico-barra" style={{ height: `${Math.max(2, altura)}%` }} />}
            </span>
            <span className="grafico-dia" aria-hidden="true">{nomeMes(m)}</span>
          </li>
        );
      })}
    </ol>
  );
}
