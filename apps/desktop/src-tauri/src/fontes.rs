//! Fontes instaladas no computador, para o editor de texto do caderno.
//! Só lê os nomes das famílias (nada é enviado nem guardado). A lista é lida uma
//! vez por sessão do app, porque ler todas as fontes leva alguns décimos de segundo.

use std::collections::BTreeSet;
use std::sync::OnceLock;

static FAMILIAS: OnceLock<Vec<String>> = OnceLock::new();

/// Nomes das famílias de fonte do sistema, em ordem alfabética, sem repetição.
pub fn familias_do_sistema() -> Vec<String> {
    FAMILIAS
        .get_or_init(|| {
            let mut db = fontdb::Database::new();
            db.load_system_fonts();
            familias(db.faces().map(|f| f.families.first().map(|(n, _)| n.clone()).unwrap_or_default()))
        })
        .clone()
}

/// Limpa a lista: tira vazios, nomes escondidos (começam com ".") e repetidos,
/// ordenando sem ligar para maiúsculas.
fn familias(nomes: impl Iterator<Item = String>) -> Vec<String> {
    let mut vistos = BTreeSet::new();
    let mut lista: Vec<String> = nomes
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty() && !n.starts_with('.') && n.chars().all(|c| !c.is_control()))
        .filter(|n| vistos.insert(n.to_lowercase()))
        .collect();
    lista.sort_by_key(|n| n.to_lowercase());
    lista
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn limpa_ordena_e_tira_repetidas() {
        let nomes = ["Times New Roman", "arial", "Arial", "", ".SF NS", "Calibri", "  Georgia "].map(String::from);
        assert_eq!(familias(nomes.into_iter()), vec!["arial", "Calibri", "Georgia", "Times New Roman"]);
    }

    #[test]
    fn le_o_sistema_sem_travar() {
        // No servidor de testes pode não haver fonte nenhuma; só não pode dar erro.
        let lista = familias_do_sistema();
        assert!(lista.windows(2).all(|p| p[0].to_lowercase() < p[1].to_lowercase()));
    }
}
