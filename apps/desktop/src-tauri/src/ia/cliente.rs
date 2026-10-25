//! Conversa com os provedores. Dois formatos: o da Anthropic (Claude) e o
//! "compatível com GPT", que serve para GPT, Gemini, Grok, Sabiá e Ollama.

use std::time::Duration;

use serde_json::{json, Value};

use super::{Escolhido, TipoProvedor};
use crate::erro::Erro;

const VERSAO_ANTHROPIC: &str = "2026-10-21";
/// Modelos locais podem demorar bastante no primeiro pedido (carregam na memória).
const TEMPO_LIMITE: Duration = Duration::from_secs(180);

fn erro(motivo: &'static str, mensagem: &str) -> Erro {
    Erro::Ia { motivo, mensagem: mensagem.into() }
}

fn cliente() -> Result<reqwest::Client, Erro> {
    reqwest::Client::builder()
        .timeout(TEMPO_LIMITE)
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| Erro::Interno(e.to_string()))
}

fn com_chave(pedido: reqwest::RequestBuilder, e: &Escolhido) -> reqwest::RequestBuilder {
    match (&e.provedor.tipo, &e.chave) {
        (TipoProvedor::Claude, Some(c)) => pedido.header("x-api-key", c.as_str()).header("anthropic-version", VERSAO_ANTHROPIC),
        (TipoProvedor::Claude, None) => pedido.header("anthropic-version", VERSAO_ANTHROPIC),
        (TipoProvedor::Compativel, Some(c)) => pedido.bearer_auth(c.as_str()),
        (TipoProvedor::Compativel, None) => pedido,
    }
}

fn traduzir_falha_de_rede(e: &reqwest::Error, local: bool) -> Erro {
    if e.is_timeout() {
        erro("demora", "O provedor demorou demais para responder. Tente de novo daqui a pouco.")
    } else if local {
        erro("local_fechado", "O Ollama não respondeu. Confira se ele está instalado e aberto.")
    } else {
        erro("rede", "Não consegui falar com o provedor. Confira a conexão com a internet.")
    }
}

/// Converte a situação HTTP numa explicação simples. O texto do provedor
/// fica só para o caso que não reconhecemos.
fn traduzir_situacao(situacao: u16, corpo: &str) -> Erro {
    match situacao {
        401 | 403 => erro("chave", "O provedor não aceitou a chave. Confira se ela foi colada inteira."),
        402 | 429 => erro("limite", "O provedor recusou por limite de uso ou falta de créditos. Confira a sua conta ou tente mais tarde."),
        404 => erro("modelo", "O provedor não encontrou esse modelo. Escolha outro na lista."),
        500..=599 => erro("servidor", "O provedor está com problema agora. Tente de novo daqui a pouco."),
        _ => {
            let detalhe = serde_json::from_str::<Value>(corpo)
                .ok()
                .and_then(|v| v.pointer("/error/message").and_then(Value::as_str).map(str::to_string))
                .unwrap_or_default();
            Erro::Ia { motivo: "outro", mensagem: format!("O provedor recusou o pedido ({situacao}). {detalhe}").trim().to_string() }
        }
    }
}

async fn enviar(pedido: reqwest::RequestBuilder, local: bool) -> Result<Value, Erro> {
    let resposta = pedido.send().await.map_err(|e| traduzir_falha_de_rede(&e, local))?;
    let situacao = resposta.status().as_u16();
    let corpo = resposta.text().await.map_err(|e| traduzir_falha_de_rede(&e, local))?;
    if !(200..300).contains(&situacao) {
        return Err(traduzir_situacao(situacao, &corpo));
    }
    serde_json::from_str(&corpo).map_err(|_| erro("resposta", "A resposta veio num formato que não entendi. Tente de novo."))
}

/// Lista os modelos do provedor. Serve também de teste da chave, sem custo.
pub async fn listar_modelos(e: &Escolhido) -> Result<Vec<String>, Erro> {
    let url = match e.provedor.tipo {
        TipoProvedor::Claude => format!("{}/v1/models?limit=100", e.provedor.url),
        TipoProvedor::Compativel => format!("{}/models", e.provedor.url),
    };
    let v = enviar(com_chave(cliente()?.get(url), e), e.provedor.local()).await?;
    let mut modelos: Vec<String> = v["data"]
        .as_array()
        .map(|l| l.iter().filter_map(|m| m["id"].as_str().map(|s| s.trim_start_matches("models/").to_string())).collect())
        .unwrap_or_default();
    // Gemini lista também modelos de imagem e de busca; esses não conversam.
    modelos.retain(|m| !m.contains("embedding") && !m.contains("tts") && !m.contains("image"));
    Ok(modelos)
}

/// Todos os modelos do provedor, sem filtro (para achar os de imagem).
pub async fn listar_todos_modelos(e: &Escolhido) -> Result<Vec<String>, Erro> {
    let url = match e.provedor.tipo {
        TipoProvedor::Claude => format!("{}/v1/models?limit=100", e.provedor.url),
        TipoProvedor::Compativel => format!("{}/models", e.provedor.url),
    };
    let v = enviar(com_chave(cliente()?.get(url), e), e.provedor.local()).await?;
    Ok(v["data"]
        .as_array()
        .map(|l| l.iter().filter_map(|m| m["id"].as_str().map(|s| s.trim_start_matches("models/").to_string())).collect())
        .unwrap_or_default())
}

/// Gera uma imagem pelo formato "compatível com GPT" (/images/generations).
/// Devolve a imagem como endereço de dados (data:image/png;base64,...).
pub async fn gerar_imagem(e: &Escolhido, modelo: &str, pedido: &str) -> Result<String, Erro> {
    if e.provedor.tipo != TipoProvedor::Compativel {
        return Err(erro("sem_imagem", "Este provedor não gera imagens. Dá para criar o tema com desenho em SVG."));
    }
    let mut corpo = json!({ "model": modelo, "prompt": pedido, "n": 1 });
    // Os modelos "gpt-image" sempre devolvem a imagem pronta e recusam este campo.
    if !modelo.starts_with("gpt-image") {
        corpo["response_format"] = json!("b64_json");
    }
    let pedido = cliente()?.post(format!("{}/images/generations", e.provedor.url)).json(&corpo);
    let v = enviar(com_chave(pedido, e), e.provedor.local()).await?;
    if let Some(b64) = v.pointer("/data/0/b64_json").and_then(Value::as_str) {
        return Ok(format!("data:image/png;base64,{b64}"));
    }
    if let Some(url) = v.pointer("/data/0/url").and_then(Value::as_str) {
        let bytes = cliente()?
            .get(url)
            .send()
            .await
            .map_err(|e2| traduzir_falha_de_rede(&e2, false))?
            .bytes()
            .await
            .map_err(|e2| traduzir_falha_de_rede(&e2, false))?;
        use base64::Engine;
        return Ok(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)));
    }
    Err(erro("resposta", "A imagem não veio na resposta. Tente de novo."))
}

/// Um pedido de uma mensagem só, com instruções de sistema. Devolve o texto.
pub async fn completar(e: &Escolhido, sistema: &str, mensagem: &str) -> Result<String, Erro> {
    let local = e.provedor.local();
    match e.provedor.tipo {
        TipoProvedor::Claude => {
            let corpo = json!({
                "model": e.provedor.modelo,
                "max_tokens": 16000,
                "system": sistema,
                "messages": [{ "role": "user", "content": mensagem }],
            });
            let pedido = cliente()?.post(format!("{}/v1/messages", e.provedor.url)).json(&corpo);
            let v = enviar(com_chave(pedido, e), local).await?;
            if v["stop_reason"] == "refusal" {
                return Err(erro("recusa", "O modelo preferiu não responder a este pedido."));
            }
            let texto: String = v["content"]
                .as_array()
                .map(|blocos| blocos.iter().filter(|b| b["type"] == "text").filter_map(|b| b["text"].as_str()).collect())
                .unwrap_or_default();
            Ok(texto)
        }
        TipoProvedor::Compativel => {
            let corpo = json!({
                "model": e.provedor.modelo,
                "messages": [
                    { "role": "system", "content": sistema },
                    { "role": "user", "content": mensagem },
                ],
            });
            let pedido = cliente()?.post(format!("{}/chat/completions", e.provedor.url)).json(&corpo);
            let v = enviar(com_chave(pedido, e), local).await?;
            v.pointer("/choices/0/message/content")
                .and_then(Value::as_str)
                .map(str::to_string)
                .ok_or_else(|| erro("resposta", "A resposta veio num formato que não entendi. Tente de novo."))
        }
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::ia::Provedor;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::mpsc;

    /// Servidor de mentira: responde uma vez com `corpo` e devolve o pedido recebido.
    fn servidor(situacao: u16, corpo: &'static str) -> (String, mpsc::Receiver<String>) {
        let ouvinte = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://127.0.0.1:{}", ouvinte.local_addr().unwrap().port());
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let (mut s, _) = ouvinte.accept().unwrap();
            let mut pedido = Vec::new();
            let mut buf = [0u8; 4096];
            // Lê cabeçalhos e corpo (Content-Length).
            loop {
                let n = s.read(&mut buf).unwrap();
                pedido.extend_from_slice(&buf[..n]);
                let texto = String::from_utf8_lossy(&pedido).to_string();
                if let Some(fim) = texto.find("\r\n\r\n") {
                    let tamanho = texto.lines().find_map(|l| l.to_lowercase().strip_prefix("content-length:").map(|v| v.trim().parse::<usize>().unwrap())).unwrap_or(0);
                    if pedido.len() >= fim + 4 + tamanho {
                        break;
                    }
                }
            }
            let resposta = format!("HTTP/1.1 {situacao} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{corpo}", corpo.len());
            s.write_all(resposta.as_bytes()).unwrap();
            tx.send(String::from_utf8_lossy(&pedido).to_string()).unwrap();
        });
        (url, rx)
    }

    fn escolhido(tipo: TipoProvedor, url: String) -> Escolhido {
        Escolhido {
            provedor: Provedor { id: "x".into(), tipo, nome: "Teste".into(), url, modelo: "modelo-x".into() },
            chave: Some(zeroize::Zeroizing::new("chave-secreta".into())),
        }
    }

    #[test]
    fn conversa_no_formato_claude() {
        let (url, rx) = servidor(200, r#"{"content":[{"type":"thinking","thinking":""},{"type":"text","text":"Oi"}],"stop_reason":"end_turn"}"#);
        let texto = tauri::async_runtime::block_on(completar(&escolhido(TipoProvedor::Claude, url), "sis", "msg")).unwrap();
        assert_eq!(texto, "Oi");
        let pedido = rx.recv().unwrap().to_lowercase();
        assert!(pedido.starts_with("post /v1/messages"));
        assert!(pedido.contains("x-api-key: chave-secreta") && pedido.contains("anthropic-version: 2026-10-21"));
        assert!(pedido.contains(r#""system":"sis""#) && pedido.contains(r#""model":"modelo-x""#));
    }

    #[test]
    fn conversa_no_formato_compativel() {
        let (url, rx) = servidor(200, r#"{"choices":[{"message":{"role":"assistant","content":"Olá"}}]}"#);
        let texto = tauri::async_runtime::block_on(completar(&escolhido(TipoProvedor::Compativel, format!("{url}/v1")), "sis", "msg")).unwrap();
        assert_eq!(texto, "Olá");
        let pedido = rx.recv().unwrap().to_lowercase();
        assert!(pedido.starts_with("post /v1/chat/completions"));
        assert!(pedido.contains("authorization: bearer chave-secreta"));
    }

    #[test]
    fn lista_modelos_e_traduz_chave_recusada() {
        let (url, _rx) = servidor(200, r#"{"data":[{"id":"models/gemini-x"},{"id":"text-embedding-3"},{"id":"gpt-x"}]}"#);
        let modelos = tauri::async_runtime::block_on(listar_modelos(&escolhido(TipoProvedor::Compativel, url))).unwrap();
        assert_eq!(modelos, vec!["gemini-x", "gpt-x"]);
        let (url, _rx) = servidor(401, r#"{"error":{"message":"invalid x-api-key"}}"#);
        let e = tauri::async_runtime::block_on(listar_modelos(&escolhido(TipoProvedor::Claude, url))).unwrap_err();
        assert!(matches!(e, Erro::Ia { motivo: "chave", .. }));
    }

    #[test]
    fn ollama_fechado_tem_aviso_proprio() {
        // Porta fechada no próprio computador.
        let porta = TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
        let e = tauri::async_runtime::block_on(listar_modelos(&escolhido(TipoProvedor::Compativel, format!("http://127.0.0.1:{porta}/v1")))).unwrap_err();
        assert!(matches!(e, Erro::Ia { motivo: "local_fechado", .. }));
    }

    #[test]
    fn situacoes_viram_explicacoes_simples() {
        assert!(matches!(traduzir_situacao(401, ""), Erro::Ia { motivo: "chave", .. }));
        assert!(matches!(traduzir_situacao(429, ""), Erro::Ia { motivo: "limite", .. }));
        assert!(matches!(traduzir_situacao(529, ""), Erro::Ia { motivo: "servidor", .. }));
        let e = traduzir_situacao(400, r#"{"error":{"message":"max_tokens is too large"}}"#);
        assert!(e.to_string().contains("max_tokens is too large"));
    }
}
