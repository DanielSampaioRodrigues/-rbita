import { Bot, Cpu } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { api, type EstadoIa, type FuncaoIa, type ProvedorVisivel } from "../api";
import { Escolha } from "../componentes/Escolha";
import { Interruptor } from "../componentes/Interruptor";
import { Confirmar } from "../componentes/Janela";
import { textos } from "../textos/pt-BR";
import { JanelaProvedor } from "./JanelaProvedor";
import { recarregarRecursos } from "../ditado/recursos";

const t = textos.ia;
const FUNCOES: FuncaoIa[] = ["quebrar", "conversa", "revisao"];
const NENHUM = "nenhum";
/** Na escolha de modelo: o modelo padrão do provedor. */
const PADRAO = "__padrao__";

/** Modelos de cada provedor, buscados uma vez (não gasta créditos). */
const modelosEmCache = new Map<string, Promise<string[]>>();
function modelosDe(p: ProvedorVisivel): Promise<string[]> {
  const chave = `${p.id}|${p.url}`;
  if (!modelosEmCache.has(chave)) {
    const pedido = api.testarProvedorIa(p, null);
    pedido.catch(() => modelosEmCache.delete(chave));
    modelosEmCache.set(chave, pedido);
  }
  return modelosEmCache.get(chave)!;
}

/** Uma função: qual IA (empresa) e qual modelo dela. */
function Funcao({ funcao, estado, aoMudar }: { funcao: FuncaoIa; estado: EstadoIa; aoMudar: (e: EstadoIa) => void }) {
  const provedor = estado.provedores.find((p) => p.id === estado.funcoes[funcao]) ?? null;
  const modelo = estado.modelos[funcao] ?? null;
  const [lista, setLista] = useState<string[] | null | "erro">(null);

  useEffect(() => {
    if (!provedor) return;
    let vivo = true;
    setLista(null);
    modelosDe(provedor).then((l) => vivo && setLista(l), () => vivo && setLista("erro"));
    return () => void (vivo = false);
  }, [provedor]);

  const opcoesModelo = provedor
    ? [
        { valor: PADRAO, nome: t.modeloPadrao(provedor.modelo) },
        ...[...new Set([...(Array.isArray(lista) ? lista : []), ...(modelo ? [modelo] : [])])]
          .filter((m) => m !== provedor.modelo)
          .map((m) => ({ valor: m, nome: m })),
      ]
    : [];

  return (
    <fieldset className="grupo-campos funcao-ia">
      <legend className="campo-rotulo">{t.funcoes[funcao]}</legend>
      <div className="linha-campos">
        <Escolha
          rotulo={t.provedorDaFuncao}
          valor={provedor?.id ?? NENHUM}
          opcoes={[{ valor: NENHUM, nome: t.naoUsar }, ...estado.provedores.map((p) => ({ valor: p.id, nome: p.nome }))]}
          aoMudar={async (v) => aoMudar(await api.definirFuncaoIa(funcao, v === NENHUM ? null : v, null))}
        />
        {provedor && (
          <Escolha
            rotulo={t.modeloDaFuncao}
            valor={modelo ?? PADRAO}
            opcoes={opcoesModelo}
            descricao={lista === null ? t.carregandoModelos : lista === "erro" ? t.semListaDeModelos : undefined}
            aoMudar={async (v) => aoMudar(await api.definirFuncaoIa(funcao, provedor.id, v === PADRAO ? null : v))}
          />
        )}
      </div>
    </fieldset>
  );
}

/** Cartão de IA em Ajustes: provedores, provedor por função e bloqueio de dados sensíveis. */
export function AjustesIa() {
  const [estado, setEstadoLocal] = useState<EstadoIa | null>(null);
  // A revisão nos campos de texto depende daqui: avisa quando muda.
  const setEstado = (e: EstadoIa) => (setEstadoLocal(e), void recarregarRecursos());
  const [janela, setJanela] = useState<{ editando: ProvedorVisivel | null } | null>(null);
  const [removendo, setRemovendo] = useState<ProvedorVisivel | null>(null);

  useEffect(() => {
    api.estadoIa().then(setEstadoLocal, () => {});
  }, []);

  if (!estado) return null;

  return (
    <section className="cartao">
      <h2>{t.titulo}</h2>
      <p className="texto-suave">{t.explicacao}</p>

      {estado.provedores.length === 0 ? (
        <p>{t.nenhum}</p>
      ) : (
        <ul className="lista-provedores">
          {estado.provedores.map((p) => (
            <li key={p.id} className="provedor">
              {p.local ? <Cpu aria-hidden="true" size="1.2em" /> : <Bot aria-hidden="true" size="1.2em" />}
              <div className="provedor-texto">
                <strong>{p.nome}</strong>
                <span className="texto-suave pequeno quebra">{t.linhaProvedor(p.modelo, p.finalChave, p.local)}</span>
              </div>
              <div className="botoes">
                <Button className="botao pequeno" onPress={() => setJanela({ editando: p })} aria-label={`${t.editar} ${p.nome}`}>
                  {t.editar}
                </Button>
                <Button className="botao pequeno" onPress={() => setRemovendo(p)} aria-label={`${t.remover} ${p.nome}`}>
                  {t.remover}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="botoes">
        <Button className="botao" onPress={() => setJanela({ editando: null })}>{t.adicionar}</Button>
      </div>

      {estado.provedores.length > 0 && (
        <>
          <h3>{t.funcoesTitulo}</h3>
          <p className="campo-ajuda">{t.funcoesAjuda}</p>
          {FUNCOES.map((f) => (
            <Funcao key={f} funcao={f} estado={estado} aoMudar={setEstado} />
          ))}
        </>
      )}

      <div className="campo">
        <Interruptor rotulo={t.sensivel} ligado={estado.bloquearSensivel} aoMudar={async (v) => setEstado(await api.bloquearSensivelIa(v))} />
        <p className="campo-ajuda">{t.sensivelAjuda}</p>
      </div>

      <JanelaProvedor
        aberta={janela !== null}
        editando={janela?.editando ?? null}
        aoFechar={() => setJanela(null)}
        aoSalvar={(e) => {
          setEstado(e);
          setJanela(null);
        }}
      />
      <Confirmar
        aberta={removendo !== null}
        titulo={removendo ? t.removerTitulo(removendo.nome) : ""}
        texto={t.removerTexto}
        confirmar={t.remover}
        aoCancelar={() => setRemovendo(null)}
        aoConfirmar={async () => {
          if (removendo) setEstado(await api.removerProvedorIa(removendo.id));
          setRemovendo(null);
        }}
      />
    </section>
  );
}
