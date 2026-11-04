// Painel ao lado da folha (como no Goodnotes), com abas: Páginas (miniaturas para ir
// direto a uma página, todas ou só as marcadas), IA, Fontes e Biblioteca. Abre e fecha pela
// barra de cima; o lado (esquerda ou direita) fica nas configurações do caderno.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "react-aria-components";
import type { PaginaCaderno } from "../api";
import { Segmentado } from "../componentes/Segmentado";
import { Bookmark, Plus, X } from "../icones";
import { textos } from "../textos/pt-BR";

const t = textos.caderno.painel;
export type AbaPainel = "paginas" | "ia" | "fontes" | "biblioteca";

export function PainelLateral({ aba, aoAba, aoFechar, paginas, atualId, miniatura, aoIr, aoAdicionar, aoVerGrade, ia, fontes, biblioteca }: {
  aba: AbaPainel;
  aoAba: (a: AbaPainel) => void;
  aoFechar: () => void;
  paginas: PaginaCaderno[];
  atualId: string | null;
  /** Desenha a miniatura de uma página (vem do caderno). */
  miniatura: (p: PaginaCaderno, largura: number) => ReactNode;
  aoIr: (id: string) => void;
  aoAdicionar: () => void;
  aoVerGrade: () => void;
  ia: ReactNode;
  fontes: ReactNode;
  biblioteca: ReactNode;
}) {
  const [filtro, setFiltro] = useState<"todas" | "marcadas">("todas");
  const lista = useRef<HTMLOListElement>(null);
  const mostradas = paginas.map((p, i) => ({ p, n: i + 1 })).filter(({ p }) => filtro === "todas" || p.marcado);
  // A página atual fica sempre à vista na lista.
  useEffect(() => {
    if (aba !== "paginas" || !atualId) return;
    lista.current?.querySelector(`[data-pagina="${atualId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [aba, atualId, filtro]);
  const abas: AbaPainel[] = ["paginas", "ia", "fontes", "biblioteca"];
  return (
    <aside className="caderno-painel" aria-label={t.titulo}>
      <div className="caderno-painel-topo">
        <div className="caderno-painel-abas" role="tablist" aria-label={t.titulo}>
          {abas.map((a) => (
            <button key={a} type="button" role="tab" aria-selected={aba === a} className={aba === a ? "caderno-painel-aba ativa" : "caderno-painel-aba"} onClick={() => aoAba(a)}>{t.abas[a]}</button>
          ))}
        </div>
        <Button className="botao-icone" onPress={aoFechar} aria-label={t.fechar}><X aria-hidden="true" size="1.05em" /></Button>
      </div>
      <div className="caderno-painel-miolo" role="tabpanel" aria-label={t.abas[aba]}>
        {aba === "paginas" && (
          <>
            <div className="caderno-painel-filtro">
              <Segmentado rotulo={t.mostrar} rotuloOculto valor={filtro} aoMudar={(v) => setFiltro(v as "todas" | "marcadas")}
                opcoes={[{ valor: "todas", nome: t.todas }, { valor: "marcadas", nome: t.marcadas }]} />
            </div>
            {filtro === "marcadas" && !mostradas.length && <p className="texto-suave pequeno caderno-painel-vazio">{t.nenhumaMarcada}</p>}
            <ol className="caderno-painel-paginas" ref={lista}>
              {mostradas.map(({ p, n }) => (
                <li key={p.id}>
                  <button type="button" data-pagina={p.id} className={p.id === atualId ? "caderno-painel-pagina atual" : "caderno-painel-pagina"}
                    aria-current={p.id === atualId ? "page" : undefined} aria-label={t.irPara(n, p.titulo)} onClick={() => aoIr(p.id)}>
                    {miniatura(p, 150)}
                    <span className="caderno-painel-numero">{p.marcado && <Bookmark aria-hidden="true" size="0.85em" />}{n}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="caderno-painel-acoes">
              <Button className="botao pequeno com-icone" onPress={aoAdicionar}><Plus aria-hidden="true" size="1em" /> {t.adicionar}</Button>
              <Button className="botao pequeno" onPress={aoVerGrade}>{t.verGrade}</Button>
            </div>
          </>
        )}
        {aba === "ia" && ia}
        {aba === "fontes" && fontes}
        {aba === "biblioteca" && biblioteca}
      </div>
    </aside>
  );
}
