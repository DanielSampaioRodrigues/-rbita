//! Cofre de valores: dados pequenos de módulo (personalização das rotinas,
//! focos salvos, contas de energia…), guardados como JSON dentro do banco
//! criptografado. Entram no backup sem passo extra, porque o backup copia o
//! banco inteiro.
//!
//! Usa a tabela `config`, com o prefixo `valor:` na chave. O prefixo separa
//! estes dados dos ajustes internos (palavras de recuperação, nuvem, backup):
//! a interface só alcança chaves com o prefixo, nunca as internas.

use rusqlite::Connection;

use super::{apagar_config, gravar_config, ler_config};
use crate::erro::Erro;

const PREFIXO: &str = "valor:";
/// Tamanho máximo do nome da chave.
pub const MAXIMO_CHAVE: usize = 80;
/// Tamanho máximo do JSON guardado (2 MB). É para dados pequenos.
pub const MAXIMO_JSON: usize = 2 * 1024 * 1024;

/// Aceita só nomes simples, como `rotinas.personalizacao` ou `foco.salvos`.
fn chave_interna(chave: &str) -> Result<String, Erro> {
    let valida = !chave.is_empty()
        && chave.len() <= MAXIMO_CHAVE
        && chave.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '.' | '-' | '_'));
    if !valida {
        return Err(Erro::Interno(format!("nome de valor inválido: {chave:?}")));
    }
    Ok(format!("{PREFIXO}{chave}"))
}

pub fn ler(conn: &Connection, chave: &str) -> Result<Option<String>, Erro> {
    ler_config(conn, &chave_interna(chave)?)
}

/// Grava o JSON (texto). Recusa o que não for JSON válido ou for grande demais.
pub fn gravar(conn: &Connection, chave: &str, json: &str) -> Result<(), Erro> {
    let interna = chave_interna(chave)?;
    if json.len() > MAXIMO_JSON {
        return Err(Erro::Interno(format!("o valor {chave:?} passa do tamanho máximo")));
    }
    serde_json::from_str::<serde_json::Value>(json).map_err(|e| Erro::Interno(format!("o valor {chave:?} não é JSON: {e}")))?;
    gravar_config(conn, &interna, json)
}

pub fn apagar(conn: &Connection, chave: &str) -> Result<(), Erro> {
    apagar_config(conn, &chave_interna(chave)?)
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::testes::banco_de_teste;

    #[test]
    fn grava_le_substitui_e_apaga() {
        let (_pasta, conn) = banco_de_teste();
        assert_eq!(ler(&conn, "foco.salvos").unwrap(), None);
        gravar(&conn, "foco.salvos", r#"[{"id":"a","nome":"Estudar","minutos":45,"pausa":10}]"#).unwrap();
        assert_eq!(ler(&conn, "foco.salvos").unwrap().as_deref(), Some(r#"[{"id":"a","nome":"Estudar","minutos":45,"pausa":10}]"#));
        gravar(&conn, "foco.salvos", "[]").unwrap();
        assert_eq!(ler(&conn, "foco.salvos").unwrap().as_deref(), Some("[]"));
        apagar(&conn, "foco.salvos").unwrap();
        assert_eq!(ler(&conn, "foco.salvos").unwrap(), None);
        // Apagar o que não existe não é erro.
        apagar(&conn, "foco.salvos").unwrap();
    }

    #[test]
    fn nao_alcanca_os_ajustes_internos() {
        let (_pasta, conn) = banco_de_teste();
        gravar_config(&conn, "palavras_recuperacao", "segredo").unwrap();
        // Nomes fora do padrão são recusados…
        assert!(ler(&conn, "palavras_recuperacao").is_ok_and(|v| v.is_none()));
        assert!(ler(&conn, "").is_err());
        assert!(ler(&conn, "Maiuscula").is_err());
        assert!(ler(&conn, "com espaço").is_err());
        assert!(ler(&conn, "valor:x").is_err());
        assert!(gravar(&conn, &"a".repeat(MAXIMO_CHAVE + 1), "1").is_err());
        // …e gravar um valor com o mesmo nome não mexe no ajuste interno.
        gravar(&conn, "palavras_recuperacao", r#""outra""#).unwrap();
        assert_eq!(ler_config(&conn, "palavras_recuperacao").unwrap().as_deref(), Some("segredo"));
        apagar(&conn, "palavras_recuperacao").unwrap();
        assert_eq!(ler_config(&conn, "palavras_recuperacao").unwrap().as_deref(), Some("segredo"));
    }

    #[test]
    fn recusa_o_que_nao_e_json_ou_e_grande_demais() {
        let (_pasta, conn) = banco_de_teste();
        assert!(gravar(&conn, "energia.contas", "não é json").is_err());
        let grande = format!("\"{}\"", "x".repeat(MAXIMO_JSON));
        assert!(gravar(&conn, "energia.contas", &grande).is_err());
        assert_eq!(ler(&conn, "energia.contas").unwrap(), None);
    }
}
