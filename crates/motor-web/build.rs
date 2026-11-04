//! Gera a ponte do navegador a partir dos comandos do Windows
//! (`apps/desktop/src-tauri/src/comandos.rs`).
//!
//! Cada comando que só lê e grava no banco (`estado.com_sessao(|s| ...)`) vira,
//! aqui, uma função com o mesmo nome e os mesmos argumentos, chamada pelo
//! navegador. Assim a lógica existe uma vez só, no Rust, e a ponte nunca fica
//! desatualizada: muda o comando no Windows, muda a ponte na próxima compilação.
//! Os comandos que dependem do sistema (cofre, backup, rede, ditado, nuvem,
//! arquivos) ficam de fora e têm versão própria no navegador. As ordens de IA
//! que vão à internet passam por `ia_avancar` (lib.rs); as que só mexem nos
//! provedores guardados no banco entram aqui como as outras.

use std::{env, fs, path::Path};

const COMANDOS: &str = "../../apps/desktop/src-tauri/src/comandos.rs";

/// Palavras que indicam dependência do sistema: o comando fica de fora.
const PROIBIDO: &[&str] = &[
    ".await", "std::fs", "s.chave", "cofre", "backup::", "cliente::", "memoria_gb", "ditado", "nuvem", "tauri::", "janela", "app.",
    "PathBuf", "estado.cofre", "estado.recuperando", "estado.sessao", "estado.iniciar_sessao",
];

fn main() {
    println!("cargo:rerun-if-changed={COMANDOS}");
    println!("cargo:rerun-if-changed=build.rs");
    let fonte = fs::read_to_string(COMANDOS).expect("não achei comandos.rs");
    let usos: String = fonte
        .lines()
        // `use crate::ia::cliente` fica de fora: o envio pela rede não existe no navegador.
        .filter(|l| l.starts_with("use crate::banco") || l.starts_with("use crate::erro") || l.starts_with("use serde") || (l.starts_with("use crate::ia") && !l.contains("cliente")))
        .map(|l| format!("#[allow(unused_imports)] {l}\n"))
        .collect();

    // Peças definidas só no comandos.rs (tipos, constantes, funções auxiliares):
    // comando que usa alguma delas fica de fora.
    let locais: Vec<String> = regex::Regex::new(r"(?m)^(?:pub(?:\(crate\))? )?(?:struct|enum|const|static|type|fn) (\w+)")
        .unwrap()
        .captures_iter(&fonte)
        .map(|c| c[1].to_string())
        // Estado e Sessao são imitados pela ponte (`Ponte` e `Sessao` em lib.rs).
        .filter(|n| n != "Estado" && n != "Sessao")
        .collect();
    let cabeca = regex::Regex::new(r"(?s)#\[tauri::command\]\s*pub (?:async )?fn (\w+)\((.*?)\)\s*->\s*Result<(.*?), Erro>\s*\{").unwrap();
    let mut funcoes = String::new();
    let mut ramos = String::new();
    let mut nomes = Vec::new();
    let mut fora = Vec::new();

    for c in cabeca.captures_iter(&fonte) {
        let nome = &c[1];
        let params = &c[2];
        let ret = c[3].trim();
        // Corpo: do fim da assinatura até o "}" na coluna zero.
        let inicio = c.get(0).unwrap().end();
        let fim = inicio + fonte[inicio..].find("\n}").expect("corpo sem fim");
        let corpo = &fonte[inicio..fim];
        let sem_comentarios: String = corpo.lines().filter(|l| !l.trim_start().starts_with("//")).collect::<Vec<_>>().join("\n");

        let mut campos = Vec::new();
        let mut ok = sem_comentarios.contains("estado.com_sessao(");
        for p in dividir(params).iter().map(|p| p.trim()).filter(|p| !p.is_empty()) {
            let (n, t) = p.split_once(':').expect("parâmetro sem tipo");
            let (n, t) = (n.trim().trim_start_matches("mut ").trim(), t.trim());
            if t.starts_with("State<") {
                if n != "estado" { ok = false; }
                continue;
            }
            if n.starts_with('_') || t.contains("Window") || t.contains("AppHandle") { ok = false; }
            campos.push((n.to_string(), t.to_string()));
        }
        // Comparação pela palavra inteira ("energia::" não é "ia::").
        let proibido = |p: &str| {
            let inicio = if p.starts_with(|c: char| c.is_alphanumeric() || c == '_') { r"\b" } else { "" };
            regex::Regex::new(&format!("{inicio}{}", regex::escape(p))).unwrap().is_match(&sem_comentarios)
        };
        if PROIBIDO.iter().any(|p| proibido(p)) { ok = false; }
        let usa = |nome_local: &str| {
            let r = regex::Regex::new(&format!(r"\b{nome_local}\b")).unwrap();
            r.is_match(&sem_comentarios) || r.is_match(ret) || campos.iter().any(|(_, t)| r.is_match(t))
        };
        if locais.iter().filter(|l| l.as_str() != nome).any(|l| usa(l)) { ok = false; }
        if !ok { fora.push(nome.to_string()); continue; }

        let decl: String = campos.iter().map(|(n, t)| format!("{n}: {t}, ")).collect();
        let nomes_campos: String = campos.iter().map(|(n, _)| format!("{n}, ")).collect();
        funcoes.push_str(&format!(
            "#[allow(unused_variables, clippy::all)]\nfn {nome}(s: &Sessao, args: &str) -> Result<serde_json::Value, Erro> {{\n    #[derive(serde::Deserialize)]\n    #[serde(rename_all = \"camelCase\")]\n    struct A {{ {decl} }}\n    let A {{ {nomes_campos} }} = serde_json::from_str(args).map_err(|e| Erro::Interno(format!(\"argumentos de {nome}: {{e}}\")))?;\n    let estado = Ponte(s);\n    let r: Result<{ret}, Erro> = (move || {{{corpo}\n    }})();\n    serde_json::to_value(r?).map_err(|e| Erro::Interno(e.to_string()))\n}}\n\n"
        ));
        ramos.push_str(&format!("        \"{nome}\" => {nome}(s, args),\n"));
        nomes.push(nome.to_string());
    }

    let nomes_lista: String = nomes.iter().map(|n| format!("\"{n}\", ")).collect();
    let fora_lista: String = fora.iter().map(|n| format!("\"{n}\", ")).collect();
    let saida = format!(
        "// GERADO por build.rs a partir de comandos.rs. Não edite à mão.\n{usos}\n{funcoes}\n/// Executa um comando gerado. `None` = não existe aqui (fica com o navegador).\npub fn despachar(s: &Sessao, comando: &str, args: &str) -> Option<Result<serde_json::Value, Erro>> {{\n    Some(match comando {{\n{ramos}        _ => return None,\n    }})\n}}\n\n/// Comandos que esta ponte atende.\npub const COMANDOS_GERADOS: &[&str] = &[{nomes_lista}];\n/// Comandos do Windows que ficaram de fora (dependem do sistema).\npub const COMANDOS_DE_FORA: &[&str] = &[{fora_lista}];\n"
    );
    let destino = Path::new(&env::var("OUT_DIR").unwrap()).join("despacho.rs");
    fs::write(destino, saida).unwrap();
}

/// Divide os parâmetros pelas vírgulas de fora de `<...>`, `(...)` e `[...]`.
fn dividir(params: &str) -> Vec<String> {
    let (mut partes, mut atual, mut nivel) = (Vec::new(), String::new(), 0i32);
    for ch in params.chars() {
        match ch {
            '<' | '(' | '[' => nivel += 1,
            '>' | ')' | ']' => nivel -= 1,
            ',' if nivel == 0 => { partes.push(std::mem::take(&mut atual)); continue; }
            _ => {}
        }
        atual.push(ch);
    }
    partes.push(atual);
    partes
}
