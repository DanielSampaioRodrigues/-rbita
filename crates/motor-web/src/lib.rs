//! Motor do Órbita no navegador: o mesmo banco do Windows (`src-tauri/src/banco`),
//! compilado para WebAssembly. Ver `docs/decisoes/0011-motor-unico.md`.
//!
//! O banco fica em memória. Para guardar, o navegador pede os bytes (`exportar`),
//! tranca com a chave do cofre web e grava no IndexedDB; ao abrir, devolve os
//! bytes (`abrir_de_bytes`). Os comandos chegam por `executar`, com o mesmo nome e
//! os mesmos argumentos que o Windows recebe (ponte gerada por `build.rs`).

#[path = "../../../apps/desktop/src-tauri/src/erro.rs"]
pub mod erro;

pub mod cofre;

/// O formato do backup, o mesmo arquivo do Windows.
#[path = "../../../apps/desktop/src-tauri/src/portatil.rs"]
pub mod portatil;

#[path = "../../../apps/desktop/src-tauri/src/banco/mod.rs"]
pub mod banco;

/// A IA do Windows sem a parte de rede: provedores e chaves no banco, textos
/// enviados e conferência das respostas. Quem envia é o navegador (fetch).
/// Ver `docs/decisoes/0013-ia-no-navegador.md`.
#[path = "../../../apps/desktop/src-tauri/src/ia/mod.rs"]
pub mod ia;

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
use cofre::cripto::Chave;
use cofre::EnvelopesPortateis;
use portatil::{Origem, Segredo, CONFIG_PALAVRAS, KDF_NAVEGADOR};
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

// ── IA (ver src-tauri/src/ia/fluxo.rs e docs/decisoes/0013-ia-no-navegador.md) ──

/// Um passo de uma ordem de IA. Sem `resposta`: o primeiro pedido. Com a resposta
/// do pedido anterior (JSON `{etapa, situacao, corpo}`): o resultado ou mais um pedido.
/// Devolve o passo em JSON (`{tipo: "pedir", pedido, etapa}` ou `{tipo: "pronto", valor}`).
/// O pedido leva a chave nos cabeçalhos: só serve para enviar, nunca para mostrar.
#[wasm_bindgen]
pub fn ia_avancar(comando: &str, args: &str, resposta: Option<String>) -> Result<String, JsValue> {
    let resposta: Option<ia::fluxo::Resposta> = match resposta {
        Some(r) => Some(serde_json::from_str(&r).map_err(|e| interno(format!("resposta da IA: {e}")))?),
        None => None,
    };
    SESSAO.with(|s| {
        let s = s.borrow();
        let s = s.as_ref().ok_or_else(|| js(Erro::Bloqueado))?;
        let passo = ia::fluxo::avancar(&s.conn, comando, args, resposta.as_ref()).map_err(js)?;
        serde_json::to_string(&passo).map_err(interno)
    })
}

/// O erro (JSON, o mesmo do Windows) para um pedido de IA que nem chegou ao provedor.
#[wasm_bindgen]
pub fn ia_falha_de_rede(url: &str, local: bool, demorou: bool, sem_internet: bool) -> String {
    serde_json::to_string(&ia::protocolo::falha_de_rede_em(url, local, demorou, true, sem_internet)).unwrap_or_default()
}

/// As ordens de IA que passam por `ia_avancar`.
#[wasm_bindgen]
pub fn ia_comandos() -> Vec<String> {
    ia::fluxo::COMANDOS.iter().map(|s| s.to_string()).collect()
}

// ── Backup portátil e envelopes (ver src-tauri/src/portatil.rs) ─────────────────

fn chave_de(bytes: &[u8]) -> Result<Chave, JsValue> {
    let mut c = zeroize::Zeroizing::new([0u8; 32]);
    if bytes.len() != 32 {
        return Err(interno("chave dos dados com tamanho errado"));
    }
    c.copy_from_slice(bytes);
    Ok(c)
}

fn envelopes_de(json: &str) -> Result<EnvelopesPortateis, JsValue> {
    serde_json::from_str(json).map_err(|e| interno(format!("envelopes: {e}")))
}

fn segredo(senha: Option<String>, palavras: Option<String>) -> Result<Segredo, JsValue> {
    match (senha, palavras) {
        (_, Some(p)) => Ok(Segredo::Palavras(p)),
        (Some(s), None) => Ok(Segredo::Senha(s)),
        (None, None) => Err(js(Erro::SenhaErrada)),
    }
}

/// Envelope da senha que viaja no backup (Argon2id com o custo do navegador). JSON do envelope.
#[wasm_bindgen]
pub fn portatil_envelope_senha(dek: &[u8], senha: &str, id: &str) -> Result<String, JsValue> {
    let env = EnvelopesPortateis::envelope_da_senha(&chave_de(dek)?, senha, id, KDF_NAVEGADOR).map_err(js)?;
    serde_json::to_string(&env).map_err(interno)
}

/// Envelope das 6 palavras que viaja no backup. JSON do envelope.
#[wasm_bindgen]
pub fn portatil_envelope_palavras(dek: &[u8], palavras: &str, id: &str) -> Result<String, JsValue> {
    let env = EnvelopesPortateis::envelope_das_palavras(&chave_de(dek)?, palavras, id, KDF_NAVEGADOR).map_err(js)?;
    serde_json::to_string(&env).map_err(interno)
}

/// Abre a chave dos dados pelos envelopes portáteis (`{id, senha?, recuperacao}`), com a senha ou as palavras.
#[wasm_bindgen]
pub fn portatil_abrir(envelopes: &str, senha: Option<String>, palavras: Option<String>) -> Result<Vec<u8>, JsValue> {
    let e = envelopes_de(envelopes)?;
    let chave = match segredo(senha, palavras)? {
        Segredo::Senha(s) => e.abrir_com_senha(&s),
        Segredo::Palavras(p) => e.abrir_com_palavras(&p),
    }
    .map_err(js)?;
    Ok(chave.to_vec())
}

/// Monta o arquivo de backup com o banco aberto agora e os envelopes portáteis do cofre web.
#[wasm_bindgen]
pub fn backup_montar(dek: &[u8], envelopes: &str, versao_app: &str) -> Result<Vec<u8>, JsValue> {
    let chave = chave_de(dek)?;
    let e = envelopes_de(envelopes)?;
    SESSAO.with(|s| {
        let mut s = s.borrow_mut();
        let s = s.as_mut().ok_or_else(|| js(Erro::Bloqueado))?;
        let banco = zeroize::Zeroizing::new(s.conn.serialize(rusqlite::MAIN_DB).map_err(interno)?.to_vec());
        portatil::montar(&banco, &chave, e, Origem::Navegador, versao_app).map_err(js)
    })
}

/// O que a tela mostra antes de pedir a senha (JSON `{criadoEm, versaoApp, temSenha, versao, origem}`).
#[wasm_bindgen]
pub fn backup_info(bytes: &[u8]) -> Result<String, JsValue> {
    serde_json::to_string(&portatil::informacao(bytes).map_err(js)?).map_err(interno)
}

/// Um backup aberto: a chave dos dados, o banco em bytes, os envelopes (JSON) e as 6 palavras
/// guardadas dentro do banco (se houver).
#[wasm_bindgen(getter_with_clone)]
pub struct BackupAberto {
    pub dek: Vec<u8>,
    pub banco: Vec<u8>,
    pub envelopes: String,
    pub palavras: Option<String>,
}

/// Abre um backup (versão 2) com a senha ou as palavras e confere que o banco abre
/// (com as migrações deste motor), sem mexer no banco aberto agora.
#[wasm_bindgen]
pub fn backup_abrir(bytes: &[u8], senha: Option<String>, palavras: Option<String>) -> Result<BackupAberto, JsValue> {
    console_error_panic_hook::set_once();
    let a = portatil::abrir(bytes, &segredo(senha, palavras)?).map_err(js)?;
    let mut conn = rusqlite::Connection::open_in_memory().map_err(interno)?;
    conn.deserialize_read_exact(rusqlite::MAIN_DB, a.banco.as_slice(), a.banco.len(), false)
        .map_err(|_| js(Erro::BackupInvalido("os dados dentro dele estão danificados".into())))?;
    banco::migrar(&conn).map_err(js)?;
    // O backup pode estar indo para outro aparelho: ganha um id de sincronização novo.
    banco::sincronia::esquecer_aparelho(&conn).map_err(js)?;
    let palavras = banco::ler_config(&conn, CONFIG_PALAVRAS).map_err(js)?;
    let banco = conn.serialize(rusqlite::MAIN_DB).map_err(interno)?.to_vec();
    Ok(BackupAberto {
        dek: a.chave.to_vec(),
        banco,
        envelopes: serde_json::to_string(&a.cabecalho.envelopes).map_err(interno)?,
        palavras,
    })
}

/// As 6 palavras guardadas dentro do banco aberto (como no Windows), se houver.
#[wasm_bindgen]
pub fn palavras_no_banco() -> Result<Option<String>, JsValue> {
    SESSAO.with(|s| {
        let s = s.borrow();
        let s = s.as_ref().ok_or_else(|| js(Erro::Bloqueado))?;
        banco::ler_config(&s.conn, CONFIG_PALAVRAS).map_err(js)
    })
}

/// Guarda as 6 palavras dentro do banco aberto, para o backup levar (o Windows mostra
/// em "Ver a chave"). Devolve se mudou algo (então é preciso guardar o banco).
#[wasm_bindgen]
pub fn guardar_palavras_no_banco(palavras: &str) -> Result<bool, JsValue> {
    SESSAO.with(|s| {
        let s = s.borrow();
        let s = s.as_ref().ok_or_else(|| js(Erro::Bloqueado))?;
        if banco::ler_config(&s.conn, CONFIG_PALAVRAS).map_err(js)?.as_deref() == Some(palavras) {
            return Ok(false);
        }
        banco::gravar_config(&s.conn, CONFIG_PALAVRAS, palavras).map_err(js)?;
        Ok(true)
    })
}
