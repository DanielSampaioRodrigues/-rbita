//! "Planejar com a IA": uma conversa sobre um projeto (ou uma etapa) que termina
//! numa proposta de etapas com subtarefas. A IA só propõe; a interface mostra a
//! proposta, a pessoa edita e só o que ela aprovar é gravado.
//!
//! Cada pedido leva o contexto inteiro de novo (o projeto, as anotações, o "onde
//! parei", o que já existe, a proposta atual com as mudanças feitas à mão e a
//! conversa até aqui). Nada fica guardado do lado do provedor.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::banco::itens;
use crate::erro::Erro;

/// Até quantas etapas a proposta traz.
pub const MAXIMO_DE_ETAPAS: usize = 12;
/// Até quantas subtarefas por etapa (e passos, quando o alvo é uma etapa).
pub const MAXIMO_DE_SUBTAREFAS: usize = 10;
/// Tamanho máximo do texto de cada etapa ou subtarefa.
pub const MAXIMO_DO_TEXTO: usize = 120;
/// Tamanho máximo da frase que explica a proposta.
pub const MAXIMO_DA_EXPLICACAO: usize = 300;
/// Quantas falas da conversa vão no pedido (as mais recentes).
pub const MAXIMO_DE_FALAS: usize = 20;
/// Tamanho máximo de cada fala.
pub const MAXIMO_DA_FALA: usize = 2_000;
/// Quanto das anotações vai no pedido (as anotações podem ter até 20 000 caracteres).
pub const MAXIMO_DAS_ANOTACOES: usize = 6_000;

const COMUM: &str = "Você ajuda pessoas neurodivergentes (autistas, com TDAH, dislexia e outras) a planejar o que querem fazer. \
Escreva em português do Brasil, com linguagem simples e literal, sem julgamento e sem metáforas. \
Cada item começa com um verbo e tem no máximo 12 palavras. \
Não repita o que já existe: a proposta traz só o que falta. \
Siga o que a pessoa pedir na conversa (juntar, separar, acrescentar, tirar, mudar a ordem). \
Quando houver uma proposta atual, devolva a proposta inteira já revisada, mantendo o que a pessoa não pediu para mudar e respeitando as mudanças que ela fez à mão. \
A explicação é uma frase curta e neutra sobre o que você propôs ou mudou. ";

const SISTEMA_PROJETO: &str = "Proponha etapas para o projeto, na ordem em que fazem sentido, cada uma com subtarefas pequenas e concretas. \
Até 12 etapas e até 10 subtarefas por etapa. \
Responda só com JSON, sem nenhum texto antes ou depois, neste formato: \
{\"explicacao\": \"...\", \"etapas\": [{\"titulo\": \"...\", \"subtarefas\": [\"...\", \"...\"]}]}";

const SISTEMA_ETAPA: &str = "Proponha passos pequenos e concretos para a etapa indicada, na ordem em que fazem sentido. \
Os passos viram subtarefas da etapa: não crie um nível a mais. Até 10 passos. \
Responda só com JSON, sem nenhum texto antes ou depois, neste formato: \
{\"explicacao\": \"...\", \"passos\": [\"...\", \"...\"]}";

/// O texto de sistema para o alvo: projeto (etapas com subtarefas) ou etapa (passos).
pub fn sistema(etapa: bool) -> String {
    format!("{COMUM}{}", if etapa { SISTEMA_ETAPA } else { SISTEMA_PROJETO })
}

/// Uma fala da conversa. `papel`: "pessoa" ou "ia".
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct Fala {
    pub papel: String,
    pub texto: String,
}

/// Uma etapa proposta e as suas subtarefas. Quando o alvo é uma etapa, cada
/// item é um passo e `subtarefas` fica vazia.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct EtapaProposta {
    pub titulo: String,
    #[serde(default)]
    pub subtarefas: Vec<String>,
}

/// O que se sabe do alvo, lido do banco.
pub struct Alvo {
    /// O alvo é uma etapa (os passos viram subtarefas dela).
    pub etapa: bool,
    pub pedido_base: String,
}

fn estado_legivel(estado: &str) -> &'static str {
    match estado {
        "feita" => "feita",
        "fazendo" => "fazendo",
        _ => "a fazer",
    }
}

fn cortar(texto: &str, maximo: usize) -> String {
    let t = texto.trim();
    if t.chars().count() <= maximo {
        return t.to_string();
    }
    let mut c: String = t.chars().take(maximo).collect();
    c.push_str(" […]");
    c
}

/// Monta o contexto do alvo a partir do banco: nome do projeto, anotações (ou a
/// nota da ideia de origem, como a tela mostra), "onde parei" e as etapas e
/// tarefas que já existem, com o estado de cada uma.
pub fn contexto(conn: &Connection, alvo: &str) -> Result<Alvo, Erro> {
    let (tipo, pai): (String, Option<String>) = conn
        .query_row("SELECT tipo, pai_id FROM item WHERE id = ?1 AND excluido_em IS NULL", [alvo], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|_| Erro::NaoEncontrado)?;
    let projeto_id = match (tipo.as_str(), &pai) {
        ("projeto", _) => alvo.to_string(),
        ("tarefa", Some(p)) => p.clone(),
        _ => return Err(Erro::NaoEncontrado),
    };
    let projeto = itens::obter_projeto(conn, &projeto_id).map_err(|_| Erro::Ia {
        motivo: "dois_niveis",
        mensagem: "Esta já é uma subtarefa. O Órbita tem dois níveis: dá para planejar o projeto ou uma etapa.".into(),
    })?;
    let tarefas = itens::listar_tarefas(conn, &projeto_id)?;
    let etapa = tipo == "tarefa";

    let mut texto = format!("Projeto: {}\n", projeto.titulo.trim());
    if etapa {
        let e = tarefas.iter().find(|t| t.id == alvo).ok_or(Erro::NaoEncontrado)?;
        texto.push_str(&format!("Etapa para planejar (os passos viram subtarefas dela): {} ({})\n", e.titulo, estado_legivel(&e.estado)));
    }
    if !projeto.anotacoes.trim().is_empty() {
        texto.push_str(&format!("\nAnotações do projeto:\n\"\"\"\n{}\n\"\"\"\n", cortar(&projeto.anotacoes, MAXIMO_DAS_ANOTACOES)));
    }
    if let Some(o) = &projeto.onde_parei {
        if !o.texto.trim().is_empty() {
            texto.push_str(&format!("\nOnde a pessoa parou: {}\n", cortar(&o.texto, 1_000)));
        }
        if !o.proximo_passo.trim().is_empty() {
            texto.push_str(&format!("Próximo passo anotado: {}\n", cortar(&o.proximo_passo, 500)));
        }
    }

    let etapas: Vec<&itens::Tarefa> = tarefas.iter().filter(|t| t.pai_id == projeto_id).collect();
    if etapa {
        let subs: Vec<&itens::Tarefa> = tarefas.iter().filter(|t| t.pai_id == alvo).collect();
        if !subs.is_empty() {
            texto.push_str("\nSubtarefas que já existem nesta etapa (não repita):\n");
            for s in subs {
                texto.push_str(&format!("- {} ({})\n", s.titulo, estado_legivel(&s.estado)));
            }
        }
    } else if !etapas.is_empty() {
        texto.push_str("\nEtapas e tarefas que já existem (não repita):\n");
        for e in etapas {
            texto.push_str(&format!("- {} ({})\n", e.titulo, estado_legivel(&e.estado)));
            for s in tarefas.iter().filter(|t| t.pai_id == e.id) {
                texto.push_str(&format!("  - {} ({})\n", s.titulo, estado_legivel(&s.estado)));
            }
        }
    }
    Ok(Alvo { etapa, pedido_base: texto })
}

/// O pedido completo: o contexto, a proposta atual (com as mudanças feitas à
/// mão) e a conversa até aqui.
pub fn montar_pedido(base: &Alvo, conversa: &[Fala], proposta_atual: Option<&[EtapaProposta]>) -> String {
    let mut texto = base.pedido_base.clone();
    if let Some(p) = proposta_atual.filter(|p| !p.is_empty()) {
        texto.push_str("\nProposta atual (já com as mudanças que a pessoa fez à mão):\n");
        for e in p.iter().take(MAXIMO_DE_ETAPAS) {
            texto.push_str(&format!("- {}\n", cortar(&e.titulo, MAXIMO_DO_TEXTO)));
            if !base.etapa {
                for s in e.subtarefas.iter().take(MAXIMO_DE_SUBTAREFAS) {
                    texto.push_str(&format!("  - {}\n", cortar(s, MAXIMO_DO_TEXTO)));
                }
            }
        }
    }
    let inicio = conversa.len().saturating_sub(MAXIMO_DE_FALAS);
    let falas: Vec<&Fala> = conversa[inicio..].iter().filter(|f| !f.texto.trim().is_empty()).collect();
    if falas.is_empty() {
        texto.push_str("\nA pessoa ainda não escreveu nada: proponha a partir do que está acima.\n");
    } else {
        texto.push_str("\nConversa até aqui:\n");
        for f in falas {
            let quem = if f.papel == "ia" { "IA" } else { "Pessoa" };
            texto.push_str(&format!("{quem}: {}\n", cortar(&f.texto, MAXIMO_DA_FALA)));
        }
    }
    texto.push_str(if base.etapa { "\nResponda com a lista completa de passos." } else { "\nResponda com a proposta completa." });
    texto
}

fn limpar(s: &str) -> Option<String> {
    let s = s
        .trim()
        .trim_start_matches(|c: char| c == '-' || c == '*' || c == '•' || c.is_ascii_digit() || c == '.' || c == ')')
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    (!s.is_empty()).then(|| s.chars().take(MAXIMO_DO_TEXTO).collect())
}

/// Texto de um item que pode vir como texto solto ou como objeto com título.
fn texto_de(v: &Value) -> Option<String> {
    match v {
        Value::String(s) => limpar(s),
        Value::Object(o) => ["titulo", "título", "nome", "texto", "passo", "tarefa"].iter().find_map(|k| o.get(*k)).and_then(Value::as_str).and_then(limpar),
        _ => None,
    }
}

fn lista<'a>(v: &'a Value, chaves: &[&str]) -> Option<&'a Vec<Value>> {
    chaves.iter().find_map(|k| v.get(*k)).and_then(Value::as_array)
}

fn malformada() -> Erro {
    Erro::Ia { motivo: "resposta", mensagem: "A IA respondeu num formato que o Órbita não entendeu. Tente de novo.".into() }
}

/// Lê e valida a proposta. Aceita o JSON pedido, inclusive dentro de um bloco
/// de código ou com texto em volta. Corta nos limites. Resposta sem nenhum item
/// aproveitável é erro (a tela oferece "Tentar de novo").
pub fn ler_proposta(resposta: &str, etapa: bool) -> Result<(Vec<EtapaProposta>, Option<String>), Erro> {
    let json = {
        let objeto = resposta.find('{').zip(resposta.rfind('}')).filter(|(i, j)| i < j).and_then(|(i, j)| serde_json::from_str::<Value>(&resposta[i..=j]).ok());
        objeto.or_else(|| resposta.find('[').zip(resposta.rfind(']')).filter(|(i, j)| i < j).and_then(|(i, j)| serde_json::from_str::<Value>(&resposta[i..=j]).ok()))
    }
    .ok_or_else(malformada)?;

    let explicacao = json
        .get("explicacao")
        .or_else(|| json.get("explicação"))
        .and_then(Value::as_str)
        .map(|s| s.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|s| !s.is_empty())
        .map(|s| s.chars().take(MAXIMO_DA_EXPLICACAO).collect());

    let itens = if json.is_array() { json.as_array() } else if etapa { lista(&json, &["passos", "subtarefas", "etapas", "tarefas"]) } else { lista(&json, &["etapas", "passos"]) };
    let itens = itens.ok_or_else(malformada)?;

    let proposta: Vec<EtapaProposta> = if etapa {
        // Um nível só: se a IA mandar etapas com subtarefas, viram passos em sequência.
        itens
            .iter()
            .flat_map(|v| {
                let subs = lista(v, &["subtarefas", "tarefas", "passos"]).map(|l| l.iter().filter_map(texto_de).collect::<Vec<_>>()).unwrap_or_default();
                if subs.is_empty() { texto_de(v).into_iter().collect() } else { subs }
            })
            .take(MAXIMO_DE_SUBTAREFAS)
            .map(|titulo| EtapaProposta { titulo, subtarefas: vec![] })
            .collect()
    } else {
        itens
            .iter()
            .filter_map(|v| {
                let titulo = texto_de(v)?;
                let subtarefas = lista(v, &["subtarefas", "tarefas", "passos"])
                    .map(|l| l.iter().filter_map(texto_de).take(MAXIMO_DE_SUBTAREFAS).collect())
                    .unwrap_or_default();
                Some(EtapaProposta { titulo, subtarefas })
            })
            .take(MAXIMO_DE_ETAPAS)
            .collect()
    };
    if proposta.is_empty() {
        return Err(malformada());
    }
    Ok((proposta, explicacao))
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::testes::banco_de_teste;

    fn fala(papel: &str, texto: &str) -> Fala {
        Fala { papel: papel.into(), texto: texto.into() }
    }

    #[test]
    fn o_contexto_leva_anotacoes_onde_parei_etapas_e_conversa() {
        let (_pasta, conn) = banco_de_teste();
        let projeto = itens::criar_projeto(&conn, "Mudar de casa", true).unwrap();
        itens::salvar_anotacoes_projeto(&conn, &projeto.id, "Mudança em março. Tenho um gato.").unwrap();
        itens::salvar_onde_parei(
            &conn,
            &projeto.id,
            itens::OndeParei { texto: "Vi três apartamentos".into(), proximo_passo: "Ligar para a imobiliária".into(), ..Default::default() },
        )
        .unwrap();
        let etapa = itens::criar_tarefa(&conn, &projeto.id, "Empacotar a cozinha").unwrap();
        let sub = itens::criar_tarefa(&conn, &etapa.id, "Comprar caixas").unwrap();
        itens::mudar_estado_tarefa(&conn, &sub.id, "feita").unwrap();

        let alvo = contexto(&conn, &projeto.id).unwrap();
        assert!(!alvo.etapa);
        let proposta = vec![EtapaProposta { titulo: "Avisar os amigos".into(), subtarefas: vec!["Mandar mensagem no grupo".into()] }];
        let conversa = vec![fala("pessoa", "Quero terminar até março"), fala("ia", "Propus quatro etapas."), fala("pessoa", "Falta a divulgação")];
        let pedido = montar_pedido(&alvo, &conversa, Some(&proposta));
        for parte in [
            "Projeto: Mudar de casa",
            "Mudança em março. Tenho um gato.",
            "Onde a pessoa parou: Vi três apartamentos",
            "Próximo passo anotado: Ligar para a imobiliária",
            "- Empacotar a cozinha (a fazer)",
            "  - Comprar caixas (feita)",
            "Proposta atual",
            "  - Mandar mensagem no grupo",
            "Pessoa: Quero terminar até março",
            "IA: Propus quatro etapas.",
            "Pessoa: Falta a divulgação",
        ] {
            assert!(pedido.contains(parte), "faltou {parte:?} em:\n{pedido}");
        }
        assert!(sistema(false).contains("\"etapas\""));

        // Etapa: os passos viram subtarefas; mostra as que já existem.
        let alvo = contexto(&conn, &etapa.id).unwrap();
        assert!(alvo.etapa);
        let pedido = montar_pedido(&alvo, &[], None);
        assert!(pedido.contains("Etapa para planejar") && pedido.contains("- Comprar caixas (feita)") && pedido.contains("ainda não escreveu"));
        assert!(sistema(true).contains("\"passos\""));
        // Subtarefa não se planeja (dois níveis).
        assert!(matches!(contexto(&conn, &sub.id), Err(Erro::Ia { motivo: "dois_niveis", .. })));
    }

    #[test]
    fn projeto_vindo_de_ideia_leva_a_nota_da_ideia() {
        let (_pasta, conn) = banco_de_teste();
        let ideia = itens::criar_ideia(&conn, "Podcast sobre autismo").unwrap();
        itens::salvar_nota_ideia(&conn, &ideia.id, "Episódios de 20 minutos").unwrap();
        let projeto = itens::ideia_para_projeto(&conn, &ideia.id, true).unwrap();
        assert!(contexto(&conn, &projeto.id).unwrap().pedido_base.contains("Episódios de 20 minutos"));
    }

    #[test]
    fn a_conversa_longa_leva_so_as_falas_recentes() {
        let alvo = Alvo { etapa: false, pedido_base: "Projeto: X\n".into() };
        let conversa: Vec<Fala> = (0..30).map(|i| fala("pessoa", &format!("fala número {i}."))).collect();
        let pedido = montar_pedido(&alvo, &conversa, None);
        assert!(!pedido.contains("fala número 9.") && pedido.contains("fala número 10.") && pedido.contains("fala número 29."));
    }

    #[test]
    fn le_a_proposta_do_projeto() {
        let resposta = "Claro!\n```json\n{\"explicacao\": \"Juntei as etapas 2 e 3.\", \"etapas\": [{\"titulo\": \"Planejar\", \"subtarefas\": [\"Listar ideias\", \"- Escolher uma\"]}, {\"titulo\": \"Gravar\"}]}\n```";
        let (p, explicacao) = ler_proposta(resposta, false).unwrap();
        assert_eq!(explicacao.as_deref(), Some("Juntei as etapas 2 e 3."));
        assert_eq!(p.len(), 2);
        assert_eq!(p[0], EtapaProposta { titulo: "Planejar".into(), subtarefas: vec!["Listar ideias".into(), "Escolher uma".into()] });
        assert!(p[1].subtarefas.is_empty());
    }

    #[test]
    fn corta_nos_limites() {
        let sub: Vec<String> = (0..20).map(|i| format!("\"s{i}\"")).collect();
        let etapa = format!("{{\"titulo\": \"{}\", \"subtarefas\": [{}]}}", "a".repeat(500), sub.join(","));
        let resposta = format!("{{\"etapas\": [{}]}}", vec![etapa; 20].join(","));
        let (p, _) = ler_proposta(&resposta, false).unwrap();
        assert_eq!(p.len(), MAXIMO_DE_ETAPAS);
        assert_eq!(p[0].subtarefas.len(), MAXIMO_DE_SUBTAREFAS);
        assert_eq!(p[0].titulo.chars().count(), MAXIMO_DO_TEXTO);
    }

    #[test]
    fn na_etapa_fica_um_nivel_so() {
        let (p, _) = ler_proposta(r#"{"passos": ["Abrir o PDF", "Ler o resumo"]}"#, true).unwrap();
        assert_eq!(p.iter().map(|e| e.titulo.as_str()).collect::<Vec<_>>(), vec!["Abrir o PDF", "Ler o resumo"]);
        assert!(p.iter().all(|e| e.subtarefas.is_empty()));
        // Se a IA mandar etapas com subtarefas, as subtarefas viram os passos.
        let (p, _) = ler_proposta(r#"{"etapas": [{"titulo": "A", "subtarefas": ["Um", "Dois"]}, {"titulo": "Três"}]}"#, true).unwrap();
        assert_eq!(p.iter().map(|e| e.titulo.as_str()).collect::<Vec<_>>(), vec!["Um", "Dois", "Três"]);
        // Lista solta também vale.
        assert_eq!(ler_proposta(r#"["Um", "Dois"]"#, true).unwrap().0.len(), 2);
    }

    #[test]
    fn resposta_malformada_vira_mensagem_simples() {
        for ruim in ["Desculpe, não consigo ajudar.", "{\"etapas\": []}", "{\"etapas\": [", "{\"outra\": 1}", "{\"etapas\": [{\"titulo\": \"   \"}]}"] {
            match ler_proposta(ruim, false) {
                Err(Erro::Ia { motivo: "resposta", mensagem }) => assert!(mensagem.contains("Tente de novo")),
                outro => panic!("{ruim:?} deveria falhar, veio {outro:?}"),
            }
        }
    }
}
