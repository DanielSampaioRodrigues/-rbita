//! Envia os pedidos de IA no Windows (reqwest). O que vai em cada pedido e como
//! ler a resposta ficam em `protocolo.rs` e `fluxo.rs`, os mesmos do navegador.

use std::time::Duration;

use super::protocolo::{self, Pedido};
use crate::erro::Erro;

/// Modelos locais podem demorar bastante no primeiro pedido (carregam na memória).
const TEMPO_LIMITE: Duration = Duration::from_secs(180);

fn cliente() -> Result<reqwest::Client, Erro> {
    reqwest::Client::builder()
        .timeout(TEMPO_LIMITE)
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| Erro::Interno(e.to_string()))
}

/// Envia o pedido e devolve a situação HTTP e o corpo (em base64, se `binario`).
/// Só falha quando o pedido nem chega ao provedor.
pub async fn enviar(p: &Pedido) -> Result<(u16, String), Erro> {
    let falha = |e: reqwest::Error| protocolo::falha_de_rede(p, e.is_timeout(), false, false);
    let mut pedido = match p.metodo {
        "POST" => cliente()?.post(&p.url),
        _ => cliente()?.get(&p.url),
    };
    for (nome, valor) in &p.cabecalhos {
        pedido = pedido.header(nome.as_str(), valor.as_str());
    }
    if let Some(corpo) = &p.corpo {
        pedido = pedido.body(corpo.clone());
    }
    let resposta = pedido.send().await.map_err(falha)?;
    let situacao = resposta.status().as_u16();
    let corpo = if p.binario {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.encode(resposta.bytes().await.map_err(falha)?)
    } else {
        resposta.text().await.map_err(falha)?
    };
    Ok((situacao, corpo))
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::ia::protocolo::Imagem;
    use crate::ia::{Escolhido, Provedor, TipoProvedor};
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

    // Os mesmos passos que as ordens fazem (fluxo.rs), mas sem banco.
    async fn completar(e: &Escolhido, sistema: &str, mensagem: &str) -> Result<String, Erro> {
        let (situacao, corpo) = enviar(&protocolo::pedido_completar(e, sistema, mensagem)).await?;
        protocolo::ler_completar(e.provedor.tipo, &protocolo::ler_resposta(situacao, &corpo)?)
    }

    async fn listar_modelos(e: &Escolhido) -> Result<Vec<String>, Erro> {
        let (situacao, corpo) = enviar(&protocolo::pedido_modelos(e)).await?;
        Ok(protocolo::ler_modelos_de_conversa(&protocolo::ler_resposta(situacao, &corpo)?))
    }

    async fn gerar_imagem(e: &Escolhido, modelo: &str, pedido: &str, alta: bool) -> Result<String, Erro> {
        let (p, formato) = protocolo::pedido_imagem(e, modelo, pedido, alta)?;
        let (situacao, corpo) = enviar(&p).await?;
        match protocolo::ler_imagem(&protocolo::ler_resposta(situacao, &corpo)?, formato)? {
            Imagem::Pronta(d) => Ok(d),
            Imagem::Baixar(url) => Ok(format!("data:image/png;base64,{}", enviar(&protocolo::pedido_baixar(&url)).await?.1)),
        }
    }

    #[test]
    fn imagem_por_link_e_baixada_em_base64() {
        let (url, _rx) = servidor(200, "ABC");
        let (situacao, corpo) = tauri::async_runtime::block_on(enviar(&protocolo::pedido_baixar(&format!("{url}/a.png")))).unwrap();
        assert_eq!((situacao, corpo.as_str()), (200, "QUJD"));
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
        let e = protocolo::traduzir_situacao(403, r#"{"error":{"message":"Your organization must be verified to use the model `gpt-image-2`."}}"#);
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
}
