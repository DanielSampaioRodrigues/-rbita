//! Agenda: compromissos e blocos da semana-modelo, na tabela `evento`.
//!
//! Datas em milissegundos desde 1970 (UTC); a tela converte para o horário local.
//! A repetição é guardada como regra e expandida pela tela para o período visível.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::{agora_ms, novo_id};
use crate::erro::Erro;

/// Regra de repetição. `dias` são os dias da semana (0 = domingo) para `semanal`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Repeticao {
    pub frequencia: String,
    #[serde(default)]
    pub dias: Vec<u8>,
    /// Último dia em que ainda repete (ms), se houver.
    #[serde(default)]
    pub ate: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Evento {
    pub id: String,
    pub titulo: String,
    pub inicio: i64,
    pub fim: Option<i64>,
    pub dia_inteiro: bool,
    pub repeticao: Option<Repeticao>,
    /// Faz parte da semana-modelo (bloco fixo da rotina).
    #[serde(default)]
    pub modelo: bool,
    #[serde(default)]
    pub notas: String,
    /// Datas puladas ("AAAA-MM-DD"), quando o evento se repete.
    #[serde(default)]
    pub excecoes: Vec<String>,
    /// Cor do cartão: um nome da paleta das etiquetas ("musgo", "mar"...). Sem cor: `None`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cor: Option<String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Dados {
    #[serde(default)]
    modelo: bool,
    #[serde(default)]
    notas: String,
    #[serde(default)]
    excecoes: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    cor: Option<String>,
}

const FREQUENCIAS: &[&str] = &["diaria", "semanal", "mensal"];
/// As mesmas cores das etiquetas (a tela adapta cada uma ao tema claro e escuro).
const CORES: &[&str] = &["musgo", "mar", "ceu", "lavanda", "rosa", "terra", "areia", "cinza"];

fn validar(e: &Evento) -> Result<(), Erro> {
    if e.titulo.trim().is_empty() {
        return Err(Erro::TextoVazio);
    }
    if let Some(fim) = e.fim {
        if fim < e.inicio {
            return Err(Erro::Interno("o fim vem antes do começo".into()));
        }
    }
    if let Some(cor) = &e.cor {
        if !CORES.contains(&cor.as_str()) {
            return Err(Erro::Interno(format!("cor desconhecida: {cor}")));
        }
    }
    if let Some(r) = &e.repeticao {
        if !FREQUENCIAS.contains(&r.frequencia.as_str()) {
            return Err(Erro::Interno(format!("repetição desconhecida: {}", r.frequencia)));
        }
        if r.frequencia == "semanal" && (r.dias.is_empty() || r.dias.iter().any(|d| *d > 6)) {
            return Err(Erro::Interno("escolha pelo menos um dia da semana".into()));
        }
    }
    Ok(())
}

fn da_linha(r: &rusqlite::Row) -> rusqlite::Result<Evento> {
    let repeticao: Option<String> = r.get(5)?;
    let dados: Dados = serde_json::from_str(&r.get::<_, String>(6)?).unwrap_or_default();
    Ok(Evento {
        id: r.get(0)?,
        titulo: r.get(1)?,
        inicio: r.get(2)?,
        fim: r.get(3)?,
        dia_inteiro: r.get::<_, i64>(4)? != 0,
        repeticao: repeticao.and_then(|t| serde_json::from_str(&t).ok()),
        modelo: dados.modelo,
        notas: dados.notas,
        excecoes: dados.excecoes,
        cor: dados.cor,
    })
}

const SELECAO: &str = "SELECT id, titulo, inicio, fim, dia_inteiro, repeticao, dados FROM evento WHERE excluido_em IS NULL";

/// Eventos que podem aparecer entre `de` e `ate`: os que se repetem e os que caem no período.
pub fn listar(conn: &Connection, de: i64, ate: i64) -> Result<Vec<Evento>, Erro> {
    let mut c = conn.prepare(&format!(
        "{SELECAO} AND (repeticao IS NOT NULL OR (inicio < ?2 AND coalesce(fim, inicio) >= ?1)) ORDER BY inicio"
    ))?;
    let eventos = c.query_map(params![de, ate], da_linha)?.collect::<Result<Vec<_>, _>>()?;
    Ok(eventos)
}

pub fn obter(conn: &Connection, id: &str) -> Result<Evento, Erro> {
    conn.query_row(&format!("{SELECAO} AND id = ?1"), [id], da_linha).optional()?.ok_or(Erro::NaoEncontrado)
}

fn dados_json(e: &Evento) -> String {
    serde_json::to_string(&Dados { modelo: e.modelo, notas: e.notas.trim().to_string(), excecoes: e.excecoes.clone(), cor: e.cor.clone() })
        .unwrap()
}

/// Cria (sem `id`) ou atualiza (com `id`) um evento.
pub fn salvar(conn: &Connection, mut e: Evento) -> Result<Evento, Erro> {
    // Texto vazio vale como "sem cor".
    if e.cor.as_deref().is_some_and(|c| c.trim().is_empty()) {
        e.cor = None;
    }
    validar(&e)?;
    e.titulo = e.titulo.trim().to_string();
    let repeticao = e.repeticao.as_ref().map(|r| serde_json::to_string(r).unwrap());
    let agora = agora_ms();
    if e.id.is_empty() {
        e.id = novo_id();
        conn.execute(
            "INSERT INTO evento (id, titulo, inicio, fim, dia_inteiro, repeticao, dados, criado_em, alterado_em)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
            params![e.id, e.titulo, e.inicio, e.fim, e.dia_inteiro as i64, repeticao, dados_json(&e), agora],
        )?;
    } else {
        let mudou = conn.execute(
            "UPDATE evento SET titulo = ?2, inicio = ?3, fim = ?4, dia_inteiro = ?5, repeticao = ?6, dados = ?7, alterado_em = ?8
             WHERE id = ?1 AND excluido_em IS NULL",
            params![e.id, e.titulo, e.inicio, e.fim, e.dia_inteiro as i64, repeticao, dados_json(&e), agora],
        )?;
        if mudou == 0 {
            return Err(Erro::NaoEncontrado);
        }
    }
    obter(conn, &e.id)
}

/// Pula uma data de um evento que se repete (os outros dias continuam).
pub fn pular_data(conn: &Connection, id: &str, data: &str) -> Result<(), Erro> {
    let mut e = obter(conn, id)?;
    if !e.excecoes.iter().any(|d| d == data) {
        e.excecoes.push(data.to_string());
    }
    salvar(conn, e).map(|_| ())
}

pub fn excluir(conn: &Connection, id: &str) -> Result<(), Erro> {
    let agora = agora_ms();
    conn.execute("UPDATE evento SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1", params![id, agora])?;
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

    fn evento(titulo: &str, inicio: i64) -> Evento {
        Evento {
            id: String::new(),
            titulo: titulo.into(),
            inicio,
            fim: Some(inicio + 3_600_000),
            dia_inteiro: false,
            repeticao: None,
            modelo: false,
            notas: String::new(),
            excecoes: vec![],
            cor: None,
        }
    }

    const DIA: i64 = 86_400_000;

    #[test]
    fn cria_lista_no_periodo_e_edita() {
        let (_p, conn) = banco();
        let consulta = salvar(&conn, evento("Consulta", 10 * DIA)).unwrap();
        salvar(&conn, evento("Longe", 40 * DIA)).unwrap();
        let mut semanal = evento("Terapia", 0);
        semanal.repeticao = Some(Repeticao { frequencia: "semanal".into(), dias: vec![4], ate: None });
        salvar(&conn, semanal).unwrap();

        let titulos: Vec<String> = listar(&conn, 7 * DIA, 14 * DIA).unwrap().into_iter().map(|e| e.titulo).collect();
        assert_eq!(titulos, vec!["Terapia", "Consulta"]);

        let mut editado = consulta.clone();
        editado.titulo = "Consulta com a psiquiatra".into();
        assert_eq!(salvar(&conn, editado).unwrap().titulo, "Consulta com a psiquiatra");
    }

    #[test]
    fn recusa_evento_sem_titulo_fim_antes_do_comeco_e_semana_sem_dias() {
        let (_p, conn) = banco();
        assert!(matches!(salvar(&conn, evento(" ", 0)), Err(Erro::TextoVazio)));
        let mut e = evento("x", 10);
        e.fim = Some(5);
        assert!(salvar(&conn, e).is_err());
        let mut e = evento("x", 10);
        e.repeticao = Some(Repeticao { frequencia: "semanal".into(), dias: vec![], ate: None });
        assert!(salvar(&conn, e).is_err());
    }

    #[test]
    fn guarda_a_cor_e_recusa_cor_desconhecida() {
        let (_p, conn) = banco();
        let mut e = evento("Terapia", 0);
        e.cor = Some("lavanda".into());
        let e = salvar(&conn, e).unwrap();
        assert_eq!(obter(&conn, &e.id).unwrap().cor.as_deref(), Some("lavanda"));
        let mut sem = e.clone();
        sem.cor = Some(String::new());
        assert_eq!(salvar(&conn, sem).unwrap().cor, None);
        let mut ruim = evento("x", 0);
        ruim.cor = Some("vermelho-neon".into());
        assert!(salvar(&conn, ruim).is_err());
    }

    #[test]
    fn pular_data_e_excluir() {
        let (_p, conn) = banco();
        let mut e = evento("Remédio", 0);
        e.repeticao = Some(Repeticao { frequencia: "diaria".into(), dias: vec![], ate: None });
        e.modelo = true;
        let e = salvar(&conn, e).unwrap();
        pular_data(&conn, &e.id, "2026-10-25").unwrap();
        pular_data(&conn, &e.id, "2026-10-25").unwrap();
        let lido = obter(&conn, &e.id).unwrap();
        assert_eq!(lido.excecoes, vec!["2026-10-25"]);
        assert!(lido.modelo);
        assert_eq!(lido.cor, None);
        excluir(&conn, &e.id).unwrap();
        assert!(listar(&conn, 0, 100 * DIA).unwrap().is_empty());
    }
}
