// A tela de entrada do Órbita: o céu em 3D com os dados da pessoa. Por cima do céu ficam
// o caminho (onde estou), os controles, o cartão do que está escolhido e a barra de escrever.
// Tudo o que o céu mostra também está no cartão, em lista: dá para usar só com o teclado.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { expandir, inicioDoDia, somarDias } from "../agenda/datas";
import { api } from "../api";
import { pedirAbrir } from "../app/abrirDepois";
import { useEntrarImersivo } from "../app/Imersivo";
import type { Secao } from "../app/Moldura";
import { useRecado } from "../app/Recado";
import { avisarMudanca, useMudancas } from "../dados";
import { usePreferencias } from "../estado";
import { SECOES_JUNTAS } from "../preferencias";
import { textos } from "../textos/pt-BR";
import { criarCena, type Cena } from "./cena";
import { ESPACOS, montarUniverso, type Alvo, type DadosOrbita, type EspacoEntrada, type No } from "./universo";

const t = textos.orbita;
const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Junta do banco o que vai para o céu: o hoje e as coisas de cada espaço. */
async function carregar(visiveis: Secao[]): Promise<DadosOrbita> {
  const tem = (s: Secao) => visiveis.includes(s);
  const quieto = <T,>(p: Promise<T>, vazio: T) => p.catch(() => vazio);
  const ini = inicioDoDia(new Date()), fim = somarDias(ini, 1);
  const [eventos, cadernos, projetos, ideias, livros, materias] = await Promise.all([
    quieto(api.listarEventos(ini.getTime(), fim.getTime()), []),
    tem("caderno") ? quieto(api.listarCadernos(), []) : [],
    tem("projetos") ? quieto(api.listarProjetos(), []) : [],
    tem("ideias") ? quieto(api.listarIdeias(), []) : [],
    tem("leitura") ? quieto(api.listarLivros(), []) : [],
    tem("estudos") ? quieto(api.listarMaterias(), []) : [],
  ]);
  const agora = Date.now();
  const doDia = expandir(eventos, ini, fim).filter((o) => !o.evento.diaInteiro && (o.fim?.getTime() ?? o.inicio.getTime()) >= agora).sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const proximo = doDia.find((o) => o.inicio.getTime() > agora), acontecendo = doDia.find((o) => o.inicio.getTime() <= agora);
  const coisas: Partial<Record<Secao, EspacoEntrada>> = {
    caderno: { secao: "caderno", novo: t.novo.caderno, coisas: cadernos.map((c) => ({ id: c.id, nome: c.nome, det: t.tipoCaderno[c.modo], alvo: { tipo: "caderno", id: c.id, secao: "caderno" } })) },
    projetos: { secao: "projetos", novo: t.novo.projetos, coisas: projetos.filter((p) => p.estado === "ativo" || p.estado === "em_uso").map((p) => ({ id: p.id, nome: p.titulo, det: p.ondeParei?.texto ? t.ondeParei(p.ondeParei.texto) : undefined, alvo: { tipo: "projeto", id: p.id, secao: "projetos" } })) },
    ideias: { secao: "ideias", novo: t.novo.ideias, coisas: ideias.slice(0, 40).map((i) => ({ id: i.id, nome: i.texto.length > 30 ? `${i.texto.slice(0, 29)}…` : i.texto, det: i.texto, alvo: { tipo: "secao", secao: "ideias" } })) },
    leitura: { secao: "leitura", novo: t.novo.leitura, coisas: [...livros].sort((a, b) => Number(b.status === "lendo") - Number(a.status === "lendo")).map((l) => ({ id: l.id, nome: l.titulo, det: l.ondeParei ? t.ondeParei(l.ondeParei) : l.autor || undefined, alvo: { tipo: "livro", id: l.id, secao: "leitura" } })) },
    estudos: { secao: "estudos", novo: t.novo.estudos, coisas: materias.map((m) => ({ id: m.id, nome: m.nome, det: m.professor || undefined, alvo: { tipo: "secao", secao: "estudos" } })) },
  };
  return {
    agora: acontecendo ? t.agoraEm(acontecendo.evento.titulo) : proximo ? t.livreAte(hora(proximo.inicio)) : t.livre,
    hoje: doDia.map((o) => ({ id: `${o.evento.id}:${o.dia}`, nome: `${o.evento.titulo} · ${hora(o.inicio)}`, det: o.evento.notas || undefined, alvo: { tipo: "secao", secao: "agenda" } })),
    espacos: visiveis.filter((s) => ESPACOS[s]).map((s) => coisas[s] ?? { secao: s }),
  };
}

/** `calmo`: aberto de dentro do baixo estímulo. Começa parado e com menos efeitos, não grava preferência, e "Lista" só fecha o céu (`aoLista`). */
export function Orbita({ aoIr, aoAbrirProjeto, aoCapturar, aoBuscar, calmo = false, aoLista }: { aoIr: (s: Secao) => void; aoAbrirProjeto: (id: string) => void; aoCapturar: () => void; aoBuscar: () => void; calmo?: boolean; aoLista?: () => void }) {
  useEntrarImersivo();
  const { prefs, mudar } = usePreferencias();
  const recado = useRecado();
  const versao = useMudancas();
  const tela = useRef<HTMLDivElement>(null), nomes = useRef<HTMLDivElement>(null), cena = useRef<Cena | null>(null);
  const [foco, setFoco] = useState<No | null>(null);
  const [sel, setSel] = useState<No | null>(null);
  const [pesado, setPesado] = useState(false);
  const [passear, setPassear] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState(false);
  const abrirRef = useRef<(n: No) => void>(() => {});
  const orb = prefs.orbita, orbRef = useRef(orb); orbRef.current = orb;
  const [velCalma, setVelCalma] = useState<0 | 1 | 2>(2);
  const vel = calmo ? velCalma : orb.velocidade, red = calmo || orb.reduzido;
  const inicial = useRef({ vel, red });
  const lista = () => (calmo && aoLista ? aoLista() : mudarOrbita({ inicio: false }));
  const mudarOrbita = useCallback((m: Partial<typeof orb>) => mudar({ orbita: { ...orbRef.current, ...m } }), [mudar]);
  const visiveis = useMemo(() => prefs.menu.ordem.filter((s) => !prefs.menu.ocultos.includes(s) && !SECOES_JUNTAS[s]), [prefs.menu]);

  // Monta a cena uma vez.
  useEffect(() => {
    if (!tela.current || !nomes.current) return;
    try {
      const c = criarCena(tela.current, nomes.current, {
        velocidade: inicial.current.vel, reduzido: inicial.current.red,
        aoMudar: (f, tocado) => { setFoco(f); if (tocado !== undefined) setSel(tocado && tocado.filhos.length === 0 ? tocado : null); },
        aoAbrir: (x) => abrirRef.current(x),
        aoPesado: () => { if (!calmo && !orbRef.current.perguntou && !orbRef.current.reduzido) setPesado(true); },
      });
      cena.current = c;
      return () => { c.destruir(); cena.current = null; };
    } catch { setErro(true); }
  }, []);
  // Os dados mudaram (ou o menu): refaz o céu, mantendo a vista.
  useEffect(() => {
    let vivo = true;
    void carregar(visiveis).then((d) => { if (vivo) cena.current?.definir(montarUniverso(d)); });
    return () => { vivo = false; };
  }, [versao, visiveis]);
  useEffect(() => { cena.current?.velocidade(vel); cena.current?.reduzir(red); }, [vel, red]);
  useEffect(() => { cena.current?.passear(passear); }, [passear]);

  const abrir = (n: No) => {
    const a: Alvo | undefined = n.alvo;
    if (n.tipo === "agora") return aoIr("foco");
    if (!a) return;
    if (a.tipo === "projeto") return aoAbrirProjeto(a.id);
    if (a.tipo === "caderno" || a.tipo === "livro") pedirAbrir(a.tipo, a.id);
    aoIr(a.secao);
  };
  abrirRef.current = abrir;
  const ir = (n: No) => cena.current?.irPara(n);
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = texto.trim();
    if (!v) return;
    try { await api.criarIdeia(v); setTexto(""); avisarMudanca(); recado(t.ideiaGuardada); } catch (x) { recado(x instanceof Error ? x.message : String(x)); }
  };

  if (erro) return <div className="orbita-sem"><p>{t.sem3d}</p><Button className="botao principal" onPress={lista}>{t.usarLista}</Button></div>;
  const n = sel ?? foco;
  const trilha: No[] = []; for (let x = foco; x; x = x.pai) trilha.unshift(x);
  const tipo = !n ? "" : n.tipo === "agora" ? t.tipos.agora : n.tipo === "hoje" ? t.tipos.hoje : n.tipo === "espaco" ? t.tipos.espaco : (trilha[1]?.nome ?? "");
  const acao = !n ? "" : n.tipo === "agora" ? t.comecarFoco : n.tipo === "novo" ? n.nome.replace(/^\+ /, "") : n.tipo === "espaco" ? t.abrirInteiro(n.nome) : n.tipo === "hoje" ? t.verAgenda : t.abrir(n.nome);
  return (
    <div className="orbita">
      <div ref={tela} className="orbita-tela" role="img" aria-label={t.ceu} />
      <div ref={nomes} className="orbita-nomes" aria-hidden="true" />

      <div className="orbita-alto">
        <nav className="orbita-caminho orbita-vidro" aria-label={t.ondeEstou}>
          {trilha.map((x, i) => (
            <span key={x.id}>{i > 0 && <span aria-hidden="true">›</span>}<button type="button" aria-current={x === foco ? "true" : undefined} onClick={() => ir(x)}>{i === 0 ? t.raiz : x.nome}</button></span>
          ))}
        </nav>
        <div className="orbita-controles orbita-vidro" role="group" aria-label={t.controles}>
          <button type="button" title={`${textos.paleta.titulo} (${textos.paleta.atalho})`} onClick={aoBuscar}>{textos.paleta.botao}</button>
          <button type="button" aria-label={t.centro} title={t.centro} onClick={() => trilha[0] && ir(trilha[0])}>⌂</button>
          <button type="button" aria-label={t.afastar} title={t.afastar} onClick={() => cena.current?.zoom(1.55)}>−</button>
          <button type="button" aria-label={t.aproximar} title={t.aproximar} onClick={() => cena.current?.zoom(0.65)}>+</button>
          <button type="button" aria-pressed={passear} title={t.passearDica} onClick={() => setPassear((v) => !v)}>{t.passear}</button>
          <button type="button" title={t.movimentoDica} onClick={() => { const v = ((vel + 1) % 3) as 0 | 1 | 2; if (calmo) setVelCalma(v); else mudarOrbita({ velocidade: v }); }}><span className="orbita-so-largo">{t.movimento} </span>{t.velocidades[vel]}</button>
          <button type="button" title={calmo ? t.voltarLista : t.usarListaDica} onClick={lista}>{t.lista}</button>
        </div>
      </div>

      {n && (
        <aside className="orbita-cartao orbita-vidro" aria-live="polite">
          <span className="orbita-etiqueta" style={{ "--cor": n.cor } as React.CSSProperties}><i />{tipo}</span>
          <h2>{n.nome}</h2>
          {n.det && <p className="orbita-suave">{n.det}</p>}
          <Button className="botao principal" onPress={() => abrir(n)}>{acao}</Button>
          {n.filhos.length > 0 && (
            <details open={typeof window !== "undefined" && window.innerWidth > 900}>
              <summary className="orbita-etiqueta">{n.tipo === "agora" ? t.emOrbita : t.aquiDentro} ({n.filhos.length})</summary>
              <ul className="orbita-filhos">
                {n.filhos.map((k) => (
                  <li key={k.id}><button type="button" style={{ "--cor": k.cor } as React.CSSProperties} onClick={() => ir(k)}><i />{k.nome}{k.filhos.some((x) => x.tipo !== "novo") && <small>{k.filhos.filter((x) => x.tipo !== "novo").length}</small>}</button></li>
                ))}
              </ul>
            </details>
          )}
        </aside>
      )}

      {prefs.recuperacaoPendente && !pesado && (
        <div className="orbita-recuperar orbita-vidro">
          <p>{t.recuperacao}</p>
          <div>
            <Button className="botao principal" onPress={() => { mudar({ recuperacaoPendente: false }); aoIr("ajustes"); }}>{t.recuperacaoSim}</Button>
            <Button className="botao" onPress={() => mudar({ recuperacaoPendente: false })}>{t.recuperacaoNao}</Button>
          </div>
        </div>
      )}
      {pesado && (
        <div className="orbita-pesado orbita-vidro" role="status">
          <p>{t.pesado}</p>
          <div>
            <Button className="botao principal" onPress={() => { setPesado(false); mudarOrbita({ reduzido: true, velocidade: Math.max(1, orb.velocidade) as 1 | 2, perguntou: true }); }}>{t.reduzir}</Button>
            <Button className="botao" onPress={() => { setPesado(false); mudarOrbita({ perguntou: true }); }}>{t.manter}</Button>
          </div>
        </div>
      )}

      <div className="orbita-base orbita-vidro">
        <form onSubmit={(e) => void guardar(e)}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t.escreva} aria-label={t.escrevaRotulo} autoComplete="off" maxLength={2000} />
          <Button type="submit" className="botao principal" isDisabled={!texto.trim()}>{t.guardar}</Button>
          <Button className="botao" onPress={aoCapturar} aria-label={t.capturaCompleta}>⋯</Button>
        </form>
        <p className="orbita-dica">{t.dica}</p>
      </div>
    </div>
  );
}
