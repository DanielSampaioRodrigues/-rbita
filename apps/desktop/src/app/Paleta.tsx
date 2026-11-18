// Buscar ou fazer algo (Ctrl + K): uma caixa só para ir a qualquer espaço, achar uma ideia,
// um projeto, um caderno ou um livro pelo nome, e guardar uma ideia na hora.
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Janela } from "../componentes/Janela";
import { avisarMudanca } from "../dados";
import { usePreferencias } from "../estado";
import { SECOES_JUNTAS, type SecaoMenu } from "../preferencias";
import { textos } from "../textos/pt-BR";
import { pedirAbrir } from "./abrirDepois";
import { ICONES } from "./Moldura";
import { useRecado } from "./Recado";

const t = textos.paleta;
const limpo = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Item { id: string; nome: string; tipo: string; secao: SecaoMenu; fazer: () => void }

/** Os itens que batem com o que a pessoa escreveu (sem acento, em qualquer parte do nome). */
export function filtrar<T extends { nome: string }>(itens: T[], busca: string, maximo = 12): T[] {
  const q = limpo(busca.trim());
  if (!q) return itens.slice(0, maximo);
  const comeca: T[] = [], contem: T[] = [];
  for (const i of itens) { const n = limpo(i.nome); if (n.startsWith(q)) comeca.push(i); else if (n.includes(q)) contem.push(i); }
  return [...comeca, ...contem].slice(0, maximo);
}

export function Paleta({ aberta, aoFechar, aoIr, aoAbrirProjeto }: { aberta: boolean; aoFechar: () => void; aoIr: (s: SecaoMenu) => void; aoAbrirProjeto: (id: string) => void }) {
  const { prefs } = usePreferencias();
  const recado = useRecado();
  const [busca, setBusca] = useState("");
  const [coisas, setCoisas] = useState<Item[]>([]);
  const ir = (s: SecaoMenu) => () => aoIr(s);

  useEffect(() => {
    if (!aberta) return;
    setBusca("");
    const quieto = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
    void Promise.all([quieto(api.listarProjetos()), quieto(api.listarCadernos()), quieto(api.listarLivros()), quieto(api.listarIdeias())]).then(([projetos, cadernos, livros, ideias]) => {
      setCoisas([
        ...projetos.map((p): Item => ({ id: `p${p.id}`, nome: p.titulo, tipo: t.tipos.projeto, secao: "projetos", fazer: () => aoAbrirProjeto(p.id) })),
        ...cadernos.map((c): Item => ({ id: `c${c.id}`, nome: c.nome, tipo: t.tipos.caderno, secao: "caderno", fazer: () => { pedirAbrir("caderno", c.id); aoIr("caderno"); } })),
        ...livros.map((l): Item => ({ id: `l${l.id}`, nome: l.titulo, tipo: t.tipos.livro, secao: "leitura", fazer: () => { pedirAbrir("livro", l.id); aoIr("leitura"); } })),
        ...ideias.map((i): Item => ({ id: `i${i.id}`, nome: i.texto, tipo: t.tipos.ideia, secao: "ideias", fazer: ir("ideias") })),
      ]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  const lugares = useMemo(() => prefs.menu.ordem.filter((s) => !prefs.menu.ocultos.includes(s) && !SECOES_JUNTAS[s])
    .map((s): Item => ({ id: `s${s}`, nome: textos.secoes[s], tipo: t.tipos.ir, secao: s, fazer: ir(s) })), // eslint-disable-next-line react-hooks/exhaustive-deps
  [prefs.menu]);
  const achados = busca.trim() ? [...filtrar(lugares, busca, 6), ...filtrar(coisas, busca, 10)] : lugares;
  const escolher = (i: Item) => { aoFechar(); i.fazer(); };
  const guardar = async () => {
    const v = busca.trim();
    if (!v) return;
    try { await api.criarIdeia(v); avisarMudanca(); recado(t.guardada); aoFechar(); } catch (e) { recado(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Janela titulo={t.titulo} aberta={aberta} aoFechar={aoFechar}>
      <form className="paleta" onSubmit={(e) => { e.preventDefault(); if (achados[0]) escolher(achados[0]); else void guardar(); }}>
        <input className="entrada-texto sozinha paleta-campo" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t.campo} aria-label={t.titulo} autoComplete="off" />
        <ul className="paleta-lista">
          {achados.map((i) => {
            const Icone = ICONES[i.secao];
            return (
              <li key={i.id}>
                <button type="button" className="paleta-item" onClick={() => escolher(i)}>
                  <Icone aria-hidden="true" size="1.1em" strokeWidth={1.75} />
                  <span className="paleta-nome">{i.nome}</span>
                  <small>{i.tipo}</small>
                </button>
              </li>
            );
          })}
          {busca.trim() && (
            <li><button type="button" className="paleta-item" onClick={() => void guardar()}><span className="paleta-nome">{t.guardar(busca.trim().length > 40 ? `${busca.trim().slice(0, 39)}…` : busca.trim())}</span><small>{t.tipos.ideia}</small></button></li>
          )}
        </ul>
        <p className="campo-ajuda">{t.ajuda}</p>
      </form>
    </Janela>
  );
}
