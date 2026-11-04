//! Dinheiro: gastos (por categoria, com marca de interesse especial), contas
//! recorrentes (com aviso antes de vencer), lista de espera de compras (um
//! prazo antes de decidir) e metas de reserva. Valores sempre em **centavos**
//! (inteiro), para não ter erro de arredondamento.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::{agora_ms, novo_id};
use crate::erro::Erro;

// ---------- Gastos ----------

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Gasto {
    pub id: String,
    pub centavos: i64,
    /// Id do grupo (categoria) a que pertence; vazio = sem grupo.
    pub grupo_id: String,
    /// Texto de categoria antigo, mantido para gastos criados antes dos grupos.
    pub categoria: String,
    /// Gasto com interesse especial / hiperfoco. Visível, sem julgamento.
    pub interesse: bool,
    pub descricao: String,
    pub momento: i64,
    /// Nota livre (opcional), além do "o que foi". Fica de fora quando não há.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nota: Option<String>,
    /// Conta fixa que este gasto paga (opcional). Com ela, a conta não conta
    /// de novo no "Saiu" daquele mês. Fica de fora quando não há.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conta_id: Option<String>,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ValorGasto {
    centavos: i64,
    #[serde(default)]
    grupo_id: String,
    #[serde(default)]
    categoria: String,
    #[serde(default)]
    interesse: bool,
    /// Nota livre. A coluna `nota` do registro já guarda a descrição.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    nota: String,
    /// Conta fixa paga por este gasto (vazio = nenhuma).
    #[serde(default, skip_serializing_if = "String::is_empty")]
    conta_id: String,
}

/// Registra um gasto. `momento` (ms desde 1970) permite anotar um gasto de
/// outro dia; sem ele, vale agora.
pub fn registrar_gasto(
    conn: &Connection,
    centavos: i64,
    grupo_id: &str,
    descricao: &str,
    interesse: bool,
    momento: Option<i64>,
    nota: Option<&str>,
    conta_id: Option<&str>,
) -> Result<Gasto, Erro> {
    if centavos < 0 {
        return Err(Erro::Interno("o valor não pode ser negativo".into()));
    }
    let agora = agora_ms();
    let nota = nota.map(str::trim).unwrap_or("").to_string();
    let conta_id = conta_id.map(str::trim).unwrap_or("").to_string();
    let g = Gasto {
        id: novo_id(),
        centavos,
        grupo_id: grupo_id.trim().to_string(),
        categoria: String::new(),
        interesse,
        descricao: descricao.trim().to_string(),
        momento: momento.unwrap_or(agora),
        nota: if nota.is_empty() { None } else { Some(nota.clone()) },
        conta_id: if conta_id.is_empty() { None } else { Some(conta_id.clone()) },
    };
    let valor = ValorGasto { centavos, grupo_id: g.grupo_id.clone(), categoria: String::new(), interesse, nota, conta_id };
    conn.execute(
        "INSERT INTO registro (id, tipo, momento, valor, nota, criado_em, alterado_em) VALUES (?1, 'gasto', ?2, ?3, ?4, ?5, ?5)",
        params![g.id, g.momento, serde_json::to_string(&valor).unwrap(), g.descricao, agora],
    )?;
    Ok(g)
}

pub fn listar_gastos(conn: &Connection, de: i64, ate: i64) -> Result<Vec<Gasto>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, momento, valor, nota FROM registro
         WHERE tipo = 'gasto' AND excluido_em IS NULL AND momento >= ?1 AND momento < ?2 ORDER BY momento DESC",
    )?;
    let lista = c
        .query_map(params![de, ate], |r| {
            let v: ValorGasto = serde_json::from_str(&r.get::<_, String>(2)?).unwrap_or_default();
            let nota = if v.nota.is_empty() { None } else { Some(v.nota) };
            let conta_id = if v.conta_id.is_empty() { None } else { Some(v.conta_id) };
            Ok(Gasto { id: r.get(0)?, momento: r.get(1)?, centavos: v.centavos, grupo_id: v.grupo_id, categoria: v.categoria, interesse: v.interesse, descricao: r.get(3)?, nota, conta_id })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

// ---------- Entradas ----------
// Dinheiro que entrou (salário, venda, presente...). Fica na mesma tabela
// `registro` dos gastos, com `tipo = 'entrada'`: valor em JSON, descrição na
// coluna `nota`. Não precisa de coluna nova.

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Entrada {
    pub id: String,
    pub centavos: i64,
    /// De onde veio, em texto livre.
    pub descricao: String,
    pub momento: i64,
}

#[derive(Serialize, Deserialize, Default)]
struct ValorEntrada {
    centavos: i64,
}

/// Registra uma entrada. `momento` opcional (sem ele, agora).
pub fn registrar_entrada(conn: &Connection, centavos: i64, descricao: &str, momento: Option<i64>) -> Result<Entrada, Erro> {
    if centavos <= 0 {
        return Err(Erro::Interno("escreva quanto entrou, maior que zero".into()));
    }
    let agora = agora_ms();
    let e = Entrada { id: novo_id(), centavos, descricao: descricao.trim().to_string(), momento: momento.unwrap_or(agora) };
    conn.execute(
        "INSERT INTO registro (id, tipo, momento, valor, nota, criado_em, alterado_em) VALUES (?1, 'entrada', ?2, ?3, ?4, ?5, ?5)",
        params![e.id, e.momento, serde_json::to_string(&ValorEntrada { centavos }).unwrap(), e.descricao, agora],
    )?;
    Ok(e)
}

pub fn listar_entradas(conn: &Connection, de: i64, ate: i64) -> Result<Vec<Entrada>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, momento, valor, nota FROM registro
         WHERE tipo = 'entrada' AND excluido_em IS NULL AND momento >= ?1 AND momento < ?2 ORDER BY momento DESC",
    )?;
    let lista = c
        .query_map(params![de, ate], |r| {
            let v: ValorEntrada = serde_json::from_str(&r.get::<_, String>(2)?).unwrap_or_default();
            Ok(Entrada { id: r.get(0)?, momento: r.get(1)?, centavos: v.centavos, descricao: r.get(3)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn excluir_entrada(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE registro SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'entrada'", params![id, agora_ms()])?;
    Ok(())
}

// ---------- Grupos de gasto ----------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Grupo {
    #[serde(default)]
    pub id: String,
    pub nome: String,
    #[serde(default)]
    pub cor: String,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Serialize, Deserialize)]
struct DadosGrupo {
    cor: String,
}

pub fn listar_grupos(conn: &Connection) -> Result<Vec<Grupo>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, dados, criado_em FROM item WHERE tipo = 'grupo_gasto' AND excluido_em IS NULL ORDER BY titulo COLLATE NOCASE",
    )?;
    let lista = c
        .query_map([], |r| {
            let d: DadosGrupo = serde_json::from_str(&r.get::<_, String>(2)?).unwrap_or(DadosGrupo { cor: String::new() });
            Ok(Grupo { id: r.get(0)?, nome: r.get(1)?, cor: d.cor, criado_em: r.get(3)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_grupo(conn: &Connection, mut grupo: Grupo) -> Result<Grupo, Erro> {
    grupo.nome = grupo.nome.trim().to_string();
    if grupo.nome.is_empty() {
        return Err(Erro::Interno("o grupo precisa de um nome".into()));
    }
    if grupo.cor.trim().is_empty() {
        grupo.cor = "mar".into();
    }
    let dados = serde_json::to_string(&DadosGrupo { cor: grupo.cor.clone() }).map_err(|e| Erro::Interno(e.to_string()))?;
    let agora = agora_ms();
    if grupo.id.is_empty() {
        grupo.id = novo_id();
        grupo.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, dados, criado_em, alterado_em) VALUES (?1, 'grupo_gasto', ?2, ?3, ?4, ?4)",
            params![grupo.id, grupo.nome, dados, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, dados = ?3, alterado_em = ?4 WHERE id = ?1 AND tipo = 'grupo_gasto' AND excluido_em IS NULL",
            params![grupo.id, grupo.nome, dados, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("grupo não encontrado".into()));
        }
    }
    Ok(grupo)
}

/// Apaga o grupo. Os gastos dele ficam "sem grupo" (não são apagados).
pub fn excluir_grupo(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'grupo_gasto'", params![id, agora_ms()])?;
    Ok(())
}

pub fn excluir_gasto(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE registro SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'gasto'", params![id, agora_ms()])?;
    Ok(())
}

// ---------- Contas recorrentes ----------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Conta {
    #[serde(default)]
    pub id: String,
    pub nome: String,
    pub centavos: i64,
    /// Dia do mês em que vence (1 a 31).
    pub dia_vencimento: u32,
    /// Com quantos dias de antecedência avisar.
    #[serde(default)]
    pub aviso_dias: u32,
    /// Grupo (categoria) a que pertence; vazio = sem grupo. Mesmo sistema dos gastos.
    #[serde(default)]
    pub grupo_id: String,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DadosConta {
    centavos: i64,
    dia_vencimento: u32,
    aviso_dias: u32,
    #[serde(default)]
    grupo_id: String,
}

pub fn listar_contas(conn: &Connection) -> Result<Vec<Conta>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, dados, criado_em FROM item WHERE tipo = 'conta' AND excluido_em IS NULL ORDER BY titulo COLLATE NOCASE",
    )?;
    let lista = c
        .query_map([], |r| {
            let d: DadosConta = serde_json::from_str(&r.get::<_, String>(2)?).unwrap_or(DadosConta { centavos: 0, dia_vencimento: 1, aviso_dias: 0, grupo_id: String::new() });
            Ok(Conta { id: r.get(0)?, nome: r.get(1)?, centavos: d.centavos, dia_vencimento: d.dia_vencimento, aviso_dias: d.aviso_dias, grupo_id: d.grupo_id, criado_em: r.get(3)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_conta(conn: &Connection, mut conta: Conta) -> Result<Conta, Erro> {
    conta.nome = conta.nome.trim().to_string();
    if conta.nome.is_empty() {
        return Err(Erro::Interno("a conta precisa de um nome".into()));
    }
    if !(1..=31).contains(&conta.dia_vencimento) {
        return Err(Erro::Interno("o dia de vencimento vai de 1 a 31".into()));
    }
    if conta.centavos < 0 {
        return Err(Erro::Interno("o valor não pode ser negativo".into()));
    }
    let dados = serde_json::to_string(&DadosConta { centavos: conta.centavos, dia_vencimento: conta.dia_vencimento, aviso_dias: conta.aviso_dias, grupo_id: conta.grupo_id.trim().to_string() })
        .map_err(|e| Erro::Interno(e.to_string()))?;
    let agora = agora_ms();
    if conta.id.is_empty() {
        conta.id = novo_id();
        conta.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, dados, criado_em, alterado_em) VALUES (?1, 'conta', ?2, ?3, ?4, ?4)",
            params![conta.id, conta.nome, dados, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, dados = ?3, alterado_em = ?4 WHERE id = ?1 AND tipo = 'conta' AND excluido_em IS NULL",
            params![conta.id, conta.nome, dados, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("conta não encontrada".into()));
        }
    }
    Ok(conta)
}

pub fn excluir_conta(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'conta'", params![id, agora_ms()])?;
    Ok(())
}

// ---------- Lista de espera de compras ----------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Desejo {
    #[serde(default)]
    pub id: String,
    pub nome: String,
    pub centavos: i64,
    /// A partir de quando dá para decidir (ms). Antes disso, é hora de esperar.
    pub decidir_em: i64,
    /// "esperando" ou "resolvido" (comprou ou desistiu — sem julgamento).
    #[serde(default)]
    pub estado: String,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DadosDesejo {
    centavos: i64,
    decidir_em: i64,
}

pub fn listar_desejos(conn: &Connection) -> Result<Vec<Desejo>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, estado, dados, criado_em FROM item WHERE tipo = 'desejo' AND excluido_em IS NULL
         ORDER BY CASE estado WHEN 'esperando' THEN 0 ELSE 1 END, criado_em DESC",
    )?;
    let lista = c
        .query_map([], |r| {
            let d: DadosDesejo = serde_json::from_str(&r.get::<_, String>(3)?).unwrap_or(DadosDesejo { centavos: 0, decidir_em: 0 });
            Ok(Desejo { id: r.get(0)?, nome: r.get(1)?, estado: r.get(2)?, centavos: d.centavos, decidir_em: d.decidir_em, criado_em: r.get(4)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

/// Cria um desejo que só pode ser decidido depois de `espera_horas`.
pub fn criar_desejo(conn: &Connection, nome: &str, centavos: i64, espera_horas: i64) -> Result<Desejo, Erro> {
    let nome = nome.trim().to_string();
    if nome.is_empty() {
        return Err(Erro::Interno("escreva o que você quer comprar".into()));
    }
    if centavos < 0 {
        return Err(Erro::Interno("o valor não pode ser negativo".into()));
    }
    let agora = agora_ms();
    let d = Desejo { id: novo_id(), nome, centavos, decidir_em: agora + espera_horas.max(0) * 3_600_000, estado: "esperando".into(), criado_em: agora };
    let dados = serde_json::to_string(&DadosDesejo { centavos: d.centavos, decidir_em: d.decidir_em }).map_err(|e| Erro::Interno(e.to_string()))?;
    conn.execute(
        "INSERT INTO item (id, tipo, titulo, estado, dados, criado_em, alterado_em) VALUES (?1, 'desejo', ?2, 'esperando', ?3, ?4, ?4)",
        params![d.id, d.nome, dados, agora],
    )?;
    Ok(d)
}

pub fn resolver_desejo(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute(
        "UPDATE item SET estado = 'resolvido', alterado_em = ?2 WHERE id = ?1 AND tipo = 'desejo' AND excluido_em IS NULL",
        params![id, agora_ms()],
    )?;
    Ok(())
}

pub fn excluir_desejo(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'desejo'", params![id, agora_ms()])?;
    Ok(())
}

// ---------- Metas de reserva ----------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    #[serde(default)]
    pub id: String,
    pub nome: String,
    pub alvo_centavos: i64,
    #[serde(default)]
    pub guardado_centavos: i64,
    #[serde(default)]
    pub criado_em: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DadosMeta {
    alvo_centavos: i64,
    guardado_centavos: i64,
}

pub fn listar_metas(conn: &Connection) -> Result<Vec<Meta>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, dados, criado_em FROM item WHERE tipo = 'meta_reserva' AND excluido_em IS NULL ORDER BY criado_em DESC",
    )?;
    let lista = c
        .query_map([], |r| {
            let d: DadosMeta = serde_json::from_str(&r.get::<_, String>(2)?).unwrap_or(DadosMeta { alvo_centavos: 0, guardado_centavos: 0 });
            Ok(Meta { id: r.get(0)?, nome: r.get(1)?, alvo_centavos: d.alvo_centavos, guardado_centavos: d.guardado_centavos, criado_em: r.get(3)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_meta(conn: &Connection, mut meta: Meta) -> Result<Meta, Erro> {
    meta.nome = meta.nome.trim().to_string();
    if meta.nome.is_empty() {
        return Err(Erro::Interno("a meta precisa de um nome".into()));
    }
    if meta.alvo_centavos < 0 || meta.guardado_centavos < 0 {
        return Err(Erro::Interno("os valores não podem ser negativos".into()));
    }
    let dados = serde_json::to_string(&DadosMeta { alvo_centavos: meta.alvo_centavos, guardado_centavos: meta.guardado_centavos })
        .map_err(|e| Erro::Interno(e.to_string()))?;
    let agora = agora_ms();
    if meta.id.is_empty() {
        meta.id = novo_id();
        meta.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, dados, criado_em, alterado_em) VALUES (?1, 'meta_reserva', ?2, ?3, ?4, ?4)",
            params![meta.id, meta.nome, dados, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, dados = ?3, alterado_em = ?4 WHERE id = ?1 AND tipo = 'meta_reserva' AND excluido_em IS NULL",
            params![meta.id, meta.nome, dados, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("meta não encontrada".into()));
        }
    }
    Ok(meta)
}

pub fn excluir_meta(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'meta_reserva'", params![id, agora_ms()])?;
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
    fn gastos_registram_e_listam() {
        let (_p, conn) = banco();
        registrar_gasto(&conn, 1250, "g-mercado", "pão e leite", false, None, None, None).unwrap();
        registrar_gasto(&conn, 9900, "g-jogos", "DLC", true, None, None, None).unwrap();
        assert!(registrar_gasto(&conn, -1, "x", "", false, None, None, None).is_err());
        let gs = listar_gastos(&conn, 0, i64::MAX).unwrap();
        assert_eq!(gs.len(), 2);
        assert!(gs.iter().any(|g| g.interesse && g.grupo_id == "g-jogos"));
        assert!(gs.iter().all(|g| g.nota.is_none()));
    }

    #[test]
    fn gasto_guarda_momento_e_nota() {
        let (_p, conn) = banco();
        let ontem = 1_700_000_000_000;
        let g = registrar_gasto(&conn, 4500, "g-casa", "farmácia", false, Some(ontem), Some("  remédio do mês  "), None).unwrap();
        assert_eq!((g.momento, g.nota.as_deref()), (ontem, Some("remédio do mês")));
        // Nota só de espaços conta como sem nota.
        registrar_gasto(&conn, 100, "", "bala", false, Some(ontem + 1), Some("   "), None).unwrap();
        // Gasto que paga uma conta fixa guarda a ligação; sem ela, o campo fica de fora.
        let pago = registrar_gasto(&conn, 2150, "g-casa", "luz", false, Some(ontem + 2), None, Some(" conta-luz ")).unwrap();
        assert_eq!(pago.conta_id.as_deref(), Some("conta-luz"));
        let lidos = listar_gastos(&conn, ontem, ontem + 3).unwrap();
        assert_eq!(lidos.iter().find(|x| x.id == pago.id).unwrap().conta_id.as_deref(), Some("conta-luz"));
        assert!(lidos.iter().filter(|x| x.id != pago.id).all(|x| x.conta_id.is_none()));
        let gs = listar_gastos(&conn, ontem, ontem + 2).unwrap();
        assert_eq!(gs.len(), 2);
        assert_eq!(gs[0].descricao, "bala");
        assert_eq!(gs[0].nota, None);
        assert_eq!((gs[1].momento, gs[1].nota.as_deref(), gs[1].descricao.as_str()), (ontem, Some("remédio do mês"), "farmácia"));
        // Fora do intervalo não aparece; sem momento, vale agora.
        assert!(listar_gastos(&conn, 0, ontem).unwrap().is_empty());
        let agora = registrar_gasto(&conn, 1, "", "x", false, None, None, None).unwrap();
        assert!(agora.momento > ontem);
    }

    #[test]
    fn entradas_registram_listam_e_excluem() {
        let (_p, conn) = banco();
        let dia = 1_700_000_000_000;
        let salario = registrar_entrada(&conn, 250000, " salário ", Some(dia)).unwrap();
        assert_eq!((salario.descricao.as_str(), salario.momento), ("salário", dia));
        registrar_entrada(&conn, 5000, "venda", Some(dia + 10)).unwrap();
        assert!(registrar_entrada(&conn, 0, "nada", None).is_err());
        assert!(registrar_entrada(&conn, -5, "x", None).is_err());
        // Entradas e gastos não se misturam.
        registrar_gasto(&conn, 300, "", "café", false, Some(dia + 5), None, None).unwrap();
        let es = listar_entradas(&conn, dia, dia + 11).unwrap();
        assert_eq!(es.len(), 2);
        assert_eq!((es[0].descricao.as_str(), es[0].centavos), ("venda", 5000));
        assert_eq!(es[1], Entrada { id: salario.id.clone(), centavos: 250000, descricao: "salário".into(), momento: dia });
        assert_eq!(listar_gastos(&conn, dia, dia + 11).unwrap().len(), 1);
        // Excluir entrada não apaga gasto com o mesmo comando, e vice-versa.
        excluir_entrada(&conn, &salario.id).unwrap();
        let es = listar_entradas(&conn, 0, i64::MAX).unwrap();
        assert_eq!(es.len(), 1);
        assert_eq!(es[0].descricao, "venda");
        let gasto = &listar_gastos(&conn, 0, i64::MAX).unwrap()[0];
        excluir_entrada(&conn, &gasto.id).unwrap();
        assert_eq!(listar_gastos(&conn, 0, i64::MAX).unwrap().len(), 1);
        // Sem momento, vale agora.
        assert!(registrar_entrada(&conn, 10, "troco", None).unwrap().momento > dia);
    }

    #[test]
    fn grupos_criam_editam_e_excluem() {
        let (_p, conn) = banco();
        let g = salvar_grupo(&conn, Grupo { id: String::new(), nome: " Assinaturas ".into(), cor: String::new(), criado_em: 0 }).unwrap();
        assert_eq!((g.nome.as_str(), g.cor.as_str()), ("Assinaturas", "mar"));
        assert!(salvar_grupo(&conn, Grupo { id: String::new(), nome: "  ".into(), cor: String::new(), criado_em: 0 }).is_err());
        salvar_grupo(&conn, Grupo { id: g.id.clone(), nome: "Streaming".into(), cor: "ceu".into(), criado_em: 0 }).unwrap();
        assert_eq!(listar_grupos(&conn).unwrap()[0].nome, "Streaming");
        excluir_grupo(&conn, &g.id).unwrap();
        assert!(listar_grupos(&conn).unwrap().is_empty());
    }

    #[test]
    fn conta_valida_dia_e_salva() {
        let (_p, conn) = banco();
        let c = salvar_conta(&conn, Conta { id: String::new(), nome: "Luz".into(), centavos: 12000, dia_vencimento: 10, aviso_dias: 3, grupo_id: "g-casa".into(), criado_em: 0 }).unwrap();
        assert_eq!(c.grupo_id, "g-casa");
        assert!(!c.id.is_empty());
        assert!(salvar_conta(&conn, Conta { id: String::new(), nome: "X".into(), centavos: 0, dia_vencimento: 40, aviso_dias: 0, grupo_id: String::new(), criado_em: 0 }).is_err());
        assert_eq!(listar_contas(&conn).unwrap().len(), 1);
    }

    #[test]
    fn desejo_tem_prazo_e_resolve() {
        let (_p, conn) = banco();
        let d = criar_desejo(&conn, "Fone novo", 30000, 48).unwrap();
        assert!(d.decidir_em > agora_ms());
        assert_eq!(d.estado, "esperando");
        resolver_desejo(&conn, &d.id).unwrap();
        assert_eq!(listar_desejos(&conn).unwrap()[0].estado, "resolvido");
        assert!(criar_desejo(&conn, "  ", 0, 48).is_err());
    }

    #[test]
    fn meta_salva_e_valida() {
        let (_p, conn) = banco();
        salvar_meta(&conn, Meta { id: String::new(), nome: "Viagem".into(), alvo_centavos: 100000, guardado_centavos: 25000, criado_em: 0 }).unwrap();
        assert!(salvar_meta(&conn, Meta { id: String::new(), nome: "".into(), alvo_centavos: 1, guardado_centavos: 0, criado_em: 0 }).is_err());
        let ms = listar_metas(&conn).unwrap();
        assert_eq!(ms.len(), 1);
        assert_eq!((ms[0].alvo_centavos, ms[0].guardado_centavos), (100000, 25000));
    }
}
