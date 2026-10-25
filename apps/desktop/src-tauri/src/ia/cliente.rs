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
    let detalhe = serde_json::from_str::<Value>(corpo)
        .ok()
        .and_then(|v| v.pointer("/error/message").and_then(Value::as_str).map(str::to_string))
        .unwrap_or_default();
    // A OpenAI só libera os modelos de imagem para organizações verificadas.
    if situacao == 403 && detalhe.to_lowercase().contains("verif") {
        return erro(
            "verificar",
            "A OpenAI só libera este modelo de imagem para contas verificadas. Verifique a sua organização em platform.openai.com (Settings > Organization > General) e tente de novo depois de alguns minutos.",
        );
    }
    match situacao {
        401 | 403 => erro("chave", "O provedor não aceitou a chave. Confira se ela foi colada inteira."),
        402 | 429 => erro("limite", "O provedor recusou por limite de uso ou falta de créditos. Confira a sua conta ou tente mais tarde."),
        404 => erro("modelo", "O provedor não encontrou esse modelo. Escolha outro na lista."),
        500..=599 => erro("servidor", "O provedor está com problema agora. Tente de novo daqui a pouco."),
        _ => {
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
/// `alta`: resolução maior (mais demorada e mais cara). Cada empresa entende de um jeito.
pub async fn gerar_imagem(e: &Escolhido, modelo: &str, pedido: &str, alta: bool) -> Result<String, Erro> {
    if e.provedor.tipo != TipoProvedor::Compativel {
        return Err(erro("sem_imagem", "Este provedor não gera imagens. Dá para criar o tema com desenho em SVG."));
    }
    // Os modelos de imagem do Gemini ("gemini-...-image") não existem no formato compatível:
    // só respondem pelo formato próprio do Google. Os "imagen" funcionam no compatível.
    if let Some(nativo) = e.provedor.url.trim_end_matches('/').strip_suffix("/openai") {
        if !modelo.starts_with("imagen") {
            // Nem todo modelo aceita escolher o tamanho; se recusar, tenta de novo sem.
            return match gerar_imagem_gemini(e, nativo, modelo, pedido, alta).await {
                Err(Erro::Ia { motivo: "outro", .. }) if alta => gerar_imagem_gemini(e, nativo, modelo, pedido, false).await,
                r => r,
            };
        }
    }
    let mut corpo = json!({ "model": modelo, "prompt": pedido, "n": 1 });
    if modelo.contains("gpt-image") {
        // "gpt-image" e "chatgpt-image" sempre devolvem a imagem pronta e recusam "response_format".
        // Deitada, porque é fundo de janela.
        corpo["size"] = json!("1536x1024");
        corpo["quality"] = json!(if alta { "high" } else { "medium" });
    } else {
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

/// Imagem pelos modelos "gemini-...-image", no formato próprio do Google (generateContent).
async fn gerar_imagem_gemini(e: &Escolhido, base: &str, modelo: &str, pedido: &str, alta: bool) -> Result<String, Erro> {
    let mut config = json!({ "aspectRatio": "16:9" });
    if alta {
        config["imageSize"] = json!("2K");
    }
    let corpo = json!({
        "contents": [{ "parts": [{ "text": pedido }] }],
        "generationConfig": { "responseModalities": ["TEXT", "IMAGE"], "imageConfig": config },
    });
    let mut requisicao = cliente()?.post(format!("{base}/models/{modelo}:generateContent")).json(&corpo);
    if let Some(c) = &e.chave {
        requisicao = requisicao.header("x-goog-api-key", c.as_str());
    }
    let v = enviar(requisicao, false).await?;
    let partes = v.pointer("/candidates/0/content/parts").and_then(Value::as_array).cloned().unwrap_or_default();
    for parte in partes {
        let dados = parte.get("inlineData").or_else(|| parte.get("inline_data"));
        if let Some(b64) = dados.and_then(|d| d["data"].as_str()) {
            let tipo = dados.and_then(|d| d["mimeType"].as_str().or(d["mime_type"].as_str())).unwrap_or("image/png");
            return Ok(format!("data:{tipo};base64,{b64}"));
        }
    }
    if v.pointer("/promptFeedback/blockReason").is_some() || v.pointer("/candidates/0/finishReason").and_then(Value::as_str) == Some("SAFETY") {
        return Err(erro("recusa", "O modelo preferiu não desenhar esta imagem. Tente descrever o tema de outro jeito."));
    }
    Err(erro("resposta", "A imagem não veio na resposta. Tente de novo ou escolha outro modelo de imagem."))
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
    fn imagem_do_gemini_usa_o_formato_do_google() {
        let (url, rx) = servidor(200, r#"{"candidates":[{"content":{"parts":[{"text":"Aqui"},{"inlineData":{"mimeType":"image/jpeg","data":"QUJD"}}]}}]}"#);
        let e = escolhido(TipoProvedor::Compativel, format!("{url}/v1beta/openai/"));
        let imagem = tauri::async_runtime::block_on(gerar_imagem(&e, "gemini-3-pro-image-preview", "floresta", true)).unwrap();
        assert_eq!(imagem, "data:image/jpeg;base64,QUJD");
        let pedido = rx.recv().unwrap().to_lowercase();
        assert!(pedido.starts_with("post /v1beta/models/gemini-3-pro-image-preview:generatecontent"));
        assert!(pedido.contains("x-goog-api-key: chave-secreta") && !pedido.contains("authorization"));
        assert!(pedido.contains(r#""responsemodalities":["text","image"]"#));
        assert!(pedido.contains(r#""aspectratio":"16:9""#) && pedido.contains(r#""imagesize":"2k""#));
    }

    #[test]
    fn imagem_da_openai_sem_response_format() {
        for modelo in ["gpt-image-2", "chatgpt-image-latest"] {
            let (url, rx) = servidor(200, r#"{"data":[{"b64_json":"QUJD"}]}"#);
            let imagem = tauri::async_runtime::block_on(gerar_imagem(&escolhido(TipoProvedor::Compativel, format!("{url}/v1")), modelo, "x", false)).unwrap();
            assert_eq!(imagem, "data:image/png;base64,QUJD");
            let pedido = rx.recv().unwrap();
            assert!(!pedido.contains("response_format") && pedido.contains(r#""size":"1536x1024""#) && pedido.contains(r#""quality":"medium""#));
        }
        let e = traduzir_situacao(403, r#"{"error":{"message":"Your organization must be verified to use the model `gpt-image-2`."}}"#);
        assert!(matches!(e, Erro::Ia { motivo: "verificar", .. }));
    }

    #[test]
    fn imagen_do_gemini_segue_no_formato_compativel() {
        let (url, rx) = servidor(200, r#"{"data":[{"b64_json":"QUJD"}]}"#);
        let e = escolhido(TipoProvedor::Compativel, format!("{url}/v1beta/openai"));
        let imagem = tauri::async_runtime::block_on(gerar_imagem(&e, "imagen-4.0-generate-001", "floresta", false)).unwrap();
        assert_eq!(imagem, "data:image/png;base64,QUJD");
        assert!(rx.recv().unwrap().to_lowercase().starts_with("post /v1beta/openai/images/generations"));
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
