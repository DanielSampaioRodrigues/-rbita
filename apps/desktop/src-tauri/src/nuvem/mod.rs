//! Conta Google ou Microsoft da própria pessoa, para guardar a recuperação.
//!
//! O Órbita pede acesso só à pasta escondida do app (Google Drive `appDataFolder`,
//! OneDrive `approot`) e guarda lá dois arquivos: a chave de recuperação (6 palavras)
//! e um backup, que já é criptografado. Não há servidor do Órbita no meio: o login
//! acontece no navegador e volta para o próprio computador (`127.0.0.1`).

mod google;
mod microsoft;
pub mod oauth;

use serde::{Deserialize, Serialize};

use crate::erro::Erro;

/// Nomes dos arquivos na pasta do app.
pub const ARQUIVO_CHAVE: &str = "orbita-chave-de-recuperacao.txt";
pub const ARQUIVO_BACKUP: &str = "orbita.orbita-backup";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProvedorNuvem {
    Google,
    Microsoft,
}

/// Identificadores do Órbita no provedor. Não são segredo de verdade (ficam dentro
/// do programa instalado), mas não vão para o repositório: vêm dos segredos do GitHub.
#[derive(Clone, Copy)]
pub struct Credenciais {
    pub id: &'static str,
    pub segredo: Option<&'static str>,
}

fn nao_vazio(v: Option<&'static str>) -> Option<&'static str> {
    v.filter(|s| !s.trim().is_empty())
}

impl ProvedorNuvem {
    pub fn credenciais(self) -> Option<Credenciais> {
        match self {
            ProvedorNuvem::Google => Some(Credenciais {
                id: nao_vazio(option_env!("ORBITA_GOOGLE_CLIENT_ID"))?,
                segredo: nao_vazio(option_env!("ORBITA_GOOGLE_CLIENT_SECRET")),
            }),
            ProvedorNuvem::Microsoft => Some(Credenciais { id: nao_vazio(option_env!("ORBITA_MICROSOFT_CLIENT_ID"))?, segredo: None }),
        }
    }
}

pub(crate) fn erro(motivo: &'static str, mensagem: impl Into<String>) -> Erro {
    Erro::Nuvem { motivo, mensagem: mensagem.into() }
}

pub(crate) fn falha_de_rede(e: &reqwest::Error) -> Erro {
    if e.is_timeout() {
        erro("rede", "A conexão demorou demais. Confira a internet e tente de novo.")
    } else {
        erro("rede", "Não consegui falar com a conta. Confira a internet e tente de novo.")
    }
}

pub(crate) fn cliente() -> Result<reqwest::Client, Erro> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| Erro::Interno(e.to_string()))
}

/// Resposta com erro do provedor, em linguagem simples.
pub(crate) fn erro_http(status: reqwest::StatusCode) -> Erro {
    match status.as_u16() {
        s @ (401 | 403) => erro("acesso", format!("A conta não deixou o Órbita entrar (código {s}). Pode ser que o acesso tenha sido tirado; desligue e ligue a conta de novo em Ajustes.")),
        429 => erro("limite", "A conta pediu para esperar um pouco. Tente de novo mais tarde."),
        507 => erro("espaco", "Não há espaço livre na conta. Libere espaço no Drive ou OneDrive e tente de novo."),
        s if s >= 500 => erro("servico", "O serviço da conta está com problema agora. Tente de novo mais tarde."),
        s => erro("resposta", format!("A conta respondeu de um jeito inesperado (código {s}). Tente de novo.")),
    }
}

/// Resultado do login: a renovação (guardada no banco criptografado) e qual conta é.
pub struct Conta {
    pub renovacao: String,
    pub email: String,
}

/// Abre o navegador para a pessoa entrar e autorizar; espera ela voltar.
pub async fn entrar(abrir_no_navegador: impl Fn(&str) -> Result<(), Erro>, provedor: ProvedorNuvem) -> Result<Conta, Erro> {
    let cred = provedor.credenciais().ok_or_else(|| erro("indisponivel", "Esta versão do Órbita não tem a conta configurada."))?;
    let porta = oauth::Porta::abrir()?;
    let pkce = oauth::Pkce::novo();
    let estado = oauth::aleatorio_url(24);
    let retorno = porta.endereco(provedor);
    let url = match provedor {
        ProvedorNuvem::Google => google::url_de_entrada(cred.id, &retorno, &pkce.desafio, &estado),
        ProvedorNuvem::Microsoft => microsoft::url_de_entrada(cred.id, &retorno, &pkce.desafio, &estado),
    };
    abrir_no_navegador(&url)?;
    let codigo = porta.esperar_codigo(estado).await?;
    match provedor {
        ProvedorNuvem::Google => google::trocar_codigo(cred, &codigo, &pkce.verificador, &retorno).await,
        ProvedorNuvem::Microsoft => microsoft::trocar_codigo(cred, &codigo, &pkce.verificador, &retorno).await,
    }
}

/// Acesso de curta duração. A Microsoft troca a renovação a cada uso: a nova volta junto.
pub async fn acesso(provedor: ProvedorNuvem, renovacao: &str) -> Result<(String, Option<String>), Erro> {
    let cred = provedor.credenciais().ok_or_else(|| erro("indisponivel", "Esta versão do Órbita não tem a conta configurada."))?;
    match provedor {
        ProvedorNuvem::Google => google::renovar(cred, renovacao).await,
        ProvedorNuvem::Microsoft => microsoft::renovar(cred, renovacao).await,
    }
}

/// Acesso do Google e quantos segundos ele vale (para a sincronização, ver
/// docs/decisoes/0012-sincronizacao.md). A renovação nunca sai do lado nativo.
pub async fn acesso_google(renovacao: &str) -> Result<(String, u64), Erro> {
    let cred = ProvedorNuvem::Google.credenciais().ok_or_else(|| erro("indisponivel", "Esta versão do Órbita não tem a conta configurada."))?;
    google::renovar_com_validade(cred, renovacao).await
}

pub async fn enviar(provedor: ProvedorNuvem, acesso: &str, nome: &str, dados: Vec<u8>) -> Result<(), Erro> {
    match provedor {
        ProvedorNuvem::Google => google::enviar(acesso, nome, dados).await,
        ProvedorNuvem::Microsoft => microsoft::enviar(acesso, nome, dados).await,
    }
}

/// `None` se o arquivo não existe na pasta do app.
pub async fn baixar(provedor: ProvedorNuvem, acesso: &str, nome: &str) -> Result<Option<Vec<u8>>, Erro> {
    match provedor {
        ProvedorNuvem::Google => google::baixar(acesso, nome).await,
        ProvedorNuvem::Microsoft => microsoft::baixar(acesso, nome).await,
    }
}

pub async fn apagar(provedor: ProvedorNuvem, acesso: &str, nome: &str) -> Result<(), Erro> {
    match provedor {
        ProvedorNuvem::Google => google::apagar(acesso, nome).await,
        ProvedorNuvem::Microsoft => microsoft::apagar(acesso, nome).await,
    }
}

/// Tira o acesso do Órbita na conta (só o Google tem um jeito direto; na Microsoft,
/// a pessoa tira pelo site da conta, e a tela explica).
pub async fn revogar(provedor: ProvedorNuvem, renovacao: &str) {
    if provedor == ProvedorNuvem::Google {
        google::revogar(renovacao).await;
    }
}
