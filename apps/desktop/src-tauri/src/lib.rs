mod banco;
mod cofre;
mod comandos;
mod erro;

use std::sync::Arc;

use tauri::Manager;

use cofre::aparelho::GuardaDoSistema;
use cofre::Cofre;
use comandos::Estado;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let pasta = app.path().app_data_dir()?;
            let guarda = Arc::new(GuardaDoSistema { servico: app.config().identifier.clone() });
            app.manage(Estado::new(Cofre::new(pasta, guarda)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            comandos::situacao,
            comandos::criar_cofre,
            comandos::abrir_com_senha,
            comandos::abrir_com_pin,
            comandos::abrir_direto,
            comandos::conferir_palavras,
            comandos::recuperar,
            comandos::ler_arquivo_recuperacao,
            comandos::gravar_arquivo_recuperacao,
            comandos::ver_palavras,
            comandos::trocar_senha,
            comandos::mudar_modo,
            comandos::bloquear,
            comandos::listar_notas,
            comandos::criar_nota,
            comandos::excluir_nota,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Órbita");
}
