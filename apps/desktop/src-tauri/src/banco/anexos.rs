//! Anexos: imagens, arquivos e links presos a um item (ideia, projeto, tarefa,
//! passo de rotina). O conteúdo dos arquivos fica dentro do banco criptografado.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::{agora_ms, novo_id};
use crate::erro::Erro;

/// Tamanho máximo de um arquivo anexado. Alto para caber livros (EPUB/PDF)
/// pesados; lembrando que o conteúdo entra no banco criptografado e, portanto,
/// no backup.
pub const MAXIMO_BYTES: usize = 300 * 1024 * 1024;

/// O limite em MB, para mostrar na mensagem.
pub const MAXIMO_MB: usize = MAXIMO_BYTES / (1024 * 1024);

#[derive(Debug, Serialize, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Anexo {
    pub id: String,
    /// imagem, arquivo ou link.
    pub tipo: String,
    pub nome: String,
    /// Para links, o endereço; para arquivos, vazio.
    pub endereco: String,
    pub tamanho: i64,
    pub criado_em: i64,
}

#[derive(Default, Serialize, Deserialize)]
struct Dados {
    #[serde(default)]
    tamanho: i64,
}

fn erro(m: &str) -> Erro {
    Erro::Arquivo(m.into())
}

/// Tipo pelo nome do arquivo. Só estes formatos aparecem como imagem.
pub fn tipo_do_arquivo(nome: &str) -> &'static str {
    let ext = nome.rsplit('.').next().unwrap_or("").to_lowercase();
    if ["png", "jpg", "jpeg", "gif", "webp"].contains(&ext.as_str()) {
        "imagem"
    } else {
        "arquivo"
    }
}

pub fn mime(nome: &str) -> &'static str {
    match nome.rsplit('.').next().unwrap_or("").to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    }
}

fn nome_limpo(nome: &str) -> String {
    let n: String = nome.chars().filter(|c| !c.is_control() && !['/', '\\', ':', '*', '?', '"', '<', '>', '|'].contains(c)).collect();
    let n = n.trim().chars().take(120).collect::<String>();
    if n.is_empty() { "anexo".into() } else { n }
}

fn ligar(conn: &Connection, item: &str, anexo: &str, agora: i64) -> Result<(), Erro> {
    let existe: Option<i64> = conn.query_row("SELECT 1 FROM item WHERE id = ?1 AND excluido_em IS NULL", [item], |r| r.get(0)).optional()?;
    if existe.is_none() {
        return Err(Erro::NaoEncontrado);
    }
    conn.execute(
        "INSERT INTO ligacao (id, origem_tipo, origem_id, destino_tipo, destino_id, tipo, criado_em, alterado_em)
         VALUES (?1, 'item', ?2, 'anexo', ?3, 'anexo', ?4, ?4)",
        params![novo_id(), item, anexo, agora],
    )?;
    Ok(())
}

pub fn anexar_arquivo(conn: &Connection, item: &str, nome: &str, conteudo: &[u8]) -> Result<Anexo, Erro> {
    if conteudo.len() > MAXIMO_BYTES {
        return Err(erro(&format!("o arquivo passa de {MAXIMO_MB} MB, o limite para anexos")));
    }
    let nome = nome_limpo(nome);
    let agora = agora_ms();
    let a = Anexo { id: novo_id(), tipo: tipo_do_arquivo(&nome).into(), nome, endereco: String::new(), tamanho: conteudo.len() as i64, criado_em: agora };
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT INTO anexo (id, tipo, nome, endereco, dados, criado_em, alterado_em) VALUES (?1, ?2, ?3, '', ?4, ?5, ?5)",
        params![a.id, a.tipo, a.nome, serde_json::to_string(&Dados { tamanho: a.tamanho }).unwrap(), agora],
    )?;
    tx.execute("INSERT INTO anexo_conteudo (anexo_id, conteudo) VALUES (?1, ?2)", params![a.id, conteudo])?;
    ligar(&tx, item, &a.id, agora)?;
    tx.commit()?;
    Ok(a)
}

/// Só links da web (http e https).
pub fn anexar_link(conn: &Connection, item: &str, nome: &str, endereco: &str) -> Result<Anexo, Erro> {
    let mut endereco = endereco.trim().to_string();
    // "javascript:", "file:", "mailto:"... qualquer protocolo que não seja da web é recusado.
    if let Some((esquema, _)) = endereco.split_once(':') {
        let parece_esquema = !esquema.is_empty() && !esquema.contains(['.', '/']) && esquema.chars().all(|c| c.is_ascii_alphanumeric() || "+-".contains(c));
        if parece_esquema && !["http", "https"].contains(&esquema.to_lowercase().as_str()) {
            return Err(erro("o link precisa ser um endereço da web, como https://exemplo.com"));
        }
    }
    if !endereco.contains("://") {
        endereco = format!("https://{endereco}");
    }
    if !(endereco.starts_with("https://") || endereco.starts_with("http://")) || endereco.contains(char::is_whitespace) || endereco.len() < 12 {
        return Err(erro("o link precisa ser um endereço da web, como https://exemplo.com"));
    }
    let nome = if nome.trim().is_empty() { endereco.trim_start_matches("https://").trim_start_matches("http://").to_string() } else { nome.trim().to_string() };
    let agora = agora_ms();
    let a = Anexo { id: novo_id(), tipo: "link".into(), nome: nome.chars().take(120).collect(), endereco, tamanho: 0, criado_em: agora };
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT INTO anexo (id, tipo, nome, endereco, dados, criado_em, alterado_em) VALUES (?1, 'link', ?2, ?3, '{}', ?4, ?4)",
        params![a.id, a.nome, a.endereco, agora],
    )?;
    ligar(&tx, item, &a.id, agora)?;
    tx.commit()?;
    Ok(a)
}

pub fn listar_do_item(conn: &Connection, item: &str) -> Result<Vec<Anexo>, Erro> {
    let mut c = conn.prepare(
        "SELECT a.id, a.tipo, a.nome, a.endereco, a.dados, a.criado_em FROM anexo a
         JOIN ligacao l ON l.destino_id = a.id AND l.destino_tipo = 'anexo' AND l.origem_tipo = 'item'
         WHERE l.origem_id = ?1 AND l.excluido_em IS NULL AND a.excluido_em IS NULL
         ORDER BY a.criado_em",
    )?;
    let lista = c
        .query_map([item], |r| {
            let dados: Dados = serde_json::from_str(&r.get::<_, String>(4)?).unwrap_or_default();
            Ok(Anexo { id: r.get(0)?, tipo: r.get(1)?, nome: r.get(2)?, endereco: r.get(3)?, tamanho: dados.tamanho, criado_em: r.get(5)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn obter(conn: &Connection, id: &str) -> Result<Anexo, Erro> {
    conn.query_row(
        "SELECT id, tipo, nome, endereco, dados, criado_em FROM anexo WHERE id = ?1 AND excluido_em IS NULL",
        [id],
        |r| {
            let dados: Dados = serde_json::from_str(&r.get::<_, String>(4)?).unwrap_or_default();
            Ok(Anexo { id: r.get(0)?, tipo: r.get(1)?, nome: r.get(2)?, endereco: r.get(3)?, tamanho: dados.tamanho, criado_em: r.get(5)? })
        },
    )
    .optional()?
    .ok_or(Erro::NaoEncontrado)
}

pub fn conteudo(conn: &Connection, id: &str) -> Result<Vec<u8>, Erro> {
    conn.query_row("SELECT conteudo FROM anexo_conteudo WHERE anexo_id = ?1", [id], |r| r.get(0)).optional()?.ok_or(Erro::NaoEncontrado)
}

/// Exclui o anexo e apaga o conteúdo de verdade (não só marca).
pub fn excluir(conn: &Connection, id: &str) -> Result<(), Erro> {
    let agora = agora_ms();
    conn.execute("UPDATE anexo SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1", params![id, agora])?;
    conn.execute("UPDATE ligacao SET excluido_em = ?2 WHERE destino_id = ?1 AND destino_tipo = 'anexo' AND excluido_em IS NULL", params![id, agora])?;
    conn.execute("DELETE FROM anexo_conteudo WHERE anexo_id = ?1", [id])?;
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::itens;
    use crate::banco::testes::banco_de_teste;

    #[test]
    fn anexa_arquivos_e_links_e_exclui_de_verdade() {
        let (_p, conn) = banco_de_teste();
        let ideia = itens::criar_ideia(&conn, "capa do livro").unwrap();
        let img = anexar_arquivo(&conn, &ideia.id, "rascunho/capa?.PNG", b"\x89PNG...").unwrap();
        assert_eq!((img.tipo.as_str(), img.nome.as_str(), img.tamanho), ("imagem", "rascunhocapa.PNG", 7));
        let pdf = anexar_arquivo(&conn, &ideia.id, "referencias.pdf", b"%PDF").unwrap();
        assert_eq!(pdf.tipo, "arquivo");
        let link = anexar_link(&conn, &ideia.id, "", "exemplo.com/farol").unwrap();
        assert_eq!((link.endereco.as_str(), link.nome.as_str()), ("https://exemplo.com/farol", "exemplo.com/farol"));
        assert!(anexar_link(&conn, &ideia.id, "", "javascript:alert(1)").is_err());
        assert!(anexar_link(&conn, &ideia.id, "", "file:///C:/Windows").is_err());
        assert!(anexar_link(&conn, &ideia.id, "Mapa", "exemplo.com:8080/mapa").is_ok());
        assert!(anexar_arquivo(&conn, &ideia.id, "grande.bin", &vec![0u8; MAXIMO_BYTES + 1]).is_err());
        assert_eq!(listar_do_item(&conn, &ideia.id).unwrap().len(), 4);
        assert_eq!(conteudo(&conn, &img.id).unwrap(), b"\x89PNG...");
        excluir(&conn, &img.id).unwrap();
        assert!(conteudo(&conn, &img.id).is_err());
        assert_eq!(listar_do_item(&conn, &ideia.id).unwrap().len(), 3);
        assert!(anexar_link(&conn, "nao-existe", "", "https://exemplo.com").is_err());
    }
}
