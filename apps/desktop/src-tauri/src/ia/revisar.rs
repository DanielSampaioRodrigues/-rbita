//! Revisão de texto: a IA corrige ortografia, acentos e pontuação sem mudar o
//! sentido. A interface mostra o antes e o depois; a pessoa escolhe.

pub const SISTEMA: &str = "Você revisa textos em português do Brasil, muitas vezes ditados por voz. \
Corrija ortografia, acentuação, pontuação e letras maiúsculas. Junte frases quebradas pela fala quando ficar claro. \
Não mude o sentido, não troque palavras da pessoa por sinônimos, não acrescente nem tire informação, não comente. \
Responda só com o texto revisado, sem aspas e sem nenhum texto antes ou depois.";

pub const MAXIMO_DE_CARACTERES: usize = 8000;

/// Instruções de sistema para cada jeito de reescrever. "revisar" é o padrão.
/// `instrucao` vale para o modo "livre" (a pessoa escreve o que quer).
pub fn sistema(modo: &str, instrucao: Option<&str>) -> String {
    let base = "Você reescreve textos em português do Brasil para uma pessoa neurodivergente. \
Mantenha o sentido, as informações e a voz da pessoa; não invente nada. \
Se o texto tiver formatação Markdown (negrito, listas, títulos, caixas de tarefa), mantenha a formatação. \
Responda só com o texto reescrito, sem aspas, sem comentários e sem nenhum texto antes ou depois.";
    let pedido = match modo {
        "claro" => "Deixe o texto mais claro e direto, com frases curtas e linguagem literal, sem metáforas.".to_string(),
        "curto" => "Deixe o texto mais curto, só com o essencial.".to_string(),
        "detalhado" => "Deixe o texto mais detalhado e completo, explicando melhor o que já está lá, sem inventar fatos.".to_string(),
        "topicos" => "Reorganize o texto em tópicos (lista com hífen), um assunto por item.".to_string(),
        "leve" => "Deixe o tom mais leve e gentil, sem cobrança e sem culpa.".to_string(),
        "formal" => "Deixe o tom mais formal, adequado para trabalho ou faculdade.".to_string(),
        "livre" => {
            let i: String = instrucao.unwrap_or("").trim().chars().take(500).collect();
            if i.is_empty() { "Revise ortografia, acentuação e pontuação.".to_string() } else { format!("Faça isto com o texto: {i}") }
        }
        _ => return SISTEMA.to_string(),
    };
    format!("{base}\n{pedido}")
}

/// Tira aspas ou blocos de código que alguns modelos colocam em volta.
pub fn limpar(resposta: &str) -> String {
    let t = resposta.trim().trim_start_matches("```").trim_end_matches("```").trim();
    let t = t.strip_prefix('"').and_then(|x| x.strip_suffix('"')).unwrap_or(t);
    t.trim().to_string()
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn cada_modo_tem_sua_instrucao() {
        assert_eq!(sistema("revisar", None), SISTEMA);
        assert!(sistema("topicos", None).contains("tópicos"));
        assert!(sistema("livre", Some("traduza para o inglês")).contains("traduza para o inglês"));
        assert!(sistema("desconhecido", None) == SISTEMA);
    }

    #[test]
    fn tira_embrulhos() {
        assert_eq!(limpar("\"Olá, tudo bem?\""), "Olá, tudo bem?");
        assert_eq!(limpar("```\nTexto.\n```"), "Texto.");
        assert_eq!(limpar("  Ele disse \"oi\".  "), "Ele disse \"oi\".");
    }
}
