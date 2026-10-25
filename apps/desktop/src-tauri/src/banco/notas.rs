//! Notas simples: servem, por enquanto, para testar que os dados ficam guardados.

use rusqlite::{params, Connection};
use serde::Serialize;

use super::{agora_ms, novo_id};
use crate::erro::Erro;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Nota {
    pub id: String,
    pub texto: String,
    pub criado_em: i64,
}

pub fn listar(conn: &Connection) -> Result<Vec<Nota>, Erro> {
    let mut consulta = conn.prepare(
        "SELECT id, conteudo, criado_em FROM item WHERE tipo = 'nota' AND excluido_em IS NULL ORDER BY criado_em DESC, id DESC",
    )?;
    let notas = consulta
        .query_map([], |r| Ok(Nota { id: r.get(0)?, texto: r.get(1)?, criado_em: r.get(2)? }))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(notas)
}

pub fn criar(conn: &Connection, texto: &str) -> Result<Nota, Erro> {
    let nota = Nota { id: novo_id(), texto: texto.trim().to_string(), criado_em: agora_ms() };
    conn.execute(
        "INSERT INTO item (id, tipo, conteudo, criado_em, alterado_em) VALUES (?1, 'nota', ?2, ?3, ?3)",
        params![nota.id, nota.texto, nota.criado_em],
    )?;
    Ok(nota)
}

/// Marca como excluída; o registro continua no banco para a sincronização futura.
pub fn excluir(conn: &Connection, id: &str) -> Result<(), Erro> {
    let agora = agora_ms();
    conn.execute(
        "UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'nota'",
        params![id, agora],
    )?;
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::abrir;
    use crate::cofre::cripto::nova_chave;

    #[test]
    fn cria_lista_e_exclui() {
        let pasta = tempfile::tempdir().unwrap();
        let conn = abrir(&pasta.path().join("orbita.db"), &nova_chave()).unwrap();
        let a = criar(&conn, "  primeira  ").unwrap();
        let b = criar(&conn, "segunda").unwrap();
        assert_eq!(a.texto, "primeira");
        assert_eq!(listar(&conn).unwrap().iter().map(|n| n.id.clone()).collect::<Vec<_>>(), vec![b.id.clone(), a.id.clone()]);
        excluir(&conn, &a.id).unwrap();
        assert_eq!(listar(&conn).unwrap(), vec![b]);
        let marcada: Option<i64> = conn.query_row("SELECT excluido_em FROM item WHERE id = ?1", [a.id], |r| r.get(0)).unwrap();
        assert!(marcada.is_some());
    }
}
