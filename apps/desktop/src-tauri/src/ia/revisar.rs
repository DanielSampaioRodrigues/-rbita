//! Revisão de texto: a IA corrige ortografia, acentos e pontuação sem mudar o
//! sentido. A interface mostra o antes e o depois; a pessoa escolhe.

pub const SISTEMA: &str = "Você revisa textos em português do Brasil, muitas vezes ditados por voz. \
Corrija ortografia, acentuação, pontuação e letras maiúsculas. Junte frases quebradas pela fala quando ficar claro. \
Não mude o sentido, não troque palavras da pessoa por sinônimos, não acrescente nem tire informação, não comente. \
Responda só com o texto revisado, sem aspas e sem nenhum texto antes ou depois.";

pub const MAXIMO_DE_CARACTERES: usize = 8000;

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
    fn tira_embrulhos() {
        assert_eq!(limpar("\"Olá, tudo bem?\""), "Olá, tudo bem?");
        assert_eq!(limpar("```\nTexto.\n```"), "Texto.");
        assert_eq!(limpar("  Ele disse \"oi\".  "), "Ele disse \"oi\".");
    }
}
