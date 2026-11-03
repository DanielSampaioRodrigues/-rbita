//! Banco de dados local, criptografado inteiro (SQLCipher).
//!
//! Tipos comuns a todos os módulos: item, evento, registro e anexo, com
//! etiquetas e ligações. Todo registro tem identificador único, datas de
//! criação e alteração e exclusão marcada, para a sincronização futura.

pub mod academico;
pub mod anexos;
pub mod anotacoes;
pub mod caderno;
pub mod cuidado;
pub mod dinheiro;
pub mod energia;
pub mod hobbies;
pub mod leitura;
pub mod organizacao;
pub mod pastas_projeto;
pub mod quadro;
pub mod etiquetas;
pub mod eventos;
pub mod itens;
pub mod rotinas;
pub mod saude;
pub mod sincronia;
pub mod valores;

use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension};

use crate::cofre::cripto::Chave;
use crate::erro::Erro;

/// Cada posição é uma versão do banco; nunca altere uma migração já publicada.
pub(crate) const MIGRACOES: &[&str] = &[
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
    // 2 · hierarquia (projeto > etapa > subtarefa) e ordem manual.
    //     As notas de teste da versão 0.3 viram ideias guardadas.
    r#"
    ALTER TABLE item ADD COLUMN pai_id TEXT;
    ALTER TABLE item ADD COLUMN ordem REAL NOT NULL DEFAULT 0;
    CREATE INDEX item_pai ON item (pai_id, excluido_em);
    UPDATE item SET tipo = 'ideia', estado = 'guardada' WHERE tipo = 'nota';
    "#,
    // 3 · conteúdo dos anexos (imagens e arquivos), dentro do banco criptografado:
    //     protegidos pela senha e incluídos no backup sem passo extra.
    r#"
    CREATE TABLE anexo_conteudo (
        anexo_id TEXT PRIMARY KEY REFERENCES anexo (id),
        conteudo BLOB NOT NULL
    );
    "#,
    // 4 · sincronização entre aparelhos (docs/decisoes/0012-sincronizacao.md).
    //     `config` ganha data de alteração; apagar uma configuração que viaja deixa
    //     uma lápide em `config_excluida`; `anexo_resumo` guarda o SHA-256 do
    //     conteúdo de cada anexo (o daqui ou o que falta baixar). As linhas que
    //     foram apagadas sem marcar a alteração passam a ter alterado_em = excluido_em.
    r#"
    ALTER TABLE config ADD COLUMN alterado_em INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE config_excluida (
        chave TEXT PRIMARY KEY,
        excluido_em INTEGER NOT NULL
    );
    CREATE TABLE anexo_resumo (
        anexo_id TEXT PRIMARY KEY,
        sha256 TEXT NOT NULL
    );
    CREATE INDEX anexo_resumo_sha ON anexo_resumo (sha256);
    UPDATE item SET alterado_em = excluido_em WHERE excluido_em > alterado_em;
    UPDATE evento SET alterado_em = excluido_em WHERE excluido_em > alterado_em;
    UPDATE registro SET alterado_em = excluido_em WHERE excluido_em > alterado_em;
    UPDATE anexo SET alterado_em = excluido_em WHERE excluido_em > alterado_em;
    UPDATE etiqueta SET alterado_em = excluido_em WHERE excluido_em > alterado_em;
    UPDATE etiquetagem SET alterado_em = excluido_em WHERE excluido_em > alterado_em;
    UPDATE ligacao SET alterado_em = excluido_em WHERE excluido_em > alterado_em;
    "#,
];

/// Hora atual em milissegundos. Pelo `chrono`, que também funciona no navegador
/// (o relógio de `std::time` não existe lá e derrubaria o motor).
pub fn agora_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub fn novo_id() -> String {
    uuid::Uuid::now_v7().to_string()
}

/// Abre (ou cria) o banco com a chave dos dados e aplica as migrações pendentes.
/// Liga o SQLCipher uma única vez, antes de qualquer conexão.
///
/// Na primeira inicialização, o SQLCipher marca o SQLite como pronto um instante
/// antes de registrar a função `sqlcipher_export` (usada no backup). Uma conexão
/// aberta por outra linha de execução nesse instante fica sem a função. Abrindo
/// uma conexão descartável sob `Once`, as outras esperam a inicialização terminar.
pub fn preparar_sqlite() {
    static UMA_VEZ: std::sync::Once = std::sync::Once::new();
    UMA_VEZ.call_once(|| {
        let _ = Connection::open_in_memory();
    });
}

pub fn abrir(caminho: &Path, chave: &Chave) -> Result<Connection, Erro> {
    preparar_sqlite();
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

pub(crate) fn migrar(conn: &Connection) -> Result<(), Erro> {
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

/// Grava e marca a hora da alteração (para a sincronização saber qual é a mais recente).
/// Gravar o mesmo valor de novo não muda nada.
pub fn gravar_config(conn: &Connection, chave: &str, valor: &str) -> Result<(), Erro> {
    conn.execute(
        "INSERT INTO config (chave, valor, alterado_em) VALUES (?1, ?2, ?3)
         ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, alterado_em = excluded.alterado_em
         WHERE config.valor IS NOT excluded.valor",
        params![chave, valor, agora_ms()],
    )?;
    conn.execute("DELETE FROM config_excluida WHERE chave = ?1", params![chave])?;
    Ok(())
}

/// Apaga. Se a configuração viaja entre aparelhos, deixa uma lápide com a hora,
/// para os outros aparelhos também apagarem (ver `sincronia`).
pub fn apagar_config(conn: &Connection, chave: &str) -> Result<(), Erro> {
    let n = conn.execute("DELETE FROM config WHERE chave = ?1", params![chave])?;
    if n > 0 && sincronia::config_viaja(chave) {
        conn.execute(
            "INSERT INTO config_excluida (chave, excluido_em) VALUES (?1, ?2)
             ON CONFLICT (chave) DO UPDATE SET excluido_em = excluded.excluido_em",
            params![chave, agora_ms()],
        )?;
    }
    Ok(())
}

#[cfg(test)]
pub(crate) mod testes {
    use super::*;
    use crate::cofre::cripto::nova_chave;

    /// Banco novo numa pasta temporária, para os testes de outros módulos.
    pub(crate) fn banco_de_teste() -> (tempfile::TempDir, Connection) {
        let pasta = tempfile::tempdir().unwrap();
        let conn = abrir(&pasta.path().join("orbita.db"), &nova_chave()).unwrap();
        (pasta, conn)
    }

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
