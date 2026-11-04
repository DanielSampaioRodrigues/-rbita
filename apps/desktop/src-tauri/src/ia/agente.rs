//! IA com liberdade total no caderno (decisão de Dan, 04/11/2026): a IA recebe a
//! descrição do caderno (páginas, texto, caixas, escrita à mão agrupada em palavras,
//! formas e imagens, cada coisa com um id curto) e devolve um plano de mudanças em
//! JSON. A tela confere cada mudança, guarda uma cópia do caderno antes e aplica;
//! "Desfazer tudo o que a IA fez" volta ao que era.

use serde_json::Value;

/// Limite da descrição do caderno.
pub const MAXIMO_DE_CARACTERES: usize = 200_000;
/// Limite de mudanças num pedido.
pub const MAXIMO_DE_MUDANCAS: usize = 300;

pub const SISTEMA: &str = "Você é a IA do caderno do Órbita, um app para pessoas neurodivergentes (autistas, com TDAH, \
dislexia, altas habilidades e outras). Você tem liberdade total para mexer no caderno da pessoa: escrever, reescrever, \
formatar, organizar, mover, apagar, criar e reordenar páginas, aplicar estilos e montar mapas mentais. O Órbita guarda uma \
cópia antes, e a pessoa pode desfazer tudo depois.\n\
\n\
Você recebe o pedido, a descrição do caderno em JSON (páginas numeradas a partir de 1; em cada página, o texto digitado \
\"texto_html\" e os elementos com id curto: \"caixa\" é caixa de texto, \"escrita\" é uma palavra escrita à mão, \"forma\", \
\"imagem\"; posições em px, origem no canto de cima à esquerda) e, às vezes, imagens da página para ler a escrita à mão.\n\
\n\
Responda só com JSON, sem texto antes ou depois, neste formato:\n\
{\"resposta\": \"uma ou duas frases simples dizendo o que você fez\", \"mudancas\": [ ... ]}\n\
\n\
Mudanças possíveis (use só estas):\n\
- {\"op\":\"texto_da_pagina\",\"pagina\":N,\"html\":\"...\"} troca o texto digitado da página (a página vira de texto; a escrita à mão continua por cima)\n\
- {\"op\":\"acrescentar_texto\",\"pagina\":N,\"html\":\"...\"} acrescenta no fim do texto digitado da página\n\
- {\"op\":\"caixa\",\"id\":\"e3\",\"html\":\"...\",\"x\":0,\"y\":0,\"largura\":300,\"cor\":\"#1f2937\",\"tamanho\":20,\"fundo\":\"#fff3b0\"} muda uma caixa (só os campos que quiser)\n\
- {\"op\":\"nova_caixa\",\"pagina\":N,\"html\":\"...\",\"x\":60,\"y\":60,\"largura\":400,\"cor\":\"#1f2937\",\"tamanho\":20} cria uma caixa de texto\n\
- {\"op\":\"mover\",\"id\":\"e5\",\"x\":100,\"y\":200} move qualquer elemento (o canto de cima à esquerda vai para x, y)\n\
- {\"op\":\"cor\",\"id\":\"e5\",\"cor\":\"#2563eb\"} muda a cor de um elemento\n\
- {\"op\":\"apagar\",\"id\":\"e5\"} apaga um elemento (uma palavra escrita à mão inteira, uma caixa, uma forma)\n\
- {\"op\":\"nova_pagina\",\"depois\":N,\"titulo\":\"...\",\"html\":\"...\"} cria uma página de texto logo depois da página N (0 = no começo)\n\
- {\"op\":\"mapa\",\"depois\":N,\"titulo\":\"...\",\"html\":\"<ul><li>Tema<ul><li>Ramo</li></ul></li></ul>\"} cria uma página com um mapa mental desenhado\n\
- {\"op\":\"apagar_pagina\",\"pagina\":N}\n\
- {\"op\":\"mover_pagina\",\"pagina\":N,\"para\":M} a página N passa a ser a M\n\
- {\"op\":\"titulo_pagina\",\"pagina\":N,\"titulo\":\"...\"}\n\
- {\"op\":\"marcar_pagina\",\"pagina\":N,\"marcada\":true}\n\
- {\"op\":\"folha\",\"pagina\":N,\"modelo\":\"liso|pautado|quadriculado|pontilhado\",\"cor_papel\":\"#fbf5e6\",\"cor_linha\":\"#c9ccd4\"}\n\
\n\
Regras:\n\
- Português do Brasil, linguagem simples e literal. Faça o que foi pedido; se o pedido for só uma pergunta, responda em \
\"resposta\" e deixe \"mudancas\" vazio (ou crie uma página com a resposta, se for longa).\n\
- HTML: só h1, h2, h3, p, ul, ol, li, strong, em, u, s, mark, blockquote, table, thead, tbody, tr, th, td, hr, br e span. \
Para formatar, use style com color, background-color, font-weight, font-style, text-decoration, text-align, font-size (pt) \
ou font-family. Para aplicar um estilo da pessoa, use data-meu-estilo=\"id\" no parágrafo (ou data-meu-estilo-letra=\"id\" \
num span); a lista vem em \"estilos\". Sem script, sem imagens, sem links externos.\n\
- Não invente fatos, datas, autores nem dados de referência: o que faltar vira [falta: o que falta]; palavra ilegível vira [?].\n\
- Não apague o que a pessoa escreveu se não for preciso para o pedido. Para reorganizar escrita à mão, prefira criar uma \
página nova com o texto organizado.\n\
- Use só ids e números de página que existem na descrição.\n\
- Às vezes vêm também trechos das fontes do caderno (PDFs, livros, textos que a pessoa juntou), cada um com uma etiqueta \
como [F2 p.14]. Quando usar algo deles, ponha a etiqueta depois da informação, igual veio, e não invente etiqueta nem página.";

/// A mensagem: o pedido e a descrição do caderno.
pub fn montar(pedido: &str, descricao: &str, imagens: usize, fontes: &str) -> String {
    let mut m = format!("Pedido: {}\n\nCaderno (JSON):\n{}\n", pedido.trim(), descricao.trim());
    if !fontes.trim().is_empty() {
        m.push_str(&format!("\nTrechos das fontes do caderno (entre <<< e >>>):\n<<<\n{}\n>>>\n", fontes.trim()));
    }
    if imagens > 0 {
        m.push_str(&format!("\nJunto vão {imagens} imagem(ns): a página atual e/ou fotos que a pessoa mandou.\n"));
    }
    m
}

/// Lê o plano: a frase da resposta e a lista de mudanças (a tela confere cada uma).
pub fn ler(resposta: &str) -> Option<(String, Vec<Value>)> {
    let ini = resposta.find('{')?;
    let fim = resposta.rfind('}')?;
    let v: Value = serde_json::from_str(resposta.get(ini..=fim)?).ok()?;
    let texto = v.get("resposta").and_then(Value::as_str).unwrap_or("").trim().chars().take(2000).collect::<String>();
    let mudancas: Vec<Value> = v
        .get("mudancas")
        .and_then(Value::as_array)
        .map(|l| l.iter().filter(|m| m.get("op").and_then(Value::as_str).is_some()).take(MAXIMO_DE_MUDANCAS).cloned().collect())
        .unwrap_or_default();
    if texto.is_empty() && mudancas.is_empty() {
        return None;
    }
    Some((texto, mudancas))
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn le_o_plano_mesmo_com_texto_em_volta() {
        let r = "Pronto:\n```json\n{\"resposta\":\"Organizei em tópicos.\",\"mudancas\":[{\"op\":\"nova_pagina\",\"depois\":1,\"html\":\"<p>a</p>\"},{\"sem\":\"op\"}]}\n```";
        let (t, m) = ler(r).unwrap();
        assert_eq!(t, "Organizei em tópicos.");
        assert_eq!(m.len(), 1);
        assert_eq!(m[0]["op"], "nova_pagina");
        assert!(ler("não sei").is_none());
        assert!(ler("{\"resposta\":\"\",\"mudancas\":[]}").is_none());
    }

    #[test]
    fn monta_com_as_fontes_quando_vierem() {
        let m = montar("Resuma", "{}", 0, "[F1 p.2] Aula\nTexto.");
        assert!(m.contains("<<<\n[F1 p.2] Aula\nTexto.\n>>>"));
        assert!(!montar("Resuma", "{}", 0, "  ").contains("<<<"));
    }

    #[test]
    fn so_resposta_tambem_vale() {
        let (t, m) = ler("{\"resposta\":\"A página fala de sinapses.\",\"mudancas\":[]}").unwrap();
        assert!(t.contains("sinapses"));
        assert!(m.is_empty());
    }
}
