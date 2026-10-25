//! Chave de recuperação: 6 palavras sorteadas da lista padrão em português
//! (BIP-39, 2.048 palavras, sem acentos; as 4 primeiras letras identificam cada uma).

use rand::rngs::OsRng;
use rand::Rng;
use std::sync::OnceLock;

pub const QUANTIDADE: usize = 6;

const TEXTO: &str = include_str!("palavras-pt.txt");

pub fn lista() -> &'static [&'static str] {
    static LISTA: OnceLock<Vec<&'static str>> = OnceLock::new();
    LISTA.get_or_init(|| TEXTO.split_whitespace().collect())
}

pub fn sortear() -> Vec<String> {
    let lista = lista();
    (0..QUANTIDADE).map(|_| lista[OsRng.gen_range(0..lista.len())].to_string()).collect()
}

/// Tira acentos simples e deixa minúscula, para aceitar o que a pessoa digitar.
fn simplificar(palavra: &str) -> String {
    palavra
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            outro => outro,
        })
        .collect()
}

/// Reconhece uma palavra da lista. Aceita a palavra inteira ou só as 4 primeiras letras.
pub fn reconhecer(digitada: &str) -> Option<&'static str> {
    let d = simplificar(digitada);
    if d.len() < 4 {
        return None;
    }
    let lista = lista();
    if let Some(p) = lista.iter().find(|p| **p == d) {
        return Some(p);
    }
    let prefixo = &d[..d.char_indices().nth(4).map(|(i, _)| i).unwrap_or(d.len())];
    let candidatas: Vec<_> = lista.iter().filter(|p| p.starts_with(prefixo)).collect();
    match candidatas.as_slice() {
        [unica] if unica.starts_with(&d) || d.len() == 4 => Some(unica),
        _ => None,
    }
}

/// Lê as palavras de um texto qualquer (digitado ou vindo do arquivo de recuperação).
/// Devolve as palavras reconhecidas ou as posições (1 a 6) das que não foram.
pub fn ler(texto: &str) -> Result<Vec<&'static str>, Vec<usize>> {
    let partes: Vec<&str> = texto
        .split(|c: char| c.is_whitespace() || c == ',' || c == '-' || c == '.')
        .filter(|p| !p.is_empty() && !p.chars().all(|c| c.is_ascii_digit()))
        .collect();
    let mut reconhecidas = Vec::new();
    let mut erradas = Vec::new();
    for i in 0..QUANTIDADE {
        match partes.get(i).and_then(|p| reconhecer(p)) {
            Some(p) => reconhecidas.push(p),
            None => erradas.push(i + 1),
        }
    }
    if partes.len() > QUANTIDADE {
        erradas.extend(QUANTIDADE + 1..=partes.len());
    }
    if erradas.is_empty() { Ok(reconhecidas) } else { Err(erradas) }
}

/// Lê o arquivo de recuperação: usa só as linhas numeradas ("1. abacate").
/// Se não houver linhas numeradas, lê o texto inteiro.
pub fn ler_arquivo(texto: &str) -> Result<Vec<&'static str>, Vec<usize>> {
    let numeradas: Vec<&str> = texto
        .lines()
        .filter_map(|linha| {
            let linha = linha.trim();
            let (numero, resto) = linha.split_once('.')?;
            (!numero.is_empty() && numero.chars().all(|c| c.is_ascii_digit())).then(|| resto.trim())
        })
        .collect();
    if numeradas.is_empty() { ler(texto) } else { ler(&numeradas.join(" ")) }
}

/// Texto do arquivo de recuperação, legível por qualquer pessoa.
pub fn texto_do_arquivo(palavras: &[String]) -> String {
    let mut texto = String::from(
        "ÓRBITA · CHAVE DE RECUPERAÇÃO\r\n\r\n\
         Estas 6 palavras abrem os seus dados se você esquecer a senha.\r\n\
         Guarde este arquivo num lugar seguro: pendrive, nuvem ou impresso.\r\n\
         Quem tiver estas palavras e uma cópia dos seus dados consegue abri-los.\r\n\r\n",
    );
    for (i, p) in palavras.iter().enumerate() {
        texto.push_str(&format!("{}. {}\r\n", i + 1, p));
    }
    texto
}

/// Forma única das palavras usada na derivação da chave.
pub fn juntar(palavras: &[&str]) -> String {
    palavras.join(" ")
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn lista_tem_2048_palavras_unicas_pelas_4_primeiras_letras() {
        let l = lista();
        assert_eq!(l.len(), 2048);
        let prefixos: std::collections::HashSet<_> = l.iter().map(|p| &p[..4]).collect();
        assert_eq!(prefixos.len(), 2048);
    }

    #[test]
    fn sorteia_seis_palavras_da_lista() {
        let s = sortear();
        assert_eq!(s.len(), 6);
        assert!(s.iter().all(|p| lista().contains(&p.as_str())));
    }

    #[test]
    fn reconhece_com_maiusculas_acentos_e_abreviacao() {
        assert_eq!(reconhecer("ABACATE"), Some("abacate"));
        assert_eq!(reconhecer("abac"), Some("abacate"));
        assert_eq!(reconhecer("abacáte"), Some("abacate"));
        assert_eq!(reconhecer("aba"), None);
        assert_eq!(reconhecer("abacatx"), None);
    }

    #[test]
    fn arquivo_de_recuperacao_volta_as_mesmas_palavras() {
        let palavras: Vec<String> = sortear();
        let texto = texto_do_arquivo(&palavras);
        let lidas = ler_arquivo(&texto).unwrap();
        assert_eq!(lidas, palavras.iter().map(String::as_str).collect::<Vec<_>>());
    }

    #[test]
    fn le_texto_numerado_e_aponta_as_erradas() {
        let ok = ler("1. abacate 2. abaixo 3. abalar 4. abater 5. abduzir 6. abelha").unwrap();
        assert_eq!(ok.len(), 6);
        assert_eq!(ler("abacate xxxx abalar abater abduzir").unwrap_err(), vec![2, 6]);
    }
}
