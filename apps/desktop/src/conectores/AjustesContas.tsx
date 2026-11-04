// Ajustes > Contas conectadas: a conta Google dos conectores (Drive, Docs, Classroom)
// e o Zotero. Tudo opcional; nada liga sozinho.
import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { api } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Segmentado } from "../componentes/Segmentado";
import { Cloud, ExternalLink } from "../icones";
import { textos } from "../textos/pt-BR";
import { conectar, conectoresDisponiveis, contaConectada, desconectar, ESCOPO_DRIVE, ESCOPO_TAREFAS, temEscopo, type ContaConectada } from "./google";
import { JanelaClassroom } from "./JanelaClassroom";
import { buscarNoZotero, gravarConfigZotero, lerConfigZotero, zoteroDoComputadorPossivel, type ConfigZotero } from "./zotero";

const tg = textos.conectores.google;
const tz = textos.conectores.zotero;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function AjustesContas() {
  return (
    <>
      <CartaoGoogle />
      <CartaoZotero />
    </>
  );
}

function CartaoGoogle() {
  const [conta, setConta] = useState<ContaConectada | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tarefas, setTarefas] = useState(false);
  useEffect(() => { void contaConectada().then(setConta, () => setConta(null)); }, []);
  const ligar = () => {
    setErro(null); setAviso(null); setOcupado(true);
    // Sem await antes: no iPad, a janela do Google só abre se nascer do toque.
    conectar().then(setConta, (e) => setErro(mensagem(e))).finally(() => setOcupado(false));
  };
  const desligar = async () => {
    setErro(null);
    try { await desconectar(); setConta(null); setAviso(tg.desligado); } catch (e) { setErro(mensagem(e)); }
  };
  return (
    <section className="cartao">
      <h2>{tg.titulo}</h2>
      <p className="campo-ajuda">{tg.explicacao}</p>
      {!conectoresDisponiveis() ? <p className="texto-suave">{tg.indisponivel}</p> : conta ? (
        <>
          <p className="com-icone"><Cloud aria-hidden="true" size="1.1em" /> {tg.ligadoA(conta.conta)}</p>
          {!temEscopo(conta, ESCOPO_DRIVE) && <Aviso tipo="info">{tg.faltaDrive}</Aviso>}
          {!temEscopo(conta, ESCOPO_TAREFAS) && <Aviso tipo="info">{tg.faltaClassroom}</Aviso>}
          <div className="botoes">
            {temEscopo(conta, ESCOPO_TAREFAS) && <Button className="botao" onPress={() => setTarefas(true)}>{tg.verTarefas}</Button>}
            <Button className="botao" onPress={() => void desligar()}>{tg.desligar}</Button>
          </div>
        </>
      ) : (
        <div className="botoes">
          <Button className="botao principal" isDisabled={ocupado} onPress={ligar}>{ocupado ? tg.ligando : tg.ligar}</Button>
        </div>
      )}
      {erro && <Aviso>{erro}</Aviso>}
      {aviso && <p role="status" className="texto-suave">{aviso}</p>}
      <JanelaClassroom aberta={tarefas} aoFechar={() => setTarefas(false)} />
    </section>
  );
}

function CartaoZotero() {
  const [config, setConfig] = useState<ConfigZotero | null>(null);
  const [modo, setModo] = useState<ConfigZotero["modo"]>("web");
  const [usuario, setUsuario] = useState("");
  const [chave, setChave] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => { void lerConfigZotero().then((c) => { setConfig(c); if (c) { setModo(c.modo); setUsuario(c.usuario ?? ""); setChave(c.chave ?? ""); } }); }, []);
  const testar = async () => {
    setErro(null); setAviso(null); setOcupado(true);
    const c: ConfigZotero = modo === "web" ? { modo, usuario: usuario.trim(), chave: chave.trim() } : { modo };
    try {
      const itens = await buscarNoZotero(c, "");
      await gravarConfigZotero(c);
      setConfig(c);
      setAviso(tz.ok(itens.length));
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  };
  const tirar = async () => { await gravarConfigZotero(null); setConfig(null); setChave(""); setAviso(null); };
  const podeComputador = zoteroDoComputadorPossivel();
  return (
    <section className="cartao">
      <h2>{tz.titulo}</h2>
      <p className="campo-ajuda">{tz.explicacao}</p>
      {config && <p className="texto-suave">{tz.ligado(config.modo === "web" ? tz.web : tz.computador)}</p>}
      {podeComputador && (
        <Segmentado rotulo={tz.modo} valor={modo} aoMudar={(v) => setModo(v as ConfigZotero["modo"])} opcoes={[{ valor: "web", nome: tz.web }, { valor: "computador", nome: tz.computador }]} />
      )}
      {modo === "web" ? (
        <>
          <Campo rotulo={tz.usuario} valor={usuario} aoMudar={setUsuario} numerico maximo={20} />
          <Campo rotulo={tz.chave} valor={chave} aoMudar={setChave} secreto maximo={64} />
          <p className="campo-ajuda">{tz.ajudaChave}</p>
          <Button className="botao pequeno com-icone" onPress={() => void api.abrirEndereco("https://www.zotero.org/settings/keys")}><ExternalLink aria-hidden="true" size="1em" /> {tz.abrirSite}</Button>
        </>
      ) : <p className="campo-ajuda">{tz.ajudaComputador}</p>}
      <div className="botoes">
        <Button className="botao principal" isDisabled={ocupado || (modo === "web" && (!usuario.trim() || !chave.trim()))} onPress={() => void testar()}>{ocupado ? tz.testando : tz.testar}</Button>
        {config && <Button className="botao" onPress={() => void tirar()}>{tz.tirar}</Button>}
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      {aviso && <p role="status" className="texto-suave">{aviso}</p>}
    </section>
  );
}
