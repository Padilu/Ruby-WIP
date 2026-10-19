// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod notch;
mod shortcuts;
mod tray;

use notch::{get_screen_info, position_overlay, PositionConfig};
use tauri::{Manager, PhysicalSize, WebviewWindow};

#[tauri::command]
fn set_window_size(window: WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    let factor = window.scale_factor().unwrap_or(1.0);
    let size = PhysicalSize::new(
        (width * factor).round() as u32,
        (height * factor).round() as u32,
    );
    window.set_size(size).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_always_on_top(window: WebviewWindow, always_on_top: bool) -> Result<(), String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())
}

#[tauri::command]
fn show_window(window: WebviewWindow) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
fn hide_window(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Setup System Tray
            if let Err(e) = tray::setup_tray(app.handle()) {
                eprintln!("Failed to setup tray: {}", e);
            }

            // Setup Global Shortcuts
            if let Err(e) = shortcuts::setup_shortcuts(app.handle()) {
                eprintln!("Failed to setup shortcuts: {}", e);
            }

            // Initial positioning for main window
            if let Some(window) = app.get_webview_window("main") {
                let default_pos = PositionConfig::default();
                let _ = position_overlay(window.clone(), default_pos);

                #[cfg(target_os = "macos")]
                notch::apply_macos_overlay_level(&window);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_screen_info,
            position_overlay,
            set_window_size,
            toggle_always_on_top,
            show_window,
            hide_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ruby Assistant application");
}
