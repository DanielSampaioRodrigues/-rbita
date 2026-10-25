//! Banco de dados local, criptografado inteiro (SQLCipher).
//!
//! Tipos comuns a todos os módulos: item, evento, registro e anexo, com
//! etiquetas e ligações. Todo registro tem identificador único, datas de
//! criação e alteração e exclusão marcada, para a sincronização futura.

pub mod notas;

use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension};

use crate::cofre::cripto::Chave;
use crate::erro::Erro;

/// Cada posição é uma versão do banco; nunca altere uma migração já publicada.
const MIGRACOES: &[&str] = &[
    // 1 · tipos comuns
    r#"
    CREATE TABLE item (
        id TEXT PRIMARY KEY,
        tipo TEXT NOT NULL,              -- nota, ideia, projeto, tarefa, leitura...
        titulo TEXT NOT NULL DEFAULT '',
        conteudo TEXT NOT NULL DEFAULT '',
        estado TEXT,                     -- depende do tipo: ativo, pausado, feito...
        dados TEXT NOT NULL DEFAULT '{}',-- campos próprios de cada tipo, em JSON
        criado_em INTEGER NOT NULL,
        alterado_em INTEGER NOT NULL,
        excluido_em INTEGER
    );
    CREATE INDEX item_tipo ON item (tipo, excluido_em);

    CREATE TABLE evento (
        id TEXT PRIMARY KEY,
        titulo TEXT NOT NULL DEFAULT '',
        inicio INTEGER NOT NULL,
        fim INTEGER,
        dia_inteiro INTEGER NOT NULL DEFAULT 0,
        repeticao TEXT,                  -- regra de repetição, quando houver
        dados TEXT NOT NULL DEFAULT '{}',
        criado_em INTEGER NOT NULL,
        alterado_em INTEGER NOT NULL,
        excluido_em INTEGER
    );
    CREATE INDEX evento_inicio ON evento (inicio, excluido_em);

    CREATE TABLE registro (
        id TEXT PRIMARY KEY,
        tipo TEXT NOT NULL,              -- energia, sintoma, gasto, sessão...
        momento INTEGER NOT NULL,
        valor TEXT NOT NULL DEFAULT '{}',
        nota TEXT NOT NULL DEFAULT '',
        criado_em INTEGER NOT NULL,
        alterado_em INTEGER NOT NULL,
        excluido_em INTEGER
    );
    CREATE INDEX registro_tipo ON registro (tipo, momento, excluido_em);

    CREATE TABLE anexo (
        id TEXT PRIMARY KEY,
        tipo TEXT NOT NULL,              -- imagem, arquivo, link
        nome TEXT NOT NULL DEFAULT '',
        endereco TEXT NOT NULL DEFAULT '',
        dados TEXT NOT NULL DEFAULT '{}',
        criado_em INTEGER NOT NULL,
        alterado_em INTEGER NOT NULL,
        excluido_em INTEGER
    );

    CREATE TABLE etiqueta (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        cor TEXT,
        criado_em INTEGER NOT NULL,
        alterado_em INTEGER NOT NULL,
        excluido_em INTEGER
    );

    -- Qualquer coisa pode ter etiquetas e se ligar a qualquer outra.
    CREATE TABLE etiquetagem (
        id TEXT PRIMARY KEY,
        etiqueta_id TEXT NOT NULL REFERENCES etiqueta (id),
        alvo_tipo TEXT NOT NULL,         -- item, evento, registro, anexo
        alvo_id TEXT NOT NULL,
        criado_em INTEGER NOT NULL,
        alterado_em INTEGER NOT NULL,
        excluido_em INTEGER
    );
    CREATE INDEX etiquetagem_alvo ON etiquetagem (alvo_tipo, alvo_id);

    CREATE TABLE ligacao (
        id TEXT PRIMARY KEY,
        origem_tipo TEXT NOT NULL,
        origem_id TEXT NOT NULL,
        destino_tipo TEXT NOT NULL,
        destino_id TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'relacionado',
        criado_em INTEGER NOT NULL,
        alterado_em INTEGER NOT NULL,
        excluido_em INTEGER
    );
    CREATE INDEX ligacao_origem ON ligacao (origem_tipo, origem_id);
    CREATE INDEX ligacao_destino ON ligacao (destino_tipo, destino_id);

    -- Ajustes guardados dentro do cofre (por exemplo, a chave de recuperação).
    CREATE TABLE config (
        chave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
    );
    "#,
];

pub fn agora_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as i64)
}

pub fn novo_id() -> String {
    uuid::Uuid::now_v7().to_string()
}

/// Abre (ou cria) o banco com a chave dos dados e aplica as migrações pendentes.
pub fn abrir(caminho: &Path, chave: &Chave) -> Result<Connection, Erro> {
    let conn = Connection::open(caminho)?;
    // Chave crua de 32 bytes (sem a derivação própria do SQLCipher, que seria redundante).
    let comando = zeroize::Zeroizing::new(format!("PRAGMA key = \"x'{}'\";", hex::encode(chave.as_ref())));
    conn.execute_batch(&comando)?;
    // Se a chave estiver errada, esta é a primeira leitura que falha.
    conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get::<_, i64>(0))
        .map_err(|_| Erro::Interno("a chave não abre o banco de dados".into()))?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "synchronous", "FULL")?;
    migrar(&conn)?;
    Ok(conn)
}

fn migrar(conn: &Connection) -> Result<(), Erro> {
    let versao: usize = conn.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))? as usize;
    for (i, sql) in MIGRACOES.iter().enumerate().skip(versao) {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", (i + 1) as i64)?;
        tx.commit()?;
    }
    Ok(())
}

pub fn ler_config(conn: &Connection, chave: &str) -> Result<Option<String>, Erro> {
    Ok(conn.query_row("SELECT valor FROM config WHERE chave = ?1", params![chave], |r| r.get(0)).optional()?)
}

pub fn gravar_config(conn: &Connection, chave: &str, valor: &str) -> Result<(), Erro> {
    conn.execute(
        "INSERT INTO config (chave, valor) VALUES (?1, ?2) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor",
        params![chave, valor],
    )?;
    Ok(())
}

pub fn apagar_config(conn: &Connection, chave: &str) -> Result<(), Erro> {
    conn.execute("DELETE FROM config WHERE chave = ?1", params![chave])?;
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::cofre::cripto::nova_chave;

    #[test]
    fn arquivo_fica_ilegivel_sem_a_chave() {
        let pasta = tempfile::tempdir().unwrap();
        let caminho = pasta.path().join("orbita.db");
        let chave = nova_chave();
        {
            let conn = abrir(&caminho, &chave).unwrap();
            gravar_config(&conn, "teste", "segredo muito pessoal").unwrap();
        }
        let bruto = std::fs::read(&caminho).unwrap();
        assert!(!bruto.starts_with(b"SQLite format 3"));
        assert!(!bruto.windows(10).any(|j| j == b"segredo mu"));

        assert!(abrir(&caminho, &nova_chave()).is_err());
        let conn = abrir(&caminho, &chave).unwrap();
        assert_eq!(ler_config(&conn, "teste").unwrap().as_deref(), Some("segredo muito pessoal"));
    }

    #[test]
    fn migracoes_chegam_a_versao_atual_e_nao_repetem() {
        let pasta = tempfile::tempdir().unwrap();
        let caminho = pasta.path().join("orbita.db");
        let chave = nova_chave();
        drop(abrir(&caminho, &chave).unwrap());
        let conn = abrir(&caminho, &chave).unwrap();
        let versao: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(versao as usize, MIGRACOES.len());
    }
}
