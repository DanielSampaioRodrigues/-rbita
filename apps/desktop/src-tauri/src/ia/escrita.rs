//! Corretor da escrita à mão: vai a imagem da página com uma caixa numerada em volta
//! de cada palavra escrita à mão; a IA lê cada uma e diz se está escrita errada, com
//! sugestões. A tela sublinha as erradas em vermelho; a pessoa toca e escolhe.

use serde::{Deserialize, Serialize};

/// Limite de palavras por pedido (uma página cheia de escrita tem umas 250).
pub const MAXIMO_DE_PALAVRAS: usize = 400;

pub const SISTEMA: &str = "Você confere a ortografia de textos escritos à mão em português do Brasil. Recebe a imagem de uma \
página com caixas vermelhas numeradas: cada caixa envolve uma palavra escrita à mão (o número fica no canto da caixa). \
Para cada número, leia a palavra dentro da caixa e diga se ela está escrita errada (letra trocada, faltando ou sobrando, \
acento errado ou faltando). Não marque como erro nomes próprios, siglas, números, abreviações comuns nem palavras de \
outras línguas. Se não der para ler a palavra, deixe \"lido\" vazio e \"errada\" falso. Sugestões: até 3 palavras \
certas, a mais provável primeiro, mantendo maiúscula e minúscula como a pessoa escreveu.\n\
Responda só com JSON, sem texto antes ou depois, neste formato:\n\
{\"palavras\":[{\"n\":1,\"lido\":\"neuronio\",\"errada\":true,\"sugestoes\":[\"neurônio\"]}]}\n\
Inclua só as palavras erradas.";

/// A mensagem: quantas caixas há.
pub fn montar(quantas: usize) -> String {
    format!("A página tem {quantas} caixas numeradas (de 1 a {quantas}). Confira a ortografia de cada palavra escrita à mão e responda só com o JSON.")
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct PalavraConferida {
    pub n: u32,
    pub lido: String,
    pub sugestoes: Vec<String>,
}

#[derive(Deserialize)]
struct Bruta {
    #[serde(default)]
    n: u32,
    #[serde(default)]
    lido: String,
    #[serde(default)]
    errada: bool,
    #[serde(default)]
    sugestoes: Vec<String>,
}

#[derive(Deserialize)]
struct Lista {
    #[serde(default)]
    palavras: Vec<Bruta>,
}

/// Lê o JSON da resposta (tolerante a texto em volta e a cercas de código). Só fica
/// o que é palavra errada, com número válido e pelo menos uma sugestão diferente do lido.
pub fn ler(resposta: &str, quantas: usize) -> Option<Vec<PalavraConferida>> {
    let ini = resposta.find('{')?;
    let fim = resposta.rfind('}')?;
    let lista: Lista = serde_json::from_str(resposta.get(ini..=fim)?).ok()?;
    let mut vistos = std::collections::HashSet::new();
    Some(
        lista
            .palavras
            .into_iter()
            .filter(|p| p.errada && p.n >= 1 && (p.n as usize) <= quantas && vistos.insert(p.n))
            .filter_map(|p| {
                let lido: String = p.lido.trim().chars().take(60).collect();
                let sugestoes: Vec<String> = p
                    .sugestoes
                    .into_iter()
                    .map(|s| s.trim().chars().take(60).collect::<String>())
                    .filter(|s| !s.is_empty() && *s != lido)
                    .take(3)
                    .collect();
                (!sugestoes.is_empty()).then_some(PalavraConferida { n: p.n, lido, sugestoes })
            })
            .collect(),
    )
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn le_so_as_erradas_com_numero_valido() {
        let r = "Aqui está:\n```json\n{\"palavras\":[{\"n\":2,\"lido\":\"neuronio\",\"errada\":true,\"sugestoes\":[\"neurônio\",\"neurônios\",\"a\",\"b\"]},\
{\"n\":3,\"lido\":\"casa\",\"errada\":false,\"sugestoes\":[]},{\"n\":99,\"lido\":\"x\",\"errada\":true,\"sugestoes\":[\"y\"]},\
{\"n\":2,\"lido\":\"de novo\",\"errada\":true,\"sugestoes\":[\"z\"]},{\"n\":4,\"lido\":\"igual\",\"errada\":true,\"sugestoes\":[\"igual\"]}]}\n```";
        let v = ler(r, 10).unwrap();
        assert_eq!(v, vec![PalavraConferida { n: 2, lido: "neuronio".into(), sugestoes: vec!["neurônio".into(), "neurônios".into(), "a".into()] }]);
        assert!(ler("não sei", 3).is_none());
    }
}
