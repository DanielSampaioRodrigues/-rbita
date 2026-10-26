//! Minha organização: quadros (estilo Trello) e listas, para o dia a dia.
//!
//! A pessoa pode ter vários quadros e listas ao mesmo tempo. Cada "quadro" tem
//! um estilo: "quadro" (colunas com cartões que se arrastam) ou "lista" (uma
//! lista de itens com caixinha de feito). Tudo na tabela `item`:
//! - quadro: tipo 'org_quadro', estado = estilo, titulo = nome.
//! - coluna: tipo 'org_coluna', pai_id = quadro, titulo = nome. (Na lista, uma só.)
//! - cartão: tipo 'org_cartao', pai_id = coluna, conteudo = texto, estado = 'feito' ou ''.
//!   cor e prazo ("AAAA-MM-DD") ficam em `dados` (JSON).

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::{agora_ms, novo_id};
use crate::erro::Erro;

const ESTILOS: [&str; 2] = ["quadro", "lista"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Quadro {
    #[serde(default)]
    pub id: String,
    pub nome: String,
    /// "quadro" ou "lista".
    #[serde(default)]
    pub estilo: String,
    #[serde(default)]
    pub criado_em: i64,
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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Cartao {
    #[serde(default)]
    pub id: String,
    pub coluna_id: String,
    pub texto: String,
    #[serde(default)]
    pub feito: bool,
    /// Cor da etiqueta do cartão (vazio = sem cor).
    #[serde(default)]
    pub cor: String,
    /// Prazo opcional, em "AAAA-MM-DD" (vazio = sem prazo).
    #[serde(default)]
    pub prazo: String,
    #[serde(default)]
    pub ordem: f64,
    #[serde(default)]
    pub criado_em: i64,
}

/// Campos próprios do cartão guardados em JSON na coluna `dados`.
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DadosCartao {
    #[serde(default)]
    cor: String,
    #[serde(default)]
    prazo: String,
}

// ---------- Quadros ----------

pub fn listar_quadros(conn: &Connection) -> Result<Vec<Quadro>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, estado, criado_em FROM item WHERE tipo = 'org_quadro' AND excluido_em IS NULL ORDER BY criado_em",
    )?;
    let lista = c
        .query_map([], |r| Ok(Quadro { id: r.get(0)?, nome: r.get(1)?, estilo: r.get(2)?, criado_em: r.get(3)? }))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_quadro(conn: &Connection, mut q: Quadro) -> Result<Quadro, Erro> {
    q.nome = q.nome.trim().to_string();
    if q.nome.is_empty() {
        return Err(Erro::Interno("o quadro precisa de um nome".into()));
    }
    if !ESTILOS.contains(&q.estilo.as_str()) {
        q.estilo = "lista".into();
    }
    let agora = agora_ms();
    if q.id.is_empty() {
        q.id = novo_id();
        q.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, estado, criado_em, alterado_em) VALUES (?1, 'org_quadro', ?2, ?3, ?4, ?4)",
            params![q.id, q.nome, q.estilo, agora],
        )?;
        // Uma lista nasce com uma coluna única (sem título); um quadro nasce com três colunas comuns.
        if q.estilo == "lista" {
            criar_coluna_interna(conn, &q.id, "", 1.0)?;
        } else {
            for (i, nome) in ["A fazer", "Fazendo", "Feito"].iter().enumerate() {
                criar_coluna_interna(conn, &q.id, nome, (i + 1) as f64)?;
            }
        }
    } else {
        // Ao editar, não troca o estilo (as colunas já existem); só o nome.
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo = 'org_quadro' AND excluido_em IS NULL",
            params![q.id, q.nome, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("quadro não encontrado".into()));
        }
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
    let col = Coluna { id: novo_id(), quadro_id: quadro_id.to_string(), nome: nome.to_string(), ordem };
    let agora = agora_ms();
    conn.execute(
        "INSERT INTO item (id, tipo, titulo, pai_id, ordem, criado_em, alterado_em) VALUES (?1, 'org_coluna', ?2, ?3, ?4, ?5, ?5)",
        params![col.id, col.nome, col.quadro_id, col.ordem, agora],
    )?;
    Ok(col)
}

pub fn listar_colunas(conn: &Connection, quadro_id: &str) -> Result<Vec<Coluna>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, pai_id, titulo, ordem FROM item WHERE tipo = 'org_coluna' AND pai_id = ?1 AND excluido_em IS NULL ORDER BY ordem, criado_em",
    )?;
    let lista = c
        .query_map([quadro_id], |r| Ok(Coluna { id: r.get(0)?, quadro_id: r.get(1)?, nome: r.get(2)?, ordem: r.get(3)? }))?
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
        return criar_coluna_interna(conn, &col.quadro_id, &col.nome, col.ordem);
    }
    let n = conn.execute(
        "UPDATE item SET titulo = ?2, ordem = ?3, alterado_em = ?4 WHERE id = ?1 AND tipo = 'org_coluna' AND excluido_em IS NULL",
        params![col.id, col.nome, col.ordem, agora],
    )?;
    if n == 0 {
        return Err(Erro::Interno("coluna não encontrada".into()));
    }
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

/// Todos os cartões de um quadro (de todas as suas colunas), na ordem.
pub fn listar_cartoes(conn: &Connection, quadro_id: &str) -> Result<Vec<Cartao>, Erro> {
    let mut c = conn.prepare(
        "SELECT c.id, c.pai_id, c.conteudo, c.estado, c.dados, c.ordem, c.criado_em FROM item c
         JOIN item col ON col.id = c.pai_id AND col.tipo = 'org_coluna' AND col.excluido_em IS NULL
         WHERE c.tipo = 'org_cartao' AND c.excluido_em IS NULL AND col.pai_id = ?1
         ORDER BY c.ordem, c.criado_em",
    )?;
    let lista = c
        .query_map([quadro_id], |r| {
            let d: DadosCartao = serde_json::from_str(&r.get::<_, String>(4)?).unwrap_or_default();
            Ok(Cartao { id: r.get(0)?, coluna_id: r.get(1)?, texto: r.get(2)?, feito: r.get::<_, String>(3)? == "feito", cor: d.cor, prazo: d.prazo, ordem: r.get(5)?, criado_em: r.get(6)? })
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
    let estado = if c.feito { "feito" } else { "" };
    let dados = serde_json::to_string(&DadosCartao { cor: c.cor.clone(), prazo: c.prazo.clone() }).map_err(|e| Erro::Interno(e.to_string()))?;
    let agora = agora_ms();
    if c.id.is_empty() {
        c.id = novo_id();
        c.criado_em = agora;
        if c.ordem == 0.0 {
            c.ordem = conn.query_row("SELECT coalesce(max(ordem), 0) + 1 FROM item WHERE tipo = 'org_cartao' AND pai_id = ?1 AND excluido_em IS NULL", params![c.coluna_id], |r| r.get(0))?;
        }
        conn.execute(
            "INSERT INTO item (id, tipo, conteudo, estado, dados, pai_id, ordem, criado_em, alterado_em) VALUES (?1, 'org_cartao', ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
            params![c.id, c.texto, estado, dados, c.coluna_id, c.ordem, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET conteudo = ?2, estado = ?3, dados = ?4, pai_id = ?5, ordem = ?6, alterado_em = ?7 WHERE id = ?1 AND tipo = 'org_cartao' AND excluido_em IS NULL",
            params![c.id, c.texto, estado, dados, c.coluna_id, c.ordem, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("cartão não encontrado".into()));
        }
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

    #[test]
    fn lista_nasce_com_uma_coluna_e_quadro_com_tres() {
        let (_p, conn) = banco();
        let lista = salvar_quadro(&conn, Quadro { id: String::new(), nome: " Hoje ".into(), estilo: "lista".into(), criado_em: 0 }).unwrap();
        assert_eq!(lista.nome, "Hoje");
        assert_eq!(listar_colunas(&conn, &lista.id).unwrap().len(), 1);
        let quadro = salvar_quadro(&conn, Quadro { id: String::new(), nome: "Projeto".into(), estilo: "quadro".into(), criado_em: 0 }).unwrap();
        let cols = listar_colunas(&conn, &quadro.id).unwrap();
        assert_eq!(cols.len(), 3);
        assert_eq!(cols[0].nome, "A fazer");
        assert!(salvar_quadro(&conn, Quadro { id: String::new(), nome: "  ".into(), estilo: "lista".into(), criado_em: 0 }).is_err());
    }

    #[test]
    fn cartoes_criam_movem_marcam_e_listam_por_quadro() {
        let (_p, conn) = banco();
        let q = salvar_quadro(&conn, Quadro { id: String::new(), nome: "Projeto".into(), estilo: "quadro".into(), criado_em: 0 }).unwrap();
        let cols = listar_colunas(&conn, &q.id).unwrap();
        let c1 = salvar_cartao(&conn, Cartao { id: String::new(), coluna_id: cols[0].id.clone(), texto: " comprar tinta ".into(), feito: false, cor: String::new(), prazo: String::new(), ordem: 0.0, criado_em: 0 }).unwrap();
        assert_eq!(c1.texto, "comprar tinta");
        salvar_cartao(&conn, Cartao { id: String::new(), coluna_id: cols[1].id.clone(), texto: "pintar".into(), feito: false, cor: String::new(), prazo: String::new(), ordem: 0.0, criado_em: 0 }).unwrap();
        assert!(salvar_cartao(&conn, Cartao { id: String::new(), coluna_id: cols[0].id.clone(), texto: "  ".into(), feito: false, cor: String::new(), prazo: String::new(), ordem: 0.0, criado_em: 0 }).is_err());
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
        let q = salvar_quadro(&conn, Quadro { id: String::new(), nome: "P".into(), estilo: "quadro".into(), criado_em: 0 }).unwrap();
        let cols = listar_colunas(&conn, &q.id).unwrap();
        let col = cols[0].id.clone();
        // Cria com cor e prazo e confere que voltam.
        let c1 = salvar_cartao(&conn, Cartao { id: String::new(), coluna_id: col.clone(), texto: "um".into(), feito: false, cor: "ceu".into(), prazo: "2026-11-01".into(), ordem: 0.0, criado_em: 0 }).unwrap();
        let c2 = salvar_cartao(&conn, Cartao { id: String::new(), coluna_id: col.clone(), texto: "dois".into(), feito: false, cor: String::new(), prazo: String::new(), ordem: 0.0, criado_em: 0 }).unwrap();
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
    fn excluir_quadro_leva_colunas_e_cartoes() {
        let (_p, conn) = banco();
        let q = salvar_quadro(&conn, Quadro { id: String::new(), nome: "X".into(), estilo: "quadro".into(), criado_em: 0 }).unwrap();
        let cols = listar_colunas(&conn, &q.id).unwrap();
        salvar_cartao(&conn, Cartao { id: String::new(), coluna_id: cols[0].id.clone(), texto: "a".into(), feito: false, cor: String::new(), prazo: String::new(), ordem: 0.0, criado_em: 0 }).unwrap();
        excluir_quadro(&conn, &q.id).unwrap();
        assert!(listar_quadros(&conn).unwrap().is_empty());
        assert!(listar_colunas(&conn, &q.id).unwrap().is_empty());
        assert!(listar_cartoes(&conn, &q.id).unwrap().is_empty());
    }
}
