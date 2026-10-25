//! Ícone na bandeja do sistema (perto do relógio). Opcional: com ele ligado,
//! fechar a janela só a esconde, e o Órbita continua pronto para capturar.
//! A escolha fica num arquivo pequeno fora do cofre, porque vale antes de abrir.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

use crate::comandos::Estado;
use crate::erro::Erro;

const ID: &str = "principal";

#[derive(Default, Serialize, Deserialize)]
struct Arquivo {
    bandeja: bool,
    /// Já avisou, uma vez, que fechar a janela deixa o Órbita na bandeja.
    #[serde(default)]
    avisado: bool,
}

pub struct Bandeja {
    arquivo: PathBuf,
    ligada: AtomicBool,
    avisado: AtomicBool,
}

impl Bandeja {
    pub fn new(pasta: &Path) -> Self {
        let arquivo = pasta.join("janela.json");
        let a = std::fs::read_to_string(&arquivo).ok().and_then(|t| serde_json::from_str::<Arquivo>(&t).ok()).unwrap_or_default();
        Self { arquivo, ligada: AtomicBool::new(a.bandeja), avisado: AtomicBool::new(a.avisado) }
    }

    pub fn ligada(&self) -> bool {
        self.ligada.load(Ordering::Relaxed)
    }

    fn salvar(&self) -> Result<(), Erro> {
        if let Some(pasta) = self.arquivo.parent() {
            std::fs::create_dir_all(pasta)?;
        }
        let a = Arquivo { bandeja: self.ligada(), avisado: self.avisado.load(Ordering::Relaxed) };
        let json = serde_json::to_string(&a).map_err(|e| Erro::Interno(e.to_string()))?;
        std::fs::write(&self.arquivo, json)?;
        Ok(())
    }

    fn gravar(&self, ligada: bool) -> Result<(), Erro> {
        self.ligada.store(ligada, Ordering::Relaxed);
        self.salvar()
    }

    /// true só na primeira vez que a janela vai para a bandeja.
    pub fn primeiro_aviso(&self) -> bool {
        let primeira = !self.avisado.swap(true, Ordering::Relaxed);
        if primeira {
            let _ = self.salvar();
        }
        primeira
    }
}

pub fn mostrar_janela(app: &AppHandle) {
    if let Some(janela) = app.get_webview_window("principal") {
        let _ = janela.show();
        let _ = janela.unminimize();
        let _ = janela.set_focus();
    }
}

/// Sai de verdade (pelo menu da bandeja): faz o backup automático antes.
fn sair(app: &AppHandle) {
    app.state::<Estado>().backup_automatico_se_preciso(false);
    app.exit(0);
}

fn criar_icone(app: &AppHandle) -> tauri::Result<()> {
    if app.tray_by_id(ID).is_some() {
        return Ok(());
    }
    let abrir = MenuItem::with_id(app, "abrir", "Abrir o Órbita", true, None::<&str>)?;
    let capturar = MenuItem::with_id(app, "capturar", "Capturar (Ctrl + Alt + Espaço)", true, None::<&str>)?;
    let separador = PredefinedMenuItem::separator(app)?;
    let fechar = MenuItem::with_id(app, "sair", "Sair do Órbita", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&abrir, &capturar, &separador, &fechar])?;
    let mut construtor = TrayIconBuilder::with_id(ID)
        .tooltip("Órbita")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, evento| match evento.id().as_ref() {
            "abrir" => mostrar_janela(app),
            "capturar" => {
                mostrar_janela(app);
                let _ = app.emit("capturar", ());
            }
            "sair" => sair(app),
            _ => {}
        })
        .on_tray_icon_event(|icone, evento| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = evento {
                mostrar_janela(icone.app_handle());
            }
        });
    if let Some(imagem) = app.default_window_icon() {
        construtor = construtor.icon(imagem.clone());
    }
    construtor.build(app)?;
    Ok(())
}

/// Ao abrir o app: cria o ícone se a pessoa deixou ligado.
pub fn iniciar(app: &AppHandle) {
    if app.state::<Bandeja>().ligada() {
        if let Err(e) = criar_icone(app) {
            eprintln!("bandeja indisponível: {e}");
        }
    }
}

pub fn definir(app: &AppHandle, ligar: bool) -> Result<(), Erro> {
    app.state::<Bandeja>().gravar(ligar)?;
    if ligar {
        criar_icone(app).map_err(|e| Erro::Interno(format!("bandeja: {e}")))?;
    } else {
        let _ = app.remove_tray_by_id(ID);
    }
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn a_escolha_fica_guardada() {
        let pasta = tempfile::tempdir().unwrap();
        assert!(!Bandeja::new(pasta.path()).ligada());
        Bandeja::new(pasta.path()).gravar(true).unwrap();
        let b = Bandeja::new(pasta.path());
        assert!(b.ligada());
        assert!(b.primeiro_aviso());
        assert!(!b.primeiro_aviso());
        assert!(!Bandeja::new(pasta.path()).primeiro_aviso());
        std::fs::write(pasta.path().join("janela.json"), "lixo").unwrap();
        assert!(!Bandeja::new(pasta.path()).ligada());
    }
}
