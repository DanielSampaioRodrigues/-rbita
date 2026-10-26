//! Caderno: estante de cadernos (modo caderno com páginas e quadro infinito).
//!
//! Etapa 12: a base e a estante. O desenho das páginas chega nas etapas
//! seguintes; aqui já ficam os cadernos, as pastas, as páginas e a cena
//! (guardada por página, ainda vazia). Tudo na tabela `item`:
//! - pasta:   tipo 'caderno_pasta', titulo = nome.
//! - caderno: tipo 'caderno', titulo = nome, estado = modo, pai_id = pasta
//!            (vazio = fora de pasta), dados = { capa }.
//! - página:  tipo 'caderno_pagina', pai_id = caderno, ordem, conteudo = cena
//!            (JSON), dados = { tamanho, papel }.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{agora_ms, novo_id};
use crate::erro::Erro;

const MODOS: [&str; 2] = ["caderno", "infinito"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Capa {
    pub tipo: String,
    pub valor: String,
}

impl Default for Capa {
    fn default() -> Self {
        Capa { tipo: "cor".into(), valor: "mar".into() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Caderno {
    #[serde(default)]
    pub id: String,
    pub nome: String,
    /// "caderno" ou "infinito".
    #[serde(default)]
    pub modo: String,
    #[serde(default)]
    pub capa: Capa,
    /// Pasta a que pertence; vazio = fora de pasta.
    #[serde(default)]
    pub pasta_id: String,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DadosCaderno {
    #[serde(default)]
    capa: Capa,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PastaCaderno {
    #[serde(default)]
    pub id: String,
    pub nome: String,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Pagina {
    #[serde(default)]
    pub id: String,
    pub caderno_id: String,
    #[serde(default)]
    pub ordem: f64,
    /// "a4", "a5", "carta" ou "infinito".
    pub tamanho: String,
    /// A folha (modelo, cores, espaçamento...), como objeto livre vindo do front.
    #[serde(default)]
    pub papel: Value,
    /// Título da página (para o índice); vazio = sem título.
    #[serde(default)]
    pub titulo: String,
    /// Se está marcada (marcador).
    #[serde(default)]
    pub marcado: bool,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DadosPagina {
    #[serde(default)]
    tamanho: String,
    #[serde(default)]
    papel: Value,
    #[serde(default)]
    titulo: String,
    #[serde(default)]
    marcado: bool,
}

// ---------- Pastas ----------

pub fn listar_pastas(conn: &Connection) -> Result<Vec<PastaCaderno>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, criado_em FROM item WHERE tipo = 'caderno_pasta' AND excluido_em IS NULL ORDER BY titulo",
    )?;
    let lista = c
        .query_map([], |r| Ok(PastaCaderno { id: r.get(0)?, nome: r.get(1)?, criado_em: r.get(2)? }))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_pasta(conn: &Connection, mut p: PastaCaderno) -> Result<PastaCaderno, Erro> {
    p.nome = p.nome.trim().to_string();
    if p.nome.is_empty() {
        return Err(Erro::Interno("a pasta precisa de um nome".into()));
    }
    let agora = agora_ms();
    if p.id.is_empty() {
        p.id = novo_id();
        p.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, criado_em, alterado_em) VALUES (?1, 'caderno_pasta', ?2, ?3, ?3)",
            params![p.id, p.nome, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo = 'caderno_pasta' AND excluido_em IS NULL",
            params![p.id, p.nome, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("pasta não encontrada".into()));
        }
    }
    Ok(p)
}

/// Apaga a pasta; os cadernos dentro dela voltam para fora de pasta (não somem).
pub fn excluir_pasta(conn: &Connection, id: &str) -> Result<(), Erro> {
    let agora = agora_ms();
    conn.execute("UPDATE item SET pai_id = '', alterado_em = ?2 WHERE tipo = 'caderno' AND pai_id = ?1 AND excluido_em IS NULL", params![id, agora])?;
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'caderno_pasta'", params![id, agora])?;
    Ok(())
}

// ---------- Cadernos ----------

pub fn listar_cadernos(conn: &Connection) -> Result<Vec<Caderno>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, estado, coalesce(pai_id, ''), dados, criado_em FROM item WHERE tipo = 'caderno' AND excluido_em IS NULL ORDER BY criado_em DESC",
    )?;
    let lista = c
        .query_map([], |r| {
            let d: DadosCaderno = serde_json::from_str(&r.get::<_, String>(4)?).unwrap_or_default();
            Ok(Caderno { id: r.get(0)?, nome: r.get(1)?, modo: r.get(2)?, pasta_id: r.get(3)?, capa: d.capa, criado_em: r.get(5)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_caderno(conn: &Connection, mut c: Caderno) -> Result<Caderno, Erro> {
    c.nome = c.nome.trim().to_string();
    if c.nome.is_empty() {
        return Err(Erro::Interno("o caderno precisa de um nome".into()));
    }
    if !MODOS.contains(&c.modo.as_str()) {
        c.modo = "caderno".into();
    }
    let dados = serde_json::to_string(&DadosCaderno { capa: c.capa.clone() }).map_err(|e| Erro::Interno(e.to_string()))?;
    let agora = agora_ms();
    if c.id.is_empty() {
        c.id = novo_id();
        c.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, estado, pai_id, dados, criado_em, alterado_em) VALUES (?1, 'caderno', ?2, ?3, ?4, ?5, ?6, ?6)",
            params![c.id, c.nome, c.modo, c.pasta_id, dados, agora],
        )?;
        // Todo caderno nasce com uma página: A4 no modo caderno, ou a tela única no infinito.
        let tamanho = if c.modo == "infinito" { "infinito" } else { "a4" };
        criar_pagina_interna(conn, &c.id, tamanho, &Value::Null, 1.0)?;
    } else {
        // Ao editar, muda nome, capa e pasta; o modo é fixo.
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, pai_id = ?3, dados = ?4, alterado_em = ?5 WHERE id = ?1 AND tipo = 'caderno' AND excluido_em IS NULL",
            params![c.id, c.nome, c.pasta_id, dados, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("caderno não encontrado".into()));
        }
    }
    Ok(c)
}

/// Apaga o caderno e todas as suas páginas.
pub fn excluir_caderno(conn: &Connection, id: &str) -> Result<(), Erro> {
    let agora = agora_ms();
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE tipo = 'caderno_pagina' AND pai_id = ?1", params![id, agora])?;
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'caderno'", params![id, agora])?;
    Ok(())
}

// ---------- Páginas ----------

fn criar_pagina_interna(conn: &Connection, caderno_id: &str, tamanho: &str, papel: &Value, ordem: f64) -> Result<Pagina, Erro> {
    let id = novo_id();
    let agora = agora_ms();
    let dados = serde_json::to_string(&DadosPagina { tamanho: tamanho.to_string(), papel: papel.clone(), titulo: String::new(), marcado: false }).map_err(|e| Erro::Interno(e.to_string()))?;
    conn.execute(
        "INSERT INTO item (id, tipo, pai_id, conteudo, ordem, dados, criado_em, alterado_em) VALUES (?1, 'caderno_pagina', ?2, '', ?3, ?4, ?5, ?5)",
        params![id, caderno_id, ordem, dados, agora],
    )?;
    Ok(Pagina { id, caderno_id: caderno_id.to_string(), ordem, tamanho: tamanho.to_string(), papel: papel.clone(), titulo: String::new(), marcado: false, criado_em: agora })
}

pub fn listar_paginas(conn: &Connection, caderno_id: &str) -> Result<Vec<Pagina>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, pai_id, ordem, dados, criado_em FROM item WHERE tipo = 'caderno_pagina' AND pai_id = ?1 AND excluido_em IS NULL ORDER BY ordem, criado_em",
    )?;
    let lista = c
        .query_map([caderno_id], |r| {
            let d: DadosPagina = serde_json::from_str(&r.get::<_, String>(3)?).unwrap_or_default();
            Ok(Pagina { id: r.get(0)?, caderno_id: r.get(1)?, ordem: r.get(2)?, tamanho: d.tamanho, papel: d.papel, titulo: d.titulo, marcado: d.marcado, criado_em: r.get(4)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

/// Cria uma página (id vazio) ou atualiza o tamanho/papel de uma existente.
pub fn salvar_pagina(conn: &Connection, mut p: Pagina) -> Result<Pagina, Erro> {
    if p.caderno_id.trim().is_empty() {
        return Err(Erro::Interno("a página precisa de um caderno".into()));
    }
    if p.tamanho.trim().is_empty() {
        p.tamanho = "a4".into();
    }
    if p.id.is_empty() {
        if p.ordem == 0.0 {
            p.ordem = conn.query_row("SELECT coalesce(max(ordem), 0) + 1 FROM item WHERE tipo = 'caderno_pagina' AND pai_id = ?1 AND excluido_em IS NULL", params![p.caderno_id], |r| r.get(0))?;
        }
        return criar_pagina_interna(conn, &p.caderno_id, &p.tamanho, &p.papel, p.ordem);
    }
    let dados = serde_json::to_string(&DadosPagina { tamanho: p.tamanho.clone(), papel: p.papel.clone(), titulo: p.titulo.clone(), marcado: p.marcado }).map_err(|e| Erro::Interno(e.to_string()))?;
    let n = conn.execute(
        "UPDATE item SET ordem = ?2, dados = ?3, alterado_em = ?4 WHERE id = ?1 AND tipo = 'caderno_pagina' AND excluido_em IS NULL",
        params![p.id, p.ordem, dados, agora_ms()],
    )?;
    if n == 0 {
        return Err(Erro::Interno("página não encontrada".into()));
    }
    Ok(p)
}

pub fn excluir_pagina(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'caderno_pagina'", params![id, agora_ms()])?;
    Ok(())
}

/// A cena desenhável de uma página (JSON; vazia por enquanto).
pub fn carregar_cena(conn: &Connection, pagina_id: &str) -> Result<String, Erro> {
    let cena: Option<String> = conn
        .query_row("SELECT conteudo FROM item WHERE id = ?1 AND tipo = 'caderno_pagina' AND excluido_em IS NULL", params![pagina_id], |r| r.get(0))
        .ok();
    Ok(cena.unwrap_or_default())
}

pub fn salvar_cena(conn: &Connection, pagina_id: &str, cena: &str) -> Result<(), Erro> {
    let n = conn.execute(
        "UPDATE item SET conteudo = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo = 'caderno_pagina' AND excluido_em IS NULL",
        params![pagina_id, cena, agora_ms()],
    )?;
    if n == 0 {
        return Err(Erro::Interno("página não encontrada".into()));
    }
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::abrir;
    use crate::cofre::cripto::nova_chave;

    fn banco() -> (tempfile::TempDir, Connection) {
        let pasta = tempfile::tempdir().unwrap();
        let conn = abrir(&pasta.path().join("orbita.db"), &nova_chave()).unwrap();
        (pasta, conn)
    }

    #[test]
    fn caderno_nasce_com_uma_pagina_conforme_o_modo() {
        let (_p, conn) = banco();
        let cad = salvar_caderno(&conn, Caderno { id: String::new(), nome: " Faculdade ".into(), modo: "caderno".into(), capa: Capa::default(), pasta_id: String::new(), criado_em: 0 }).unwrap();
        assert_eq!(cad.nome, "Faculdade");
        let pgs = listar_paginas(&conn, &cad.id).unwrap();
        assert_eq!(pgs.len(), 1);
        assert_eq!(pgs[0].tamanho, "a4");

        let inf = salvar_caderno(&conn, Caderno { id: String::new(), nome: "Mapa".into(), modo: "infinito".into(), capa: Capa::default(), pasta_id: String::new(), criado_em: 0 }).unwrap();
        assert_eq!(listar_paginas(&conn, &inf.id).unwrap()[0].tamanho, "infinito");
        assert!(salvar_caderno(&conn, Caderno { id: String::new(), nome: "  ".into(), modo: "caderno".into(), capa: Capa::default(), pasta_id: String::new(), criado_em: 0 }).is_err());
    }

    #[test]
    fn paginas_adicionam_salvam_cena_e_apagam() {
        let (_p, conn) = banco();
        let cad = salvar_caderno(&conn, Caderno { id: String::new(), nome: "C".into(), modo: "caderno".into(), capa: Capa::default(), pasta_id: String::new(), criado_em: 0 }).unwrap();
        let p2 = salvar_pagina(&conn, Pagina { id: String::new(), caderno_id: cad.id.clone(), ordem: 0.0, tamanho: "a5".into(), papel: Value::Null, titulo: String::new(), marcado: false, criado_em: 0 }).unwrap();
        assert_eq!(listar_paginas(&conn, &cad.id).unwrap().len(), 2);

        assert_eq!(carregar_cena(&conn, &p2.id).unwrap(), "");
        salvar_cena(&conn, &p2.id, "{\"elementos\":[]}").unwrap();
        assert_eq!(carregar_cena(&conn, &p2.id).unwrap(), "{\"elementos\":[]}");

        // Título e marcador voltam.
        salvar_pagina(&conn, Pagina { titulo: "Introdução".into(), marcado: true, ..p2.clone() }).unwrap();
        let salva = listar_paginas(&conn, &cad.id).unwrap().into_iter().find(|x| x.id == p2.id).unwrap();
        assert_eq!((salva.titulo.as_str(), salva.marcado), ("Introdução", true));

        excluir_pagina(&conn, &p2.id).unwrap();
        assert_eq!(listar_paginas(&conn, &cad.id).unwrap().len(), 1);
    }

    #[test]
    fn pasta_move_cadernos_para_fora_ao_ser_apagada() {
        let (_p, conn) = banco();
        let pasta = salvar_pasta(&conn, PastaCaderno { id: String::new(), nome: "Faculdade".into(), criado_em: 0 }).unwrap();
        let cad = salvar_caderno(&conn, Caderno { id: String::new(), nome: "C".into(), modo: "caderno".into(), capa: Capa::default(), pasta_id: pasta.id.clone(), criado_em: 0 }).unwrap();
        assert_eq!(listar_cadernos(&conn).unwrap().iter().find(|x| x.id == cad.id).unwrap().pasta_id, pasta.id);
        excluir_pasta(&conn, &pasta.id).unwrap();
        assert!(listar_pastas(&conn).unwrap().is_empty());
        assert_eq!(listar_cadernos(&conn).unwrap().iter().find(|x| x.id == cad.id).unwrap().pasta_id, "");
    }

    #[test]
    fn excluir_caderno_leva_as_paginas() {
        let (_p, conn) = banco();
        let cad = salvar_caderno(&conn, Caderno { id: String::new(), nome: "C".into(), modo: "caderno".into(), capa: Capa::default(), pasta_id: String::new(), criado_em: 0 }).unwrap();
        excluir_caderno(&conn, &cad.id).unwrap();
        assert!(listar_cadernos(&conn).unwrap().is_empty());
        assert!(listar_paginas(&conn, &cad.id).unwrap().is_empty());
    }
}
