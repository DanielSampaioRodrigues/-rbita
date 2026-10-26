import { useId, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type Conta, type Grupo } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";
import { centavosParaReais, reaisParaCentavos } from "./moeda";

const t = textos.dinheiro.contas;
const tg = textos.dinheiro.gasto;

export function novaConta(): Conta {
  return { id: "", nome: "", centavos: 0, diaVencimento: 1, avisoDias: 3, grupoId: "", criadoEm: 0 };
}

export function FormConta({ inicial, grupos, aoFechar }: { inicial: Conta; grupos: Grupo[]; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [valor, setValor] = useState(inicial.id ? centavosParaReais(inicial.centavos) : "");
  const [dia, setDia] = useState(String(inicial.diaVencimento));
  const [aviso, setAviso] = useState(String(inicial.avisoDias));
  const [grupoId, setGrupoId] = useState(inicial.grupoId);
  const [erro, setErro] = useState<string | null>(null);
  const idGrupo = useId();
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const centavos = reaisParaCentavos(valor);
    if (centavos == null) {
      setErro(textos.dinheiro.valorInvalido);
      return;
    }
    const diaN = Math.round(Number(dia)) || 0;
    try {
      await api.salvarConta({ ...inicial, nome, centavos, diaVencimento: diaN, avisoDias: Math.max(0, Math.round(Number(aviso)) || 0), grupoId });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.nome} valor={nome} aoMudar={setNome} autoFocus maximo={80} semDitado />
      <Campo rotulo={t.valor} valor={valor} aoMudar={setValor} numerico semDitado />
      <div className="campo">
        <label className="campo-rotulo" htmlFor={idGrupo}>{tg.grupo}</label>
        <select id={idGrupo} className="entrada-texto sozinha" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
          <option value="">{tg.semGrupo}</option>
          {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
        <p className="campo-ajuda">{t.grupoAjuda}</p>
      </div>
      <Campo rotulo={t.dia} valor={dia} aoMudar={setDia} numerico semDitado />
      <Campo rotulo={t.aviso} valor={aviso} aoMudar={setAviso} numerico semDitado />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.salvarMudancas : t.salvar}</Button>
      </div>
    </Form>
  );
}
