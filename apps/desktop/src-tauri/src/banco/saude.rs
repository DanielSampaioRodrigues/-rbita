//! Saúde: medicação (dose tomada, estoque e receita vencendo), guardada na
//! tabela `item` com tipo `remedio`; as doses tomadas ficam em `registro` tipo
//! `dose`. Consultas e exames são eventos comuns da agenda (com o tipo marcado
//! nos `dados` do evento), então não têm código próprio aqui.
//!
//! O lembrete na hora certa é feito pela interface (o mesmo caminho dos avisos
//! de evento): com a bandeja ligada, a janela escondida continua viva e avisa.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::{agora_ms, ler_config, novo_id};
use crate::erro::Erro;

const CONFIG_PLANO: &str = "plano_de_crise";

/// Um remédio cadastrado. Os campos próprios ficam em JSON na coluna `dados`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Remedio {
    /// Vazio ao criar; preenchido ao salvar.
    #[serde(default)]
    pub id: String,
    pub nome: String,
    /// Texto livre da dose, por exemplo "1 comprimido" ou "10 gotas".
    #[serde(default)]
    pub dose: String,
    /// Horários do dia ("HH:MM", 24h), quando tomar. Vazio = sem horário fixo.
    #[serde(default)]
    pub horarios: Vec<String>,
    /// Unidades em estoque. `None` = a pessoa não controla o estoque deste remédio.
    #[serde(default)]
    pub estoque: Option<i64>,
    /// Unidades gastas a cada dose (para baixar o estoque). Padrão 1.
    #[serde(default = "um")]
    pub por_dose: i64,
    /// Quando a receita vence ("AAAA-MM-DD"). `None` = sem receita a controlar.
    #[serde(default)]
    pub receita: Option<String>,
    /// "ativo" ou "pausado" (pausar não é fracasso; some do dia a dia sem apagar).
    #[serde(default = "ativo")]
    pub estado: String,
    #[serde(default)]
    pub criado_em: i64,
}

fn um() -> i64 {
    1
}

fn ativo() -> String {
    "ativo".into()
}

/// Só os campos guardados em `dados` (o resto vira coluna própria do `item`).
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DadosRemedio {
    dose: String,
    horarios: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    estoque: Option<i64>,
    por_dose: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    receita: Option<String>,
}

fn linha_para_remedio(
    id: String,
    nome: String,
    estado: String,
    dados: String,
    criado_em: i64,
) -> Remedio {
    let d: DadosRemedio = serde_json::from_str(&dados).unwrap_or(DadosRemedio {
        dose: String::new(),
        horarios: Vec::new(),
        estoque: None,
        por_dose: 1,
        receita: None,
    });
    Remedio {
        id,
        nome,
        dose: d.dose,
        horarios: d.horarios,
        estoque: d.estoque,
        por_dose: d.por_dose.max(1),
        receita: d.receita,
        estado,
        criado_em,
    }
}

pub fn listar(conn: &Connection) -> Result<Vec<Remedio>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, titulo, estado, dados, criado_em FROM item
         WHERE tipo = 'remedio' AND excluido_em IS NULL
         ORDER BY CASE estado WHEN 'ativo' THEN 0 ELSE 1 END, titulo COLLATE NOCASE",
    )?;
    let lista = c
        .query_map([], |r| Ok(linha_para_remedio(r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

/// Cria (id vazio) ou atualiza um remédio. Horários são normalizados e ordenados.
pub fn salvar(conn: &Connection, mut remedio: Remedio) -> Result<Remedio, Erro> {
    let nome = remedio.nome.trim().to_string();
    if nome.is_empty() {
        return Err(Erro::Interno("o remédio precisa de um nome".into()));
    }
    remedio.nome = nome;
    remedio.por_dose = remedio.por_dose.max(1);
    remedio.horarios = normalizar_horarios(&remedio.horarios)?;
    if remedio.estado != "pausado" {
        remedio.estado = "ativo".into();
    }
    if let Some(r) = &remedio.receita {
        if r.trim().is_empty() {
            remedio.receita = None;
        }
    }

    let dados = serde_json::to_string(&DadosRemedio {
        dose: remedio.dose.trim().to_string(),
        horarios: remedio.horarios.clone(),
        estoque: remedio.estoque,
        por_dose: remedio.por_dose,
        receita: remedio.receita.clone(),
    })
    .map_err(|e| Erro::Interno(e.to_string()))?;
    remedio.dose = remedio.dose.trim().to_string();

    let agora = agora_ms();
    if remedio.id.is_empty() {
        remedio.id = novo_id();
        remedio.criado_em = agora;
        conn.execute(
            "INSERT INTO item (id, tipo, titulo, estado, dados, criado_em, alterado_em)
             VALUES (?1, 'remedio', ?2, ?3, ?4, ?5, ?5)",
            params![remedio.id, remedio.nome, remedio.estado, dados, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET titulo = ?2, estado = ?3, dados = ?4, alterado_em = ?5
             WHERE id = ?1 AND tipo = 'remedio' AND excluido_em IS NULL",
            params![remedio.id, remedio.nome, remedio.estado, dados, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("remédio não encontrado".into()));
        }
    }
    Ok(remedio)
}

pub fn excluir(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute(
        "UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'remedio'",
        params![id, agora_ms()],
    )?;
    Ok(())
}

/// Liga/desliga o remédio do dia a dia, sem apagar o histórico.
pub fn mudar_estado(conn: &Connection, id: &str, pausado: bool) -> Result<(), Erro> {
    let estado = if pausado { "pausado" } else { "ativo" };
    conn.execute(
        "UPDATE item SET estado = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo = 'remedio' AND excluido_em IS NULL",
        params![id, estado, agora_ms()],
    )?;
    Ok(())
}

/// Uma dose a tomar (ou já tomada) de um remédio num dia.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DoseDoDia {
    pub remedio_id: String,
    pub nome: String,
    pub dose: String,
    pub horario: String,
    pub tomada: bool,
}

/// As doses dos remédios ativos para o dia `data` ("AAAA-MM-DD"), com o que já
/// foi confirmado, em ordem de horário.
pub fn doses_do_dia(conn: &Connection, data: &str) -> Result<Vec<DoseDoDia>, Erro> {
    let remedios: Vec<Remedio> = listar(conn)?.into_iter().filter(|r| r.estado == "ativo").collect();

    let mut c = conn.prepare(
        "SELECT json_extract(valor, '$.remedioId'), json_extract(valor, '$.horario')
         FROM registro
         WHERE tipo = 'dose' AND excluido_em IS NULL AND json_extract(valor, '$.data') = ?1",
    )?;
    let tomadas: Vec<(String, String)> =
        c.query_map([data], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<Result<_, _>>()?;

    let mut doses = Vec::new();
    for r in &remedios {
        for horario in &r.horarios {
            doses.push(DoseDoDia {
                remedio_id: r.id.clone(),
                nome: r.nome.clone(),
                dose: r.dose.clone(),
                horario: horario.clone(),
                tomada: tomadas.iter().any(|(rid, h)| rid == &r.id && h == horario),
            });
        }
    }
    doses.sort_by(|a, b| a.horario.cmp(&b.horario).then(a.nome.cmp(&b.nome)));
    Ok(doses)
}

/// Confirma (ou desfaz) uma dose. Confirmar baixa o estoque; desfazer estorna.
/// Idempotente: confirmar duas vezes não baixa o estoque duas vezes.
pub fn marcar_dose(
    conn: &Connection,
    remedio_id: &str,
    horario: &str,
    data: &str,
    tomada: bool,
) -> Result<(), Erro> {
    let existente: Option<String> = conn
        .query_row(
            "SELECT id FROM registro
             WHERE tipo = 'dose' AND excluido_em IS NULL
               AND json_extract(valor, '$.remedioId') = ?1
               AND json_extract(valor, '$.horario') = ?2
               AND json_extract(valor, '$.data') = ?3",
            params![remedio_id, horario, data],
            |r| r.get(0),
        )
        .optional()?;
    let agora = agora_ms();
    match (tomada, existente) {
        (true, None) => {
            let valor = serde_json::json!({ "remedioId": remedio_id, "horario": horario, "data": data });
            conn.execute(
                "INSERT INTO registro (id, tipo, momento, valor, criado_em, alterado_em)
                 VALUES (?1, 'dose', ?2, ?3, ?2, ?2)",
                params![novo_id(), agora, valor.to_string()],
            )?;
            mexer_estoque(conn, remedio_id, -1)?;
        }
        (false, Some(id)) => {
            conn.execute("UPDATE registro SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1", params![id, agora])?;
            mexer_estoque(conn, remedio_id, 1)?;
        }
        _ => {}
    }
    Ok(())
}

/// Soma `sinal * por_dose` ao estoque, sem deixar passar de zero. Só mexe se o
/// remédio controla estoque (`estoque` não é nulo).
fn mexer_estoque(conn: &Connection, remedio_id: &str, sinal: i64) -> Result<(), Erro> {
    let dados: Option<String> = conn
        .query_row(
            "SELECT dados FROM item WHERE id = ?1 AND tipo = 'remedio' AND excluido_em IS NULL",
            params![remedio_id],
            |r| r.get(0),
        )
        .optional()?;
    let Some(dados) = dados else { return Ok(()) };
    let mut d: DadosRemedio = serde_json::from_str(&dados).map_err(|e| Erro::Interno(e.to_string()))?;
    let Some(estoque) = d.estoque else { return Ok(()) };
    d.estoque = Some((estoque + sinal * d.por_dose.max(1)).max(0));
    let novo = serde_json::to_string(&d).map_err(|e| Erro::Interno(e.to_string()))?;
    conn.execute(
        "UPDATE item SET dados = ?2, alterado_em = ?3 WHERE id = ?1",
        params![remedio_id, novo, agora_ms()],
    )?;
    Ok(())
}

/// Avisos calmos: estoque acabando e receita vencendo. Sem vermelho gritante;
/// quem mostra decide o tom. `hoje` e `limite_estoque` vêm de fora para testar.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AvisoSaude {
    pub remedio_id: String,
    pub nome: String,
    /// "estoque" ou "receita".
    pub tipo: String,
    /// Dias restantes (receita) ou unidades restantes (estoque).
    pub quanto: i64,
}

pub fn alertas(conn: &Connection, hoje: &str, limite_estoque: i64, dias_receita: i64) -> Result<Vec<AvisoSaude>, Erro> {
    let mut avisos = Vec::new();
    for r in listar(conn)?.into_iter().filter(|r| r.estado == "ativo") {
        if let Some(estoque) = r.estoque {
            if estoque <= limite_estoque {
                avisos.push(AvisoSaude { remedio_id: r.id.clone(), nome: r.nome.clone(), tipo: "estoque".into(), quanto: estoque });
            }
        }
        if let Some(receita) = &r.receita {
            if let Some(dias) = dias_entre(hoje, receita) {
                if dias <= dias_receita {
                    avisos.push(AvisoSaude { remedio_id: r.id.clone(), nome: r.nome.clone(), tipo: "receita".into(), quanto: dias });
                }
            }
        }
    }
    Ok(avisos)
}

// ---------- Datas e horários (lógica pura) ----------

/// Dias de `de` até `ate` (ambos "AAAA-MM-DD"). Negativo = já passou. `None` se
/// alguma data for inválida.
fn dias_entre(de: &str, ate: &str) -> Option<i64> {
    Some((ordinal(ate)? - ordinal(de)?) as i64)
}

/// Número do dia desde uma data base, pela contagem de dias do calendário.
fn ordinal(data: &str) -> Option<i32> {
    let (a, m, d) = partes(data)?;
    // Algoritmo de dias contínuos (Howard Hinnant): serve só para diferenças.
    let a = if m <= 2 { a - 1 } else { a };
    let era = if a >= 0 { a } else { a - 399 } / 400;
    let yoe = a - era * 400;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146097 + doe - 719468)
}

fn partes(data: &str) -> Option<(i32, i32, i32)> {
    let mut p = data.split('-');
    let a = p.next()?.parse().ok()?;
    let m = p.next()?.parse().ok()?;
    let d = p.next()?.parse().ok()?;
    if p.next().is_some() || !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    Some((a, m, d))
}

/// Tira espaços, confere "HH:MM" (24h), remove repetidos e ordena.
fn normalizar_horarios(horarios: &[String]) -> Result<Vec<String>, Erro> {
    let mut limpos = Vec::new();
    for h in horarios {
        let h = h.trim();
        if h.is_empty() {
            continue;
        }
        if !hora_valida(h) {
            return Err(Erro::Interno(format!("horário inválido: {h}")));
        }
        if !limpos.contains(&h.to_string()) {
            limpos.push(h.to_string());
        }
    }
    limpos.sort();
    Ok(limpos)
}

fn hora_valida(h: &str) -> bool {
    let mut p = h.split(':');
    let (Some(hh), Some(mm), None) = (p.next(), p.next(), p.next()) else { return false };
    if hh.len() != 2 || mm.len() != 2 {
        return false;
    }
    matches!((hh.parse::<u32>(), mm.parse::<u32>()), (Ok(hh), Ok(mm)) if hh < 24 && mm < 60)
}

// ---------- Registros curtos: difíceis e bons ----------
//
// A Saúde não é só carga negativa: além de sono, sintoma e sobrecarga, a pessoa
// registra o que vai bem — uma coisa boa, uma potencialidade exercida, um
// momento de regulação. Tudo com a mesma captura rápida (intensidade + nota).

const TIPOS_REGISTRO: [&str; 6] = ["sono", "sintoma", "sobrecarga", "coisa_boa", "potencialidade", "regulacao"];
/// Quais registros são do lado positivo (para os gráficos separarem).
pub const TIPOS_POSITIVOS: [&str; 3] = ["coisa_boa", "potencialidade", "regulacao"];

/// Lista dos tipos entre aspas para o `IN (...)` do SQL (strings nossas, seguras).
fn lista_tipos_sql() -> String {
    TIPOS_REGISTRO.iter().map(|t| format!("'{t}'")).collect::<Vec<_>>().join(", ")
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistroSaude {
    pub id: String,
    /// "sono", "sintoma", "sobrecarga", "coisa_boa", "potencialidade" ou "regulacao".
    pub tipo: String,
    pub momento: i64,
    /// De 1 a 5. Opcional. Nos positivos, o quanto ajudou/foi marcante.
    pub intensidade: Option<u8>,
    pub nota: String,
}

#[derive(Serialize, Deserialize)]
struct ValorRegistro {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    intensidade: Option<u8>,
}

pub fn registrar(conn: &Connection, tipo: &str, intensidade: Option<u8>, nota: &str) -> Result<RegistroSaude, Erro> {
    if !TIPOS_REGISTRO.contains(&tipo) {
        return Err(Erro::Interno("tipo de registro de saúde desconhecido".into()));
    }
    if let Some(n) = intensidade {
        if !(1..=5).contains(&n) {
            return Err(Erro::Interno("a intensidade vai de 1 a 5".into()));
        }
    }
    let r = RegistroSaude { id: novo_id(), tipo: tipo.to_string(), momento: agora_ms(), intensidade, nota: nota.trim().to_string() };
    conn.execute(
        "INSERT INTO registro (id, tipo, momento, valor, nota, criado_em, alterado_em) VALUES (?1, ?2, ?3, ?4, ?5, ?3, ?3)",
        params![r.id, r.tipo, r.momento, serde_json::to_string(&ValorRegistro { intensidade }).unwrap(), r.nota],
    )?;
    Ok(r)
}

/// Os registros de saúde (difíceis e bons) no intervalo, dos mais novos aos mais antigos.
pub fn listar_registros(conn: &Connection, de: i64, ate: i64) -> Result<Vec<RegistroSaude>, Erro> {
    let sql = format!(
        "SELECT id, tipo, momento, valor, nota FROM registro
         WHERE tipo IN ({}) AND excluido_em IS NULL
           AND momento >= ?1 AND momento < ?2 ORDER BY momento DESC",
        lista_tipos_sql(),
    );
    let mut c = conn.prepare(&sql)?;
    let lista = c
        .query_map(params![de, ate], |r| {
            let v: ValorRegistro = serde_json::from_str(&r.get::<_, String>(3)?).unwrap_or(ValorRegistro { intensidade: None });
            Ok(RegistroSaude { id: r.get(0)?, tipo: r.get(1)?, momento: r.get(2)?, intensidade: v.intensidade, nota: r.get(4)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn excluir_registro(conn: &Connection, id: &str) -> Result<(), Erro> {
    let sql = format!(
        "UPDATE registro SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo IN ({})",
        lista_tipos_sql(),
    );
    conn.execute(&sql, params![id, agora_ms()])?;
    Ok(())
}

// ---------- Planos de crise e estratégias ----------
//
// A pessoa cria vários planos, não só um. Cada plano é de "crise" (sinais, o que
// ajuda, com quem falar) ou de "estrategia" (o que me faz bem, o que me regula,
// meus apoios). Os três campos servem aos dois; a interface rotula conforme o
// tipo. Guardados na tabela `item` (tipo 'plano_saude'); o tipo em `estado`.

const TIPOS_PLANO: [&str; 2] = ["crise", "estrategia"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlanoSaude {
    #[serde(default)]
    pub id: String,
    /// "crise" ou "estrategia".
    pub tipo: String,
    pub titulo: String,
    #[serde(default)]
    pub sinais: String,
    #[serde(default)]
    pub ajuda: String,
    #[serde(default)]
    pub contatos: String,
    #[serde(default)]
    pub atualizado_em: i64,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DadosPlano {
    #[serde(default)]
    sinais: String,
    #[serde(default)]
    ajuda: String,
    #[serde(default)]
    contatos: String,
}

/// Formato antigo: um plano de crise único guardado em `config`.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PlanoAntigo {
    #[serde(default)]
    sinais: String,
    #[serde(default)]
    ajuda: String,
    #[serde(default)]
    contatos: String,
}

/// Move o plano de crise antigo (config) para a coleção, uma única vez.
fn migrar_plano_antigo(conn: &Connection) -> Result<(), Erro> {
    let Some(texto) = ler_config(conn, CONFIG_PLANO)? else { return Ok(()) };
    let antigo: PlanoAntigo = serde_json::from_str(&texto).unwrap_or_default();
    // Só migra se tiver algo escrito e ainda não houver planos.
    let tem_algo = !(antigo.sinais.is_empty() && antigo.ajuda.is_empty() && antigo.contatos.is_empty());
    let ja_existem: i64 = conn.query_row(
        "SELECT count(*) FROM item WHERE tipo = 'plano_saude' AND excluido_em IS NULL",
        [],
        |r| r.get(0),
    )?;
    if tem_algo && ja_existem == 0 {
        salvar_plano(
            conn,
            PlanoSaude { id: String::new(), tipo: "crise".into(), titulo: "Plano de crise".into(), sinais: antigo.sinais, ajuda: antigo.ajuda, contatos: antigo.contatos, atualizado_em: 0 },
        )?;
    }
    // Apaga a config antiga para não migrar de novo.
    crate::banco::apagar_config(conn, CONFIG_PLANO)?;
    Ok(())
}

pub fn listar_planos(conn: &Connection) -> Result<Vec<PlanoSaude>, Erro> {
    migrar_plano_antigo(conn)?;
    let mut c = conn.prepare(
        "SELECT id, estado, titulo, dados, alterado_em FROM item
         WHERE tipo = 'plano_saude' AND excluido_em IS NULL
         ORDER BY CASE estado WHEN 'crise' THEN 0 ELSE 1 END, titulo COLLATE NOCASE",
    )?;
    let lista = c
        .query_map([], |r| {
            let d: DadosPlano = serde_json::from_str(&r.get::<_, String>(3)?).unwrap_or_default();
            Ok(PlanoSaude { id: r.get(0)?, tipo: r.get(1)?, titulo: r.get(2)?, sinais: d.sinais, ajuda: d.ajuda, contatos: d.contatos, atualizado_em: r.get(4)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

pub fn salvar_plano(conn: &Connection, mut plano: PlanoSaude) -> Result<PlanoSaude, Erro> {
    if !TIPOS_PLANO.contains(&plano.tipo.as_str()) {
        return Err(Erro::Interno("tipo de plano desconhecido".into()));
    }
    plano.titulo = plano.titulo.trim().to_string();
    if plano.titulo.is_empty() {
        plano.titulo = if plano.tipo == "crise" { "Plano de crise".into() } else { "Estratégia".into() };
    }
    plano.sinais = plano.sinais.trim().to_string();
    plano.ajuda = plano.ajuda.trim().to_string();
    plano.contatos = plano.contatos.trim().to_string();
    let dados = serde_json::to_string(&DadosPlano { sinais: plano.sinais.clone(), ajuda: plano.ajuda.clone(), contatos: plano.contatos.clone() })
        .map_err(|e| Erro::Interno(e.to_string()))?;
    let agora = agora_ms();
    plano.atualizado_em = agora;
    if plano.id.is_empty() {
        plano.id = novo_id();
        conn.execute(
            "INSERT INTO item (id, tipo, estado, titulo, dados, criado_em, alterado_em) VALUES (?1, 'plano_saude', ?2, ?3, ?4, ?5, ?5)",
            params![plano.id, plano.tipo, plano.titulo, dados, agora],
        )?;
    } else {
        let n = conn.execute(
            "UPDATE item SET estado = ?2, titulo = ?3, dados = ?4, alterado_em = ?5 WHERE id = ?1 AND tipo = 'plano_saude' AND excluido_em IS NULL",
            params![plano.id, plano.tipo, plano.titulo, dados, agora],
        )?;
        if n == 0 {
            return Err(Erro::Interno("plano não encontrado".into()));
        }
    }
    Ok(plano)
}

pub fn excluir_plano(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id = ?1 AND tipo = 'plano_saude'", params![id, agora_ms()])?;
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

    fn remedio(nome: &str) -> Remedio {
        Remedio {
            id: String::new(),
            nome: nome.into(),
            dose: "1 comprimido".into(),
            horarios: vec!["20:00".into(), "08:00".into(), "08:00".into()],
            estoque: Some(2),
            por_dose: 1,
            receita: None,
            estado: "ativo".into(),
            criado_em: 0,
        }
    }

    #[test]
    fn salva_normaliza_horarios_e_lista() {
        let (_p, conn) = banco();
        let r = salvar(&conn, remedio("Metilfenidato")).unwrap();
        assert!(!r.id.is_empty());
        // Horários sem repetidos e em ordem.
        assert_eq!(r.horarios, vec!["08:00", "20:00"]);
        assert_eq!(listar(&conn).unwrap().len(), 1);
    }

    #[test]
    fn nome_vazio_e_horario_invalido_dao_erro() {
        let (_p, conn) = banco();
        assert!(salvar(&conn, remedio("  ")).is_err());
        let mut r = remedio("X");
        r.horarios = vec!["25:00".into()];
        assert!(salvar(&conn, r).is_err());
    }

    #[test]
    fn dose_baixa_estoque_uma_vez_e_estorna() {
        let (_p, conn) = banco();
        let r = salvar(&conn, remedio("Rivotril")).unwrap();
        marcar_dose(&conn, &r.id, "08:00", "2026-10-26", true).unwrap();
        marcar_dose(&conn, &r.id, "08:00", "2026-10-26", true).unwrap(); // idempotente
        assert_eq!(listar(&conn).unwrap()[0].estoque, Some(1));
        marcar_dose(&conn, &r.id, "08:00", "2026-10-26", false).unwrap();
        assert_eq!(listar(&conn).unwrap()[0].estoque, Some(2));
    }

    #[test]
    fn doses_do_dia_marcam_o_que_foi_tomado() {
        let (_p, conn) = banco();
        let r = salvar(&conn, remedio("Sertralina")).unwrap();
        marcar_dose(&conn, &r.id, "08:00", "2026-10-26", true).unwrap();
        let doses = doses_do_dia(&conn, "2026-10-26").unwrap();
        assert_eq!(doses.len(), 2);
        assert_eq!((doses[0].horario.as_str(), doses[0].tomada), ("08:00", true));
        assert_eq!((doses[1].horario.as_str(), doses[1].tomada), ("20:00", false));
        // Noutro dia, nada tomado.
        assert!(doses_do_dia(&conn, "2026-10-27").unwrap().iter().all(|d| !d.tomada));
    }

    #[test]
    fn pausado_some_das_doses_do_dia() {
        let (_p, conn) = banco();
        let r = salvar(&conn, remedio("Pausado")).unwrap();
        mudar_estado(&conn, &r.id, true).unwrap();
        assert!(doses_do_dia(&conn, "2026-10-26").unwrap().is_empty());
    }

    #[test]
    fn alerta_de_estoque_baixo_e_receita_vencendo() {
        let (_p, conn) = banco();
        let mut r = remedio("Pouco");
        r.estoque = Some(3);
        r.receita = Some("2026-10-30".into());
        salvar(&conn, r).unwrap();
        let a = alertas(&conn, "2026-10-26", 5, 7).unwrap();
        assert_eq!(a.len(), 2);
        assert!(a.iter().any(|x| x.tipo == "estoque" && x.quanto == 3));
        assert!(a.iter().any(|x| x.tipo == "receita" && x.quanto == 4));
        // Longe do limite: sem avisos.
        assert!(alertas(&conn, "2026-10-26", 1, 1).unwrap().is_empty());
    }

    #[test]
    fn dias_entre_conta_certo() {
        assert_eq!(dias_entre("2026-10-26", "2026-10-30"), Some(4));
        assert_eq!(dias_entre("2026-10-26", "2026-10-26"), Some(0));
        assert_eq!(dias_entre("2026-10-26", "2026-10-25"), Some(-1));
        assert_eq!(dias_entre("2026-02-28", "2026-03-01"), Some(1)); // 2026 não é bissexto
        assert_eq!(dias_entre("x", "2026-10-30"), None);
    }

    #[test]
    fn registra_sono_sintoma_sobrecarga_e_valida() {
        let (_p, conn) = banco();
        registrar(&conn, "sono", Some(4), " dormi mal ").unwrap();
        registrar(&conn, "sintoma", Some(3), "dor de cabeça").unwrap();
        registrar(&conn, "sobrecarga", None, "barulho no ônibus").unwrap();
        assert!(registrar(&conn, "outro", None, "").is_err());
        assert!(registrar(&conn, "sono", Some(9), "").is_err());
        let rs = listar_registros(&conn, 0, i64::MAX).unwrap();
        assert_eq!(rs.len(), 3);
        let mut tipos: Vec<&str> = rs.iter().map(|r| r.tipo.as_str()).collect();
        tipos.sort_unstable();
        assert_eq!(tipos, vec!["sintoma", "sobrecarga", "sono"]);
        assert_eq!(rs.iter().find(|r| r.tipo == "sono").unwrap().nota, "dormi mal");
        excluir_registro(&conn, &rs[0].id).unwrap();
        assert_eq!(listar_registros(&conn, 0, i64::MAX).unwrap().len(), 2);
    }

    #[test]
    fn registra_coisas_boas_tambem() {
        let (_p, conn) = banco();
        registrar(&conn, "coisa_boa", Some(5), " caminhada no sol ").unwrap();
        registrar(&conn, "potencialidade", None, "foco no hiperfoco").unwrap();
        registrar(&conn, "regulacao", Some(4), "respiração").unwrap();
        let rs = listar_registros(&conn, 0, i64::MAX).unwrap();
        assert_eq!(rs.len(), 3);
        assert!(rs.iter().all(|r| TIPOS_POSITIVOS.contains(&r.tipo.as_str())));
        assert_eq!(rs.iter().find(|r| r.tipo == "coisa_boa").unwrap().nota, "caminhada no sol");
    }

    #[test]
    fn planos_colecao_valida_ordena_e_exclui() {
        let (_p, conn) = banco();
        salvar_plano(&conn, PlanoSaude { id: String::new(), tipo: "estrategia".into(), titulo: "  O que me regula ".into(), sinais: "música".into(), ajuda: "".into(), contatos: "".into(), atualizado_em: 0 }).unwrap();
        let crise = salvar_plano(&conn, PlanoSaude { id: String::new(), tipo: "crise".into(), titulo: "".into(), sinais: " mãos suando ".into(), ajuda: "respirar".into(), contatos: "mãe".into(), atualizado_em: 0 }).unwrap();
        assert_eq!(crise.titulo, "Plano de crise"); // título vazio vira padrão
        assert!(salvar_plano(&conn, PlanoSaude { id: String::new(), tipo: "xpto".into(), titulo: "x".into(), sinais: "".into(), ajuda: "".into(), contatos: "".into(), atualizado_em: 0 }).is_err());
        let planos = listar_planos(&conn).unwrap();
        assert_eq!(planos.len(), 2);
        assert_eq!(planos[0].tipo, "crise"); // crise primeiro
        assert_eq!(planos[0].sinais, "mãos suando");
        assert_eq!(planos[1].titulo, "O que me regula");
        excluir_plano(&conn, &crise.id).unwrap();
        assert_eq!(listar_planos(&conn).unwrap().len(), 1);
    }

    #[test]
    fn migra_plano_de_crise_antigo_para_a_colecao() {
        let (_p, conn) = banco();
        crate::banco::gravar_config(&conn, CONFIG_PLANO, r#"{"sinais":"aperto no peito","ajuda":"sair do barulho","contatos":"irmã"}"#).unwrap();
        let planos = listar_planos(&conn).unwrap();
        assert_eq!(planos.len(), 1);
        assert_eq!((planos[0].tipo.as_str(), planos[0].sinais.as_str(), planos[0].contatos.as_str()), ("crise", "aperto no peito", "irmã"));
        // Config antiga apagada: não duplica numa segunda leitura.
        assert_eq!(listar_planos(&conn).unwrap().len(), 1);
        assert!(ler_config(&conn, CONFIG_PLANO).unwrap().is_none());
    }
}
