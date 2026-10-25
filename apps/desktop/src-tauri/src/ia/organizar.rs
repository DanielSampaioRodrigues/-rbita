//! Separar um texto solto ("tenho consulta quinta, preciso pagar a luz e tive
//! uma ideia de livro") em itens: ideia, tarefa de um projeto ou compromisso.
//! A IA só propõe; a interface mostra a lista e grava só o que a pessoa confirmar.

use chrono::{Datelike, Local, NaiveDate, NaiveTime};
use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;

use crate::banco::itens;
use crate::erro::Erro;

pub const MAXIMO_DE_CARACTERES: usize = 4000;
const MAXIMO_DE_ITENS: usize = 20;
const DIAS: [&str; 7] = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"];

pub const SISTEMA: &str = "Você organiza o que uma pessoa neurodivergente escreveu do jeito que veio à cabeça. \
Separe o texto em itens. Cada item é de um destes tipos:\n\
- \"compromisso\": algo com dia marcado (consulta, aula, reunião, aniversário). Precisa de \"data\" (AAAA-MM-DD); \"hora\" (HH:MM, 24 h) só se a pessoa disse; \"duracaoMin\" só se a pessoa disse.\n\
- \"tarefa\": algo a fazer que pertence a um dos projetos ativos da lista. Use em \"projeto\" o nome exatamente como está na lista.\n\
- \"ideia\": todo o resto (coisas a fazer sem projeto, ideias, lembretes sem data).\n\
Calcule datas relativas (\"quinta\", \"amanhã\", \"dia 3\") a partir da data de hoje informada; \"quinta\" é a próxima quinta-feira a partir de hoje. \
Não invente nada que a pessoa não disse. Escreva cada item em português do Brasil, curto e literal, começando com letra maiúscula. \
Responda só com JSON, sem nenhum texto antes ou depois, neste formato: \
{\"itens\": [{\"tipo\": \"ideia\", \"texto\": \"...\"}, {\"tipo\": \"tarefa\", \"texto\": \"...\", \"projeto\": \"...\"}, {\"tipo\": \"compromisso\", \"texto\": \"...\", \"data\": \"AAAA-MM-DD\", \"hora\": \"HH:MM\", \"duracaoMin\": 60}]}";

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ItemProposto {
    /// ideia, tarefa ou compromisso.
    pub tipo: &'static str,
    pub texto: String,
    /// Só tarefa: o projeto reconhecido (None se a IA citou um que não existe).
    pub projeto_id: Option<String>,
    /// Só compromisso.
    pub data: Option<String>,
    pub hora: Option<String>,
    pub duracao_min: Option<u32>,
}

pub struct ProjetoAtivo {
    pub id: String,
    pub titulo: String,
}

pub fn projetos_ativos(conn: &Connection) -> Result<Vec<ProjetoAtivo>, Erro> {
    Ok(itens::listar_projetos(conn)?
        .into_iter()
        .filter(|p| p.estado == "ativo")
        .map(|p| ProjetoAtivo { id: p.id, titulo: p.titulo })
        .collect())
}

/// A mensagem enviada: a data de hoje (para "quinta", "amanhã"), os nomes dos
/// projetos ativos e o texto da pessoa. Nada mais do banco vai junto.
pub fn montar_pedido(hoje: NaiveDate, agora: NaiveTime, projetos: &[ProjetoAtivo], texto: &str) -> String {
    let mut m = format!(
        "Hoje é {}, {} (horário atual {}).\n",
        DIAS[hoje.weekday().num_days_from_monday() as usize],
        hoje.format("%Y-%m-%d"),
        agora.format("%H:%M")
    );
    if projetos.is_empty() {
        m.push_str("A pessoa não tem projetos ativos: não use o tipo \"tarefa\".\n");
    } else {
        m.push_str("Projetos ativos:\n");
        for p in projetos {
            m.push_str(&format!("- {}\n", p.titulo));
        }
    }
    m.push_str("\nTexto da pessoa:\n");
    m.push_str(texto);
    m
}

pub fn pedido_de_agora(conn: &Connection, texto: &str) -> Result<String, Erro> {
    let texto = texto.trim();
    if texto.is_empty() {
        return Err(Erro::TextoVazio);
    }
    let texto: String = texto.chars().take(MAXIMO_DE_CARACTERES).collect();
    let agora = Local::now();
    Ok(montar_pedido(agora.date_naive(), agora.time(), &projetos_ativos(conn)?, &texto))
}

/// Conversa: a pessoa pede uma mudança na lista que a IA já separou. Vai o
/// pedido original (com a data e os projetos), a lista atual e o que mudar.
pub fn montar_ajuste(pedido_original: &str, itens_atuais: &str, mudanca: &str) -> String {
    let mudanca: String = mudanca.trim().chars().take(1000).collect();
    let itens: String = itens_atuais.chars().take(MAXIMO_DE_CARACTERES).collect();
    format!("{pedido_original}\n\nVocê já separou assim:\n{itens}\n\nA pessoa pediu esta mudança: {mudanca}\nDevolva a lista inteira, já com a mudança, no mesmo formato JSON.")
}

fn normalizar(s: &str) -> String {
    s.trim().to_lowercase()
}

/// Lê e confere a resposta. Data ou hora inválida, tipo desconhecido ou
/// compromisso sem data viram ideia, para nada se perder.
pub fn ler_itens(resposta: &str, projetos: &[ProjetoAtivo]) -> Vec<ItemProposto> {
    let json = match (resposta.find('{'), resposta.rfind('}')) {
        (Some(i), Some(j)) if i < j => serde_json::from_str::<Value>(&resposta[i..=j]).ok(),
        _ => None,
    };
    let Some(lista) = json.as_ref().and_then(|v| v.get("itens")).and_then(Value::as_array) else {
        return Vec::new();
    };
    let texto_de = |v: &Value, chave: &str| v.get(chave).and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty()).map(str::to_string);
    lista
        .iter()
        .filter_map(|v| {
            let texto: String = texto_de(v, "texto").or_else(|| texto_de(v, "titulo"))?.chars().take(300).collect();
            let ideia = |texto: String| ItemProposto { tipo: "ideia", texto, projeto_id: None, data: None, hora: None, duracao_min: None };
            Some(match v.get("tipo").and_then(Value::as_str).unwrap_or("ideia") {
                "compromisso" => {
                    let data = texto_de(v, "data").filter(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").is_ok());
                    let hora = texto_de(v, "hora").filter(|h| NaiveTime::parse_from_str(h, "%H:%M").is_ok());
                    let duracao_min = v.get("duracaoMin").and_then(Value::as_u64).filter(|m| (5..=24 * 60).contains(m)).map(|m| m as u32);
                    match data {
                        Some(data) => ItemProposto { tipo: "compromisso", texto, projeto_id: None, data: Some(data), hora, duracao_min },
                        None => ideia(texto),
                    }
                }
                "tarefa" => {
                    let nome = texto_de(v, "projeto").map(|p| normalizar(&p));
                    let projeto_id = nome.and_then(|n| projetos.iter().find(|p| normalizar(&p.titulo) == n)).map(|p| p.id.clone());
                    ItemProposto { tipo: "tarefa", texto, projeto_id, data: None, hora: None, duracao_min: None }
                }
                _ => ideia(texto),
            })
        })
        .take(MAXIMO_DE_ITENS)
        .collect()
}

#[cfg(test)]
mod testes {
    use super::*;

    fn projetos() -> Vec<ProjetoAtivo> {
        vec![ProjetoAtivo { id: "p1".into(), titulo: "TCC: atenção".into() }]
    }

    #[test]
    fn o_pedido_tem_a_data_e_os_projetos() {
        let hoje = NaiveDate::from_ymd_opt(2026, 10, 25).unwrap();
        let m = montar_pedido(hoje, NaiveTime::from_hms_opt(14, 30, 0).unwrap(), &projetos(), "pagar a luz");
        assert!(m.starts_with("Hoje é domingo, 2026-10-25 (horário atual 14:30)."));
        assert!(m.contains("- TCC: atenção") && m.ends_with("pagar a luz"));
        assert!(montar_pedido(hoje, NaiveTime::MIN, &[], "x").contains("não use o tipo \"tarefa\""));
    }

    #[test]
    fn ajuste_leva_a_lista_atual_e_o_pedido() {
        let m = montar_ajuste("Hoje é domingo...\nTexto da pessoa:\nconsulta quinta", r#"{"itens":[{"tipo":"compromisso"}]}"#, "a consulta é às 16h");
        assert!(m.contains("consulta quinta") && m.contains(r#""tipo":"compromisso""#) && m.contains("às 16h"));
    }

    #[test]
    fn confere_cada_item_e_nao_perde_nada() {
        let resposta = r#"Aqui está: {"itens": [
            {"tipo": "compromisso", "texto": "Consulta", "data": "2026-10-29", "hora": "15:00"},
            {"tipo": "compromisso", "texto": "Aniversário da Ana", "data": "29/10"},
            {"tipo": "compromisso", "texto": "Aula", "data": "2026-10-30", "hora": "25:99", "duracaoMin": 90},
            {"tipo": "tarefa", "texto": "Ler o artigo", "projeto": "tcc: atenção "},
            {"tipo": "tarefa", "texto": "Pintar a sala", "projeto": "Casa"},
            {"tipo": "lembrete", "texto": "Pagar a luz"},
            {"tipo": "ideia", "texto": "  "}
        ]}"#;
        let itens = ler_itens(resposta, &projetos());
        assert_eq!(itens.len(), 6);
        assert_eq!((itens[0].tipo, itens[0].hora.as_deref()), ("compromisso", Some("15:00")));
        assert_eq!(itens[1].tipo, "ideia"); // data em formato errado
        assert_eq!((itens[2].tipo, itens[2].hora.as_deref(), itens[2].duracao_min), ("compromisso", None, Some(90)));
        assert_eq!(itens[3].projeto_id.as_deref(), Some("p1"));
        assert_eq!((itens[4].tipo, itens[4].projeto_id.as_deref()), ("tarefa", None));
        assert_eq!(itens[5].tipo, "ideia");
        assert!(ler_itens("não entendi", &projetos()).is_empty());
    }
}
