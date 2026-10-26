import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type Meta } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";
import { centavosParaReais, reaisParaCentavos } from "./moeda";

const t = textos.dinheiro.metas;

export function novaMeta(): Meta {
  return { id: "", nome: "", alvoCentavos: 0, guardadoCentavos: 0, criadoEm: 0 };
}

export function FormMeta({ inicial, aoFechar }: { inicial: Meta; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [alvo, setAlvo] = useState(inicial.id ? centavosParaReais(inicial.alvoCentavos) : "");
  const [guardado, setGuardado] = useState(inicial.id ? centavosParaReais(inicial.guardadoCentavos) : "");
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const alvoC = reaisParaCentavos(alvo);
    const guardadoC = reaisParaCentavos(guardado) ?? 0;
    if (alvoC == null) {
      setErro(textos.dinheiro.valorInvalido);
      return;
    }
    try {
      await api.salvarMeta({ ...inicial, nome, alvoCentavos: alvoC, guardadoCentavos: guardadoC });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.nome} valor={nome} aoMudar={setNome} autoFocus maximo={80} semDitado />
      <Campo rotulo={t.alvo} valor={alvo} aoMudar={setAlvo} numerico semDitado />
      <Campo rotulo={t.guardado} valor={guardado} aoMudar={setGuardado} numerico semDitado />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.salvarMudancas : t.salvar}</Button>
      </div>
    </Form>
  );
}
