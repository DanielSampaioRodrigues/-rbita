import { Copy, Download, FileText } from "../icones";
import { useState } from "react";
import { Button, Label, TextArea, TextField } from "react-aria-components";
import { chaveDia, inicioDoDia, somarDias } from "../agenda/datas";
import { api, escolherOndeExportar } from "../api";
import { Aviso } from "../componentes/Campo";
import { Segmentado } from "../componentes/Segmentado";
import { textos } from "../textos/pt-BR";
import { lojaContas } from "./contas";
import { SEMANAS_TERAPIA, textoParaTerapia } from "./terapia";

const t = textos.energia.terapia;

/** Monta, só quando a pessoa pede, um texto com as últimas semanas para levar à terapia. */
export function LevarParaTerapia() {
  const [semanas, setSemanas] = useState<string>("2");
  const [texto, setTexto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const montar = async () => {
    setOcupado(true);
    setAviso(null);
    try {
      await lojaContas.carregar();
      const hoje = new Date();
      const n = Number(semanas);
      const de = somarDias(inicioDoDia(hoje), -(n * 7 - 1));
      const registros = await api.listarEnergia(de.getTime(), somarDias(inicioDoDia(hoje), 1).getTime()).catch(() => []);
      setTexto(textoParaTerapia(lojaContas.obter(), registros, hoje, n));
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado(false);
    }
  };

  const copiar = async () => {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setAviso({ tipo: "ok", texto: t.copiado });
    } catch {
      setAviso({ tipo: "erro", texto: t.naoCopiou });
    }
  };

  const salvar = async () => {
    if (!texto) return;
    setAviso(null);
    try {
      const caminho = await escolherOndeExportar(`${t.arquivo}-${chaveDia(new Date())}`, t.filtro, "md");
      if (!caminho) return;
      await api.exportarTexto(caminho, texto);
      setAviso({ tipo: "ok", texto: t.salvo });
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <section className="cartao largura-leitura esticado energia-terapia" aria-labelledby="energia-terapia-titulo">
      <h2 id="energia-terapia-titulo">
        <FileText aria-hidden="true" size="1em" className="energia-titulo-icone" /> {t.titulo}
      </h2>
      <p className="campo-ajuda">{t.explicacao}</p>
      <p className="energia-terapia-aviso">{t.aviso}</p>
      <Segmentado
        rotulo={t.semanas}
        valor={semanas}
        opcoes={SEMANAS_TERAPIA.map((n) => ({ valor: String(n), nome: t.opcoesSemanas[String(n)] }))}
        aoMudar={(v) => {
          setSemanas(v);
          setTexto(null);
          setAviso(null);
        }}
      />
      <div className="botoes">
        <Button className="botao energia-alvo" onPress={() => void montar()} isDisabled={ocupado}>
          {t.montar}
        </Button>
      </div>
      {texto !== null && (
        <>
          <TextField className="campo" value={texto} isReadOnly>
            <Label className="campo-rotulo">{t.previa}</Label>
            <TextArea className="entrada-texto sozinha multilinha energia-terapia-texto" rows={12} />
          </TextField>
          <div className="botoes">
            <Button className="botao principal energia-alvo" onPress={() => void copiar()}>
              <Copy aria-hidden="true" size="1.1em" /> {t.copiar}
            </Button>
            <Button className="botao energia-alvo" onPress={() => void salvar()}>
              <Download aria-hidden="true" size="1.1em" /> {t.salvar}
            </Button>
          </div>
        </>
      )}
      <p className="campo-ajuda" role="status">
        {aviso?.tipo === "ok" ? aviso.texto : ""}
      </p>
      <Aviso>{aviso?.tipo === "erro" ? aviso.texto : null}</Aviso>
    </section>
  );
}
