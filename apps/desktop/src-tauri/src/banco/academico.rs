//! Vida acadêmica: matérias (disciplinas) e atividades (prova, trabalho ou
//! dever de casa), guardadas na tabela `item`. Serve escola e faculdade.
//!
//! As aulas em si entram na Agenda como blocos da semana-modelo. A média é
//! calculada na interface, a partir das notas lançadas aqui.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::{agora_ms, gravar_config, ler_config, novo_id};
use crate::erro::Erro;

pub(crate) const CONFIG_MEDIA: &str = "media_aprovacao";
const SUBTIPOS: [&str; 3] = ["prova", "trabalho", "dever"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Materia {
    #[serde(default)]
    pub id: String,
    pub nome: String,
    #[serde(default)]
    pub professor: String,
    /// Nome de cor da paleta (como nas etiquetas). Vazio vira uma cor padrão.
    #[serde(default)]
    pub cor: String,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DadosMateria {
    professor: String,
    cor: String,
}

pub fn listar_materias(conn: &Connection) -> Result<Vec<Materia>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, dados, criado_em FROM item
         WHERE tipo = 'materia' AND excluido_em IS NULL ORDER BY titulo COLLATE NOCASE",
    )?;
    let lista = c
        .query_map([], |r| {
            let d: DadosMateria = serde_json::from_str(&r.get::<_, String>(2)?).unwrap_or(DadosMateria { professor: String::new(), cor: String::new() });
            Ok(Materia { id: r.get(0)?, nome: r.get(1)?, professor: d.professor, cor: d.cor, criado_em: r.get(3)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_materia(conn: &Connection, mut materia: Materia) -> Result<Materia, Erro> {
    materia.nome = materia.nome.trim().to_string();
    if materia.nome.is_empty() {
        return Err(Erro::Interno("a matéria precisa de um nome".into()));
    }
    materia.professor = materia.professor.trim().to_string();
    if materia.cor.trim().is_empty() {
        materia.cor = "mar".into();
    }
    let dados = serde_json::to_string(&DadosMateria { professor: materia.professor.clone(), cor: materia.cor.clone() })
        .map_err(|e| Erro::Interno(e.to_string()))?;
    let agora = agora_ms();
    if materia.id.is_empty() {
        materia.id = novo_id();
        materia.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, dados, criado_em, alterado_em) VALUES (?1, 'materia', ?2, ?3, ?4, ?4)",
            params![materia.id, materia.nome, dados, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, dados = ?3, alterado_em = ?4 WHERE id = ?1 AND tipo = 'materia' AND excluido_em IS NULL",
            params![materia.id, materia.nome, dados, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("matéria não encontrada".into()));
        }
    }
    Ok(materia)
}

/// Apaga a matéria e, junto, as atividades e aulas dela (não ficam órfãs).
pub fn excluir_materia(conn: &Connection, id: &str) -> Result<(), Erro> {
    let agora = agora_ms();
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'materia'", params![id, agora])?;
    conn.execute(
        "UPDATE item SET excluido_em = ?2, alterado_em = ?2
         WHERE tipo IN ('atividade', 'aula') AND excluido_em IS NULL AND json_extract(dados, '$.materiaId') = ?1",
        params![id, agora],
    )?;
    Ok(())
}

// ---------- Grade de horário semanal (aulas) ----------

/// Uma aula fixa da semana: uma matéria num dia e horário. A grade é o conjunto.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Aula {
    #[serde(default)]
    pub id: String,
    pub materia_id: String,
    /// Dia da semana: 0 = domingo ... 6 = sábado.
    pub dia_semana: u8,
    /// "HH:MM" (24h).
    pub inicio: String,
    #[serde(default)]
    pub fim: String,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DadosAula {
    materia_id: String,
    dia_semana: u8,
    inicio: String,
    #[serde(default)]
    fim: String,
}

fn hora_ok(h: &str) -> bool {
    let mut p = h.split(':');
    match (p.next(), p.next(), p.next()) {
        (Some(hh), Some(mm), None) if hh.len() == 2 && mm.len() == 2 => {
            matches!((hh.parse::<u32>(), mm.parse::<u32>()), (Ok(hh), Ok(mm)) if hh < 24 && mm < 60)
        }
        _ => false,
    }
}

pub fn listar_aulas(conn: &Connection) -> Result<Vec<Aula>, Erro> {
    let mut c = conn.prepare("SELECT id, dados, criado_em FROM item WHERE tipo = 'aula' AND excluido_em IS NULL")?;
    let lista = c
        .query_map([], |r| {
            let d: DadosAula = serde_json::from_str(&r.get::<_, String>(1)?).unwrap_or_default();
            Ok(Aula { id: r.get(0)?, materia_id: d.materia_id, dia_semana: d.dia_semana, inicio: d.inicio, fim: d.fim, criado_em: r.get(2)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_aula(conn: &Connection, mut a: Aula) -> Result<Aula, Erro> {
    if a.materia_id.trim().is_empty() {
        return Err(Erro::Interno("escolha a matéria".into()));
    }
    if a.dia_semana > 6 {
        return Err(Erro::Interno("dia da semana inválido".into()));
    }
    a.inicio = a.inicio.trim().to_string();
    a.fim = a.fim.trim().to_string();
    if !hora_ok(&a.inicio) {
        return Err(Erro::Interno("horário de início inválido (use HH:MM)".into()));
    }
    if !a.fim.is_empty() && !hora_ok(&a.fim) {
        return Err(Erro::Interno("horário de fim inválido (use HH:MM)".into()));
    }
    let dados = serde_json::to_string(&DadosAula { materia_id: a.materia_id.clone(), dia_semana: a.dia_semana, inicio: a.inicio.clone(), fim: a.fim.clone() })
        .map_err(|e| Erro::Interno(e.to_string()))?;
    let agora = agora_ms();
    if a.id.is_empty() {
        a.id = novo_id();
        a.criado_em = agora;
        conn.execute("INSERT INTO item (id, tipo, dados, criado_em, alterado_em) VALUES (?1, 'aula', ?2, ?3, ?3)", params![a.id, dados, agora])?;
    } else {
        let n = conn.execute("UPDATE item SET dados = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo = 'aula' AND excluido_em IS NULL", params![a.id, dados, agora])?;
        if n == 0 {
            return Err(Erro::Interno("aula não encontrada".into()));
        }
    }
    Ok(a)
}

pub fn excluir_aula(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'aula'", params![id, agora_ms()])?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Atividade {
    #[serde(default)]
    pub id: String,
    pub materia_id: String,
    /// "prova", "trabalho" ou "dever".
    pub tipo: String,
    pub titulo: String,
    /// "AAAA-MM-DD".
    #[serde(default)]
    pub data: String,
    /// Peso na média (provas/trabalhos). `None` = conta como 1.
    #[serde(default)]
    pub peso: Option<f64>,
    /// Nota recebida. `None` = ainda não saiu.
    #[serde(default)]
    pub nota: Option<f64>,
    /// Marcada como feita (sobretudo para o dever de casa).
    #[serde(default)]
    pub feita: bool,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DadosAtividade {
    materia_id: String,
    subtipo: String,
    data: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    peso: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    nota: Option<f64>,
}

pub fn listar_atividades(conn: &Connection) -> Result<Vec<Atividade>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, estado, dados, criado_em FROM item
         WHERE tipo = 'atividade' AND excluido_em IS NULL",
    )?;
    let lista = c
        .query_map([], |r| {
            let d: DadosAtividade = serde_json::from_str(&r.get::<_, String>(3)?).unwrap_or(DadosAtividade {
                materia_id: String::new(),
                subtipo: "dever".into(),
                data: String::new(),
                peso: None,
                nota: None,
            });
            Ok(Atividade {
                id: r.get(0)?,
                materia_id: d.materia_id,
                tipo: d.subtipo,
                titulo: r.get(1)?,
                data: d.data,
                peso: d.peso,
                nota: d.nota,
                feita: r.get::<_, String>(2)? == "feita",
                criado_em: r.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_atividade(conn: &Connection, mut a: Atividade) -> Result<Atividade, Erro> {
    a.titulo = a.titulo.trim().to_string();
    if a.titulo.is_empty() {
        return Err(Erro::Interno("a atividade precisa de um título".into()));
    }
    if !SUBTIPOS.contains(&a.tipo.as_str()) {
        return Err(Erro::Interno("tipo de atividade desconhecido".into()));
    }
    if a.materia_id.trim().is_empty() {
        return Err(Erro::Interno("escolha a matéria".into()));
    }
    if let Some(n) = a.nota {
        if !(0.0..=100.0).contains(&n) {
            return Err(Erro::Interno("a nota precisa estar entre 0 e 100".into()));
        }
    }
    if let Some(p) = a.peso {
        if p < 0.0 {
            return Err(Erro::Interno("o peso não pode ser negativo".into()));
        }
    }
    let dados = serde_json::to_string(&DadosAtividade {
        materia_id: a.materia_id.clone(),
        subtipo: a.tipo.clone(),
        data: a.data.clone(),
        peso: a.peso,
        nota: a.nota,
    })
    .map_err(|e| Erro::Interno(e.to_string()))?;
    let estado = if a.feita { "feita" } else { "aberta" };
    let agora = agora_ms();
    if a.id.is_empty() {
        a.id = novo_id();
        a.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, estado, dados, criado_em, alterado_em) VALUES (?1, 'atividade', ?2, ?3, ?4, ?5, ?5)",
            params![a.id, a.titulo, estado, dados, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, estado = ?3, dados = ?4, alterado_em = ?5 WHERE id = ?1 AND tipo = 'atividade' AND excluido_em IS NULL",
            params![a.id, a.titulo, estado, dados, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("atividade não encontrada".into()));
        }
    }
    Ok(a)
}

pub fn marcar_atividade(conn: &Connection, id: &str, feita: bool) -> Result<(), Erro> {
    let estado = if feita { "feita" } else { "aberta" };
    conn.execute(
        "UPDATE item SET estado = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo = 'atividade' AND excluido_em IS NULL",
        params![id, estado, agora_ms()],
    )?;
    Ok(())
}

pub fn excluir_atividade(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'atividade'", params![id, agora_ms()])?;
    Ok(())
}

/// Média de aprovação, escolhida pela pessoa (6 na escola, 7 em muitas
/// faculdades). Padrão 6.0.
pub fn media_aprovacao(conn: &Connection) -> Result<f64, Erro> {
    Ok(ler_config(conn, CONFIG_MEDIA)?.and_then(|t| t.parse().ok()).unwrap_or(6.0))
}

pub fn definir_media_aprovacao(conn: &Connection, media: f64) -> Result<(), Erro> {
    let media = media.clamp(0.0, 100.0);
    gravar_config(conn, CONFIG_MEDIA, &media.to_string())
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

    fn materia(nome: &str) -> Materia {
        Materia { id: String::new(), nome: nome.into(), professor: "Prof".into(), cor: String::new(), criado_em: 0 }
    }

    #[test]
    fn materia_salva_com_cor_padrao_e_valida() {
        let (_p, conn) = banco();
        let m = salvar_materia(&conn, materia("Matemática")).unwrap();
        assert_eq!(m.cor, "mar");
        assert!(salvar_materia(&conn, materia("  ")).is_err());
        assert_eq!(listar_materias(&conn).unwrap().len(), 1);
    }

    #[test]
    fn atividade_valida_tipo_materia_e_nota() {
        let (_p, conn) = banco();
        let m = salvar_materia(&conn, materia("História")).unwrap();
        let base = Atividade { id: String::new(), materia_id: m.id.clone(), tipo: "prova".into(), titulo: "Prova 1".into(), data: "2026-11-10".into(), peso: Some(2.0), nota: None, feita: false, criado_em: 0 };
        let a = salvar_atividade(&conn, base.clone()).unwrap();
        assert!(!a.id.is_empty());
        // Tipo inválido, matéria vazia e nota fora da faixa dão erro.
        assert!(salvar_atividade(&conn, Atividade { tipo: " outro".into(), ..base.clone() }).is_err());
        assert!(salvar_atividade(&conn, Atividade { materia_id: " ".into(), ..base.clone() }).is_err());
        assert!(salvar_atividade(&conn, Atividade { nota: Some(120.0), ..base.clone() }).is_err());
        assert_eq!(listar_atividades(&conn).unwrap().len(), 1);
    }

    #[test]
    fn apagar_materia_leva_as_atividades_junto() {
        let (_p, conn) = banco();
        let m = salvar_materia(&conn, materia("Química")).unwrap();
        salvar_atividade(&conn, Atividade { id: String::new(), materia_id: m.id.clone(), tipo: "dever".into(), titulo: "Exercícios".into(), data: "2026-11-01".into(), peso: None, nota: None, feita: false, criado_em: 0 }).unwrap();
        assert_eq!(listar_atividades(&conn).unwrap().len(), 1);
        excluir_materia(&conn, &m.id).unwrap();
        assert!(listar_materias(&conn).unwrap().is_empty());
        assert!(listar_atividades(&conn).unwrap().is_empty());
    }

    #[test]
    fn aulas_da_grade_validam_e_somem_com_a_materia() {
        let (_p, conn) = banco();
        let m = salvar_materia(&conn, materia("Biologia")).unwrap();
        let a = salvar_aula(&conn, Aula { id: String::new(), materia_id: m.id.clone(), dia_semana: 1, inicio: "08:00".into(), fim: "09:40".into(), criado_em: 0 }).unwrap();
        assert!(!a.id.is_empty());
        assert!(salvar_aula(&conn, Aula { id: String::new(), materia_id: m.id.clone(), dia_semana: 9, inicio: "08:00".into(), fim: String::new(), criado_em: 0 }).is_err());
        assert!(salvar_aula(&conn, Aula { id: String::new(), materia_id: m.id.clone(), dia_semana: 1, inicio: "25:00".into(), fim: String::new(), criado_em: 0 }).is_err());
        assert!(salvar_aula(&conn, Aula { id: String::new(), materia_id: String::new(), dia_semana: 1, inicio: "08:00".into(), fim: String::new(), criado_em: 0 }).is_err());
        assert_eq!(listar_aulas(&conn).unwrap().len(), 1);
        excluir_materia(&conn, &m.id).unwrap();
        assert!(listar_aulas(&conn).unwrap().is_empty());
    }

    #[test]
    fn marcar_feita_e_media_de_aprovacao() {
        let (_p, conn) = banco();
        let m = salvar_materia(&conn, materia("Física")).unwrap();
        let a = salvar_atividade(&conn, Atividade { id: String::new(), materia_id: m.id, tipo: "dever".into(), titulo: "Lista".into(), data: String::new(), peso: None, nota: None, feita: false, criado_em: 0 }).unwrap();
        marcar_atividade(&conn, &a.id, true).unwrap();
        assert!(listar_atividades(&conn).unwrap()[0].feita);

        assert_eq!(media_aprovacao(&conn).unwrap(), 6.0);
        definir_media_aprovacao(&conn, 7.0).unwrap();
        assert_eq!(media_aprovacao(&conn).unwrap(), 7.0);
    }
}
