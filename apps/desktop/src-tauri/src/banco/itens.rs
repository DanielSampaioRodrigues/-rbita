//! Ideias, projetos e tarefas, todos guardados na tabela `item`.
//!
//! - **Ideia** (`guardada`): fica guardada sem virar compromisso até a pessoa decidir.
//! - **Projeto** (`ativo`, `em_uso`, `pausado`, `concluido`): tem limite de ativos e um
//!   cartão "onde parei" sempre à mão. `em_uso` é o projeto pronto e funcionando,
//!   que pede um cuidado de vez em quando: não conta no limite de ativos e pode ter
//!   um lembrete opcional de "rever a cada N meses".
//! - **Tarefa** (`a_fazer`, `fazendo`, `feita`): filha de um projeto (etapa) ou
//!   de outra tarefa (subtarefa).

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::{agora_ms, etiquetas, gravar_config, ler_config, novo_id, pastas_projeto};
use crate::erro::Erro;

pub(crate) const CONFIG_LIMITE: &str = "limite_projetos_ativos";
pub const LIMITE_PADRAO: u32 = 6;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Ideia {
    pub id: String,
    pub texto: String,
    pub criado_em: i64,
    /// Texto mais longo, opcional.
    pub nota: String,
    /// Ids das etiquetas.
    pub etiquetas: Vec<String>,
    /// Ids das outras ideias ligadas a esta.
    pub ligadas: Vec<String>,
    /// Cor própria da ideia (paleta das etiquetas). Sem cor própria: `None`, e a tela usa
    /// a cor da primeira etiqueta. Guardada em `dados` (campo opcional; ideias antigas não têm).
    pub cor: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OndeParei {
    #[serde(default)]
    pub texto: String,
    #[serde(default)]
    pub proximo_passo: String,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub atualizado_em: i64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DadosProjeto {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    onde_parei: Option<OndeParei>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pausado_em: Option<i64>,
    /// Datas no calendário ("AAAA-MM-DD"), opcionais.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    inicio: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    prazo: Option<String>,
    /// Lembrete opcional de "rever a cada N meses" (projetos em uso). Ausente: desligado.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    revisar_meses: Option<u32>,
    /// Quando a pessoa olhou o projeto pela última vez (começo da contagem do lembrete).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    revisado_em: Option<i64>,
    /// Anotações livres do projeto (texto longo). Ausente: a pessoa nunca escreveu aqui, e a
    /// leitura mostra a nota da ideia de origem, se houver. Texto vazio: a pessoa apagou.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    anotacoes: Option<String>,
    /// Campos que outras partes do app guardam (por exemplo, o peso das tarefas).
    #[serde(flatten)]
    outros: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Projeto {
    pub id: String,
    pub titulo: String,
    pub estado: String,
    pub onde_parei: Option<OndeParei>,
    pub pausado_em: Option<i64>,
    pub inicio: Option<String>,
    pub prazo: Option<String>,
    /// "Rever a cada N meses", se a pessoa ligou o lembrete.
    pub revisar_meses: Option<u32>,
    /// Última vez que a pessoa disse "Olhei".
    pub revisado_em: Option<i64>,
    pub criado_em: i64,
    pub tarefas_feitas: u32,
    pub tarefas_total: u32,
    pub alterado_em: i64,
    /// Ids das etiquetas.
    pub etiquetas: Vec<String>,
    /// Anotações livres. Projetos que vieram de uma ideia antes de existir este campo
    /// mostram a nota da ideia até a pessoa editar (a leitura não grava nada).
    pub anotacoes: String,
    /// Quando a ideia de origem foi criada, se o projeto veio de uma ideia.
    pub ideia_criada_em: Option<i64>,
    /// Ids das pastas de projetos em que ele está (atalhos; ver `pastas_projeto`).
    pub pastas: Vec<String>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Tarefa {
    pub id: String,
    pub pai_id: String,
    pub titulo: String,
    pub estado: String,
    pub ordem: f64,
    /// leve, media ou pesada (para planejar pela energia).
    pub peso: Option<String>,
    /// Prazo ("AAAA-MM-DD"), opcional.
    pub prazo: Option<String>,
    /// Ids das etiquetas.
    pub etiquetas: Vec<String>,
}

/// Um item qualquer, só com o necessário para mostrar numa lista de ligações.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ItemResumo {
    pub id: String,
    /// ideia, projeto ou tarefa.
    pub tipo: String,
    pub titulo: String,
    pub estado: Option<String>,
}

/// Itens ligados a este (ideias, projetos, tarefas), nos dois sentidos.
pub fn resumo_ligados(conn: &Connection, id: &str) -> Result<Vec<ItemResumo>, Erro> {
    let mut lista = Vec::new();
    for outro in etiquetas::ligados(conn, id)? {
        let r = conn
            .query_row(
                "SELECT id, tipo, CASE WHEN tipo = 'ideia' THEN conteudo ELSE titulo END, estado FROM item WHERE id = ?1 AND excluido_em IS NULL",
                [&outro],
                |r| Ok(ItemResumo { id: r.get(0)?, tipo: r.get(1)?, titulo: r.get(2)?, estado: r.get(3)? }),
            )
            .optional()?;
        if let Some(r) = r.filter(|r| ["ideia", "projeto", "tarefa"].contains(&r.tipo.as_str())) {
            lista.push(r);
        }
    }
    Ok(lista)
}

const ESTADOS_PROJETO: &[&str] = &["ativo", "em_uso", "pausado", "concluido"];
const ESTADOS_TAREFA: &[&str] = &["a_fazer", "fazendo", "feita"];

fn texto_limpo(texto: &str) -> Result<String, Erro> {
    let t = texto.trim();
    if t.is_empty() {
        return Err(Erro::TextoVazio);
    }
    Ok(t.to_string())
}

// ---------- Ideias ----------

pub fn listar_ideias(conn: &Connection) -> Result<Vec<Ideia>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, conteudo, criado_em, coalesce(json_extract(dados, '$.nota'), ''), json_extract(dados, '$.cor') FROM item
         WHERE tipo = 'ideia' AND estado = 'guardada' AND excluido_em IS NULL
         ORDER BY criado_em DESC, id DESC",
    )?;
    let mut ideias = c
        .query_map([], |r| {
            let cor: Option<String> = r.get::<_, Option<String>>(4).unwrap_or(None);
            // Uma cor que esta versão não conhece (ex.: vinda de uma versão mais nova) vale como "sem cor".
            let cor = cor.filter(|c| etiquetas::CORES.contains(&c.as_str()));
            Ok(Ideia { id: r.get(0)?, texto: r.get(1)?, criado_em: r.get(2)?, nota: r.get(3)?, etiquetas: vec![], ligadas: vec![], cor })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let guardadas: Vec<String> = ideias.iter().map(|i| i.id.clone()).collect();
    for i in &mut ideias {
        i.etiquetas = etiquetas::do_item(conn, &i.id)?;
        // Só as ligações com outras ideias guardadas (não com o projeto em que uma virou).
        i.ligadas = etiquetas::ligados(conn, &i.id)?.into_iter().filter(|o| guardadas.contains(o)).collect();
    }
    Ok(ideias)
}

pub fn criar_ideia(conn: &Connection, texto: &str) -> Result<Ideia, Erro> {
    let ideia = Ideia { id: novo_id(), texto: texto_limpo(texto)?, criado_em: agora_ms(), nota: String::new(), etiquetas: vec![], ligadas: vec![], cor: None };
    conn.execute(
        "INSERT INTO item (id, tipo, conteudo, estado, criado_em, alterado_em) VALUES (?1, 'ideia', ?2, 'guardada', ?3, ?3)",
        params![ideia.id, ideia.texto, ideia.criado_em],
    )?;
    Ok(ideia)
}

/// A nota mais longa da ideia (vazia apaga).
pub fn salvar_nota_ideia(conn: &Connection, id: &str, nota: &str) -> Result<(), Erro> {
    let nota: String = nota.trim().chars().take(MAXIMO_ANOTACOES).collect();
    let n = conn.execute(
        "UPDATE item SET dados = json_set(dados, '$.nota', ?2), alterado_em = ?3 WHERE id = ?1 AND tipo = 'ideia' AND excluido_em IS NULL",
        params![id, nota, agora_ms()],
    )?;
    if n == 0 {
        return Err(Erro::NaoEncontrado);
    }
    Ok(())
}

/// A cor própria da ideia, da paleta das etiquetas. `None` (ou texto vazio) tira a cor própria.
pub fn definir_cor_ideia(conn: &Connection, id: &str, cor: Option<&str>) -> Result<(), Erro> {
    let cor = cor.map(str::trim).filter(|c| !c.is_empty());
    if let Some(c) = cor {
        if !etiquetas::CORES.contains(&c) {
            return Err(Erro::Interno(format!("cor desconhecida: {c}")));
        }
    }
    let n = match cor {
        Some(c) => conn.execute(
            "UPDATE item SET dados = json_set(dados, '$.cor', ?2), alterado_em = ?3 WHERE id = ?1 AND tipo = 'ideia' AND excluido_em IS NULL",
            params![id, c, agora_ms()],
        )?,
        None => conn.execute(
            "UPDATE item SET dados = json_remove(dados, '$.cor'), alterado_em = ?2 WHERE id = ?1 AND tipo = 'ideia' AND excluido_em IS NULL",
            params![id, agora_ms()],
        )?,
    };
    if n == 0 {
        return Err(Erro::NaoEncontrado);
    }
    Ok(())
}

pub fn editar_ideia(conn: &Connection, id: &str, texto: &str) -> Result<(), Erro> {
    conn.execute(
        "UPDATE item SET conteudo = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo = 'ideia'",
        params![id, texto_limpo(texto)?, agora_ms()],
    )?;
    Ok(())
}

/// A ideia vira projeto. O texto da ideia vira o título, a nota vira as anotações do
/// projeto, as etiquetas e os anexos vão junto (os anexos são os mesmos, sem copiar o
/// arquivo), e a ideia fica ligada ao projeto. Tudo num passo só: ou vai tudo, ou nada.
pub fn ideia_para_projeto(conn: &Connection, id: &str, ativo: bool) -> Result<Projeto, Erro> {
    let (texto, nota): (String, String) = conn
        .query_row(
            "SELECT conteudo, coalesce(json_extract(dados, '$.nota'), '') FROM item WHERE id = ?1 AND tipo = 'ideia' AND excluido_em IS NULL",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or(Erro::NaoEncontrado)?;
    let tx = conn.unchecked_transaction()?;
    let projeto = criar_projeto(&tx, &texto, ativo)?;
    if !nota.trim().is_empty() {
        let mut dados = ler_dados(&tx, &projeto.id)?;
        dados.anotacoes = Some(limitar_anotacoes(&nota));
        gravar_dados(&tx, &projeto.id, &dados)?;
    }
    let etiquetas_da_ideia = etiquetas::do_item(&tx, id)?;
    if !etiquetas_da_ideia.is_empty() {
        etiquetas::definir_do_item(&tx, &projeto.id, &etiquetas_da_ideia)?;
    }
    super::anexos::ligar_os_do_item(&tx, id, &projeto.id)?;
    let agora = agora_ms();
    tx.execute("UPDATE item SET estado = 'virou_projeto', alterado_em = ?2 WHERE id = ?1", params![id, agora])?;
    tx.execute(
        "INSERT INTO ligacao (id, origem_tipo, origem_id, destino_tipo, destino_id, tipo, criado_em, alterado_em)
         VALUES (?1, 'item', ?2, 'item', ?3, 'virou', ?4, ?4)",
        params![novo_id(), id, projeto.id, agora],
    )?;
    let projeto = obter_projeto(&tx, &projeto.id)?;
    tx.commit()?;
    Ok(projeto)
}

// ---------- Projetos ----------

pub fn limite(conn: &Connection) -> Result<u32, Erro> {
    Ok(ler_config(conn, CONFIG_LIMITE)?.and_then(|v| v.parse().ok()).unwrap_or(LIMITE_PADRAO))
}

pub fn definir_limite(conn: &Connection, limite: u32) -> Result<(), Erro> {
    if !(1..=50).contains(&limite) {
        return Err(Erro::Interno("o limite precisa ficar entre 1 e 50".into()));
    }
    gravar_config(conn, CONFIG_LIMITE, &limite.to_string())
}

/// Só `ativo` conta: projetos `em_uso`, pausados e concluídos ficam fora do limite.
fn contar_ativos(conn: &Connection) -> Result<u32, Erro> {
    Ok(conn.query_row(
        "SELECT count(*) FROM item WHERE tipo = 'projeto' AND estado = 'ativo' AND excluido_em IS NULL",
        [],
        |r| r.get(0),
    )?)
}

/// Recusa ativar mais um projeto se o limite já foi atingido.
fn conferir_limite(conn: &Connection) -> Result<(), Erro> {
    let limite = limite(conn)?;
    if contar_ativos(conn)? >= limite {
        return Err(Erro::LimiteDeProjetos { limite });
    }
    Ok(())
}

fn ler_dados(conn: &Connection, id: &str) -> Result<DadosProjeto, Erro> {
    let texto: String = conn
        .query_row("SELECT dados FROM item WHERE id = ?1 AND tipo = 'projeto'", [id], |r| r.get(0))
        .optional()?
        .ok_or(Erro::NaoEncontrado)?;
    Ok(serde_json::from_str(&texto).unwrap_or_default())
}

fn gravar_dados(conn: &Connection, id: &str, dados: &DadosProjeto) -> Result<(), Erro> {
    let texto = serde_json::to_string(dados).map_err(|e| Erro::Interno(e.to_string()))?;
    conn.execute("UPDATE item SET dados = ?2, alterado_em = ?3 WHERE id = ?1", params![id, texto, agora_ms()])?;
    Ok(())
}

/// Limite das anotações do projeto (e da nota da ideia): 20 000 caracteres.
const MAXIMO_ANOTACOES: usize = 20_000;

fn limitar_anotacoes(texto: &str) -> String {
    texto.chars().take(MAXIMO_ANOTACOES).collect()
}

// As duas últimas colunas vêm da ideia de origem (ligação "virou"), se houver.
const SELECAO_PROJETO: &str = "
    SELECT p.id, p.titulo, p.estado, p.dados, p.alterado_em, p.criado_em,
      (SELECT count(*) FROM item t WHERE t.tipo = 'tarefa' AND t.excluido_em IS NULL AND t.estado = 'feita'
         AND (t.pai_id = p.id OR t.pai_id IN (SELECT e.id FROM item e WHERE e.pai_id = p.id))),
      (SELECT count(*) FROM item t WHERE t.tipo = 'tarefa' AND t.excluido_em IS NULL
         AND (t.pai_id = p.id OR t.pai_id IN (SELECT e.id FROM item e WHERE e.pai_id = p.id))),
      (SELECT i.criado_em FROM ligacao l JOIN item i ON i.id = l.origem_id AND i.tipo = 'ideia' AND i.excluido_em IS NULL
         WHERE l.tipo = 'virou' AND l.destino_id = p.id AND l.excluido_em IS NULL ORDER BY l.criado_em LIMIT 1),
      (SELECT coalesce(json_extract(i.dados, '$.nota'), '') FROM ligacao l JOIN item i ON i.id = l.origem_id AND i.tipo = 'ideia' AND i.excluido_em IS NULL
         WHERE l.tipo = 'virou' AND l.destino_id = p.id AND l.excluido_em IS NULL ORDER BY l.criado_em LIMIT 1)
    FROM item p WHERE p.tipo = 'projeto' AND p.excluido_em IS NULL";

fn projeto_da_linha(r: &rusqlite::Row) -> rusqlite::Result<Projeto> {
    let dados: DadosProjeto = serde_json::from_str(&r.get::<_, String>(3)?).unwrap_or_default();
    // Projeto que nunca teve anotações gravadas e veio de uma ideia (antes desta versão):
    // mostra a nota da ideia. Não grava na leitura, para não mexer no alterado_em
    // (a sincronização mescla linha a linha por ele); grava quando a pessoa editar.
    let nota_da_ideia: Option<String> = r.get(9)?;
    let anotacoes = match dados.anotacoes {
        Some(a) => a,
        None => nota_da_ideia.map(|n| limitar_anotacoes(&n)).unwrap_or_default(),
    };
    Ok(Projeto {
        id: r.get(0)?,
        titulo: r.get(1)?,
        estado: r.get(2)?,
        onde_parei: dados.onde_parei,
        pausado_em: dados.pausado_em,
        inicio: dados.inicio,
        prazo: dados.prazo,
        revisar_meses: dados.revisar_meses,
        revisado_em: dados.revisado_em,
        alterado_em: r.get(4)?,
        criado_em: r.get(5)?,
        tarefas_feitas: r.get(6)?,
        tarefas_total: r.get(7)?,
        etiquetas: vec![],
        anotacoes,
        ideia_criada_em: r.get(8)?,
        pastas: vec![],
    })
}

fn com_etiquetas(conn: &Connection, mut p: Projeto) -> Result<Projeto, Erro> {
    p.etiquetas = etiquetas::do_item(conn, &p.id)?;
    p.pastas = pastas_projeto::do_projeto(conn, &p.id)?;
    Ok(p)
}

pub fn listar_projetos(conn: &Connection) -> Result<Vec<Projeto>, Erro> {
    let mut c = conn.prepare(&format!("{SELECAO_PROJETO} ORDER BY p.alterado_em DESC"))?;
    let projetos = c.query_map([], projeto_da_linha)?.collect::<Result<Vec<_>, _>>()?;
    projetos.into_iter().map(|p| com_etiquetas(conn, p)).collect()
}

pub fn obter_projeto(conn: &Connection, id: &str) -> Result<Projeto, Erro> {
    let p = conn.query_row(&format!("{SELECAO_PROJETO} AND p.id = ?1"), [id], projeto_da_linha).optional()?.ok_or(Erro::NaoEncontrado)?;
    com_etiquetas(conn, p)
}

/// Cria um projeto ativo (respeitando o limite) ou já pausado.
pub fn criar_projeto(conn: &Connection, titulo: &str, ativo: bool) -> Result<Projeto, Erro> {
    let titulo = texto_limpo(titulo)?;
    if ativo {
        conferir_limite(conn)?;
    }
    let id = novo_id();
    let agora = agora_ms();
    let dados = if ativo { DadosProjeto::default() } else { DadosProjeto { pausado_em: Some(agora), ..Default::default() } };
    conn.execute(
        "INSERT INTO item (id, tipo, titulo, estado, dados, criado_em, alterado_em) VALUES (?1, 'projeto', ?2, ?3, ?4, ?5, ?5)",
        params![id, titulo, if ativo { "ativo" } else { "pausado" }, serde_json::to_string(&dados).unwrap(), agora],
    )?;
    obter_projeto(conn, &id)
}

pub fn renomear(conn: &Connection, id: &str, titulo: &str) -> Result<(), Erro> {
    conn.execute(
        "UPDATE item SET titulo = ?2, alterado_em = ?3 WHERE id = ?1 AND tipo IN ('projeto', 'tarefa', 'rotina')",
        params![id, texto_limpo(titulo)?, agora_ms()],
    )?;
    Ok(())
}

/// Ativar respeita o limite. Pausar pode guardar o cartão "onde parei" no mesmo passo.
/// Passar para "em uso" não esbarra no limite e recomeça a contagem do lembrete de revisão.
pub fn mudar_estado_projeto(conn: &Connection, id: &str, estado: &str, onde_parei: Option<OndeParei>) -> Result<Projeto, Erro> {
    if !ESTADOS_PROJETO.contains(&estado) {
        return Err(Erro::Interno(format!("estado de projeto desconhecido: {estado}")));
    }
    let atual = obter_projeto(conn, id)?;
    if estado == "ativo" && atual.estado != "ativo" {
        conferir_limite(conn)?;
    }
    let mut dados = ler_dados(conn, id)?;
    if let Some(mut o) = onde_parei {
        o.atualizado_em = agora_ms();
        dados.onde_parei = Some(o);
    }
    dados.pausado_em = (estado == "pausado").then(agora_ms);
    if estado == "em_uso" && atual.estado != "em_uso" {
        dados.revisado_em = Some(agora_ms());
    }
    gravar_dados(conn, id, &dados)?;
    conn.execute("UPDATE item SET estado = ?2 WHERE id = ?1", params![id, estado])?;
    obter_projeto(conn, id)
}

/// Liga (1 a 24 meses) ou desliga (`None`) o lembrete "rever a cada N meses".
/// Ao ligar sem data anterior, a contagem começa agora.
pub fn definir_revisao_projeto(conn: &Connection, id: &str, meses: Option<u32>) -> Result<(), Erro> {
    if let Some(m) = meses {
        if !(1..=24).contains(&m) {
            return Err(Erro::Interno("o lembrete precisa ficar entre 1 e 24 meses".into()));
        }
    }
    let mut dados = ler_dados(conn, id)?;
    dados.revisar_meses = meses;
    if meses.is_some() && dados.revisado_em.is_none() {
        dados.revisado_em = Some(agora_ms());
    }
    gravar_dados(conn, id, &dados)
}

/// "Olhei": reinicia a contagem do lembrete de revisão.
pub fn marcar_projeto_revisado(conn: &Connection, id: &str) -> Result<(), Erro> {
    let mut dados = ler_dados(conn, id)?;
    dados.revisado_em = Some(agora_ms());
    gravar_dados(conn, id, &dados)
}

/// As anotações livres do projeto (até 20 000 caracteres). Texto vazio fica gravado como
/// vazio: a pessoa apagou de propósito, e a nota da ideia de origem não volta.
pub fn salvar_anotacoes_projeto(conn: &Connection, id: &str, texto: &str) -> Result<(), Erro> {
    let mut dados = ler_dados(conn, id)?;
    dados.anotacoes = Some(limitar_anotacoes(texto));
    gravar_dados(conn, id, &dados)
}

pub fn salvar_onde_parei(conn: &Connection, id: &str, mut onde_parei: OndeParei) -> Result<(), Erro> {
    let mut dados = ler_dados(conn, id)?;
    onde_parei.links.retain(|l| !l.trim().is_empty());
    onde_parei.atualizado_em = agora_ms();
    dados.onde_parei = Some(onde_parei);
    gravar_dados(conn, id, &dados)
}

/// Marca como excluído o item e tudo o que está abaixo dele.
pub fn excluir(conn: &Connection, id: &str) -> Result<(), Erro> {
    let agora = agora_ms();
    conn.execute(
        "WITH RECURSIVE abaixo(id) AS (SELECT ?1 UNION ALL SELECT i.id FROM item i JOIN abaixo a ON i.pai_id = a.id)
         UPDATE item SET excluido_em = ?2, alterado_em = ?2 WHERE id IN abaixo AND excluido_em IS NULL",
        params![id, agora],
    )?;
    Ok(())
}

// ---------- Tarefas ----------

/// Todas as tarefas de um projeto (etapas e subtarefas), na ordem.
pub fn listar_tarefas(conn: &Connection, projeto_id: &str) -> Result<Vec<Tarefa>, Erro> {
    let mut c = conn.prepare(
        "SELECT id, pai_id, titulo, estado, ordem, json_extract(dados, '$.peso'), json_extract(dados, '$.prazo') FROM item
         WHERE tipo = 'tarefa' AND excluido_em IS NULL
           AND (pai_id = ?1 OR pai_id IN (SELECT id FROM item WHERE pai_id = ?1 AND tipo = 'tarefa' AND excluido_em IS NULL))
         ORDER BY ordem, criado_em",
    )?;
    let mut tarefas = c
        .query_map([projeto_id], |r| {
            Ok(Tarefa { id: r.get(0)?, pai_id: r.get(1)?, titulo: r.get(2)?, estado: r.get(3)?, ordem: r.get(4)?, peso: r.get(5)?, prazo: r.get(6)?, etiquetas: vec![] })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for t in &mut tarefas {
        t.etiquetas = etiquetas::do_item(conn, &t.id)?;
    }
    Ok(tarefas)
}

fn tocar(conn: &Connection, id: &str) -> Result<(), Erro> {
    conn.execute("UPDATE item SET alterado_em = ?2 WHERE id = ?1", params![id, agora_ms()])?;
    Ok(())
}

/// Projeto ao qual a tarefa pertence (sobe até dois níveis).
fn projeto_da_tarefa(conn: &Connection, pai_id: &str) -> Result<String, Erro> {
    let (tipo, avo): (String, Option<String>) = conn
        .query_row("SELECT tipo, pai_id FROM item WHERE id = ?1 AND excluido_em IS NULL", [pai_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .optional()?
        .ok_or(Erro::NaoEncontrado)?;
    match (tipo.as_str(), avo) {
        ("projeto", _) => Ok(pai_id.to_string()),
        ("tarefa", Some(avo)) => Ok(avo),
        _ => Err(Erro::Interno("tarefa sem projeto".into())),
    }
}

/// Cria uma etapa (pai = projeto) ou subtarefa (pai = etapa), no fim da lista.
pub fn criar_tarefa(conn: &Connection, pai_id: &str, titulo: &str) -> Result<Tarefa, Erro> {
    let titulo = texto_limpo(titulo)?;
    let projeto = projeto_da_tarefa(conn, pai_id)?;
    let ordem: f64 = conn.query_row(
        "SELECT coalesce(max(ordem), 0) + 1 FROM item WHERE pai_id = ?1 AND excluido_em IS NULL",
        [pai_id],
        |r| r.get(0),
    )?;
    let tarefa = Tarefa { id: novo_id(), pai_id: pai_id.to_string(), titulo, estado: "a_fazer".into(), ordem, peso: None, prazo: None, etiquetas: vec![] };
    let agora = agora_ms();
    conn.execute(
        "INSERT INTO item (id, tipo, titulo, estado, pai_id, ordem, criado_em, alterado_em) VALUES (?1, 'tarefa', ?2, 'a_fazer', ?3, ?4, ?5, ?5)",
        params![tarefa.id, tarefa.titulo, tarefa.pai_id, tarefa.ordem, agora],
    )?;
    tocar(conn, &projeto)?;
    Ok(tarefa)
}

pub fn mudar_estado_tarefa(conn: &Connection, id: &str, estado: &str) -> Result<(), Erro> {
    if !ESTADOS_TAREFA.contains(&estado) {
        return Err(Erro::Interno(format!("estado de tarefa desconhecido: {estado}")));
    }
    let pai: String = conn
        .query_row("SELECT pai_id FROM item WHERE id = ?1 AND tipo = 'tarefa'", [id], |r| r.get(0))
        .optional()?
        .ok_or(Erro::NaoEncontrado)?;
    conn.execute("UPDATE item SET estado = ?2, alterado_em = ?3 WHERE id = ?1", params![id, estado, agora_ms()])?;
    tocar(conn, &projeto_da_tarefa(conn, &pai)?)
}

fn validar_data(data: Option<&str>) -> Result<(), Erro> {
    if let Some(d) = data {
        let ok = d.len() == 10
            && d.chars().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() });
        if !ok {
            return Err(Erro::Interno(format!("data inválida: {d}")));
        }
    }
    Ok(())
}

/// Começo e prazo de um projeto ("AAAA-MM-DD"), ambos opcionais.
pub fn definir_datas_projeto(conn: &Connection, id: &str, inicio: Option<&str>, prazo: Option<&str>) -> Result<(), Erro> {
    validar_data(inicio)?;
    validar_data(prazo)?;
    if let (Some(i), Some(p)) = (inicio, prazo) {
        if p < i {
            return Err(Erro::Interno("o prazo vem antes do começo".into()));
        }
    }
    let mut dados = ler_dados(conn, id)?;
    dados.inicio = inicio.map(String::from);
    dados.prazo = prazo.map(String::from);
    gravar_dados(conn, id, &dados)
}

/// Prazo de uma tarefa ("AAAA-MM-DD") ou nenhum.
pub fn definir_prazo_tarefa(conn: &Connection, id: &str, prazo: Option<&str>) -> Result<(), Erro> {
    validar_data(prazo)?;
    let mudou = conn.execute(
        "UPDATE item SET dados = json_set(dados, '$.prazo', ?2), alterado_em = ?3 WHERE id = ?1 AND tipo = 'tarefa'",
        params![id, prazo, agora_ms()],
    )?;
    if mudou == 0 {
        return Err(Erro::NaoEncontrado);
    }
    Ok(())
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Prazo {
    pub id: String,
    /// projeto ou tarefa
    pub tipo: String,
    pub titulo: String,
    pub data: String,
    pub projeto_id: String,
    pub projeto: String,
}

/// Prazos entre duas datas (inclusive): projetos não concluídos e tarefas não feitas de projetos não concluídos.
pub fn listar_prazos(conn: &Connection, de: &str, ate: &str) -> Result<Vec<Prazo>, Erro> {
    let mut c = conn.prepare(
        "SELECT p.id, 'projeto', p.titulo, json_extract(p.dados, '$.prazo'), p.id, p.titulo FROM item p
           WHERE p.tipo = 'projeto' AND p.excluido_em IS NULL AND p.estado != 'concluido'
             AND json_extract(p.dados, '$.prazo') BETWEEN ?1 AND ?2
         UNION ALL
         SELECT t.id, 'tarefa', t.titulo, json_extract(t.dados, '$.prazo'), p.id, p.titulo FROM item t
           JOIN item p ON p.id = t.pai_id OR p.id = (SELECT e.pai_id FROM item e WHERE e.id = t.pai_id)
           WHERE t.tipo = 'tarefa' AND t.excluido_em IS NULL AND t.estado != 'feita'
             AND p.tipo = 'projeto' AND p.excluido_em IS NULL AND p.estado != 'concluido'
             AND json_extract(t.dados, '$.prazo') BETWEEN ?1 AND ?2
         ORDER BY 4, 3",
    )?;
    let lista = c
        .query_map(params![de, ate], |r| {
            Ok(Prazo { id: r.get(0)?, tipo: r.get(1)?, titulo: r.get(2)?, data: r.get(3)?, projeto_id: r.get(4)?, projeto: r.get(5)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

/// Peso da tarefa para planejar pela energia: leve, media, pesada ou nenhum.
pub fn definir_peso(conn: &Connection, id: &str, peso: Option<&str>) -> Result<(), Erro> {
    if let Some(p) = peso {
        if !["leve", "media", "pesada"].contains(&p) {
            return Err(Erro::Interno(format!("peso desconhecido: {p}")));
        }
    }
    let mudou = conn.execute(
        "UPDATE item SET dados = json_set(dados, '$.peso', ?2), alterado_em = ?3 WHERE id = ?1 AND tipo = 'tarefa'",
        params![id, peso, agora_ms()],
    )?;
    if mudou == 0 {
        return Err(Erro::NaoEncontrado);
    }
    Ok(())
}

/// Muda um item (tarefa ou passo de rotina) de posição entre os irmãos:
/// fica logo antes de `antes_de`, ou no fim se `None`.
pub fn mover_item(conn: &Connection, id: &str, antes_de: Option<&str>) -> Result<(), Erro> {
    let pai: String = conn
        .query_row("SELECT pai_id FROM item WHERE id = ?1 AND pai_id IS NOT NULL", [id], |r| r.get(0))
        .optional()?
        .ok_or(Erro::NaoEncontrado)?;
    let mut c = conn.prepare("SELECT id FROM item WHERE pai_id = ?1 AND excluido_em IS NULL AND id != ?2 ORDER BY ordem, criado_em")?;
    let mut irmas: Vec<String> = c.query_map(params![pai, id], |r| r.get(0))?.collect::<Result<_, _>>()?;
    let posicao = antes_de.and_then(|a| irmas.iter().position(|x| x == a)).unwrap_or(irmas.len());
    irmas.insert(posicao, id.to_string());
    // Renumera os irmãos: simples e sem acumular frações.
    let agora = agora_ms();
    for (i, irma) in irmas.iter().enumerate() {
        conn.execute("UPDATE item SET ordem = ?2, alterado_em = ?3 WHERE id = ?1", params![irma, (i + 1) as f64, agora])?;
    }
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

    /// O caminho do relato de Dan: ideia com nota, etiqueta criada, ligada, e a lista traz a etiqueta.
    #[test]
    fn ideia_ganha_etiqueta_e_a_lista_mostra() {
        let (_p, conn) = banco();
        let ideia = criar_ideia(&conn, "MCP").unwrap();
        salvar_nota_ideia(&conn, &ideia.id, "MCP para programas Adobe").unwrap();
        let app = etiquetas::criar(&conn, "APP", "rosa").unwrap();
        etiquetas::definir_do_item(&conn, &ideia.id, &[app.id.clone()]).unwrap();
        let lida = listar_ideias(&conn).unwrap().into_iter().find(|i| i.id == ideia.id).unwrap();
        assert_eq!(lida.etiquetas, vec![app.id.clone()]);
        assert_eq!(lida.nota, "MCP para programas Adobe");
        assert_eq!(lida.cor, None);
    }

    #[test]
    fn ideia_tem_cor_propria_opcional() {
        let (_p, conn) = banco();
        let ideia = criar_ideia(&conn, "farol").unwrap();
        salvar_nota_ideia(&conn, &ideia.id, "nota fica").unwrap();
        let alterado = |conn: &Connection| -> i64 { conn.query_row("SELECT alterado_em FROM item WHERE id = ?1", [&ideia.id], |r| r.get(0)).unwrap() };
        conn.execute("UPDATE item SET alterado_em = 1 WHERE id = ?1", [&ideia.id]).unwrap();
        definir_cor_ideia(&conn, &ideia.id, Some("lavanda")).unwrap();
        assert!(alterado(&conn) > 1, "a sincronização depende do alterado_em");
        let lida = listar_ideias(&conn).unwrap().remove(0);
        assert_eq!((lida.cor.as_deref(), lida.nota.as_str()), (Some("lavanda"), "nota fica"));
        assert!(definir_cor_ideia(&conn, &ideia.id, Some("vermelho-neon")).is_err());
        assert_eq!(listar_ideias(&conn).unwrap()[0].cor.as_deref(), Some("lavanda"));
        conn.execute("UPDATE item SET alterado_em = 1 WHERE id = ?1", [&ideia.id]).unwrap();
        definir_cor_ideia(&conn, &ideia.id, Some("")).unwrap();
        assert!(alterado(&conn) > 1);
        assert_eq!(listar_ideias(&conn).unwrap()[0].cor, None);
        // Retrocompatível: cor desconhecida guardada (versão mais nova) vale como sem cor.
        conn.execute("UPDATE item SET dados = json_set(dados, '$.cor', 'neon') WHERE id = ?1", [&ideia.id]).unwrap();
        assert_eq!(listar_ideias(&conn).unwrap()[0].cor, None);
        assert!(matches!(definir_cor_ideia(&conn, "nao-existe", Some("mar")), Err(Erro::NaoEncontrado)));
    }

    #[test]
    fn ideias_guardam_editam_e_viram_projeto() {
        let (_p, conn) = banco();
        let a = criar_ideia(&conn, "  escrever um livro ").unwrap();
        criar_ideia(&conn, "aprender cerâmica").unwrap();
        assert!(matches!(criar_ideia(&conn, "   "), Err(Erro::TextoVazio)));
        editar_ideia(&conn, &a.id, "escrever um livro de contos").unwrap();
        assert_eq!(listar_ideias(&conn).unwrap().len(), 2);

        let projeto = ideia_para_projeto(&conn, &a.id, true).unwrap();
        assert_eq!(projeto.titulo, "escrever um livro de contos");
        assert_eq!(projeto.estado, "ativo");
        assert_eq!(listar_ideias(&conn).unwrap().len(), 1);
        let ligacoes: i64 = conn.query_row("SELECT count(*) FROM ligacao WHERE origem_id = ?1", [&a.id], |r| r.get(0)).unwrap();
        assert_eq!(ligacoes, 1);
    }

    /// O relato de Dan: a ideia com anotação virou projeto e a anotação sumiu.
    #[test]
    fn ideia_vira_projeto_levando_nota_etiquetas_e_anexos() {
        let (_p, conn) = banco();
        let ideia = criar_ideia(&conn, "MCP").unwrap();
        salvar_nota_ideia(&conn, &ideia.id, "MCP para programas Adobe\ncomeçar pelo Photoshop").unwrap();
        let app = etiquetas::criar(&conn, "APP", "rosa").unwrap();
        let adobe = etiquetas::criar(&conn, "Adobe", "mar").unwrap();
        etiquetas::definir_do_item(&conn, &ideia.id, &[app.id.clone(), adobe.id.clone()]).unwrap();
        let img = super::super::anexos::anexar_arquivo(&conn, &ideia.id, "tela.png", b"\x89PNG").unwrap();
        let link = super::super::anexos::anexar_link(&conn, &ideia.id, "Docs", "https://exemplo.com/mcp").unwrap();

        let projeto = ideia_para_projeto(&conn, &ideia.id, true).unwrap();
        assert_eq!(projeto.anotacoes, "MCP para programas Adobe\ncomeçar pelo Photoshop");
        assert_eq!(projeto.ideia_criada_em, Some(ideia.criado_em));
        let mut etqs = projeto.etiquetas.clone();
        etqs.sort();
        let mut esperado = vec![app.id.clone(), adobe.id.clone()];
        esperado.sort();
        assert_eq!(etqs, esperado);
        let anexos: Vec<String> = super::super::anexos::listar_do_item(&conn, &projeto.id).unwrap().into_iter().map(|a| a.id).collect();
        assert_eq!(anexos, vec![img.id.clone(), link.id.clone()]);
        // O mesmo anexo, sem duplicar o arquivo.
        let conteudos: i64 = conn.query_row("SELECT count(*) FROM anexo_conteudo", [], |r| r.get(0)).unwrap();
        assert_eq!(conteudos, 1);
        // As anotações ficaram gravadas no projeto (não dependem mais da ideia).
        let gravado: Option<String> = conn.query_row("SELECT json_extract(dados, '$.anotacoes') FROM item WHERE id = ?1", [&projeto.id], |r| r.get(0)).unwrap();
        assert_eq!(gravado.as_deref(), Some("MCP para programas Adobe\ncomeçar pelo Photoshop"));
        assert_eq!(listar_projetos(&conn).unwrap()[0].anotacoes, projeto.anotacoes);

        // Editar as anotações guarda no projeto; apagar tudo não traz a nota de volta.
        salvar_anotacoes_projeto(&conn, &projeto.id, "nova anotação").unwrap();
        assert_eq!(obter_projeto(&conn, &projeto.id).unwrap().anotacoes, "nova anotação");
        salvar_anotacoes_projeto(&conn, &projeto.id, "").unwrap();
        assert_eq!(obter_projeto(&conn, &projeto.id).unwrap().anotacoes, "");
        // Limite de 20 000 caracteres.
        salvar_anotacoes_projeto(&conn, &projeto.id, &"á".repeat(20_050)).unwrap();
        assert_eq!(obter_projeto(&conn, &projeto.id).unwrap().anotacoes.chars().count(), 20_000);
        assert!(matches!(salvar_anotacoes_projeto(&conn, "nao-existe", "x"), Err(Erro::NaoEncontrado)));
    }

    #[test]
    fn ideia_sem_nota_vira_projeto_com_anotacoes_vazias() {
        let (_p, conn) = banco();
        let ideia = criar_ideia(&conn, "horta").unwrap();
        let projeto = ideia_para_projeto(&conn, &ideia.id, false).unwrap();
        assert_eq!((projeto.anotacoes.as_str(), projeto.etiquetas.len()), ("", 0));
        assert_eq!(projeto.estado, "pausado");
        // Projeto criado direto não veio de ideia.
        let direto = criar_projeto(&conn, "Mudança", true).unwrap();
        assert_eq!((direto.anotacoes.as_str(), direto.ideia_criada_em), ("", None));
    }

    /// Projetos que viraram projeto antes desta versão: a nota ficou só na ideia.
    #[test]
    fn projeto_antigo_mostra_a_nota_da_ideia_sem_gravar_na_leitura() {
        let (_p, conn) = banco();
        let ideia = criar_ideia(&conn, "Livro").unwrap();
        salvar_nota_ideia(&conn, &ideia.id, "contos sobre faróis").unwrap();
        // Como a versão antiga fazia: só o título, estado e a ligação "virou".
        let projeto = criar_projeto(&conn, "Livro", true).unwrap();
        conn.execute("UPDATE item SET estado = 'virou_projeto' WHERE id = ?1", [&ideia.id]).unwrap();
        conn.execute(
            "INSERT INTO ligacao (id, origem_tipo, origem_id, destino_tipo, destino_id, tipo, criado_em, alterado_em) VALUES ('l1', 'item', ?1, 'item', ?2, 'virou', 5, 5)",
            params![ideia.id, projeto.id],
        )
        .unwrap();
        conn.execute("UPDATE item SET alterado_em = 7 WHERE id = ?1", [&projeto.id]).unwrap();

        let lido = obter_projeto(&conn, &projeto.id).unwrap();
        assert_eq!(lido.anotacoes, "contos sobre faróis");
        assert_eq!(lido.ideia_criada_em, Some(ideia.criado_em));
        assert_eq!(listar_projetos(&conn).unwrap()[0].anotacoes, "contos sobre faróis");
        // Ler não grava: o alterado_em fica igual (a sincronização depende dele).
        assert_eq!(lido.alterado_em, 7);
        let gravado: Option<String> = conn.query_row("SELECT json_extract(dados, '$.anotacoes') FROM item WHERE id = ?1", [&projeto.id], |r| r.get(0)).unwrap();
        assert_eq!(gravado, None);
        // Quando a pessoa edita, passa a valer o que ela escreveu.
        salvar_anotacoes_projeto(&conn, &projeto.id, "contos sobre faróis\ne mapas").unwrap();
        let lido = obter_projeto(&conn, &projeto.id).unwrap();
        assert_eq!(lido.anotacoes, "contos sobre faróis\ne mapas");
        assert!(lido.alterado_em > 7);
    }

    #[test]
    fn limite_de_ativos_e_respeitado_e_pausar_libera_vaga() {
        let (_p, conn) = banco();
        definir_limite(&conn, 2).unwrap();
        let a = criar_projeto(&conn, "A", true).unwrap();
        criar_projeto(&conn, "B", true).unwrap();
        assert!(matches!(criar_projeto(&conn, "C", true), Err(Erro::LimiteDeProjetos { limite: 2 })));
        // Dá para criar já pausado.
        let c = criar_projeto(&conn, "C", false).unwrap();
        assert_eq!(c.estado, "pausado");
        assert!(c.pausado_em.is_some());
        assert!(matches!(mudar_estado_projeto(&conn, &c.id, "ativo", None), Err(Erro::LimiteDeProjetos { .. })));

        let onde = OndeParei { texto: "revisando o capítulo 2".into(), proximo_passo: "reler a cena da praia".into(), ..Default::default() };
        let pausado = mudar_estado_projeto(&conn, &a.id, "pausado", Some(onde)).unwrap();
        assert_eq!(pausado.onde_parei.as_ref().unwrap().proximo_passo, "reler a cena da praia");
        let c = mudar_estado_projeto(&conn, &c.id, "ativo", None).unwrap();
        assert_eq!(c.estado, "ativo");
        assert!(c.pausado_em.is_none());
        // Reativar o que já está ativo não conta duas vezes.
        assert!(mudar_estado_projeto(&conn, &c.id, "ativo", None).is_ok());
    }

    #[test]
    fn em_uso_nao_conta_no_limite_de_ativos() {
        let (_d, conn) = banco();
        definir_limite(&conn, 1).unwrap();
        let a = criar_projeto(&conn, "Livro", true).unwrap();
        // Com o limite cheio, mover para "em uso" funciona e libera a vaga.
        let maps = mudar_estado_projeto(&conn, &a.id, "em_uso", None).unwrap();
        assert_eq!(maps.estado, "em_uso");
        assert!(maps.revisado_em.is_some());
        assert!(maps.pausado_em.is_none());
        assert_eq!(contar_ativos(&conn).unwrap(), 0);
        let b = criar_projeto(&conn, "Site", true).unwrap();
        // Mais um em uso com o limite cheio: também funciona.
        let c = criar_projeto(&conn, "Planilha", false).unwrap();
        assert!(mudar_estado_projeto(&conn, &c.id, "em_uso", None).is_ok());
        assert_eq!(contar_ativos(&conn).unwrap(), 1);
        // Voltar para ativo respeita o limite normalmente.
        assert!(matches!(mudar_estado_projeto(&conn, &a.id, "ativo", None), Err(Erro::LimiteDeProjetos { limite: 1 })));
        mudar_estado_projeto(&conn, &b.id, "pausado", None).unwrap();
        assert_eq!(mudar_estado_projeto(&conn, &a.id, "ativo", None).unwrap().estado, "ativo");
        assert!(mudar_estado_projeto(&conn, &a.id, "inventado", None).is_err());
    }

    #[test]
    fn lembrete_de_revisao_liga_desliga_e_olhei_reinicia() {
        let (_d, conn) = banco();
        let p = criar_projeto(&conn, "MAPS", true).unwrap();
        assert_eq!(p.revisar_meses, None);
        definir_revisao_projeto(&conn, &p.id, Some(3)).unwrap();
        let p2 = obter_projeto(&conn, &p.id).unwrap();
        assert_eq!(p2.revisar_meses, Some(3));
        assert!(p2.revisado_em.is_some());
        assert!(definir_revisao_projeto(&conn, &p.id, Some(0)).is_err());
        assert!(definir_revisao_projeto(&conn, &p.id, Some(25)).is_err());
        conn.execute("UPDATE item SET dados = json_set(dados, '$.revisadoEm', 5) WHERE id = ?1", [&p.id]).unwrap();
        marcar_projeto_revisado(&conn, &p.id).unwrap();
        assert!(obter_projeto(&conn, &p.id).unwrap().revisado_em.unwrap() > 5);
        definir_revisao_projeto(&conn, &p.id, None).unwrap();
        assert_eq!(obter_projeto(&conn, &p.id).unwrap().revisar_meses, None);
    }

    #[test]
    fn onde_parei_fica_guardado_e_ignora_links_vazios() {
        let (_p, conn) = banco();
        let p = criar_projeto(&conn, "TCC", true).unwrap();
        salvar_onde_parei(&conn, &p.id, OndeParei {
            texto: "fichando o artigo 3".into(),
            proximo_passo: "abrir o PDF na página 12".into(),
            links: vec!["https://exemplo.org/artigo".into(), "  ".into()],
            atualizado_em: 0,
        })
        .unwrap();
        let p = obter_projeto(&conn, &p.id).unwrap();
        let o = p.onde_parei.unwrap();
        assert_eq!(o.links, vec!["https://exemplo.org/artigo"]);
        assert!(o.atualizado_em > 0);
    }

    #[test]
    fn tarefas_contam_progresso_ordenam_e_excluem_em_cascata() {
        let (_p, conn) = banco();
        let p = criar_projeto(&conn, "Mudança", true).unwrap();
        let caixas = criar_tarefa(&conn, &p.id, "Encaixotar").unwrap();
        let cozinha = criar_tarefa(&conn, &caixas.id, "Cozinha").unwrap();
        criar_tarefa(&conn, &caixas.id, "Quarto").unwrap();
        let frete = criar_tarefa(&conn, &p.id, "Contratar frete").unwrap();
        mudar_estado_tarefa(&conn, &cozinha.id, "feita").unwrap();

        let p2 = obter_projeto(&conn, &p.id).unwrap();
        assert_eq!((p2.tarefas_feitas, p2.tarefas_total), (1, 4));

        mover_item(&conn, &frete.id, Some(&caixas.id)).unwrap();
        let etapas: Vec<String> = listar_tarefas(&conn, &p.id).unwrap().into_iter().filter(|t| t.pai_id == p.id).map(|t| t.titulo).collect();
        assert_eq!(etapas, vec!["Contratar frete", "Encaixotar"]);

        excluir(&conn, &caixas.id).unwrap();
        let p3 = obter_projeto(&conn, &p.id).unwrap();
        assert_eq!(p3.tarefas_total, 1);
        assert!(matches!(mudar_estado_tarefa(&conn, &cozinha.id, "loucura"), Err(Erro::Interno(_))));
    }

    #[test]
    fn datas_de_projeto_prazos_de_tarefa_e_lista_de_prazos() {
        let (_p, conn) = banco();
        let p = criar_projeto(&conn, "TCC", true).unwrap();
        mudar_estado_projeto(&conn, &p.id, "pausado", Some(OndeParei { texto: "x".into(), ..Default::default() })).unwrap();
        definir_datas_projeto(&conn, &p.id, Some("2026-10-01"), Some("2026-12-15")).unwrap();
        // Mudar as datas não apaga o "onde parei".
        let lido = obter_projeto(&conn, &p.id).unwrap();
        assert_eq!((lido.inicio.as_deref(), lido.prazo.as_deref()), (Some("2026-10-01"), Some("2026-12-15")));
        assert_eq!(lido.onde_parei.unwrap().texto, "x");
        assert!(definir_datas_projeto(&conn, &p.id, Some("2026-12-01"), Some("2026-11-01")).is_err());
        assert!(definir_datas_projeto(&conn, &p.id, Some("01/12/2026"), None).is_err());

        let etapa = criar_tarefa(&conn, &p.id, "Revisão").unwrap();
        let sub = criar_tarefa(&conn, &etapa.id, "Fichar").unwrap();
        definir_peso(&conn, &sub.id, Some("leve")).unwrap();
        definir_prazo_tarefa(&conn, &sub.id, Some("2026-11-03")).unwrap();
        let t = listar_tarefas(&conn, &p.id).unwrap().into_iter().find(|t| t.id == sub.id).unwrap();
        assert_eq!((t.prazo.as_deref(), t.peso.as_deref()), (Some("2026-11-03"), Some("leve")));

        let prazos = listar_prazos(&conn, "2026-11-01", "2026-12-31").unwrap();
        assert_eq!(prazos.iter().map(|x| (x.tipo.as_str(), x.titulo.as_str())).collect::<Vec<_>>(), vec![("tarefa", "Fichar"), ("projeto", "TCC")]);
        assert_eq!(prazos[0].projeto, "TCC");
        mudar_estado_tarefa(&conn, &sub.id, "feita").unwrap();
        assert_eq!(listar_prazos(&conn, "2026-11-01", "2026-12-31").unwrap().len(), 1);
    }

    #[test]
    fn notas_antigas_viram_ideias_na_migracao() {
        let pasta = tempfile::tempdir().unwrap();
        let caminho = pasta.path().join("orbita.db");
        let chave = nova_chave();
        {
            // Banco na versão 1, com uma nota de teste.
            crate::banco::preparar_sqlite();
            let conn = Connection::open(&caminho).unwrap();
            conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex::encode(chave.as_ref()))).unwrap();
            conn.execute_batch(crate::banco::MIGRACOES[0]).unwrap();
            conn.execute_batch("PRAGMA user_version = 1;").unwrap();
            conn.execute("INSERT INTO item (id, tipo, conteudo, criado_em, alterado_em) VALUES ('n1', 'nota', 'comprar café', 1, 1)", []).unwrap();
        }
        let conn = abrir(&caminho, &chave).unwrap();
        let ideias = listar_ideias(&conn).unwrap();
        assert_eq!(ideias.len(), 1);
        assert_eq!(ideias[0].texto, "comprar café");
    }
}
