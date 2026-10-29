import { useState } from "react";
import { CampoRico } from "../componentes/CampoRico";
import { Button, Form, Label, Radio, RadioGroup, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { api, CORES_ETIQUETA, type Evento, type Repeticao } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { Interruptor } from "../componentes/Interruptor";
import { Segmentado } from "../componentes/Segmentado";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";
import { chaveDia } from "./datas";

const t = textos.agenda;
type TipoRepeticao = "nao" | Repeticao["frequencia"];

const hora = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export const juntar = (data: string, h: string) => {
  const [a, m, d] = data.split("-").map(Number);
  const [hh, mm] = (h || "00:00").split(":").map(Number);
  return new Date(a, m - 1, d, hh, mm).getTime();
};

/** Ordem de exibição dos dias: segunda a domingo. */
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

export function novoEvento(dia: Date, modelo = false): Evento {
  const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 9, 0);
  return {
    id: "",
    titulo: "",
    inicio: inicio.getTime(),
    fim: inicio.getTime() + 3_600_000,
    diaInteiro: false,
    repeticao: modelo ? { frequencia: "semanal", dias: [inicio.getDay()], ate: null } : null,
    modelo,
    notas: "",
    excecoes: [],
  };
}

/** Criar ou editar um compromisso. `dia` é o dia da ocorrência clicada (para "excluir só neste dia"). */
export function FormEvento({ inicial, dia, aoFechar }: { inicial: Evento; dia: string | null; aoFechar: () => void }) {
  const ini = new Date(inicial.inicio);
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [data, setData] = useState(chaveDia(ini));
  const [diaInteiro, setDiaInteiro] = useState(inicial.diaInteiro);
  const [comeco, setComeco] = useState(hora(ini));
  const [fim, setFim] = useState(inicial.fim != null ? hora(new Date(inicial.fim)) : "");
  const [repetir, setRepetir] = useState<TipoRepeticao>(inicial.repeticao?.frequencia ?? "nao");
  const [dias, setDias] = useState<number[]>(inicial.repeticao?.dias.length ? inicial.repeticao.dias : [ini.getDay()]);
  const [ate, setAte] = useState(inicial.repeticao?.ate != null ? chaveDia(new Date(inicial.repeticao.ate)) : "");
  const [modelo, setModelo] = useState(inicial.modelo);
  const [notas, setNotas] = useState(inicial.notas);
  // "" = sem cor. Uma cor fora da paleta (dado antigo ou estranho) vira "sem cor".
  const [cor, setCor] = useState(inicial.cor && (CORES_ETIQUETA as readonly string[]).includes(inicial.cor) ? inicial.cor : "");
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const montar = (): Evento | null => {
    const inicio = juntar(data, diaInteiro ? "00:00" : comeco);
    const termino = diaInteiro || !fim ? null : juntar(data, fim);
    if (termino != null && termino < inicio) {
      setErro(t.fimAntes);
      return null;
    }
    return {
      ...inicial,
      titulo,
      inicio,
      fim: termino,
      diaInteiro,
      repeticao: repetir === "nao" ? null : { frequencia: repetir, dias: repetir === "semanal" ? dias : [], ate: ate ? juntar(ate, "23:59") : null },
      modelo,
      notas,
      cor: cor || null,
    };
  };

  const executar = async (acao: () => Promise<unknown>) => {
    setErro(null);
    try {
      await acao();
      avisarMudanca();
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  if (excluindo) {
    const repete = !!inicial.repeticao;
    return (
      <div className="formulario">
        <p>{repete ? t.excluirRepeteTexto : t.excluirTexto}</p>
        <Aviso>{erro}</Aviso>
        <div className="janela-acoes">
          <Button className="botao" onPress={() => setExcluindo(false)} autoFocus>{textos.comum.cancelar}</Button>
          {repete && dia && (
            <Button className="botao" onPress={() => executar(() => api.pularDataEvento(inicial.id, dia))}>{t.excluirSoEste}</Button>
          )}
          <Button className="botao principal" onPress={() => executar(() => api.excluirEvento(inicial.id))}>
            {repete ? t.excluirTodos : t.excluir}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Form
      className="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        const evento = montar();
        if (evento) void executar(() => api.salvarEvento(evento));
      }}
    >
      <Campo rotulo={t.titulo_} valor={titulo} aoMudar={setTitulo} autoFocus />
      <div className="linha-campos">
        <CampoData rotulo={t.data} tipo="date" valor={data} aoMudar={setData} obrigatorio />
        {!diaInteiro && (
          <>
            <CampoData rotulo={t.comeco} tipo="time" valor={comeco} aoMudar={setComeco} obrigatorio />
            <CampoData rotulo={t.fim} tipo="time" valor={fim} aoMudar={setFim} />
          </>
        )}
      </div>
      <Interruptor rotulo={t.diaInteiro} ligado={diaInteiro} aoMudar={setDiaInteiro} />
      <Segmentado<TipoRepeticao>
        rotulo={t.repetir}
        valor={repetir}
        opcoes={(["nao", "diaria", "semanal", "mensal"] as const).map((r) => ({ valor: r, nome: t.repeticoes[r] }))}
        aoMudar={setRepetir}
      />
      {repetir === "semanal" && (
        <div className="campo">
          <span className="campo-rotulo" id="quais-dias">{t.quaisDias}</span>
          <ToggleButtonGroup
            aria-labelledby="quais-dias"
            selectionMode="multiple"
            disallowEmptySelection
            selectedKeys={dias.map(String)}
            onSelectionChange={(k) => setDias([...k].map(Number))}
            className="segmentado"
          >
            {ORDEM_DIAS.map((d) => (
              <ToggleButton key={d} id={String(d)} className="segmentado-opcao" aria-label={t.diasSemana[d]}>
                {t.diasSemanaCurtos[d]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
      )}
      {repetir !== "nao" && <CampoData rotulo={t.ate} tipo="date" valor={ate} aoMudar={setAte} />}
      <div className="campo">
        <Interruptor rotulo={t.modelo} ligado={modelo} aoMudar={setModelo} />
        <p className="campo-ajuda">{t.modeloExplicacao}</p>
      </div>
      <EscolherCorEvento valor={cor} aoMudar={setCor} />
      <CampoRico rotulo={t.notas} valor={notas} aoMudar={setNotas} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        {inicial.id && (
          <Button className="botao separado" onPress={() => setExcluindo(true)}>{t.excluir}</Button>
        )}
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!titulo.trim()}>{textos.comum.salvar}</Button>
      </div>
    </Form>
  );
}

/** Cor do cartão: "sem cor" e as 8 cores das etiquetas, sempre com o nome. Setas trocam. */
function EscolherCorEvento({ valor, aoMudar }: { valor: string; aoMudar: (c: string) => void }) {
  return (
    <RadioGroup className="campo agenda-cores" value={valor} onChange={aoMudar} orientation="horizontal">
      <Label className="campo-rotulo">{t.cor}</Label>
      <div className="cores-etiqueta">
        <Radio value="" className="cor-opcao">
          <span className="etiqueta-cor grande cor-nenhuma" aria-hidden="true" />
          <span className="pequeno">{t.semCor}</span>
        </Radio>
        {CORES_ETIQUETA.map((c) => (
          <Radio key={c} value={c} className="cor-opcao">
            <span className={`etiqueta-cor grande cor-${c}`} aria-hidden="true" />
            <span className="pequeno">{textos.ideias.cores[c]}</span>
          </Radio>
        ))}
      </div>
      <p className="campo-ajuda">{t.corAjuda}</p>
    </RadioGroup>
  );
}
