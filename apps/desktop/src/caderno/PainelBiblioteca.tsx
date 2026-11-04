// Aba "Biblioteca" do painel lateral: guardar o que está selecionado ou a página como
// modelo, e pôr de volta em qualquer caderno. Cada item mostra uma prévia, e dá para
// renomear e apagar (pergunta antes).
import type { Cena } from "@orbita/caderno";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "react-aria-components";
import { useRecado } from "../app/Recado";
import { textos } from "../textos/pt-BR";
import { apagarItemBiblioteca, cenaDoItem, lerItemBiblioteca, renomearItemBiblioteca, useBiblioteca, type DadosBiblioteca, type ItemBiblioteca } from "./biblioteca";

const t = textos.caderno.biblioteca;

export function PainelBiblioteca({ podeGuardarSelecao, aoGuardarSelecao, aoGuardarPagina, aoUsar, previa }: {
  podeGuardarSelecao: boolean;
  aoGuardarSelecao: () => Promise<void>;
  aoGuardarPagina: () => Promise<void>;
  aoUsar: (item: ItemBiblioteca, dados: DadosBiblioteca) => void;
  /** Desenha a prévia de um item com desenho (objetos ou página). */
  previa: (item: ItemBiblioteca, dados: DadosBiblioteca, cena: Cena) => ReactNode;
}) {
  const recado = useRecado();
  const itens = useBiblioteca();
  const [dados, setDados] = useState<Record<string, DadosBiblioteca | null>>({});
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let vivo = true;
    for (const i of itens) {
      if (i.id in dados) continue;
      void lerItemBiblioteca(i.id).then((d) => { if (vivo) setDados((m) => ({ ...m, [i.id]: d })); });
    }
    return () => { vivo = false; };
  }, [itens, dados]);
  const guardar = async (f: () => Promise<void>) => {
    setOcupado(true);
    try { await f(); recado(t.guardado); } catch (e) { recado(t.erro(e instanceof Error ? e.message : String(e))); } finally { setOcupado(false); }
  };
  const textoDe = (html?: string) => { const d = document.createElement("div"); d.innerHTML = html ?? ""; return (d.textContent ?? "").replace(/\s+/g, " ").trim(); };
  return (
    <div className="painel-bib">
      <p className="texto-suave pequeno">{t.ajuda}</p>
      <div className="painel-ia-linha">
        <Button className="botao pequeno" isDisabled={!podeGuardarSelecao || ocupado} onPress={() => void guardar(aoGuardarSelecao)}>{t.guardarSelecao}</Button>
        <Button className="botao pequeno" isDisabled={ocupado} onPress={() => void guardar(aoGuardarPagina)}>{t.guardarPagina}</Button>
      </div>
      {!podeGuardarSelecao && <p className="texto-suave pequeno">{t.dicaSelecao}</p>}
      {!itens.length && <p className="texto-suave">{t.vazio}</p>}
      <ul className="painel-bib-lista">
        {itens.map((i) => {
          const d = dados[i.id];
          const cena = cenaDoItem(d ?? null);
          return (
            <li key={i.id} className="painel-bib-item">
              <div className="painel-bib-previa" aria-hidden="true">
                {i.tipo === "trecho" ? <span className="painel-bib-trecho">{textoDe(d?.html).slice(0, 140)}</span> : d && cena ? previa(i, d, cena) : null}
              </div>
              {renomeando?.id === i.id ? (
                <form className="painel-ia-linha" onSubmit={(e) => { e.preventDefault(); void renomearItemBiblioteca(i.id, renomeando.nome); setRenomeando(null); }}>
                  <input className="entrada-texto" autoFocus value={renomeando.nome} maxLength={80} aria-label={t.nome} onChange={(e) => setRenomeando({ id: i.id, nome: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Escape") setRenomeando(null); }} />
                  <Button type="submit" className="botao pequeno">{t.ok}</Button>
                </form>
              ) : (
                <p className="painel-bib-nome"><strong>{i.nome}</strong> <span className="texto-suave pequeno">· {t.tipos[i.tipo]}</span></p>
              )}
              {apagando === i.id ? (
                <div className="painel-ia-linha" role="group" aria-label={t.apagarPergunta(i.nome)}>
                  <span className="pequeno">{t.apagarPergunta(i.nome)}</span>
                  <Button className="botao pequeno" onPress={() => setApagando(null)}>{textos.comum.cancelar}</Button>
                  <Button className="botao pequeno perigo" onPress={() => { void apagarItemBiblioteca(i.id); setApagando(null); }}>{t.apagarSim}</Button>
                </div>
              ) : (
                <div className="painel-ia-linha">
                  <Button className="botao pequeno principal" isDisabled={!d} onPress={() => { if (d) { aoUsar(i, d); recado(t.usado(i.tipo)); } }}>{t.usar[i.tipo]}</Button>
                  <Button className="botao pequeno" onPress={() => setRenomeando({ id: i.id, nome: i.nome })}>{t.renomear}</Button>
                  <Button className="botao pequeno" onPress={() => setApagando(i.id)}>{t.apagar}</Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
