//! Quebrar uma tarefa (ou um projeto) em passos pequenos. A IA só sugere;
//! a interface mostra a lista e só cria o que a pessoa confirmar.

use rusqlite::Connection;
use serde_json::Value;

use crate::banco::itens;
use crate::erro::Erro;

pub const SISTEMA: &str = "Você ajuda pessoas neurodivergentes (autistas, com TDAH, dislexia e outras) a começar tarefas. \
Quebre o que for pedido em passos pequenos, concretos e fáceis de começar. Cada passo começa com um verbo e tem no máximo 12 palavras. \
Escreva em português do Brasil, com linguagem simples e literal, sem julgamento e sem metáforas. \
Não repita passos que já existem. Sugira de 3 a 7 passos, na ordem em que fazem sentido. \
Responda só com JSON, sem nenhum texto antes ou depois, neste formato: {\"passos\": [\"...\", \"...\"]}";

pub const MAXIMO_DE_PASSOS: usize = 10;

/// O que vai ser enviado, montado a partir do banco. `alvo`: um projeto (sugere
/// etapas) ou uma etapa (sugere subtarefas). Subtarefas não se quebram: o
/// Órbita tem dois níveis.
pub fn montar_pedido(conn: &Connection, alvo: &str) -> Result<String, Erro> {
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
        mensagem: "Esta já é uma subtarefa. O Órbita tem dois níveis: dá para quebrar o projeto ou uma etapa.".into(),
    })?;
    let tarefas = itens::listar_tarefas(conn, &projeto_id)?;
    let existentes: Vec<&str> = tarefas.iter().filter(|t| t.pai_id == alvo).map(|t| t.titulo.as_str()).collect();

    let mut texto = format!("Projeto: {}\n", projeto.titulo);
    if tipo == "tarefa" {
        let etapa = tarefas.iter().find(|t| t.id == alvo).ok_or(Erro::NaoEncontrado)?;
        texto.push_str(&format!("Tarefa para quebrar em passos: {}\n", etapa.titulo));
    } else {
        texto.push_str("Quebre o projeto inteiro em etapas.\n");
        if let Some(passo) = projeto.onde_parei.as_ref().map(|o| o.proximo_passo.trim()).filter(|p| !p.is_empty()) {
            texto.push_str(&format!("Próximo passo anotado pela pessoa: {passo}\n"));
        }
    }
    if !existentes.is_empty() {
        texto.push_str("Passos que já existem (não repita):\n");
        for e in existentes {
            texto.push_str(&format!("- {e}\n"));
        }
    }
    Ok(texto)
}

/// Lê os passos da resposta. Aceita o JSON pedido, JSON dentro de bloco de
/// código, uma lista solta ou, em último caso, uma linha por passo.
pub fn ler_passos(resposta: &str) -> Vec<String> {
    let limpar = |s: &str| -> Option<String> {
        let s = s.trim().trim_start_matches(|c: char| c == '-' || c == '*' || c == '•' || c.is_ascii_digit() || c == '.' || c == ')').trim();
        (!s.is_empty()).then(|| s.chars().take(200).collect())
    };
    let do_json = |v: Value| -> Option<Vec<String>> {
        let lista = v.get("passos").cloned().unwrap_or(v);
        Some(lista.as_array()?.iter().filter_map(|p| p.as_str().and_then(limpar)).collect())
    };
    let tentar = |abre: char, fecha: char| -> Option<Vec<String>> {
        let (i, j) = (resposta.find(abre)?, resposta.rfind(fecha)?);
        (i < j).then(|| serde_json::from_str::<Value>(&resposta[i..=j]).ok()).flatten().and_then(do_json)
    };
    let passos = tentar('{', '}')
        .or_else(|| tentar('[', ']'))
        .unwrap_or_else(|| resposta.lines().filter(|l| !l.trim_start().starts_with("```")).filter_map(limpar).collect());
    passos.into_iter().take(MAXIMO_DE_PASSOS).collect()
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::testes::banco_de_teste;

    #[test]
    fn le_respostas_em_varios_formatos() {
        assert_eq!(ler_passos(r#"{"passos": ["Abrir o PDF", "Ler o resumo"]}"#), vec!["Abrir o PDF", "Ler o resumo"]);
        assert_eq!(ler_passos("Claro!\n```json\n{\"passos\": [\"Separar a roupa\"]}\n```"), vec!["Separar a roupa"]);
        assert_eq!(ler_passos(r#"["Um", "Dois"]"#), vec!["Um", "Dois"]);
        assert_eq!(ler_passos("1. Abrir a planilha\n2) Somar a coluna\n- Salvar"), vec!["Abrir a planilha", "Somar a coluna", "Salvar"]);
        assert_eq!(ler_passos(&format!("[{}]", vec!["\"x\""; 20].join(","))).len(), MAXIMO_DE_PASSOS);
    }

    #[test]
    fn o_pedido_leva_so_o_necessario() {
        let (_pasta, conn) = banco_de_teste();
        let projeto = itens::criar_projeto(&conn, "Mudar de casa", true).unwrap();
        let etapa = itens::criar_tarefa(&conn, &projeto.id, "Empacotar a cozinha").unwrap();
        itens::criar_tarefa(&conn, &etapa.id, "Comprar caixas").unwrap();
        let pedido = montar_pedido(&conn, &etapa.id).unwrap();
        assert!(pedido.contains("Mudar de casa") && pedido.contains("Empacotar a cozinha") && pedido.contains("- Comprar caixas"));
        let sub = itens::listar_tarefas(&conn, &projeto.id).unwrap().into_iter().find(|t| t.titulo == "Comprar caixas").unwrap();
        assert!(matches!(montar_pedido(&conn, &sub.id), Err(Erro::Ia { motivo: "dois_niveis", .. })));
        assert!(montar_pedido(&conn, &projeto.id).unwrap().contains("- Empacotar a cozinha"));
    }
}
