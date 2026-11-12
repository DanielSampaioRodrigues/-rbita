// Importar o extrato do banco (OFX ou CSV). O arquivo é lido neste aparelho; a pessoa
// vê a lista, escolhe o que entra e só então o Órbita registra (gastos e entradas,
// cada um no dia certo). Lançamentos já importados antes não aparecem de novo.
import { useId, useMemo, useRef, useState } from "react";
import { Button, Checkbox } from "react-aria-components";
import { api, type Entrada, type Gasto, type Grupo } from "../api";
import { useRecado } from "../app/Recado";
import { Interruptor } from "../componentes/Interruptor";
import { avisarMudanca } from "../dados";
import { FileUp } from "../icones";
import { textos } from "../textos/pt-BR";
import { diaCurto } from "./EsteMes";
import { decodificar, lerExtrato, pareceRegistrado, type Extrato, type LinhaExtrato } from "./extrato";
import { formatarMoeda } from "./moeda";
import { chaveDia, diaParaMomento } from "./visao";

const t = textos.dinheiro.extrato;
const CHAVE = "dinheiro.extrato.importados";
const MAXIMO_GUARDADO = 5000;

async function lerImportados(): Promise<string[]> {
  const v = await api.lerValor(CHAVE).catch(() => null);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function ImportarExtrato({ grupos, gastos, entradas, aoFechar }: { grupos: Grupo[]; gastos: Gasto[]; entradas: Entrada[]; aoFechar: () => void }) {
  const recado = useRecado();
  const arquivo = useRef<HTMLInputElement>(null);
  const idGrupo = useId();
  const [nome, setNome] = useState("");
  const [extrato, setExtrato] = useState<Extrato | null>(null);
  const [jaImportados, setJaImportados] = useState<Set<string>>(new Set());
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [trocar, setTrocar] = useState(false);
  const [grupoId, setGrupoId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Com "trocar", saídas viram entradas e vice-versa (banco que exporta o sinal ao contrário).
  const linhas = useMemo<LinhaExtrato[]>(() => (extrato?.linhas ?? [])
    .filter((l) => !jaImportados.has(l.id))
    .map((l) => (trocar ? { ...l, centavos: -l.centavos } : l))
    .sort((a, b) => a.data.localeCompare(b.data)), [extrato, jaImportados, trocar]);
  const repetidas = useMemo(() => new Set(linhas.filter((l) => pareceRegistrado(l, gastos, entradas, chaveDia)).map((l) => l.id)), [linhas, gastos, entradas]);
  const escondidas = (extrato?.linhas.length ?? 0) - linhas.length;

  const abrir = async (f: File) => {
    setErro(null);
    try {
      const texto = decodificar(new Uint8Array(await f.arrayBuffer()));
      const e = lerExtrato(f.name, texto);
      if (!e) { setErro(t.naoReconheci); return; }
      if (!e.linhas.length) { setErro(t.vazio); return; }
      const antes = new Set(await lerImportados());
      setNome(f.name);
      setJaImportados(antes);
      setTrocar(false);
      setExtrato(e);
      const novas = e.linhas.filter((l) => !antes.has(l.id));
      // Na fatura do cartão, o que é positivo (pagamento da fatura, estorno) não é dinheiro que
      // entrou: fica desmarcado. A pessoa marca se quiser.
      setMarcadas(new Set(novas.filter((l) => !pareceRegistrado(l, gastos, entradas, chaveDia) && !(e.formato === "cartao" && l.centavos > 0)).map((l) => l.id)));
    } catch (x) {
      setErro(t.erroLer(x instanceof Error ? x.message : String(x)));
    }
  };

  const escolhidas = linhas.filter((l) => marcadas.has(l.id));
  const nSaidas = escolhidas.filter((l) => l.centavos < 0).length;
  const nEntradas = escolhidas.length - nSaidas;

  const registrar = async () => {
    if (!escolhidas.length) return;
    setSalvando(true);
    setErro(null);
    const feitas: string[] = [];
    try {
      for (const l of escolhidas) {
        const momento = diaParaMomento(l.data) ?? Date.now();
        if (l.centavos < 0) await api.registrarGasto(-l.centavos, grupoId, l.descricao.slice(0, 120), false, { momento });
        else await api.registrarEntrada(l.centavos, l.descricao.slice(0, 120), momento);
        feitas.push(l.id);
      }
    } catch (x) {
      setErro(t.erroGravar(feitas.length, x instanceof Error ? x.message : String(x)));
    }
    // Guarda só os identificadores registrados: os que a pessoa deixou de fora voltam a
    // aparecer (desmarcados ou não) se o mesmo extrato for importado de novo.
    const todos = [...(await lerImportados()), ...feitas].slice(-MAXIMO_GUARDADO);
    await api.gravarValor(CHAVE, todos).catch(() => {});
    setSalvando(false);
    avisarMudanca();
    if (feitas.length === escolhidas.length) {
      recado(t.pronto(nSaidas, nEntradas));
      aoFechar();
    }
  };

  const alternar = (id: string, v: boolean) => setMarcadas((m) => { const n = new Set(m); if (v) n.add(id); else n.delete(id); return n; });

  return (
    <div className="extrato">
      <input ref={arquivo} type="file" hidden accept=".ofx,.qfx,.csv,.txt,text/csv,application/x-ofx"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void abrir(f); e.target.value = ""; }} />
      {!extrato ? (
        <>
          <p>{t.explicacao}</p>
          <ul className="texto-suave pequeno extrato-dicas">
            {t.dicas.map((d) => <li key={d}>{d}</li>)}
          </ul>
          <p className="texto-suave pequeno">{t.privacidade}</p>
        </>
      ) : (
        <>
          <p className="extrato-resumo">
            <strong>{nome}</strong>{" "}
            <span className="texto-suave">· {t.resumo(linhas.length, linhas[0]?.data ? diaCurto(linhas[0].data) : "", linhas.at(-1)?.data ? diaCurto(linhas.at(-1)!.data) : "")}</span>
          </p>
          {escondidas > 0 && <p className="texto-suave pequeno">{t.escondidas(escondidas)}</p>}
          {repetidas.size > 0 && <p className="texto-suave pequeno">{t.repetidas(repetidas.size)}</p>}
          {extrato.formato === "cartao" && <p className="texto-suave pequeno">{t.cartao}</p>}
          <div className="extrato-opcoes">
            <div className="extrato-campo">
              <label className="campo-rotulo" htmlFor={idGrupo}>{t.grupo}</label>
              <select id={idGrupo} className="entrada-texto sozinha" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                <option value="">{textos.dinheiro.gasto.semGrupo}</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </div>
            {extrato.formato !== "ofx" && <Interruptor compacto rotulo={t.trocar} ligado={trocar} aoMudar={setTrocar} />}
          </div>
          {linhas.length === 0 ? <p>{t.nadaNovo}</p> : (
            <>
              <div className="extrato-marcar">
                <Button className="botao pequeno" onPress={() => setMarcadas(new Set(linhas.map((l) => l.id)))}>{t.marcarTodas}</Button>
                <Button className="botao pequeno" onPress={() => setMarcadas(new Set())}>{t.desmarcarTodas}</Button>
              </div>
              <ul className="extrato-lista">
                {linhas.map((l) => {
                  const saiu = l.centavos < 0;
                  const marcada = marcadas.has(l.id);
                  return (
                    <li key={l.id} className={marcada ? "extrato-linha" : "extrato-linha fora"}>
                      <Checkbox className="caixa" isSelected={marcada} onChange={(v) => alternar(l.id, v)}
                        aria-label={`${diaCurto(l.data)}, ${l.descricao}, ${saiu ? t.saiu : t.entrou} ${formatarMoeda(Math.abs(l.centavos))}`}>
                        <span className="caixa-quadrado" aria-hidden="true">
                          <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                        </span>
                        <span className="extrato-texto">
                          <span className="quebra">{l.descricao}</span>
                          <span className="texto-suave pequeno">{diaCurto(l.data)}{repetidas.has(l.id) ? ` · ${t.pareceRegistrado}` : ""}</span>
                        </span>
                      </Checkbox>
                      <span className="extrato-valor">
                        <span className="texto-suave pequeno">{saiu ? t.saiu : t.entrou}</span>
                        <strong>{formatarMoeda(Math.abs(l.centavos))}</strong>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
      {erro && <p className="aviso aviso-erro" role="alert">{erro}</p>}
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        {extrato && <Button className="botao com-icone" onPress={() => arquivo.current?.click()}><FileUp aria-hidden="true" size="1em" /> {t.outroArquivo}</Button>}
        {!extrato
          ? <Button className="botao principal com-icone" onPress={() => arquivo.current?.click()}><FileUp aria-hidden="true" size="1em" /> {t.escolher}</Button>
          : <Button className="botao principal" isDisabled={!escolhidas.length || salvando} onPress={() => void registrar()}>{salvando ? t.registrando : t.registrar(escolhidas.length)}</Button>}
      </div>
    </div>
  );
}
