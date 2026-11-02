//! Motor da sincronização entre aparelhos (ver `docs/decisoes/0012-sincronizacao.md`).
//!
//! Só banco e bytes, sem rede: o mesmo código roda no Windows e no navegador
//! (`crates/motor-web` inclui esta pasta por `#[path]`). Quem fala com o Drive é o
//! "maestro", em TypeScript (etapa 2b).
//!
//! - **Retrato**: todas as linhas das tabelas de dados (inclusive as excluídas),
//!   as configurações que viajam e o SHA-256 do conteúdo de cada anexo. JSON
//!   versionado, colunas pelo nome.
//! - **Juntar**: linha a linha, vale a versão mais recente (`alterado_em`). Todos os
//!   aparelhos decidem igual, em qualquer ordem, e juntar de novo não muda nada.
//! - **Tranca**: uma chave de sincronização aleatória (32 bytes) tranca tudo com
//!   XChaCha20-Poly1305; ela viaja num envelope aberto pela senha de sincronização
//!   (Argon2id, como os backups). No aparelho, fica na tabela `config` (que não viaja).

use std::collections::{BTreeMap, HashMap};

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use rusqlite::types::{Value as Sql, ValueRef};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

use super::{agora_ms, apagar_config, gravar_config, ler_config, novo_id};
use crate::cofre::cripto::{self, aleatorio, Chave, Envelope, ParametrosKdf};
use crate::erro::Erro;

/// Versão do formato do retrato que este código grava e entende.
pub const VERSAO_RETRATO: u32 = 1;

/// Tabelas que viajam, na ordem em que são juntadas: quem é apontado vem antes
/// de quem aponta (`etiquetagem` → `etiqueta`). `anexo_conteudo` não entra: o
/// conteúdo viaja à parte, pelo resumo (SHA-256).
pub const TABELAS: &[&str] = &["etiqueta", "item", "evento", "registro", "anexo", "etiquetagem", "ligacao"];

/// Configurações que viajam: as da pessoa, não as do aparelho. **Lista única**:
/// qualquer outra chave (conta da nuvem, backup automático, palavras de
/// recuperação, a própria chave de sincronização e o id do aparelho) nunca sai do aparelho.
///
/// A IA viaja a pedido de Dan (cadastrar a chave num aparelho e usar em todos):
/// `ia` (provedores, funções, modelos) e `ia_chave:<provedor>` (as chaves de API),
/// trancadas como todo o resto pela chave de sincronização.
pub const CONFIG_PREFIXOS_QUE_VIAJAM: &[&str] = &["valor:", "ia_chave:"];
pub const CONFIG_QUE_VIAJAM: &[&str] = &["limite_projetos_ativos", "media_aprovacao", "basicos_do_dia", "plano_de_crise", "ia"];

/// Onde ficam, na `config`, o id deste aparelho e a chave de sincronização (nunca viajam).
pub const CONFIG_APARELHO: &str = "sincronia_aparelho";
pub const CONFIG_CHAVE: &str = "sincronia_chave";

/// Tamanho mínimo da senha de sincronização (o mesmo da senha do cofre).
pub const MINIMO_SENHA: usize = 12;
/// Limite do retrato aberto (proteção contra arquivo malicioso que "explode" ao descomprimir).
const MAXIMO_ABERTO: usize = 512 * 1024 * 1024;

pub fn config_viaja(chave: &str) -> bool {
    CONFIG_QUE_VIAJAM.contains(&chave) || CONFIG_PREFIXOS_QUE_VIAJAM.iter().any(|p| chave.starts_with(p) && chave.len() > p.len())
}

// ── Aparelho e chave ────────────────────────────────────────────────────────────

/// O id deste aparelho (UUIDv7), criado na primeira vez. Nomeia o arquivo dele no Drive.
pub fn aparelho(conn: &Connection) -> Result<String, Erro> {
    if let Some(id) = ler_config(conn, CONFIG_APARELHO)? {
        return Ok(id);
    }
    let id = novo_id();
    gravar_config(conn, CONFIG_APARELHO, &id)?;
    Ok(id)
}

/// Depois de restaurar um backup: este banco pode estar em outro aparelho, então
/// ganha um id novo na próxima sincronização (dois aparelhos com o mesmo id
/// escreveriam no mesmo arquivo do Drive). A chave de sincronização fica.
pub fn esquecer_aparelho(conn: &Connection) -> Result<(), Erro> {
    apagar_config(conn, CONFIG_APARELHO)
}

fn chave_guardada(conn: &Connection) -> Result<Option<Chave>, Erro> {
    let Some(texto) = ler_config(conn, CONFIG_CHAVE)? else { return Ok(None) };
    let bytes = Zeroizing::new(hex::decode(texto.as_bytes()).map_err(|_| Erro::Interno("chave de sincronização danificada".into()))?);
    if bytes.len() != 32 {
        return Err(Erro::Interno("chave de sincronização danificada".into()));
    }
    let mut chave = Zeroizing::new([0u8; 32]);
    chave.copy_from_slice(&bytes);
    Ok(Some(chave))
}

fn exigir_chave(conn: &Connection) -> Result<Chave, Erro> {
    chave_guardada(conn)?.ok_or_else(|| Erro::Interno("a sincronização não está ligada neste aparelho".into()))
}

fn guardar_chave(conn: &Connection, chave: &Chave) -> Result<(), Erro> {
    gravar_config(conn, CONFIG_CHAVE, &Zeroizing::new(hex::encode(chave.as_ref())))
}

const ROTULO_ENVELOPE: &str = "orbita:sync:chave:v1";

/// O envelope da chave de sincronização, que fica no Drive. JSON.
#[derive(Debug, Serialize, Deserialize)]
pub struct EnvelopeSync {
    pub versao: u32,
    #[serde(flatten)]
    pub envelope: Envelope,
}

pub fn envelope_da_chave(chave: &Chave, senha: &str) -> Result<Vec<u8>, Erro> {
    if senha.trim().chars().count() < MINIMO_SENHA {
        return Err(Erro::SenhaCurta);
    }
    let kdf = ParametrosKdf::PADRAO;
    let sal = aleatorio::<16>();
    let tranca = cripto::derivar(senha.as_bytes(), sal.as_ref(), kdf, None)?;
    let envelope = cripto::trancar(chave, &tranca, ROTULO_ENVELOPE, Some(kdf), sal.to_vec())?;
    serde_json::to_vec(&EnvelopeSync { versao: 1, envelope }).map_err(|e| Erro::Interno(e.to_string()))
}

/// Abre o envelope com a senha. Senha errada: `Erro::SenhaErrada`.
pub fn abrir_envelope(bruto: &[u8], senha: &str) -> Result<Chave, Erro> {
    let env: EnvelopeSync = serde_json::from_slice(bruto).map_err(|_| Erro::Interno("o envelope da sincronização está danificado".into()))?;
    if env.versao != 1 {
        return Err(Erro::Interno("o envelope foi feito por uma versão mais nova do Órbita; atualize o Órbita".into()));
    }
    let kdf = env.envelope.kdf.ok_or_else(|| Erro::Interno("o envelope da sincronização está danificado".into()))?;
    let tranca = cripto::derivar(senha.as_bytes(), &env.envelope.sal, kdf, None)?;
    cripto::destrancar(&env.envelope, &tranca, ROTULO_ENVELOPE).ok_or(Erro::SenhaErrada)
}

// ── Tranca de bytes ─────────────────────────────────────────────────────────────

const MAGICA: &[u8; 8] = b"ORBITASY";
const VERSAO_PACOTE: u8 = 1;
const CRU: u8 = 0;
const DEFLATE: u8 = 1;
const ROTULO_RETRATO: &str = "orbita:sync:retrato";

fn rotulo_conteudo(sha: &str) -> String {
    format!("orbita:sync:anexo:{sha}")
}

/// `ORBITASY` + versão (1 byte) + formato (0 cru, 1 deflate) + nonce (24) + cifra.
/// O cabeçalho e o rótulo entram como dados associados: mexer neles ou trocar
/// um pacote por outro de outro tipo faz a abertura falhar.
pub fn trancar(dados: &[u8], chave: &Chave, rotulo: &str, comprimir: bool) -> Result<Vec<u8>, Erro> {
    let comprimido;
    let (formato, corpo) = if comprimir {
        comprimido = miniz_oxide::deflate::compress_to_vec(dados, 6);
        (DEFLATE, comprimido.as_slice())
    } else {
        (CRU, dados)
    };
    let mut cabeca = Vec::with_capacity(10);
    cabeca.extend_from_slice(MAGICA);
    cabeca.push(VERSAO_PACOTE);
    cabeca.push(formato);
    let nonce = aleatorio::<24>();
    let aad = [rotulo.as_bytes(), &cabeca].concat();
    let cifra = XChaCha20Poly1305::new(chave.as_ref().into())
        .encrypt(XNonce::from_slice(nonce.as_ref()), Payload { msg: corpo, aad: &aad })
        .map_err(|_| Erro::Interno("falha ao trancar".into()))?;
    let mut saida = Vec::with_capacity(cabeca.len() + 24 + cifra.len());
    saida.extend_from_slice(&cabeca);
    saida.extend_from_slice(nonce.as_ref());
    saida.extend_from_slice(&cifra);
    Ok(saida)
}

pub fn destrancar(bruto: &[u8], chave: &Chave, rotulo: &str) -> Result<Vec<u8>, Erro> {
    let invalido = || Erro::Interno("o pacote da sincronização não abriu (chave diferente ou arquivo danificado)".into());
    if bruto.len() < 34 || &bruto[..8] != MAGICA {
        return Err(invalido());
    }
    if bruto[8] > VERSAO_PACOTE {
        return Err(Erro::Interno("o pacote foi feito por uma versão mais nova do Órbita; atualize o Órbita".into()));
    }
    let formato = bruto[9];
    let aad = [rotulo.as_bytes(), &bruto[..10]].concat();
    let aberto = XChaCha20Poly1305::new(chave.as_ref().into())
        .decrypt(XNonce::from_slice(&bruto[10..34]), Payload { msg: &bruto[34..], aad: &aad })
        .map_err(|_| invalido())?;
    match formato {
        CRU => Ok(aberto),
        DEFLATE => miniz_oxide::inflate::decompress_to_vec_with_limit(&aberto, MAXIMO_ABERTO).map_err(|_| invalido()),
        _ => Err(invalido()),
    }
}

// ── Retrato ─────────────────────────────────────────────────────────────────────

/// Uma tabela: os nomes das colunas e as linhas na mesma ordem.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Tabela {
    pub colunas: Vec<String>,
    pub linhas: Vec<Vec<Value>>,
}

/// Uma configuração que viaja. `valor` nulo = foi apagada (lápide).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigLinha {
    pub chave: String,
    pub valor: Option<String>,
    pub alterado_em: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Retrato {
    pub versao: u32,
    /// Id do aparelho que montou.
    pub aparelho: String,
    pub criado_em: i64,
    #[serde(default)]
    pub tabelas: BTreeMap<String, Tabela>,
    #[serde(default)]
    pub config: Vec<ConfigLinha>,
    /// id do anexo → SHA-256 (hex) do conteúdo. Só o resumo, nunca o conteúdo.
    #[serde(default)]
    pub conteudos: BTreeMap<String, String>,
}

fn json_de(v: ValueRef<'_>) -> Result<Value, Erro> {
    Ok(match v {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => Value::from(i),
        ValueRef::Real(f) => serde_json::Number::from_f64(f).map(Value::Number).unwrap_or(Value::Null),
        ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(_) => return Err(Erro::Interno("coluna binária numa tabela que sincroniza".into())),
    })
}

fn sql_de(v: &Value) -> Sql {
    match v {
        Value::Null => Sql::Null,
        Value::Bool(b) => Sql::Integer(*b as i64),
        Value::Number(n) => match n.as_i64() {
            Some(i) => Sql::Integer(i),
            None => Sql::Real(n.as_f64().unwrap_or(0.0)),
        },
        Value::String(s) => Sql::Text(s.clone()),
        outro => Sql::Text(outro.to_string()),
    }
}

/// Colunas da tabela local: (nome, é REAL?).
fn colunas(conn: &Connection, tabela: &str) -> Result<Vec<(String, bool)>, Erro> {
    let mut c = conn.prepare(&format!("PRAGMA table_info({tabela})"))?;
    let lista = c
        .query_map([], |r| Ok((r.get::<_, String>(1)?, r.get::<_, String>(2)?.to_uppercase().contains("REAL"))))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(lista)
}

fn ler_tabela(conn: &Connection, tabela: &str) -> Result<Tabela, Erro> {
    let cols: Vec<String> = colunas(conn, tabela)?.into_iter().map(|(n, _)| n).collect();
    let mut c = conn.prepare(&format!("SELECT * FROM {tabela} ORDER BY id"))?;
    let mut linhas = Vec::new();
    let mut rs = c.query([])?;
    while let Some(r) = rs.next()? {
        let mut linha = Vec::with_capacity(cols.len());
        for i in 0..cols.len() {
            linha.push(json_de(r.get_ref(i)?)?);
        }
        linhas.push(linha);
    }
    Ok(Tabela { colunas: cols, linhas })
}

fn sha_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

/// Calcula (uma vez) o SHA-256 do conteúdo dos anexos que ainda não têm resumo.
/// O conteúdo de um anexo nunca muda depois de gravado, então o resumo vale para sempre.
fn atualizar_resumos(conn: &Connection) -> Result<(), Erro> {
    let ids: Vec<String> = conn
        .prepare(
            "SELECT c.anexo_id FROM anexo_conteudo c
             LEFT JOIN anexo_resumo r ON r.anexo_id = c.anexo_id
             WHERE r.anexo_id IS NULL",
        )?
        .query_map([], |r| r.get(0))?
        .collect::<Result<_, _>>()?;
    for id in ids {
        let conteudo: Vec<u8> = conn.query_row("SELECT conteudo FROM anexo_conteudo WHERE anexo_id = ?1", [&id], |r| r.get(0))?;
        conn.execute(
            "INSERT INTO anexo_resumo (anexo_id, sha256) VALUES (?1, ?2) ON CONFLICT (anexo_id) DO UPDATE SET sha256 = excluded.sha256",
            params![id, sha_hex(&conteudo)],
        )?;
    }
    Ok(())
}

fn config_que_viaja(conn: &Connection) -> Result<Vec<ConfigLinha>, Erro> {
    let mut lista: Vec<ConfigLinha> = conn
        .prepare("SELECT chave, valor, alterado_em FROM config ORDER BY chave")?
        .query_map([], |r| Ok(ConfigLinha { chave: r.get(0)?, valor: Some(r.get(1)?), alterado_em: r.get(2)? }))?
        .collect::<Result<Vec<_>, _>>()?;
    lista.retain(|c| config_viaja(&c.chave));
    let lapides: Vec<ConfigLinha> = conn
        .prepare("SELECT chave, excluido_em FROM config_excluida ORDER BY chave")?
        .query_map([], |r| Ok(ConfigLinha { chave: r.get(0)?, valor: None, alterado_em: r.get(1)? }))?
        .collect::<Result<Vec<_>, _>>()?;
    lista.extend(lapides.into_iter().filter(|c| config_viaja(&c.chave)));
    Ok(lista)
}

/// O retrato de tudo o que sincroniza neste banco.
pub fn montar_retrato(conn: &Connection) -> Result<Retrato, Erro> {
    let aparelho = aparelho(conn)?;
    atualizar_resumos(conn)?;
    let mut tabelas = BTreeMap::new();
    for t in TABELAS {
        tabelas.insert(t.to_string(), ler_tabela(conn, t)?);
    }
    let conteudos: BTreeMap<String, String> = conn
        .prepare(
            "SELECT r.anexo_id, r.sha256 FROM anexo_resumo r
             JOIN anexo_conteudo c ON c.anexo_id = r.anexo_id ORDER BY r.anexo_id",
        )?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<Result<_, _>>()?;
    Ok(Retrato { versao: VERSAO_RETRATO, aparelho, criado_em: agora_ms(), tabelas, config: config_que_viaja(conn)?, conteudos })
}

// ── Juntar ──────────────────────────────────────────────────────────────────────

/// O que a junção fez.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Resumo {
    /// Aparelho de onde veio o retrato.
    pub aparelho: String,
    /// Linhas novas aqui.
    pub entraram: u32,
    /// Linhas que já existiam e mudaram (a versão de lá era mais recente).
    pub mudaram: u32,
    /// Linhas que não deu para usar (sem id ou sem data, ou apontando para algo que não existe).
    pub ignoradas: u32,
    /// Configurações que entraram, mudaram ou foram apagadas.
    pub configuracoes: u32,
    /// SHA-256 dos conteúdos de anexo que faltam aqui (baixar com `sincronia_conteudo`).
    pub faltam_conteudos: Vec<String>,
}

/// Chave de ordem de uma versão de linha. Vence a maior:
/// 1. a versão mais recente: `max(alterado_em, excluido_em)`;
/// 2. empate: a excluída (apagar é a escolha mais segura);
/// 3. empate de novo: o conteúdo (texto JSON da linha), para todos decidirem igual
///    sem depender de quem mandou.
fn ordem(linha: &[Value], i_alt: usize, i_exc: Option<usize>) -> (i64, bool, String) {
    let alt = linha[i_alt].as_i64().unwrap_or(0);
    let exc = i_exc.and_then(|i| linha[i].as_i64());
    (alt.max(exc.unwrap_or(i64::MIN)), exc.is_some(), serde_json::to_string(linha).unwrap_or_default())
}

fn juntar_tabela(conn: &Connection, nome: &str, vinda: &Tabela, resumo: &mut Resumo) -> Result<(), Erro> {
    let locais = colunas(conn, nome)?;
    let pos = |c: &str| locais.iter().position(|(n, _)| n == c);
    let (Some(i_id), Some(i_alt)) = (pos("id"), pos("alterado_em")) else { return Ok(()) };
    let i_exc = pos("excluido_em");
    // Para cada coluna que veio: a posição dela aqui (coluna desconhecida = None, ignorada).
    let mapa: Vec<Option<usize>> = vinda.colunas.iter().map(|c| pos(c)).collect();
    let (Some(v_id), Some(v_alt)) = (vinda.colunas.iter().position(|c| c == "id"), vinda.colunas.iter().position(|c| c == "alterado_em")) else {
        resumo.ignoradas += vinda.linhas.len() as u32;
        return Ok(());
    };

    let atual = ler_tabela(conn, nome)?;
    let mut aqui: HashMap<String, Vec<Value>> = atual
        .linhas
        .into_iter()
        .filter_map(|l| {
            let id = l[i_id].as_str()?.to_string();
            Some((id, l))
        })
        .collect();

    for linha in &vinda.linhas {
        if linha.len() != vinda.colunas.len() || !linha[v_id].is_string() || linha[v_alt].as_i64().is_none() {
            resumo.ignoradas += 1;
            continue;
        }
        let id = linha[v_id].as_str().unwrap().to_string();
        // Valores normalizados para o tipo da coluna daqui (REAL fica sempre com ponto).
        let valores: Vec<(usize, Value)> = mapa
            .iter()
            .zip(linha)
            .filter_map(|(m, v)| m.map(|i| (i, v.clone())))
            .map(|(i, v)| {
                let v = match (&v, locais[i].1) {
                    (Value::Number(n), true) if n.is_i64() => serde_json::Number::from_f64(n.as_f64().unwrap()).map(Value::Number).unwrap_or(v),
                    _ => v,
                };
                (i, v)
            })
            .collect();

        match aqui.get(&id) {
            None => {
                // Linha nova. Coluna que não veio: o valor padrão da tabela.
                let nomes: Vec<&str> = valores.iter().map(|(i, _)| locais[*i].0.as_str()).collect();
                let marcas: Vec<String> = (1..=nomes.len()).map(|n| format!("?{n}")).collect();
                let sql = format!("INSERT INTO {nome} ({}) VALUES ({})", nomes.join(", "), marcas.join(", "));
                let args: Vec<Sql> = valores.iter().map(|(_, v)| sql_de(v)).collect();
                match conn.prepare_cached(&sql)?.execute(rusqlite::params_from_iter(args)) {
                    Ok(_) => {
                        resumo.entraram += 1;
                        // Guarda como ficou de verdade, para o caso de vir de novo no mesmo retrato.
                        if let Some(l) = ler_linha(conn, nome, &id, locais.len())? {
                            aqui.insert(id, l);
                        }
                    }
                    Err(_) => resumo.ignoradas += 1,
                }
            }
            Some(local) => {
                // Coluna que não veio: fica o valor daqui (não apaga o que um aparelho mais novo gravou).
                let mut candidata = local.clone();
                for (i, v) in &valores {
                    candidata[*i] = v.clone();
                }
                if candidata == *local || ordem(&candidata, i_alt, i_exc) <= ordem(local, i_alt, i_exc) {
                    continue;
                }
                let sets: Vec<String> = valores.iter().enumerate().map(|(n, (i, _))| format!("{} = ?{}", locais[*i].0, n + 2)).collect();
                let sql = format!("UPDATE {nome} SET {} WHERE id = ?1", sets.join(", "));
                let mut args: Vec<Sql> = vec![Sql::Text(id.clone())];
                args.extend(valores.iter().map(|(_, v)| sql_de(v)));
                match conn.prepare_cached(&sql)?.execute(rusqlite::params_from_iter(args)) {
                    Ok(_) => {
                        resumo.mudaram += 1;
                        aqui.insert(id, candidata);
                    }
                    Err(_) => resumo.ignoradas += 1,
                }
            }
        }
    }
    Ok(())
}

fn ler_linha(conn: &Connection, tabela: &str, id: &str, n: usize) -> Result<Option<Vec<Value>>, Erro> {
    let mut c = conn.prepare_cached(&format!("SELECT * FROM {tabela} WHERE id = ?1"))?;
    let mut rs = c.query([id])?;
    let Some(r) = rs.next()? else { return Ok(None) };
    let mut linha = Vec::with_capacity(n);
    for i in 0..n {
        linha.push(json_de(r.get_ref(i)?)?);
    }
    Ok(Some(linha))
}

/// Versão daqui de uma configuração que viaja (valor ou lápide).
fn config_local(conn: &Connection, chave: &str) -> Result<Option<ConfigLinha>, Erro> {
    let valor = conn
        .query_row("SELECT valor, alterado_em FROM config WHERE chave = ?1", [chave], |r| {
            Ok(ConfigLinha { chave: chave.to_string(), valor: Some(r.get(0)?), alterado_em: r.get(1)? })
        })
        .optional()?;
    if valor.is_some() {
        return Ok(valor);
    }
    Ok(conn
        .query_row("SELECT excluido_em FROM config_excluida WHERE chave = ?1", [chave], |r| {
            Ok(ConfigLinha { chave: chave.to_string(), valor: None, alterado_em: r.get(0)? })
        })
        .optional()?)
}

/// Mesma regra das linhas: mais recente; empate, a apagada; empate de novo, o maior texto.
fn ordem_config(c: &ConfigLinha) -> (i64, bool, &str) {
    (c.alterado_em, c.valor.is_none(), c.valor.as_deref().unwrap_or(""))
}

fn juntar_config(conn: &Connection, vindas: &[ConfigLinha], resumo: &mut Resumo) -> Result<(), Erro> {
    for vinda in vindas.iter().filter(|c| config_viaja(&c.chave)) {
        let local = config_local(conn, &vinda.chave)?;
        let vence = match &local {
            None => vinda.valor.is_some(),
            Some(l) => ordem_config(vinda) > ordem_config(l),
        };
        if !vence {
            continue;
        }
        match &vinda.valor {
            Some(v) => {
                conn.execute(
                    "INSERT INTO config (chave, valor, alterado_em) VALUES (?1, ?2, ?3)
                     ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, alterado_em = excluded.alterado_em",
                    params![vinda.chave, v, vinda.alterado_em],
                )?;
                conn.execute("DELETE FROM config_excluida WHERE chave = ?1", [&vinda.chave])?;
            }
            None => {
                conn.execute("DELETE FROM config WHERE chave = ?1", [&vinda.chave])?;
                conn.execute(
                    "INSERT INTO config_excluida (chave, excluido_em) VALUES (?1, ?2)
                     ON CONFLICT (chave) DO UPDATE SET excluido_em = excluded.excluido_em",
                    params![vinda.chave, vinda.alterado_em],
                )?;
            }
        }
        resumo.configuracoes += 1;
    }
    Ok(())
}

/// SHA-256 dos conteúdos que faltam: anexos vivos, sem conteúdo aqui, com resumo conhecido.
pub fn conteudos_que_faltam(conn: &Connection) -> Result<Vec<String>, Erro> {
    Ok(conn
        .prepare(
            "SELECT DISTINCT r.sha256 FROM anexo_resumo r
             JOIN anexo a ON a.id = r.anexo_id AND a.excluido_em IS NULL
             LEFT JOIN anexo_conteudo c ON c.anexo_id = r.anexo_id
             WHERE c.anexo_id IS NULL ORDER BY r.sha256",
        )?
        .query_map([], |r| r.get(0))?
        .collect::<Result<_, _>>()?)
}

fn sha_valido(sha: &str) -> bool {
    sha.len() == 64 && sha.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
}

/// Junta um retrato de outro aparelho neste banco, numa transação só (ou tudo, ou nada).
/// Nunca apaga linha de verdade; o conteúdo de anexo que passou a estar excluído
/// é apagado, como faz o "Excluir anexo" do próprio aparelho.
pub fn juntar(conn: &Connection, retrato: &Retrato) -> Result<Resumo, Erro> {
    if retrato.versao > VERSAO_RETRATO {
        return Err(Erro::Interno("os dados vieram de uma versão mais nova do Órbita; atualize o Órbita neste aparelho".into()));
    }
    let mut resumo = Resumo { aparelho: retrato.aparelho.clone(), ..Default::default() };
    let tx = conn.unchecked_transaction()?;
    for t in TABELAS {
        if let Some(tabela) = retrato.tabelas.get(*t) {
            juntar_tabela(&tx, t, tabela, &mut resumo)?;
        }
    }
    juntar_config(&tx, &retrato.config, &mut resumo)?;
    // Resumos dos conteúdos: anota o que esperar de cada anexo que ainda não tem conteúdo aqui.
    for (anexo_id, sha) in &retrato.conteudos {
        if !sha_valido(sha) {
            continue;
        }
        tx.execute(
            "INSERT INTO anexo_resumo (anexo_id, sha256) SELECT ?1, ?2
             WHERE NOT EXISTS (SELECT 1 FROM anexo_conteudo WHERE anexo_id = ?1)
             ON CONFLICT (anexo_id) DO UPDATE SET sha256 = excluded.sha256",
            params![anexo_id, sha],
        )?;
    }
    tx.execute(
        "DELETE FROM anexo_conteudo WHERE anexo_id IN (SELECT id FROM anexo WHERE excluido_em IS NOT NULL)",
        [],
    )?;
    resumo.faltam_conteudos = conteudos_que_faltam(&tx)?;
    tx.commit()?;
    Ok(resumo)
}

// ── Conteúdo dos anexos ─────────────────────────────────────────────────────────

/// O conteúdo de um anexo daqui pelo SHA-256, para mandar a quem falta.
pub fn conteudo_por_hash(conn: &Connection, sha: &str) -> Result<Option<Vec<u8>>, Erro> {
    if !sha_valido(sha) {
        return Ok(None);
    }
    atualizar_resumos(conn)?;
    Ok(conn
        .query_row(
            "SELECT c.conteudo FROM anexo_resumo r JOIN anexo_conteudo c ON c.anexo_id = r.anexo_id WHERE r.sha256 = ?1 LIMIT 1",
            [sha],
            |r| r.get(0),
        )
        .optional()?)
}

/// Guarda um conteúdo que veio de outro aparelho em todos os anexos que esperavam
/// por ele. Confere o SHA-256 antes. Devolve em quantos anexos guardou.
pub fn guardar_conteudo(conn: &Connection, sha: &str, bytes: &[u8]) -> Result<u32, Erro> {
    if !sha_valido(sha) || sha_hex(bytes) != sha {
        return Err(Erro::Interno("o conteúdo do anexo não confere com o resumo (SHA-256); não foi guardado".into()));
    }
    let tx = conn.unchecked_transaction()?;
    let n = tx.execute(
        "INSERT INTO anexo_conteudo (anexo_id, conteudo)
         SELECT r.anexo_id, ?2 FROM anexo_resumo r
         JOIN anexo a ON a.id = r.anexo_id AND a.excluido_em IS NULL
         WHERE r.sha256 = ?1 AND NOT EXISTS (SELECT 1 FROM anexo_conteudo c WHERE c.anexo_id = r.anexo_id)",
        params![sha, bytes],
    )?;
    tx.commit()?;
    Ok(n as u32)
}

// ── O que os comandos chamam (bytes em base64) ──────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Situacao {
    pub tem_chave: bool,
    pub aparelho: String,
}

fn b64(texto: &str) -> Result<Vec<u8>, Erro> {
    B64.decode(texto.trim()).map_err(|_| Erro::Interno("os dados da sincronização não estão em base64".into()))
}

pub fn situacao(conn: &Connection) -> Result<Situacao, Erro> {
    Ok(Situacao { tem_chave: chave_guardada(conn)?.is_some(), aparelho: aparelho(conn)? })
}

/// Cria a chave de sincronização (primeiro aparelho) e devolve o envelope (base64)
/// para guardar no Drive. Se já existe uma chave, não troca: devolve um envelope novo
/// da mesma chave com esta senha (trocar a chave deixaria os outros aparelhos de fora).
pub fn criar_chave(conn: &Connection, senha: &str) -> Result<String, Erro> {
    let chave = match chave_guardada(conn)? {
        Some(c) => c,
        None => cripto::nova_chave(),
    };
    let envelope = envelope_da_chave(&chave, senha)?;
    guardar_chave(conn, &chave)?;
    Ok(B64.encode(envelope))
}

/// Aparelho novo: abre o envelope com a senha e guarda a chave aqui.
pub fn entrar(conn: &Connection, envelope_b64: &str, senha: &str) -> Result<(), Erro> {
    let chave = abrir_envelope(&b64(envelope_b64)?, senha)?;
    guardar_chave(conn, &chave)
}

/// Desliga a sincronização neste aparelho (apaga a chave daqui; os dados ficam).
pub fn sair(conn: &Connection) -> Result<(), Erro> {
    apagar_config(conn, CONFIG_CHAVE)
}

/// O retrato deste aparelho, em JSON comprimido e trancado (base64).
pub fn meu_pacote(conn: &Connection) -> Result<String, Erro> {
    let chave = exigir_chave(conn)?;
    let json = serde_json::to_vec(&montar_retrato(conn)?).map_err(|e| Erro::Interno(e.to_string()))?;
    Ok(B64.encode(trancar(&json, &chave, ROTULO_RETRATO, true)?))
}

/// Retrato do estado daqui, sem trancar, para o maestro decidir o que mandar.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Marca {
    /// SHA-256 do retrato (sem a hora de montagem): muda se, e só se, algo que viaja mudou aqui.
    pub marca: String,
    /// SHA-256 dos conteúdos de anexo que este aparelho tem (para enviar os que faltam no Drive).
    pub conteudos: Vec<String>,
    /// SHA-256 dos conteúdos de anexo que faltam aqui (para buscar no Drive).
    pub faltam: Vec<String>,
}

/// A marca do estado daqui. O retrato é montado na mesma ordem sempre (tabelas por id,
/// configurações por chave), então o mesmo banco dá sempre a mesma marca.
pub fn marca(conn: &Connection) -> Result<Marca, Erro> {
    let mut retrato = montar_retrato(conn)?;
    retrato.criado_em = 0;
    let json = serde_json::to_vec(&retrato).map_err(|e| Erro::Interno(e.to_string()))?;
    let mut conteudos: Vec<String> = retrato.conteudos.into_values().collect();
    conteudos.sort();
    conteudos.dedup();
    Ok(Marca { marca: sha_hex(&json), conteudos, faltam: conteudos_que_faltam(conn)? })
}

/// Abre o pacote de outro aparelho e junta aqui. Chave errada: erro, e nada muda.
pub fn juntar_pacote(conn: &Connection, pacote_b64: &str) -> Result<Resumo, Erro> {
    let chave = exigir_chave(conn)?;
    let json = destrancar(&b64(pacote_b64)?, &chave, ROTULO_RETRATO)?;
    let retrato: Retrato = serde_json::from_slice(&json).map_err(|_| Erro::Interno("o retrato da sincronização está danificado".into()))?;
    juntar(conn, &retrato)
}

/// O conteúdo de um anexo, trancado (base64), ou nada se não existe aqui.
pub fn conteudo_trancado(conn: &Connection, sha: &str) -> Result<Option<String>, Erro> {
    let chave = exigir_chave(conn)?;
    match conteudo_por_hash(conn, sha)? {
        Some(bytes) => Ok(Some(B64.encode(trancar(&bytes, &chave, &rotulo_conteudo(sha), false)?))),
        None => Ok(None),
    }
}

/// Guarda um conteúdo trancado (base64) que veio de outro aparelho.
pub fn guardar_conteudo_trancado(conn: &Connection, sha: &str, trancado_b64: &str) -> Result<u32, Erro> {
    let chave = exigir_chave(conn)?;
    let bytes = destrancar(&b64(trancado_b64)?, &chave, &rotulo_conteudo(sha))?;
    guardar_conteudo(conn, sha, &bytes)
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::banco::testes::banco_de_teste;
    use crate::banco::{anexos, energia, etiquetas, itens, valores};
    use crate::cofre::cripto::nova_chave;

    /// Tudo o que sincroniza, como texto, para comparar dois bancos.
    fn estado(conn: &Connection) -> String {
        let mut saida = String::new();
        for t in TABELAS {
            saida.push_str(&serde_json::to_string(&ler_tabela(conn, t).unwrap()).unwrap());
            saida.push('\n');
        }
        saida.push_str(&serde_json::to_string(&config_que_viaja(conn).unwrap()).unwrap());
        saida
    }

    fn trocar(a: &Connection, b: &Connection) -> (Resumo, Resumo) {
        let ra = montar_retrato(a).unwrap();
        let rb = montar_retrato(b).unwrap();
        (juntar(b, &ra).unwrap(), juntar(a, &rb).unwrap())
    }

    fn dados_a(conn: &Connection) {
        let ideia = itens::criar_ideia(conn, "farol na praia").unwrap();
        let p = itens::criar_projeto(conn, "Mudar de casa", true).unwrap();
        itens::criar_tarefa(conn, &p.id, "caixas").unwrap();
        let e = etiquetas::criar(conn, "casa", "musgo").unwrap();
        etiquetas::definir_do_item(conn, &ideia.id, &[e.id]).unwrap();
        energia::registrar(conn, 3, "ok").unwrap();
        valores::gravar(conn, "foco.salvos", r#"[{"id":"a"}]"#).unwrap();
    }

    fn dados_b(conn: &Connection) {
        let i = itens::criar_ideia(conn, "livro de receitas").unwrap();
        let j = itens::criar_ideia(conn, "aula de violão").unwrap();
        etiquetas::ligar(conn, &i.id, &j.id, true).unwrap();
        itens::excluir(conn, &j.id).unwrap();
        itens::definir_limite(conn, 2).unwrap();
    }

    #[test]
    fn dois_bancos_convergem_em_qualquer_ordem_e_repetir_nao_muda() {
        let (_pa, a) = banco_de_teste();
        let (_pb, b) = banco_de_teste();
        dados_a(&a);
        dados_b(&b);
        let ra = montar_retrato(&a).unwrap();
        let rb = montar_retrato(&b).unwrap();

        // Ordem A depois B, e B depois A, num terceiro e num quarto banco.
        let (_pc, c) = banco_de_teste();
        let (_pd, d) = banco_de_teste();
        juntar(&c, &ra).unwrap();
        juntar(&c, &rb).unwrap();
        juntar(&d, &rb).unwrap();
        juntar(&d, &ra).unwrap();

        let (r1, r2) = trocar(&a, &b);
        assert!(r1.entraram > 0 && r2.entraram > 0);
        assert_eq!(r1.ignoradas + r2.ignoradas, 0);
        assert_eq!(estado(&a), estado(&b));
        assert_eq!(estado(&a), estado(&c));
        assert_eq!(estado(&a), estado(&d));
        // As telas veem os dados do outro.
        assert_eq!(itens::listar_ideias(&b).unwrap().len(), 2);
        assert_eq!(itens::limite(&a).unwrap(), 2);
        assert_eq!(valores::ler(&b, "foco.salvos").unwrap().as_deref(), Some(r#"[{"id":"a"}]"#));

        // Juntar de novo não muda nada.
        let antes = estado(&a);
        let (r1, r2) = trocar(&a, &b);
        assert_eq!((r1.entraram, r1.mudaram, r2.entraram, r2.mudaram, r1.configuracoes, r2.configuracoes), (0, 0, 0, 0, 0, 0));
        assert_eq!(estado(&a), antes);
        assert_eq!(estado(&b), antes);
    }

    fn editar_em(conn: &Connection, id: &str, titulo: &str, quando: i64) {
        conn.execute("UPDATE item SET titulo = ?2, alterado_em = ?3 WHERE id = ?1", params![id, titulo, quando]).unwrap();
    }
    fn titulo(conn: &Connection, id: &str) -> String {
        conn.query_row("SELECT titulo FROM item WHERE id = ?1", [id], |r| r.get(0)).unwrap()
    }

    #[test]
    fn conflito_vale_o_mais_recente_e_empate_decide_igual_nos_dois() {
        let (_pa, a) = banco_de_teste();
        let (_pb, b) = banco_de_teste();
        let ideia = itens::criar_ideia(&a, "original").unwrap();
        trocar(&a, &b);

        editar_em(&a, &ideia.id, "do A", 1_000);
        editar_em(&b, &ideia.id, "do B", 2_000);
        let (ra, rb) = trocar(&a, &b);
        assert_eq!((ra.mudaram, rb.mudaram), (0, 1));
        assert_eq!(titulo(&a, &ideia.id), "do B");
        assert_eq!(estado(&a), estado(&b));

        // Empate exato: os dois escolhem a mesma versão (pelo conteúdo, não por quem mandou).
        editar_em(&a, &ideia.id, "empate A", 3_000);
        editar_em(&b, &ideia.id, "empate B", 3_000);
        trocar(&a, &b);
        assert_eq!(titulo(&a, &ideia.id), titulo(&b, &ideia.id));
        assert_eq!(estado(&a), estado(&b));
    }

    #[test]
    fn apagado_continua_apagado_e_edicao_posterior_traz_de_volta() {
        let (_pa, a) = banco_de_teste();
        let (_pb, b) = banco_de_teste();
        let ideia = itens::criar_ideia(&a, "rascunho").unwrap();
        trocar(&a, &b);

        // B editou antes de A apagar: fica apagado nos dois.
        editar_em(&b, &ideia.id, "editado antes", 1_000);
        a.execute("UPDATE item SET excluido_em = 2000, alterado_em = 2000 WHERE id = ?1", [&ideia.id]).unwrap();
        trocar(&a, &b);
        assert!(itens::listar_ideias(&a).unwrap().is_empty());
        assert!(itens::listar_ideias(&b).unwrap().is_empty());
        assert_eq!(estado(&a), estado(&b));

        // Apagar e editar no mesmo milissegundo: vence o apagar.
        let outra = itens::criar_ideia(&a, "outra").unwrap();
        trocar(&a, &b);
        a.execute("UPDATE item SET excluido_em = 5000, alterado_em = 5000 WHERE id = ?1", [&outra.id]).unwrap();
        editar_em(&b, &outra.id, "mesma hora", 5_000);
        trocar(&a, &b);
        assert!(itens::listar_ideias(&b).unwrap().is_empty());

        // B editou DEPOIS do apagar (sem saber): vale o mais recente, a ideia volta com a edição.
        b.execute("UPDATE item SET excluido_em = NULL, titulo = 'editado depois', alterado_em = 9000 WHERE id = ?1", [&ideia.id]).unwrap();
        trocar(&a, &b);
        assert_eq!(itens::listar_ideias(&a).unwrap().len(), 1);
        assert_eq!(titulo(&a, &ideia.id), "editado depois");
        assert_eq!(estado(&a), estado(&b));
    }

    #[test]
    fn so_viajam_as_configuracoes_da_pessoa_e_apagar_viaja() {
        let (_pa, a) = banco_de_teste();
        let (_pb, b) = banco_de_teste();
        valores::gravar(&a, "rotinas.personalizacao", "{}").unwrap();
        itens::definir_limite(&a, 4).unwrap();
        energia::definir_basicos(&a, vec!["água".into()]).unwrap();
        gravar_config(&a, "ia", r#"{"provedores":[]}"#).unwrap();
        gravar_config(&a, "ia_chave:claude", "sk-segredo").unwrap();
        for interna in ["nuvem", "backup_auto_pasta", "backup_auto_ultimo", "palavras_recuperacao", "algo_novo"] {
            gravar_config(&a, interna, "fica").unwrap();
        }
        criar_chave(&a, "senha de sincronia longa").unwrap();
        let id_a = aparelho(&a).unwrap();

        let r = montar_retrato(&a).unwrap();
        let chaves: Vec<&str> = r.config.iter().map(|c| c.chave.as_str()).collect();
        assert_eq!(chaves, ["basicos_do_dia", "ia", "ia_chave:claude", "limite_projetos_ativos", "valor:rotinas.personalizacao"]);
        juntar(&b, &r).unwrap();
        assert_eq!(itens::limite(&b).unwrap(), 4);
        assert_eq!(ler_config(&b, "ia_chave:claude").unwrap().as_deref(), Some("sk-segredo"));
        for interna in ["nuvem", "backup_auto_pasta", "backup_auto_ultimo", "palavras_recuperacao", "algo_novo", CONFIG_CHAVE] {
            assert_eq!(ler_config(&b, interna).unwrap(), None, "{interna} não devia viajar");
        }
        assert_ne!(aparelho(&b).unwrap(), id_a);

        // Um retrato malicioso não consegue gravar chave interna.
        let mut falso = r.clone();
        falso.config.push(ConfigLinha { chave: "nuvem".into(), valor: Some("invasão".into()), alterado_em: i64::MAX });
        juntar(&b, &falso).unwrap();
        assert_eq!(ler_config(&b, "nuvem").unwrap(), None);

        // Apagar viaja (lápide), e gravar de novo depois vence a lápide.
        valores::apagar(&a, "rotinas.personalizacao").unwrap();
        trocar(&a, &b);
        assert_eq!(valores::ler(&b, "rotinas.personalizacao").unwrap(), None);
        b.execute("UPDATE config_excluida SET excluido_em = 1", []).unwrap();
        valores::gravar(&b, "rotinas.personalizacao", r#"{"v":2}"#).unwrap();
        trocar(&a, &b);
        assert_eq!(valores::ler(&a, "rotinas.personalizacao").unwrap().as_deref(), Some(r#"{"v":2}"#));
        assert_eq!(estado(&a), estado(&b));
    }

    #[test]
    fn lista_de_configuracoes_que_viajam_fica_num_lugar_so() {
        use crate::banco::{academico, saude};
        for c in [itens::CONFIG_LIMITE, academico::CONFIG_MEDIA, energia::CONFIG_BASICOS, saude::CONFIG_PLANO, crate::ia::CONFIG_IA] {
            assert!(config_viaja(c), "{c}");
        }
        assert!(config_viaja(&format!("{}foco", valores::PREFIXO)));
        assert!(config_viaja(&format!("{}claude", crate::ia::PREFIXO_CHAVE)));
        for c in [crate::portatil::CONFIG_PALAVRAS, "nuvem", "backup_auto_pasta", "backup_auto_ultimo", "backup_auto_erro", CONFIG_APARELHO, CONFIG_CHAVE, "valor:", "iaa"] {
            assert!(!config_viaja(c), "{c}");
        }
    }

    #[test]
    fn marca_so_muda_quando_algo_que_viaja_muda() {
        let (_d, a) = banco_de_teste();
        let m1 = marca(&a).unwrap();
        assert_eq!(m1.marca, marca(&a).unwrap().marca, "o mesmo banco dá a mesma marca");
        dados_a(&a);
        let m2 = marca(&a).unwrap();
        assert_ne!(m1.marca, m2.marca, "dado novo muda a marca");
        assert_eq!(m2.marca, marca(&a).unwrap().marca);
        // Configuração que não viaja (do aparelho) não muda a marca.
        crate::banco::gravar_config(&a, "backup_auto_pasta", "x").unwrap();
        assert_eq!(m2.marca, marca(&a).unwrap().marca);
    }

    #[test]
    fn anexo_viaja_pelo_resumo_e_conteudo_errado_e_recusado() {
        let (_pa, a) = banco_de_teste();
        let (_pb, b) = banco_de_teste();
        let ideia = itens::criar_ideia(&a, "capa").unwrap();
        let conteudo = b"conteudo-da-imagem-PNG-unico-0123456789".to_vec();
        let anexo = anexos::anexar_arquivo(&a, &ideia.id, "capa.png", &conteudo).unwrap();
        let sha = sha_hex(&conteudo);

        let r = montar_retrato(&a).unwrap();
        assert_eq!(r.conteudos.get(&anexo.id), Some(&sha));
        let json = serde_json::to_string(&r).unwrap();
        assert!(!json.contains("conteudo-da-imagem"));

        let resumo = juntar(&b, &r).unwrap();
        assert_eq!(resumo.faltam_conteudos, vec![sha.clone()]);
        assert!(anexos::conteudo(&b, &anexo.id).is_err());

        assert!(guardar_conteudo(&b, &sha, b"outra coisa").is_err());
        assert_eq!(conteudo_por_hash(&a, &sha).unwrap(), Some(conteudo.clone()));
        assert_eq!(guardar_conteudo(&b, &sha, &conteudo).unwrap(), 1);
        assert_eq!(anexos::conteudo(&b, &anexo.id).unwrap(), conteudo);
        assert!(juntar(&b, &r).unwrap().faltam_conteudos.is_empty());
        assert_eq!(estado(&a), estado(&b));
        assert_eq!(montar_retrato(&b).unwrap().conteudos, r.conteudos);

        // Excluído num lado: o conteúdo some do outro também.
        anexos::excluir(&a, &anexo.id).unwrap();
        trocar(&a, &b);
        assert!(anexos::conteudo(&b, &anexo.id).is_err());
        assert!(conteudos_que_faltam(&b).unwrap().is_empty());
    }

    #[test]
    fn tranca_chave_e_senha_erradas_nao_abrem_e_nao_estragam() {
        let (_pa, a) = banco_de_teste();
        let (_pb, b) = banco_de_teste();
        let (_pc, c) = banco_de_teste();
        assert!(matches!(criar_chave(&a, "curta"), Err(Erro::SenhaCurta)));
        let envelope = criar_chave(&a, "gato azul na janela").unwrap();
        // Criar de novo não troca a chave (só faz outro envelope da mesma).
        let envelope2 = criar_chave(&a, "outra senha bem comprida").unwrap();
        assert!(matches!(entrar(&b, &envelope, "senha errada errada"), Err(Erro::SenhaErrada)));
        assert!(!situacao(&b).unwrap().tem_chave);
        entrar(&b, &envelope2, "outra senha bem comprida").unwrap();
        assert!(situacao(&b).unwrap().tem_chave);
        assert!(meu_pacote(&c).is_err(), "sem chave não há pacote");
        criar_chave(&c, "um terceiro aparelho com outra chave").unwrap();

        dados_a(&a);
        let pacote = meu_pacote(&a).unwrap();
        assert!(!String::from_utf8_lossy(&B64.decode(&pacote).unwrap()).contains("farol"));
        let antes = estado(&c);
        assert!(juntar_pacote(&c, &pacote).is_err());
        assert_eq!(estado(&c), antes);
        // Pacote mexido também não abre.
        let mut bruto = B64.decode(&pacote).unwrap();
        let ultimo = bruto.len() - 1;
        bruto[ultimo] ^= 1;
        assert!(juntar_pacote(&b, &B64.encode(&bruto)).is_err());

        let resumo = juntar_pacote(&b, &pacote).unwrap();
        assert!(resumo.entraram > 0);
        assert_eq!(estado(&a), estado(&b));

        // Conteúdo de anexo trancado: o rótulo prende ao SHA.
        let ideia = itens::criar_ideia(&a, "foto").unwrap();
        let bytes = vec![7u8; 5000];
        anexos::anexar_arquivo(&a, &ideia.id, "f.jpg", &bytes).unwrap();
        let sha = sha_hex(&bytes);
        juntar_pacote(&b, &meu_pacote(&a).unwrap()).unwrap();
        let t = conteudo_trancado(&a, &sha).unwrap().unwrap();
        assert!(guardar_conteudo_trancado(&b, &"0".repeat(64), &t).is_err());
        assert_eq!(guardar_conteudo_trancado(&b, &sha, &t).unwrap(), 1);
        assert_eq!(conteudo_trancado(&a, &"f".repeat(64)).unwrap(), None);

        sair(&b).unwrap();
        assert!(!situacao(&b).unwrap().tem_chave);
    }

    #[test]
    fn retrato_aguenta_coluna_desconhecida_e_coluna_que_falta() {
        let (_pa, a) = banco_de_teste();
        let (_pb, b) = banco_de_teste();
        let ideia = itens::criar_ideia(&a, "futuro").unwrap();
        trocar(&a, &b);
        let mut r = montar_retrato(&a).unwrap();
        let t = r.tabelas.get_mut("item").unwrap();
        // Uma versão mais nova mandou uma coluna que não existe aqui e não mandou `conteudo`.
        let i_cont = t.colunas.iter().position(|c| c == "conteudo").unwrap();
        let i_tit = t.colunas.iter().position(|c| c == "titulo").unwrap();
        let i_alt = t.colunas.iter().position(|c| c == "alterado_em").unwrap();
        b.execute("UPDATE item SET conteudo = 'guardado aqui' WHERE id = ?1", [&ideia.id]).unwrap();
        t.colunas.remove(i_cont);
        t.colunas.push("coluna_do_futuro".into());
        for l in &mut t.linhas {
            l[i_tit] = Value::from("título novo");
            l[i_alt] = Value::from(i64::MAX / 2);
            l.remove(i_cont);
            l.push(Value::from("?"));
        }
        let novo = novo_id();
        t.linhas.push({
            let mut l = t.linhas[0].clone();
            let i_id = t.colunas.iter().position(|c| c == "id").unwrap();
            l[i_id] = Value::from(novo.clone());
            l
        });
        let resumo = juntar(&b, &r).unwrap();
        assert_eq!((resumo.entraram, resumo.mudaram, resumo.ignoradas), (1, 1, 0));
        assert_eq!(titulo(&b, &ideia.id), "título novo");
        let cont: String = b.query_row("SELECT conteudo FROM item WHERE id = ?1", [&ideia.id], |r| r.get(0)).unwrap();
        assert_eq!(cont, "guardado aqui");
        let cont_novo: String = b.query_row("SELECT conteudo FROM item WHERE id = ?1", [&novo], |r| r.get(0)).unwrap();
        assert_eq!(cont_novo, "", "coluna que falta numa linha nova: valor padrão");
        // Versão mais nova do formato: recusa sem mexer.
        r.versao = VERSAO_RETRATO + 1;
        assert!(juntar(&b, &r).is_err());
    }

    #[test]
    fn banco_da_versao_anterior_migra() {
        let pasta = tempfile::tempdir().unwrap();
        let caminho = pasta.path().join("orbita.db");
        let chave = nova_chave();
        {
            crate::banco::preparar_sqlite();
            let conn = Connection::open(&caminho).unwrap();
            conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex::encode(chave.as_ref()))).unwrap();
            for sql in &crate::banco::MIGRACOES[..3] {
                conn.execute_batch(sql).unwrap();
            }
            conn.pragma_update(None, "user_version", 3).unwrap();
            conn.execute("INSERT INTO config (chave, valor) VALUES ('limite_projetos_ativos', '5')", []).unwrap();
            conn.execute("INSERT INTO etiqueta (id, nome, criado_em, alterado_em, excluido_em) VALUES ('e1', 'x', 1, 1, 50)", []).unwrap();
        }
        let conn = crate::banco::abrir(&caminho, &chave).unwrap();
        let versao: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(versao as usize, crate::banco::MIGRACOES.len());
        assert_eq!(itens::limite(&conn).unwrap(), 5);
        let alt: i64 = conn.query_row("SELECT alterado_em FROM config WHERE chave = 'limite_projetos_ativos'", [], |r| r.get(0)).unwrap();
        assert_eq!(alt, 0);
        let alt: i64 = conn.query_row("SELECT alterado_em FROM etiqueta WHERE id = 'e1'", [], |r| r.get(0)).unwrap();
        assert_eq!(alt, 50);
        // Gravar o mesmo valor não mexe na data; gravar outro, mexe.
        itens::definir_limite(&conn, 5).unwrap();
        let alt: i64 = conn.query_row("SELECT alterado_em FROM config WHERE chave = 'limite_projetos_ativos'", [], |r| r.get(0)).unwrap();
        assert_eq!(alt, 0);
        itens::definir_limite(&conn, 3).unwrap();
        let alt: i64 = conn.query_row("SELECT alterado_em FROM config WHERE chave = 'limite_projetos_ativos'", [], |r| r.get(0)).unwrap();
        assert!(alt > 0);
        assert!(montar_retrato(&conn).is_ok());
    }

    /// Medição: `cargo test --release medir_retrato -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn medir_retrato_de_um_banco_medio() {
        let (_pa, a) = banco_de_teste();
        let (_pb, b) = banco_de_teste();
        let texto = "Uma ideia com um texto de tamanho comum, acentuação e tudo o mais. ".repeat(3);
        let tx = a.unchecked_transaction().unwrap();
        for i in 0..2000 {
            itens::criar_ideia(&tx, &format!("{i} {texto}")).unwrap();
        }
        for i in 0..100 {
            let p = itens::criar_projeto(&tx, &format!("Projeto {i}"), false).unwrap();
            for j in 0..10 {
                itens::criar_tarefa(&tx, &p.id, &format!("tarefa {j} do projeto {i}")).unwrap();
            }
        }
        for _ in 0..2000 {
            energia::registrar(&tx, 3, "dia normal, dormi bem").unwrap();
        }
        tx.commit().unwrap();
        let chave = nova_chave();
        let t0 = std::time::Instant::now();
        let r = montar_retrato(&a).unwrap();
        let json = serde_json::to_vec(&r).unwrap();
        let t1 = t0.elapsed();
        let pacote = trancar(&json, &chave, ROTULO_RETRATO, true).unwrap();
        let t2 = t0.elapsed();
        let aberto = destrancar(&pacote, &chave, ROTULO_RETRATO).unwrap();
        let r2: Retrato = serde_json::from_slice(&aberto).unwrap();
        let t3 = std::time::Instant::now();
        let resumo = juntar(&b, &r2).unwrap();
        let t4 = t3.elapsed();
        let t5 = std::time::Instant::now();
        juntar(&b, &r2).unwrap();
        let t6 = t5.elapsed();
        let linhas: usize = r.tabelas.values().map(|t| t.linhas.len()).sum();
        println!(
            "linhas: {linhas} · JSON: {} KB · comprimido+trancado: {} KB · montar: {t1:?} · comprimir+trancar: {:?} · juntar (banco vazio): {t4:?} · juntar de novo: {t6:?} · entraram {}",
            json.len() / 1024,
            pacote.len() / 1024,
            t2 - t1,
            resumo.entraram
        );
    }
}
