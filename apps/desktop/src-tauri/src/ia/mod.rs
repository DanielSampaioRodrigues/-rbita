//! IA opcional. A pessoa cadastra provedores (Claude ou "compatível com GPT":
//! GPT, Gemini, Grok, Sabiá, Ollama) e escolhe um para cada função.
//!
//! As chaves ficam dentro do banco criptografado, numa linha própria de `config`,
//! e nunca voltam para a interface: ela só vê os quatro últimos caracteres.
//! A IA só propõe; quem grava é a interface, depois que a pessoa confirma.
//!
//! Este módulo roda também no navegador, dentro do motor (`crates/motor-web`):
//! `protocolo.rs` e `fluxo.rs` montam os pedidos e conferem as respostas; só o
//! envio muda (`cliente.rs` no Windows, `fetch` no navegador). Ver
//! `docs/decisoes/0013-ia-no-navegador.md`.

// O envio pela rede (reqwest) só existe no Windows; o navegador envia com fetch.
pub mod agente;
pub mod caderno;
#[cfg(not(target_arch = "wasm32"))]
pub mod cliente;
pub mod escrita;
pub mod fluxo;
pub mod organizar;
pub mod planejar;
pub mod protocolo;
pub mod revisar;
pub mod tema;

use std::collections::BTreeMap;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

use crate::banco;
use crate::erro::Erro;

pub(crate) const CONFIG_IA: &str = "ia";
pub(crate) const PREFIXO_CHAVE: &str = "ia_chave:";

/// Funções que podem usar IA, cada uma com o seu provedor.
/// "personalizacao": criar temas e desenhar ícones.
pub const FUNCOES: &[&str] = &["quebrar", "conversa", "revisao", "personalizacao"];

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TipoProvedor {
    /// API da Anthropic.
    Claude,
    /// Formato de conversa da OpenAI, usado também por Gemini, Grok, Sabiá e Ollama.
    Compativel,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Provedor {
    /// Vazio ao criar.
    #[serde(default)]
    pub id: String,
    pub tipo: TipoProvedor,
    /// Nome que a pessoa vê ("Claude", "Gemini", "Ollama"...).
    pub nome: String,
    /// Endereço base da API.
    pub url: String,
    pub modelo: String,
}

impl Provedor {
    /// Roda no próprio computador (Ollama): nada sai do aparelho.
    pub fn local(&self) -> bool {
        endereco_local(&self.url)
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfigIa {
    provedores: Vec<Provedor>,
    /// função -> id do provedor.
    funcoes: BTreeMap<String, String>,
    /// função -> modelo, quando a função usa um modelo diferente do padrão do provedor.
    #[serde(default)]
    modelos: BTreeMap<String, String>,
    bloquear_sensivel: bool,
    /// Configurações de antes da 0.23 não tinham a função "personalizacao".
    #[serde(default)]
    personalizacao_migrada: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvedorVisivel {
    #[serde(flatten)]
    pub provedor: Provedor,
    /// Só os quatro últimos caracteres, para a pessoa reconhecer qual chave é.
    pub final_chave: Option<String>,
    pub local: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EstadoIa {
    pub provedores: Vec<ProvedorVisivel>,
    pub funcoes: BTreeMap<String, String>,
    pub modelos: BTreeMap<String, String>,
    pub bloquear_sensivel: bool,
}

fn endereco_local(url: &str) -> bool {
    let resto = url.trim().trim_start_matches("http://").trim_start_matches("https://");
    let host = resto.split(['/', ':']).next().unwrap_or("");
    matches!(host, "localhost" | "127.0.0.1" | "[::1]")
}

/// Só aceita https, ou http no próprio computador (Ollama). Assim a chave nunca
/// viaja sem criptografia.
fn validar_url(url: &str) -> Result<String, Erro> {
    let url = url.trim().trim_end_matches('/').to_string();
    let ok = url.starts_with("https://") || (url.starts_with("http://") && endereco_local(&url));
    if !ok || url.contains(char::is_whitespace) {
        return Err(Erro::Ia { motivo: "endereco", mensagem: "O endereço precisa começar com https:// (ou ser o próprio computador, para o Ollama).".into() });
    }
    Ok(url)
}

fn ler(conn: &Connection) -> Result<ConfigIa, Erro> {
    Ok(match banco::ler_config(conn, CONFIG_IA)? {
        Some(json) => {
            let mut c: ConfigIa = serde_json::from_str(&json).unwrap_or_default();
            // Quem já usava a IA ganha a função nova com o provedor da revisão (ou o primeiro).
            if !c.personalizacao_migrada {
                let id = c.funcoes.get("revisao").cloned().or_else(|| c.provedores.first().map(|p| p.id.clone()));
                if let Some(id) = id {
                    c.funcoes.entry("personalizacao".into()).or_insert(id);
                }
                c.personalizacao_migrada = true;
            }
            c
        }
        None => ConfigIa { personalizacao_migrada: true, ..ConfigIa::default() },
    })
}

fn gravar(conn: &Connection, config: &ConfigIa) -> Result<(), Erro> {
    let json = serde_json::to_string(config).map_err(|e| Erro::Interno(e.to_string()))?;
    banco::gravar_config(conn, CONFIG_IA, &json)
}

fn ler_chave(conn: &Connection, id: &str) -> Result<Option<Zeroizing<String>>, Erro> {
    Ok(banco::ler_config(conn, &format!("{PREFIXO_CHAVE}{id}"))?.map(Zeroizing::new))
}

pub fn estado(conn: &Connection) -> Result<EstadoIa, Erro> {
    let config = ler(conn)?;
    let mut provedores = Vec::new();
    for p in config.provedores {
        let final_chave = ler_chave(conn, &p.id)?.map(|c| {
            let letras: Vec<char> = c.chars().collect();
            letras[letras.len().saturating_sub(4)..].iter().collect()
        });
        let local = p.local();
        provedores.push(ProvedorVisivel { provedor: p, final_chave, local });
    }
    Ok(EstadoIa { provedores, funcoes: config.funcoes, modelos: config.modelos, bloquear_sensivel: config.bloquear_sensivel })
}

/// Cria ou atualiza um provedor. `chave`: `None` mantém a atual; texto vazio apaga.
pub fn salvar_provedor(conn: &Connection, mut provedor: Provedor, chave: Option<&str>) -> Result<EstadoIa, Erro> {
    provedor.url = validar_url(&provedor.url)?;
    provedor.nome = provedor.nome.trim().to_string();
    provedor.modelo = provedor.modelo.trim().to_string();
    if provedor.nome.is_empty() || provedor.modelo.is_empty() {
        return Err(Erro::TextoVazio);
    }
    let mut config = ler(conn)?;
    if provedor.id.is_empty() {
        provedor.id = uuid::Uuid::now_v7().to_string();
        // O primeiro provedor já vale para todas as funções; a pessoa muda depois.
        if config.provedores.is_empty() {
            for f in FUNCOES {
                config.funcoes.insert(f.to_string(), provedor.id.clone());
            }
        }
        config.provedores.push(provedor.clone());
    } else {
        let atual = config.provedores.iter_mut().find(|p| p.id == provedor.id).ok_or(Erro::NaoEncontrado)?;
        *atual = provedor.clone();
    }
    match chave.map(str::trim) {
        Some("") => banco::apagar_config(conn, &format!("{PREFIXO_CHAVE}{}", provedor.id))?,
        Some(c) => banco::gravar_config(conn, &format!("{PREFIXO_CHAVE}{}", provedor.id), c)?,
        None => {}
    }
    gravar(conn, &config)?;
    estado(conn)
}

pub fn remover_provedor(conn: &Connection, id: &str) -> Result<EstadoIa, Erro> {
    let mut config = ler(conn)?;
    config.provedores.retain(|p| p.id != id);
    config.funcoes.retain(|_, p| p != id);
    let funcoes = config.funcoes.clone();
    config.modelos.retain(|f, _| funcoes.contains_key(f));
    banco::apagar_config(conn, &format!("{PREFIXO_CHAVE}{id}"))?;
    gravar(conn, &config)?;
    estado(conn)
}

/// Provedor e, se quiser, um modelo próprio para a função (`None` ou vazio: o padrão do provedor).
pub fn definir_funcao(conn: &Connection, funcao: &str, provedor_id: Option<&str>, modelo: Option<&str>) -> Result<EstadoIa, Erro> {
    if !FUNCOES.contains(&funcao) {
        return Err(Erro::Interno(format!("função desconhecida: {funcao}")));
    }
    let mut config = ler(conn)?;
    match provedor_id {
        Some(id) if config.provedores.iter().any(|p| p.id == id) => {
            config.funcoes.insert(funcao.into(), id.into());
            match modelo.map(str::trim).filter(|m| !m.is_empty()) {
                Some(m) => config.modelos.insert(funcao.into(), m.into()),
                None => config.modelos.remove(funcao),
            };
        }
        Some(_) => return Err(Erro::NaoEncontrado),
        None => {
            config.funcoes.remove(funcao);
            config.modelos.remove(funcao);
        }
    }
    gravar(conn, &config)?;
    estado(conn)
}

pub fn definir_bloqueio_sensivel(conn: &Connection, bloquear: bool) -> Result<EstadoIa, Erro> {
    let mut config = ler(conn)?;
    config.bloquear_sensivel = bloquear;
    gravar(conn, &config)?;
    estado(conn)
}

/// Provedor e chave prontos para um pedido, lidos com o banco aberto.
/// O pedido em si acontece depois, sem segurar o banco.
pub struct Escolhido {
    pub provedor: Provedor,
    pub chave: Option<Zeroizing<String>>,
}

pub fn provedor_por_id(conn: &Connection, id: &str) -> Result<Escolhido, Erro> {
    let provedor = ler(conn)?.provedores.into_iter().find(|p| p.id == id).ok_or(Erro::NaoEncontrado)?;
    let chave = ler_chave(conn, id)?;
    Ok(Escolhido { provedor, chave })
}

/// Um provedor escolhido na tela para uma função: se for o mesmo da função, vale o modelo dela.
pub fn provedor_para(conn: &Connection, funcao: &str, id: &str) -> Result<Escolhido, Erro> {
    let config = ler(conn)?;
    let mut escolhido = provedor_por_id(conn, id)?;
    if config.funcoes.get(funcao).map(String::as_str) == Some(id) {
        if let Some(m) = config.modelos.get(funcao) {
            escolhido.provedor.modelo = m.clone();
        }
    }
    Ok(escolhido)
}

/// O provedor escolhido para a função. `sensivel`: o pedido leva dados de
/// saúde ou terapia; se a pessoa bloqueou, só um provedor local pode receber.
pub fn provedor_da_funcao(conn: &Connection, funcao: &str, sensivel: bool) -> Result<Escolhido, Erro> {
    let config = ler(conn)?;
    let id = config.funcoes.get(funcao).ok_or(Erro::Ia {
        motivo: "sem_provedor",
        mensagem: "Nenhum provedor de IA está escolhido para esta função. Dá para escolher em Ajustes, na parte de IA.".into(),
    })?;
    let mut escolhido = provedor_por_id(conn, id)?;
    if let Some(m) = config.modelos.get(funcao) {
        escolhido.provedor.modelo = m.clone();
    }
    if sensivel && config.bloquear_sensivel && !escolhido.provedor.local() {
        return Err(Erro::Ia {
            motivo: "sensivel_bloqueado",
            mensagem: "Você bloqueou o envio de dados de saúde e terapia para provedores de fora do aparelho.".into(),
        });
    }
    Ok(escolhido)
}

/// Memória do computador em GB, para recomendar o tamanho do modelo local.
pub fn memoria_gb() -> Option<f64> {
    #[cfg(windows)]
    {
        use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
        let mut m = MEMORYSTATUSEX { dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32, ..Default::default() };
        unsafe { GlobalMemoryStatusEx(&mut m) }.ok()?;
        Some(m.ullTotalPhys as f64 / 1024f64.powi(3))
    }
    #[cfg(target_os = "linux")]
    {
        let texto = std::fs::read_to_string("/proc/meminfo").ok()?;
        let kb: f64 = texto.lines().find(|l| l.starts_with("MemTotal:"))?.split_whitespace().nth(1)?.parse().ok()?;
        Some(kb / 1024f64.powi(2))
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        None
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::testes::banco_de_teste;

    fn claude() -> Provedor {
        Provedor {
            id: String::new(),
            tipo: TipoProvedor::Claude,
            nome: "Claude".into(),
            url: "https://api.anthropic.com/".into(),
            modelo: "claude-opus-5-5".into(),
        }
    }

    #[test]
    fn a_chave_fica_guardada_mas_nunca_volta_inteira() {
        let (_pasta, conn) = banco_de_teste();
        let e = salvar_provedor(&conn, claude(), Some("sk-ant-segredo-1234")).unwrap();
        let p = &e.provedores[0];
        assert_eq!(p.final_chave.as_deref(), Some("1234"));
        assert_eq!(p.provedor.url, "https://api.anthropic.com");
        assert!(!serde_json::to_string(&e).unwrap().contains("segredo"));
        // O primeiro provedor vale para todas as funções.
        assert_eq!(e.funcoes.len(), FUNCOES.len());
        let escolhido = provedor_da_funcao(&conn, "quebrar", false).unwrap();
        assert_eq!(escolhido.chave.as_deref().map(String::as_str), Some("sk-ant-segredo-1234"));
        // Editar sem mandar chave mantém a chave.
        let mut editado = escolhido.provedor.clone();
        editado.modelo = "claude-haiku-5-5".into();
        let e = salvar_provedor(&conn, editado, None).unwrap();
        assert_eq!(e.provedores[0].final_chave.as_deref(), Some("1234"));
        // Remover apaga a chave e solta as funções.
        let id = e.provedores[0].provedor.id.clone();
        let e = remover_provedor(&conn, &id).unwrap();
        assert!(e.provedores.is_empty() && e.funcoes.is_empty());
        assert!(ler_chave(&conn, &id).unwrap().is_none());
    }

    #[test]
    fn so_aceita_https_ou_o_proprio_computador() {
        assert!(validar_url("http://exemplo.com/v1").is_err());
        assert!(validar_url("ftp://exemplo.com").is_err());
        assert_eq!(validar_url("http://localhost:11434/v1/").unwrap(), "http://localhost:11434/v1");
        assert!(validar_url("http://127.0.0.1:11434/v1").is_ok());
        assert!(validar_url("https://api.openai.com/v1").is_ok());
        assert!(validar_url("http://localhost.exemplo.com/v1").is_err());
    }

    #[test]
    fn dados_sensiveis_bloqueados_so_vao_para_ia_local() {
        let (_pasta, conn) = banco_de_teste();
        salvar_provedor(&conn, claude(), Some("k")).unwrap();
        definir_bloqueio_sensivel(&conn, true).unwrap();
        assert!(provedor_da_funcao(&conn, "conversa", false).is_ok());
        assert!(matches!(provedor_da_funcao(&conn, "conversa", true), Err(Erro::Ia { motivo: "sensivel_bloqueado", .. })));
        let ollama = Provedor { tipo: TipoProvedor::Compativel, nome: "Ollama".into(), url: "http://localhost:11434/v1".into(), ..claude() };
        let e = salvar_provedor(&conn, ollama, None).unwrap();
        let id = e.provedores[1].provedor.id.clone();
        definir_funcao(&conn, "conversa", Some(&id), None).unwrap();
        assert!(provedor_da_funcao(&conn, "conversa", true).is_ok());
        definir_funcao(&conn, "conversa", None, None).unwrap();
        assert!(matches!(provedor_da_funcao(&conn, "conversa", false), Err(Erro::Ia { motivo: "sem_provedor", .. })));
    }

    #[test]
    fn cada_funcao_pode_ter_seu_modelo() {
        let (_pasta, conn) = banco_de_teste();
        let e = salvar_provedor(&conn, claude(), Some("k")).unwrap();
        let id = e.provedores[0].provedor.id.clone();
        let padrao = e.provedores[0].provedor.modelo.clone();
        definir_funcao(&conn, "revisao", Some(&id), Some("claude-haiku-5-5")).unwrap();
        assert_eq!(provedor_da_funcao(&conn, "revisao", false).unwrap().provedor.modelo, "claude-haiku-5-5");
        assert_eq!(provedor_da_funcao(&conn, "quebrar", false).unwrap().provedor.modelo, padrao);
        // Sem modelo: volta ao padrão do provedor.
        definir_funcao(&conn, "revisao", Some(&id), Some("  ")).unwrap();
        assert_eq!(provedor_da_funcao(&conn, "revisao", false).unwrap().provedor.modelo, padrao);
        definir_funcao(&conn, "revisao", Some(&id), Some("claude-haiku-5-5")).unwrap();
        let e = remover_provedor(&conn, &id).unwrap();
        assert!(e.modelos.is_empty() && e.funcoes.is_empty());
    }
}
