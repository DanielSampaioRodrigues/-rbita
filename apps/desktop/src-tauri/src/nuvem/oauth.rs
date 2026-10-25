//! Login no navegador com retorno para o próprio computador (OAuth 2 com PKCE).
//! O Órbita abre uma porta só em `127.0.0.1`, recebe o código uma vez e fecha.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::{Duration, Instant};

use base64::Engine;
use rand::RngCore;
use sha2::{Digest, Sha256};

use super::{erro, ProvedorNuvem};
use crate::erro::Erro;

/// Tempo para a pessoa entrar e autorizar no navegador.
const TEMPO_PARA_ENTRAR: Duration = Duration::from_secs(5 * 60);

pub fn aleatorio_url(bytes: usize) -> String {
    let mut b = vec![0u8; bytes];
    rand::thread_rng().fill_bytes(&mut b);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b)
}

pub struct Pkce {
    pub verificador: String,
    pub desafio: String,
}

impl Pkce {
    pub fn novo() -> Self {
        let verificador = aleatorio_url(48);
        let desafio = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(verificador.as_bytes()));
        Self { verificador, desafio }
    }
}

/// O que o navegador devolveu na primeira linha do pedido ("GET /?code=...&state=... HTTP/1.1").
#[derive(Debug, PartialEq)]
pub enum Retorno {
    Codigo(String),
    Recusado,
    /// Outro pedido (por exemplo, o ícone da página): ignorar e continuar esperando.
    Outro,
}

pub fn ler_retorno(primeira_linha: &str, estado_esperado: &str) -> Result<Retorno, Erro> {
    let caminho = primeira_linha.split_whitespace().nth(1).unwrap_or("/");
    let Ok(url) = reqwest::Url::parse(&format!("http://127.0.0.1{caminho}")) else { return Ok(Retorno::Outro) };
    let par = |nome: &str| url.query_pairs().find(|(k, _)| k == nome).map(|(_, v)| v.into_owned());
    if par("error").is_some() {
        return Ok(Retorno::Recusado);
    }
    match (par("code"), par("state")) {
        (Some(codigo), Some(estado)) if estado == estado_esperado => Ok(Retorno::Codigo(codigo)),
        (Some(_), _) => Err(erro("estado", "O retorno do navegador não confere. Tente entrar de novo.")),
        _ => Ok(Retorno::Outro),
    }
}

const PAGINA: &str = r#"<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Órbita</title>
<style>body{font:18px/1.6 system-ui,sans-serif;background:#f4f1ea;color:#22252a;display:grid;place-items:center;min-height:90vh;margin:0}
main{max-width:30rem;padding:2rem;text-align:center}@media(prefers-color-scheme:dark){body{background:#15181b;color:#e8eae6}}</style>
<main><h1>TITULO</h1><p>TEXTO</p></main></html>"#;

fn responder(mut conexao: TcpStream, titulo: &str, texto: &str) {
    let corpo = PAGINA.replace("TITULO", titulo).replace("TEXTO", texto);
    let _ = write!(conexao, "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{corpo}", corpo.len());
}

fn primeira_linha(conexao: &mut TcpStream) -> Option<String> {
    conexao.set_read_timeout(Some(Duration::from_secs(5))).ok()?;
    let mut buf = Vec::new();
    let mut pedaco = [0u8; 1024];
    while !buf.windows(2).any(|w| w == b"\r\n") && buf.len() < 16 * 1024 {
        let n = conexao.read(&mut pedaco).ok()?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&pedaco[..n]);
    }
    let texto = String::from_utf8_lossy(&buf);
    texto.lines().next().map(str::to_string)
}

/// Porta local aberta para receber o retorno do login.
pub struct Porta {
    escuta: TcpListener,
}

impl Porta {
    pub fn abrir() -> Result<Self, Erro> {
        let escuta = TcpListener::bind("127.0.0.1:0").map_err(|e| Erro::Interno(format!("porta local: {e}")))?;
        escuta.set_nonblocking(true).map_err(|e| Erro::Interno(e.to_string()))?;
        Ok(Self { escuta })
    }

    /// O Google aceita `127.0.0.1`; a Microsoft pede `localhost` (a porta pode variar nos dois).
    pub fn endereco(&self, provedor: ProvedorNuvem) -> String {
        let porta = self.escuta.local_addr().map(|a| a.port()).unwrap_or(0);
        match provedor {
            ProvedorNuvem::Google => format!("http://127.0.0.1:{porta}"),
            ProvedorNuvem::Microsoft => format!("http://localhost:{porta}"),
        }
    }

    pub async fn esperar_codigo(self, estado: String) -> Result<String, Erro> {
        tauri::async_runtime::spawn_blocking(move || self.esperar(&estado))
            .await
            .map_err(|e| Erro::Interno(e.to_string()))?
    }

    fn esperar(&self, estado: &str) -> Result<String, Erro> {
        let limite = Instant::now() + TEMPO_PARA_ENTRAR;
        while Instant::now() < limite {
            match self.escuta.accept() {
                Ok((mut conexao, _)) => {
                    let _ = conexao.set_nonblocking(false);
                    let Some(linha) = primeira_linha(&mut conexao) else { continue };
                    match ler_retorno(&linha, estado)? {
                        Retorno::Codigo(c) => {
                            responder(conexao, "Pronto", "Pode fechar esta aba e voltar ao Órbita.");
                            return Ok(c);
                        }
                        Retorno::Recusado => {
                            responder(conexao, "Tudo bem", "Nada foi ligado. Pode fechar esta aba e voltar ao Órbita.");
                            return Err(erro("cancelado", "A entrada na conta foi cancelada. Nada foi ligado."));
                        }
                        Retorno::Outro => {
                            let _ = conexao.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                        }
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(150)),
                Err(e) => return Err(Erro::Interno(format!("porta local: {e}"))),
            }
        }
        Err(erro("tempo", "Passaram 5 minutos sem a entrada na conta terminar. Tente de novo quando quiser."))
    }
}

/// Lê o e-mail de dentro do `id_token` (veio direto do provedor, por conexão segura).
pub fn email_do_id_token(id_token: &str) -> Option<String> {
    let meio = id_token.split('.').nth(1)?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(meio.trim_end_matches('=')).ok()?;
    let v: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    v.get("email").or_else(|| v.get("preferred_username")).and_then(|e| e.as_str()).map(str::to_string)
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn pkce_segue_a_regra_s256() {
        let p = Pkce::novo();
        assert!(p.verificador.len() >= 43 && p.verificador.len() <= 128);
        let esperado = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(p.verificador.as_bytes()));
        assert_eq!(p.desafio, esperado);
        assert_ne!(Pkce::novo().verificador, p.verificador);
    }

    #[test]
    fn le_o_retorno_do_navegador() {
        assert_eq!(ler_retorno("GET /?code=4%2F0Ab&state=xyz&scope=a HTTP/1.1", "xyz").unwrap(), Retorno::Codigo("4/0Ab".into()));
        assert_eq!(ler_retorno("GET /?error=access_denied&state=xyz HTTP/1.1", "xyz").unwrap(), Retorno::Recusado);
        assert_eq!(ler_retorno("GET /favicon.ico HTTP/1.1", "xyz").unwrap(), Retorno::Outro);
        assert!(ler_retorno("GET /?code=abc&state=outro HTTP/1.1", "xyz").is_err());
    }

    #[test]
    fn email_sai_do_id_token() {
        let carga = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(br#"{"email":"dan@exemplo.com","sub":"1"}"#);
        assert_eq!(email_do_id_token(&format!("cab.{carga}.ass")).as_deref(), Some("dan@exemplo.com"));
        assert_eq!(email_do_id_token("lixo"), None);
    }

    #[test]
    fn porta_local_recebe_o_codigo() {
        let porta = Porta::abrir().unwrap();
        let endereco = porta.endereco(ProvedorNuvem::Google).replace("http://", "");
        let navegador = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(200));
            let mut c = TcpStream::connect(&endereco).unwrap();
            c.write_all(b"GET /favicon.ico HTTP/1.1\r\n\r\n").unwrap();
            let mut c = TcpStream::connect(&endereco).unwrap();
            c.write_all(b"GET /?code=abc&state=e1 HTTP/1.1\r\nHost: x\r\n\r\n").unwrap();
            let mut resposta = String::new();
            let _ = c.read_to_string(&mut resposta);
            resposta
        });
        assert_eq!(porta.esperar("e1").unwrap(), "abc");
        assert!(navegador.join().unwrap().contains("voltar ao Órbita"));
    }
}
