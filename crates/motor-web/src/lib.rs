//! Motor do Órbita no navegador: o mesmo banco do Windows (`src-tauri/src/banco`),
//! compilado para WebAssembly. Ver `docs/decisoes/0011-motor-unico.md`.
//!
//! O banco fica em memória. Para guardar, o navegador pede os bytes (`exportar`),
//! tranca com a chave do cofre web e grava no IndexedDB; ao abrir, devolve os
//! bytes (`abrir_de_bytes`). Os comandos chegam por `executar`, com o mesmo nome e
//! os mesmos argumentos que o Windows recebe (ponte gerada por `build.rs`).

#[path = "../../../apps/desktop/src-tauri/src/erro.rs"]
pub mod erro;

pub mod cofre {
    pub mod cripto {
        /// No navegador o banco não usa a chave do SQLCipher: o arquivo inteiro é
        /// trancado por fora, com a chave do cofre web (AES-GCM).
        pub type Chave = zeroize::Zeroizing<[u8; 32]>;
        #[allow(dead_code)]
        pub fn nova_chave() -> Chave {
            zeroize::Zeroizing::new([0u8; 32])
        }
    }
}

#[path = "../../../apps/desktop/src-tauri/src/banco/mod.rs"]
pub mod banco;

pub mod ponte {
    use rusqlite::Connection;

    /// O mesmo papel da `Sessao` do Windows: o banco aberto.
    pub struct Sessao {
        pub conn: Connection,
    }

    /// Imita `estado.com_sessao(|s| ...)` do Windows, para o corpo dos comandos rodar igual.
    pub struct Ponte<'a>(pub &'a Sessao);
    impl Ponte<'_> {
        pub fn com_sessao<T>(&self, f: impl FnOnce(&Sessao) -> Result<T, Erro>) -> Result<T, Erro> {
            f(self.0)
        }
    }

    include!(concat!(env!("OUT_DIR"), "/despacho.rs"));
}

use std::cell::RefCell;

use erro::Erro;
use ponte::Sessao;
use wasm_bindgen::prelude::*;

thread_local! {
    static SESSAO: RefCell<Option<Sessao>> = const { RefCell::new(None) };
}

fn js(e: Erro) -> JsValue {
    JsValue::from_str(&serde_json::to_string(&e).unwrap_or_else(|_| "{\"codigo\":\"interno\",\"mensagem\":\"erro\"}".into()))
}
fn interno(e: impl std::fmt::Display) -> JsValue {
    js(Erro::Interno(e.to_string()))
}

fn instalar(conn: rusqlite::Connection) -> Result<u32, JsValue> {
    conn.pragma_update(None, "foreign_keys", "ON").map_err(interno)?;
    banco::migrar(&conn).map_err(js)?;
    let v: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(interno)?;
    SESSAO.with(|s| *s.borrow_mut() = Some(Sessao { conn }));
    Ok(v as u32)
}

/// Abre um banco novo, vazio, com as mesmas migrações do Windows. Devolve a versão do banco.
#[wasm_bindgen]
pub fn abrir_vazio() -> Result<u32, JsValue> {
    console_error_panic_hook::set_once();
    instalar(rusqlite::Connection::open_in_memory().map_err(interno)?)
}

/// Abre um banco a partir dos bytes guardados (e aplica migrações novas, se houver).
#[wasm_bindgen]
pub fn abrir_de_bytes(bytes: &[u8]) -> Result<u32, JsValue> {
    console_error_panic_hook::set_once();
    let mut conn = rusqlite::Connection::open_in_memory().map_err(interno)?;
    conn.deserialize_read_exact(rusqlite::MAIN_DB, bytes, bytes.len(), false).map_err(interno)?;
    instalar(conn)
}

/// Os bytes do banco inteiro, para guardar.
#[wasm_bindgen]
pub fn exportar() -> Result<Vec<u8>, JsValue> {
    SESSAO.with(|s| {
        let mut s = s.borrow_mut();
        let s = s.as_mut().ok_or_else(|| js(Erro::Bloqueado))?;
        Ok(s.conn.serialize(rusqlite::MAIN_DB).map_err(interno)?.to_vec())
    })
}

/// Fecha o banco (ao bloquear). Os dados na memória somem.
#[wasm_bindgen]
pub fn fechar() {
    SESSAO.with(|s| *s.borrow_mut() = None);
}

/// Executa um comando com o mesmo nome e argumentos do Windows.
/// Devolve `{"r": <resultado>, "mudou": <se gravou algo>}` em JSON; em erro, o mesmo objeto de erro do Windows.
/// Comando que não existe aqui: erro com código "interno" e a palavra "fora".
#[wasm_bindgen]
pub fn executar(comando: &str, args: &str) -> Result<String, JsValue> {
    SESSAO.with(|s| {
        let s = s.borrow();
        let s = s.as_ref().ok_or_else(|| js(Erro::Bloqueado))?;
        let args = if args.trim().is_empty() || args.trim() == "null" { "{}" } else { args };
        let antes = s.conn.total_changes();
        let r = ponte::despachar(s, comando, args).ok_or_else(|| interno(format!("comando fora do motor: {comando}")))?.map_err(js)?;
        let mudou = s.conn.total_changes() != antes;
        Ok(serde_json::json!({ "r": r, "mudou": mudou }).to_string())
    })
}

/// Lista dos comandos que o motor atende (para os testes conferirem com o api.ts).
#[wasm_bindgen]
pub fn comandos_gerados() -> Vec<String> {
    ponte::COMANDOS_GERADOS.iter().map(|s| s.to_string()).collect()
}

/// Comandos do Windows que ficaram de fora (dependem do sistema).
#[wasm_bindgen]
pub fn comandos_de_fora() -> Vec<String> {
    ponte::COMANDOS_DE_FORA.iter().map(|s| s.to_string()).collect()
}
