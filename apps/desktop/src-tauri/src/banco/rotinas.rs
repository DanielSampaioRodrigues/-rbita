//! Rotinas passo a passo (tabela `item`): a rotina (`tipo = 'rotina'`) e os
//! passos (`tipo = 'passo'`, filhos dela), cada um com ícone e minutos opcionais.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::{agora_ms, novo_id};
use crate::erro::Erro;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Passo {
    #[serde(default)]
    pub id: String,
    pub titulo: String,
    /// Nome de um ícone da lista do app, ou vazio.
    #[serde(default)]
    pub icone: String,
    /// Tempo sugerido, em minutos.
    #[serde(default)]
    pub minutos: Option<u32>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Rotina {
    pub id: String,
    pub titulo: String,
    pub passos: Vec<Passo>,
}

#[derive(Default, Serialize, Deserialize)]
struct DadosPasso {
    #[serde(default)]
    icone: String,
    #[serde(default)]
    minutos: Option<u32>,
}

fn limpo(t: &str) -> Result<String, Erro> {
    let t = t.trim();
    if t.is_empty() { Err(Erro::TextoVazio) } else { Ok(t.to_string()) }
}

fn passos(conn: &Connection, rotina: &str) -> Result<Vec<Passo>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, dados FROM item WHERE tipo = 'passo' AND pai_id = ?1 AND excluido_em IS NULL ORDER BY ordem, criado_em",
    )?;
    let lista = c
        .query_map([rotina], |r| {
            let d: DadosPasso = serde_json::from_str(&r.get::<_, String>(2)?).unwrap_or_default();
            Ok(Passo { id: r.get(0)?, titulo: r.get(1)?, icone: d.icone, minutos: d.minutos })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn listar(conn: &Connection) -> Result<Vec<Rotina>, Erro> {
    let mut c = conn.prepare("SELECT id, titulo FROM item WHERE tipo = 'rotina' AND excluido_em IS NULL ORDER BY ordem, criado_em")?;
    let base: Vec<(String, String)> = c.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<Result<_, _>>()?;
    base.into_iter()
        .map(|(id, titulo)| Ok(Rotina { passos: passos(conn, &id)?, id, titulo }))
        .collect()
}

pub fn obter(conn: &Connection, id: &str) -> Result<Rotina, Erro> {
    let titulo: String = conn
        .query_row("SELECT titulo FROM item WHERE id = ?1 AND tipo = 'rotina' AND excluido_em IS NULL", [id], |r| r.get(0))
        .optional()?
        .ok_or(Erro::NaoEncontrado)?;
    Ok(Rotina { id: id.to_string(), titulo, passos: passos(conn, id)? })
}

pub fn criar(conn: &Connection, titulo: &str) -> Result<Rotina, Erro> {
    let id = novo_id();
    let agora = agora_ms();
    let ordem: f64 = conn.query_row("SELECT coalesce(max(ordem), 0) + 1 FROM item WHERE tipo = 'rotina'", [], |r| r.get(0))?;
    conn.execute(
        "INSERT INTO item (id, tipo, titulo, ordem, criado_em, alterado_em) VALUES (?1, 'rotina', ?2, ?3, ?4, ?4)",
        params![id, limpo(titulo)?, ordem, agora],
    )?;
    obter(conn, &id)
}

/// Cria (sem `id`) ou atualiza (com `id`) um passo da rotina.
pub fn salvar_passo(conn: &Connection, rotina: &str, passo: Passo) -> Result<Passo, Erro> {
    obter(conn, rotina)?;
    let titulo = limpo(&passo.titulo)?;
    let dados = serde_json::to_string(&DadosPasso { icone: passo.icone.clone(), minutos: passo.minutos.filter(|m| *m > 0) }).unwrap();
    let agora = agora_ms();
    let id = if passo.id.is_empty() {
        let id = novo_id();
        let ordem: f64 = conn.query_row(
            "SELECT coalesce(max(ordem), 0) + 1 FROM item WHERE pai_id = ?1 AND excluido_em IS NULL",
            [rotina],
            |r| r.get(0),
        )?;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, dados, pai_id, ordem, criado_em, alterado_em) VALUES (?1, 'passo', ?2, ?3, ?4, ?5, ?6, ?6)",
            params![id, titulo, dados, rotina, ordem, agora],
        )?;
        id
    } else {
        conn.execute(
            "UPDATE item SET titulo = ?2, dados = ?3, alterado_em = ?4 WHERE id = ?1 AND tipo = 'passo'",
            params![passo.id, titulo, dados, agora],
        )?;
        passo.id
    };
    passos(conn, rotina)?.into_iter().find(|p| p.id == id).ok_or(Erro::NaoEncontrado)
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::{abrir, itens};
    use crate::cofre::cripto::nova_chave;

    #[test]
    fn rotina_com_passos_ordenados_editados_e_excluidos() {
        let pasta = tempfile::tempdir().unwrap();
        let conn = abrir(&pasta.path().join("orbita.db"), &nova_chave()).unwrap();
        let r = criar(&conn, "Manhã").unwrap();
        let a = salvar_passo(&conn, &r.id, Passo { titulo: "Tomar o remédio".into(), icone: "pill".into(), ..Default::default() }).unwrap();
        let b = salvar_passo(&conn, &r.id, Passo { titulo: "Café".into(), minutos: Some(15), ..Default::default() }).unwrap();
        salvar_passo(&conn, &r.id, Passo { titulo: "Banho".into(), minutos: Some(0), ..Default::default() }).unwrap();

        itens::mover_item(&conn, &b.id, Some(&a.id)).unwrap();
        let mut a2 = a.clone();
        a2.titulo = "Tomar o remédio da manhã".into();
        salvar_passo(&conn, &r.id, a2).unwrap();
        itens::excluir(&conn, &listar(&conn).unwrap()[0].passos[2].id).unwrap();

        let r = obter(&conn, &r.id).unwrap();
        let titulos: Vec<&str> = r.passos.iter().map(|p| p.titulo.as_str()).collect();
        assert_eq!(titulos, vec!["Café", "Tomar o remédio da manhã"]);
        assert_eq!(r.passos[0].minutos, Some(15));
        assert_eq!(r.passos[1].icone, "pill");
        assert!(matches!(salvar_passo(&conn, &r.id, Passo::default()), Err(Erro::TextoVazio)));
        assert!(matches!(criar(&conn, "  "), Err(Erro::TextoVazio)));
    }
}
