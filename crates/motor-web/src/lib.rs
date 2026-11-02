// Prova: o banco real do Windows (apps/desktop/src-tauri/src/banco) rodando no navegador.
#[path = "../../../apps/desktop/src-tauri/src/erro.rs"]
pub mod erro;
pub mod cofre {
    pub mod cripto {
        /// No navegador o banco não usa SQLCipher: o arquivo inteiro é trancado por fora (AES-GCM).
        pub type Chave = zeroize::Zeroizing<[u8; 32]>;
        pub fn nova_chave() -> Chave { zeroize::Zeroizing::new([7u8; 32]) }
    }
}
#[path = "../../../apps/desktop/src-tauri/src/banco/mod.rs"]
pub mod banco;

// ── Ponte para o navegador (só para a prova) ──
use std::cell::RefCell;
use wasm_bindgen::prelude::*;

thread_local! { static CONEXAO: RefCell<Option<rusqlite::Connection>> = const { RefCell::new(None) }; }

fn com<T>(f: impl FnOnce(&rusqlite::Connection) -> Result<T, erro::Erro>) -> Result<T, JsValue> {
    CONEXAO.with(|c| {
        let c = c.borrow();
        let conn = c.as_ref().ok_or_else(|| JsValue::from_str("banco fechado"))?;
        f(conn).map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

/// Abre um banco em memória e aplica as MESMAS migrações do Windows.
#[wasm_bindgen]
pub fn abrir_em_memoria() -> Result<u32, JsValue> {
    console_error_panic_hook::set_once();
    let conn = rusqlite::Connection::open_in_memory().map_err(|e| JsValue::from_str(&e.to_string()))?;
    banco::migrar(&conn).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let v: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap_or(-1);
    CONEXAO.with(|c| *c.borrow_mut() = Some(conn));
    Ok(v as u32)
}

#[wasm_bindgen]
pub fn criar_ideia(texto: &str) -> Result<String, JsValue> {
    com(|c| banco::itens::criar_ideia(c, texto)).map(|i| serde_json::to_string(&i).unwrap())
}

#[wasm_bindgen]
pub fn listar_ideias() -> Result<String, JsValue> {
    com(banco::itens::listar_ideias).map(|v| serde_json::to_string(&v).unwrap())
}

/// Prova 2: SQLCipher no navegador. Abre (em memória) com uma chave e devolve a versão do cipher.
#[wasm_bindgen]
pub fn versao_cipher() -> Result<String, JsValue> {
    let conn = rusqlite::Connection::open_in_memory().map_err(|e| JsValue::from_str(&e.to_string()))?;
    conn.query_row("PRAGMA cipher_version", [], |r| r.get::<_, String>(0)).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Prova 3: guardar e reabrir. Exporta o banco atual em bytes e abre uma cópia a partir deles.
#[wasm_bindgen]
pub fn exportar_e_reabrir() -> Result<String, JsValue> {
    let bytes = CONEXAO.with(|c| -> Result<Vec<u8>, JsValue> {
        let mut c = c.borrow_mut();
        let conn = c.as_mut().ok_or_else(|| JsValue::from_str("banco fechado"))?;
        Ok(conn.serialize(rusqlite::MAIN_DB).map_err(|e| JsValue::from_str(&e.to_string()))?.to_vec())
    })?;
    let tamanho = bytes.len();
    let mut nova = rusqlite::Connection::open_in_memory().map_err(|e| JsValue::from_str(&e.to_string()))?;
    nova.deserialize_read_exact(rusqlite::MAIN_DB, &bytes[..], tamanho, false).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let n: i64 = nova.query_row("SELECT count(*) FROM item WHERE tipo='ideia'", [], |r| r.get(0)).map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(format!("{{\"bytes\":{tamanho},\"ideiasNaCopia\":{n}}}"))
}
