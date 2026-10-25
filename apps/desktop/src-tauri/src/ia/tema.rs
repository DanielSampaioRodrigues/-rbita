//! Criar tema com IA. Qualquer IA de texto escreve o tema (cores e um desenho
//! em SVG); algumas (GPT, Gemini, Grok) também têm modelos que geram imagem.
//! O tema volta como texto: a interface confere o contraste, limpa o SVG e só
//! então mostra no editor, onde a pessoa ainda pode mexer em tudo.

pub const SISTEMA: &str = "Você cria temas visuais para o Órbita, um organizador para pessoas neurodivergentes. \
Os temas devem ser calmos e confortáveis para quem tem sensibilidade sensorial: nada de cores muito saturadas, nada de vermelho gritante, contraste alto no texto. \
Responda só com um JSON, sem nenhum texto antes ou depois, neste formato:\n\
{\"nome\": \"nome curto do tema\", \"cantos\": 1, \"sombra\": true, \"claro\": PALETA, \"escuro\": PALETA, \"fundoSvg\": \"<svg ...>...</svg>\"}\n\
PALETA tem estas 11 chaves, cada uma com uma cor hexadecimal #rrggbb: \
fundo (fundo da janela), superficie (painéis e cartões), superficieAlternativa (áreas destacadas dentro dos painéis), \
texto (contraste de pelo menos 7:1 sobre fundo, superficie e superficieAlternativa), textoSuave (pelo menos 4.5:1), \
borda (divisórias, pode ser sutil), bordaControle (contorno de campos e botões, pelo menos 3:1), \
destaque (botões principais e links, pelo menos 4.5:1 sobre os fundos), textoSobreDestaque (texto sobre o destaque, pelo menos 4.5:1), \
foco (anel de foco do teclado, pelo menos 3:1), atencao (avisos, pelo menos 4.5:1, sem ser vermelho vivo).\n\
No modo escuro, os fundos são escuros e o texto é claro. \
\"cantos\" vai de 0.3 (retos) a 1.4 (redondos). \
\"fundoSvg\" é opcional: um padrão discreto que se repete lado a lado (ladrilho), com viewBox de até 400 por 400, cores suaves próximas do fundo, \
sem texto, sem scripts, sem imagens nem links externos, com no máximo 4000 caracteres. Se a pessoa pedir sem desenho, não inclua \"fundoSvg\".";

pub const MAXIMO_PEDIDO: usize = 2000;

/// Monta a mensagem: o pedido e, se houver, o tema anterior para ajustar.
pub fn montar_pedido(pedido: &str, anterior: Option<&str>, com_desenho: bool) -> String {
    let pedido: String = pedido.trim().chars().take(MAXIMO_PEDIDO).collect();
    let desenho = if com_desenho { "Inclua o fundoSvg." } else { "Não inclua fundoSvg." };
    match anterior {
        Some(a) => format!("Este é o tema atual:\n{a}\n\nAjuste o tema assim: {pedido}\n{desenho} Mantenha o que a pessoa não pediu para mudar."),
        None => format!("Crie um tema assim: {pedido}\n{desenho}"),
    }
}

/// Modelos de imagem na lista do provedor (nomes mudam com o tempo; por isso
/// a lista vem da conta da pessoa, não de uma lista fixa).
pub fn modelos_de_imagem(todos: &[String]) -> Vec<String> {
    let mut m: Vec<String> = todos
        .iter()
        .filter(|n| {
            let n = n.to_lowercase();
            (n.contains("image") || n.contains("imagen") || n.contains("dall-e")) && !n.contains("vision") && !n.contains("embedding")
        })
        .cloned()
        .collect();
    m.sort();
    m
}

pub fn pedido_de_imagem(descricao: &str) -> String {
    let d: String = descricao.trim().chars().take(MAXIMO_PEDIDO).collect();
    format!(
        "Papel de parede horizontal para o fundo de um aplicativo calmo, para pessoas com sensibilidade sensorial. \
Cores suaves, pouco contraste, poucos detalhes, sem texto, sem letras, sem pessoas em primeiro plano. Tema: {d}"
    )
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn pedido_leva_o_tema_anterior_para_ajustar() {
        assert!(montar_pedido("floresta à noite", None, true).contains("Inclua o fundoSvg"));
        let m = montar_pedido("mais escuro", Some("{\"nome\":\"x\"}"), false);
        assert!(m.contains("{\"nome\":\"x\"}") && m.contains("mais escuro") && m.contains("Não inclua"));
    }

    #[test]
    fn acha_modelos_de_imagem_pela_lista() {
        let todos: Vec<String> = ["gpt-x", "gpt-image-2", "dall-e-3", "imagen-4", "text-embedding-image", "grok-vision-image"].iter().map(|s| s.to_string()).collect();
        assert_eq!(modelos_de_imagem(&todos), vec!["dall-e-3", "gpt-image-2", "imagen-4"]);
    }
}
