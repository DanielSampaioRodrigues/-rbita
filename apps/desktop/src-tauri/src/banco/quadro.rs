//! Quadro livre de um hobby: cartões soltos que a pessoa posiciona como quiser.
//!
//! Cada cartão é uma linha na tabela `item` (tipo 'quadro_item', pai_id = hobby).
//! O tipo do cartão (texto, arquivo, imagem, link, audio) fica em `estado`; o
//! texto livre em `conteudo`; a posição e o anexo ligado em `dados` (JSON).
//! Arquivos, imagens, links e áudios usam o sistema de anexos comum (pelo
//! anexoId guardado aqui), então o conteúdo pesado fica no cofre, não aqui.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::{agora_ms, novo_id};
use crate::erro::Erro;

// "desenho" guarda a cena desenhada sobre o quadro (JSON no campo texto); não
// é um cartão visível, é a camada de rabisco do quadro inteiro.
const TIPOS: [&str; 6] = ["texto", "arquivo", "imagem", "link", "audio", "desenho"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CartaoQuadro {
    #[serde(default)]
    pub id: String,
    /// Id do hobby (quadro) a que pertence.
    pub hobby_id: String,
    /// "texto", "arquivo", "imagem", "link" ou "audio".
    pub tipo: String,
    /// Texto livre (cartão de texto) ou legenda.
    #[serde(default)]
    pub texto: String,
    /// Id do anexo ligado (arquivo, imagem, link ou áudio).
    #[serde(default)]
    pub anexo_id: String,
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
    #[serde(default)]
    pub largura: f64,
    #[serde(default)]
    pub altura: f64,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Dados {
    #[serde(default)]
    anexo_id: String,
    #[serde(default)]
    x: f64,
    #[serde(default)]
    y: f64,
    #[serde(default)]
    largura: f64,
    #[serde(default)]
    altura: f64,
}

pub fn listar(conn: &Connection, hobby_id: &str) -> Result<Vec<CartaoQuadro>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, estado, conteudo, dados, criado_em FROM item
         WHERE tipo = 'quadro_item' AND pai_id = ?1 AND excluido_em IS NULL
         ORDER BY criado_em",
    )?;
    let lista = c
        .query_map(params![hobby_id], |r| {
            let d: Dados = serde_json::from_str(&r.get::<_, String>(3)?).unwrap_or_default();
            Ok(CartaoQuadro {
                id: r.get(0)?,
                hobby_id: hobby_id.to_string(),
                tipo: r.get(1)?,
                texto: r.get(2)?,
                anexo_id: d.anexo_id,
                x: d.x,
                y: d.y,
                largura: d.largura,
                altura: d.altura,
                criado_em: r.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar(conn: &Connection, mut c: CartaoQuadro) -> Result<CartaoQuadro, Erro> {
    if c.hobby_id.trim().is_empty() {
        return Err(Erro::Interno("o cartão precisa de um quadro".into()));
    }
    if !TIPOS.contains(&c.tipo.as_str()) {
        return Err(Erro::Interno("tipo de cartão desconhecido".into()));
    }
    c.texto = c.texto.trim_end().to_string();
    let dados = serde_json::to_string(&Dados {
        anexo_id: c.anexo_id.clone(),
        x: c.x,
        y: c.y,
        largura: c.largura,
        altura: c.altura,
    })
    .map_err(|e| Erro::Interno(e.to_string()))?;
    let agora = agora_ms();
    if c.id.is_empty() {
        c.id = novo_id();
        c.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, estado, conteudo, dados, pai_id, criado_em, alterado_em)
             VALUES (?1, 'quadro_item', ?2, ?3, ?4, ?5, ?6, ?6)",
            params![c.id, c.tipo, c.texto, dados, c.hobby_id, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET estado = ?2, conteudo = ?3, dados = ?4, alterado_em = ?5
             WHERE id = ?1 AND tipo = 'quadro_item' AND excluido_em IS NULL",
            params![c.id, c.tipo, c.texto, dados, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("cartão não encontrado".into()));
        }
    }
    Ok(c)
}

/// Move o cartão (ao arrastar). Mais leve que salvar o cartão inteiro.
pub fn mover(conn: &Connection, id: &str, x: f64, y: f64) -> Result<(), Erro> {
    let dados: String = conn
        .query_row("SELECT dados FROM item WHERE id = ?1 AND tipo = 'quadro_item' AND excluido_em IS NULL", params![id], |r| r.get(0))
        .map_err(|_| Erro::NaoEncontrado)?;
    let mut d: Dados = serde_json::from_str(&dados).unwrap_or_default();
    d.x = x;
    d.y = y;
    let novo = serde_json::to_string(&d).map_err(|e| Erro::Interno(e.to_string()))?;
    conn.execute("UPDATE item SET dados = ?2, alterado_em = ?3 WHERE id = ?1", params![id, novo, agora_ms()])?;
    Ok(())
}

/// Apaga o cartão. O anexo ligado, se houver, é apagado junto (libera espaço).
pub fn excluir(conn: &Connection, id: &str) -> Result<(), Erro> {
    let dados: Option<String> =
        conn.query_row("SELECT dados FROM item WHERE id = ?1 AND tipo = 'quadro_item'", params![id], |r| r.get(0)).ok();
    if let Some(dados) = dados {
        let d: Dados = serde_json::from_str(&dados).unwrap_or_default();
        if !d.anexo_id.is_empty() {
            let _ = super::anexos::excluir(conn, &d.anexo_id);
        }
    }
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'quadro_item'", params![id, agora_ms()])?;
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

    fn cartao(hobby: &str, tipo: &str) -> CartaoQuadro {
        CartaoQuadro { id: String::new(), hobby_id: hobby.into(), tipo: tipo.into(), texto: String::new(), anexo_id: String::new(), x: 10.0, y: 20.0, largura: 200.0, altura: 120.0, criado_em: 0 }
    }

    #[test]
    fn salva_lista_move_e_valida() {
        let (_p, conn) = banco();
        let c = salvar(&conn, CartaoQuadro { texto: "minha ideia".into(), ..cartao("hobby-1", "texto") }).unwrap();
        salvar(&conn, cartao("hobby-2", "link")).unwrap();
        assert!(salvar(&conn, cartao("hobby-1", "xpto")).is_err());
        assert!(salvar(&conn, CartaoQuadro { hobby_id: "  ".into(), ..cartao("", "texto") }).is_err());
        assert_eq!(listar(&conn, "hobby-1").unwrap().len(), 1);
        assert_eq!(listar(&conn, "hobby-1").unwrap()[0].texto, "minha ideia");

        mover(&conn, &c.id, 300.0, 400.0).unwrap();
        let lido = &listar(&conn, "hobby-1").unwrap()[0];
        assert_eq!((lido.x, lido.y), (300.0, 400.0));
        assert_eq!(lido.largura, 200.0); // mover não mexe no resto

        excluir(&conn, &c.id).unwrap();
        assert!(listar(&conn, "hobby-1").unwrap().is_empty());
        assert!(mover(&conn, &c.id, 1.0, 1.0).is_err());
    }

    #[test]
    fn excluir_cartao_apaga_o_anexo_ligado() {
        use crate::banco::anexos;
        let (_p, conn) = banco();
        // O cartão precisa de um "item" pai para o anexo se ligar; usa o próprio hobby.
        let hobby = crate::banco::hobbies::salvar(&conn, crate::banco::hobbies::Hobby { id: String::new(), nome: "Fotografia".into(), notas: String::new(), criado_em: 0 }).unwrap();
        let anexo = anexos::anexar_arquivo(&conn, &hobby.id, "foto.png", b"\x89PNG").unwrap();
        let c = salvar(&conn, CartaoQuadro { anexo_id: anexo.id.clone(), ..cartao(&hobby.id, "imagem") }).unwrap();
        assert!(anexos::conteudo(&conn, &anexo.id).is_ok());
        excluir(&conn, &c.id).unwrap();
        assert!(anexos::conteudo(&conn, &anexo.id).is_err());
    }
}
