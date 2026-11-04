// Botão "Enviar" (documento e caderno): escolhe o formato, prepara o arquivo e entrega
// pelo jeito do aparelho (Compartilhar no iPad, "Salvar como" no computador).
import { useState } from "react";
import { Button, Header, Menu, MenuItem, MenuSection, MenuTrigger, Popover } from "react-aria-components";
import { conectar, contaConectada, conectoresDisponiveis } from "../conectores/google";
import { salvarNoDrive } from "../conectores/drive";
import { JanelaClassroom } from "../conectores/JanelaClassroom";
import { api } from "../api";
import { ExternalLink } from "../icones";
import { useRecado } from "../app/Recado";
import { Janela } from "../componentes/Janela";
import { Share } from "../icones";
import { textos } from "../textos/pt-BR";
import { compartilhar, entregarArquivo, PrecisaDeToque } from "./entregar";

const t = textos.caderno.enviar;

export interface ArquivoPronto {
  nome: string;
  tipo: string;
  dados: Blob | Uint8Array;
  filtro: { nome: string; extensao: string };
  /** Recado a mais (ex.: fonte que entrou por uma parecida). */
  aviso?: string;
}

export function MenuEnviar({ opcoes, aoEscolher, google }: {
  opcoes: { id: string; nome: string }[];
  aoEscolher: (id: string) => Promise<ArquivoPronto | null>;
  /** Opções da conta Google: qual formato vai para o Drive e o Classroom (PDF) e qual vira Google Docs (Word). */
  google?: { pdf: string; word?: string };
}) {
  const recado = useRecado();
  const [ocupado, setOcupado] = useState(false);
  const [pronto, setPronto] = useState<File | null>(null);
  const [noDrive, setNoDrive] = useState<{ nome: string; link: string; docs: boolean } | null>(null);
  const [semConta, setSemConta] = useState<string | null>(null);
  const [classroom, setClassroom] = useState(false);
  const tg = textos.conectores.enviar;
  /** Drive, Docs e Classroom: sem conta ligada, oferece ligar ali mesmo. */
  const noGoogle = async (qual: string) => {
    if (!google) return;
    const conta = await contaConectada().catch(() => null);
    if (!conta) { setSemConta(qual); return; }
    if (qual === "g:classroom") { setClassroom(true); return; }
    setOcupado(true);
    recado(tg.salvando);
    try {
      const docs = qual === "g:docs";
      const a = await aoEscolher(docs && google.word ? google.word : google.pdf);
      if (!a) return;
      const r = await salvarNoDrive(a.nome, a.tipo, a.dados, { comoDocs: docs });
      setNoDrive({ nome: r.nome, link: r.link, docs });
    } catch (e) {
      recado(t.erro(e instanceof Error ? e.message : String(e)));
    } finally {
      setOcupado(false);
    }
  };
  const escolher = async (id: string) => {
    if (id.startsWith("g:")) { await noGoogle(id); return; }
    if (ocupado) return;
    setOcupado(true);
    recado(t.preparando);
    try {
      const a = await aoEscolher(id);
      if (!a) return;
      const e = await entregarArquivo(a.nome, a.tipo, a.dados, a.filtro);
      if (e.como === "salvo" && e.onde) recado(t.salvo(e.onde));
      else if (e.como === "baixado") recado(t.baixado(a.nome));
      else if (e.como === "compartilhado") recado(t.compartilhado);
      if (a.aviso && e.como !== "cancelado") setTimeout(() => recado(a.aviso!), 2500);
    } catch (e) {
      if (e instanceof PrecisaDeToque) setPronto(e.arquivo);
      else recado(t.erro(e instanceof Error ? e.message : String(e)));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <>
      <MenuTrigger>
        <Button className="botao pequeno com-icone" aria-label={t.titulo} isDisabled={ocupado}>
          <Share aria-hidden="true" size="1.05em" /> {t.botao}
        </Button>
        <Popover className="menu-popover" placement="bottom end">
          <Menu className="menu-lista" aria-label={t.titulo} onAction={(k) => void escolher(String(k))}>
            <MenuSection className="menu-secao" aria-label={t.titulo}>
              {opcoes.map((o) => <MenuItem key={o.id} id={o.id} className="menu-item">{o.nome}</MenuItem>)}
            </MenuSection>
            {google && conectoresDisponiveis() && (
              <MenuSection className="menu-secao" aria-label={tg.grupo}>
                <Header className="menu-cabecalho">{tg.grupo}</Header>
                <MenuItem id="g:drive" className="menu-item">{tg.drive}</MenuItem>
                {google.word && <MenuItem id="g:docs" className="menu-item">{tg.docs}</MenuItem>}
                <MenuItem id="g:classroom" className="menu-item">{tg.classroom}</MenuItem>
              </MenuSection>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
      <Janela titulo={tg.salvoTitulo} aberta={!!noDrive} aoFechar={() => setNoDrive(null)} pequena>
        <p>{noDrive ? tg.salvoTexto(noDrive.nome) : ""}</p>
        <div className="janela-acoes">
          <Button className="botao" onPress={() => setNoDrive(null)}>{textos.comum.fechar}</Button>
          <Button className="botao principal com-icone" autoFocus onPress={() => { const d = noDrive; setNoDrive(null); if (d) void api.abrirEndereco(d.link).catch(() => undefined); }}>
            <ExternalLink aria-hidden="true" size="1em" /> {noDrive?.docs ? tg.abrirDocs : tg.abrirDrive}
          </Button>
        </div>
      </Janela>
      <Janela titulo={tg.semContaTitulo} aberta={!!semConta} aoFechar={() => setSemConta(null)} pequena>
        <p>{tg.semContaTexto}</p>
        <div className="janela-acoes">
          <Button className="botao" onPress={() => setSemConta(null)}>{textos.comum.cancelar}</Button>
          <Button className="botao principal" autoFocus onPress={() => {
            const qual = semConta;
            setSemConta(null);
            // Sem await antes: no iPad, a janela do Google só abre se nascer do toque.
            conectar().then(() => { if (qual) void noGoogle(qual); }, (e) => recado(t.erro(e instanceof Error ? e.message : String(e))));
          }}>{textos.conectores.google.ligar}</Button>
        </div>
      </Janela>
      {google && <JanelaClassroom aberta={classroom} aoFechar={() => setClassroom(false)} fazerArquivo={async () => { const a = await aoEscolher(google.pdf); return a ? { nome: a.nome, tipo: a.tipo, dados: a.dados } : null; }} />}
      <Janela titulo={t.prontoTitulo} aberta={!!pronto} aoFechar={() => setPronto(null)} pequena>
        <p>{pronto ? t.prontoTexto(pronto.name) : ""}</p>
        <div className="janela-acoes">
          <Button className="botao" onPress={() => setPronto(null)}>{textos.comum.fechar}</Button>
          <Button className="botao principal" autoFocus onPress={() => {
            const f = pronto;
            setPronto(null);
            if (f) void compartilhar(f).then((e) => { if (e.como === "compartilhado") recado(t.compartilhado); }, (er) => recado(t.erro(er instanceof Error ? er.message : String(er))));
          }}>{t.compartilhar}</Button>
        </div>
      </Janela>
    </>
  );
}
