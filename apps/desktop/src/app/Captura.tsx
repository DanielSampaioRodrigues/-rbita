import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, ErroOrbita, type ProvedorVisivel } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { avisarMudanca } from "../dados";
import { ConferirItens, comoLinhas, faltando, guardarLinhas, type Linha } from "../ia/ConferirItens";
import { pareceSensivel } from "../ia/sensivel";
import { textos } from "../textos/pt-BR";
import { useRecado } from "./Recado";

const t = textos.captura;
const ti = textos.ia;

type Fase = "escrever" | "sensivel" | "bloqueado" | "separando" | "conferir";

/**
 * Captura sem atrito: escreve, Enter, pronto, vai para Ideias.
 * Com IA ligada para a conversa, "Separar com IA" divide o texto em ideias,
 * tarefas e compromissos, e a pessoa confere antes de guardar.
 */
export function Captura({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("escrever");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [provedor, setProvedor] = useState<ProvedorVisivel | null>(null);
  const [bloqueiaSensivel, setBloqueiaSensivel] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const pedidoAtual = useRef(0);
  const recado = useRecado();

  useEffect(() => {
    if (!aberta) return;
    setFase("escrever");
    setErro(null);
    api.estadoIa().then(
      (e) => (setProvedor(e.provedores.find((p) => p.id === e.funcoes.conversa) ?? null), setBloqueiaSensivel(e.bloquearSensivel)),
      () => setProvedor(null),
    );
  }, [aberta]);

  const fechar = () => {
    pedidoAtual.current++;
    aoFechar();
  };

  const terminar = (mensagem: string) => {
    setTexto("");
    setLinhas([]);
    setErro(null);
    avisarMudanca();
    recado(mensagem);
    fechar();
  };

  const guardar = async () => {
    if (!texto.trim()) return;
    try {
      await api.criarIdeia(texto);
      terminar(t.guardada);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  const separar = async (confirmouSensivel = false) => {
    if (!texto.trim() || !provedor) return;
    const sensivel = pareceSensivel(texto);
    if (sensivel && !provedor.local && !confirmouSensivel) return setFase(bloqueiaSensivel ? "bloqueado" : "sensivel");
    const este = ++pedidoAtual.current;
    setErro(null);
    setFase("separando");
    try {
      const o = await api.organizarTextoIa(texto, sensivel);
      if (este !== pedidoAtual.current) return;
      setLinhas(comoLinhas(o.itens));
      setFase("conferir");
    } catch (e) {
      if (este !== pedidoAtual.current) return;
      setErro(e instanceof ErroOrbita ? e.message : String(e));
      setFase("escrever");
    }
  };

  const guardarItens = async () => {
    setOcupado(true);
    try {
      const n = await guardarLinhas(linhas);
      terminar(ti.itensGuardados(n));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  const marcadas = linhas.filter((l) => l.incluir && l.texto.trim()).length;

  return (
    <Janela titulo={fase === "conferir" ? ti.conferirTitulo : t.titulo} aberta={aberta} aoFechar={fechar}>
      {fase === "escrever" && (
        <Form className="formulario" onSubmit={(e) => (e.preventDefault(), guardar())}>
          <Campo rotulo={t.campo} valor={texto} aoMudar={setTexto} autoFocus descricao={t.dica} />
          <Aviso>{erro}</Aviso>
          {provedor ? <p className="texto-suave pequeno">{ti.vaiPara(provedor.nome, provedor.local)}</p> : <p className="texto-suave pequeno">{t.atalhoGlobal}</p>}
          <div className="janela-acoes">
            {provedor && (
              <Button className="botao com-icone separado" isDisabled={!texto.trim()} onPress={() => separar()}>
                <Sparkles aria-hidden="true" size="1em" /> {ti.separar}
              </Button>
            )}
            <Button className="botao" onPress={fechar}>{textos.comum.cancelar}</Button>
            <Button className="botao principal" type="submit" isDisabled={!texto.trim()}>{t.guardar}</Button>
          </div>
        </Form>
      )}

      {(fase === "sensivel" || fase === "bloqueado") && provedor && (
        <>
          <Aviso tipo="info">{fase === "sensivel" ? ti.sensivelAviso(provedor.nome) : ti.sensivelBloqueado}</Aviso>
          <div className="janela-acoes">
            <Button className="botao separado" onPress={() => setFase("escrever")}>{ti.voltarTexto}</Button>
            {fase === "sensivel" && <Button className="botao" onPress={() => separar(true)}>{ti.enviarMesmoAssim}</Button>}
            <Button className="botao principal" onPress={guardar} autoFocus>{ti.guardarComoIdeia}</Button>
          </div>
        </>
      )}

      {fase === "separando" && provedor && (
        <>
          <p role="status">{ti.separando(provedor.nome)}</p>
          {provedor.local && <p className="texto-suave">{ti.pedindoLocal}</p>}
          <div className="janela-acoes">
            <Button className="botao" onPress={() => (pedidoAtual.current++, setFase("escrever"))}>{textos.comum.cancelar}</Button>
          </div>
        </>
      )}

      {fase === "conferir" && (
        <>
          <ConferirItens linhas={linhas} aoMudar={setLinhas} />
          <Aviso>{erro}</Aviso>
          <div className="janela-acoes">
            <Button className="botao separado" onPress={() => setFase("escrever")}>{ti.voltarTexto}</Button>
            <Button className="botao" onPress={fechar}>{ti.descartar}</Button>
            <Button className="botao principal" isDisabled={ocupado || marcadas === 0 || faltando(linhas) !== null} onPress={guardarItens}>
              {ti.guardarItens(marcadas)}
            </Button>
          </div>
        </>
      )}
    </Janela>
  );
}
