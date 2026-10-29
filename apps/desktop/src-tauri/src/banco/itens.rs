//! Ideias, projetos e tarefas, todos guardados na tabela `item`.
//!
//! - **Ideia** (`guardada`): fica guardada sem virar compromisso até a pessoa decidir.
//! - **Projeto** (`ativo`, `pausado`, `concluido`): tem limite de ativos e um
//!   cartão "onde parei" sempre à mão.
//! - **Tarefa** (`a_fazer`, `fazendo`, `feita`): filha de um projeto (etapa) ou
//!   de outra tarefa (subtarefa).

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::{agora_ms, etiquetas, gravar_config, ler_config, novo_id};
use crate::erro::Erro;

const CONFIG_LIMITE: &str = "limite_projetos_ativos";
pub const LIMITE_PADRAO: u32 = 6;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Ideia {
    pub id: String,
    pub texto: String,
    pub criado_em: i64,
    /// Texto mais longo, opcional.
    pub nota: String,
    /// Ids das etiquetas.
    pub etiquetas: Vec<String>,
    /// Ids das outras ideias ligadas a esta.
    pub ligadas: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OndeParei {
    #[serde(default)]
    pub texto: String,
    #[serde(default)]
    pub proximo_passo: String,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub atualizado_em: i64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DadosProjeto {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    onde_parei: Option<OndeParei>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pausado_em: Option<i64>,
    /// Datas no calendário ("AAAA-MM-DD"), opcionais.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    inicio: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    prazo: Option<String>,
    /// Campos que outras partes do app guardam (por exemplo, o peso das tarefas).
    #[serde(flatten)]
    outros: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Projeto {
    pub id: String,
    pub titulo: String,
    pub estado: String,
    pub onde_parei: Option<OndeParei>,
    pub pausado_em: Option<i64>,
    pub inicio: Option<String>,
    pub prazo: Option<String>,
    pub criado_em: i64,
    pub tarefas_feitas: u32,
    pub tarefas_total: u32,
    pub alterado_em: i64,
    /// Ids das etiquetas.
    pub etiquetas: Vec<String>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Tarefa {
    pub id: String,
    pub pai_id: String,
    pub titulo: String,
    pub estado: String,
    pub ordem: f64,
    /// leve, media ou pesada (para planejar pela energia).
    pub peso: Option<String>,
    /// Prazo ("AAAA-MM-DD"), opcional.
    pub prazo: Option<String>,
    /// Ids das etiquetas.
    pub etiquetas: Vec<String>,
}

/// Um item qualquer, só com o necessário para mostrar numa lista de ligações.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ItemResumo {
    pub id: String,
    /// ideia, projeto ou tarefa.
    pub tipo: String,
    pub titulo: String,
    pub estado: Option<String>,
}

/// Itens ligados a este (ideias, projetos, tarefas), nos dois sentidos.
pub fn resumo_ligados(conn: &Connection, id: &str) -> Result<Vec<ItemResumo>, Erro> {
    let mut lista = Vec::new();
    for outro in etiquetas::ligados(conn, id)? {
        let r = conn
            .query_row(
                "SELECT id, tipo, CASE WHEN tipo = 'ideia' THEN conteudo ELSE titulo END, estado FROM item WHERE id = ?1 AND excluido_em IS NULL",
                [&outro],
                |r| Ok(ItemResumo { id: r.get(0)?, tipo: r.get(1)?, titulo: r.get(2)?, estado: r.get(3)? }),
            )
            .optional()?;
        if let Some(r) = r.filter(|r| ["ideia", "projeto", "tarefa"].contains(&r.tipo.as_str())) {
            lista.push(r);
        }
    }
    Ok(lista)
}

const ESTADOS_PROJETO: &[&str] = &["ativo", "pausado", "concluido"];
const ESTADOS_TAREFA: &[&str] = &["a_fazer", "fazendo", "feita"];

fn texto_limpo(texto: &str) -> Result<String, Erro> {
    let t = texto.trim();
    if t.is_empty() {
        return Err(Erro::TextoVazio);
    }
    Ok(t.to_string())
}

// ---------- Ideias ----------

pub fn listar_ideias(conn: &Connection) -> Result<Vec<Ideia>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, conteudo, criado_em, coalesce(json_extract(dados, '$.nota'), '') FROM item
         WHERE tipo = 'ideia' AND estado = 'guardada' AND excluido_em IS NULL
         ORDER BY criado_em DESC, id DESC",
    )?;
    let mut ideias = c
        .query_map([], |r| {
            Ok(Ideia { id: r.get(0)?, texto: r.get(1)?, criado_em: r.get(2)?, nota: r.get(3)?, etiquetas: vec![], ligadas: vec![] })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let guardadas: Vec<String> = ideias.iter().map(|i| i.id.clone()).collect();
    for i in &mut ideias {
        i.etiquetas = etiquetas::do_item(conn, &i.id)?;
        // Só as ligações com outras ideias guardadas (não com o projeto em que uma virou).
        i.ligadas = etiquetas::ligados(conn, &i.id)?.into_iter().filter(|o| guardadas.contains(o)).collect();
    }
    Ok(ideias)
}

pub fn criar_ideia(conn: &Connection, texto: &str) -> Result<Ideia, Erro> {
    let ideia = Ideia { id: novo_id(), texto: texto_limpo(texto)?, criado_em: agora_ms(), nota: String::new(), etiquetas: vec![], ligadas: vec![] };
    conn.execute(
        "INSERT INTO item (id, tipo, conteudo, estado, criado_em, alterado_em) VALUES (?1, 'ideia', ?2, 'guardada', ?3, ?3)",
        params![ideia.id, ideia.texto, ideia.criado_em],
    )?;
    Ok(ideia)
}

/// A nota mais longa da ideia (vazia apaga).
pub fn salvar_nota_ideia(conn: &Connection, id: &str, nota: &str) -> Result<(), Erro> {
    let nota: String = nota.trim().chars().take(20_000).collect();
    let n = conn.execute(
        "UPDATE item SET dados = json_set(dados, '$.nota', ?2), alterado_em = ?3 WHERE id = ?1 AND tipo = 'ideia' AND excluido_em IS NULL",
        params![id, nota, agora_ms()],
    )?;
    if n == 0 {
        return Err(Erro::NaoEncontrado);
    }
    Ok(())
}

pub fn editar_ideia(conn: &Connection, id: &str, texto: &str) -> Result<(), Erro> {
    conn.execute(
        "UPDATE item SET conteudo = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo = 'ideia'",
        params![id, texto_limpo(texto)?, agora_ms()],
    )?;
    Ok(())
}

/// A ideia vira projeto. O texto da ideia vira o título e fica ligada ao projeto.
pub fn ideia_para_projeto(conn: &Connection, id: &str, ativo: bool) -> Result<Projeto, Erro> {
    let texto: String = conn
        .query_row("SELECT conteudo FROM item WHERE id = ?1 AND tipo = 'ideia' AND excluido_em IS NULL", [id], |r| r.get(0))
        .optional()?
        .ok_or(Erro::NaoEncontrado)?;
    let projeto = criar_projeto(conn, &texto, ativo)?;
    let agora = agora_ms();
    conn.execute("UPDATE item SET estado = 'virou_projeto', alterado_em = ?2 WHERE id = ?1", params![id, agora])?;
    conn.execute(
        "INSERT INTO ligacao (id, origem_tipo, origem_id, destino_tipo, destino_id, tipo, criado_em, alterado_em)
         VALUES (?1, 'item', ?2, 'item', ?3, 'virou', ?4, ?4)",
        params![novo_id(), id, projeto.id, agora],
    )?;
    Ok(projeto)
}

// ---------- Projetos ----------

pub fn limite(conn: &Connection) -> Result<u32, Erro> {
    Ok(ler_config(conn, CONFIG_LIMITE)?.and_then(|v| v.parse().ok()).unwrap_or(LIMITE_PADRAO))
}

pub fn definir_limite(conn: &Connection, limite: u32) -> Result<(), Erro> {
    if !(1..=50).contains(&limite) {
        return Err(Erro::Interno("o limite precisa ficar entre 1 e 50".into()));
    }
    gravar_config(conn, CONFIG_LIMITE, &limite.to_string())
}

fn contar_ativos(conn: &Connection) -> Result<u32, Erro> {
    Ok(conn.query_row(
        "SELECT count(*) FROM item WHERE tipo = 'projeto' AND estado = 'ativo' AND excluido_em IS NULL",
        [],
        |r| r.get(0),
    )?)
}

/// Recusa ativar mais um projeto se o limite já foi atingido.
fn conferir_limite(conn: &Connection) -> Result<(), Erro> {
    let limite = limite(conn)?;
    if contar_ativos(conn)? >= limite {
        return Err(Erro::LimiteDeProjetos { limite });
    }
    Ok(())
}

fn ler_dados(conn: &Connection, id: &str) -> Result<DadosProjeto, Erro> {
    let texto: String = conn
        .query_row("SELECT dados FROM item WHERE id = ?1 AND tipo = 'projeto'", [id], |r| r.get(0))
        .optional()?
        .ok_or(Erro::NaoEncontrado)?;
    Ok(serde_json::from_str(&texto).unwrap_or_default())
}

fn gravar_dados(conn: &Connection, id: &str, dados: &DadosProjeto) -> Result<(), Erro> {
    let texto = serde_json::to_string(dados).map_err(|e| Erro::Interno(e.to_string()))?;
    conn.execute("UPDATE item SET dados = ?2, alterado_em = ?3 WHERE id = ?1", params![id, texto, agora_ms()])?;
    Ok(())
}

const SELECAO_PROJETO: &str = "
    SELECT p.id, p.titulo, p.estado, p.dados, p.alterado_em, p.criado_em,
      (SELECT count(*) FROM item t WHERE t.tipo = 'tarefa' AND t.excluido_em IS NULL AND t.estado = 'feita'
         AND (t.pai_id = p.id OR t.pai_id IN (SELECT e.id FROM item e WHERE e.pai_id = p.id))),
      (SELECT count(*) FROM item t WHERE t.tipo = 'tarefa' AND t.excluido_em IS NULL
         AND (t.pai_id = p.id OR t.pai_id IN (SELECT e.id FROM item e WHERE e.pai_id = p.id)))
    FROM item p WHERE p.tipo = 'projeto' AND p.excluido_em IS NULL";

fn projeto_da_linha(r: &rusqlite::Row) -> rusqlite::Result<Projeto> {
    let dados: DadosProjeto = serde_json::from_str(&r.get::<_, String>(3)?).unwrap_or_default();
    Ok(Projeto {
        id: r.get(0)?,
        titulo: r.get(1)?,
        estado: r.get(2)?,
        onde_parei: dados.onde_parei,
        pausado_em: dados.pausado_em,
        inicio: dados.inicio,
        prazo: dados.prazo,
        alterado_em: r.get(4)?,
        criado_em: r.get(5)?,
        tarefas_feitas: r.get(6)?,
        tarefas_total: r.get(7)?,
        etiquetas: vec![],
    })
}

fn com_etiquetas(conn: &Connection, mut p: Projeto) -> Result<Projeto, Erro> {
    p.etiquetas = etiquetas::do_item(conn, &p.id)?;
    Ok(p)
}

pub fn listar_projetos(conn: &Connection) -> Result<Vec<Projeto>, Erro> {
    let mut c = conn.prepare(&format!("{SELECAO_PROJETO} ORDER BY p.alterado_em DESC"))?;
    let projetos = c.query_map([], projeto_da_linha)?.collect::<Result<Vec<_>, _>>()?;
    projetos.into_iter().map(|p| com_etiquetas(conn, p)).collect()
}

pub fn obter_projeto(conn: &Connection, id: &str) -> Result<Projeto, Erro> {
    let p = conn.query_row(&format!("{SELECAO_PROJETO} AND p.id = ?1"), [id], projeto_da_linha).optional()?.ok_or(Erro::NaoEncontrado)?;
    com_etiquetas(conn, p)
}

/// Cria um projeto ativo (respeitando o limite) ou já pausado.
pub fn criar_projeto(conn: &Connection, titulo: &str, ativo: bool) -> Result<Projeto, Erro> {
    let titulo = texto_limpo(titulo)?;
    if ativo {
        conferir_limite(conn)?;
    }
    let id = novo_id();
    let agora = agora_ms();
    let dados = if ativo { DadosProjeto::default() } else { DadosProjeto { pausado_em: Some(agora), ..Default::default() } };
    conn.execute(
        "INSERT INTO item (id, tipo, titulo, estado, dados, criado_em, alterado_em) VALUES (?1, 'projeto', ?2, ?3, ?4, ?5, ?5)",
        params![id, titulo, if ativo { "ativo" } else { "pausado" }, serde_json::to_string(&dados).unwrap(), agora],
    )?;
    obter_projeto(conn, &id)
}

pub fn renomear(conn: &Connection, id: &str, titulo: &str) -> Result<(), Erro> {
    conn.execute(
        "UPDATE item SET titulo = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo IN ('projeto', 'tarefa', 'rotina')",
        params![id, texto_limpo(titulo)?, agora_ms()],
    )?;
    Ok(())
}

/// Ativar respeita o limite. Pausar pode guardar o cartão "onde parei" no mesmo passo.
pub fn mudar_estado_projeto(conn: &Connection, id: &str, estado: &str, onde_parei: Option<OndeParei>) -> Result<Projeto, Erro> {
    if !ESTADOS_PROJETO.contains(&estado) {
        return Err(Erro::Interno(format!("estado de projeto desconhecido: {estado}")));
    }
    let atual = obter_projeto(conn, id)?;
    if estado == "ativo" && atual.estado != "ativo" {
        conferir_limite(conn)?;
    }
    let mut dados = ler_dados(conn, id)?;
    if let Some(mut o) = onde_parei {
        o.atualizado_em = agora_ms();
        dados.onde_parei = Some(o);
    }
    dados.pausado_em = (estado == "pausado").then(agora_ms);
    gravar_dados(conn, id, &dados)?;
    conn.execute("UPDATE item SET estado = ?2 WHERE id = ?1", params![id, estado])?;
    obter_projeto(conn, id)
}

pub fn salvar_onde_parei(conn: &Connection, id: &str, mut onde_parei: OndeParei) -> Result<(), Erro> {
    let mut dados = ler_dados(conn, id)?;
    onde_parei.links.retain(|l| !l.trim().is_empty());
    onde_parei.atualizado_em = agora_ms();
    dados.onde_parei = Some(onde_parei);
    gravar_dados(conn, id, &dados)
}

/// Marca como excluído o item e tudo o que está abaixo dele.
pub fn excluir(conn: &Connection, id: &str) -> Result<(), Erro> {
    let agora = agora_ms();
    conn.execute(
        "WITH RECURSIVE abaixo(id) AS (SELECT ?1 UNION ALL SELECT i.id FROM item i JOIN abaixo a ON i.pai_id = a.id)
         UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id IN abaixo AND excluido_em IS NULL",
        params![id, agora],
    )?;
    Ok(())
}

// ---------- Tarefas ----------

/// Todas as tarefas de um projeto (etapas e subtarefas), na ordem.
pub fn listar_tarefas(conn: &Connection, projeto_id: &str) -> Result<Vec<Tarefa>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, pai_id, titulo, estado, ordem, json_extract(dados, '$.peso'), json_extract(dados, '$.prazo') FROM item
         WHERE tipo = 'tarefa' AND excluido_em IS NULL
           AND (pai_id = ?1 OR pai_id IN (SELECT id FROM item WHERE pai_id = ?1 AND tipo = 'tarefa' AND excluido_em IS NULL))
         ORDER BY ordem, criado_em",
    )?;
    let mut tarefas = c
        .query_map([projeto_id], |r| {
            Ok(Tarefa { id: r.get(0)?, pai_id: r.get(1)?, titulo: r.get(2)?, estado: r.get(3)?, ordem: r.get(4)?, peso: r.get(5)?, prazo: r.get(6)?, etiquetas: vec![] })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for t in &mut tarefas {
        t.etiquetas = etiquetas::do_item(conn, &t.id)?;
    }
    Ok(tarefas)
}

fn tocar(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET alterado_em = ?2 WHERE id = ?1", params![id, agora_ms()])?;
    Ok(())
}

/// Projeto ao qual a tarefa pertence (sobe até dois níveis).
fn projeto_da_tarefa(conn: &Connection, pai_id: &str) -> Result<String, Erro> {
    let (tipo, avo): (String, Option<String>) = conn
        .query_row("SELECT tipo, pai_id FROM item WHERE id = ?1 AND excluido_em IS NULL", [pai_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .optional()?
        .ok_or(Erro::NaoEncontrado)?;
    match (tipo.as_str(), avo) {
        ("projeto", _) => Ok(pai_id.to_string()),
        ("tarefa", Some(avo)) => Ok(avo),
        _ => Err(Erro::Interno("tarefa sem projeto".into())),
    }
}

/// Cria uma etapa (pai = projeto) ou subtarefa (pai = etapa), no fim da lista.
pub fn criar_tarefa(conn: &Connection, pai_id: &str, titulo: &str) -> Result<Tarefa, Erro> {
    let titulo = texto_limpo(titulo)?;
    let projeto = projeto_da_tarefa(conn, pai_id)?;
    let ordem: f64 = conn.query_row(
        "SELECT coalesce(max(ordem), 0) + 1 FROM item WHERE pai_id = ?1 AND excluido_em IS NULL",
        [pai_id],
        |r| r.get(0),
    )?;
    let tarefa = Tarefa { id: novo_id(), pai_id: pai_id.to_string(), titulo, estado: "a_fazer".into(), ordem, peso: None, prazo: None, etiquetas: vec![] };
    let agora = agora_ms();
    conn.execute(
        "INSERT INTO item (id, tipo, titulo, estado, pai_id, ordem, criado_em, alterado_em) VALUES (?1, 'tarefa', ?2, 'a_fazer', ?3, ?4, ?5, ?5)",
        params![tarefa.id, tarefa.titulo, tarefa.pai_id, tarefa.ordem, agora],
    )?;
    tocar(conn, &projeto)?;
    Ok(tarefa)
}

pub fn mudar_estado_tarefa(conn: &Connection, id: &str, estado: &str) -> Result<(), Erro> {
    if !ESTADOS_TAREFA.contains(&estado) {
        return Err(Erro::Interno(format!("estado de tarefa desconhecido: {estado}")));
    }
    let pai: String = conn
        .query_row("SELECT pai_id FROM item WHERE id = ?1 AND tipo = 'tarefa'", [id], |r| r.get(0))
        .optional()?
        .ok_or(Erro::NaoEncontrado)?;
    conn.execute("UPDATE item SET estado = ?2, alterado_em = ?3 WHERE id = ?1", params![id, estado, agora_ms()])?;
    tocar(conn, &projeto_da_tarefa(conn, &pai)?)
}

fn validar_data(data: Option<&str>) -> Result<(), Erro> {
    if let Some(d) = data {
        let ok = d.len() == 10
            && d.chars().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() });
        if !ok {
            return Err(Erro::Interno(format!("data inválida: {d}")));
        }
    }
    Ok(())
}

/// Começo e prazo de um projeto ("AAAA-MM-DD"), ambos opcionais.
pub fn definir_datas_projeto(conn: &Connection, id: &str, inicio: Option<&str>, prazo: Option<&str>) -> Result<(), Erro> {
    validar_data(inicio)?;
    validar_data(prazo)?;
    if let (Some(i), Some(p)) = (inicio, prazo) {
        if p < i {
            return Err(Erro::Interno("o prazo vem antes do começo".into()));
        }
    }
    let mut dados = ler_dados(conn, id)?;
    dados.inicio = inicio.map(String::from);
    dados.prazo = prazo.map(String::from);
    gravar_dados(conn, id, &dados)
}

/// Prazo de uma tarefa ("AAAA-MM-DD") ou nenhum.
pub fn definir_prazo_tarefa(conn: &Connection, id: &str, prazo: Option<&str>) -> Result<(), Erro> {
    validar_data(prazo)?;
    let mudou = conn.execute(
        "UPDATE item SET dados = json_set(dados, '$.prazo', ?2), alterado_em = ?3 WHERE id = ?1 AND tipo = 'tarefa'",
        params![id, prazo, agora_ms()],
    )?;
    if mudou == 0 {
        return Err(Erro::NaoEncontrado);
    }
    Ok(())
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Prazo {
    pub id: String,
    /// projeto ou tarefa
    pub tipo: String,
    pub titulo: String,
    pub data: String,
    pub projeto_id: String,
    pub projeto: String,
}

/// Prazos entre duas datas (inclusive): projetos não concluídos e tarefas não feitas de projetos não concluídos.
pub fn listar_prazos(conn: &Connection, de: &str, ate: &str) -> Result<Vec<Prazo>, Erro> {
    let mut c = conn.prepare(
        "SELECT p.id, 'projeto', p.titulo, json_extract(p.dados, '$.prazo'), p.id, p.titulo FROM item p
           WHERE p.tipo = 'projeto' AND p.excluido_em IS NULL AND p.estado != 'concluido'
             AND json_extract(p.dados, '$.prazo') BETWEEN ?1 AND ?2
         UNION ALL
         SELECT t.id, 'tarefa', t.titulo, json_extract(t.dados, '$.prazo'), p.id, p.titulo FROM item t
           JOIN item p ON p.id = t.pai_id OR p.id = (SELECT e.pai_id FROM item e WHERE e.id = t.pai_id)
           WHERE t.tipo = 'tarefa' AND t.excluido_em IS NULL AND t.estado != 'feita'
             AND p.tipo = 'projeto' AND p.excluido_em IS NULL AND p.estado != 'concluido'
             AND json_extract(t.dados, '$.prazo') BETWEEN ?1 AND ?2
         ORDER BY 4, 3",
    )?;
    let lista = c
        .query_map(params![de, ate], |r| {
            Ok(Prazo { id: r.get(0)?, tipo: r.get(1)?, titulo: r.get(2)?, data: r.get(3)?, projeto_id: r.get(4)?, projeto: r.get(5)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

/// Peso da tarefa para planejar pela energia: leve, media, pesada ou nenhum.
pub fn definir_peso(conn: &Connection, id: &str, peso: Option<&str>) -> Result<(), Erro> {
    if let Some(p) = peso {
        if !["leve", "media", "pesada"].contains(&p) {
            return Err(Erro::Interno(format!("peso desconhecido: {p}")));
        }
    }
    let mudou = conn.execute(
        "UPDATE item SET dados = json_set(dados, '$.peso', ?2), alterado_em = ?3 WHERE id = ?1 AND tipo = 'tarefa'",
        params![id, peso, agora_ms()],
    )?;
    if mudou == 0 {
        return Err(Erro::NaoEncontrado);
    }
    Ok(())
}

/// Muda um item (tarefa ou passo de rotina) de posição entre os irmãos:
/// fica logo antes de `antes_de`, ou no fim se `None`.
pub fn mover_item(conn: &Connection, id: &str, antes_de: Option<&str>) -> Result<(), Erro> {
    let pai: String = conn
        .query_row("SELECT pai_id FROM item WHERE id = ?1 AND pai_id IS NOT NULL", [id], |r| r.get(0))
        .optional()?
        .ok_or(Erro::NaoEncontrado)?;
    let mut c = conn.prepare("SELECT id FROM item WHERE pai_id = ?1 AND excluido_em IS NULL AND id != ?2 ORDER BY ordem, criado_em")?;
    let mut irmas: Vec<String> = c.query_map(params![pai, id], |r| r.get(0))?.collect::<Result<_, _>>()?;
    let posicao = antes_de.and_then(|a| irmas.iter().position(|x| x == a)).unwrap_or(irmas.len());
    irmas.insert(posicao, id.to_string());
    // Renumera os irmãos: simples e sem acumular frações.
    let agora = agora_ms();
    for (i, irma) in irmas.iter().enumerate() {
        conn.execute("UPDATE item SET ordem = ?2, alterado_em = ?3 WHERE id = ?1", params![irma, (i + 1) as f64, agora])?;
    }
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::abrir;
    use crate::cofre::cripto::nova_chave;

    fn banco() -> (tempfile::TempDir, Connection) {
        let pasta = tempfile::tempdir().unwrap();
        let conn = abrir(&pasta.path().join("orbita.db"), &nova_chave()).unwrap();
        (pasta, conn)
    }

    #[test]
    fn ideias_guardam_editam_e_viram_projeto() {
        let (_p, conn) = banco();
        let a = criar_ideia(&conn, "  escrever um livro ").unwrap();
        criar_ideia(&conn, "aprender cerâmica").unwrap();
        assert!(matches!(criar_ideia(&conn, "   "), Err(Erro::TextoVazio)));
        editar_ideia(&conn, &a.id, "escrever um livro de contos").unwrap();
        assert_eq!(listar_ideias(&conn).unwrap().len(), 2);

        let projeto = ideia_para_projeto(&conn, &a.id, true).unwrap();
        assert_eq!(projeto.titulo, "escrever um livro de contos");
        assert_eq!(projeto.estado, "ativo");
        assert_eq!(listar_ideias(&conn).unwrap().len(), 1);
        let ligacoes: i64 = conn.query_row("SELECT count(*) FROM ligacao WHERE origem_id = ?1", [&a.id], |r| r.get(0)).unwrap();
        assert_eq!(ligacoes, 1);
    }

    #[test]
    fn limite_de_ativos_e_respeitado_e_pausar_libera_vaga() {
        let (_p, conn) = banco();
        definir_limite(&conn, 2).unwrap();
        let a = criar_projeto(&conn, "A", true).unwrap();
        criar_projeto(&conn, "B", true).unwrap();
        assert!(matches!(criar_projeto(&conn, "C", true), Err(Erro::LimiteDeProjetos { limite: 2 })));
        // Dá para criar já pausado.
        let c = criar_projeto(&conn, "C", false).unwrap();
        assert_eq!(c.estado, "pausado");
        assert!(c.pausado_em.is_some());
        assert!(matches!(mudar_estado_projeto(&conn, &c.id, "ativo", None), Err(Erro::LimiteDeProjetos { .. })));

        let onde = OndeParei { texto: "revisando o capítulo 2".into(), proximo_passo: "reler a cena da praia".into(), ..Default::default() };
        let pausado = mudar_estado_projeto(&conn, &a.id, "pausado", Some(onde)).unwrap();
        assert_eq!(pausado.onde_parei.as_ref().unwrap().proximo_passo, "reler a cena da praia");
        let c = mudar_estado_projeto(&conn, &c.id, "ativo", None).unwrap();
        assert_eq!(c.estado, "ativo");
        assert!(c.pausado_em.is_none());
        // Reativar o que já está ativo não conta duas vezes.
        assert!(mudar_estado_projeto(&conn, &c.id, "ativo", None).is_ok());
    }

    #[test]
    fn onde_parei_fica_guardado_e_ignora_links_vazios() {
        let (_p, conn) = banco();
        let p = criar_projeto(&conn, "TCC", true).unwrap();
        salvar_onde_parei(&conn, &p.id, OndeParei {
            texto: "fichando o artigo 3".into(),
            proximo_passo: "abrir o PDF na página 12".into(),
            links: vec!["https://exemplo.org/artigo".into(), "  ".into()],
            atualizado_em: 0,
        })
        .unwrap();
        let p = obter_projeto(&conn, &p.id).unwrap();
        let o = p.onde_parei.unwrap();
        assert_eq!(o.links, vec!["https://exemplo.org/artigo"]);
        assert!(o.atualizado_em > 0);
    }

    #[test]
    fn tarefas_contam_progresso_ordenam_e_excluem_em_cascata() {
        let (_p, conn) = banco();
        let p = criar_projeto(&conn, "Mudança", true).unwrap();
        let caixas = criar_tarefa(&conn, &p.id, "Encaixotar").unwrap();
        let cozinha = criar_tarefa(&conn, &caixas.id, "Cozinha").unwrap();
        criar_tarefa(&conn, &caixas.id, "Quarto").unwrap();
        let frete = criar_tarefa(&conn, &p.id, "Contratar frete").unwrap();
        mudar_estado_tarefa(&conn, &cozinha.id, "feita").unwrap();

        let p2 = obter_projeto(&conn, &p.id).unwrap();
        assert_eq!((p2.tarefas_feitas, p2.tarefas_total), (1, 4));

        mover_item(&conn, &frete.id, Some(&caixas.id)).unwrap();
        let etapas: Vec<String> = listar_tarefas(&conn, &p.id).unwrap().into_iter().filter(|t| t.pai_id == p.id).map(|t| t.titulo).collect();
        assert_eq!(etapas, vec!["Contratar frete", "Encaixotar"]);

        excluir(&conn, &caixas.id).unwrap();
        let p3 = obter_projeto(&conn, &p.id).unwrap();
        assert_eq!(p3.tarefas_total, 1);
        assert!(matches!(mudar_estado_tarefa(&conn, &cozinha.id, "loucura"), Err(Erro::Interno(_))));
    }

    #[test]
    fn datas_de_projeto_prazos_de_tarefa_e_lista_de_prazos() {
        let (_p, conn) = banco();
        let p = criar_projeto(&conn, "TCC", true).unwrap();
        mudar_estado_projeto(&conn, &p.id, "pausado", Some(OndeParei { texto: "x".into(), ..Default::default() })).unwrap();
        definir_datas_projeto(&conn, &p.id, Some("2026-10-01"), Some("2026-12-15")).unwrap();
        // Mudar as datas não apaga o "onde parei".
        let lido = obter_projeto(&conn, &p.id).unwrap();
        assert_eq!((lido.inicio.as_deref(), lido.prazo.as_deref()), (Some("2026-10-01"), Some("2026-12-15")));
        assert_eq!(lido.onde_parei.unwrap().texto, "x");
        assert!(definir_datas_projeto(&conn, &p.id, Some("2026-12-01"), Some("2026-11-01")).is_err());
        assert!(definir_datas_projeto(&conn, &p.id, Some("01/12/2026"), None).is_err());

        let etapa = criar_tarefa(&conn, &p.id, "Revisão").unwrap();
        let sub = criar_tarefa(&conn, &etapa.id, "Fichar").unwrap();
        definir_peso(&conn, &sub.id, Some("leve")).unwrap();
        definir_prazo_tarefa(&conn, &sub.id, Some("2026-11-03")).unwrap();
        let t = listar_tarefas(&conn, &p.id).unwrap().into_iter().find(|t| t.id == sub.id).unwrap();
        assert_eq!((t.prazo.as_deref(), t.peso.as_deref()), (Some("2026-11-03"), Some("leve")));

        let prazos = listar_prazos(&conn, "2026-11-01", "2026-12-31").unwrap();
        assert_eq!(prazos.iter().map(|x| (x.tipo.as_str(), x.titulo.as_str())).collect::<Vec<_>>(), vec![("tarefa", "Fichar"), ("projeto", "TCC")]);
        assert_eq!(prazos[0].projeto, "TCC");
        mudar_estado_tarefa(&conn, &sub.id, "feita").unwrap();
        assert_eq!(listar_prazos(&conn, "2026-11-01", "2026-12-31").unwrap().len(), 1);
    }

    #[test]
    fn notas_antigas_viram_ideias_na_migracao() {
        let pasta = tempfile::tempdir().unwrap();
        let caminho = pasta.path().join("orbita.db");
        let chave = nova_chave();
        {
            // Banco na versão 1, com uma nota de teste.
            crate::banco::preparar_sqlite();
            let conn = Connection::open(&caminho).unwrap();
            conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex::encode(chave.as_ref()))).unwrap();
            conn.execute_batch(crate::banco::MIGRACOES[0]).unwrap();
            conn.execute_batch("PRAGMA user_version = 1;").unwrap();
            conn.execute("INSERT INTO item (id, tipo, conteudo, criado_em, alterado_em) VALUES ('n1', 'nota', 'comprar café', 1, 1)", []).unwrap();
        }
        let conn = abrir(&caminho, &chave).unwrap();
        let ideias = listar_ideias(&conn).unwrap();
        assert_eq!(ideias.len(), 1);
        assert_eq!(ideias[0].texto, "comprar café");
    }
}
