import { BatteryCharging, BatteryLow, Plus, Trash2, Waves } from "../icones";
import { useState } from "react";
import { Button, Form, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { chaveDia } from "../agenda/datas";
import { useRecado } from "../app/Recado";
import { Campo } from "../componentes/Campo";
import { textos } from "../textos/pt-BR";
import { useLoja } from "../valores";
import {
  balanco,
  CAMUFLAGENS,
  lojaContas,
  marcar,
  marcarCamuflagem,
  novoId,
  PESOS,
  podar,
  saldoDoDia,
  sugerirReposicao,
  ultimaVez,
  type Atividade,
  type DadosEnergia,
} from "./contasDados";

const tc = textos.energia.contas;
const ts = textos.energia.sinais;
const tcam = textos.energia.camuflagem;
const fmtQuando = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Um só lugar com os dados (no cofre), para a página e o modo baixa energia verem a mesma coisa.
export function useContas(): [DadosEnergia, (f: (d: DadosEnergia) => DadosEnergia) => void] {
  const dados = useLoja(lojaContas);
  const mudar = (f: (d: DadosEnergia) => DadosEnergia) => lojaContas.mudar((d) => podar(f(d), chaveDia(new Date())));
  return [dados, mudar];
}

function IconePeso({ peso }: { peso: number }) {
  return peso < 0 ? <BatteryLow aria-hidden="true" size="1.1em" /> : <BatteryCharging aria-hidden="true" size="1.1em" />;
}

/** Sugestão curta de algo que repõe (usada também no modo baixa energia). */
export function SugestaoReposicao({ comTitulo }: { comTitulo?: boolean }) {
  const [dados] = useContas();
  const s = sugerirReposicao(dados, chaveDia(new Date()));
  if (!s) return null;
  if (comTitulo) {
    return (
      <p className="energia-sugestao">
        <BatteryCharging aria-hidden="true" size="1.2em" />
        <span>
          <span className="texto-suave">{tc.repor}: </span>
          <strong>{s.nome}</strong>
        </span>
      </p>
    );
  }
  return (
    <p className="energia-sugestao">
      <BatteryCharging aria-hidden="true" size="1.2em" />
      <span>{tc.sugestao(s.nome)}</span>
    </p>
  );
}

/** "O que gasta / o que repõe": marcar o que fez hoje e ver o saldo em palavras. */
export function GastaRepoe() {
  const [dados, mudar] = useContas();
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const [peso, setPeso] = useState<number>(-1);
  const recado = useRecado();
  const hoje = chaveDia(new Date());
  const feitosHoje = dados.feitos[hoje] ?? [];
  const saldo = saldoDoDia(dados.atividades, feitosHoje);
  const estado = balanco(saldo);
  const ordenadas = [...dados.atividades].sort((a, b) => a.peso - b.peso || a.nome.localeCompare(b.nome));

  const adicionar = () => {
    const limpo = nome.trim();
    if (!limpo) return;
    const nova: Atividade = { id: novoId(), nome: limpo, peso };
    mudar((d) => ({ ...d, atividades: [...d.atividades, nova] }));
    setNome("");
    recado(tc.adicionada(limpo));
  };

  return (
    <section className="cartao largura-leitura esticado energia-contas" aria-labelledby="energia-contas-titulo">
      <div className="energia-cabeca">
        <h2 id="energia-contas-titulo">{tc.titulo}</h2>
        <Button className="botao energia-alvo" onPress={() => setEditando((e) => !e)} aria-expanded={editando}>
          {editando ? tc.fecharEdicao : tc.editar}
        </Button>
      </div>
      <p className="campo-ajuda">{tc.explicacao}</p>

      {dados.atividades.length === 0 && !editando ? (
        <p className="texto-suave">{tc.vazioLista}</p>
      ) : null}

      {dados.atividades.length > 0 && !editando && (
        <>
          <div className="campo">
            <span className="campo-rotulo" id="energia-feito-hoje">{tc.hoje}</span>
            <ToggleButtonGroup
              aria-labelledby="energia-feito-hoje"
              selectionMode="multiple"
              selectedKeys={feitosHoje}
              onSelectionChange={(k) => {
                const ids = new Set([...k].map(String));
                mudar((d) => {
                  let n = d;
                  for (const a of d.atividades) n = marcar(n, hoje, a.id, ids.has(a.id));
                  return n;
                });
              }}
              className="energia-atividades"
            >
              {ordenadas.map((a) => (
                <ToggleButton
                  key={a.id}
                  id={a.id}
                  className={`energia-atividade ${a.peso < 0 ? "gasta" : "repoe"}`}
                  aria-label={`${a.nome}, ${tc.pesos[String(a.peso)].toLowerCase()}`}
                >
                  <IconePeso peso={a.peso} />
                  <span className="energia-atividade-nome">{a.nome}</span>
                  <span className="energia-atividade-peso" aria-hidden="true">{tc.pesos[String(a.peso)]}</span>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>

          <div className="energia-saldo" role="status">
            <p className="energia-saldo-frase">{tc.balanco[estado]}</p>
            {estado !== "vazio" && <p className="campo-ajuda">{tc.detalhe(saldo.gastou, saldo.repos)}</p>}
            {estado === "gastou-mais" && <SugestaoReposicao />}
          </div>
        </>
      )}

      {!editando && (
        <div className="campo energia-camuflagem">
          <span className="campo-rotulo" id="energia-camuflagem">{tcam.pergunta}</span>
          <span className="campo-ajuda" id="energia-camuflagem-ajuda">{tcam.ajuda}</span>
          <ToggleButtonGroup
            aria-labelledby="energia-camuflagem"
            aria-describedby="energia-camuflagem-ajuda"
            selectionMode="single"
            selectedKeys={dados.camuflagem[hoje] ? [dados.camuflagem[hoje]] : []}
            onSelectionChange={(k) => {
              const v = [...k][0];
              const valor = CAMUFLAGENS.find((c) => c === v) ?? null;
              mudar((d) => marcarCamuflagem(d, hoje, valor));
            }}
            className="segmentado energia-camuflagem-opcoes"
          >
            {CAMUFLAGENS.map((c) => (
              <ToggleButton key={c} id={c} className="segmentado-opcao energia-alvo">
                {tcam.opcoes[c]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
      )}

      {editando && (
        <div className="energia-edicao">
          {ordenadas.length > 0 && (
            <ul className="lista-simples sem-marcador energia-lista-editar">
              {ordenadas.map((a) => (
                <li key={a.id} className="energia-linha">
                  <IconePeso peso={a.peso} />
                  <span className="quebra energia-linha-nome">{a.nome}</span>
                  <span className="etiqueta-estado">{tc.pesos[String(a.peso)]}</span>
                  <Button
                    className="botao-icone energia-alvo"
                    aria-label={tc.remover(a.nome)}
                    onPress={() => {
                      mudar((d) => ({ ...d, atividades: d.atividades.filter((x) => x.id !== a.id) }));
                      recado(tc.removida(a.nome));
                    }}
                  >
                    <Trash2 aria-hidden="true" size="1.1em" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Form
            className="formulario energia-nova"
            aria-label={tc.nova}
            onSubmit={(e) => {
              e.preventDefault();
              adicionar();
            }}
          >
            <Campo rotulo={tc.nome} valor={nome} aoMudar={setNome} maximo={60} />
            <div className="campo">
              <span className="campo-rotulo" id="energia-quanto">{tc.quanto}</span>
              <ToggleButtonGroup
                aria-labelledby="energia-quanto"
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[String(peso)]}
                onSelectionChange={(k) => {
                  const v = [...k][0];
                  if (v != null) setPeso(Number(v));
                }}
                className="segmentado energia-pesos"
              >
                {PESOS.map((p) => (
                  <ToggleButton key={p} id={String(p)} className="segmentado-opcao energia-alvo">
                    {tc.pesos[String(p)]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </div>
            <div className="botoes">
              <Button className="botao principal energia-alvo" type="submit" isDisabled={!nome.trim()}>
                <Plus aria-hidden="true" size="1.1em" /> {tc.adicionar}
              </Button>
            </div>
          </Form>
        </div>
      )}
    </section>
  );
}

/** Lista pessoal de sinais. "Estou sentindo isso" anota e abre o modo baixa energia. */
export function SinaisSobrecarga({ aoLigarBaixa }: { aoLigarBaixa: () => void }) {
  const [dados, mudar] = useContas();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const recado = useRecado();

  const adicionar = () => {
    const limpo = texto.trim();
    if (!limpo) return;
    mudar((d) => ({ ...d, sinais: [...d.sinais, { id: novoId(), texto: limpo }] }));
    setTexto("");
  };

  return (
    <section className="cartao largura-leitura esticado energia-sinais" aria-labelledby="energia-sinais-titulo">
      <div className="energia-cabeca">
        <h2 id="energia-sinais-titulo">
          <Waves aria-hidden="true" size="1em" className="energia-titulo-icone" /> {ts.titulo}
        </h2>
        {dados.sinais.length > 0 && (
          <Button className="botao energia-alvo" onPress={() => setEditando((e) => !e)} aria-expanded={editando}>
            {editando ? ts.fecharEdicao : ts.editar}
          </Button>
        )}
      </div>
      <p className="campo-ajuda">{ts.explicacao}</p>
      {dados.sinais.length === 0 && <p className="texto-suave">{ts.vazio}</p>}
      {dados.sinais.length > 0 && (
        <ul className="lista-simples sem-marcador energia-lista-sinais">
          {dados.sinais.map((s) => {
            const ultima = ultimaVez(dados, s.id);
            return (
              <li key={s.id} className="energia-linha">
                <span className="energia-linha-nome">
                  <span className="quebra">{s.texto}</span>
                  {ultima != null && <span className="campo-ajuda energia-ultima">{ts.ultimaVez(fmtQuando.format(ultima))}</span>}
                </span>
                {editando ? (
                  <Button
                    className="botao-icone energia-alvo"
                    aria-label={ts.remover(s.texto)}
                    onPress={() => mudar((d) => ({ ...d, sinais: d.sinais.filter((x) => x.id !== s.id) }))}
                  >
                    <Trash2 aria-hidden="true" size="1.1em" />
                  </Button>
                ) : (
                  <Button
                    className="botao energia-alvo"
                    aria-label={ts.sentindoFalado(s.texto)}
                    onPress={() => {
                      mudar((d) => ({ ...d, sentidos: [...d.sentidos, { sinalId: s.id, momento: Date.now() }] }));
                      recado(ts.anotado);
                      aoLigarBaixa();
                    }}
                  >
                    {ts.sentindo}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {(editando || dados.sinais.length === 0) && (
        <Form
          className="energia-novo-sinal"
          aria-label={ts.novo}
          onSubmit={(e) => {
            e.preventDefault();
            adicionar();
          }}
        >
          <Campo rotulo={ts.novo} valor={texto} aoMudar={setTexto} maximo={80} />
          <div className="botoes">
            <Button className="botao energia-alvo" type="submit" isDisabled={!texto.trim()}>
              <Plus aria-hidden="true" size="1.1em" /> {ts.adicionar}
            </Button>
          </div>
        </Form>
      )}
    </section>
  );
}
