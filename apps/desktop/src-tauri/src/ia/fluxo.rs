//! Cada ordem de IA em passos, sem a parte de rede. O mesmo código roda no
//! Windows e no navegador (motor em WebAssembly); só quem envia o pedido muda.
//!
//! `avancar(conn, comando, args, None)` lê o provedor e a chave do banco, monta o
//! texto (as instruções e a mensagem) e devolve o primeiro pedido. Depois de
//! enviar, quem envia chama `avancar` de novo com a resposta: sai o resultado
//! (validado aqui) ou um pedido a mais (repetir sem resolução alta, baixar a
//! imagem). Nada fica guardado entre um passo e outro: cada passo relê o banco a
//! partir dos mesmos argumentos. Ver `docs/decisoes/0013-ia-no-navegador.md`.

use rusqlite::Connection;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::protocolo::{self, FormatoImagem, Imagem, Pedido};
use super::{agente, caderno, escrita, fontes, organizar, planejar, revisar, tema, Escolhido, Provedor, TipoProvedor};
use crate::erro::Erro;

/// As ordens que passam por aqui (as mesmas, com os mesmos argumentos, no Windows e no navegador).
#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
pub const COMANDOS: &[&str] = &[
    "testar_provedor_ia",
    "planejar_com_ia",
    "organizar_texto_ia",
    "ajustar_organizacao_ia",
    "revisar_texto_ia",
    "ia_caderno",
    "conferir_escrita_ia",
    "ia_caderno_agir",
    "ia_fontes",
    "gerar_tema_ia",
    "desenhar_icones_ia",
    "modelos_imagem_ia",
    "gerar_imagem_ia",
];

/// O que fazer agora.
#[derive(Debug, Serialize)]
#[serde(tag = "tipo", rename_all = "camelCase")]
pub enum Passo {
    /// Enviar este pedido e voltar com a resposta, marcada com a `etapa`.
    Pedir { pedido: Pedido, etapa: u8 },
    /// Terminou: o resultado da ordem (o mesmo JSON que a tela recebe).
    Pronto { valor: Value },
}

/// O que o provedor respondeu. Em pedido `binario`, o corpo vem em base64.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Resposta {
    pub etapa: u8,
    pub situacao: u16,
    pub corpo: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Plano {
    etapas: Vec<planejar::EtapaProposta>,
    explicacao: Option<String>,
    provedor: String,
    local: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Organizacao {
    itens: Vec<organizar::ItemProposto>,
    provedor: String,
    local: bool,
}

fn ler_args<T: DeserializeOwned>(comando: &str, args: &str) -> Result<T, Erro> {
    serde_json::from_str(args).map_err(|e| Erro::Interno(format!("argumentos de {comando}: {e}")))
}

fn pronto(valor: impl Serialize) -> Result<Passo, Erro> {
    Ok(Passo::Pronto { valor: serde_json::to_value(valor).map_err(|e| Erro::Interno(e.to_string()))? })
}

fn pedir(pedido: Pedido, etapa: u8) -> Result<Passo, Erro> {
    Ok(Passo::Pedir { pedido, etapa })
}

/// Conversa de uma mensagem: sem resposta ainda, `Err(pedido)`; com resposta, o texto.
fn conversar(e: &Escolhido, sistema: &str, mensagem: impl FnOnce() -> String, r: Option<&Resposta>) -> Result<Result<String, Passo>, Erro> {
    match r {
        None => Ok(Err(Passo::Pedir { pedido: protocolo::pedido_completar(e, sistema, &mensagem()), etapa: 0 })),
        Some(r) => Ok(Ok(protocolo::ler_completar(e.provedor.tipo, &protocolo::ler_resposta(r.situacao, &r.corpo)?)?)),
    }
}

/// Executa um passo de uma ordem de IA. `args`: o JSON com os argumentos da
/// ordem, igual ao que a tela manda. `resposta`: a resposta do pedido anterior.
pub fn avancar(conn: &Connection, comando: &str, args: &str, resposta: Option<&Resposta>) -> Result<Passo, Erro> {
    let r = resposta;
    macro_rules! texto {
        ($e:expr, $sistema:expr, $mensagem:expr) => {
            match conversar(&$e, &$sistema, || $mensagem, r)? {
                Ok(t) => t,
                Err(p) => return Ok(p),
            }
        };
    }
    match comando {
        // Testa um provedor ainda não salvo (ou um salvo, se a chave vier vazia
        // e houver id). Devolve os modelos que conversam.
        "testar_provedor_ia" => {
            #[derive(Deserialize)]
            struct A {
                provedor: Provedor,
                chave: Option<String>,
            }
            let A { mut provedor, chave } = ler_args(comando, args)?;
            let chave = chave.map(zeroize::Zeroizing::new).filter(|c| !c.trim().is_empty());
            let chave = if chave.is_none() && !provedor.id.is_empty() {
                super::provedor_por_id(conn, &provedor.id)?.chave
            } else {
                chave.map(|c| zeroize::Zeroizing::new(c.trim().to_string()))
            };
            provedor.url = provedor.url.trim().trim_end_matches('/').to_string();
            let e = Escolhido { provedor, chave };
            match r {
                None => pedir(protocolo::pedido_modelos(&e), 0),
                Some(r) => pronto(protocolo::ler_modelos_de_conversa(&protocolo::ler_resposta(r.situacao, &r.corpo)?)),
            }
        }

        // "Planejar com a IA": o contexto do projeto (ou da etapa), a proposta
        // atual com as mudanças feitas à mão e a conversa. Devolve a proposta revisada.
        // `sensivel`: a interface achou sinais de saúde ou terapia.
        "planejar_com_ia" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                alvo: String,
                conversa: Vec<planejar::Fala>,
                proposta_atual: Option<Vec<planejar::EtapaProposta>>,
                sensivel: bool,
            }
            let a: A = ler_args(comando, args)?;
            let e = super::provedor_da_funcao(conn, "quebrar", a.sensivel)?;
            let contexto = planejar::contexto(conn, &a.alvo)?;
            let resposta = texto!(e, planejar::sistema(contexto.etapa), planejar::montar_pedido(&contexto, &a.conversa, a.proposta_atual.as_deref()));
            let (etapas, explicacao) = planejar::ler_proposta(&resposta, contexto.etapa)?;
            pronto(Plano { etapas, explicacao, provedor: e.provedor.nome.clone(), local: e.provedor.local() })
        }

        // Separa um texto solto em ideias, tarefas e compromissos.
        "organizar_texto_ia" | "ajustar_organizacao_ia" => {
            #[derive(Deserialize)]
            struct A {
                texto: String,
                sensivel: bool,
                #[serde(default)]
                itens: Option<String>,
                #[serde(default)]
                mudanca: Option<String>,
            }
            let a: A = ler_args(comando, args)?;
            let ajuste = comando == "ajustar_organizacao_ia";
            if ajuste && a.mudanca.as_deref().unwrap_or("").trim().is_empty() {
                return Err(Erro::TextoVazio);
            }
            let e = super::provedor_da_funcao(conn, "conversa", a.sensivel)?;
            let pedido = organizar::pedido_de_agora(conn, &a.texto)?;
            let projetos = organizar::projetos_ativos(conn)?;
            let mensagem = || {
                if ajuste {
                    organizar::montar_ajuste(&pedido, a.itens.as_deref().unwrap_or(""), a.mudanca.as_deref().unwrap_or(""))
                } else {
                    pedido.clone()
                }
            };
            let resposta = texto!(e, organizar::SISTEMA, mensagem());
            let itens = organizar::ler_itens(&resposta, &projetos);
            if itens.is_empty() {
                let mensagem = if ajuste {
                    "A IA não conseguiu refazer a lista. Tente explicar a mudança de outro jeito."
                } else {
                    "A IA não conseguiu separar o texto. Tente de novo, ou guarde como ideia."
                };
                return Err(protocolo::erro("resposta", mensagem));
            }
            pronto(Organizacao { itens, provedor: e.provedor.nome.clone(), local: e.provedor.local() })
        }

        // Revisa ou reescreve. A tela mostra antes e depois.
        "revisar_texto_ia" => {
            #[derive(Deserialize)]
            struct A {
                texto: String,
                sensivel: bool,
                modo: Option<String>,
                instrucao: Option<String>,
            }
            let a: A = ler_args(comando, args)?;
            let texto: String = a.texto.trim().chars().take(revisar::MAXIMO_DE_CARACTERES).collect();
            if texto.is_empty() {
                return Err(Erro::TextoVazio);
            }
            let e = super::provedor_da_funcao(conn, "revisao", a.sensivel)?;
            let sistema = revisar::sistema(a.modo.as_deref().unwrap_or("revisar"), a.instrucao.as_deref());
            let revisado = revisar::limpar(&texto!(e, sistema, texto.clone()));
            if revisado.is_empty() {
                return Err(protocolo::erro("resposta", "A revisão veio vazia. Tente de novo."));
            }
            pronto(revisado)
        }

        // IA do caderno: um pedido livre sobre a página (texto e, se houver, imagens).
        // Devolve HTML simples; a tela mostra a proposta e só põe na página quando a pessoa escolhe.
        "ia_caderno" => {
            #[derive(Deserialize)]
            struct A {
                pedido: String,
                #[serde(default)]
                contexto: String,
                #[serde(default)]
                imagens: Vec<String>,
                sensivel: bool,
            }
            #[derive(Serialize)]
            #[serde(rename_all = "camelCase")]
            struct RespostaCaderno {
                html: String,
                provedor: String,
                local: bool,
            }
            let a: A = ler_args(comando, args)?;
            if a.pedido.trim().is_empty() {
                return Err(Erro::TextoVazio);
            }
            if a.imagens.len() > caderno::MAXIMO_DE_IMAGENS {
                return Err(protocolo::erro("grande", "São imagens demais de uma vez. Mande até 6 por pedido."));
            }
            if !a.imagens.iter().all(|u| caderno::imagem_valida(u)) {
                return Err(protocolo::erro("grande", "Uma das imagens é grande demais ou não é uma imagem. Tente uma foto menor."));
            }
            let e = super::provedor_da_funcao(conn, "conversa", a.sensivel)?;
            let contexto: String = a.contexto.chars().take(caderno::MAXIMO_DE_CARACTERES).collect();
            let resposta = match r {
                None => {
                    let mensagem = caderno::montar(&a.pedido, &contexto, a.imagens.len());
                    return pedir(protocolo::pedido_completar_com_imagens(&e, caderno::SISTEMA, &mensagem, &a.imagens), 0);
                }
                Some(r) => protocolo::ler_completar(e.provedor.tipo, &protocolo::ler_resposta(r.situacao, &r.corpo)?)?,
            };
            let html = caderno::limpar(&resposta);
            if html.is_empty() {
                return Err(protocolo::erro("resposta", "A IA não respondeu nada. Tente de novo ou pedir de outro jeito."));
            }
            pronto(RespostaCaderno { html, provedor: e.provedor.nome.clone(), local: e.provedor.local() })
        }

        // IA com liberdade total no caderno: devolve um plano de mudanças (a tela confere e aplica).
        "ia_fontes" => {
            #[derive(Deserialize)]
            struct A {
                pedido: String,
                trechos: String,
                sensivel: bool,
            }
            #[derive(Serialize)]
            #[serde(rename_all = "camelCase")]
            struct RespostaFontes {
                html: String,
                provedor: String,
                local: bool,
            }
            let a: A = ler_args(comando, args)?;
            if a.pedido.trim().is_empty() || a.trechos.trim().is_empty() {
                return Err(Erro::TextoVazio);
            }
            let e = super::provedor_da_funcao(conn, "conversa", a.sensivel)?;
            let resposta = match r {
                None => {
                    let trechos: String = a.trechos.chars().take(fontes::MAXIMO_DE_CARACTERES).collect();
                    let mensagem = fontes::montar(&a.pedido, &trechos);
                    return pedir(protocolo::pedido_completar_com_imagens(&e, fontes::SISTEMA, &mensagem, &[]), 0);
                }
                Some(r) => protocolo::ler_completar(e.provedor.tipo, &protocolo::ler_resposta(r.situacao, &r.corpo)?)?,
            };
            let html = caderno::limpar(&resposta);
            if html.is_empty() {
                return Err(protocolo::erro("resposta", "A IA não respondeu nada. Tente de novo ou pedir de outro jeito."));
            }
            pronto(RespostaFontes { html, provedor: e.provedor.nome.clone(), local: e.provedor.local() })
        }
        "ia_caderno_agir" => {
            #[derive(Deserialize)]
            struct A {
                pedido: String,
                descricao: String,
                #[serde(default)]
                imagens: Vec<String>,
                sensivel: bool,
                #[serde(default)]
                fontes: String,
            }
            #[derive(Serialize)]
            #[serde(rename_all = "camelCase")]
            struct Plano {
                resposta: String,
                mudancas: Vec<Value>,
                provedor: String,
                local: bool,
            }
            let a: A = ler_args(comando, args)?;
            if a.pedido.trim().is_empty() {
                return Err(Erro::TextoVazio);
            }
            if a.descricao.len() > agente::MAXIMO_DE_CARACTERES {
                return Err(protocolo::erro("grande", "O caderno é grande demais para mandar inteiro. Escolha \"Esta página\"."));
            }
            if a.imagens.len() > caderno::MAXIMO_DE_IMAGENS || !a.imagens.iter().all(|u| caderno::imagem_valida(u)) {
                return Err(protocolo::erro("grande", "Uma das imagens é grande demais ou são imagens demais (até 6)."));
            }
            let e = super::provedor_da_funcao(conn, "conversa", a.sensivel)?;
            let resposta = match r {
                None => {
                    let mensagem = agente::montar(&a.pedido, &a.descricao, a.imagens.len(), &a.fontes.chars().take(fontes::MAXIMO_DE_CARACTERES / 2).collect::<String>());
                    return pedir(protocolo::pedido_completar_com_imagens(&e, agente::SISTEMA, &mensagem, &a.imagens), 0);
                }
                Some(r) => protocolo::ler_completar(e.provedor.tipo, &protocolo::ler_resposta(r.situacao, &r.corpo)?)?,
            };
            match agente::ler(&resposta) {
                Some((resposta, mudancas)) => pronto(Plano { resposta, mudancas, provedor: e.provedor.nome.clone(), local: e.provedor.local() }),
                None => Err(protocolo::erro("resposta", "A IA não respondeu no formato combinado. Tente de novo ou pedir de outro jeito.")),
            }
        }

        // Corretor da escrita à mão: a imagem da página com as palavras numeradas.
        // Devolve só as palavras erradas, com sugestões.
        "conferir_escrita_ia" => {
            #[derive(Deserialize)]
            struct A {
                imagem: String,
                quantas: usize,
                sensivel: bool,
            }
            let a: A = ler_args(comando, args)?;
            if a.quantas == 0 {
                return Err(Erro::TextoVazio);
            }
            if a.quantas > escrita::MAXIMO_DE_PALAVRAS {
                return Err(protocolo::erro("grande", "A página tem palavras demais para conferir de uma vez. Confira uma parte (selecione com o laço)."));
            }
            if !caderno::imagem_valida(&a.imagem) {
                return Err(protocolo::erro("grande", "A imagem da página ficou grande demais para enviar."));
            }
            let e = super::provedor_da_funcao(conn, "conversa", a.sensivel)?;
            let resposta = match r {
                None => {
                    let imagens = [a.imagem.clone()];
                    return pedir(protocolo::pedido_completar_com_imagens(&e, escrita::SISTEMA, &escrita::montar(a.quantas), &imagens), 0);
                }
                Some(r) => protocolo::ler_completar(e.provedor.tipo, &protocolo::ler_resposta(r.situacao, &r.corpo)?)?,
            };
            match escrita::ler(&resposta, a.quantas) {
                Some(palavras) => pronto(palavras),
                None => Err(protocolo::erro("resposta", "A IA não conseguiu conferir a escrita desta vez. Tente de novo.")),
            }
        }

        // A IA escreve um tema (JSON). A tela confere e mostra no editor.
        "gerar_tema_ia" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                provedor_id: String,
                pedido: String,
                anterior: Option<String>,
                com_desenho: bool,
            }
            let a: A = ler_args(comando, args)?;
            if a.pedido.trim().is_empty() {
                return Err(Erro::TextoVazio);
            }
            let e = super::provedor_para(conn, "personalizacao", &a.provedor_id)?;
            pronto(texto!(e, tema::SISTEMA, tema::montar_pedido(&a.pedido, a.anterior.as_deref(), a.com_desenho)))
        }

        // Experimental: um lote de ícones. A tela lê o JSON e limpa cada desenho.
        "desenhar_icones_ia" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                provedor_id: String,
                estilo: String,
                icones: Vec<(String, String)>,
                referencia: Option<String>,
            }
            let a: A = ler_args(comando, args)?;
            if a.estilo.trim().is_empty() || a.icones.is_empty() {
                return Err(Erro::TextoVazio);
            }
            let e = super::provedor_para(conn, "personalizacao", &a.provedor_id)?;
            pronto(texto!(e, tema::SISTEMA_ICONES, tema::pedido_de_icones(&a.estilo, &a.icones, a.referencia.as_deref())))
        }

        // Modelos de imagem que a conta da pessoa tem nesse provedor (pode ser nenhum).
        "modelos_imagem_ia" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                provedor_id: String,
            }
            let a: A = ler_args(comando, args)?;
            let e = super::provedor_por_id(conn, &a.provedor_id)?;
            if e.provedor.tipo == TipoProvedor::Claude || e.provedor.local() {
                return pronto(Vec::<String>::new());
            }
            match r {
                None => pedir(protocolo::pedido_modelos(&e), 0),
                Some(r) => pronto(tema::modelos_de_imagem(&protocolo::ler_todos_modelos(&protocolo::ler_resposta(r.situacao, &r.corpo)?))),
            }
        }

        // A imagem de fundo do tema, como endereço de dados.
        // Etapas: 0 = pedido; 1 = de novo sem resolução alta (Gemini); 2 = baixar a imagem.
        "gerar_imagem_ia" => {
            #[derive(Deserialize)]
            struct A {
                #[serde(rename = "provedorId")]
                provedor_id: String,
                modelo: String,
                pedido: String,
                alta: bool,
                vivas: bool,
            }
            let a: A = ler_args(comando, args)?;
            let e = super::provedor_por_id(conn, &a.provedor_id)?;
            let texto = tema::pedido_de_imagem(&a.pedido, a.vivas);
            let Some(r) = r else {
                return pedir(protocolo::pedido_imagem(&e, &a.modelo, &texto, a.alta)?.0, 0);
            };
            if r.etapa == 2 {
                if !(200..300).contains(&r.situacao) || r.corpo.is_empty() {
                    return Err(protocolo::erro("resposta", "Não consegui baixar a imagem que a IA fez. Tente de novo."));
                }
                return pronto(format!("data:image/png;base64,{}", r.corpo));
            }
            let alta = a.alta && r.etapa == 0;
            let formato = protocolo::pedido_imagem(&e, &a.modelo, &texto, alta)?.1;
            let v = match protocolo::ler_resposta(r.situacao, &r.corpo) {
                // Nem todo modelo do Gemini aceita escolher o tamanho; se recusar, tenta de novo sem.
                Err(Erro::Ia { motivo: "outro", .. }) if alta && formato == FormatoImagem::Gemini => {
                    return pedir(protocolo::pedido_imagem(&e, &a.modelo, &texto, false)?.0, 1);
                }
                v => v?,
            };
            match protocolo::ler_imagem(&v, formato)? {
                Imagem::Pronta(dados) => pronto(dados),
                Imagem::Baixar(url) => pedir(protocolo::pedido_baixar(&url), 2),
            }
        }

        _ => Err(Erro::Interno(format!("ordem de IA desconhecida: {comando}"))),
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::testes::banco_de_teste;
    use crate::banco::itens;
    use crate::ia::{definir_bloqueio_sensivel, salvar_provedor};
    use serde_json::json;

    fn provedor(tipo: TipoProvedor, nome: &str, url: &str) -> Provedor {
        Provedor { id: String::new(), tipo, nome: nome.into(), url: url.into(), modelo: "modelo-x".into() }
    }

    fn pedido(p: Passo) -> (Pedido, u8) {
        match p {
            Passo::Pedir { pedido, etapa } => (pedido, etapa),
            Passo::Pronto { valor } => panic!("esperava um pedido, veio {valor}"),
        }
    }

    fn valor(p: Passo) -> Value {
        match p {
            Passo::Pronto { valor } => valor,
            Passo::Pedir { pedido, .. } => panic!("esperava o resultado, veio {pedido:?}"),
        }
    }

    fn resposta(etapa: u8, situacao: u16, corpo: Value) -> Resposta {
        Resposta { etapa, situacao, corpo: corpo.to_string() }
    }

    #[test]
    fn ia_do_caderno_manda_o_texto_e_a_imagem() {
        let (_pasta, conn) = banco_de_teste();
        salvar_provedor(&conn, provedor(TipoProvedor::Claude, "Claude", "https://api.anthropic.com"), Some("sk-segredo")).unwrap();
        let args = json!({"pedido": "Passe a escrita para texto", "contexto": "Aula 3", "imagens": ["data:image/png;base64,QUJD"], "sensivel": false}).to_string();
        let (p, _) = pedido(avancar(&conn, "ia_caderno", &args, None).unwrap());
        let corpo: Value = serde_json::from_str(&p.corpo.unwrap()).unwrap();
        let partes = &corpo["messages"][0]["content"];
        assert_eq!(partes[0]["type"], "image");
        assert_eq!(partes[0]["source"]["media_type"], "image/png");
        assert_eq!(partes[0]["source"]["data"], "QUJD");
        assert!(partes[1]["text"].as_str().unwrap().contains("Aula 3"));
        let r = resposta(0, 200, json!({"content":[{"type":"text","text":"```html\n<p>Neurônio</p>\n```"}]}));
        let v = valor(avancar(&conn, "ia_caderno", &args, Some(&r)).unwrap());
        assert_eq!(v["html"], "<p>Neurônio</p>");
        assert_eq!(v["provedor"], "Claude");
        // Imagem que não é data: URL não vai.
        let ruim = json!({"pedido": "x", "imagens": ["https://exemplo.com/a.png"], "sensivel": false}).to_string();
        assert!(matches!(avancar(&conn, "ia_caderno", &ruim, None), Err(Erro::Ia { motivo: "grande", .. })));
    }

    #[test]
    fn ia_do_caderno_no_formato_compativel() {
        let (_pasta, conn) = banco_de_teste();
        salvar_provedor(&conn, provedor(TipoProvedor::Compativel, "GPT", "https://api.openai.com/v1"), Some("sk-x")).unwrap();
        let args = json!({"pedido": "Resuma", "imagens": ["data:image/jpeg;base64,QUJD"], "sensivel": false}).to_string();
        let (p, _) = pedido(avancar(&conn, "ia_caderno", &args, None).unwrap());
        assert_eq!(p.url, "https://api.openai.com/v1/chat/completions");
        let corpo: Value = serde_json::from_str(&p.corpo.unwrap()).unwrap();
        let partes = &corpo["messages"][1]["content"];
        assert_eq!(partes[0]["type"], "text");
        assert_eq!(partes[1]["image_url"]["url"], "data:image/jpeg;base64,QUJD");
    }

    #[test]
    fn separar_com_ia_em_dois_passos() {
        let (_pasta, conn) = banco_de_teste();
        salvar_provedor(&conn, provedor(TipoProvedor::Claude, "Claude", "https://api.anthropic.com"), Some("sk-segredo")).unwrap();
        let projeto = itens::criar_projeto(&conn, "Casa", true).unwrap();
        let args = json!({"texto": "pintar a sala e consulta amanhã", "sensivel": false}).to_string();

        let (p, etapa) = pedido(avancar(&conn, "organizar_texto_ia", &args, None).unwrap());
        assert_eq!((p.url.as_str(), etapa), ("https://api.anthropic.com/v1/messages", 0));
        assert!(p.cabecalhos.contains(&("x-api-key".into(), "sk-segredo".into())));
        let corpo = p.corpo.unwrap();
        assert!(corpo.contains("Casa") && corpo.contains("pintar a sala"));

        let texto = r#"{"itens":[{"tipo":"tarefa","texto":"Pintar a sala","projeto":"Casa"},{"tipo":"ideia","texto":"Livro"}]}"#;
        let r = resposta(0, 200, json!({"content":[{"type":"text","text": texto}]}));
        let v = valor(avancar(&conn, "organizar_texto_ia", &args, Some(&r)).unwrap());
        assert_eq!(v["provedor"], "Claude");
        assert_eq!(v["local"], false);
        assert_eq!(v["itens"][0]["projetoId"], json!(projeto.id));
        assert_eq!(v["itens"][1]["tipo"], "ideia");

        // Resposta sem nada aproveitável vira erro claro.
        let r = resposta(0, 200, json!({"content":[{"type":"text","text":"não sei"}]}));
        assert!(matches!(avancar(&conn, "organizar_texto_ia", &args, Some(&r)), Err(Erro::Ia { motivo: "resposta", .. })));
        // Chave recusada.
        let r = resposta(0, 401, json!({"error":{"message":"invalid x-api-key"}}));
        assert!(matches!(avancar(&conn, "organizar_texto_ia", &args, Some(&r)), Err(Erro::Ia { motivo: "chave", .. })));
    }

    #[test]
    fn dado_sensivel_bloqueado_nem_monta_o_pedido() {
        let (_pasta, conn) = banco_de_teste();
        salvar_provedor(&conn, provedor(TipoProvedor::Compativel, "GPT", "https://api.openai.com/v1"), Some("k")).unwrap();
        definir_bloqueio_sensivel(&conn, true).unwrap();
        let args = json!({"texto": "remédio da terapia", "sensivel": true}).to_string();
        assert!(matches!(avancar(&conn, "organizar_texto_ia", &args, None), Err(Erro::Ia { motivo: "sensivel_bloqueado", .. })));
        let args = json!({"texto": "remédio", "sensivel": true, "modo": null, "instrucao": null}).to_string();
        assert!(matches!(avancar(&conn, "revisar_texto_ia", &args, None), Err(Erro::Ia { motivo: "sensivel_bloqueado", .. })));
        // Sem o sinal de sensível, vai.
        let args = json!({"texto": "pagar a luz", "sensivel": false}).to_string();
        assert!(avancar(&conn, "organizar_texto_ia", &args, None).is_ok());
    }

    #[test]
    fn planejar_e_revisar() {
        let (_pasta, conn) = banco_de_teste();
        salvar_provedor(&conn, provedor(TipoProvedor::Compativel, "GPT", "https://api.openai.com/v1"), Some("k")).unwrap();
        let projeto = itens::criar_projeto(&conn, "Mudar de casa", true).unwrap();
        let args = json!({"alvo": projeto.id, "conversa": [{"papel": "pessoa", "texto": "falta a mudança"}], "propostaAtual": null, "sensivel": false}).to_string();
        let (p, _) = pedido(avancar(&conn, "planejar_com_ia", &args, None).unwrap());
        assert!(p.corpo.as_deref().unwrap().contains("Mudar de casa") && p.corpo.as_deref().unwrap().contains("falta a mudança"));
        let texto = r#"{"explicacao":"Três etapas.","etapas":[{"titulo":"Separar caixas","subtarefas":["Comprar fita"]}]}"#;
        let r = resposta(0, 200, json!({"choices":[{"message":{"content": texto}}]}));
        let v = valor(avancar(&conn, "planejar_com_ia", &args, Some(&r)).unwrap());
        assert_eq!(v["etapas"][0]["subtarefas"][0], "Comprar fita");
        assert_eq!((v["explicacao"].as_str(), v["provedor"].as_str()), (Some("Três etapas."), Some("GPT")));

        let args = json!({"texto": "  ", "sensivel": false, "modo": null, "instrucao": null}).to_string();
        assert!(matches!(avancar(&conn, "revisar_texto_ia", &args, None), Err(Erro::TextoVazio)));
        let args = json!({"texto": "ola tudo bem", "sensivel": false, "modo": "revisar", "instrucao": null}).to_string();
        let r = resposta(0, 200, json!({"choices":[{"message":{"content":"\"Olá, tudo bem?\""}}]}));
        assert_eq!(valor(avancar(&conn, "revisar_texto_ia", &args, Some(&r)).unwrap()), json!("Olá, tudo bem?"));
    }

    #[test]
    fn testar_usa_a_chave_guardada_se_nao_vier_outra() {
        let (_pasta, conn) = banco_de_teste();
        let e = salvar_provedor(&conn, provedor(TipoProvedor::Compativel, "Gemini", "https://generativelanguage.googleapis.com/v1beta/openai"), Some("guardada")).unwrap();
        let mut salvo = e.provedores[0].provedor.clone();
        salvo.url.push('/');
        let args = json!({"provedor": salvo, "chave": null}).to_string();
        let (p, _) = pedido(avancar(&conn, "testar_provedor_ia", &args, None).unwrap());
        assert_eq!(p.url, "https://generativelanguage.googleapis.com/v1beta/openai/models");
        assert!(p.cabecalhos.contains(&("authorization".into(), "Bearer guardada".into())));
        let args = json!({"provedor": salvo, "chave": " nova "}).to_string();
        let (p, _) = pedido(avancar(&conn, "testar_provedor_ia", &args, None).unwrap());
        assert!(p.cabecalhos.contains(&("authorization".into(), "Bearer nova".into())));
        let r = resposta(0, 200, json!({"data":[{"id":"models/gemini-x"},{"id":"gemini-x-image"}]}));
        assert_eq!(valor(avancar(&conn, "testar_provedor_ia", &args, Some(&r)).unwrap()), json!(["gemini-x"]));
    }

    #[test]
    fn imagem_do_gemini_tenta_de_novo_sem_alta_e_imagem_por_link_e_baixada() {
        let (_pasta, conn) = banco_de_teste();
        let e = salvar_provedor(&conn, provedor(TipoProvedor::Compativel, "Gemini", "https://generativelanguage.googleapis.com/v1beta/openai"), Some("k")).unwrap();
        let id = e.provedores[0].provedor.id.clone();
        let args = json!({"provedorId": id, "modelo": "gemini-3-pro-image-preview", "pedido": "floresta", "alta": true, "vivas": false}).to_string();
        let (p, _) = pedido(avancar(&conn, "gerar_imagem_ia", &args, None).unwrap());
        assert!(p.corpo.as_deref().unwrap().contains("2K"));
        let recusa = resposta(0, 400, json!({"error":{"message":"imageSize not supported"}}));
        let (p, etapa) = pedido(avancar(&conn, "gerar_imagem_ia", &args, Some(&recusa)).unwrap());
        assert_eq!(etapa, 1);
        assert!(!p.corpo.as_deref().unwrap().contains("2K"));
        let ok = resposta(1, 200, json!({"candidates":[{"content":{"parts":[{"inlineData":{"mimeType":"image/png","data":"QUJD"}}]}}]}));
        assert_eq!(valor(avancar(&conn, "gerar_imagem_ia", &args, Some(&ok)).unwrap()), json!("data:image/png;base64,QUJD"));

        let e = salvar_provedor(&conn, provedor(TipoProvedor::Compativel, "GPT", "https://api.openai.com/v1"), Some("k")).unwrap();
        let id = e.provedores[1].provedor.id.clone();
        let args = json!({"provedorId": id, "modelo": "dall-e-3", "pedido": "mar", "alta": false, "vivas": true}).to_string();
        let link = resposta(0, 200, json!({"data":[{"url":"https://exemplo.com/a.png"}]}));
        let (p, etapa) = pedido(avancar(&conn, "gerar_imagem_ia", &args, Some(&link)).unwrap());
        assert_eq!((p.url.as_str(), p.binario, etapa), ("https://exemplo.com/a.png", true, 2));
        assert!(p.cabecalhos.is_empty());
        let bytes = Resposta { etapa: 2, situacao: 200, corpo: "QUJD".into() };
        assert_eq!(valor(avancar(&conn, "gerar_imagem_ia", &args, Some(&bytes)).unwrap()), json!("data:image/png;base64,QUJD"));
    }

    #[test]
    fn claude_e_ollama_nao_tem_modelos_de_imagem() {
        let (_pasta, conn) = banco_de_teste();
        let e = salvar_provedor(&conn, provedor(TipoProvedor::Claude, "Claude", "https://api.anthropic.com"), Some("k")).unwrap();
        let args = json!({"provedorId": e.provedores[0].provedor.id}).to_string();
        assert_eq!(valor(avancar(&conn, "modelos_imagem_ia", &args, None).unwrap()), json!([]));
        let e = salvar_provedor(&conn, provedor(TipoProvedor::Compativel, "GPT", "https://api.openai.com/v1"), Some("k")).unwrap();
        let args = json!({"provedorId": e.provedores[1].provedor.id}).to_string();
        let r = resposta(0, 200, json!({"data":[{"id":"gpt-x"},{"id":"gpt-image-2"}]}));
        assert_eq!(valor(avancar(&conn, "modelos_imagem_ia", &args, Some(&r)).unwrap()), json!(["gpt-image-2"]));
    }

    #[test]
    fn o_passo_vira_json_sem_expor_a_chave_no_debug() {
        let (_pasta, conn) = banco_de_teste();
        let e = salvar_provedor(&conn, provedor(TipoProvedor::Compativel, "GPT", "https://api.openai.com/v1"), Some("sk-muito-secreta")).unwrap();
        let args = json!({"provedorId": e.provedores[0].provedor.id, "pedido": "floresta", "anterior": null, "comDesenho": true}).to_string();
        let passo = avancar(&conn, "gerar_tema_ia", &args, None).unwrap();
        assert!(!format!("{passo:?}").contains("sk-muito-secreta"));
        let v = serde_json::to_value(&passo).unwrap();
        assert_eq!((v["tipo"].as_str(), v["etapa"].as_u64()), (Some("pedir"), Some(0)));
        assert_eq!(v["pedido"]["metodo"], "POST");
        assert_eq!(v["pedido"]["cabecalhos"][0], json!(["authorization", "Bearer sk-muito-secreta"]));
        assert!(avancar(&conn, "nao_existe", "{}", None).is_err());
    }
}
