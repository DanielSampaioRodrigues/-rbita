//! Google: login e a pasta escondida do app no Drive (`appDataFolder`).

use serde_json::{json, Value};

use super::oauth::email_do_id_token;
use super::{cliente, erro, erro_http, falha_de_rede, Conta, Credenciais};
use crate::erro::Erro;

const ENTRADA: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN: &str = "https://oauth2.googleapis.com/token";
const REVOGAR: &str = "https://oauth2.googleapis.com/revoke";
const ARQUIVOS: &str = "https://www.googleapis.com/drive/v3/files";
const ENVIO: &str = "https://www.googleapis.com/upload/drive/v3/files";
/// Só a pasta do app e o e-mail (para mostrar qual conta está ligada).
const ESCOPOS: &str = "openid email https://www.googleapis.com/auth/drive.appdata";

pub fn url_de_entrada(id: &str, retorno: &str, desafio: &str, estado: &str) -> String {
    url_de_entrada_com(id, retorno, desafio, estado, ESCOPOS)
}

/// Os conectores (Drive, Docs, Classroom) pedem outras permissões, numa ligação à parte
/// da sincronização: desligar um não mexe no outro.
pub fn url_de_entrada_com(id: &str, retorno: &str, desafio: &str, estado: &str, escopos: &str) -> String {
    let mut url = reqwest::Url::parse(ENTRADA).expect("endereço fixo");
    url.query_pairs_mut()
        .append_pair("client_id", id)
        .append_pair("redirect_uri", retorno)
        .append_pair("response_type", "code")
        .append_pair("scope", escopos)
        .append_pair("code_challenge", desafio)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", estado)
        // "offline" + "consent": garante a renovação, para não pedir login todo dia.
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent select_account");
    url.into()
}

async fn pedir_token(campos: &[(&str, &str)]) -> Result<Value, Erro> {
    let resposta = cliente()?.post(TOKEN).form(campos).send().await.map_err(|e| falha_de_rede(&e))?;
    let status = resposta.status();
    let corpo: Value = resposta.json().await.map_err(|e| falha_de_rede(&e))?;
    if !status.is_success() {
        return Err(if corpo["error"] == "invalid_grant" {
            erro("acesso", "A ligação com a conta Google expirou ou foi tirada. Conecte a conta de novo em Ajustes.")
        } else {
            erro_http(status)
        });
    }
    Ok(corpo)
}

pub async fn trocar_codigo(cred: Credenciais, codigo: &str, verificador: &str, retorno: &str) -> Result<Conta, Erro> {
    let mut campos = vec![
        ("client_id", cred.id),
        ("code", codigo),
        ("code_verifier", verificador),
        ("grant_type", "authorization_code"),
        ("redirect_uri", retorno),
    ];
    if let Some(s) = cred.segredo {
        campos.push(("client_secret", s));
    }
    let corpo = pedir_token(&campos).await?;
    let renovacao = corpo["refresh_token"].as_str().ok_or_else(|| erro("resposta", "O Google não devolveu a autorização completa. Tente entrar de novo."))?;
    // O Google deixa a pessoa desmarcar cada permissão: sem a do Drive, não adianta seguir.
    if !corpo["scope"].as_str().is_some_and(|e| e.contains("drive.appdata")) {
        revogar(renovacao).await;
        return Err(erro("permissao", SEM_PERMISSAO_DRIVE));
    }
    let email = corpo["id_token"].as_str().and_then(email_do_id_token).unwrap_or_else(|| "conta Google".into());
    Ok(Conta { renovacao: renovacao.to_string(), email })
}

/// Troca o código dos conectores: devolve a conta e as permissões que a pessoa deixou marcadas.
pub async fn trocar_codigo_conectores(cred: Credenciais, codigo: &str, verificador: &str, retorno: &str) -> Result<(Conta, String), Erro> {
    let mut campos = vec![
        ("client_id", cred.id),
        ("code", codigo),
        ("code_verifier", verificador),
        ("grant_type", "authorization_code"),
        ("redirect_uri", retorno),
    ];
    if let Some(s) = cred.segredo {
        campos.push(("client_secret", s));
    }
    let corpo = pedir_token(&campos).await?;
    let renovacao = corpo["refresh_token"].as_str().ok_or_else(|| erro("resposta", "O Google não devolveu a autorização completa. Tente entrar de novo."))?;
    let escopos = corpo["scope"].as_str().unwrap_or_default().to_string();
    let email = corpo["id_token"].as_str().and_then(email_do_id_token).unwrap_or_else(|| "conta Google".into());
    Ok((Conta { renovacao: renovacao.to_string(), email }, escopos))
}

pub async fn renovar(cred: Credenciais, renovacao: &str) -> Result<(String, Option<String>), Erro> {
    let mut campos = vec![("client_id", cred.id), ("refresh_token", renovacao), ("grant_type", "refresh_token")];
    if let Some(s) = cred.segredo {
        campos.push(("client_secret", s));
    }
    let corpo = pedir_token(&campos).await?;
    let (acesso, _) = acesso_da_resposta(&corpo)?;
    Ok((acesso, corpo["refresh_token"].as_str().map(str::to_string)))
}

/// Acesso de curta duração e por quantos segundos vale (o Google costuma dar 3.599).
/// Usado pela sincronização no Windows: a interface fala com o Drive direto, com este acesso.
pub async fn renovar_com_validade(cred: Credenciais, renovacao: &str) -> Result<(String, u64), Erro> {
    let mut campos = vec![("client_id", cred.id), ("refresh_token", renovacao), ("grant_type", "refresh_token")];
    if let Some(s) = cred.segredo {
        campos.push(("client_secret", s));
    }
    acesso_da_resposta(&pedir_token(&campos).await?)
}

fn acesso_da_resposta(corpo: &Value) -> Result<(String, u64), Erro> {
    let acesso = corpo["access_token"].as_str().ok_or_else(|| erro("resposta", "O Google respondeu sem o acesso. Tente de novo."))?;
    // Sem a validade na resposta, supõe a padrão do Google (1 hora).
    let validade = corpo["expires_in"].as_u64().unwrap_or(3600);
    Ok((acesso.to_string(), validade))
}

const SEM_PERMISSAO_DRIVE: &str = "Na tela do Google, a permissão do Drive ficou desmarcada, então o Órbita não consegue guardar a cópia. Desligue a conta, ligue de novo e deixe marcada a opção \"Ver, criar e excluir os próprios dados de configuração no Google Drive\".";

/// Erro do Drive em linguagem simples. O Google explica o motivo no corpo da resposta.
async fn falha(resposta: reqwest::Response) -> Erro {
    let status = resposta.status();
    let corpo: Value = resposta.json().await.unwrap_or(Value::Null);
    motivo_do_erro(status, &corpo)
}

fn motivo_do_erro(status: reqwest::StatusCode, corpo: &Value) -> Erro {
    let texto = corpo.to_string();
    if texto.contains("insufficientPermissions") || texto.contains("ACCESS_TOKEN_SCOPE_INSUFFICIENT") || texto.contains("insufficient authentication scopes") {
        return erro("permissao", SEM_PERMISSAO_DRIVE);
    }
    if texto.contains("accessNotConfigured") || texto.contains("SERVICE_DISABLED") {
        return erro("servico", "O Google Drive não está ligado no cadastro do Órbita no Google. Isso é do lado de quem publica o Órbita, não seu.");
    }
    erro_http(status)
}

/// Id do arquivo com esse nome na pasta do app, se existir.
async fn achar(acesso: &str, nome: &str) -> Result<Option<String>, Erro> {
    let consulta = format!("name = '{}' and trashed = false", nome.replace('\'', "\\'"));
    let resposta = cliente()?
        .get(ARQUIVOS)
        .bearer_auth(acesso)
        .query(&[("spaces", "appDataFolder"), ("q", consulta.as_str()), ("fields", "files(id)"), ("pageSize", "10")])
        .send()
        .await
        .map_err(|e| falha_de_rede(&e))?;
    if !resposta.status().is_success() {
        return Err(falha(resposta).await);
    }
    let corpo: Value = resposta.json().await.map_err(|e| falha_de_rede(&e))?;
    Ok(corpo["files"].get(0).and_then(|f| f["id"].as_str()).map(str::to_string))
}

/// Envio "retomável" (serve para arquivos de qualquer tamanho): cria ou substitui.
pub async fn enviar(acesso: &str, nome: &str, dados: Vec<u8>) -> Result<(), Erro> {
    let c = cliente()?;
    let inicio = match achar(acesso, nome).await? {
        Some(id) => c.patch(format!("{ENVIO}/{id}?uploadType=resumable")).json(&json!({})),
        None => c.post(format!("{ENVIO}?uploadType=resumable")).json(&json!({ "name": nome, "parents": ["appDataFolder"] })),
    };
    let resposta = inicio
        .bearer_auth(acesso)
        .header("X-Upload-Content-Type", "application/octet-stream")
        .header("X-Upload-Content-Length", dados.len().to_string())
        .send()
        .await
        .map_err(|e| falha_de_rede(&e))?;
    if !resposta.status().is_success() {
        return Err(falha(resposta).await);
    }
    let destino = resposta
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| erro("resposta", "O Google não abriu o envio. Tente de novo."))?
        .to_string();
    let resposta = c.put(destino).body(dados).send().await.map_err(|e| falha_de_rede(&e))?;
    if !resposta.status().is_success() {
        return Err(falha(resposta).await);
    }
    Ok(())
}

pub async fn baixar(acesso: &str, nome: &str) -> Result<Option<Vec<u8>>, Erro> {
    let Some(id) = achar(acesso, nome).await? else { return Ok(None) };
    let resposta = cliente()?.get(format!("{ARQUIVOS}/{id}?alt=media")).bearer_auth(acesso).send().await.map_err(|e| falha_de_rede(&e))?;
    if !resposta.status().is_success() {
        return Err(falha(resposta).await);
    }
    Ok(Some(resposta.bytes().await.map_err(|e| falha_de_rede(&e))?.to_vec()))
}

pub async fn apagar(acesso: &str, nome: &str) -> Result<(), Erro> {
    let Some(id) = achar(acesso, nome).await? else { return Ok(()) };
    let resposta = cliente()?.delete(format!("{ARQUIVOS}/{id}")).bearer_auth(acesso).send().await.map_err(|e| falha_de_rede(&e))?;
    if !resposta.status().is_success() && resposta.status() != reqwest::StatusCode::NOT_FOUND {
        return Err(falha(resposta).await);
    }
    Ok(())
}

/// Tira o acesso do Órbita na conta. Falha aqui não impede desligar.
pub async fn revogar(renovacao: &str) {
    if let Ok(c) = cliente() {
        let _ = c.post(REVOGAR).form(&[("token", renovacao)]).send().await;
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn explica_a_permissao_desmarcada() {
        let corpo = json!({"error": {"code": 403, "errors": [{"reason": "insufficientPermissions"}], "status": "PERMISSION_DENIED"}});
        assert!(matches!(motivo_do_erro(reqwest::StatusCode::FORBIDDEN, &corpo), Erro::Nuvem { motivo: "permissao", .. }));
        let corpo = json!({"error": {"errors": [{"reason": "accessNotConfigured"}]}});
        assert!(matches!(motivo_do_erro(reqwest::StatusCode::FORBIDDEN, &corpo), Erro::Nuvem { motivo: "servico", .. }));
        assert!(matches!(motivo_do_erro(reqwest::StatusCode::FORBIDDEN, &Value::Null), Erro::Nuvem { motivo: "acesso", .. }));
    }

    #[test]
    fn le_o_acesso_e_a_validade() {
        let (a, v) = acesso_da_resposta(&json!({"access_token": "ya29.x", "expires_in": 3599})).unwrap();
        assert_eq!((a.as_str(), v), ("ya29.x", 3599));
        assert_eq!(acesso_da_resposta(&json!({"access_token": "y"})).unwrap().1, 3600);
        assert!(acesso_da_resposta(&json!({"expires_in": 10})).is_err());
    }

    #[test]
    fn a_entrada_pede_so_a_pasta_do_app() {
        let url = url_de_entrada("id-1", "http://127.0.0.1:5000", "desafio", "e1");
        assert!(url.starts_with(ENTRADA));
        assert!(url.contains("drive.appdata") && !url.contains("auth%2Fdrive%20") && !url.contains("drive.file"));
        assert!(url.contains("code_challenge_method=S256") && url.contains("access_type=offline"));
        assert!(url.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A5000"));
    }
}
