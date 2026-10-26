//! Leitura: a estante de livros com status (quero ler, lendo, lido, pausado) e
//! o diário de leitura (onde parei, impressões, datas de início e fim).
//!
//! O leitor em si (EPUB/PDF, grifos e fichamentos) virá num pacote separado
//! (`packages/leitor`), num passo seguinte. Aqui é só o acompanhamento.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::{agora_ms, novo_id};
use crate::erro::Erro;

const STATUS: [&str; 4] = ["quero", "lendo", "lido", "pausado"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Livro {
    #[serde(default)]
    pub id: String,
    pub titulo: String,
    #[serde(default)]
    pub autor: String,
    /// "quero", "lendo", "lido" ou "pausado".
    #[serde(default)]
    pub status: String,
    /// Diário: em que ponto parou (texto livre, por enquanto).
    #[serde(default)]
    pub onde_parei: String,
    /// Diário: impressões sobre a leitura.
    #[serde(default)]
    pub impressoes: String,
    /// "AAAA-MM-DD", opcionais.
    #[serde(default)]
    pub inicio: String,
    #[serde(default)]
    pub fim: String,
    /// "epub", "pdf" ou vazio (só acompanhamento, sem arquivo).
    #[serde(default)]
    pub formato: String,
    /// Id do anexo com o arquivo do livro, quando houver.
    #[serde(default)]
    pub arquivo_id: String,
    /// Id do grupo (prateleira) a que pertence; vazio = sem grupo.
    #[serde(default)]
    pub grupo_id: String,
    /// Cor da capa/lombada do livro (nome da paleta de etiquetas).
    #[serde(default)]
    pub cor: String,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DadosLivro {
    autor: String,
    onde_parei: String,
    impressoes: String,
    inicio: String,
    fim: String,
    #[serde(default)]
    formato: String,
    #[serde(default)]
    arquivo_id: String,
    #[serde(default)]
    grupo_id: String,
    #[serde(default)]
    cor: String,
}

pub fn listar(conn: &Connection) -> Result<Vec<Livro>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, estado, dados, criado_em FROM item WHERE tipo = 'leitura' AND excluido_em IS NULL
         ORDER BY CASE estado WHEN 'lendo' THEN 0 WHEN 'quero' THEN 1 WHEN 'pausado' THEN 2 ELSE 3 END, titulo COLLATE NOCASE",
    )?;
    let lista = c
        .query_map([], |r| {
            let d: DadosLivro = serde_json::from_str(&r.get::<_, String>(3)?).unwrap_or(DadosLivro {
                autor: String::new(),
                onde_parei: String::new(),
                impressoes: String::new(),
                inicio: String::new(),
                fim: String::new(),
                formato: String::new(),
                arquivo_id: String::new(),
                grupo_id: String::new(),
                cor: String::new(),
            });
            Ok(Livro {
                id: r.get(0)?,
                titulo: r.get(1)?,
                status: r.get::<_, Option<String>>(2)?.unwrap_or_else(|| "quero".into()),
                autor: d.autor,
                onde_parei: d.onde_parei,
                impressoes: d.impressoes,
                inicio: d.inicio,
                fim: d.fim,
                formato: d.formato,
                arquivo_id: d.arquivo_id,
                grupo_id: d.grupo_id,
                cor: d.cor,
                criado_em: r.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar(conn: &Connection, mut livro: Livro) -> Result<Livro, Erro> {
    livro.titulo = livro.titulo.trim().to_string();
    if livro.titulo.is_empty() {
        return Err(Erro::Interno("o livro precisa de um título".into()));
    }
    if !STATUS.contains(&livro.status.as_str()) {
        livro.status = "quero".into();
    }
    livro.autor = livro.autor.trim().to_string();
    let dados = serde_json::to_string(&DadosLivro {
        autor: livro.autor.clone(),
        onde_parei: livro.onde_parei.trim().to_string(),
        impressoes: livro.impressoes.trim().to_string(),
        inicio: livro.inicio.clone(),
        fim: livro.fim.clone(),
        formato: livro.formato.clone(),
        arquivo_id: livro.arquivo_id.clone(),
        grupo_id: livro.grupo_id.clone(),
        cor: livro.cor.clone(),
    })
    .map_err(|e| Erro::Interno(e.to_string()))?;
    let agora = agora_ms();
    if livro.id.is_empty() {
        livro.id = novo_id();
        livro.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, estado, dados, criado_em, alterado_em) VALUES (?1, 'leitura', ?2, ?3, ?4, ?5, ?5)",
            params![livro.id, livro.titulo, livro.status, dados, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, estado = ?3, dados = ?4, alterado_em = ?5 WHERE id = ?1 AND tipo = 'leitura' AND excluido_em IS NULL",
            params![livro.id, livro.titulo, livro.status, dados, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("livro não encontrado".into()));
        }
    }
    Ok(livro)
}

/// Troca só o status (ao arrastar entre prateleiras, por exemplo).
pub fn mudar_status(conn: &Connection, id: &str, status: &str) -> Result<(), Erro> {
    if !STATUS.contains(&status) {
        return Err(Erro::Interno("status de leitura desconhecido".into()));
    }
    let n = conn.execute(
        "UPDATE item SET estado = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo = 'leitura' AND excluido_em IS NULL",
        params![id, status, agora_ms()],
    )?;
    if n == 0 {
        return Err(Erro::Interno("livro não encontrado".into()));
    }
    Ok(())
}

pub fn excluir(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'leitura'", params![id, agora_ms()])?;
    Ok(())
}

// ---------- Grupos de livro (prateleiras) ----------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GrupoLivro {
    #[serde(default)]
    pub id: String,
    pub nome: String,
    #[serde(default)]
    pub criado_em: i64,
}

pub fn listar_grupos(conn: &Connection) -> Result<Vec<GrupoLivro>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, criado_em FROM item WHERE tipo = 'grupo_livro' AND excluido_em IS NULL ORDER BY titulo COLLATE NOCASE",
    )?;
    let lista = c
        .query_map([], |r| Ok(GrupoLivro { id: r.get(0)?, nome: r.get(1)?, criado_em: r.get(2)? }))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_grupo(conn: &Connection, mut grupo: GrupoLivro) -> Result<GrupoLivro, Erro> {
    grupo.nome = grupo.nome.trim().to_string();
    if grupo.nome.is_empty() {
        return Err(Erro::Interno("a prateleira precisa de um nome".into()));
    }
    let agora = agora_ms();
    if grupo.id.is_empty() {
        grupo.id = novo_id();
        grupo.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, criado_em, alterado_em) VALUES (?1, 'grupo_livro', ?2, ?3, ?3)",
            params![grupo.id, grupo.nome, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo = 'grupo_livro' AND excluido_em IS NULL",
            params![grupo.id, grupo.nome, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("prateleira não encontrada".into()));
        }
    }
    Ok(grupo)
}

/// Apaga a prateleira. Os livros dela ficam "sem prateleira", não são apagados.
pub fn excluir_grupo(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'grupo_livro'", params![id, agora_ms()])?;
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

    fn livro(titulo: &str, status: &str) -> Livro {
        Livro { id: String::new(), titulo: titulo.into(), autor: "Autor".into(), status: status.into(), onde_parei: String::new(), impressoes: String::new(), inicio: String::new(), fim: String::new(), formato: String::new(), arquivo_id: String::new(), grupo_id: String::new(), cor: String::new(), criado_em: 0 }
    }

    #[test]
    fn salva_valida_e_ordena_por_status() {
        let (_p, conn) = banco();
        salvar(&conn, livro("Dom Casmurro", "lido")).unwrap();
        salvar(&conn, livro("Torto Arado", "lendo")).unwrap();
        salvar(&conn, livro("Quarto de Despejo", "quero")).unwrap();
        assert!(salvar(&conn, livro("  ", "quero")).is_err());
        let ls = listar(&conn).unwrap();
        // Lendo primeiro, lido por último.
        assert_eq!(ls.first().unwrap().status, "lendo");
        assert_eq!(ls.last().unwrap().status, "lido");
    }

    #[test]
    fn status_invalido_vira_quero_e_mudar_status_valida() {
        let (_p, conn) = banco();
        let l = salvar(&conn, livro("X", "inventado")).unwrap();
        assert_eq!(l.status, "quero");
        mudar_status(&conn, &l.id, "pausado").unwrap();
        assert_eq!(listar(&conn).unwrap()[0].status, "pausado");
        assert!(mudar_status(&conn, &l.id, "xpto").is_err());
    }

    #[test]
    fn diario_guarda_onde_parei_e_impressoes() {
        let (_p, conn) = banco();
        let mut l = livro("Diário", "lendo");
        l.onde_parei = "capítulo 3".into();
        l.impressoes = "está bom".into();
        l.inicio = "2026-10-01".into();
        let salvo = salvar(&conn, l).unwrap();
        salvar(&conn, Livro { onde_parei: "capítulo 5".into(), ..salvo }).unwrap();
        let lido = &listar(&conn).unwrap()[0];
        assert_eq!(lido.onde_parei, "capítulo 5");
        assert_eq!(lido.impressoes, "está bom");
        assert_eq!(lido.inicio, "2026-10-01");
    }
}
