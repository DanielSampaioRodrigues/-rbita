import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type Remedio } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { Interruptor } from "../componentes/Interruptor";
import { X, Plus } from "../icones";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";

const t = textos.saude.form;

/** Um remédio em branco, para o formulário de novo. */
export function novoRemedio(): Remedio {
  return { id: "", nome: "", dose: "", horarios: [], estoque: null, porDose: 1, receita: null, estado: "ativo", criadoEm: 0 };
}

interface Props {
  inicial: Remedio;
  aoFechar: () => void;
}

export function FormRemedio({ inicial, aoFechar }: Props) {
  const [nome, setNome] = useState(inicial.nome);
  const [dose, setDose] = useState(inicial.dose);
  const [horarios, setHorarios] = useState<string[]>(inicial.horarios);
  const [controlarEstoque, setControlarEstoque] = useState(inicial.estoque !== null);
  const [estoque, setEstoque] = useState(inicial.estoque === null ? "" : String(inicial.estoque));
  const [porDose, setPorDose] = useState(String(inicial.porDose || 1));
  const [controlarReceita, setControlarReceita] = useState(inicial.receita !== null);
  const [receita, setReceita] = useState(inicial.receita ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const mudarHorario = (i: number, valor: string) => setHorarios((hs) => hs.map((h, j) => (j === i ? valor : h)));
  const removerHorario = (i: number) => setHorarios((hs) => hs.filter((_, j) => j !== i));

  const enviar = async () => {
    setErro(null);
    const remedio: Remedio = {
      ...inicial,
      nome,
      dose,
      horarios: horarios.map((h) => h.trim()).filter(Boolean),
      estoque: controlarEstoque && estoque.trim() !== "" ? Math.max(0, Math.round(Number(estoque)) || 0) : null,
      porDose: Math.max(1, Math.round(Number(porDose)) || 1),
      receita: controlarReceita && receita.trim() !== "" ? receita : null,
    };
    try {
      const salvo = await api.salvarRemedio(remedio);
      avisarMudanca();
      aoFechar();
      return salvo;
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Form
      className="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <Campo rotulo={t.nome} valor={nome} aoMudar={setNome} autoFocus maximo={120} semDitado />
      <Campo rotulo={t.dose} valor={dose} aoMudar={setDose} descricao={t.doseAjuda} maximo={120} semDitado />

      <fieldset className="grupo-campos">
        <legend className="campo-rotulo">{t.horarios}</legend>
        <p className="campo-ajuda">{t.horariosAjuda}</p>
        <ul className="lista-simples sem-marcador">
          {horarios.map((h, i) => (
            <li key={i} className="linha-ajuste">
              <input
                className="entrada-texto sozinha"
                type="time"
                value={h}
                aria-label={`${t.horarios} ${i + 1}`}
                onChange={(e) => mudarHorario(i, e.target.value)}
              />
              <Button className="botao-icone" onPress={() => removerHorario(i)} aria-label={t.removerHorario(h || String(i + 1))}>
                <X aria-hidden="true" size="1.1em" />
              </Button>
            </li>
          ))}
        </ul>
        <Button className="botao" onPress={() => setHorarios((hs) => [...hs, ""])}>
          <Plus aria-hidden="true" size="1.1em" /> {t.adicionarHorario}
        </Button>
      </fieldset>

      <Interruptor rotulo={t.controlarEstoque} ligado={controlarEstoque} aoMudar={setControlarEstoque} />
      {controlarEstoque && (
        <>
          <Campo rotulo={t.estoque} valor={estoque} aoMudar={setEstoque} numerico descricao={t.estoqueAjuda} semDitado />
          <Campo rotulo={t.porDose} valor={porDose} aoMudar={setPorDose} numerico semDitado />
        </>
      )}

      <Interruptor rotulo={t.controlarReceita} ligado={controlarReceita} aoMudar={setControlarReceita} />
      {controlarReceita && <CampoData rotulo={t.receita} tipo="date" valor={receita} aoMudar={setReceita} />}

      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{t.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.salvarMudancas : t.salvar}</Button>
      </div>
    </Form>
  );
}
