//! Pastas de projetos: atalhos que a pessoa cria para juntar projetos
//! (ex.: "Produtos da editora"). Um projeto pode estar em várias pastas; tirar
//! de uma pasta ou apagar a pasta não apaga o projeto, que continua em "Todos".
//!
//! Tudo no modelo comum, sem tabela nova (e por isso já sincroniza):
//! - pasta:    `item` tipo 'pasta_projeto', titulo = nome, ordem = posição na
//!             fileira, dados = { cor } (chave da paleta das pastas do Caderno).
//! - pertença: `ligacao` tipo 'na_pasta', origem = projeto, destino = pasta.
//!             O id é fixo para cada par (`na_pasta:<projeto>:<pasta>`): pôr de novo
//!             reaproveita a mesma linha. Assim dois aparelhos que põem o mesmo
//!             projeto na mesma pasta não criam duas linhas, e "pôr" num aparelho e
//!             "tirar" no outro se resolvem pelo mais recente, como o resto.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::{agora_ms, novo_id};
use crate::erro::Erro;

/// As mesmas cores das pastas do Caderno (a tela desenha; aqui só confere o nome).
pub const CORES: [&str; 10] = ["areia", "pessego", "rosa", "lavanda", "ceu", "mar", "menta", "musgo", "terra", "cinza"];
const COR_PADRAO: &str = "areia";
const MAXIMO_NOME: usize = 60;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PastaProjeto {
    #[serde(default)]
    pub id: String,
    pub nome: String,
    #[serde(default)]
    pub cor: String,
    #[serde(default)]
    pub ordem: f64,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct DadosPasta {
    #[serde(default)]
    cor: String,
}

fn cor_valida(cor: &str) -> String {
    if CORES.contains(&cor) { cor.to_string() } else { COR_PADRAO.to_string() }
}

fn id_da_pertenca(projeto: &str, pasta: &str) -> String {
    format!("na_pasta:{projeto}:{pasta}")
}

/// As pastas, na ordem que a pessoa escolheu.
pub fn listar(conn: &Connection) -> Result<Vec<PastaProjeto>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, dados, ordem, criado_em FROM item WHERE tipo = 'pasta_projeto' AND excluido_em IS NULL ORDER BY ordem, criado_em, id",
    )?;
    let lista = c
        .query_map([], |r| {
            let d: DadosPasta = serde_json::from_str(&r.get::<_, String>(2)?).unwrap_or_default();
            Ok(PastaProjeto { id: r.get(0)?, nome: r.get(1)?, cor: cor_valida(&d.cor), ordem: r.get(3)?, criado_em: r.get(4)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

/// Cria (id vazio, entra no fim da fileira) ou muda nome e cor.
pub fn salvar(conn: &Connection, mut p: PastaProjeto) -> Result<PastaProjeto, Erro> {
    p.nome = p.nome.trim().chars().take(MAXIMO_NOME).collect::<String>().trim().to_string();
    if p.nome.is_empty() {
        return Err(Erro::TextoVazio);
    }
    p.cor = cor_valida(&p.cor);
    let dados = serde_json::to_string(&DadosPasta { cor: p.cor.clone() }).map_err(|e| Erro::Interno(e.to_string()))?;
    let agora = agora_ms();
    if p.id.is_empty() {
        p.id = novo_id();
        p.criado_em = agora;
        p.ordem = conn.query_row(
            "SELECT coalesce(max(ordem), -1) + 1 FROM item WHERE tipo = 'pasta_projeto' AND excluido_em IS NULL",
            [],
            |r| r.get(0),
        )?;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, dados, ordem, criado_em, alterado_em) VALUES (?1, 'pasta_projeto', ?2, ?3, ?4, ?5, ?5)",
            params![p.id, p.nome, dados, p.ordem, agora],
        )?;
    } else {
        // Só marca alteração se algo mudou (a sincronização mescla pelo alterado_em).
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, dados = ?3, alterado_em = ?4
             WHERE id = ?1 AND tipo = 'pasta_projeto' AND excluido_em IS NULL AND (titulo IS NOT ?2 OR dados IS NOT ?3)",
            params![p.id, p.nome, dados, agora],
        )?;
        if n == 0 {
            let existe: i64 = conn.query_row(
                "SELECT count(*) FROM item WHERE id = ?1 AND tipo = 'pasta_projeto' AND excluido_em IS NULL",
                [&p.id],
                |r| r.get(0),
            )?;
            if existe == 0 {
                return Err(Erro::NaoEncontrado);
            }
        }
        let (ordem, criado_em) = conn.query_row("SELECT ordem, criado_em FROM item WHERE id = ?1", [&p.id], |r| Ok((r.get(0)?, r.get(1)?)))?;
        p.ordem = ordem;
        p.criado_em = criado_em;
    }
    Ok(p)
}

/// Apaga a pasta e as pertenças dela (na mesma hora, para viajar junto).
/// Os projetos não mudam: continuam em "Todos" e nas outras pastas.
pub fn excluir(conn: &Connection, id: &str) -> Result<(), Erro> {
    let agora = agora_ms();
    conn.execute(
        "UPDATE ligacao SET excluido_em = ?2, alterado_em = ?2 WHERE tipo = 'na_pasta' AND destino_id = ?1 AND excluido_em IS NULL",
        params![id, agora],
    )?;
    conn.execute(
        "UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'pasta_projeto' AND excluido_em IS NULL",
        params![id, agora],
    )?;
    Ok(())
}

/// Nova ordem da fileira (lista completa de ids). Só grava as que mudaram de lugar.
pub fn reordenar(conn: &Connection, ids: &[String]) -> Result<(), Erro> {
    let agora = agora_ms();
    for (i, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE item SET ordem = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo = 'pasta_projeto' AND excluido_em IS NULL AND ordem != ?2",
            params![id, i as f64, agora],
        )?;
    }
    Ok(())
}

/// Põe (`dentro` = true) ou tira o projeto da pasta. Não mexe no projeto em si
/// (nem na data de alteração dele, que ordena a lista).
pub fn definir(conn: &Connection, projeto: &str, pasta: &str, dentro: bool) -> Result<(), Erro> {
    let agora = agora_ms();
    let id = id_da_pertenca(projeto, pasta);
    if dentro {
        let vivos: i64 = conn.query_row(
            "SELECT (SELECT count(*) FROM item WHERE id = ?1 AND tipo = 'projeto' AND excluido_em IS NULL)
                  + (SELECT count(*) FROM item WHERE id = ?2 AND tipo = 'pasta_projeto' AND excluido_em IS NULL)",
            params![projeto, pasta],
            |r| r.get(0),
        )?;
        if vivos != 2 {
            return Err(Erro::NaoEncontrado);
        }
        conn.execute(
            "INSERT INTO ligacao (id, origem_tipo, origem_id, destino_tipo, destino_id, tipo, criado_em, alterado_em)
             VALUES (?1, 'item', ?2, 'item', ?3, 'na_pasta', ?4, ?4)
             ON CONFLICT (id) DO UPDATE SET excluido_em = NULL, alterado_em = excluded.alterado_em
             WHERE ligacao.excluido_em IS NOT NULL",
            params![id, projeto, pasta, agora],
        )?;
    } else {
        conn.execute(
            "UPDATE ligacao SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND excluido_em IS NULL",
            params![id, agora],
        )?;
    }
    Ok(())
}

/// Ids das pastas (vivas) em que o projeto está, na ordem da fileira.
pub fn do_projeto(conn: &Connection, projeto: &str) -> Result<Vec<String>, Erro> {
    let mut c = conn.prepare_cached(
        "SELECT DISTINCT p.id, p.ordem, p.criado_em FROM ligacao l
         JOIN item p ON p.id = l.destino_id AND p.tipo = 'pasta_projeto' AND p.excluido_em IS NULL
         WHERE l.tipo = 'na_pasta' AND l.origem_id = ?1 AND l.excluido_em IS NULL
         ORDER BY p.ordem, p.criado_em, p.id",
    )?;
    let ids = c.query_map([projeto], |r| r.get(0))?.collect::<Result<Vec<String>, _>>()?;
    Ok(ids)
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::itens;
    use crate::banco::testes::banco_de_teste;

    fn nova(conn: &Connection, nome: &str, cor: &str) -> PastaProjeto {
        salvar(conn, PastaProjeto { id: String::new(), nome: nome.into(), cor: cor.into(), ordem: 0.0, criado_em: 0 }).unwrap()
    }

    #[test]
    fn criar_renomear_mudar_cor_e_apagar() {
        let (_p, conn) = banco_de_teste();
        let a = nova(&conn, "  Produtos da editora ", "lavanda");
        assert_eq!((a.nome.as_str(), a.cor.as_str(), a.ordem), ("Produtos da editora", "lavanda", 0.0));
        let b = nova(&conn, "Casa", "vermelho-gritante");
        assert_eq!((b.cor.as_str(), b.ordem), ("areia", 1.0));
        assert!(matches!(salvar(&conn, PastaProjeto { nome: "   ".into(), ..a.clone() }), Err(Erro::TextoVazio)));

        let renomeada = salvar(&conn, PastaProjeto { nome: "Editora".into(), cor: "mar".into(), ..a.clone() }).unwrap();
        assert_eq!((renomeada.nome.as_str(), renomeada.cor.as_str(), renomeada.ordem), ("Editora", "mar", 0.0));
        let lista = listar(&conn).unwrap();
        assert_eq!(lista.iter().map(|p| p.nome.as_str()).collect::<Vec<_>>(), vec!["Editora", "Casa"]);

        reordenar(&conn, &[b.id.clone(), a.id.clone()]).unwrap();
        assert_eq!(listar(&conn).unwrap().iter().map(|p| p.nome.as_str()).collect::<Vec<_>>(), vec!["Casa", "Editora"]);

        excluir(&conn, &a.id).unwrap();
        assert_eq!(listar(&conn).unwrap().len(), 1);
        assert!(matches!(salvar(&conn, renomeada), Err(Erro::NaoEncontrado)));
    }

    #[test]
    fn projeto_em_varias_pastas_e_apagar_pasta_nao_apaga_projeto() {
        let (_p, conn) = banco_de_teste();
        let editora = nova(&conn, "Editora", "rosa");
        let curso = nova(&conn, "Curso", "ceu");
        let livro = itens::criar_projeto(&conn, "Livro", true).unwrap();
        let alterado = itens::obter_projeto(&conn, &livro.id).unwrap().alterado_em;

        definir(&conn, &livro.id, &editora.id, true).unwrap();
        definir(&conn, &livro.id, &curso.id, true).unwrap();
        definir(&conn, &livro.id, &curso.id, true).unwrap(); // não duplica
        assert_eq!(do_projeto(&conn, &livro.id).unwrap(), vec![editora.id.clone(), curso.id.clone()]);
        let p = itens::obter_projeto(&conn, &livro.id).unwrap();
        assert_eq!(p.pastas, vec![editora.id.clone(), curso.id.clone()]);
        // Pôr em pasta não mexe na data do projeto (que ordena a lista).
        assert_eq!(p.alterado_em, alterado);
        let linhas: i64 = conn.query_row("SELECT count(*) FROM ligacao WHERE tipo = 'na_pasta'", [], |r| r.get(0)).unwrap();
        assert_eq!(linhas, 2);

        // Tirar de uma pasta não tira da outra; pôr de novo reaproveita a linha.
        definir(&conn, &livro.id, &editora.id, false).unwrap();
        assert_eq!(do_projeto(&conn, &livro.id).unwrap(), vec![curso.id.clone()]);
        definir(&conn, &livro.id, &editora.id, true).unwrap();
        let linhas: i64 = conn.query_row("SELECT count(*) FROM ligacao WHERE tipo = 'na_pasta'", [], |r| r.get(0)).unwrap();
        assert_eq!(linhas, 2);

        // Apagar a pasta: o projeto continua, só sai daquela pasta.
        excluir(&conn, &curso.id).unwrap();
        assert_eq!(itens::listar_projetos(&conn).unwrap().len(), 1);
        assert_eq!(do_projeto(&conn, &livro.id).unwrap(), vec![editora.id.clone()]);
        let vivas: i64 = conn.query_row("SELECT count(*) FROM ligacao WHERE tipo = 'na_pasta' AND excluido_em IS NULL", [], |r| r.get(0)).unwrap();
        assert_eq!(vivas, 1);

        // Pasta apagada ou projeto que não existe: não põe.
        assert!(matches!(definir(&conn, &livro.id, &curso.id, true), Err(Erro::NaoEncontrado)));
        assert!(matches!(definir(&conn, "nada", &editora.id, true), Err(Erro::NaoEncontrado)));
    }
}
