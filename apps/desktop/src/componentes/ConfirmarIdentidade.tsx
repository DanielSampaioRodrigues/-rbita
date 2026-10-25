import { useState } from "react";
import { Button } from "react-aria-components";
import type { Confirmacao, ModoAbrir } from "../api";
import { QUANTIDADE, reconhecer } from "../palavras";
import { textos } from "../textos/pt-BR";
import { Campo } from "./Campo";
import { CampoPalavras } from "./CampoPalavras";

const t = textos.seguranca;
type Forma = "senha" | "pin" | "aparelho" | "palavras";

/**
 * Confirmar que é a pessoa antes de uma ação sensível, do jeito que ela já usa:
 * senha (se tiver criado), PIN, Windows Hello ou abrir direto. As 6 palavras servem sempre.
 */
export function useConfirmarIdentidade(modo: ModoAbrir | null, temSenha: boolean) {
  const padrao: Forma = temSenha ? "senha" : modo === "pin" ? "pin" : modo === "hello" || modo === "direto" ? "aparelho" : "palavras";
  const [forma, setForma] = useState<Forma>(padrao);
  const [valor, setValor] = useState("");
  const [palavras, setPalavras] = useState<string[]>(Array(QUANTIDADE).fill(""));

  const confirmacao: Confirmacao | null =
    forma === "aparelho"
      ? { tipo: "aparelho" }
      : forma === "palavras"
        ? palavras.every((p) => reconhecer(p)) ? { tipo: "palavras", valor: palavras.join(" ") } : null
        : valor ? { tipo: forma, valor } : null;

  const trocar = (f: Forma) => (setForma(f), setValor(""));

  const campos = (
    <div className="formulario">
      {forma === "senha" && (
        <Campo key="senha" rotulo={textos.senha.rotulo} valor={valor} aoMudar={setValor} secreto descricao={t.confirmarComSenha} autoComplete="current-password" />
      )}
      {forma === "pin" && (
        <Campo key="pin" rotulo={textos.pin.rotulo} valor={valor} aoMudar={setValor} secreto numerico maximo={8} descricao={t.confirmarComPin} />
      )}
      {forma === "aparelho" && <p className="texto-suave">{modo === "hello" ? t.confirmarComHello : t.confirmarDireto}</p>}
      {forma === "palavras" && (
        <>
          <p className="texto-suave">{t.confirmarComPalavras}</p>
          <CampoPalavras valores={palavras} aoMudar={setPalavras} />
        </>
      )}
      <div className="links">
        {forma !== "palavras" ? (
          <Button className="link" onPress={() => trocar("palavras")}>{t.usarPalavras}</Button>
        ) : (
          padrao !== "palavras" && <Button className="link" onPress={() => trocar(padrao)}>{t.usarJeitoDeSempre}</Button>
        )}
      </div>
    </div>
  );

  return { confirmacao, campos };
}
