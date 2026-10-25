//! Energia: registros do nível de energia, básicos do dia (o essencial no modo
//! baixa energia) e sugestão de tarefas leves.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::{agora_ms, gravar_config, ler_config, novo_id};
use crate::erro::Erro;

const CONFIG_BASICOS: &str = "basicos_do_dia";

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistroEnergia {
    pub id: String,
    /// De 1 (muito baixa) a 5 (muito boa).
    pub nivel: u8,
    pub momento: i64,
    pub nota: String,
}

#[derive(Serialize, Deserialize)]
struct ValorEnergia {
    nivel: u8,
}

pub fn registrar(conn: &Connection, nivel: u8, nota: &str) -> Result<RegistroEnergia, Erro> {
    if !(1..=5).contains(&nivel) {
        return Err(Erro::Interno("o nível de energia vai de 1 a 5".into()));
    }
    let r = RegistroEnergia { id: novo_id(), nivel, momento: agora_ms(), nota: nota.trim().to_string() };
    conn.execute(
        "INSERT INTO registro (id, tipo, momento, valor, nota, criado_em, alterado_em) VALUES (?1, 'energia', ?2, ?3, ?4, ?2, ?2)",
        params![r.id, r.momento, serde_json::to_string(&ValorEnergia { nivel }).unwrap(), r.nota],
    )?;
    Ok(r)
}

pub fn listar(conn: &Connection, de: i64, ate: i64) -> Result<Vec<RegistroEnergia>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, momento, valor, nota FROM registro
         WHERE tipo = 'energia' AND excluido_em IS NULL AND momento >= ?1 AND momento < ?2 ORDER BY momento",
    )?;
    let lista = c
        .query_map(params![de, ate], |r| {
            let v: ValorEnergia = serde_json::from_str(&r.get::<_, String>(2)?).unwrap_or(ValorEnergia { nivel: 3 });
            Ok(RegistroEnergia { id: r.get(0)?, momento: r.get(1)?, nivel: v.nivel, nota: r.get(3)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

// ---------- Básicos do dia ----------

pub fn basicos_padrao() -> Vec<String> {
    vec!["Tomar o remédio".into(), "Comer alguma coisa".into(), "Beber água".into()]
}

pub fn basicos(conn: &Connection) -> Result<Vec<String>, Erro> {
    Ok(ler_config(conn, CONFIG_BASICOS)?.and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_else(basicos_padrao))
}

pub fn definir_basicos(conn: &Connection, lista: Vec<String>) -> Result<(), Erro> {
    let limpa: Vec<String> = lista.into_iter().map(|b| b.trim().to_string()).filter(|b| !b.is_empty()).take(10).collect();
    gravar_config(conn, CONFIG_BASICOS, &serde_json::to_string(&limpa).unwrap())
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Basico {
    pub texto: String,
    pub feito: bool,
}

/// Os básicos com o que já foi feito no dia `data` ("AAAA-MM-DD").
pub fn basicos_do_dia(conn: &Connection, data: &str) -> Result<Vec<Basico>, Erro> {
    let mut c = conn.prepare("SELECT nota FROM registro WHERE tipo = 'basico' AND excluido_em IS NULL AND json_extract(valor, '$.data') = ?1")?;
    let feitos: Vec<String> = c.query_map([data], |r| r.get(0))?.collect::<Result<_, _>>()?;
    Ok(basicos(conn)?.into_iter().map(|texto| Basico { feito: feitos.contains(&texto), texto }).collect())
}

pub fn marcar_basico(conn: &Connection, data: &str, texto: &str, feito: bool) -> Result<(), Erro> {
    let existente: Option<String> = conn
        .query_row(
            "SELECT id FROM registro WHERE tipo = 'basico' AND excluido_em IS NULL AND json_extract(valor, '$.data') = ?1 AND nota = ?2",
            params![data, texto],
            |r| r.get(0),
        )
        .optional()?;
    let agora = agora_ms();
    match (feito, existente) {
        (true, None) => {
            conn.execute(
                "INSERT INTO registro (id, tipo, momento, valor, nota, criado_em, alterado_em) VALUES (?1, 'basico', ?2, ?3, ?4, ?2, ?2)",
                params![novo_id(), agora, serde_json::json!({ "data": data }).to_string(), texto],
            )?;
        }
        (false, Some(id)) => {
            conn.execute("UPDATE registro SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1", params![id, agora])?;
        }
        _ => {}
    }
    Ok(())
}

// ---------- Tarefas sugeridas ----------

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TarefaSugerida {
    pub id: String,
    pub titulo: String,
    pub peso: Option<String>,
    pub projeto_id: String,
    pub projeto: String,
}

/// Tarefas por fazer dos projetos ativos, as leves primeiro (depois as sem peso, médias e pesadas).
pub fn tarefas_sugeridas(conn: &Connection) -> Result<Vec<TarefaSugerida>, Erro> {
    let mut c = conn.prepare(
        "SELECT t.id, t.titulo, json_extract(t.dados, '$.peso'), p.id, p.titulo
         FROM item t
         JOIN item p ON p.id = t.pai_id OR p.id = (SELECT e.pai_id FROM item e WHERE e.id = t.pai_id)
         WHERE t.tipo = 'tarefa' AND t.estado != 'feita' AND t.excluido_em IS NULL
           AND p.tipo = 'projeto' AND p.estado = 'ativo' AND p.excluido_em IS NULL
           AND NOT EXISTS (SELECT 1 FROM item f WHERE f.pai_id = t.id AND f.tipo = 'tarefa' AND f.excluido_em IS NULL)
         ORDER BY CASE json_extract(t.dados, '$.peso') WHEN 'leve' THEN 0 WHEN 'media' THEN 2 WHEN 'pesada' THEN 3 ELSE 1 END,
                  p.alterado_em DESC, t.ordem",
    )?;
    let lista = c
        .query_map([], |r| {
            Ok(TarefaSugerida { id: r.get(0)?, titulo: r.get(1)?, peso: r.get(2)?, projeto_id: r.get(3)?, projeto: r.get(4)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::{abrir, itens};
    use crate::cofre::cripto::nova_chave;

    fn banco() -> (tempfile::TempDir, Connection) {
        let pasta = tempfile::tempdir().unwrap();
        let conn = abrir(&pasta.path().join("orbita.db"), &nova_chave()).unwrap();
        (pasta, conn)
    }

    #[test]
    fn registra_e_lista_energia() {
        let (_p, conn) = banco();
        registrar(&conn, 2, " cansado ").unwrap();
        assert!(registrar(&conn, 6, "").is_err());
        let lista = listar(&conn, 0, i64::MAX).unwrap();
        assert_eq!(lista.len(), 1);
        assert_eq!((lista[0].nivel, lista[0].nota.as_str()), (2, "cansado"));
    }

    #[test]
    fn basicos_padrao_editaveis_e_marcados_por_dia() {
        let (_p, conn) = banco();
        assert_eq!(basicos(&conn).unwrap(), basicos_padrao());
        definir_basicos(&conn, vec!["Remédio".into(), "  ".into(), "Comer".into()]).unwrap();
        marcar_basico(&conn, "2026-10-25", "Comer", true).unwrap();
        marcar_basico(&conn, "2026-10-25", "Comer", true).unwrap();
        let hoje = basicos_do_dia(&conn, "2026-10-25").unwrap();
        assert_eq!(hoje, vec![Basico { texto: "Remédio".into(), feito: false }, Basico { texto: "Comer".into(), feito: true }]);
        assert!(basicos_do_dia(&conn, "2026-10-26").unwrap().iter().all(|b| !b.feito));
        marcar_basico(&conn, "2026-10-25", "Comer", false).unwrap();
        assert!(basicos_do_dia(&conn, "2026-10-25").unwrap().iter().all(|b| !b.feito));
    }

    #[test]
    fn sugere_tarefas_leves_primeiro_e_so_de_projetos_ativos() {
        let (_p, conn) = banco();
        let ativo = itens::criar_projeto(&conn, "Casa", true).unwrap();
        let pausado = itens::criar_projeto(&conn, "Curso", false).unwrap();
        let pesada = itens::criar_tarefa(&conn, &ativo.id, "Limpar a garagem").unwrap();
        let etapa = itens::criar_tarefa(&conn, &ativo.id, "Cozinha").unwrap();
        let leve = itens::criar_tarefa(&conn, &etapa.id, "Lavar uma xícara").unwrap();
        itens::criar_tarefa(&conn, &pausado.id, "Assistir aula").unwrap();
        itens::definir_peso(&conn, &pesada.id, Some("pesada")).unwrap();
        itens::definir_peso(&conn, &leve.id, Some("leve")).unwrap();

        let s = tarefas_sugeridas(&conn).unwrap();
        // A etapa "Cozinha" tem subtarefa, então quem aparece é a subtarefa.
        assert_eq!(s.iter().map(|t| t.titulo.as_str()).collect::<Vec<_>>(), vec!["Lavar uma xícara", "Limpar a garagem"]);
        assert_eq!(s[0].projeto, "Casa");
        assert!(itens::definir_peso(&conn, &leve.id, Some("enorme")).is_err());
    }
}
