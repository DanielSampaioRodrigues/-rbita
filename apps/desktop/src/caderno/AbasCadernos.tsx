// As abas dos cadernos abertos, na barra de cima do caderno. A aba atual faz o papel
// de título. Tocar em outra troca de caderno; o "x" fecha a aba (o caderno continua
// guardado na estante).
import { type Caderno } from "../api";
import { FileText, LayoutGrid, PenLine, X } from "../icones";
import { textos } from "../textos/pt-BR";

const t = textos.caderno;

function IconeDoModo({ modo }: { modo: Caderno["modo"] }) {
  if (modo === "infinito") return <LayoutGrid aria-hidden="true" size="0.95em" />;
  if (modo === "documento") return <FileText aria-hidden="true" size="0.95em" />;
  return <PenLine aria-hidden="true" size="0.95em" />;
}

export function AbasCadernos({ abas, atual, aoTrocar, aoFecharAba }: {
  abas: Caderno[]; atual: Caderno; aoTrocar: (c: Caderno) => void; aoFecharAba: (id: string) => void;
}) {
  // O caderno aberto aparece sempre, mesmo que a lista ainda não tenha chegado.
  const lista = abas.some((c) => c.id === atual.id) ? abas : [...abas, atual];
  return (
    <div className="caderno-abas" role="group" aria-label={t.abas}>
      {lista.map((c) => {
        const eAtual = c.id === atual.id;
        return (
          <span key={c.id} className={eAtual ? "caderno-aba atual" : "caderno-aba"}>
            <button type="button" className="caderno-aba-nome" aria-current={eAtual ? "page" : undefined} title={c.nome}
              onClick={() => { if (!eAtual) aoTrocar(c); }}>
              <IconeDoModo modo={c.modo} />
              <span className="caderno-aba-texto">{c.nome}</span>
            </button>
            {lista.length > 1 && (
              <button type="button" className="caderno-aba-fechar" aria-label={t.fecharAba(c.nome)} title={t.fecharAba(c.nome)} onClick={() => aoFecharAba(c.id)}>
                <X aria-hidden="true" size="0.85em" />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
