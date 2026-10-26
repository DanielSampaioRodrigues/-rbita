import { useState } from "react";
import { Button } from "react-aria-components";
import { api, escolherOndeExportar } from "../api";
import { Aviso } from "../componentes/Campo";
import { CalendarDays, Download, FileText, Wallet } from "../icones";
import { eventosParaICS, gastosParaCSV, montarJSON, paraMarkdown, registrosSaudeParaCSV } from "../exportar/exportar";
import { textos } from "../textos/pt-BR";

const t = textos.exportar;
const hoje = () => new Date().toISOString().slice(0, 10);
const INICIO = 0;
const FIM = Date.now() + 10 * 365 * 86_400_000; // bem à frente, para pegar tudo

/** Exportar os dados em formatos abertos (ICS, CSV, JSON), para levar para fora. */
export function Exportar() {
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Gera o conteúdo, pede onde salvar e grava. `bom` liga o marcador do Excel no CSV.
  const exportar = (nomeBase: string, nomeFiltro: string, ext: string, gerar: () => Promise<string>, bom = false) => async () => {
    setOcupado(true);
    setAviso(null);
    try {
      const conteudo = await gerar();
      const caminho = await escolherOndeExportar(`${nomeBase}-${hoje()}`, nomeFiltro, ext);
      if (!caminho) return;
      await api.exportarTexto(caminho, bom ? "﻿" + conteudo : conteudo);
      setAviso({ tipo: "ok", texto: t.feito });
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado(false);
    }
  };

  const agenda = exportar(t.agenda.arquivo, t.agenda.filtro, "ics", async () => {
    const eventos = await api.listarEventos(INICIO, FIM);
    return eventosParaICS(eventos);
  });

  const gastos = exportar(t.gastos.arquivo, t.gastos.filtro, "csv", async () => {
    const [lista, grupos] = await Promise.all([api.listarGastos(INICIO, FIM), api.listarGruposGasto()]);
    return gastosParaCSV(lista, grupos);
  }, true);

  const saude = exportar(t.saude.arquivo, t.saude.filtro, "csv", async () => {
    const regs = await api.listarRegistrosSaude(INICIO, FIM);
    const rotulos = textos.saude.registros.tipos as Record<string, string>;
    return registrosSaudeParaCSV(regs, (tipo) => rotulos[tipo] ?? tipo);
  }, true);

  // Junta os dados de todos os módulos (cada um à prova de falha).
  const coletar = async () => {
    const vazio = () => [] as never[];
    const [
      ideias, projetos, rotinas, agenda, remedios, planosDeSaude, profissionais, materias, atividades, aulas,
      gruposDeGasto, gastos, contas, desejos, metas, hobbies, quadros, livros, gruposDeLivro, registrosDeSaude,
    ] = await Promise.all([
      api.listarIdeias().catch(vazio), api.listarProjetos().catch(vazio), api.listarRotinas().catch(vazio),
      api.listarEventos(INICIO, FIM).catch(vazio), api.listarRemedios().catch(vazio), api.listarPlanos().catch(vazio),
      api.listarProfissionais().catch(vazio), api.listarMaterias().catch(vazio), api.listarAtividades().catch(vazio),
      api.listarAulas().catch(vazio), api.listarGruposGasto().catch(vazio), api.listarGastos(INICIO, FIM).catch(vazio),
      api.listarContas().catch(vazio), api.listarDesejos().catch(vazio), api.listarMetas().catch(vazio),
      api.listarHobbies().catch(vazio), api.listarQuadros().catch(vazio), api.listarLivros().catch(vazio),
      api.listarGruposLivro().catch(vazio), api.listarRegistrosSaude(INICIO, FIM).catch(vazio),
    ]);
    return {
      ideias, projetos, rotinas, agenda, remedios, planosDeSaude, profissionais, materias, atividades, aulas,
      gruposDeGasto, gastos, contas, desejos, metas, hobbies, quadros, livros, gruposDeLivro, registrosDeSaude,
    };
  };

  const tudo = exportar(t.tudo.arquivo, t.tudo.filtro, "json", async () => montarJSON(await coletar()));
  const resumo = exportar(t.resumo.arquivo, t.resumo.filtro, "md", async () => paraMarkdown(await coletar()));

  return (
    <section className="cartao">
      <h2>{t.titulo}</h2>
      <p className="texto-suave">{t.explicacao}</p>
      <div className="botoes">
        <Button className="botao" isDisabled={ocupado} onPress={agenda}><CalendarDays aria-hidden="true" size="1.1em" /> {t.agenda.botao}</Button>
        <Button className="botao" isDisabled={ocupado} onPress={gastos}><Wallet aria-hidden="true" size="1.1em" /> {t.gastos.botao}</Button>
        <Button className="botao" isDisabled={ocupado} onPress={saude}><FileText aria-hidden="true" size="1.1em" /> {t.saude.botao}</Button>
        <Button className="botao" isDisabled={ocupado} onPress={resumo}><FileText aria-hidden="true" size="1.1em" /> {t.resumo.botao}</Button>
        <Button className="botao principal" isDisabled={ocupado} onPress={tudo}><Download aria-hidden="true" size="1.1em" /> {t.tudo.botao}</Button>
      </div>
      <p className="campo-ajuda">{t.ajuda}</p>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
    </section>
  );
}
