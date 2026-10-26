//! Hobbies e interesses: um arquivo de interesses e hiperfocos, com notas.
//! Imagens, arquivos e links usam o sistema de anexos comum (pelo id do item).
//! É espaço de prazer: sem metas, sem cobrança.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::{agora_ms, novo_id};
use crate::erro::Erro;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Hobby {
    #[serde(default)]
    pub id: String,
    pub nome: String,
    #[serde(default)]
    pub notas: String,
    #[serde(default)]
    pub criado_em: i64,
}

pub fn listar(conn: &Connection) -> Result<Vec<Hobby>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, conteudo, criado_em FROM item WHERE tipo = 'hobby' AND excluido_em IS NULL ORDER BY criado_em DESC",
    )?;
    let lista = c
        .query_map([], |r| Ok(Hobby { id: r.get(0)?, nome: r.get(1)?, notas: r.get(2)?, criado_em: r.get(3)? }))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar(conn: &Connection, mut hobby: Hobby) -> Result<Hobby, Erro> {
    hobby.nome = hobby.nome.trim().to_string();
    if hobby.nome.is_empty() {
        return Err(Erro::Interno("o interesse precisa de um nome".into()));
    }
    hobby.notas = hobby.notas.trim().to_string();
    let agora = agora_ms();
    if hobby.id.is_empty() {
        hobby.id = novo_id();
        hobby.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, conteudo, criado_em, alterado_em) VALUES (?1, 'hobby', ?2, ?3, ?4, ?4)",
            params![hobby.id, hobby.nome, hobby.notas, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, conteudo = ?3, alterado_em = ?4 WHERE id = ?1 AND tipo = 'hobby' AND excluido_em IS NULL",
            params![hobby.id, hobby.nome, hobby.notas, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("interesse não encontrado".into()));
        }
    }
    Ok(hobby)
}

pub fn excluir(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'hobby'", params![id, agora_ms()])?;
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
    fn salva_edita_e_exclui() {
        let (_p, conn) = banco();
        let h = salvar(&conn, Hobby { id: String::new(), nome: " Teclado ".into(), notas: "switches".into(), criado_em: 0 }).unwrap();
        assert_eq!(h.nome, "Teclado");
        assert!(salvar(&conn, Hobby { id: String::new(), nome: "  ".into(), notas: String::new(), criado_em: 0 }).is_err());
        salvar(&conn, Hobby { id: h.id.clone(), nome: "Teclados".into(), notas: "ISO".into(), criado_em: 0 }).unwrap();
        assert_eq!(listar(&conn).unwrap()[0].nome, "Teclados");
        excluir(&conn, &h.id).unwrap();
        assert!(listar(&conn).unwrap().is_empty());
    }
}
