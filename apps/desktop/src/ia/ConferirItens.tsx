import { X } from "../icones";
import { useEffect, useState } from "react";
import { Button, Checkbox, Input, TextField } from "react-aria-components";
import { api, type ItemProposto, type Projeto, type TipoItemProposto } from "../api";
import { novoEvento, juntar } from "../agenda/FormEvento";
import { Aviso } from "../componentes/Campo";
import { CampoData } from "../componentes/CampoData";
import { Escolha } from "../componentes/Escolha";
import { Segmentado } from "../componentes/Segmentado";
import { textos } from "../textos/pt-BR";

const t = textos.ia;
const TIPOS: TipoItemProposto[] = ["ideia", "tarefa", "compromisso"];

export interface Linha extends ItemProposto {
  chave: number;
  incluir: boolean;
}

export const comoLinhas = (itens: ItemProposto[]): Linha[] => itens.map((i, chave) => ({ ...i, chave, incluir: true }));

/** O que falta para guardar as linhas marcadas (null = pode guardar). */
export function faltando(linhas: Linha[]): string | null {
  const marcadas = linhas.filter((l) => l.incluir && l.texto.trim());
  if (marcadas.some((l) => l.tipo === "tarefa" && !l.projetoId)) return t.faltaProjeto;
  if (marcadas.some((l) => l.tipo === "compromisso" && !l.data)) return t.faltaDia;
  return null;
}

/** Grava as linhas marcadas, cada uma no seu lugar. Devolve quantas. */
export async function guardarLinhas(linhas: Linha[]): Promise<number> {
  const marcadas = linhas.filter((l) => l.incluir && l.texto.trim());
  for (const l of marcadas) {
    const texto = l.texto.trim();
    if (l.tipo === "ideia") await api.criarIdeia(texto);
    else if (l.tipo === "tarefa") await api.criarTarefa(l.projetoId!, texto);
    else {
      const [a, m, d] = l.data!.split("-").map(Number);
      const base = novoEvento(new Date(a, m - 1, d));
      const inicio = juntar(l.data!, l.hora ?? "00:00");
      await api.salvarEvento({
        ...base,
        titulo: texto,
        inicio,
        fim: l.hora ? inicio + (l.duracaoMin ?? 60) * 60_000 : null,
        diaInteiro: !l.hora,
      });
    }
  }
  return marcadas.length;
}

/** Lista para conferir o que a IA separou: marcar, editar, trocar o tipo, o projeto e o dia. */
export function ConferirItens({ linhas, aoMudar }: { linhas: Linha[]; aoMudar: (linhas: Linha[]) => void }) {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  useEffect(() => {
    api.listarProjetos().then((ps) => setProjetos(ps.filter((p) => p.estado === "ativo")), () => {});
  }, []);

  const mudar = (chave: number, parte: Partial<Linha>) => aoMudar(linhas.map((l) => (l.chave === chave ? { ...l, ...parte } : l)));
  const aviso = faltando(linhas);

  return (
    <>
      <p className="texto-suave">{t.conferirAjuda}</p>
      <ul className="lista-itens-ia">
        {linhas.map((l, i) => (
          <li key={l.chave} className={l.incluir ? "item-ia" : "item-ia desmarcado"}>
            <div className="passo-ia">
              <Checkbox className="caixa estreita" isSelected={l.incluir} onChange={(incluir) => mudar(l.chave, { incluir })} aria-label={t.incluir(l.texto || t.item(i + 1))}>
                <span className="caixa-quadrado" aria-hidden="true">
                  <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                </span>
              </Checkbox>
              <TextField className="passo-ia-texto" value={l.texto} onChange={(texto) => mudar(l.chave, { texto })} aria-label={t.item(i + 1)} autoFocus={i === 0}>
                <Input className={l.incluir ? "entrada-texto sozinha" : "entrada-texto sozinha desmarcado"} maxLength={300} />
              </TextField>
              <Button className="botao-icone" onPress={() => aoMudar(linhas.filter((x) => x.chave !== l.chave))} aria-label={t.tirar(i + 1)}>
                <X aria-hidden="true" size="1.1em" />
              </Button>
            </div>
            {l.incluir && (
              <div className="item-ia-detalhes">
                <Segmentado<TipoItemProposto>
                  rotulo={t.tipoDe(i + 1)}
                  rotuloOculto
                  valor={l.tipo}
                  opcoes={TIPOS.map((x) => ({ valor: x, nome: t.tipos[x] }))}
                  aoMudar={(tipo) => mudar(l.chave, { tipo })}
                />
                {l.tipo === "tarefa" && (
                  <Escolha
                    rotulo={t.projetoDe}
                    valor={l.projetoId}
                    vazio={t.escolhaProjeto}
                    opcoes={projetos.map((p) => ({ valor: p.id, nome: p.titulo }))}
                    aoMudar={(projetoId) => mudar(l.chave, { projetoId })}
                  />
                )}
                {l.tipo === "compromisso" && (
                  <div className="linha-campos">
                    <CampoData rotulo={t.dia} tipo="date" valor={l.data ?? ""} aoMudar={(v) => mudar(l.chave, { data: v || null })} />
                    <CampoData rotulo={t.hora} tipo="time" valor={l.hora ?? ""} aoMudar={(v) => mudar(l.chave, { hora: v || null })} />
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {aviso && <Aviso tipo="info">{aviso}</Aviso>}
    </>
  );
}
