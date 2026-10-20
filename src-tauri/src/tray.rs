use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let toggle_item = MenuItem::with_id(app, "toggle_window", "Buka / Sembunyikan Ruby", true, None::<&str>)?;
    let listen_item = MenuItem::with_id(app, "listen_now", "Dengarkan Suara (Ctrl/Cmd+Shift+R)", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "open_settings", "Pengaturan...", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Keluar dari Ruby", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &toggle_item,
        &listen_item,
        &settings_item,
        &quit_item,
    ])?;

    let _tray = TrayIconBuilder::new()
        .tooltip("Ruby AI Assistant")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id_str = event.id.as_ref();
            match id_str {
                "toggle_window" => {
                    if let Some(window) = app.get_webview_window("main") {
                        if let Ok(visible) = window.is_visible() {
                            if visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                }
                "listen_now" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = app.emit("ruby://toggle-listen", ());
                    }
                }
                "open_settings" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = app.emit("ruby://open-settings", ());
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(visible) = window.is_visible() {
                        if visible {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
