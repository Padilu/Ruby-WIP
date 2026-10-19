use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub fn setup_shortcuts(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut_str = "CommandOrControl+Shift+R";
    let shortcut: Shortcut = shortcut_str.parse()?;

    let app_handle = app.clone();
    app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = app_handle.emit("ruby://toggle-listen", ());
            }
        }
    })?;

    Ok(())
}
