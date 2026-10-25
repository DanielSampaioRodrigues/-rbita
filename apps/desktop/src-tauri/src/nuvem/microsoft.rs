//! Microsoft: login e a pasta do app no OneDrive (`approot`, em "Aplicativos/Órbita").

use serde_json::{json, Value};

use super::oauth::email_do_id_token;
use super::{cliente, erro, erro_http, falha_de_rede, Conta, Credenciais};
use crate::erro::Erro;

/// "common": aceita conta pessoal (Outlook, Hotmail) e de trabalho ou escola.
const ENTRADA: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const PASTA: &str = "https://graph.microsoft.com/v1.0/me/drive/special/approot";
const ESCOPOS: &str = "openid email offline_access Files.ReadWrite.AppFolder";
/// Pedaços do envio: múltiplos de 320 KiB, como a Microsoft pede.
const PEDACO: usize = 320 * 1024 * 16;

pub fn url_de_entrada(id: &str, retorno: &str, desafio: &str, estado: &str) -> String {
    let mut url = reqwest::Url::parse(ENTRADA).expect("endereço fixo");
    url.query_pairs_mut()
        .append_pair("client_id", id)
        .append_pair("redirect_uri", retorno)
        .append_pair("response_type", "code")
        .append_pair("response_mode", "query")
        .append_pair("scope", ESCOPOS)
        .append_pair("code_challenge", desafio)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", estado)
        .append_pair("prompt", "select_account");
    url.into()
}

async fn pedir_token(campos: &[(&str, &str)]) -> Result<Value, Erro> {
    let resposta = cliente()?.post(TOKEN).form(campos).send().await.map_err(|e| falha_de_rede(&e))?;
    let status = resposta.status();
    let corpo: Value = resposta.json().await.map_err(|e| falha_de_rede(&e))?;
    if !status.is_success() {
        return Err(if corpo["error"] == "invalid_grant" {
            erro("acesso", "A ligação com a conta Microsoft expirou ou foi tirada. Conecte a conta de novo em Ajustes.")
        } else {
            erro_http(status)
        });
    }
    Ok(corpo)
}

pub async fn trocar_codigo(cred: Credenciais, codigo: &str, verificador: &str, retorno: &str) -> Result<Conta, Erro> {
    let corpo = pedir_token(&[
        ("client_id", cred.id),
        ("code", codigo),
        ("code_verifier", verificador),
        ("grant_type", "authorization_code"),
        ("redirect_uri", retorno),
        ("scope", ESCOPOS),
    ])
    .await?;
    let renovacao = corpo["refresh_token"].as_str().ok_or_else(|| erro("resposta", "A Microsoft não devolveu a autorização completa. Tente entrar de novo."))?;
    let email = corpo["id_token"].as_str().and_then(email_do_id_token).unwrap_or_else(|| "conta Microsoft".into());
    Ok(Conta { renovacao: renovacao.to_string(), email })
}

/// A Microsoft devolve uma renovação nova a cada uso; a antiga deixa de valer com o tempo.
pub async fn renovar(cred: Credenciais, renovacao: &str) -> Result<(String, Option<String>), Erro> {
    let corpo = pedir_token(&[("client_id", cred.id), ("refresh_token", renovacao), ("grant_type", "refresh_token"), ("scope", ESCOPOS)]).await?;
    let acesso = corpo["access_token"].as_str().ok_or_else(|| erro("resposta", "A Microsoft respondeu sem o acesso. Tente de novo."))?;
    Ok((acesso.to_string(), corpo["refresh_token"].as_str().map(str::to_string)))
}

fn caminho(nome: &str) -> String {
    format!("{PASTA}:/{}:", urlencoding_simples(nome))
}

/// Os nomes do Órbita são fixos e só têm letras, números, ponto e hífen.
fn urlencoding_simples(nome: &str) -> String {
    nome.chars().filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_')).collect()
}

/// Sessão de envio em pedaços: serve para arquivos de qualquer tamanho e substitui o anterior.
pub async fn enviar(acesso: &str, nome: &str, dados: Vec<u8>) -> Result<(), Erro> {
    let c = cliente()?;
    let resposta = c
        .post(format!("{}/createUploadSession", caminho(nome)))
        .bearer_auth(acesso)
        .json(&json!({ "item": { "@microsoft.graph.conflictBehavior": "replace" } }))
        .send()
        .await
        .map_err(|e| falha_de_rede(&e))?;
    if !resposta.status().is_success() {
        return Err(erro_http(resposta.status()));
    }
    let corpo: Value = resposta.json().await.map_err(|e| falha_de_rede(&e))?;
    let destino = corpo["uploadUrl"].as_str().ok_or_else(|| erro("resposta", "A Microsoft não abriu o envio. Tente de novo."))?.to_string();
    let total = dados.len();
    if total == 0 {
        return Err(erro("resposta", "Não há nada para enviar."));
    }
    let mut inicio = 0;
    while inicio < total {
        let fim = (inicio + PEDACO).min(total);
        // O endereço do envio já carrega a autorização: não vai o token junto.
        let resposta = c
            .put(&destino)
            .header(reqwest::header::CONTENT_RANGE, format!("bytes {inicio}-{}/{total}", fim - 1))
            .body(dados[inicio..fim].to_vec())
            .send()
            .await
            .map_err(|e| falha_de_rede(&e))?;
        if !resposta.status().is_success() {
            return Err(erro_http(resposta.status()));
        }
        inicio = fim;
    }
    Ok(())
}

pub async fn baixar(acesso: &str, nome: &str) -> Result<Option<Vec<u8>>, Erro> {
    let resposta = cliente()?.get(format!("{}/content", caminho(nome))).bearer_auth(acesso).send().await.map_err(|e| falha_de_rede(&e))?;
    if resposta.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !resposta.status().is_success() {
        return Err(erro_http(resposta.status()));
    }
    Ok(Some(resposta.bytes().await.map_err(|e| falha_de_rede(&e))?.to_vec()))
}

pub async fn apagar(acesso: &str, nome: &str) -> Result<(), Erro> {
    let resposta = cliente()?.delete(caminho(nome)).bearer_auth(acesso).send().await.map_err(|e| falha_de_rede(&e))?;
    if !resposta.status().is_success() && resposta.status() != reqwest::StatusCode::NOT_FOUND {
        return Err(erro_http(resposta.status()));
    }
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn a_entrada_pede_so_a_pasta_do_app() {
        let url = url_de_entrada("id-1", "http://localhost:5000", "desafio", "e1");
        assert!(url.contains("Files.ReadWrite.AppFolder") && !url.contains("Files.ReadWrite.All"));
        assert!(url.contains("offline_access") && url.contains("redirect_uri=http%3A%2F%2Flocalhost%3A5000"));
    }

    #[test]
    fn caminho_na_pasta_do_app() {
        assert_eq!(caminho("orbita.orbita-backup"), format!("{PASTA}:/orbita.orbita-backup:"));
        assert_eq!(caminho("../x y"), format!("{PASTA}:/..xy:"));
    }
}
