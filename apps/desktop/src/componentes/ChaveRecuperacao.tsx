import { Copy, Download, Printer } from "../icones";
import { useState } from "react";
import { Button } from "react-aria-components";
import { salvarArquivoRecuperacao } from "../api";
import { textoDaChave } from "../palavras";
import { textos } from "../textos/pt-BR";
import { Aviso } from "./Campo";

const t = textos.chave;

/** Mostra as 6 palavras e os jeitos de guardá-las. */
export function ChaveRecuperacao({ palavras }: { palavras: string[] }) {
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const executar = async (acao: () => Promise<string | null>) => {
    setAviso(null);
    try {
      const texto = await acao();
      if (texto) setAviso({ tipo: "ok", texto });
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="chave">
      <ol className="chave-palavras">
        {palavras.map((p, i) => (
          <li key={i}>
            <span className="chave-numero">{i + 1}</span>
            <span className="chave-palavra">{p}</span>
          </li>
        ))}
      </ol>

      <div className="botoes">
        <Button className="botao" onPress={() => executar(async () => ((await salvarArquivoRecuperacao()) ? t.salvo : null))}>
          <Download aria-hidden="true" size="1.1em" /> {t.salvarArquivo}
        </Button>
        <Button className="botao" onPress={() => executar(async () => (window.print(), null))}>
          <Printer aria-hidden="true" size="1.1em" /> {t.imprimir}
        </Button>
        <Button
          className="botao"
          onPress={() => executar(async () => (await navigator.clipboard.writeText(textoDaChave(palavras)), t.copiado))}
        >
          <Copy aria-hidden="true" size="1.1em" /> {t.copiar}
        </Button>
      </div>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

      {/* Só aparece na impressão. */}
      <pre className="so-impressao">{textoDaChave(palavras)}</pre>
    </div>
  );
}
