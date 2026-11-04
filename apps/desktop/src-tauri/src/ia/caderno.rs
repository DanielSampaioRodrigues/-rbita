//! IA do caderno: a pessoa pede qualquer coisa sobre a página (organizar, resumir,
//! passar a escrita à mão para texto, mapa mental, ABNT...). Vai o texto digitado e,
//! quando houver, imagens da página (escrita à mão, desenho) ou fotos (quadro da aula).
//! A resposta é HTML simples, pronto para pôr numa página; a tela limpa de novo
//! (DOMPurify) e só põe no caderno quando a pessoa escolhe (a IA propõe, a pessoa confirma).

/// Limite do texto da página que vai junto.
pub const MAXIMO_DE_CARACTERES: usize = 60_000;
/// Limite de imagens por pedido.
pub const MAXIMO_DE_IMAGENS: usize = 6;
/// Limite de cada imagem (data: URL), para não mandar foto gigante sem querer.
pub const MAXIMO_POR_IMAGEM: usize = 8_000_000;

pub const SISTEMA: &str = "Você é a IA do caderno do Órbita, um app de organização para pessoas neurodivergentes \
(autistas, com TDAH, dislexia, altas habilidades e outras). A pessoa está estudando ou trabalhando num caderno e pede \
ajuda com o que está na página. O texto digitado vem na mensagem; quando houver, vêm também imagens da página \
(escrita à mão, desenhos) ou fotos (quadro da aula, slides, livro).\n\
\n\
Regras:\n\
- Responda sempre em português do Brasil, com linguagem simples, direta e literal.\n\
- Faça exatamente o que foi pedido, sem acrescentar assunto.\n\
- Não invente fatos, datas, autores, páginas nem dados de referência. Se faltar um dado, escreva [falta: o que falta]. \
Se uma palavra escrita à mão não der para ler, escreva [?] no lugar dela.\n\
- Ao transcrever escrita à mão ou foto, copie fielmente, na ordem em que aparece. Corrija a ortografia só se pedirem.\n\
- Ao organizar, resumir ou reestruturar, mantenha as informações da pessoa: mude só a ordem e a forma.\n\
- Formato da resposta: só o conteúdo pronto para pôr no caderno, em HTML simples, usando apenas estas marcas: \
h1, h2, h3, p, ul, ol, li, strong, em, u, s, blockquote, table, thead, tbody, tr, th, td, hr, br. \
Sem CSS, sem script, sem imagens, sem explicação antes ou depois e sem cercas de código.\n\
- Mapa mental: quando pedirem um mapa mental, devolva uma lista <ul> aninhada com um único <li> no primeiro nível \
(o tema central); os filhos dele são os ramos, e os filhos dos ramos, os detalhes. Frases curtas.\n\
- Normas acadêmicas (ABNT, APA ou outra que pedirem): siga a norma pedida. Nas referências, use só os dados que a \
pessoa deu ou que aparecem na página, e marque o que faltar.\n\
- Se o pedido for uma pergunta, responda em poucos parágrafos <p>.";

/// A mensagem: o pedido, o texto da página e quantas imagens vão junto.
pub fn montar(pedido: &str, contexto: &str, imagens: usize) -> String {
    let mut m = format!("Pedido: {}\n", pedido.trim());
    let contexto = contexto.trim();
    if !contexto.is_empty() {
        m.push_str("\nTexto digitado na página (entre <<< e >>>):\n<<<\n");
        m.push_str(contexto);
        m.push_str("\n>>>\n");
    }
    match imagens {
        0 => {}
        1 => m.push_str("\nJunto vai 1 imagem: a página do caderno ou uma foto que a pessoa escolheu.\n"),
        n => m.push_str(&format!("\nJunto vão {n} imagens: páginas do caderno ou fotos que a pessoa escolheu, na ordem em que ela mandou.\n")),
    }
    m
}

/// Tira o que não é conteúdo: cercas de código ("```html ... ```") e espaços nas pontas.
pub fn limpar(resposta: &str) -> String {
    let t = resposta.trim();
    let t = t.strip_prefix("```html").or_else(|| t.strip_prefix("```HTML")).or_else(|| t.strip_prefix("```")).unwrap_or(t);
    let t = t.strip_suffix("```").unwrap_or(t);
    t.trim().to_string()
}

/// A imagem é um data: URL de imagem (png, jpeg, webp ou gif) e não é grande demais?
pub fn imagem_valida(url: &str) -> bool {
    url.len() <= MAXIMO_POR_IMAGEM
        && ["data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,", "data:image/gif;base64,"].iter().any(|p| url.starts_with(p))
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn monta_o_pedido_com_o_texto_e_as_imagens() {
        let m = montar("Resuma", "A sinapse liga neurônios.", 2);
        assert!(m.starts_with("Pedido: Resuma"));
        assert!(m.contains("<<<\nA sinapse liga neurônios.\n>>>"));
        assert!(m.contains("Junto vão 2 imagens"));
        assert!(!montar("Oi", "", 0).contains("<<<"));
    }

    #[test]
    fn limpa_as_cercas_de_codigo() {
        assert_eq!(limpar("```html\n<p>Oi</p>\n```"), "<p>Oi</p>");
        assert_eq!(limpar("  <h1>T</h1> "), "<h1>T</h1>");
    }

    #[test]
    fn so_aceita_imagem_em_data_url() {
        assert!(imagem_valida("data:image/png;base64,AAAA"));
        assert!(!imagem_valida("https://exemplo.com/foto.png"));
        assert!(!imagem_valida("data:text/html;base64,AAAA"));
    }
}
