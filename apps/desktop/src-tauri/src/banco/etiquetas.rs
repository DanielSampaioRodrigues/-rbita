//! Etiquetas (com cor) e ligações entre itens. As tabelas `etiqueta`,
//! `etiquetagem` e `ligacao` existem desde a primeira versão do banco.
//! Por enquanto quem usa são as ideias; servem para qualquer item.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use super::{agora_ms, novo_id};
use crate::erro::Erro;

/// Cores das etiquetas. A cor nunca aparece sozinha: sempre junto do nome.
pub const CORES: &[&str] = &["musgo", "mar", "ceu", "lavanda", "rosa", "terra", "areia", "cinza"];

#[derive(Debug, Serialize, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Etiqueta {
    pub id: String,
    pub nome: String,
    pub cor: String,
}

fn nome_limpo(nome: &str) -> Result<String, Erro> {
    let n: String = nome.split_whitespace().collect::<Vec<_>>().join(" ");
    if n.is_empty() {
        return Err(Erro::TextoVazio);
    }
    Ok(n.chars().take(40).collect())
}

fn cor_valida(cor: &str) -> &'static str {
    CORES.iter().find(|c| **c == cor).copied().unwrap_or("cinza")
}

pub fn listar(conn: &Connection) -> Result<Vec<Etiqueta>, Erro> {
    let mut c = conn.prepare("SELECT id, nome, coalesce(cor, 'cinza') FROM etiqueta WHERE excluido_em IS NULL ORDER BY nome COLLATE NOCASE")?;
    let lista = c.query_map([], |r| Ok(Etiqueta { id: r.get(0)?, nome: r.get(1)?, cor: r.get(2)? }))?.collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

/// Cria a etiqueta; se já existe uma com o mesmo nome, devolve a existente.
pub fn criar(conn: &Connection, nome: &str, cor: &str) -> Result<Etiqueta, Erro> {
    let nome = nome_limpo(nome)?;
    if let Some(e) = listar(conn)?.into_iter().find(|e| e.nome.to_lowercase() == nome.to_lowercase()) {
        return Ok(e);
    }
    let e = Etiqueta { id: novo_id(), nome, cor: cor_valida(cor).into() };
    let agora = agora_ms();
    conn.execute(
        "INSERT INTO etiqueta (id, nome, cor, criado_em, alterado_em) VALUES (?1, ?2, ?3, ?4, ?4)",
        params![e.id, e.nome, e.cor, agora],
    )?;
    Ok(e)
}

pub fn editar(conn: &Connection, id: &str, nome: &str, cor: &str) -> Result<(), Erro> {
    let n = conn.execute(
        "UPDATE etiqueta SET nome = ?2, cor = ?3, alterado_em = ?4 WHERE id = ?1 AND excluido_em IS NULL",
        params![id, nome_limpo(nome)?, cor_valida(cor), agora_ms()],
    )?;
    if n == 0 {
        return Err(Erro::NaoEncontrado);
    }
    Ok(())
}

/// Exclui a etiqueta e tira ela de todos os itens. Os itens ficam.
pub fn excluir(conn: &Connection, id: &str) -> Result<(), Erro> {
    let agora = agora_ms();
    conn.execute("UPDATE etiqueta SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1", params![id, agora])?;
    conn.execute("UPDATE etiquetagem SET excluido_em = ?2, alterado_em = ?2 WHERE etiqueta_id = ?1 AND excluido_em IS NULL", params![id, agora])?;
    Ok(())
}

/// Etiquetas de cada item (id do item -> ids das etiquetas).
pub fn do_item(conn: &Connection, item: &str) -> Result<Vec<String>, Erro> {
    let mut c = conn.prepare(
        "SELECT g.etiqueta_id FROM etiquetagem g JOIN etiqueta e ON e.id = g.etiqueta_id
         WHERE g.alvo_tipo = 'item' AND g.alvo_id = ?1 AND g.excluido_em IS NULL AND e.excluido_em IS NULL
         ORDER BY e.nome COLLATE NOCASE",
    )?;
    let ids = c.query_map([item], |r| r.get(0))?.collect::<Result<Vec<String>, _>>()?;
    Ok(ids)
}

/// Deixa o item exatamente com estas etiquetas.
pub fn definir_do_item(conn: &Connection, item: &str, etiquetas: &[String]) -> Result<(), Erro> {
    let atuais = do_item(conn, item)?;
    let agora = agora_ms();
    for tirar in atuais.iter().filter(|a| !etiquetas.contains(a)) {
        conn.execute(
            "UPDATE etiquetagem SET excluido_em = ?3, alterado_em = ?3 WHERE alvo_tipo = 'item' AND alvo_id = ?1 AND etiqueta_id = ?2 AND excluido_em IS NULL",
            params![item, tirar, agora],
        )?;
    }
    for por in etiquetas.iter().filter(|e| !atuais.contains(e)) {
        let existe: Option<String> = conn.query_row("SELECT id FROM etiqueta WHERE id = ?1 AND excluido_em IS NULL", [por], |r| r.get(0)).optional()?;
        if existe.is_none() {
            return Err(Erro::NaoEncontrado);
        }
        conn.execute(
            "INSERT INTO etiquetagem (id, etiqueta_id, alvo_tipo, alvo_id, criado_em, alterado_em) VALUES (?1, ?2, 'item', ?3, ?4, ?4)",
            params![novo_id(), por, item, agora],
        )?;
    }
    conn.execute("UPDATE item SET alterado_em = ?2 WHERE id = ?1", params![item, agora])?;
    Ok(())
}

/// Itens ligados a este, nos dois sentidos (ligação "relacionado" entre itens).
pub fn ligados(conn: &Connection, item: &str) -> Result<Vec<String>, Erro> {
    let mut c = conn.prepare(
        "SELECT CASE WHEN l.origem_id = ?1 THEN l.destino_id ELSE l.origem_id END AS outro
         FROM ligacao l
         WHERE l.tipo = 'relacionado' AND l.excluido_em IS NULL AND l.origem_tipo = 'item' AND l.destino_tipo = 'item'
           AND (l.origem_id = ?1 OR l.destino_id = ?1)",
    )?;
    let ids = c.query_map([item], |r| r.get(0))?.collect::<Result<Vec<String>, _>>()?;
    // Só os que ainda existem.
    let mut vivos = Vec::new();
    for id in ids {
        let ok: Option<i64> = conn.query_row("SELECT 1 FROM item WHERE id = ?1 AND excluido_em IS NULL", [&id], |r| r.get(0)).optional()?;
        if ok.is_some() && !vivos.contains(&id) {
            vivos.push(id);
        }
    }
    Ok(vivos)
}

/// Liga ou desliga dois itens (não importa a ordem).
pub fn ligar(conn: &Connection, a: &str, b: &str, ligar: bool) -> Result<(), Erro> {
    if a == b {
        return Ok(());
    }
    let agora = agora_ms();
    let ja = ligados(conn, a)?.iter().any(|x| x == b);
    if ligar && !ja {
        conn.execute(
            "INSERT INTO ligacao (id, origem_tipo, origem_id, destino_tipo, destino_id, tipo, criado_em, alterado_em)
             VALUES (?1, 'item', ?2, 'item', ?3, 'relacionado', ?4, ?4)",
            params![novo_id(), a, b, agora],
        )?;
    } else if !ligar {
        conn.execute(
            "UPDATE ligacao SET excluido_em = ?3, alterado_em = ?3 WHERE tipo = 'relacionado' AND excluido_em IS NULL
             AND ((origem_id = ?1 AND destino_id = ?2) OR (origem_id = ?2 AND destino_id = ?1))",
            params![a, b, agora],
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::itens;
    use crate::banco::testes::banco_de_teste;

    #[test]
    fn etiquetas_com_cor_sem_repetir_nome() {
        let (_p, conn) = banco_de_teste();
        let a = criar(&conn, "  Faculdade ", "lavanda").unwrap();
        assert_eq!((a.nome.as_str(), a.cor.as_str()), ("Faculdade", "lavanda"));
        assert_eq!(criar(&conn, "faculdade", "mar").unwrap().id, a.id);
        assert_eq!(criar(&conn, "Arte", "vermelho-gritante").unwrap().cor, "cinza");
        assert!(matches!(criar(&conn, "   ", "mar"), Err(Erro::TextoVazio)));
        editar(&conn, &a.id, "Faculdade 2026", "mar").unwrap();
        assert_eq!(listar(&conn).unwrap().iter().map(|e| e.nome.as_str()).collect::<Vec<_>>(), vec!["Arte", "Faculdade 2026"]);
    }

    #[test]
    fn itens_ganham_e_perdem_etiquetas_e_ligacoes() {
        let (_p, conn) = banco_de_teste();
        let i1 = itens::criar_ideia(&conn, "livro").unwrap();
        let i2 = itens::criar_ideia(&conn, "podcast").unwrap();
        let arte = criar(&conn, "Arte", "rosa").unwrap();
        let texto = criar(&conn, "Texto", "mar").unwrap();
        definir_do_item(&conn, &i1.id, &[arte.id.clone(), texto.id.clone()]).unwrap();
        assert_eq!(do_item(&conn, &i1.id).unwrap().len(), 2);
        definir_do_item(&conn, &i1.id, &[texto.id.clone()]).unwrap();
        assert_eq!(do_item(&conn, &i1.id).unwrap(), vec![texto.id.clone()]);
        excluir(&conn, &texto.id).unwrap();
        assert!(do_item(&conn, &i1.id).unwrap().is_empty());

        ligar(&conn, &i1.id, &i2.id, true).unwrap();
        ligar(&conn, &i2.id, &i1.id, true).unwrap(); // não duplica
        assert_eq!(ligados(&conn, &i2.id).unwrap(), vec![i1.id.clone()]);
        assert_eq!(ligados(&conn, &i1.id).unwrap(), vec![i2.id.clone()]);
        itens::excluir(&conn, &i2.id).unwrap();
        assert!(ligados(&conn, &i1.id).unwrap().is_empty());
        ligar(&conn, &i1.id, &i2.id, false).unwrap();
    }
}
