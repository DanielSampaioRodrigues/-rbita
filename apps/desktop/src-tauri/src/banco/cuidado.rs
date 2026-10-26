//! Cuidado psicológico e psiquiátrico: anotações para levar à sessão e
//! perguntas para o psiquiatra (guardadas na tabela `item`), mais o registro
//! curto do que ficou de cada sessão (na tabela `registro`, tipo `sessao`).
//!
//! As sessões de terapia e as consultas psiquiátricas em si são eventos comuns
//! da agenda, com lembrete, como as outras consultas.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::{agora_ms, novo_id};
use crate::erro::Erro;

/// "pauta" = o que levar para a sessão; "pergunta" = pergunta para o psiquiatra.
const TIPOS_NOTA: [&str; 2] = ["pauta", "pergunta"];

/// Uma anotação curta acumulada durante a semana, com marca de já resolvida.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Nota {
    pub id: String,
    pub tipo: String,
    pub texto: String,
    /// true quando já foi levada à sessão / respondida.
    pub feita: bool,
    pub criado_em: i64,
}

pub fn listar_notas(conn: &Connection, tipo: &str) -> Result<Vec<Nota>, Erro> {
    if !TIPOS_NOTA.contains(&tipo) {
        return Err(Erro::Interno("tipo de anotação desconhecido".into()));
    }
    let mut c = conn.prepare(
        "SELECT id, titulo, estado, criado_em FROM item
         WHERE tipo = ?1 AND excluido_em IS NULL
         ORDER BY CASE estado WHEN 'aberta' THEN 0 ELSE 1 END, criado_em DESC",
    )?;
    let lista = c
        .query_map(params![tipo], |r| {
            Ok(Nota {
                id: r.get(0)?,
                tipo: tipo.to_string(),
                texto: r.get(1)?,
                feita: r.get::<_, String>(2)? == "feita",
                criado_em: r.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn criar_nota(conn: &Connection, tipo: &str, texto: &str) -> Result<Nota, Erro> {
    if !TIPOS_NOTA.contains(&tipo) {
        return Err(Erro::Interno("tipo de anotação desconhecido".into()));
    }
    let texto = texto.trim().to_string();
    if texto.is_empty() {
        return Err(Erro::Interno("a anotação não pode ficar vazia".into()));
    }
    let nota = Nota { id: novo_id(), tipo: tipo.to_string(), texto, feita: false, criado_em: agora_ms() };
    conn.execute(
        "INSERT INTO item (id, tipo, titulo, estado, criado_em, alterado_em) VALUES (?1, ?2, ?3, 'aberta', ?4, ?4)",
        params![nota.id, nota.tipo, nota.texto, nota.criado_em],
    )?;
    Ok(nota)
}

pub fn marcar_nota(conn: &Connection, id: &str, feita: bool) -> Result<(), Erro> {
    let estado = if feita { "feita" } else { "aberta" };
    conn.execute(
        "UPDATE item SET estado = ?2, alterado_em = ?3
         WHERE id = ?1 AND tipo IN ('pauta', 'pergunta') AND excluido_em IS NULL",
        params![id, estado, agora_ms()],
    )?;
    Ok(())
}

pub fn excluir_nota(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute(
        "UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo IN ('pauta', 'pergunta')",
        params![id, agora_ms()],
    )?;
    Ok(())
}

// ---------- Registro do que ficou de cada sessão ----------

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistroSessao {
    pub id: String,
    pub momento: i64,
    pub nota: String,
}

pub fn registrar_sessao(conn: &Connection, nota: &str) -> Result<RegistroSessao, Erro> {
    let nota = nota.trim().to_string();
    if nota.is_empty() {
        return Err(Erro::Interno("escreva o que ficou da sessão".into()));
    }
    let r = RegistroSessao { id: novo_id(), momento: agora_ms(), nota };
    conn.execute(
        "INSERT INTO registro (id, tipo, momento, valor, nota, criado_em, alterado_em)
         VALUES (?1, 'sessao', ?2, '{}', ?3, ?2, ?2)",
        params![r.id, r.momento, r.nota],
    )?;
    Ok(r)
}

pub fn listar_sessoes(conn: &Connection, de: i64, ate: i64) -> Result<Vec<RegistroSessao>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, momento, nota FROM registro
         WHERE tipo = 'sessao' AND excluido_em IS NULL AND momento >= ?1 AND momento < ?2
         ORDER BY momento DESC",
    )?;
    let lista = c
        .query_map(params![de, ate], |r| Ok(RegistroSessao { id: r.get(0)?, momento: r.get(1)?, nota: r.get(2)? }))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn excluir_sessao(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute(
        "UPDATE registro SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'sessao'",
        params![id, agora_ms()],
    )?;
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
    fn notas_criam_marcam_e_abertas_primeiro() {
        let (_p, conn) = banco();
        let a = criar_nota(&conn, "pauta", " falar do sono ").unwrap();
        criar_nota(&conn, "pauta", "contar da semana").unwrap();
        assert_eq!(a.texto, "falar do sono");
        assert!(criar_nota(&conn, "pauta", "   ").is_err());
        assert!(criar_nota(&conn, "outro", "x").is_err());
        // Perguntas são uma lista separada.
        criar_nota(&conn, "pergunta", "trocar a dose?").unwrap();
        assert_eq!(listar_notas(&conn, "pauta").unwrap().len(), 2);
        assert_eq!(listar_notas(&conn, "pergunta").unwrap().len(), 1);

        marcar_nota(&conn, &a.id, true).unwrap();
        let pautas = listar_notas(&conn, "pauta").unwrap();
        // A aberta vem antes da feita.
        assert!(!pautas[0].feita && pautas[1].feita);
        excluir_nota(&conn, &a.id).unwrap();
        assert_eq!(listar_notas(&conn, "pauta").unwrap().len(), 1);
    }

    #[test]
    fn registra_sessao_e_lista_do_mais_novo() {
        let (_p, conn) = banco();
        assert!(registrar_sessao(&conn, "  ").is_err());
        let r = registrar_sessao(&conn, "falamos sobre o trabalho").unwrap();
        let ss = listar_sessoes(&conn, 0, i64::MAX).unwrap();
        assert_eq!(ss.len(), 1);
        assert_eq!(ss[0].nota, "falamos sobre o trabalho");
        excluir_sessao(&conn, &r.id).unwrap();
        assert!(listar_sessoes(&conn, 0, i64::MAX).unwrap().is_empty());
    }
}
