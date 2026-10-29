// Registrar um gasto (ou uma entrada) numa tela só, na ordem em que a gente
// pensa: quanto, o que foi, de que grupo, quando. O resto é opcional.

import { useId, useState } from "react";
import { Button, Form, Input, Label, Radio, RadioGroup, Text, TextField, ToggleButton } from "react-aria-components";
import { api, type Grupo } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Segmentado } from "../componentes/Segmentado";
import { avisarMudanca } from "../dados";
import { Check, Plus, Sparkles } from "../icones";
import { textos } from "../textos/pt-BR";
import { proximaCor } from "./FormGrupo";
import { reaisParaCentavos } from "./moeda";
import { chaveDia, diaParaMomento } from "./visao";

const t = textos.dinheiro;

/** Campo grande de valor em reais, com teclado numérico no celular e no iPad. */
export function CampoValor({ rotulo, ajuda, valor, aoMudar }: { rotulo: string; ajuda: string; valor: string; aoMudar: (v: string) => void }) {
  return (
    <TextField className="campo" value={valor} onChange={aoMudar} autoFocus>
      <Label className="campo-rotulo dinheiro-pergunta">{rotulo}</Label>
      <div className="dinheiro-valor">
        <span className="dinheiro-valor-moeda" aria-hidden="true">R$</span>
        <Input className="dinheiro-valor-entrada" inputMode="decimal" autoComplete="off" spellCheck={false} placeholder="0,00" />
      </div>
      <Text slot="description" className="campo-ajuda">{ajuda}</Text>
    </TextField>
  );
}

type Quando = "hoje" | "ontem" | "outro";
/** Valor do chip "Sem grupo" (o RadioGroup precisa de um valor não vazio). */
const SEM_GRUPO = "__sem_grupo__";

/** "Quando?": hoje, ontem ou outro dia (com o campo de data). */
function CampoQuando({ quando, setQuando, dia, setDia }: { quando: Quando; setQuando: (q: Quando) => void; dia: string; setDia: (d: string) => void }) {
  const idDia = useId();
  return (
    <div className="dinheiro-quando">
      <Segmentado<Quando>
        rotulo={t.gasto.quando}
        valor={quando}
        aoMudar={setQuando}
        opcoes={[
          { valor: "hoje", nome: t.gasto.hoje },
          { valor: "ontem", nome: t.gasto.ontem },
          { valor: "outro", nome: t.gasto.outroDia },
        ]}
      />
      {quando === "outro" && (
        <div className="campo">
          <label className="campo-rotulo" htmlFor={idDia}>{t.gasto.dia}</label>
          <input id={idDia} type="date" className="entrada-texto sozinha" max={chaveDia(Date.now())} value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
      )}
    </div>
  );
}

/** Momento a guardar, a partir do "Quando?". `null` se o dia escolhido for inválido. */
function momentoDe(quando: Quando, dia: string): number | null {
  const agora = Date.now();
  if (quando === "hoje") return agora;
  if (quando === "ontem") return agora - 86_400_000;
  if (dia === chaveDia(agora)) return agora;
  return diaParaMomento(dia);
}

export function FormGasto({ grupos, aoFechar }: { grupos: Grupo[]; aoFechar: () => void }) {
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [quando, setQuando] = useState<Quando>("hoje");
  const [dia, setDia] = useState(() => chaveDia(Date.now()));
  const [interesse, setInteresse] = useState(false);
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  // Grupos criados aqui mesmo, antes de a lista da página recarregar.
  const [criados, setCriados] = useState<Grupo[]>([]);
  const [criando, setCriando] = useState(false);
  const [nomeGrupo, setNomeGrupo] = useState("");
  const recado = useRecado();

  const todos = [...grupos, ...criados.filter((c) => !grupos.some((g) => g.id === c.id))];

  const criarGrupo = async () => {
    if (!nomeGrupo.trim()) return;
    setErro(null);
    try {
      const g = await api.salvarGrupoGasto({ id: "", nome: nomeGrupo, cor: proximaCor(todos), criadoEm: 0 });
      setCriados((c) => [...c, g]);
      setGrupoId(g.id);
      setNomeGrupo("");
      setCriando(false);
      avisarMudanca();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const centavos = reaisParaCentavos(valor);
    if (centavos == null || centavos === 0) {
      setErro(t.valorInvalido);
      return;
    }
    const momento = momentoDe(quando, dia);
    if (momento == null) {
      setErro(t.diaInvalido);
      return;
    }
    try {
      await api.registrarGasto(centavos, grupoId, descricao, interesse, { momento, nota });
      avisarMudanca();
      recado(t.gasto.registrado);
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario dinheiro-form" onSubmit={guardar}>
      <CampoValor rotulo={t.gasto.quanto} ajuda={t.gasto.quantoAjuda} valor={valor} aoMudar={setValor} />
      <Campo rotulo={t.gasto.oQue} descricao={t.gasto.oQueAjuda} valor={descricao} aoMudar={setDescricao} maximo={120} />

      <div className="campo">
        <RadioGroup className="dinheiro-grupos" value={grupoId || SEM_GRUPO} onChange={(v) => setGrupoId(v === SEM_GRUPO ? "" : v)} orientation="horizontal">
          <Label className="campo-rotulo dinheiro-pergunta-menor">{t.gasto.grupo}</Label>
          <div className="dinheiro-chips">
            <Radio value={SEM_GRUPO} className="dinheiro-chip">
              <span className="etiqueta-cor cor-cinza" aria-hidden="true" />
              {t.gasto.semGrupo}
              <Check className="dinheiro-chip-marca" aria-hidden="true" size="1em" />
            </Radio>
            {todos.map((g) => (
              <Radio key={g.id} value={g.id} className="dinheiro-chip">
                <span className={`etiqueta-cor cor-${g.cor}`} aria-hidden="true" />
                {g.nome}
                <Check className="dinheiro-chip-marca" aria-hidden="true" size="1em" />
              </Radio>
            ))}
          </div>
        </RadioGroup>
        {criando ? (
          <div className="dinheiro-novo-grupo">
            <Campo rotulo={t.gasto.nomeNovoGrupo} valor={nomeGrupo} aoMudar={setNomeGrupo} maximo={40} semDitado autoFocus />
            <div className="botoes">
              <Button className="botao" onPress={() => { setCriando(false); setNomeGrupo(""); }}>{textos.comum.cancelar}</Button>
              <Button className="botao principal" onPress={() => void criarGrupo()} isDisabled={!nomeGrupo.trim()}>{t.gasto.criarGrupo}</Button>
            </div>
          </div>
        ) : (
          <Button className="botao dinheiro-botao-leve" onPress={() => setCriando(true)}>
            <Plus aria-hidden="true" size="1.1em" /> {t.gasto.novoGrupo}
          </Button>
        )}
      </div>

      <CampoQuando quando={quando} setQuando={setQuando} dia={dia} setDia={setDia} />

      <div className="campo">
        <ToggleButton isSelected={interesse} onChange={setInteresse} className="etiqueta-alternar dinheiro-alternar">
          <Sparkles aria-hidden="true" size="1.1em" /> {t.gasto.interesse}
        </ToggleButton>
        <p className="campo-ajuda">{t.gasto.interesseAjuda}</p>
      </div>
      <Campo rotulo={t.gasto.nota} valor={nota} aoMudar={setNota} maximo={500} multilinha />

      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal dinheiro-guardar" type="submit">{t.gasto.guardar}</Button>
      </div>
    </Form>
  );
}

export function FormEntrada({ aoFechar }: { aoFechar: () => void }) {
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quando, setQuando] = useState<Quando>("hoje");
  const [dia, setDia] = useState(() => chaveDia(Date.now()));
  const [erro, setErro] = useState<string | null>(null);
  const recado = useRecado();

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const centavos = reaisParaCentavos(valor);
    if (centavos == null || centavos === 0) {
      setErro(t.valorInvalido);
      return;
    }
    const momento = momentoDe(quando, dia);
    if (momento == null) {
      setErro(t.diaInvalido);
      return;
    }
    try {
      await api.registrarEntrada(centavos, descricao, momento);
      avisarMudanca();
      recado(t.entrada.registrado);
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario dinheiro-form" onSubmit={guardar}>
      <CampoValor rotulo={t.entrada.quanto} ajuda={t.gasto.quantoAjuda} valor={valor} aoMudar={setValor} />
      <Campo rotulo={t.entrada.deOnde} descricao={t.entrada.deOndeAjuda} valor={descricao} aoMudar={setDescricao} maximo={120} />
      <CampoQuando quando={quando} setQuando={setQuando} dia={dia} setDia={setDia} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal dinheiro-guardar" type="submit">{t.entrada.guardar}</Button>
      </div>
    </Form>
  );
}
