//! Cuidado — meus profissionais de saúde.
//!
//! O módulo gira em torno de cada profissional que a pessoa acompanha
//! (psiquiatra, psicólogo, neurologista, nutricionista, terapeuta ocupacional,
//! fono, clínico...). Cada um tem um painel próprio: próxima consulta, uma
//! descrição livre, o que levar (pautas) e perguntas, e o diário de sessões.
//!
//! Tudo pendura no profissional (pai_id):
//! - profissional: item tipo 'profissional' (titulo = nome, estado =
//!   especialidade, conteudo = descrição em Markdown, dados = próxima consulta).
//! - pauta/pergunta: item tipo 'pauta'/'pergunta', pai_id = profissional.
//! - sessão: item tipo 'cuidado_sessao', pai_id = profissional (conteudo =
//!   anotação em Markdown, dados = data da sessão).

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::{agora_ms, novo_id};
use crate::erro::Erro;

const TIPOS_NOTA: [&str; 2] = ["pauta", "pergunta"];

// ---------- Profissional ----------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Profissional {
    #[serde(default)]
    pub id: String,
    pub nome: String,
    /// Especialidade, texto livre (psiquiatra, psicólogo, nutricionista...).
    #[serde(default)]
    pub especialidade: String,
    /// Descrição livre em Markdown (local da consulta, abordagem, observações).
    #[serde(default)]
    pub sobre: String,
    /// Próxima consulta ("AAAA-MM-DD") ou vazio.
    #[serde(default)]
    pub proxima_consulta: String,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DadosProfissional {
    #[serde(default)]
    proxima_consulta: String,
}

pub fn listar_profissionais(conn: &Connection) -> Result<Vec<Profissional>, Erro> {
    migrar_antigos(conn)?;
    let mut c = conn.prepare(
        "SELECT id, titulo, estado, conteudo, dados, criado_em FROM item
         WHERE tipo = 'profissional' AND excluido_em IS NULL ORDER BY criado_em",
    )?;
    let lista = c
        .query_map([], |r| {
            let d: DadosProfissional = serde_json::from_str(&r.get::<_, String>(4)?).unwrap_or_default();
            Ok(Profissional {
                id: r.get(0)?,
                nome: r.get(1)?,
                especialidade: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                sobre: r.get(3)?,
                proxima_consulta: d.proxima_consulta,
                criado_em: r.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_profissional(conn: &Connection, mut p: Profissional) -> Result<Profissional, Erro> {
    p.nome = p.nome.trim().to_string();
    if p.nome.is_empty() {
        return Err(Erro::Interno("o profissional precisa de um nome".into()));
    }
    p.especialidade = p.especialidade.trim().to_string();
    p.sobre = p.sobre.trim().to_string();
    p.proxima_consulta = p.proxima_consulta.trim().to_string();
    let dados = serde_json::to_string(&DadosProfissional { proxima_consulta: p.proxima_consulta.clone() })
        .map_err(|e| Erro::Interno(e.to_string()))?;
    let agora = agora_ms();
    if p.id.is_empty() {
        p.id = novo_id();
        p.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, estado, conteudo, dados, criado_em, alterado_em) VALUES (?1, 'profissional', ?2, ?3, ?4, ?5, ?6, ?6)",
            params![p.id, p.nome, p.especialidade, p.sobre, dados, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, estado = ?3, conteudo = ?4, dados = ?5, alterado_em = ?6 WHERE id = ?1 AND tipo = 'profissional' AND excluido_em IS NULL",
            params![p.id, p.nome, p.especialidade, p.sobre, dados, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("profissional não encontrado".into()));
        }
    }
    Ok(p)
}

/// Apaga o profissional e, junto, suas pautas, perguntas e sessões.
pub fn excluir_profissional(conn: &Connection, id: &str) -> Result<(), Erro> {
    let agora = agora_ms();
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE pai_id = ?1 AND tipo IN ('pauta', 'pergunta', 'cuidado_sessao')", params![id, agora])?;
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'profissional'", params![id, agora])?;
    Ok(())
}

/// Move dados do formato antigo (sem profissional) para um profissional "Acompanhamento".
fn migrar_antigos(conn: &Connection) -> Result<(), Erro> {
    let ja: i64 = conn.query_row("SELECT count(*) FROM item WHERE tipo = 'profissional' AND excluido_em IS NULL", [], |r| r.get(0))?;
    if ja > 0 {
        return Ok(());
    }
    let notas_orfas: i64 = conn.query_row("SELECT count(*) FROM item WHERE tipo IN ('pauta', 'pergunta') AND pai_id IS NULL AND excluido_em IS NULL", [], |r| r.get(0))?;
    let sessoes_antigas: i64 = conn.query_row("SELECT count(*) FROM registro WHERE tipo = 'sessao' AND excluido_em IS NULL", [], |r| r.get(0))?;
    if notas_orfas == 0 && sessoes_antigas == 0 {
        return Ok(());
    }
    let p = salvar_profissional(conn, Profissional { id: String::new(), nome: "Acompanhamento".into(), especialidade: String::new(), sobre: String::new(), proxima_consulta: String::new(), criado_em: 0 })?;
    let agora = agora_ms();
    // Pautas e perguntas órfãs passam a ser do profissional novo.
    conn.execute("UPDATE item SET pai_id = ?2, alterado_em = ?3 WHERE tipo IN ('pauta', 'pergunta') AND pai_id IS NULL AND excluido_em IS NULL", params![p.id, agora])?;
    // Sessões antigas (registro) viram sessões do profissional (item), com a data do momento.
    let mut c = conn.prepare("SELECT momento, nota FROM registro WHERE tipo = 'sessao' AND excluido_em IS NULL")?;
    let antigas: Vec<(i64, String)> = c.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<Result<_, _>>()?;
    for (momento, nota) in antigas {
        let dados = serde_json::to_string(&DadosSessao { data: iso_do_momento(momento) }).unwrap_or_else(|_| "{}".into());
        conn.execute(
            "INSERT INTO item (id, tipo, conteudo, dados, pai_id, criado_em, alterado_em) VALUES (?1, 'cuidado_sessao', ?2, ?3, ?4, ?5, ?5)",
            params![novo_id(), nota, dados, p.id, momento],
        )?;
    }
    conn.execute("UPDATE registro SET excluido_em = ?1, alterado_em = ?1 WHERE tipo = 'sessao' AND excluido_em IS NULL", params![agora])?;
    Ok(())
}

// ---------- Pautas e perguntas (por profissional) ----------

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Nota {
    pub id: String,
    pub tipo: String,
    pub texto: String,
    pub feita: bool,
    pub criado_em: i64,
}

pub fn listar_notas(conn: &Connection, profissional_id: &str, tipo: &str) -> Result<Vec<Nota>, Erro> {
    if !TIPOS_NOTA.contains(&tipo) {
        return Err(Erro::Interno("tipo de anotação desconhecido".into()));
    }
    let mut c = conn.prepare(
        "SELECT id, titulo, estado, criado_em FROM item
         WHERE tipo = ?1 AND pai_id = ?2 AND excluido_em IS NULL
         ORDER BY CASE estado WHEN 'aberta' THEN 0 ELSE 1 END, criado_em DESC",
    )?;
    let lista = c
        .query_map(params![tipo, profissional_id], |r| {
            Ok(Nota { id: r.get(0)?, tipo: tipo.to_string(), texto: r.get(1)?, feita: r.get::<_, String>(2)? == "feita", criado_em: r.get(3)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn criar_nota(conn: &Connection, profissional_id: &str, tipo: &str, texto: &str) -> Result<Nota, Erro> {
    if !TIPOS_NOTA.contains(&tipo) {
        return Err(Erro::Interno("tipo de anotação desconhecido".into()));
    }
    if profissional_id.trim().is_empty() {
        return Err(Erro::Interno("a anotação precisa de um profissional".into()));
    }
    let texto = texto.trim().to_string();
    if texto.is_empty() {
        return Err(Erro::Interno("a anotação não pode ficar vazia".into()));
    }
    let nota = Nota { id: novo_id(), tipo: tipo.to_string(), texto, feita: false, criado_em: agora_ms() };
    conn.execute(
        "INSERT INTO item (id, tipo, titulo, estado, pai_id, criado_em, alterado_em) VALUES (?1, ?2, ?3, 'aberta', ?4, ?5, ?5)",
        params![nota.id, nota.tipo, nota.texto, profissional_id, nota.criado_em],
    )?;
    Ok(nota)
}

pub fn marcar_nota(conn: &Connection, id: &str, feita: bool) -> Result<(), Erro> {
    let estado = if feita { "feita" } else { "aberta" };
    conn.execute(
        "UPDATE item SET estado = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo IN ('pauta', 'pergunta') AND excluido_em IS NULL",
        params![id, estado, agora_ms()],
    )?;
    Ok(())
}

pub fn excluir_nota(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo IN ('pauta', 'pergunta')", params![id, agora_ms()])?;
    Ok(())
}

// ---------- Diário de sessões (por profissional) ----------

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistroSessao {
    pub id: String,
    /// Data da sessão ("AAAA-MM-DD").
    pub data: String,
    /// Anotação em Markdown.
    pub nota: String,
    pub criado_em: i64,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DadosSessao {
    #[serde(default)]
    data: String,
}

pub fn registrar_sessao(conn: &Connection, profissional_id: &str, data: &str, nota: &str) -> Result<RegistroSessao, Erro> {
    if profissional_id.trim().is_empty() {
        return Err(Erro::Interno("a sessão precisa de um profissional".into()));
    }
    let nota = nota.trim().to_string();
    if nota.is_empty() {
        return Err(Erro::Interno("escreva o que ficou da sessão".into()));
    }
    let agora = agora_ms();
    let r = RegistroSessao { id: novo_id(), data: data.trim().to_string(), nota, criado_em: agora };
    let dados = serde_json::to_string(&DadosSessao { data: r.data.clone() }).map_err(|e| Erro::Interno(e.to_string()))?;
    conn.execute(
        "INSERT INTO item (id, tipo, conteudo, dados, pai_id, criado_em, alterado_em) VALUES (?1, 'cuidado_sessao', ?2, ?3, ?4, ?5, ?5)",
        params![r.id, r.nota, dados, profissional_id, agora],
    )?;
    Ok(r)
}

pub fn listar_sessoes(conn: &Connection, profissional_id: &str) -> Result<Vec<RegistroSessao>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, conteudo, dados, criado_em FROM item
         WHERE tipo = 'cuidado_sessao' AND pai_id = ?1 AND excluido_em IS NULL
         ORDER BY criado_em DESC",
    )?;
    let lista = c
        .query_map(params![profissional_id], |r| {
            let d: DadosSessao = serde_json::from_str(&r.get::<_, String>(2)?).unwrap_or_default();
            Ok(RegistroSessao { id: r.get(0)?, data: d.data, nota: r.get(1)?, criado_em: r.get(3)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn excluir_sessao(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'cuidado_sessao'", params![id, agora_ms()])?;
    Ok(())
}

/// Data "AAAA-MM-DD" (UTC) de um momento em ms. Para a migração das sessões antigas.
fn iso_do_momento(ms: i64) -> String {
    let dias = ms.div_euclid(86_400_000);
    let (a, m, d) = civil(dias);
    format!("{a:04}-{m:02}-{d:02}")
}

/// Converte dias desde 1970-01-01 em (ano, mês, dia) — algoritmo de Howard Hinnant.
fn civil(dias: i64) -> (i64, i64, i64) {
    let z = dias + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (if m <= 2 { y + 1 } else { y }, m, d)
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

    fn profissional(nome: &str) -> Profissional {
        Profissional { id: String::new(), nome: nome.into(), especialidade: "psiquiatra".into(), sobre: String::new(), proxima_consulta: String::new(), criado_em: 0 }
    }

    #[test]
    fn profissional_crud_e_campos() {
        let (_p, conn) = banco();
        let p = salvar_profissional(&conn, Profissional { sobre: "  atende online ".into(), proxima_consulta: "2026-11-10".into(), ..profissional(" Dra. Ana ") }).unwrap();
        assert_eq!((p.nome.as_str(), p.especialidade.as_str(), p.sobre.as_str(), p.proxima_consulta.as_str()), ("Dra. Ana", "psiquiatra", "atende online", "2026-11-10"));
        assert!(salvar_profissional(&conn, profissional("  ")).is_err());
        assert_eq!(listar_profissionais(&conn).unwrap().len(), 1);
    }

    #[test]
    fn notas_e_sessoes_por_profissional_e_cascata() {
        let (_p, conn) = banco();
        let a = salvar_profissional(&conn, profissional("Dra. Ana")).unwrap();
        let b = salvar_profissional(&conn, profissional("Dr. Beto")).unwrap();
        criar_nota(&conn, &a.id, "pauta", "falar do sono").unwrap();
        criar_nota(&conn, &a.id, "pergunta", "trocar a dose?").unwrap();
        criar_nota(&conn, &b.id, "pauta", "ansiedade").unwrap();
        assert!(criar_nota(&conn, "", "pauta", "x").is_err());
        assert_eq!(listar_notas(&conn, &a.id, "pauta").unwrap().len(), 1);
        assert_eq!(listar_notas(&conn, &a.id, "pergunta").unwrap().len(), 1);
        assert_eq!(listar_notas(&conn, &b.id, "pauta").unwrap().len(), 1);

        registrar_sessao(&conn, &a.id, "2026-10-20", "falamos do trabalho").unwrap();
        assert!(registrar_sessao(&conn, &a.id, "2026-10-21", "  ").is_err());
        assert_eq!(listar_sessoes(&conn, &a.id).unwrap().len(), 1);
        assert_eq!(listar_sessoes(&conn, &b.id).unwrap().len(), 0);

        excluir_profissional(&conn, &a.id).unwrap();
        assert_eq!(listar_profissionais(&conn).unwrap().len(), 1);
        assert_eq!(listar_notas(&conn, &a.id, "pauta").unwrap().len(), 0);
        assert_eq!(listar_sessoes(&conn, &a.id).unwrap().len(), 0);
    }

    #[test]
    fn migra_notas_e_sessoes_antigas_para_acompanhamento() {
        let (_p, conn) = banco();
        // Formato antigo: notas sem pai e uma sessão no registro.
        conn.execute("INSERT INTO item (id, tipo, titulo, estado, criado_em, alterado_em) VALUES ('n1', 'pauta', 'sono', 'aberta', 1, 1)", []).unwrap();
        conn.execute("INSERT INTO registro (id, tipo, momento, valor, nota, criado_em, alterado_em) VALUES ('s1', 'sessao', 1760000000000, '{}', 'sessão antiga', 1, 1)", []).unwrap();
        let profs = listar_profissionais(&conn).unwrap();
        assert_eq!(profs.len(), 1);
        assert_eq!(profs[0].nome, "Acompanhamento");
        assert_eq!(listar_notas(&conn, &profs[0].id, "pauta").unwrap().len(), 1);
        let ss = listar_sessoes(&conn, &profs[0].id).unwrap();
        assert_eq!(ss.len(), 1);
        assert_eq!(ss[0].nota, "sessão antiga");
        assert!(ss[0].data.starts_with("2025-")); // 1760000000000 ms = out/2025
        // Não migra de novo.
        assert_eq!(listar_profissionais(&conn).unwrap().len(), 1);
    }

    #[test]
    fn civil_converte_datas() {
        assert_eq!(iso_do_momento(0), "1970-01-01");
        assert_eq!(iso_do_momento(1_761_000_000_000), "2025-10-20");
    }
}
