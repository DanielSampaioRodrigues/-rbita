import { useEffect, useMemo, useState } from "react";
import { Button } from "react-aria-components";
import { inicioDoDia, somarDias, chaveDia } from "../agenda/datas";
import { api, type Remedio, type RegistroSaude } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { Segmentado } from "../componentes/Segmentado";
import { Copy } from "../icones";
import { textos } from "../textos/pt-BR";
import { montarResumo } from "./resumo";

const t = textos.saude.resumo;
const fmtMomento = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
type Periodo = "7" | "30" | "90";

export function JanelaResumoConsulta({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [remedios, setRemedios] = useState<Remedio[]>([]);
  const [registros, setRegistros] = useState<RegistroSaude[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const recado = useRecado();

  useEffect(() => {
    if (!aberta) return;
    setErro(null);
    const dias = Number(periodo);
    const ate = somarDias(inicioDoDia(new Date()), 1);
    const de = somarDias(ate, -dias);
    Promise.all([api.listarRemedios(), api.listarRegistrosSaude(de.getTime(), ate.getTime())]).then(
      ([rs, regs]) => {
        setRemedios(rs);
        setRegistros(regs);
      },
      (e) => setErro(e instanceof Error ? e.message : String(e)),
    );
  }, [aberta, periodo]);

  const texto = useMemo(
    () =>
      montarResumo({
        remedios,
        registros,
        periodoDias: Number(periodo),
        ate: chaveDia(new Date()),
        formatarMomento: (ms) => fmtMomento.format(ms),
      }),
    [remedios, registros, periodo],
  );

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      recado(t.copiado);
    } catch {
      setErro(t.semCopia);
    }
  };

  return (
    <Janela titulo={t.titulo} aberta={aberta} aoFechar={aoFechar} larga>
      <p className="texto-suave">{t.intro}</p>
      <Segmentado
        rotulo={t.periodo}
        valor={periodo}
        aoMudar={setPeriodo}
        opcoes={[
          { valor: "7", nome: t.periodos[7] },
          { valor: "30", nome: t.periodos[30] },
          { valor: "90", nome: t.periodos[90] },
        ]}
      />
      <div className="campo">
        <span className="campo-rotulo">{t.previa}</span>
        <textarea className="entrada-texto resumo-previa" value={texto} readOnly rows={16} aria-label={t.previa} />
      </div>
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao principal" onPress={() => void copiar()}>
          <Copy aria-hidden="true" size="1.1em" /> {t.copiar}
        </Button>
      </div>
    </Janela>
  );
}
