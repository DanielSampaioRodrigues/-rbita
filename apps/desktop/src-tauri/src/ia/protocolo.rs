//! Como falar com cada provedor, sem a parte de rede: monta o pedido (endereço,
//! cabeçalhos e corpo) e lê a resposta. Dois formatos: o da Anthropic (Claude) e
//! o "compatível com GPT", que serve para GPT, Gemini, Grok, Sabiá e Ollama.
//!
//! Quem envia é outro código: no Windows, `cliente.rs` (reqwest); no navegador,
//! `apps/desktop/src/web/iaWeb.ts` (fetch). Assim os dois lados mandam
//! exatamente o mesmo pedido. Ver `docs/decisoes/0013-ia-no-navegador.md`.

use serde::Serialize;
use serde_json::{json, Value};

use super::{Escolhido, TipoProvedor};
use crate::erro::Erro;

const VERSAO_ANTHROPIC: &str = "2026-10-21";

/// Um pedido pronto para enviar. Os cabeçalhos levam a chave: nunca vai para a
/// tela nem para registro (o `Debug` esconde os cabeçalhos).
#[derive(Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Pedido {
    /// "GET" ou "POST".
    pub metodo: &'static str,
    pub url: String,
    pub cabecalhos: Vec<(String, String)>,
    /// Corpo em JSON (só no POST).
    pub corpo: Option<String>,
    /// A resposta é um arquivo (imagem), não JSON: quem envia devolve os bytes em base64.
    pub binario: bool,
    /// Vai para o próprio aparelho (Ollama): muda a explicação quando não responde.
    pub local: bool,
}

impl std::fmt::Debug for Pedido {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Pedido").field("metodo", &self.metodo).field("url", &self.url).field("binario", &self.binario).finish_non_exhaustive()
    }
}

pub(crate) fn erro(motivo: &'static str, mensagem: &str) -> Erro {
    Erro::Ia { motivo, mensagem: mensagem.into() }
}

fn com_chave(e: &Escolhido) -> Vec<(String, String)> {
    let mut c = Vec::new();
    match e.provedor.tipo {
        TipoProvedor::Claude => {
            if let Some(k) = &e.chave {
                c.push(("x-api-key".into(), k.as_str().into()));
            }
            c.push(("anthropic-version".into(), VERSAO_ANTHROPIC.into()));
            // A Anthropic só aceita pedidos vindos de uma página (versão de navegador)
            // com este aviso; fora do navegador ele não muda nada.
            c.push(("anthropic-dangerous-direct-browser-access".into(), "true".into()));
        }
        TipoProvedor::Compativel => {
            if let Some(k) = &e.chave {
                c.push(("authorization".into(), format!("Bearer {}", k.as_str())));
            }
        }
    }
    c
}

fn get(e: &Escolhido, url: String) -> Pedido {
    Pedido { metodo: "GET", url, cabecalhos: com_chave(e), corpo: None, binario: false, local: e.provedor.local() }
}

fn post(e: &Escolhido, url: String, corpo: &Value) -> Pedido {
    let mut cabecalhos = com_chave(e);
    cabecalhos.push(("content-type".into(), "application/json".into()));
    Pedido { metodo: "POST", url, cabecalhos, corpo: Some(corpo.to_string()), binario: false, local: e.provedor.local() }
}

/// Converte a situação HTTP numa explicação simples. O texto do provedor
/// fica só para o caso que não reconhecemos.
pub fn traduzir_situacao(situacao: u16, corpo: &str) -> Erro {
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
        _ => Erro::Ia { motivo: "outro", mensagem: format!("O provedor recusou o pedido ({situacao}). {detalhe}").trim().to_string() },
    }
}

/// Confere a situação e lê o JSON da resposta.
pub fn ler_resposta(situacao: u16, corpo: &str) -> Result<Value, Erro> {
    if !(200..300).contains(&situacao) {
        return Err(traduzir_situacao(situacao, corpo));
    }
    serde_json::from_str(corpo).map_err(|_| erro("resposta", "A resposta veio num formato que não entendi. Tente de novo."))
}

/// Quando o pedido nem chegou ao provedor. `demorou`: passou do tempo limite.
/// `navegador`: o pedido saiu de uma página (versão de navegador), onde a falta
/// de internet e o bloqueio do provedor ao navegador parecem iguais.
pub fn falha_de_rede(pedido: &Pedido, demorou: bool, navegador: bool, sem_internet: bool) -> Erro {
    falha_de_rede_em(&pedido.url, pedido.local, demorou, navegador, sem_internet)
}

/// O mesmo que `falha_de_rede`, só com o endereço e se ele é o próprio aparelho.
pub fn falha_de_rede_em(url: &str, local: bool, demorou: bool, navegador: bool, sem_internet: bool) -> Erro {
    if demorou {
        return erro("demora", "O provedor demorou demais para responder. Tente de novo daqui a pouco.");
    }
    if sem_internet {
        return erro("rede", "Este aparelho está sem internet. Confira a conexão e tente de novo.");
    }
    if local {
        return if navegador {
            erro(
                "local_fechado",
                "O Ollama não respondeu. Confira se ele está aberto neste aparelho e se foi liberado para o navegador: antes de abrir o Ollama, crie a variável de ambiente OLLAMA_ORIGINS com o endereço do Órbita (https://danielsampaiorodrigues.github.io). No iPad, o Ollama não roda: use outro provedor.",
            )
        } else {
            erro("local_fechado", "O Ollama não respondeu. Confira se ele está instalado e aberto.")
        };
    }
    if navegador {
        if bloqueia_navegador(url) {
            return erro(
                "navegador",
                "Este provedor não aceita ser chamado pelo navegador. Na versão de navegador, use outro provedor (Claude, GPT, Gemini ou Grok), ou use este no app do Windows.",
            );
        }
        return erro(
            "rede",
            "Não consegui falar com o provedor. Confira a conexão com a internet. Se ela estiver funcionando, este provedor pode não aceitar ser chamado pelo navegador: use outro (Claude, GPT, Gemini ou Grok) ou o app do Windows.",
        );
    }
    erro("rede", "Não consegui falar com o provedor. Confira a conexão com a internet.")
}

/// Provedores conhecidos que recusam pedidos vindos de uma página (sem CORS).
fn bloqueia_navegador(url: &str) -> bool {
    let resto = url.trim_start_matches("https://").trim_start_matches("http://");
    let host = resto.split(['/', ':']).next().unwrap_or("");
    host == "maritaca.ai" || host.ends_with(".maritaca.ai")
}

/// Lista os modelos do provedor. Serve também de teste da chave, sem custo.
pub fn pedido_modelos(e: &Escolhido) -> Pedido {
    let url = match e.provedor.tipo {
        TipoProvedor::Claude => format!("{}/v1/models?limit=100", e.provedor.url),
        TipoProvedor::Compativel => format!("{}/models", e.provedor.url),
    };
    get(e, url)
}

/// Todos os modelos da resposta, sem filtro (para achar os de imagem).
pub fn ler_todos_modelos(v: &Value) -> Vec<String> {
    v["data"]
        .as_array()
        .map(|l| l.iter().filter_map(|m| m["id"].as_str().map(|s| s.trim_start_matches("models/").to_string())).collect())
        .unwrap_or_default()
}

/// Só os modelos que conversam (Gemini lista também modelos de imagem e de busca).
pub fn ler_modelos_de_conversa(v: &Value) -> Vec<String> {
    let mut modelos = ler_todos_modelos(v);
    modelos.retain(|m| !m.contains("embedding") && !m.contains("tts") && !m.contains("image"));
    modelos
}

/// Um pedido de uma mensagem só, com instruções de sistema.
pub fn pedido_completar(e: &Escolhido, sistema: &str, mensagem: &str) -> Pedido {
    match e.provedor.tipo {
        TipoProvedor::Claude => {
            let corpo = json!({
                "model": e.provedor.modelo,
                "max_tokens": 16000,
                "system": sistema,
                "messages": [{ "role": "user", "content": mensagem }],
            });
            post(e, format!("{}/v1/messages", e.provedor.url), &corpo)
        }
        TipoProvedor::Compativel => {
            let corpo = json!({
                "model": e.provedor.modelo,
                "messages": [
                    { "role": "system", "content": sistema },
                    { "role": "user", "content": mensagem },
                ],
            });
            post(e, format!("{}/chat/completions", e.provedor.url), &corpo)
        }
    }
}

/// O texto da resposta de `pedido_completar`.
pub fn ler_completar(tipo: TipoProvedor, v: &Value) -> Result<String, Erro> {
    match tipo {
        TipoProvedor::Claude => {
            if v["stop_reason"] == "refusal" {
                return Err(erro("recusa", "O modelo preferiu não responder a este pedido."));
            }
            Ok(v["content"]
                .as_array()
                .map(|blocos| blocos.iter().filter(|b| b["type"] == "text").filter_map(|b| b["text"].as_str()).collect())
                .unwrap_or_default())
        }
        TipoProvedor::Compativel => v
            .pointer("/choices/0/message/content")
            .and_then(Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| erro("resposta", "A resposta veio num formato que não entendi. Tente de novo.")),
    }
}

/// Qual formato de imagem o pedido usou (cada um responde de um jeito).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FormatoImagem {
    /// /images/generations (GPT, Grok, Imagen do Gemini).
    Compativel,
    /// generateContent, o formato próprio do Google (modelos "gemini-...-image").
    Gemini,
}

/// Gera uma imagem. `alta`: resolução maior (mais demorada e mais cara); cada
/// empresa entende de um jeito.
pub fn pedido_imagem(e: &Escolhido, modelo: &str, pedido: &str, alta: bool) -> Result<(Pedido, FormatoImagem), Erro> {
    if e.provedor.tipo != TipoProvedor::Compativel {
        return Err(erro("sem_imagem", "Este provedor não gera imagens. Dá para criar o tema com desenho em SVG."));
    }
    // Os modelos de imagem do Gemini ("gemini-...-image") não existem no formato compatível:
    // só respondem pelo formato próprio do Google. Os "imagen" funcionam no compatível.
    if let Some(nativo) = e.provedor.url.trim_end_matches('/').strip_suffix("/openai") {
        if !modelo.starts_with("imagen") {
            let mut config = json!({ "aspectRatio": "16:9" });
            if alta {
                config["imageSize"] = json!("2K");
            }
            let corpo = json!({
                "contents": [{ "parts": [{ "text": pedido }] }],
                "generationConfig": { "responseModalities": ["TEXT", "IMAGE"], "imageConfig": config },
            });
            let mut cabecalhos = vec![("content-type".to_string(), "application/json".to_string())];
            if let Some(c) = &e.chave {
                cabecalhos.push(("x-goog-api-key".into(), c.as_str().into()));
            }
            let p = Pedido { metodo: "POST", url: format!("{nativo}/models/{modelo}:generateContent"), cabecalhos, corpo: Some(corpo.to_string()), binario: false, local: false };
            return Ok((p, FormatoImagem::Gemini));
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
    Ok((post(e, format!("{}/images/generations", e.provedor.url), &corpo), FormatoImagem::Compativel))
}

/// O que veio no lugar da imagem.
#[derive(Debug, PartialEq)]
pub enum Imagem {
    /// Endereço de dados pronto (data:image/...;base64,...).
    Pronta(String),
    /// Só veio um endereço: é preciso baixar a imagem.
    Baixar(String),
}

pub fn ler_imagem(v: &Value, formato: FormatoImagem) -> Result<Imagem, Erro> {
    match formato {
        FormatoImagem::Compativel => {
            if let Some(b64) = v.pointer("/data/0/b64_json").and_then(Value::as_str) {
                return Ok(Imagem::Pronta(format!("data:image/png;base64,{b64}")));
            }
            if let Some(url) = v.pointer("/data/0/url").and_then(Value::as_str) {
                return Ok(Imagem::Baixar(url.to_string()));
            }
            Err(erro("resposta", "A imagem não veio na resposta. Tente de novo."))
        }
        FormatoImagem::Gemini => {
            let partes = v.pointer("/candidates/0/content/parts").and_then(Value::as_array).cloned().unwrap_or_default();
            for parte in partes {
                let dados = parte.get("inlineData").or_else(|| parte.get("inline_data"));
                if let Some(b64) = dados.and_then(|d| d["data"].as_str()) {
                    let tipo = dados.and_then(|d| d["mimeType"].as_str().or(d["mime_type"].as_str())).unwrap_or("image/png");
                    return Ok(Imagem::Pronta(format!("data:{tipo};base64,{b64}")));
                }
            }
            if v.pointer("/promptFeedback/blockReason").is_some() || v.pointer("/candidates/0/finishReason").and_then(Value::as_str) == Some("SAFETY") {
                return Err(erro("recusa", "O modelo preferiu não desenhar esta imagem. Tente descrever o tema de outro jeito."));
            }
            Err(erro("resposta", "A imagem não veio na resposta. Tente de novo ou escolha outro modelo de imagem."))
        }
    }
}

/// Baixar a imagem que veio só como endereço (sem chave: é um link temporário).
pub fn pedido_baixar(url: &str) -> Pedido {
    Pedido { metodo: "GET", url: url.to_string(), cabecalhos: vec![], corpo: None, binario: true, local: false }
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::ia::Provedor;

    fn escolhido(tipo: TipoProvedor, url: &str) -> Escolhido {
        Escolhido {
            provedor: Provedor { id: "x".into(), tipo, nome: "Teste".into(), url: url.into(), modelo: "modelo-x".into() },
            chave: Some(zeroize::Zeroizing::new("chave-secreta".into())),
        }
    }

    fn cabecalho<'a>(p: &'a Pedido, nome: &str) -> Option<&'a str> {
        p.cabecalhos.iter().find(|(k, _)| k == nome).map(|(_, v)| v.as_str())
    }

    #[test]
    fn claude_leva_chave_versao_e_aviso_do_navegador() {
        let p = pedido_completar(&escolhido(TipoProvedor::Claude, "https://api.anthropic.com"), "sis", "msg");
        assert_eq!((p.metodo, p.url.as_str()), ("POST", "https://api.anthropic.com/v1/messages"));
        assert_eq!(cabecalho(&p, "x-api-key"), Some("chave-secreta"));
        assert_eq!(cabecalho(&p, "anthropic-version"), Some(VERSAO_ANTHROPIC));
        assert_eq!(cabecalho(&p, "anthropic-dangerous-direct-browser-access"), Some("true"));
        let corpo: Value = serde_json::from_str(p.corpo.as_deref().unwrap()).unwrap();
        assert_eq!((corpo["system"].as_str(), corpo["model"].as_str()), (Some("sis"), Some("modelo-x")));
        // O registro de depuração nunca mostra a chave.
        assert!(!format!("{p:?}").contains("chave-secreta"));
    }

    #[test]
    fn compativel_usa_bearer_e_le_a_resposta() {
        let p = pedido_completar(&escolhido(TipoProvedor::Compativel, "https://api.openai.com/v1"), "sis", "msg");
        assert_eq!(p.url, "https://api.openai.com/v1/chat/completions");
        assert_eq!(cabecalho(&p, "authorization"), Some("Bearer chave-secreta"));
        assert!(cabecalho(&p, "x-api-key").is_none());
        let v = json!({"choices":[{"message":{"content":"Olá"}}]});
        assert_eq!(ler_completar(TipoProvedor::Compativel, &v).unwrap(), "Olá");
        let v = json!({"content":[{"type":"thinking"},{"type":"text","text":"Oi"}]});
        assert_eq!(ler_completar(TipoProvedor::Claude, &v).unwrap(), "Oi");
        let v = json!({"content":[], "stop_reason":"refusal"});
        assert!(matches!(ler_completar(TipoProvedor::Claude, &v), Err(Erro::Ia { motivo: "recusa", .. })));
    }

    #[test]
    fn modelos_tiram_o_que_nao_conversa() {
        let p = pedido_modelos(&escolhido(TipoProvedor::Claude, "https://api.anthropic.com"));
        assert_eq!((p.metodo, p.url.as_str()), ("GET", "https://api.anthropic.com/v1/models?limit=100"));
        let v = json!({"data":[{"id":"models/gemini-x"},{"id":"text-embedding-3"},{"id":"gemini-image"},{"id":"gpt-x"}]});
        assert_eq!(ler_modelos_de_conversa(&v), vec!["gemini-x", "gpt-x"]);
        assert_eq!(ler_todos_modelos(&v).len(), 4);
    }

    #[test]
    fn imagem_escolhe_o_formato_certo() {
        let gemini = escolhido(TipoProvedor::Compativel, "https://generativelanguage.googleapis.com/v1beta/openai");
        let (p, f) = pedido_imagem(&gemini, "gemini-3-pro-image-preview", "floresta", true).unwrap();
        assert_eq!(f, FormatoImagem::Gemini);
        assert_eq!(p.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent");
        assert_eq!(cabecalho(&p, "x-goog-api-key"), Some("chave-secreta"));
        assert!(cabecalho(&p, "authorization").is_none() && p.corpo.as_deref().unwrap().contains("\"imageSize\":\"2K\""));
        let (_, f) = pedido_imagem(&gemini, "imagen-4.0", "floresta", false).unwrap();
        assert_eq!(f, FormatoImagem::Compativel);
        let (p, _) = pedido_imagem(&escolhido(TipoProvedor::Compativel, "https://api.openai.com/v1"), "gpt-image-2", "x", false).unwrap();
        assert!(!p.corpo.as_deref().unwrap().contains("response_format"));
        assert!(pedido_imagem(&escolhido(TipoProvedor::Claude, "https://api.anthropic.com"), "x", "x", false).is_err());

        let v = json!({"candidates":[{"content":{"parts":[{"text":"Aqui"},{"inlineData":{"mimeType":"image/jpeg","data":"QUJD"}}]}}]});
        assert_eq!(ler_imagem(&v, FormatoImagem::Gemini).unwrap(), Imagem::Pronta("data:image/jpeg;base64,QUJD".into()));
        let v = json!({"data":[{"url":"https://exemplo.com/a.png"}]});
        assert_eq!(ler_imagem(&v, FormatoImagem::Compativel).unwrap(), Imagem::Baixar("https://exemplo.com/a.png".into()));
        let v = json!({"promptFeedback":{"blockReason":"SAFETY"}});
        assert!(matches!(ler_imagem(&v, FormatoImagem::Gemini), Err(Erro::Ia { motivo: "recusa", .. })));
    }

    #[test]
    fn situacoes_viram_explicacoes_simples() {
        assert!(matches!(ler_resposta(401, ""), Err(Erro::Ia { motivo: "chave", .. })));
        assert!(matches!(ler_resposta(429, ""), Err(Erro::Ia { motivo: "limite", .. })));
        assert!(matches!(ler_resposta(529, ""), Err(Erro::Ia { motivo: "servidor", .. })));
        assert!(matches!(ler_resposta(200, "não é json"), Err(Erro::Ia { motivo: "resposta", .. })));
        assert!(ler_resposta(400, r#"{"error":{"message":"max_tokens is too large"}}"#).unwrap_err().to_string().contains("max_tokens is too large"));
        let e = traduzir_situacao(403, r#"{"error":{"message":"Your organization must be verified to use the model `gpt-image-2`."}}"#);
        assert!(matches!(e, Erro::Ia { motivo: "verificar", .. }));
    }

    #[test]
    fn falhas_de_rede_no_navegador_explicam_o_bloqueio() {
        let sabia = pedido_completar(&escolhido(TipoProvedor::Compativel, "https://chat.maritaca.ai/api"), "s", "m");
        let e = falha_de_rede(&sabia, false, true, false);
        assert!(matches!(&e, Erro::Ia { motivo: "navegador", .. }) && e.to_string().contains("não aceita ser chamado pelo navegador"));
        let gpt = pedido_completar(&escolhido(TipoProvedor::Compativel, "https://api.openai.com/v1"), "s", "m");
        assert!(falha_de_rede(&gpt, false, true, false).to_string().contains("pode não aceitar"));
        assert!(matches!(falha_de_rede(&gpt, false, true, true), Erro::Ia { motivo: "rede", .. }));
        assert!(matches!(falha_de_rede(&gpt, true, true, false), Erro::Ia { motivo: "demora", .. }));
        let ollama = pedido_modelos(&Escolhido { chave: None, ..escolhido(TipoProvedor::Compativel, "http://localhost:11434/v1") });
        assert!(falha_de_rede(&ollama, false, true, false).to_string().contains("OLLAMA_ORIGINS"));
        assert!(!falha_de_rede(&ollama, false, false, false).to_string().contains("OLLAMA_ORIGINS"));
        assert!(ollama.cabecalhos.is_empty());
    }
}
