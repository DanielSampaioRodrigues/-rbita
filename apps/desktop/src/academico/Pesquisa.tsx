import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { Campo } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { Confirmar, Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { BookOpen, CalendarDays, Check, Flag, Lightbulb, Pencil, Plus, RotateCcw, Trash2 } from "../icones";
import { textos } from "../textos/pt-BR";
import { novoId, type LeituraPesquisa, type Pesquisa, type PrazoPesquisa, type ReuniaoOrientacao, type StatusLeitura } from "./extras";
import { diasAte } from "./nivel";

const t = textos.estudos.pesquisa;
const fmtData = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const dataLegivel = (iso: string) => (iso ? fmtData.format(new Date(`${iso}T00:00:00`)) : textos.estudos.semData);

type Mudar = (f: (p: Pesquisa) => Pesquisa) => void;

/** Painel do projeto de pesquisa (mestrado e doutorado). */
export function PainelPesquisa({ pesquisa, mudar, hoje }: { pesquisa: Pesquisa; mudar: Mudar; hoje: string }) {
  const [editandoProjeto, setEditandoProjeto] = useState(false);
  const [prazo, setPrazo] = useState<PrazoPesquisa | null>(null);
  const [leitura, setLeitura] = useState<LeituraPesquisa | null>(null);
  const [reuniao, setReuniao] = useState<ReuniaoOrientacao | null>(null);
  const [apagando, setApagando] = useState<{ tipo: "prazo" | "leitura" | "reuniao"; id: string; nome: string } | null>(null);

  const temProjeto = pesquisa.titulo || pesquisa.orientador;
  const prazos = [...pesquisa.prazos].sort((a, b) => (a.data === b.data ? 0 : a.data === "" ? 1 : b.data === "" ? -1 : a.data < b.data ? -1 : 1));
  const reunioes = [...pesquisa.reunioes].sort((a, b) => (a.data < b.data ? 1 : -1));
  const proximaReuniao = [...pesquisa.reunioes].filter((r) => r.data >= hoje).sort((a, b) => (a.data < b.data ? -1 : 1))[0];
  const lidas = pesquisa.leituras.filter((l) => l.status === "lida").length;

  const salvarNaLista = <K extends "prazos" | "leituras" | "reunioes">(chave: K, item: Pesquisa[K][number]) =>
    mudar((p) => {
      const lista = p[chave] as Pesquisa[K][number][];
      const existe = lista.some((x) => x.id === item.id);
      return { ...p, [chave]: existe ? lista.map((x) => (x.id === item.id ? item : x)) : [...lista, item] };
    });

  const apagar = () => {
    if (!apagando) return;
    const chave = apagando.tipo === "prazo" ? "prazos" : apagando.tipo === "leitura" ? "leituras" : "reunioes";
    mudar((p) => ({ ...p, [chave]: (p[chave] as { id: string }[]).filter((x) => x.id !== apagando.id) }));
    setApagando(null);
  };

  return (
    <div className="estudos-pesquisa">
      <section className="estudos-bloco estudos-projeto" aria-labelledby="pesq-projeto">
        <div className="estudos-bloco-topo">
          <span className="estudos-icone-tipo grande" aria-hidden="true"><Lightbulb size="1.3em" /></span>
          <div className="estudos-bloco-titulos">
            <h2 id="pesq-projeto">{t.titulo}</h2>
            <p className="texto-suave">{t.intro}</p>
          </div>
        </div>
        {temProjeto ? (
          <div className="estudos-projeto-corpo">
            {pesquisa.titulo && <p className="estudos-projeto-titulo">{pesquisa.titulo}</p>}
            {pesquisa.programa && <p className="texto-suave">{pesquisa.programa}</p>}
            <ul className="estudos-chips">
              {pesquisa.orientador && <li className="estudos-chip">{t.orientacao(pesquisa.orientador)}</li>}
              {pesquisa.coorientador && <li className="estudos-chip">{t.coorientacao(pesquisa.coorientador)}</li>}
            </ul>
          </div>
        ) : (
          <p className="texto-suave">{t.semProjeto}</p>
        )}
        <div className="botoes">
          <Button className="botao" onPress={() => setEditandoProjeto(true)}>
            <Pencil aria-hidden="true" size="1em" /> {t.editarProjeto}
          </Button>
        </div>
        <p className="campo-ajuda">{t.ondeFica}</p>
      </section>

      <section className="estudos-bloco" aria-labelledby="pesq-prazos">
        <h2 id="pesq-prazos" className="estudos-bloco-h"><Flag aria-hidden="true" size="1em" /> {t.prazos}</h2>
        <p className="campo-ajuda">{t.prazosAjuda}</p>
        {prazos.length === 0 ? (
          <p className="texto-suave">{t.semPrazos}</p>
        ) : (
          <ul className="estudos-lista">
            {prazos.map((p) => {
              const dias = p.data ? diasAte(hoje, p.data) : null;
              return (
                <li key={p.id} className={p.feito ? "estudos-linha feito" : "estudos-linha"}>
                  <span className="estudos-linha-texto">
                    <strong>{p.nome}</strong>
                    <span className="texto-suave">
                      {dataLegivel(p.data)}
                      {dias != null && !p.feito && <span className="estudos-contagem">{textos.estudos.contagem(dias)}</span>}
                    </span>
                  </span>
                  <span className="estudos-acoes">
                    <Button className="botao-icone estudos-toque" onPress={() => salvarNaLista("prazos", { ...p, feito: !p.feito })} aria-label={`${p.feito ? textos.estudos.desmarcarFeita : textos.estudos.marcarFeita}: ${p.nome}`}>
                      {p.feito ? <RotateCcw aria-hidden="true" size="1.1em" /> : <Check aria-hidden="true" size="1.1em" />}
                    </Button>
                    <Button className="botao-icone estudos-toque" onPress={() => setPrazo(p)} aria-label={`${t.editarPrazo}: ${p.nome}`}>
                      <Pencil aria-hidden="true" size="1.1em" />
                    </Button>
                    <Button className="botao-icone estudos-toque" onPress={() => setApagando({ tipo: "prazo", id: p.id, nome: p.nome })} aria-label={`${t.excluirPrazo}: ${p.nome}`}>
                      <Trash2 aria-hidden="true" size="1.1em" />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="botoes">
          {t.sugestoes
            .filter((s) => !pesquisa.prazos.some((p) => p.nome === s))
            .slice(0, 2)
            .map((s) => (
              <Button key={s} className="botao" onPress={() => setPrazo({ id: "", nome: s, data: "", feito: false })}>
                <Plus aria-hidden="true" size="1em" /> {s}
              </Button>
            ))}
          <Button className="botao" onPress={() => setPrazo({ id: "", nome: "", data: "", feito: false })}>
            <Plus aria-hidden="true" size="1em" /> {t.adicionarPrazo}
          </Button>
        </div>
      </section>

      <section className="estudos-bloco" aria-labelledby="pesq-leituras">
        <h2 id="pesq-leituras" className="estudos-bloco-h"><BookOpen aria-hidden="true" size="1em" /> {t.leituras}</h2>
        <p className="campo-ajuda">
          {t.leiturasAjuda}
          {pesquisa.leituras.length > 0 && <> {t.contagemLeituras(lidas, pesquisa.leituras.length)}.</>}
        </p>
        {pesquisa.leituras.length === 0 ? (
          <p className="texto-suave">{t.semLeituras}</p>
        ) : (
          <ul className="estudos-lista">
            {pesquisa.leituras.map((l) => (
              <li key={l.id} className={l.status === "lida" ? "estudos-linha feito" : "estudos-linha"}>
                <span className="estudos-linha-texto">
                  <strong>{l.titulo}</strong>
                  {l.referencia && <span className="texto-suave">{l.referencia}</span>}
                </span>
                <span className="estudos-acoes">
                  <span className={`estudos-status ${l.status}`}>{t.statusNomes[l.status]}</span>
                  <Button className="botao-icone estudos-toque" onPress={() => setLeitura(l)} aria-label={`${t.editarLeitura}: ${l.titulo}`}>
                    <Pencil aria-hidden="true" size="1.1em" />
                  </Button>
                  <Button className="botao-icone estudos-toque" onPress={() => setApagando({ tipo: "leitura", id: l.id, nome: l.titulo })} aria-label={`${t.excluirLeitura}: ${l.titulo}`}>
                    <Trash2 aria-hidden="true" size="1.1em" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="botoes">
          <Button className="botao" onPress={() => setLeitura({ id: "", titulo: "", referencia: "", status: "aLer" })}>
            <Plus aria-hidden="true" size="1em" /> {t.adicionarLeitura}
          </Button>
        </div>
      </section>

      <section className="estudos-bloco" aria-labelledby="pesq-reunioes">
        <h2 id="pesq-reunioes" className="estudos-bloco-h"><CalendarDays aria-hidden="true" size="1em" /> {t.reunioes}</h2>
        <p className="campo-ajuda">{t.reunioesAjuda}</p>
        {reunioes.length === 0 ? (
          <p className="texto-suave">{t.semReunioes}</p>
        ) : (
          <ul className="estudos-reunioes">
            {reunioes.map((r) => (
              <li key={r.id} className={r === proximaReuniao ? "estudos-reuniao proxima" : "estudos-reuniao"}>
                <div className="estudos-reuniao-topo">
                  <strong>
                    {dataLegivel(r.data)}
                    {r === proximaReuniao && <span className="estudos-contagem">{t.proxima} · {textos.estudos.contagem(diasAte(hoje, r.data))}</span>}
                  </strong>
                  <span className="estudos-acoes">
                    <Button className="botao-icone estudos-toque" onPress={() => setReuniao(r)} aria-label={`${t.editarReuniao}: ${dataLegivel(r.data)}`}>
                      <Pencil aria-hidden="true" size="1.1em" />
                    </Button>
                    <Button className="botao-icone estudos-toque" onPress={() => setApagando({ tipo: "reuniao", id: r.id, nome: dataLegivel(r.data) })} aria-label={`${t.excluirReuniao}: ${dataLegivel(r.data)}`}>
                      <Trash2 aria-hidden="true" size="1.1em" />
                    </Button>
                  </span>
                </div>
                <dl className="estudos-reuniao-corpo">
                  <dt>{t.pauta}</dt>
                  <dd className={r.pauta ? "estudos-pre" : "texto-suave"}>{r.pauta || t.semPauta}</dd>
                  <dt>{t.combinado}</dt>
                  <dd className={r.combinado ? "estudos-pre" : "texto-suave"}>{r.combinado || t.semCombinado}</dd>
                </dl>
              </li>
            ))}
          </ul>
        )}
        <div className="botoes">
          <Button className="botao" onPress={() => setReuniao({ id: "", data: hoje, pauta: "", combinado: "" })}>
            <Plus aria-hidden="true" size="1em" /> {t.adicionarReuniao}
          </Button>
        </div>
      </section>

      <Janela titulo={t.editarProjeto} aberta={editandoProjeto} aoFechar={() => setEditandoProjeto(false)}>
        {editandoProjeto && <FormProjeto inicial={pesquisa} aoSalvar={(p) => { mudar((atual) => ({ ...atual, ...p })); setEditandoProjeto(false); }} aoFechar={() => setEditandoProjeto(false)} />}
      </Janela>

      <Janela titulo={prazo?.id ? t.editarPrazo : t.novoPrazo} aberta={prazo !== null} aoFechar={() => setPrazo(null)}>
        {prazo && (
          <FormSimples
            aoFechar={() => setPrazo(null)}
            aoSalvar={(v) => { salvarNaLista("prazos", { ...prazo, id: prazo.id || novoId(), nome: v.a.trim(), data: v.data }); setPrazo(null); }}
            inicial={{ a: prazo.nome, b: "", c: "", data: prazo.data }}
            rotuloA={t.nomePrazo}
            rotuloData={t.dataPrazo}
          />
        )}
      </Janela>

      <Janela titulo={leitura?.id ? t.editarLeitura : t.novaLeitura} aberta={leitura !== null} aoFechar={() => setLeitura(null)}>
        {leitura && <FormLeitura inicial={leitura} aoFechar={() => setLeitura(null)} aoSalvar={(l) => { salvarNaLista("leituras", { ...l, id: l.id || novoId() }); setLeitura(null); }} />}
      </Janela>

      <Janela titulo={reuniao?.id ? t.editarReuniao : t.novaReuniao} aberta={reuniao !== null} aoFechar={() => setReuniao(null)}>
        {reuniao && (
          <FormSimples
            aoFechar={() => setReuniao(null)}
            aoSalvar={(v) => { salvarNaLista("reunioes", { ...reuniao, id: reuniao.id || novoId(), data: v.data, pauta: v.b, combinado: v.c }); setReuniao(null); }}
            inicial={{ a: "", b: reuniao.pauta, c: reuniao.combinado, data: reuniao.data }}
            rotuloData={t.dataReuniao}
            dataObrigatoria
            rotuloB={t.pauta}
            rotuloC={t.combinado}
          />
        )}
      </Janela>

      <Confirmar
        titulo={apagando?.tipo === "prazo" ? t.excluirPrazo : apagando?.tipo === "leitura" ? t.excluirLeitura : t.excluirReuniao}
        texto={apagando ? `${apagando.nome}?` : ""}
        confirmar={t.apagar}
        aberta={apagando !== null}
        aoCancelar={() => setApagando(null)}
        aoConfirmar={apagar}
      />
    </div>
  );
}

function FormProjeto({ inicial, aoSalvar, aoFechar }: { inicial: Pesquisa; aoSalvar: (p: Partial<Pesquisa>) => void; aoFechar: () => void }) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [orientador, setOrientador] = useState(inicial.orientador);
  const [coorientador, setCoorientador] = useState(inicial.coorientador);
  const [programa, setPrograma] = useState(inicial.programa);
  return (
    <Form
      className="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        aoSalvar({ titulo: titulo.trim(), orientador: orientador.trim(), coorientador: coorientador.trim(), programa: programa.trim() });
      }}
    >
      <Campo rotulo={t.tituloProjeto} valor={titulo} aoMudar={setTitulo} autoFocus maximo={240} />
      <Campo rotulo={t.orientador} valor={orientador} aoMudar={setOrientador} maximo={120} semDitado />
      <Campo rotulo={t.coorientador} valor={coorientador} aoMudar={setCoorientador} maximo={120} semDitado />
      <Campo rotulo={t.programa} valor={programa} aoMudar={setPrograma} maximo={160} semDitado />
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{t.salvar}</Button>
      </div>
    </Form>
  );
}

function FormLeitura({ inicial, aoSalvar, aoFechar }: { inicial: LeituraPesquisa; aoSalvar: (l: LeituraPesquisa) => void; aoFechar: () => void }) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [referencia, setReferencia] = useState(inicial.referencia);
  const [status, setStatus] = useState<StatusLeitura>(inicial.status);
  return (
    <Form
      className="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        if (!titulo.trim()) return;
        aoSalvar({ ...inicial, titulo: titulo.trim(), referencia: referencia.trim(), status });
      }}
    >
      <Campo rotulo={t.tituloLeitura} valor={titulo} aoMudar={setTitulo} autoFocus maximo={240} semDitado />
      <Campo rotulo={t.referencia} valor={referencia} aoMudar={setReferencia} maximo={240} semDitado />
      <Segmentado
        rotulo={t.status}
        valor={status}
        aoMudar={setStatus}
        opcoes={(["aLer", "lendo", "lida"] as StatusLeitura[]).map((s) => ({ valor: s, nome: t.statusNomes[s] }))}
      />
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!titulo.trim()}>{t.salvar}</Button>
      </div>
    </Form>
  );
}

/** Formulário curto reaproveitado por prazo (nome + data) e reunião (data + pauta + combinado). */
function FormSimples({
  inicial,
  aoSalvar,
  aoFechar,
  rotuloA,
  rotuloB,
  rotuloC,
  rotuloData,
  dataObrigatoria,
}: {
  inicial: { a: string; b: string; c: string; data: string };
  aoSalvar: (v: { a: string; b: string; c: string; data: string }) => void;
  aoFechar: () => void;
  rotuloA?: string;
  rotuloB?: string;
  rotuloC?: string;
  rotuloData: string;
  dataObrigatoria?: boolean;
}) {
  const [a, setA] = useState(inicial.a);
  const [b, setB] = useState(inicial.b);
  const [c, setC] = useState(inicial.c);
  const [data, setData] = useState(inicial.data);
  const valido = (!rotuloA || a.trim() !== "") && (!dataObrigatoria || data !== "");
  return (
    <Form
      className="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) aoSalvar({ a, b, c, data });
      }}
    >
      {rotuloA && <Campo rotulo={rotuloA} valor={a} aoMudar={setA} autoFocus maximo={120} semDitado />}
      <CampoData rotulo={rotuloData} tipo="date" valor={data} aoMudar={setData} obrigatorio={dataObrigatoria} />
      {rotuloB && <Campo rotulo={rotuloB} valor={b} aoMudar={setB} multilinha maximo={4000} />}
      {rotuloC && <Campo rotulo={rotuloC} valor={c} aoMudar={setC} multilinha maximo={4000} />}
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!valido}>{t.salvar}</Button>
      </div>
    </Form>
  );
}
