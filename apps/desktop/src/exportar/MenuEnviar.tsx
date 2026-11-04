// Botão "Enviar" (documento e caderno): escolhe o formato, prepara o arquivo e entrega
// pelo jeito do aparelho (Compartilhar no iPad, "Salvar como" no computador).
import { useState } from "react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
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

export function MenuEnviar({ opcoes, aoEscolher }: {
  opcoes: { id: string; nome: string }[];
  aoEscolher: (id: string) => Promise<ArquivoPronto | null>;
}) {
  const recado = useRecado();
  const [ocupado, setOcupado] = useState(false);
  const [pronto, setPronto] = useState<File | null>(null);
  const escolher = async (id: string) => {
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
            {opcoes.map((o) => <MenuItem key={o.id} id={o.id} className="menu-item">{o.nome}</MenuItem>)}
          </Menu>
        </Popover>
      </MenuTrigger>
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
