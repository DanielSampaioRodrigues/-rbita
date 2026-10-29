import { useEffect, useState } from "react";
import { Button, Form } from "react-aria-components";
import { chaveDia } from "../agenda/datas";
import { api, type Profissional } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { Janela } from "../componentes/Janela";
import { Interruptor } from "../componentes/Interruptor";
import { eventosDaConsulta, sincronizarConsultaNaAgenda } from "./agenda";
import { Segmentado } from "../componentes/Segmentado";
import { avisarMudanca } from "../dados";
import { textos } from "../textos/pt-BR";
import { diasAte } from "./consulta";

const t = textos.cuidado.consulta;
const fmtData = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const fmtDataAno = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });

/** A data por extenso ("terça-feira, 10 de novembro"). */
export const dataPorExtenso = (iso: string) => fmtData.format(new Date(`${iso}T00:00:00`));

/** Frase literal de quando é a consulta, a partir de hoje. */
export function quandoConsulta(hoje: string, iso: string): string {
  const dias = diasAte(hoje, iso);
  if (dias === null) return textos.cuidado.semProxima;
  if (dias < 0) return t.passou(fmtDataAno.format(new Date(`${iso}T00:00:00`)));
  return t.quando(dataPorExtenso(iso), dias);
}

const NOVO = "__novo__";

/**
 * Marca (ou muda) a data da próxima consulta. Com `fixo`, é só a data daquele
 * profissional; sem, a pessoa escolhe um da lista ou cadastra alguém novo.
 */
export function JanelaMarcarConsulta({
  aberta,
  aoFechar,
  profissionais = [],
  fixo,
}: {
  aberta: boolean;
  aoFechar: () => void;
  profissionais?: Profissional[];
  fixo?: Profissional | null;
}) {
  return (
    <Janela titulo={fixo ? t.tituloDe(fixo.nome) : t.titulo} aberta={aberta} aoFechar={aoFechar}>
      <FormConsulta profissionais={profissionais} fixo={fixo ?? null} aoFechar={aoFechar} />
    </Janela>
  );
}

function FormConsulta({ profissionais, fixo, aoFechar }: { profissionais: Profissional[]; fixo: Profissional | null; aoFechar: () => void }) {
  const [quem, setQuem] = useState<string>(fixo?.id ?? profissionais[0]?.id ?? NOVO);
  const [nome, setNome] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [data, setData] = useState(fixo?.proximaConsulta || chaveDia(new Date()));
  const [erro, setErro] = useState<string | null>(null);
  // Ligado por padrão; se este profissional já tem compromisso na Agenda, começa como está lá.
  const [naAgenda, setNaAgenda] = useState(true);
  useEffect(() => {
    const id = fixo?.id ?? (quem !== NOVO ? quem : "");
    if (!id) return;
    let vivo = true;
    eventosDaConsulta(id).then((evs) => { if (vivo && fixo?.proximaConsulta) setNaAgenda(evs.length > 0); }, () => {});
    return () => { vivo = false; };
  }, [fixo, quem]);
  const recado = useRecado();

  const salvar = async (proximaConsulta: string) => {
    setErro(null);
    try {
      const base = fixo ?? profissionais.find((p) => p.id === quem);
      const prof: Profissional = base
        ? { ...base, proximaConsulta }
        : { id: "", nome, especialidade, sobre: "", proximaConsulta, criadoEm: 0 };
      const salvo = await api.salvarProfissional(prof);
      // A Agenda acompanha: se falhar, a consulta já ficou guardada aqui e a pessoa vê o erro.
      await sincronizarConsultaNaAgenda(salvo, naAgenda);
      avisarMudanca();
      recado(proximaConsulta ? t.salva : t.tirada);
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) {
      setErro(t.semData);
      return;
    }
    void salvar(data);
  };

  return (
    <Form className="formulario cuidado-form" onSubmit={enviar}>
      {!fixo && profissionais.length > 0 && (
        <Segmentado
          rotulo={t.comQuem}
          valor={quem}
          aoMudar={setQuem}
          opcoes={[...profissionais.map((p) => ({ valor: p.id, nome: p.nome })), { valor: NOVO, nome: t.alguemNovo }]}
        />
      )}
      {!fixo && quem === NOVO && (
        <>
          <Campo rotulo={textos.cuidado.form.nome} valor={nome} aoMudar={setNome} maximo={80} semDitado autoFocus />
          <Campo rotulo={textos.cuidado.form.especialidade} valor={especialidade} aoMudar={setEspecialidade} maximo={60} semDitado descricao={textos.cuidado.form.especialidadeAjuda} />
        </>
      )}
      <CampoData rotulo={t.data} tipo="date" valor={data} aoMudar={setData} />
      <Interruptor rotulo={t.naAgenda} ligado={naAgenda} aoMudar={setNaAgenda} />
      <p className="texto-suave pequeno">{t.naAgendaAjuda}</p>
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        {fixo?.proximaConsulta && (
          <Button className="botao" onPress={() => void salvar("")}>{t.tirar}</Button>
        )}
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{t.salvar}</Button>
      </div>
    </Form>
  );
}
