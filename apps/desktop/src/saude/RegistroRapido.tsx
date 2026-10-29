import { useEffect, useMemo, useState } from "react";
import { Button, Form, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { inicioDoDia, somarDias } from "../agenda/datas";
import { api, type RegistroSaude } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { avisarMudanca } from "../dados";
import { BatteryLow, Heart, Moon, Plus, Sparkles, Sun, Wind, type LucideIcon } from "../icones";
import { textos } from "../textos/pt-BR";
import { gatilhosConhecidos, juntarNota } from "./gatilhos";
import { COR_TIPO } from "./visao";

const t = textos.saude.registros;
const tr = textos.saude.rapido;

export type TipoRegistro = "sono" | "sintoma" | "sobrecarga" | "coisa_boa" | "potencialidade" | "regulacao";

/** Os tipos, na ordem dos chips, com o ícone de cada um. */
export const TIPOS_REGISTRO: { tipo: TipoRegistro; Icone: LucideIcon }[] = [
  { tipo: "sono", Icone: Moon },
  { tipo: "sintoma", Icone: Heart },
  { tipo: "sobrecarga", Icone: BatteryLow },
  { tipo: "coisa_boa", Icone: Sun },
  { tipo: "potencialidade", Icone: Sparkles },
  { tipo: "regulacao", Icone: Wind },
];

export const iconeDoTipo = (tipo: string): LucideIcon => TIPOS_REGISTRO.find((x) => x.tipo === tipo)?.Icone ?? Heart;

/** "Como estou agora": o registro rápido, numa tela só. */
export function JanelaComoEstou({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  return (
    <Janela titulo={tr.titulo} aberta={aberta} aoFechar={aoFechar} larga>
      <FormRegistroRapido aoSalvo={aoFechar} />
    </Janela>
  );
}

function FormRegistroRapido({ aoSalvo }: { aoSalvo: () => void }) {
  const [tipo, setTipo] = useState<TipoRegistro | null>(null);
  const [intensidade, setIntensidade] = useState<number | null>(null);
  const [nota, setNota] = useState("");
  const [gatilhos, setGatilhos] = useState<string[]>([]);
  const [novoGatilho, setNovoGatilho] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [anteriores, setAnteriores] = useState<RegistroSaude[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const recado = useRecado();

  // Os gatilhos que a pessoa criou antes vêm dos registros dos últimos meses.
  useEffect(() => {
    const ate = somarDias(inicioDoDia(new Date()), 1);
    api.listarRegistrosSaude(somarDias(ate, -180).getTime(), ate.getTime()).then(setAnteriores, () => {});
  }, []);

  const opcoesGatilho = useMemo(
    () => gatilhosConhecidos(anteriores, [...tr.gatilhosPadrao, ...extras]),
    [anteriores, extras],
  );

  const criarGatilho = () => {
    const g = novoGatilho.trim().replace(/[,\n]+/g, " ").replace(/\s+/g, " ");
    if (!g) return;
    setExtras((e) => [...e, g]);
    setGatilhos((s) => (s.some((x) => x.toLocaleLowerCase() === g.toLocaleLowerCase()) ? s : [...s, g]));
    setNovoGatilho("");
  };

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo) {
      setErro(tr.semTipo);
      return;
    }
    setErro(null);
    try {
      await api.registrarSaude(tipo, intensidade, juntarNota(tipo === "sobrecarga" ? gatilhos : [], nota));
      avisarMudanca();
      recado(t.salvo);
      aoSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario saude-rapido" onSubmit={registrar}>
      <div className="campo">
        <span className="campo-rotulo" id="rapido-tipo">{tr.tipo}</span>
        <ToggleButtonGroup
          aria-labelledby="rapido-tipo"
          selectionMode="single"
          selectedKeys={tipo ? [tipo] : []}
          onSelectionChange={(k) => {
            const v = [...k][0] as TipoRegistro | undefined;
            setTipo(v ?? null);
            setErro(null);
          }}
          className="saude-chips-tipo"
        >
          {TIPOS_REGISTRO.map(({ tipo: tp, Icone }) => (
            <ToggleButton key={tp} id={tp} className={`saude-chip-tipo cor-${COR_TIPO[tp] ?? "cinza"}`}>
              <Icone aria-hidden="true" size="1.4em" />
              <span>{t.tipos[tp]}</span>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <p className="campo-ajuda">{tr.tipoAjuda}</p>
      </div>

      {tipo && (
        <>
          <div className="campo">
            <span className="campo-rotulo" id="rapido-intensidade">{tr.intensidade}</span>
            <ToggleButtonGroup
              aria-labelledby="rapido-intensidade"
              selectionMode="single"
              selectedKeys={intensidade ? [String(intensidade)] : []}
              onSelectionChange={(k) => {
                const v = [...k][0];
                setIntensidade(v ? Number(v) : null);
              }}
              className="saude-niveis"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <ToggleButton key={n} id={String(n)} className="saude-nivel" aria-label={t.nivel(n)}>
                  {n}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <p className="campo-ajuda">{t.escala[tipo]} {tr.intensidadeOpcional}</p>
          </div>

          {tipo === "sobrecarga" && (
            <div className="campo">
              <span className="campo-rotulo" id="rapido-gatilhos">{tr.gatilhos}</span>
              <ToggleButtonGroup
                aria-labelledby="rapido-gatilhos"
                selectionMode="multiple"
                selectedKeys={gatilhos}
                onSelectionChange={(k) => setGatilhos([...k].map(String))}
                className="saude-gatilhos"
              >
                {opcoesGatilho.map((g) => (
                  <ToggleButton key={g} id={g} className="saude-gatilho">{g}</ToggleButton>
                ))}
              </ToggleButtonGroup>
              <p className="campo-ajuda">{tr.gatilhosAjuda}</p>
              <div
                className="saude-novo-gatilho"
                onKeyDownCapture={(e) => {
                  // Enter aqui cria o gatilho, em vez de gravar o registro inteiro.
                  if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
                    e.preventDefault();
                    e.stopPropagation();
                    criarGatilho();
                  }
                }}
              >
                <Campo rotulo={tr.novoGatilho} valor={novoGatilho} aoMudar={setNovoGatilho} maximo={40} semDitado />
                <Button className="botao" onPress={criarGatilho} isDisabled={!novoGatilho.trim()}>
                  <Plus aria-hidden="true" size="1.1em" /> {tr.adicionarGatilho}
                </Button>
              </div>
            </div>
          )}

          <Campo rotulo={t.nota} valor={nota} aoMudar={setNota} multilinha descricao={t.notaAjuda} />
        </>
      )}

      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao principal grande" type="submit" isDisabled={!tipo}>{t.salvar}</Button>
      </div>
    </Form>
  );
}
