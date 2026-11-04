// Dinheiro em três partes, uma por vez:
// - "Este mês": quanto entrou, saiu e sobrou, e os gastos dia a dia;
// - "Planejar": contas fixas, metas, lista de espera e grupos;
// - "Entender": a tabela grupos × meses e os gráficos.

import { useEffect, useMemo, useState } from "react";
import { api, type Conta, type Desejo, type Entrada, type Gasto, type Grupo, type Meta } from "../api";
import { Aviso } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";
import { Entender } from "./Entender";
import { EsteMes } from "./EsteMes";
import { FormEntrada, FormGasto } from "./FormGasto";
import { Planejar } from "./Planejar";
import { chaveMes } from "./visao";

const t = textos.dinheiro;
type Aba = "mes" | "planejar" | "entender";

export function PaginaDinheiro() {
  const [aba, setAba] = useState<Aba>("mes");
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [desejos, setDesejos] = useState<Desejo[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [registrando, setRegistrando] = useState<"gasto" | "entrada" | null>(null);
  const [pagando, setPagando] = useState<Conta | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  // Carrega até 12 meses (para a tabela, os gráficos e para olhar meses anteriores).
  const [de12, ate] = useMemo(() => {
    const agora = new Date();
    return [new Date(agora.getFullYear(), agora.getMonth() - 11, 1).getTime(), new Date(agora.getFullYear(), agora.getMonth() + 1, 1).getTime()];
  }, []);

  useEffect(() => {
    api.listarGastos(de12, ate).then(setGastos, (e) => setErro(e instanceof Error ? e.message : String(e)));
    // Entradas são novas: se o aparelho ainda não as conhece, a página segue sem elas.
    api.listarEntradas(de12, ate).then(setEntradas, () => setEntradas([]));
    api.listarGruposGasto().then(setGrupos, () => {});
    api.listarContas().then(setContas, () => {});
    api.listarDesejos().then(setDesejos, () => {});
    api.listarMetas().then(setMetas, () => {});
  }, [mudancas, de12, ate]);

  return (
    <div className="pagina dinheiro">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <div className="dinheiro-abas">
        <Segmentado<Aba>
          rotulo={t.abas.rotulo}
          rotuloOculto
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: "mes", nome: t.abas.mes },
            { valor: "planejar", nome: t.abas.planejar },
            { valor: "entender", nome: t.abas.entender },
          ]}
        />
      </div>

      {aba === "mes" && (
        <EsteMes
          gastos={gastos}
          entradas={entradas}
          contas={contas}
          grupos={grupos}
          mesMinimo={chaveMes(de12)}
          aoRegistrarGasto={() => { setPagando(undefined); setRegistrando("gasto"); }}
          aoPagarConta={(c) => { setPagando(c); setRegistrando("gasto"); }}
          aoRegistrarEntrada={() => setRegistrando("entrada")}
          aoVerContas={() => setAba("planejar")}
        />
      )}
      {aba === "planejar" && <Planejar grupos={grupos} contas={contas} desejos={desejos} metas={metas} />}
      {aba === "entender" && <Entender gastos={gastos} contas={contas} entradas={entradas} grupos={grupos} />}

      <Aviso>{erro}</Aviso>

      <Janela titulo={t.gasto.titulo} aberta={registrando === "gasto"} aoFechar={() => setRegistrando(null)}>
        {registrando === "gasto" && <FormGasto grupos={grupos} contas={contas} pagando={pagando} aoFechar={() => setRegistrando(null)} />}
      </Janela>
      <Janela titulo={t.entrada.titulo} aberta={registrando === "entrada"} aoFechar={() => setRegistrando(null)}>
        {registrando === "entrada" && <FormEntrada aoFechar={() => setRegistrando(null)} />}
      </Janela>
    </div>
  );
}
