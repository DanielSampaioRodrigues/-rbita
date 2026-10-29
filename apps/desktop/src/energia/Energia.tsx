import { BatteryLow } from "../icones";
import { useEffect, useState } from "react";
import { Button, Form, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { chaveDia, inicioDoDia, somarDias } from "../agenda/datas";
import { api, type RegistroEnergia, type TarefaSugerida } from "../api";
import { useRecado } from "../app/Recado";
import { ATALHOS } from "../atalhos";
import { Aviso, Campo } from "../componentes/Campo";
import { Teclas } from "../componentes/Teclas";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { GastaRepoe, SinaisSobrecarga } from "./Contas";
import { KitSensorial } from "./Kit";
import { AjusteLembreteCorpo } from "./LembreteCorpo";
import { DiasPesados, SemanaEmSaldo } from "./Semana";
import { LevarParaTerapia } from "./Terapia";

const t = textos.energia;
const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtDia = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric" });
const fmtDiaLongo = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

/** Cinco botões com o nome do nível escrito. Um clique registra. */
export function RegistroRapido() {
  const [ultimo, setUltimo] = useState<RegistroEnergia | null>(null);
  const mudancas = useMudancas();
  const recado = useRecado();

  useEffect(() => {
    const de = inicioDoDia(new Date());
    api.listarEnergia(de.getTime(), somarDias(de, 1).getTime()).then((rs) => setUltimo(rs[rs.length - 1] ?? null), () => {});
  }, [mudancas]);

  const registrar = async (nivel: number) => {
    const r = await api.registrarEnergia(nivel, "");
    setUltimo(r);
    avisarMudanca();
    recado(t.registrada(t.niveis[nivel - 1], fmtHora.format(r.momento)));
  };

  return (
    <div className="campo">
      <span className="campo-rotulo" id="pergunta-energia">{t.pergunta}</span>
      <ToggleButtonGroup
        aria-labelledby="pergunta-energia"
        selectionMode="single"
        selectedKeys={ultimo ? [String(ultimo.nivel)] : []}
        onSelectionChange={(k) => {
          const v = [...k][0];
          if (v) void registrar(Number(v));
        }}
        className="niveis-energia"
      >
        {t.niveis.map((nome, i) => (
          // Nome explícito: alguns leitores de tela (NVDA) não liam o texto de dentro do botão.
          <ToggleButton key={i} id={String(i + 1)} className="nivel-energia" aria-label={t.nivelFalado(nome, i + 1)}>
            <span className="nivel-barras" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((b) => (
                <span key={b} className={b <= i + 1 ? "barra cheia" : "barra"} />
              ))}
            </span>
            {nome}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {ultimo && <p className="campo-ajuda">{t.registrada(t.niveis[ultimo.nivel - 1], fmtHora.format(ultimo.momento))}</p>}
    </div>
  );
}

export function PaginaEnergia({ aoLigarBaixa, aoAbrirProjeto }: { aoLigarBaixa: () => void; aoAbrirProjeto: (id: string) => void }) {
  const [registros, setRegistros] = useState<RegistroEnergia[]>([]);
  const [sugeridas, setSugeridas] = useState<TarefaSugerida[]>([]);
  const [basicos, setBasicos] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();
  const recado = useRecado();
  const hoje = inicioDoDia(new Date());
  const dias = Array.from({ length: 14 }, (_, i) => somarDias(hoje, i - 13));

  useEffect(() => {
    api.listarEnergia(dias[0].getTime(), somarDias(hoje, 1).getTime()).then(setRegistros, (e) => setErro(String(e?.message ?? e)));
    api.tarefasSugeridas().then(setSugeridas, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mudancas]);

  useEffect(() => {
    api.basicosDoDia(chaveDia(hoje)).then((bs) => setBasicos(bs.map((b) => b.texto).join("\n")), () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const mediaDo = (d: Date) => {
    const doDia = registros.filter((r) => chaveDia(new Date(r.momento)) === chaveDia(d));
    return doDia.length ? doDia.reduce((s, r) => s + r.nivel, 0) / doDia.length : null;
  };
  const registrosDoDia = (chave: string) => registros.filter((r) => chaveDia(new Date(r.momento)) === chave).sort((a, b) => a.momento - b.momento);

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>
      <section className="cartao largura-leitura esticado energia-agora">
        <RegistroRapido />
      </section>

      <div className="energia-dupla largura-leitura esticado">
        <SinaisSobrecarga aoLigarBaixa={aoLigarBaixa} />
        <section className="cartao energia-baixa" aria-labelledby="energia-baixa-titulo">
          <h2 id="energia-baixa-titulo">
            <BatteryLow aria-hidden="true" size="1em" className="energia-titulo-icone" /> {t.baixaEnergia}
          </h2>
          <p className="texto-suave">{t.baixaEnergiaExplicacao}</p>
          <div className="botoes">
            <Button className="botao principal energia-alvo" onPress={aoLigarBaixa}>
              {t.ligarBaixa}
            </Button>
            <Teclas combinacoes={ATALHOS.find((a) => a.acao === "alternarBaixaEnergia")?.teclas ?? []} />
          </div>
        </section>
      </div>

      <GastaRepoe />

      <div className="energia-dupla largura-leitura esticado">
        <SemanaEmSaldo />
        <DiasPesados />
      </div>

      <KitSensorial />

      <AjusteLembreteCorpo />

      <section className="cartao largura-leitura esticado" aria-labelledby="historico">
        <h2 id="historico">{t.historico}</h2>
        <p className="campo-ajuda">{t.historicoExplicacao}</p>
        <ol className="grafico-energia">
          {dias.map((d) => {
            const media = mediaDo(d);
            const chave = chaveDia(d);
            const nome = media == null ? t.semRegistro : t.niveis[Math.round(media) - 1];
            return (
              <li key={chave}>
                <button
                  type="button"
                  className={`grafico-dia-botao${diaAberto === chave ? " aberto" : ""}`}
                  aria-label={`${fmtDia.format(d)}: ${nome}`}
                  aria-expanded={diaAberto === chave}
                  disabled={media == null}
                  onClick={() => setDiaAberto((a) => (a === chave ? null : chave))}
                >
                  <span className="grafico-coluna" aria-hidden="true">
                    {media != null && <span className="grafico-barra" style={{ height: `${(media / 5) * 100}%` }} />}
                  </span>
                  <span className="grafico-dia" aria-hidden="true">{fmtDia.format(d).replace(".", "")}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {diaAberto && (
          <div className="energia-detalhe">
            <h3 className="pequeno">{fmtDiaLongo.format(inicioDoDia(new Date(`${diaAberto}T00:00`)))}</h3>
            <ul className="lista-simples sem-marcador energia-horarios">
              {registrosDoDia(diaAberto).map((r) => (
                <li key={r.id}>
                  <strong>{fmtHora.format(r.momento)}</strong> — {t.niveis[r.nivel - 1]}
                  {r.nota ? <span className="texto-suave"> · {r.nota}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="cartao largura-leitura esticado" aria-labelledby="para-agora">
        <h2 id="para-agora">{t.leves}</h2>
        <p className="campo-ajuda">{t.levesExplicacao}</p>
        {sugeridas.length === 0 ? (
          <p className="texto-suave">{t.semTarefas}</p>
        ) : (
          <ul className="lista-simples sem-marcador">
            {sugeridas.slice(0, 8).map((s) => (
              <li key={s.id} className="linha-ajuste">
                <span className="quebra">
                  {s.titulo}
                  {s.peso && <span className="etiqueta-estado peso"> {t.pesos[s.peso]}</span>}
                </span>
                <Button className="link" onPress={() => aoAbrirProjeto(s.projetoId)}>{s.projeto}</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cartao largura-leitura esticado">
        <h2>{t.basicos}</h2>
        <Form
          className="formulario"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.definirBasicos(basicos.split("\n"));
              recado(t.basicosSalvos);
            } catch (err) {
              setErro(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          <Campo rotulo={t.basicos} valor={basicos} aoMudar={setBasicos} multilinha descricao={t.basicosExplicacao} />
          <div className="botoes">
            <Button className="botao" type="submit">{t.salvarBasicos}</Button>
          </div>
        </Form>
      </section>

      <LevarParaTerapia />
      <Aviso>{erro}</Aviso>
    </div>
  );
}
