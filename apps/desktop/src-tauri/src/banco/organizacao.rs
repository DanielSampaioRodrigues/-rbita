//! Minha organização: quadros (estilo Trello) para o dia a dia.
//!
//! A pessoa pode ter vários quadros ao mesmo tempo. Todo quadro tem colunas com
//! cartões; a forma de ver ("vista") é só uma escolha de exibição, trocável a
//! qualquer momento: "quadro" (colunas lado a lado) ou "lista" (tudo um embaixo
//! do outro, agrupado por coluna). Tudo na tabela `item`:
//! - quadro: tipo 'org_quadro', estado = estilo antigo, titulo = nome; em `dados` (JSON):
//!   cor, vista, etiquetas do quadro e fundo.
//! - coluna: tipo 'org_coluna', pai_id = quadro, titulo = nome; em `dados`: cor, recolhida, arquivada.
//! - cartão: tipo 'org_cartao', pai_id = coluna, conteudo = título, estado = 'feito' ou '';
//!   em `dados`: cor, prazo ("AAAA-MM-DD"), hora ("HH:MM"), descrição (Markdown),
//!   checklists, etiquetas (ids das etiquetas do quadro), capa e arquivado.
//!
//! Migração sem perda: quadros antigos com estilo "lista" continuam abrindo, agora
//! como quadro com a coluna deles, mostrados na vista Lista até a pessoa trocar.
//! Os campos novos são opcionais; ao gravar, o JSON antigo é mesclado (chaves que
//! esta versão não conhece ficam guardadas, para uma versão mais nova não perder nada).

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use super::{agora_ms, novo_id};
use crate::erro::Erro;

const ESTILOS: [&str; 2] = ["quadro", "lista"];
const VISTAS: [&str; 2] = ["quadro", "lista"];
const FUNDOS: [&str; 4] = ["tema", "cor", "gradiente", "imagem"];
const CAPAS: [&str; 2] = ["cor", "imagem"];

/// Uma etiqueta colorida de um quadro (cada quadro tem as suas).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct EtiquetaQuadro {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub nome: String,
    #[serde(default)]
    pub cor: String,
}

/// Fundo do quadro: do tema, uma cor da paleta, um gradiente suave ou uma imagem (id do anexo).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FundoOrg {
    #[serde(default = "tema")]
    pub tipo: String,
    #[serde(default)]
    pub valor: String,
}

fn tema() -> String {
    "tema".into()
}

impl Default for FundoOrg {
    fn default() -> Self {
        FundoOrg { tipo: tema(), valor: String::new() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Quadro {
    #[serde(default)]
    pub id: String,
    pub nome: String,
    /// Estilo de criação, guardado só por compatibilidade ("quadro" ou "lista").
    #[serde(default)]
    pub estilo: String,
    #[serde(default)]
    pub criado_em: i64,
    /// Cor do cartão do quadro na página principal (vazio = sem cor).
    #[serde(default)]
    pub cor: String,
    /// Forma de ver: "quadro" ou "lista". Vazio ao ler dados antigos = vem do estilo.
    #[serde(default)]
    pub vista: String,
    /// Etiquetas coloridas deste quadro.
    #[serde(default)]
    pub etiquetas: Vec<EtiquetaQuadro>,
    #[serde(default)]
    pub fundo: FundoOrg,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Coluna {
    #[serde(default)]
    pub id: String,
    pub quadro_id: String,
    pub nome: String,
    #[serde(default)]
    pub ordem: f64,
    /// Cor da coluna inteira (vazio = sem cor).
    #[serde(default)]
    pub cor: String,
    /// Recolhida: aparece como uma faixa fina com o nome.
    #[serde(default)]
    pub recolhida: bool,
    /// Arquivada: some do quadro, mas pode voltar (painel "Arquivados").
    #[serde(default)]
    pub arquivada: bool,
}

/// Um item de checklist.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ItemChecklist {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub texto: String,
    #[serde(default)]
    pub feito: bool,
}

/// Uma checklist com nome (um cartão pode ter várias).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Checklist {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub nome: String,
    #[serde(default)]
    pub itens: Vec<ItemChecklist>,
}

/// Capa do cartão: cor da paleta ou imagem anexada (id do anexo). Tipo vazio = sem capa.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct CapaCartao {
    #[serde(default)]
    pub tipo: String,
    #[serde(default)]
    pub valor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Cartao {
    #[serde(default)]
    pub id: String,
    pub coluna_id: String,
    /// Título do cartão.
    pub texto: String,
    #[serde(default)]
    pub feito: bool,
    /// Cor do cartão (vazio = sem cor).
    #[serde(default)]
    pub cor: String,
    /// Data de entrega opcional, em "AAAA-MM-DD" (vazio = sem data).
    #[serde(default)]
    pub prazo: String,
    /// Hora opcional da entrega, "HH:MM" (só vale com data).
    #[serde(default)]
    pub hora: String,
    /// Descrição longa, em Markdown.
    #[serde(default)]
    pub descricao: String,
    #[serde(default)]
    pub checklists: Vec<Checklist>,
    /// Ids das etiquetas do quadro aplicadas a este cartão.
    #[serde(default)]
    pub etiquetas: Vec<String>,
    #[serde(default)]
    pub capa: CapaCartao,
    #[serde(default)]
    pub arquivado: bool,
    /// Quantos anexos o cartão tem (calculado ao listar; não é gravado).
    #[serde(default)]
    pub anexos: i64,
    #[serde(default)]
    pub ordem: f64,
    #[serde(default)]
    pub criado_em: i64,
}

// ---------- JSON em `dados` ----------

fn ler_mapa(dados: &str) -> Map<String, Value> {
    match serde_json::from_str::<Value>(dados) {
        Ok(Value::Object(m)) => m,
        _ => Map::new(),
    }
}

fn texto_de(m: &Map<String, Value>, chave: &str) -> String {
    m.get(chave).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn bool_de(m: &Map<String, Value>, chave: &str) -> bool {
    m.get(chave).and_then(Value::as_bool).unwrap_or(false)
}

fn de_valor<T: serde::de::DeserializeOwned + Default>(m: &Map<String, Value>, chave: &str) -> T {
    m.get(chave).cloned().and_then(|v| serde_json::from_value(v).ok()).unwrap_or_default()
}

fn valor<T: Serialize>(v: &T) -> Value {
    serde_json::to_value(v).unwrap_or(Value::Null)
}

/// Junta os campos novos ao JSON que já estava guardado (sem perder chaves desconhecidas).
fn mesclar(antigo: &str, novos: Vec<(&str, Value)>) -> String {
    let mut m = ler_mapa(antigo);
    for (k, v) in novos {
        m.insert(k.to_string(), v);
    }
    Value::Object(m).to_string()
}

fn dados_atuais(conn: &Connection, id: &str, tipo: &str) -> Result<Option<String>, Erro> {
    Ok(conn
        .query_row("SELECT dados FROM item WHERE id = ?1 AND tipo = ?2 AND excluido_em IS NULL", params![id, tipo], |r| r.get::<_, String>(0))
        .optional()?)
}

fn quadro_de(id: String, nome: String, estilo: String, criado_em: i64, dados: &str) -> Quadro {
    let m = ler_mapa(dados);
    let mut vista = texto_de(&m, "vista");
    if !VISTAS.contains(&vista.as_str()) {
        // Migração: quadros antigos de estilo "lista" abrem na vista Lista.
        vista = if estilo == "lista" { "lista".into() } else { "quadro".into() };
    }
    let mut fundo: FundoOrg = de_valor(&m, "fundo");
    if !FUNDOS.contains(&fundo.tipo.as_str()) {
        fundo = FundoOrg::default();
    }
    Quadro { id, nome, estilo, criado_em, cor: texto_de(&m, "cor"), vista, etiquetas: de_valor(&m, "etiquetas"), fundo }
}

fn campos_quadro(q: &Quadro) -> Vec<(&'static str, Value)> {
    vec![("cor", Value::from(q.cor.clone())), ("vista", Value::from(q.vista.clone())), ("etiquetas", valor(&q.etiquetas)), ("fundo", valor(&q.fundo))]
}

fn coluna_de(id: String, quadro_id: String, nome: String, ordem: f64, dados: &str) -> Coluna {
    let m = ler_mapa(dados);
    Coluna { id, quadro_id, nome, ordem, cor: texto_de(&m, "cor"), recolhida: bool_de(&m, "recolhida"), arquivada: bool_de(&m, "arquivada") }
}

fn campos_coluna(c: &Coluna) -> Vec<(&'static str, Value)> {
    vec![("cor", Value::from(c.cor.clone())), ("recolhida", Value::from(c.recolhida)), ("arquivada", Value::from(c.arquivada))]
}

fn campos_cartao(c: &Cartao) -> Vec<(&'static str, Value)> {
    vec![
        ("cor", Value::from(c.cor.clone())),
        ("prazo", Value::from(c.prazo.clone())),
        ("hora", Value::from(c.hora.clone())),
        ("descricao", Value::from(c.descricao.clone())),
        ("checklists", valor(&c.checklists)),
        ("etiquetas", valor(&c.etiquetas)),
        ("capa", valor(&c.capa)),
        ("arquivado", Value::from(c.arquivado)),
    ]
}

/// Limpa o que vem da tela: ids que faltam, textos com espaços, valores fora da lista.
fn arrumar_quadro(q: &mut Quadro) {
    if !VISTAS.contains(&q.vista.as_str()) {
        q.vista = if q.estilo == "lista" { "lista".into() } else { "quadro".into() };
    }
    if !FUNDOS.contains(&q.fundo.tipo.as_str()) {
        q.fundo = FundoOrg::default();
    }
    for e in q.etiquetas.iter_mut() {
        e.nome = e.nome.trim().chars().take(40).collect();
        if e.id.is_empty() {
            e.id = novo_id();
        }
    }
}

fn arrumar_cartao(c: &mut Cartao) {
    c.hora = if c.prazo.is_empty() { String::new() } else { c.hora.trim().to_string() };
    for cl in c.checklists.iter_mut() {
        if cl.id.is_empty() {
            cl.id = novo_id();
        }
        cl.nome = cl.nome.trim().to_string();
        cl.itens.retain(|i| !i.texto.trim().is_empty());
        for i in cl.itens.iter_mut() {
            i.texto = i.texto.trim().to_string();
            if i.id.is_empty() {
                i.id = novo_id();
            }
        }
    }
    c.etiquetas.retain(|e| !e.is_empty());
    c.etiquetas.dedup();
    if !CAPAS.contains(&c.capa.tipo.as_str()) || c.capa.valor.is_empty() {
        c.capa = CapaCartao::default();
    }
}

// ---------- Quadros ----------

pub fn listar_quadros(conn: &Connection) -> Result<Vec<Quadro>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, estado, criado_em, dados FROM item WHERE tipo = 'org_quadro' AND excluido_em IS NULL ORDER BY criado_em",
    )?;
    let lista = c
        .query_map([], |r| Ok(quadro_de(r.get(0)?, r.get(1)?, r.get::<_, Option<String>>(2)?.unwrap_or_default(), r.get(3)?, &r.get::<_, String>(4)?)))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_quadro(conn: &Connection, mut q: Quadro) -> Result<Quadro, Erro> {
    q.nome = q.nome.trim().to_string();
    if q.nome.is_empty() {
        return Err(Erro::Interno("o quadro precisa de um nome".into()));
    }
    let agora = agora_ms();
    if q.id.is_empty() {
        // Sem escolher tipo: todo quadro novo é "quadro" (o estilo "lista" só vem de dados antigos ou de quem pedir).
        if !ESTILOS.contains(&q.estilo.as_str()) {
            q.estilo = "quadro".into();
        }
        arrumar_quadro(&mut q);
        q.id = novo_id();
        q.criado_em = agora;
        let dados = mesclar("{}", campos_quadro(&q));
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, estado, dados, criado_em, alterado_em) VALUES (?1, 'org_quadro', ?2, ?3, ?4, ?5, ?5)",
            params![q.id, q.nome, q.estilo, dados, agora],
        )?;
        // Estilo "lista" nasce com uma coluna única (sem título); o quadro, com três colunas comuns.
        if q.estilo == "lista" {
            criar_coluna_interna(conn, &q.id, "", 1.0)?;
        } else {
            for (i, nome) in ["A fazer", "Fazendo", "Feito"].iter().enumerate() {
                criar_coluna_interna(conn, &q.id, nome, (i + 1) as f64)?;
            }
        }
    } else {
        // Ao editar, o estilo de criação fica como está; mudam nome, cor, vista, etiquetas e fundo.
        let Some(antigo) = dados_atuais(conn, &q.id, "org_quadro")? else {
            return Err(Erro::Interno("quadro não encontrado".into()));
        };
        arrumar_quadro(&mut q);
        let dados = mesclar(&antigo, campos_quadro(&q));
        conn.execute(
            "UPDATE item SET titulo = ?2, dados = ?3, alterado_em = ?4 WHERE id = ?1 AND tipo = 'org_quadro' AND excluido_em IS NULL",
            params![q.id, q.nome, dados, agora],
        )?;
    }
    Ok(q)
}

/// Apaga o quadro e, junto, suas colunas e cartões.
pub fn excluir_quadro(conn: &Connection, id: &str) -> Result<(), Erro> {
    let agora = agora_ms();
    let colunas: Vec<String> = {
        let mut c = conn.prepare("SELECT id FROM item WHERE tipo = 'org_coluna' AND pai_id = ?1 AND excluido_em IS NULL")?;
        let v = c.query_map([id], |r| r.get::<_, String>(0))?.collect::<Result<Vec<String>, _>>()?;
        v
    };
    for col in &colunas {
        conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE tipo = 'org_cartao' AND pai_id = ?1", params![col, agora])?;
    }
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE tipo = 'org_coluna' AND pai_id = ?1", params![id, agora])?;
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'org_quadro'", params![id, agora])?;
    Ok(())
}

// ---------- Colunas ----------

fn criar_coluna_interna(conn: &Connection, quadro_id: &str, nome: &str, ordem: f64) -> Result<Coluna, Erro> {
    let col = Coluna { id: novo_id(), quadro_id: quadro_id.to_string(), nome: nome.to_string(), ordem, cor: String::new(), recolhida: false, arquivada: false };
    let agora = agora_ms();
    conn.execute(
        "INSERT INTO item (id, tipo, titulo, pai_id, ordem, criado_em, alterado_em) VALUES (?1, 'org_coluna', ?2, ?3, ?4, ?5, ?5)",
        params![col.id, col.nome, col.quadro_id, col.ordem, agora],
    )?;
    Ok(col)
}

/// Todas as colunas do quadro, inclusive as arquivadas (a tela escolhe o que mostrar).
pub fn listar_colunas(conn: &Connection, quadro_id: &str) -> Result<Vec<Coluna>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, pai_id, titulo, ordem, dados FROM item WHERE tipo = 'org_coluna' AND pai_id = ?1 AND excluido_em IS NULL ORDER BY ordem, criado_em",
    )?;
    let lista = c
        .query_map([quadro_id], |r| Ok(coluna_de(r.get(0)?, r.get(1)?, r.get::<_, Option<String>>(2)?.unwrap_or_default(), r.get(3)?, &r.get::<_, String>(4)?)))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_coluna(conn: &Connection, mut col: Coluna) -> Result<Coluna, Erro> {
    if col.quadro_id.trim().is_empty() {
        return Err(Erro::Interno("a coluna precisa de um quadro".into()));
    }
    col.nome = col.nome.trim().to_string();
    let agora = agora_ms();
    if col.id.is_empty() {
        if col.ordem == 0.0 {
            col.ordem = conn.query_row("SELECT coalesce(max(ordem), 0) + 1 FROM item WHERE tipo = 'org_coluna' AND pai_id = ?1 AND excluido_em IS NULL", params![col.quadro_id], |r| r.get(0))?;
        }
        let nova = criar_coluna_interna(conn, &col.quadro_id, &col.nome, col.ordem)?;
        let col = Coluna { id: nova.id, ..col };
        conn.execute("UPDATE item SET dados = ?2, alterado_em = ?3 WHERE id = ?1", params![col.id, mesclar("{}", campos_coluna(&col)), agora])?;
        return Ok(col);
    }
    let Some(antigo) = dados_atuais(conn, &col.id, "org_coluna")? else {
        return Err(Erro::Interno("coluna não encontrada".into()));
    };
    conn.execute(
        "UPDATE item SET titulo = ?2, ordem = ?3, pai_id = ?4, dados = ?5, alterado_em = ?6 WHERE id = ?1 AND tipo = 'org_coluna' AND excluido_em IS NULL",
        params![col.id, col.nome, col.ordem, col.quadro_id, mesclar(&antigo, campos_coluna(&col)), agora],
    )?;
    Ok(col)
}

/// Apaga a coluna e seus cartões.
pub fn excluir_coluna(conn: &Connection, id: &str) -> Result<(), Erro> {
    let agora = agora_ms();
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE tipo = 'org_cartao' AND pai_id = ?1", params![id, agora])?;
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'org_coluna'", params![id, agora])?;
    Ok(())
}

// ---------- Cartões ----------

/// Todos os cartões de um quadro (de todas as suas colunas, inclusive arquivados), na ordem,
/// com a contagem de anexos.
pub fn listar_cartoes(conn: &Connection, quadro_id: &str) -> Result<Vec<Cartao>, Erro> {
    let mut c = conn.prepare(
        "SELECT c.id, c.pai_id, c.conteudo, c.estado, c.dados, c.ordem, c.criado_em,
                (SELECT count(*) FROM ligacao l JOIN anexo a ON a.id = l.destino_id AND a.excluido_em IS NULL
                  WHERE l.origem_tipo = 'item' AND l.origem_id = c.id AND l.destino_tipo = 'anexo' AND l.excluido_em IS NULL)
         FROM item c
         JOIN item col ON col.id = c.pai_id AND col.tipo = 'org_coluna' AND col.excluido_em IS NULL
         WHERE c.tipo = 'org_cartao' AND c.excluido_em IS NULL AND col.pai_id = ?1
         ORDER BY c.ordem, c.criado_em",
    )?;
    let lista = c
        .query_map([quadro_id], |r| {
            let m = ler_mapa(&r.get::<_, String>(4)?);
            Ok(Cartao {
                id: r.get(0)?,
                coluna_id: r.get(1)?,
                texto: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                feito: r.get::<_, Option<String>>(3)?.as_deref() == Some("feito"),
                cor: texto_de(&m, "cor"),
                prazo: texto_de(&m, "prazo"),
                hora: texto_de(&m, "hora"),
                descricao: texto_de(&m, "descricao"),
                checklists: de_valor(&m, "checklists"),
                etiquetas: de_valor(&m, "etiquetas"),
                capa: de_valor(&m, "capa"),
                arquivado: bool_de(&m, "arquivado"),
                anexos: r.get(7)?,
                ordem: r.get(5)?,
                criado_em: r.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_cartao(conn: &Connection, mut c: Cartao) -> Result<Cartao, Erro> {
    if c.coluna_id.trim().is_empty() {
        return Err(Erro::Interno("o cartão precisa de uma coluna".into()));
    }
    c.texto = c.texto.trim().to_string();
    if c.texto.is_empty() {
        return Err(Erro::Interno("o cartão precisa de um texto".into()));
    }
    arrumar_cartao(&mut c);
    let estado = if c.feito { "feito" } else { "" };
    let agora = agora_ms();
    if c.id.is_empty() {
        c.id = novo_id();
        c.criado_em = agora;
        c.anexos = 0;
        if c.ordem == 0.0 {
            c.ordem = conn.query_row("SELECT coalesce(max(ordem), 0) + 1 FROM item WHERE tipo = 'org_cartao' AND pai_id = ?1 AND excluido_em IS NULL", params![c.coluna_id], |r| r.get(0))?;
        }
        conn.execute(
            "INSERT INTO item (id, tipo, conteudo, estado, dados, pai_id, ordem, criado_em, alterado_em) VALUES (?1, 'org_cartao', ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
            params![c.id, c.texto, estado, mesclar("{}", campos_cartao(&c)), c.coluna_id, c.ordem, agora],
        )?;
    } else {
        let Some(antigo) = dados_atuais(conn, &c.id, "org_cartao")? else {
            return Err(Erro::Interno("cartão não encontrado".into()));
        };
        conn.execute(
            "UPDATE item SET conteudo = ?2, estado = ?3, dados = ?4, pai_id = ?5, ordem = ?6, alterado_em = ?7 WHERE id = ?1 AND tipo = 'org_cartao' AND excluido_em IS NULL",
            params![c.id, c.texto, estado, mesclar(&antigo, campos_cartao(&c)), c.coluna_id, c.ordem, agora],
        )?;
    }
    Ok(c)
}

/// Marca/desmarca o cartão como feito.
pub fn marcar_cartao(conn: &Connection, id: &str, feito: bool) -> Result<(), Erro> {
    let estado = if feito { "feito" } else { "" };
    let n = conn.execute(
        "UPDATE item SET estado = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo = 'org_cartao' AND excluido_em IS NULL",
        params![id, estado, agora_ms()],
    )?;
    if n == 0 {
        return Err(Erro::Interno("cartão não encontrado".into()));
    }
    Ok(())
}

/// Move o cartão para uma coluna e posição (ao arrastar).
pub fn mover_cartao(conn: &Connection, id: &str, coluna_id: &str, ordem: f64) -> Result<(), Erro> {
    let n = conn.execute(
        "UPDATE item SET pai_id = ?2, ordem = ?3, alterado_em = ?4 WHERE id = ?1 AND tipo = 'org_cartao' AND excluido_em IS NULL",
        params![id, coluna_id, ordem, agora_ms()],
    )?;
    if n == 0 {
        return Err(Erro::Interno("cartão não encontrado".into()));
    }
    Ok(())
}

/// Reordena os cartões de uma coluna: a ordem passa a ser a posição na lista
/// `ids` (1, 2, 3...). Usado pelos botões de subir/descer. Ids de outras
/// colunas ou inexistentes são ignorados em silêncio.
pub fn reordenar_cartoes(conn: &Connection, ids: Vec<String>) -> Result<(), Erro> {
    let agora = agora_ms();
    for (i, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE item SET ordem = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo = 'org_cartao' AND excluido_em IS NULL",
            params![id, (i + 1) as f64, agora],
        )?;
    }
    Ok(())
}

pub fn excluir_cartao(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'org_cartao'", params![id, agora_ms()])?;
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

    fn qd(nome: &str, estilo: &str, cor: &str) -> Quadro {
        Quadro { id: String::new(), nome: nome.into(), estilo: estilo.into(), criado_em: 0, cor: cor.into(), vista: String::new(), etiquetas: vec![], fundo: FundoOrg::default() }
    }

    fn ct(coluna_id: impl Into<String>, texto: impl Into<String>) -> Cartao {
        Cartao {
            id: String::new(), coluna_id: coluna_id.into(), texto: texto.into(), feito: false, cor: String::new(), prazo: String::new(), hora: String::new(),
            descricao: String::new(), checklists: vec![], etiquetas: vec![], capa: CapaCartao::default(), arquivado: false, anexos: 0, ordem: 0.0, criado_em: 0,
        }
    }

    #[test]
    fn lista_nasce_com_uma_coluna_e_quadro_com_tres() {
        let (_p, conn) = banco();
        let lista = salvar_quadro(&conn, qd(" Hoje ", "lista", "")).unwrap();
        assert_eq!(lista.nome, "Hoje");
        assert_eq!(listar_colunas(&conn, &lista.id).unwrap().len(), 1);
        let quadro = salvar_quadro(&conn, qd("Projeto", "quadro", "")).unwrap();
        let cols = listar_colunas(&conn, &quadro.id).unwrap();
        assert_eq!(cols.len(), 3);
        assert_eq!(cols[0].nome, "A fazer");
        assert!(salvar_quadro(&conn, qd("  ", "lista", "")).is_err());
    }

    #[test]
    fn cartoes_criam_movem_marcam_e_listam_por_quadro() {
        let (_p, conn) = banco();
        let q = salvar_quadro(&conn, qd("Projeto", "quadro", "")).unwrap();
        let cols = listar_colunas(&conn, &q.id).unwrap();
        let c1 = salvar_cartao(&conn, ct(cols[0].id.clone(), " comprar tinta ")).unwrap();
        assert_eq!(c1.texto, "comprar tinta");
        salvar_cartao(&conn, ct(cols[1].id.clone(), "pintar")).unwrap();
        assert!(salvar_cartao(&conn, ct(cols[0].id.clone(), "  ")).is_err());
        assert_eq!(listar_cartoes(&conn, &q.id).unwrap().len(), 2);

        // Mover o c1 para a coluna 3 (Feito) e marcar.
        mover_cartao(&conn, &c1.id, &cols[2].id, 1.0).unwrap();
        marcar_cartao(&conn, &c1.id, true).unwrap();
        let movido = listar_cartoes(&conn, &q.id).unwrap().into_iter().find(|c| c.id == c1.id).unwrap();
        assert_eq!((movido.coluna_id.as_str(), movido.feito), (cols[2].id.as_str(), true));

        excluir_cartao(&conn, &c1.id).unwrap();
        assert_eq!(listar_cartoes(&conn, &q.id).unwrap().len(), 1);
    }

    #[test]
    fn cartao_guarda_cor_e_prazo_e_reordena() {
        let (_p, conn) = banco();
        let q = salvar_quadro(&conn, qd("P", "quadro", "")).unwrap();
        let cols = listar_colunas(&conn, &q.id).unwrap();
        let col = cols[0].id.clone();
        // Cria com cor e prazo e confere que voltam.
        let c1 = salvar_cartao(&conn, Cartao { cor: "ceu".into(), prazo: "2026-11-01".into(), ..ct(col.clone(), "um") }).unwrap();
        let c2 = salvar_cartao(&conn, ct(col.clone(), "dois")).unwrap();
        let salvos = listar_cartoes(&conn, &q.id).unwrap();
        let s1 = salvos.iter().find(|c| c.id == c1.id).unwrap();
        assert_eq!((s1.cor.as_str(), s1.prazo.as_str()), ("ceu", "2026-11-01"));
        // Ordem inicial: c1 antes de c2.
        assert_eq!(salvos.iter().map(|c| c.id.clone()).collect::<Vec<_>>(), vec![c1.id.clone(), c2.id.clone()]);
        // Reordena: c2 antes de c1.
        reordenar_cartoes(&conn, vec![c2.id.clone(), c1.id.clone()]).unwrap();
        let depois = listar_cartoes(&conn, &q.id).unwrap();
        assert_eq!(depois.iter().map(|c| c.id.clone()).collect::<Vec<_>>(), vec![c2.id.clone(), c1.id.clone()]);
    }

    #[test]
    fn quadro_e_coluna_guardam_cor() {
        let (_p, conn) = banco();
        let q = salvar_quadro(&conn, qd("Cor", "quadro", "menta")).unwrap();
        assert_eq!(listar_quadros(&conn).unwrap()[0].cor, "menta");
        salvar_quadro(&conn, Quadro { cor: "ceu".into(), ..q.clone() }).unwrap();
        assert_eq!(listar_quadros(&conn).unwrap()[0].cor, "ceu");
        let col = listar_colunas(&conn, &q.id).unwrap().remove(0);
        assert_eq!(col.cor, "");
        salvar_coluna(&conn, Coluna { cor: "rosa".into(), ..col.clone() }).unwrap();
        assert_eq!(listar_colunas(&conn, &q.id).unwrap()[0].cor, "rosa");
    }

    #[test]
    fn excluir_quadro_leva_colunas_e_cartoes() {
        let (_p, conn) = banco();
        let q = salvar_quadro(&conn, qd("X", "quadro", "")).unwrap();
        let cols = listar_colunas(&conn, &q.id).unwrap();
        salvar_cartao(&conn, ct(cols[0].id.clone(), "a")).unwrap();
        excluir_quadro(&conn, &q.id).unwrap();
        assert!(listar_quadros(&conn).unwrap().is_empty());
        assert!(listar_colunas(&conn, &q.id).unwrap().is_empty());
        assert!(listar_cartoes(&conn, &q.id).unwrap().is_empty());
    }

    #[test]
    fn quadro_novo_sem_tipo_e_quadro_e_lista_antiga_abre_na_vista_lista() {
        let (_p, conn) = banco();
        // Novo, sem dizer o estilo: vira quadro com três colunas e vista Quadro.
        let novo = salvar_quadro(&conn, qd("Minha organização", "", "")).unwrap();
        assert_eq!((novo.estilo.as_str(), novo.vista.as_str()), ("quadro", "quadro"));
        assert_eq!(listar_colunas(&conn, &novo.id).unwrap().len(), 3);
        // Dado antigo, gravado como na versão anterior (só a cor em `dados`).
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, estado, dados, criado_em, alterado_em) VALUES ('antigo', 'org_quadro', 'Hoje', 'lista', '{\"cor\":\"menta\"}', 1, 1)",
            [],
        )
        .unwrap();
        conn.execute("INSERT INTO item (id, tipo, titulo, pai_id, ordem, criado_em, alterado_em) VALUES ('col', 'org_coluna', '', 'antigo', 1, 1, 1)", []).unwrap();
        conn.execute(
            "INSERT INTO item (id, tipo, conteudo, estado, dados, pai_id, ordem, criado_em, alterado_em) VALUES ('c', 'org_cartao', 'Pão', 'feito', '{\"cor\":\"\",\"prazo\":\"2026-11-01\"}', 'col', 1, 1, 1)",
            [],
        )
        .unwrap();
        let antigo = listar_quadros(&conn).unwrap().into_iter().find(|q| q.id == "antigo").unwrap();
        assert_eq!((antigo.vista.as_str(), antigo.cor.as_str(), antigo.fundo.tipo.as_str()), ("lista", "menta", "tema"));
        let cols = listar_colunas(&conn, "antigo").unwrap();
        assert_eq!(cols.len(), 1);
        assert!(!cols[0].arquivada && !cols[0].recolhida);
        let c = listar_cartoes(&conn, "antigo").unwrap().remove(0);
        assert_eq!((c.texto.as_str(), c.feito, c.prazo.as_str(), c.descricao.as_str(), c.arquivado), ("Pão", true, "2026-11-01", "", false));
        assert!(c.checklists.is_empty() && c.etiquetas.is_empty());
        // Trocar a vista guarda e mantém a cor.
        salvar_quadro(&conn, Quadro { vista: "quadro".into(), ..antigo }).unwrap();
        let depois = listar_quadros(&conn).unwrap().into_iter().find(|q| q.id == "antigo").unwrap();
        assert_eq!((depois.vista.as_str(), depois.cor.as_str()), ("quadro", "menta"));
    }

    #[test]
    fn cartao_completo_volta_igual_e_conta_anexos() {
        let (_p, conn) = banco();
        let mut q = salvar_quadro(&conn, qd("Trabalho", "", "")).unwrap();
        q.etiquetas = vec![EtiquetaQuadro { id: String::new(), nome: " Urgente ".into(), cor: "pessego".into() }];
        q.fundo = FundoOrg { tipo: "gradiente".into(), valor: "aurora".into() };
        let q = salvar_quadro(&conn, q).unwrap();
        let etq = q.etiquetas[0].clone();
        assert!(!etq.id.is_empty());
        assert_eq!(etq.nome, "Urgente");
        let col = listar_colunas(&conn, &q.id).unwrap().remove(0);
        let c = salvar_cartao(
            &conn,
            Cartao {
                prazo: "2026-11-05".into(),
                hora: "14:30".into(),
                descricao: "**Importante**\n\n- um\n- dois".into(),
                checklists: vec![Checklist {
                    id: String::new(),
                    nome: "Passos".into(),
                    itens: vec![
                        ItemChecklist { id: String::new(), texto: "abrir".into(), feito: true },
                        ItemChecklist { id: String::new(), texto: "  ".into(), feito: false },
                        ItemChecklist { id: String::new(), texto: "fechar".into(), feito: false },
                    ],
                }],
                etiquetas: vec![etq.id.clone()],
                capa: CapaCartao { tipo: "cor".into(), valor: "ceu".into() },
                ..ct(col.id.clone(), "Relatório")
            },
        )
        .unwrap();
        // Item vazio sai; ids nascem.
        assert_eq!(c.checklists[0].itens.len(), 2);
        assert!(c.checklists[0].itens.iter().all(|i| !i.id.is_empty()));
        crate::banco::anexos::anexar_arquivo(&conn, &c.id, "foto.png", b"123").unwrap();
        let lido = listar_cartoes(&conn, &q.id).unwrap().remove(0);
        assert_eq!(lido.anexos, 1);
        assert_eq!(Cartao { anexos: 0, ..lido.clone() }, c);
        let quadro = listar_quadros(&conn).unwrap().remove(0);
        assert_eq!((quadro.fundo.tipo.as_str(), quadro.fundo.valor.as_str()), ("gradiente", "aurora"));
        // Arquivar e voltar.
        salvar_cartao(&conn, Cartao { arquivado: true, ..lido.clone() }).unwrap();
        assert!(listar_cartoes(&conn, &q.id).unwrap()[0].arquivado);
        // Sem data, a hora some; capa sem valor some.
        let sem = salvar_cartao(&conn, Cartao { prazo: String::new(), capa: CapaCartao { tipo: "imagem".into(), valor: String::new() }, ..lido }).unwrap();
        assert_eq!((sem.hora.as_str(), sem.capa.tipo.as_str()), ("", ""));
    }

    #[test]
    fn gravar_nao_perde_campos_desconhecidos_e_coluna_recolhe_e_arquiva() {
        let (_p, conn) = banco();
        let q = salvar_quadro(&conn, qd("Q", "", "")).unwrap();
        let col = listar_colunas(&conn, &q.id).unwrap().remove(0);
        let c = salvar_cartao(&conn, ct(col.id.clone(), "a")).unwrap();
        // Uma versão futura gravou um campo que esta não conhece.
        conn.execute("UPDATE item SET dados = json_set(dados, '$.futuro', 'x') WHERE id = ?1", [&c.id]).unwrap();
        salvar_cartao(&conn, Cartao { texto: "b".into(), ..c.clone() }).unwrap();
        let dados: String = conn.query_row("SELECT dados FROM item WHERE id = ?1", [&c.id], |r| r.get(0)).unwrap();
        assert!(dados.contains("futuro"));
        salvar_coluna(&conn, Coluna { recolhida: true, arquivada: true, ..col.clone() }).unwrap();
        let lida = listar_colunas(&conn, &q.id).unwrap().into_iter().find(|x| x.id == col.id).unwrap();
        assert!(lida.recolhida && lida.arquivada);
        // Nova coluna já com cor e recolhida.
        let nova = salvar_coluna(&conn, Coluna { id: String::new(), quadro_id: q.id.clone(), nome: "Outros".into(), ordem: 0.0, cor: "rosa".into(), recolhida: true, arquivada: false }).unwrap();
        let lida = listar_colunas(&conn, &q.id).unwrap().into_iter().find(|x| x.id == nova.id).unwrap();
        assert_eq!((lida.cor.as_str(), lida.recolhida), ("rosa", true));
    }

    #[test]
    fn mover_cartao_para_outro_quadro() {
        let (_p, conn) = banco();
        let a = salvar_quadro(&conn, qd("A", "", "")).unwrap();
        let b = salvar_quadro(&conn, qd("B", "", "")).unwrap();
        let ca = listar_colunas(&conn, &a.id).unwrap().remove(0);
        let cb = listar_colunas(&conn, &b.id).unwrap().remove(0);
        let c = salvar_cartao(&conn, ct(ca.id.clone(), "viajante")).unwrap();
        mover_cartao(&conn, &c.id, &cb.id, 1.0).unwrap();
        assert!(listar_cartoes(&conn, &a.id).unwrap().is_empty());
        assert_eq!(listar_cartoes(&conn, &b.id).unwrap()[0].texto, "viajante");
    }
}
