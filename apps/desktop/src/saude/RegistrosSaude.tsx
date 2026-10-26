import { useEffect, useState } from "react";
import { Button, Form, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { inicioDoDia, somarDias } from "../agenda/datas";
import { api, type RegistroSaude } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Segmentado } from "../componentes/Segmentado";
import { Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";

const t = textos.saude.registros;
type Tipo = "sono" | "sintoma" | "sobrecarga" | "coisa_boa" | "potencialidade" | "regulacao";
const fmtDataHora = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function RegistrosSaude() {
  const [tipo, setTipo] = useState<Tipo>("sono");
  const [intensidade, setIntensidade] = useState<number | null>(null);
  const [nota, setNota] = useState("");
  const [recentes, setRecentes] = useState<RegistroSaude[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();
  const recado = useRecado();

  useEffect(() => {
    const ate = somarDias(inicioDoDia(new Date()), 1);
    api.listarRegistrosSaude(somarDias(ate, -30).getTime(), ate.getTime()).then(setRecentes, () => {});
  }, [mudancas]);

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.registrarSaude(tipo, intensidade, nota);
      setNota("");
      setIntensidade(null);
      avisarMudanca();
      recado(t.salvo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  const apagar = async (id: string) => {
    await api.excluirRegistroSaude(id);
    avisarMudanca();
    recado(t.excluido);
  };

  return (
    <Form className="formulario" onSubmit={registrar}>
      <Segmentado
        rotulo={t.ladoDificil}
        valor={["sono", "sintoma", "sobrecarga"].includes(tipo) ? tipo : "sono"}
        aoMudar={(v) => setTipo(v as Tipo)}
        opcoes={[
          { valor: "sono", nome: t.tipos.sono },
          { valor: "sintoma", nome: t.tipos.sintoma },
          { valor: "sobrecarga", nome: t.tipos.sobrecarga },
        ]}
      />
      <Segmentado
        rotulo={t.ladoBom}
        valor={["coisa_boa", "potencialidade", "regulacao"].includes(tipo) ? tipo : ("" as Tipo)}
        aoMudar={(v) => setTipo(v as Tipo)}
        opcoes={[
          { valor: "coisa_boa", nome: t.tipos.coisa_boa },
          { valor: "potencialidade", nome: t.tipos.potencialidade },
          { valor: "regulacao", nome: t.tipos.regulacao },
        ]}
      />

      <div className="campo">
        <span className="campo-rotulo" id="intensidade-saude">{t.intensidade}</span>
        <ToggleButtonGroup
          aria-labelledby="intensidade-saude"
          selectionMode="single"
          selectedKeys={intensidade ? [String(intensidade)] : []}
          onSelectionChange={(k) => {
            const v = [...k][0];
            setIntensidade(v ? Number(v) : null);
          }}
          className="niveis-energia"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <ToggleButton key={n} id={String(n)} className="nivel-energia" aria-label={t.nivel(n)}>
              {n}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <p className="campo-ajuda">{t.escala[tipo]}</p>
      </div>

      <Campo rotulo={t.nota} valor={nota} aoMudar={setNota} multilinha descricao={t.notaAjuda} />
      <Aviso>{erro}</Aviso>
      <div className="botoes">
        <Button className="botao principal" type="submit">{t.salvar}</Button>
      </div>

      {recentes.length > 0 && (
        <div className="campo">
          <span className="campo-rotulo">{t.recentes}</span>
          <ul className="lista-simples sem-marcador">
            {recentes.slice(0, 12).map((r) => (
              <li key={r.id} className="linha-ajuste">
                <span className="quebra">
                  <strong>{t.tipos[r.tipo as Tipo]}</strong>
                  {r.intensidade != null && <span className="texto-suave"> · {t.nivel(r.intensidade)}</span>}
                  <span className="texto-suave"> · {fmtDataHora.format(r.momento)}</span>
                  {r.nota && <><br /><span>{r.nota}</span></>}
                </span>
                <Button className="botao-icone" onPress={() => void apagar(r.id)} aria-label={t.excluir}>
                  <Trash2 aria-hidden="true" size="1.1em" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Form>
  );
}
