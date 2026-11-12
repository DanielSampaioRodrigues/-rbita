//! Anotações de leitura: marcadores, notas, grifos (EPUB) e traços da caneta (PDF).
//!
//! Tudo pendura num livro (pai_id) e guarda na tabela `item` com tipo 'anotacao'.
//! O subtipo (marcador, nota, grifo, traco) fica em `estado`; o texto da nota em
//! `conteudo`; o resto (posição no EPUB/PDF, cor, trecho grifado, pontos do traço)
//! em `dados`, em JSON.
//!
//! - marcador: um ponto salvo (CFI no EPUB, página no PDF) com rótulo opcional.
//! - nota: um ponto com um texto.
//! - grifo: um trecho do EPUB (intervalo de CFI) ou do PDF (página e retângulos, guardados
//!   em pares no campo dos pontos), com cor e, às vezes, uma nota.
//! - traco: um rabisco da caneta numa página do PDF (pontos relativos 0..1).

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::{agora_ms, novo_id};
use crate::erro::Erro;

const SUBTIPOS: [&str; 5] = ["marcador", "nota", "grifo", "traco", "ficha"];
/// Tipos de ficha do fichamento (a ficha vazia vira comentário).
const FICHAS: [&str; 4] = ["citacao", "parafrase", "resumo", "comentario"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Ponto {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Anotacao {
    #[serde(default)]
    pub id: String,
    /// Id do livro a que pertence.
    pub livro_id: String,
    /// "marcador", "nota", "grifo", "traco" ou "ficha".
    pub tipo: String,
    /// EPUB: ponto (marcador/nota) — um CFI.
    #[serde(default)]
    pub epub_cfi: String,
    /// EPUB: intervalo grifado — um CFI de intervalo.
    #[serde(default)]
    pub epub_cfi_range: String,
    /// PDF: página (1 em diante) do marcador/nota/traço.
    #[serde(default)]
    pub pdf_pagina: i64,
    /// Cor do grifo ou do traço (nome da paleta de etiquetas).
    #[serde(default)]
    pub cor: String,
    /// Texto da nota (ou nota presa a um grifo).
    #[serde(default)]
    pub texto: String,
    /// Trecho grifado, guardado para listar sem abrir o livro.
    #[serde(default)]
    pub trecho: String,
    /// Traço da caneta: pontos relativos à página (x e y de 0 a 1).
    #[serde(default)]
    pub pontos: Vec<Ponto>,
    /// Espessura do traço, relativa à largura da página.
    #[serde(default)]
    pub espessura: f64,
    /// Ficha do fichamento: "citacao", "parafrase", "resumo" ou "comentario".
    #[serde(default)]
    pub ficha: String,
    /// Página citada, como a pessoa escreve ("23", "23-25"); vale no EPUB, que não tem página.
    #[serde(default)]
    pub pagina_ref: String,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Dados {
    #[serde(default)]
    epub_cfi: String,
    #[serde(default)]
    epub_cfi_range: String,
    #[serde(default)]
    pdf_pagina: i64,
    #[serde(default)]
    cor: String,
    #[serde(default)]
    trecho: String,
    #[serde(default)]
    pontos: Vec<Ponto>,
    #[serde(default)]
    espessura: f64,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    ficha: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pagina_ref: String,
}

pub fn listar(conn: &Connection, livro_id: &str) -> Result<Vec<Anotacao>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, estado, conteudo, dados, criado_em FROM item
         WHERE tipo = 'anotacao' AND pai_id = ?1 AND excluido_em IS NULL
         ORDER BY criado_em",
    )?;
    let lista = c
        .query_map(params![livro_id], |r| {
            let d: Dados = serde_json::from_str(&r.get::<_, String>(3)?).unwrap_or_default();
            Ok(Anotacao {
                id: r.get(0)?,
                livro_id: livro_id.to_string(),
                tipo: r.get(1)?,
                texto: r.get(2)?,
                epub_cfi: d.epub_cfi,
                epub_cfi_range: d.epub_cfi_range,
                pdf_pagina: d.pdf_pagina,
                cor: d.cor,
                trecho: d.trecho,
                pontos: d.pontos,
                espessura: d.espessura,
                ficha: d.ficha,
                pagina_ref: d.pagina_ref,
                criado_em: r.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar(conn: &Connection, mut a: Anotacao) -> Result<Anotacao, Erro> {
    if a.livro_id.trim().is_empty() {
        return Err(Erro::Interno("a anotação precisa de um livro".into()));
    }
    if !SUBTIPOS.contains(&a.tipo.as_str()) {
        return Err(Erro::Interno("tipo de anotação desconhecido".into()));
    }
    a.texto = a.texto.trim().to_string();
    a.trecho = a.trecho.trim().to_string();
    a.pagina_ref = a.pagina_ref.trim().chars().take(20).collect();
    if a.tipo == "ficha" {
        if !FICHAS.contains(&a.ficha.as_str()) {
            a.ficha = "comentario".into();
        }
    } else {
        a.ficha.clear();
    }
    let dados = serde_json::to_string(&Dados {
        epub_cfi: a.epub_cfi.clone(),
        epub_cfi_range: a.epub_cfi_range.clone(),
        pdf_pagina: a.pdf_pagina,
        cor: a.cor.clone(),
        trecho: a.trecho.clone(),
        pontos: a.pontos.clone(),
        espessura: a.espessura,
        ficha: a.ficha.clone(),
        pagina_ref: a.pagina_ref.clone(),
    })
    .map_err(|e| Erro::Interno(e.to_string()))?;
    let agora = agora_ms();
    if a.id.is_empty() {
        a.id = novo_id();
        a.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, estado, conteudo, dados, pai_id, criado_em, alterado_em)
             VALUES (?1, 'anotacao', ?2, ?3, ?4, ?5, ?6, ?6)",
            params![a.id, a.tipo, a.texto, dados, a.livro_id, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET estado = ?2, conteudo = ?3, dados = ?4, alterado_em = ?5
             WHERE id = ?1 AND tipo = 'anotacao' AND excluido_em IS NULL",
            params![a.id, a.tipo, a.texto, dados, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("anotação não encontrada".into()));
        }
    }
    Ok(a)
}

pub fn excluir(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute(
        "UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'anotacao'",
        params![id, agora_ms()],
    )?;
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

    fn marcador(livro: &str, cfi: &str) -> Anotacao {
        Anotacao {
            id: String::new(),
            livro_id: livro.into(),
            tipo: "marcador".into(),
            epub_cfi: cfi.into(),
            epub_cfi_range: String::new(),
            pdf_pagina: 0,
            cor: String::new(),
            texto: String::new(),
            trecho: String::new(),
            pontos: vec![],
            espessura: 0.0,
            ficha: String::new(),
            pagina_ref: String::new(),
            criado_em: 0,
        }
    }

    #[test]
    fn ficha_guarda_tipo_e_pagina_e_corrige_tipo_desconhecido() {
        let (_p, conn) = banco();
        let f = salvar(&conn, Anotacao { tipo: "ficha".into(), ficha: "citacao".into(), pagina_ref: " 23-25 ".into(), texto: "Trecho".into(), ..marcador("livro-a", "") }).unwrap();
        let outra = salvar(&conn, Anotacao { tipo: "ficha".into(), ficha: "xpto".into(), ..marcador("livro-a", "") }).unwrap();
        let nota = salvar(&conn, Anotacao { tipo: "nota".into(), ficha: "resumo".into(), ..marcador("livro-a", "") }).unwrap();
        let lista = listar(&conn, "livro-a").unwrap();
        let achar = |id: &str| lista.iter().find(|a| a.id == id).unwrap().clone();
        assert_eq!(achar(&f.id).ficha, "citacao");
        assert_eq!(achar(&f.id).pagina_ref, "23-25");
        assert_eq!(achar(&outra.id).ficha, "comentario");
        assert_eq!(achar(&nota.id).ficha, "");
    }

    #[test]
    fn salva_lista_por_livro_e_recusa_tipo_e_livro_invalidos() {
        let (_p, conn) = banco();
        salvar(&conn, marcador("livro-a", "epubcfi(/6/2)")).unwrap();
        salvar(&conn, marcador("livro-b", "epubcfi(/6/4)")).unwrap();
        assert!(salvar(&conn, Anotacao { tipo: "xpto".into(), ..marcador("livro-a", "x") }).is_err());
        assert!(salvar(&conn, Anotacao { livro_id: "  ".into(), ..marcador("", "x") }).is_err());
        assert_eq!(listar(&conn, "livro-a").unwrap().len(), 1);
        assert_eq!(listar(&conn, "livro-b").unwrap().len(), 1);
    }

    #[test]
    fn grifo_guarda_cor_trecho_e_intervalo() {
        let (_p, conn) = banco();
        let g = Anotacao {
            tipo: "grifo".into(),
            epub_cfi_range: "epubcfi(/6/2!/4,/1:0,/1:10)".into(),
            cor: "lavanda".into(),
            trecho: "  um trecho marcante  ".into(),
            texto: "lembrar disso".into(),
            ..marcador("livro", "")
        };
        salvar(&conn, g).unwrap();
        let lido = &listar(&conn, "livro").unwrap()[0];
        assert_eq!(lido.cor, "lavanda");
        assert_eq!(lido.trecho, "um trecho marcante");
        assert_eq!(lido.texto, "lembrar disso");
        assert!(lido.epub_cfi_range.contains("epubcfi"));
    }

    #[test]
    fn traco_guarda_pontos_pagina_e_some_ao_excluir() {
        let (_p, conn) = banco();
        let t = Anotacao {
            tipo: "traco".into(),
            pdf_pagina: 3,
            cor: "mar".into(),
            espessura: 0.004,
            pontos: vec![Ponto { x: 0.1, y: 0.2 }, Ponto { x: 0.3, y: 0.4 }],
            ..marcador("livro", "")
        };
        let salvo = salvar(&conn, t).unwrap();
        let lido = &listar(&conn, "livro").unwrap()[0];
        assert_eq!(lido.pdf_pagina, 3);
        assert_eq!(lido.pontos.len(), 2);
        assert_eq!(lido.pontos[1], Ponto { x: 0.3, y: 0.4 });
        excluir(&conn, &salvo.id).unwrap();
        assert!(listar(&conn, "livro").unwrap().is_empty());
    }
}
