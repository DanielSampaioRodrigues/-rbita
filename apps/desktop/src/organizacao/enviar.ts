// Enviar um quadro: vira um texto em lista (coluna por coluna, com as caixinhas de
// feito, a data, as etiquetas, a descrição e as checklists), que vai pelo Compartilhar
// do aparelho (WhatsApp, e-mail, Drive) ou é copiado. Quem recebe lê em qualquer lugar,
// sem precisar do Órbita. (Editar o mesmo quadro a duas pessoas pede sincronização com
// conta, que fica para depois.)
import type { CartaoOrg, Coluna, EtiquetaOrg } from "../api";

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

export function quadroEmTexto(nome: string, colunas: Coluna[], cartoes: CartaoOrg[], etiquetas: EtiquetaOrg[], semNome: string): string {
  const porId = new Map(etiquetas.map((e) => [e.id, e.nome]));
  const linhas: string[] = [`# ${nome}`, ""];
  for (const col of [...colunas].filter((x) => !x.arquivada).sort((a, b) => a.ordem - b.ordem)) {
    const cs = cartoes.filter((c) => c.colunaId === col.id && !c.arquivado).sort((a, b) => a.ordem - b.ordem);
    linhas.push(`## ${col.nome || semNome} (${cs.length})`, "");
    for (const c of cs) {
      const extras: string[] = [];
      if (c.prazo) extras.push(`entrega ${dataBr(c.prazo)}${c.hora ? ` às ${c.hora}` : ""}`);
      const ets = (c.etiquetas ?? []).map((id) => porId.get(id)).filter(Boolean);
      if (ets.length) extras.push(ets.join(", "));
      linhas.push(`- [${c.feito ? "x" : " "}] ${c.texto.trim()}${extras.length ? ` (${extras.join(" · ")})` : ""}`);
      const desc = (c.descricao ?? "").trim();
      if (desc) for (const l of desc.split(/\r?\n/)) linhas.push(l.trim() ? `    ${l}` : "");
      for (const cl of c.checklists ?? []) {
        if (!cl.itens.length) continue;
        linhas.push(`    ${cl.nome}:`);
        for (const i of cl.itens) linhas.push(`    - [${i.feito ? "x" : " "}] ${i.texto}`);
      }
    }
    if (!cs.length) linhas.push("_(vazia)_");
    linhas.push("");
  }
  return linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
