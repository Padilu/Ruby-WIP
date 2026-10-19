use serde::{Deserialize, Serialize};
use tauri::{AppHandle, PhysicalPosition, PhysicalSize, WebviewWindow};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenInfo {
    pub width: f64,
    pub height: f64,
    pub scale_factor: f64,
    pub has_notch: bool,
    pub notch_height: f64,
    pub taskbar_height: f64,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionConfig {
    pub anchor: String, // "notch" | "tray" | "top_center" | "custom"
    pub preset: String, // "small" | "medium" | "large" | "expanded" | "custom"
    pub width: f64,
    pub height: f64,
    pub offset_x: f64,
    pub offset_y: f64,
}

impl Default for PositionConfig {
    fn default() -> Self {
        Self {
            anchor: if cfg!(target_os = "macos") {
                "notch".to_string()
            } else {
                "tray".to_string()
            },
            preset: "medium".to_string(),
            width: 240.0,
            height: 42.0,
            offset_x: 0.0,
            offset_y: 0.0,
        }
    }
}

pub fn get_preset_dimensions(preset: &str) -> (f64, f64) {
    match preset {
        "small" => (180.0, 32.0),
        "medium" => (240.0, 42.0),
        "large" => (320.0, 56.0),
        "expanded" => (360.0, 480.0),
        _ => (240.0, 42.0),
    }
}

#[cfg(target_os = "macos")]
pub fn detect_macos_notch() -> (bool, f64) {
    use cocoa::appkit::NSScreen;
    use cocoa::base::id;
    use cocoa::foundation::NSRect;
    use objc::{msg_send, sel, sel_impl};

    unsafe {
        let main_screen: id = NSScreen::mainScreen(cocoa::base::nil);
        if main_screen.is_null() {
            return (false, 0.0);
        }

        // Check if safeAreaInsets is available (macOS 12.0+)
        let responds: bool = msg_send![main_screen, respondsToSelector: sel!(safeAreaInsets)];
        if responds {
            #[repr(C)]
            struct NSEdgeInsets {
                top: f64,
                left: f64,
                bottom: f64,
                right: f64,
            }
            let insets: NSEdgeInsets = msg_send![main_screen, safeAreaInsets];
            if insets.top > 0.0 {
                return (true, insets.top);
            }
        }

        // Auxiliary check via auxiliaryTopLeftArea
        let has_aux: bool =
            msg_send![main_screen, respondsToSelector: sel!(auxiliaryTopLeftArea)];
        if has_aux {
            let aux_rect: NSRect = msg_send![main_screen, auxiliaryTopLeftArea];
            if aux_rect.size.height > 0.0 {
                return (true, aux_rect.size.height);
            }
        }

        (false, 0.0)
    }
}

#[cfg(not(target_os = "macos"))]
pub fn detect_macos_notch() -> (bool, f64) {
    (false, 0.0)
}

#[cfg(target_os = "windows")]
pub fn detect_windows_work_area() -> (f64, f64, f64, f64, f64) {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, SystemParametersInfoW, SM_CXSCREEN, SM_CYSCREEN, SPI_GETWORKAREA,
        SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS,
    };

    unsafe {
        let screen_w = GetSystemMetrics(SM_CXSCREEN) as f64;
        let screen_h = GetSystemMetrics(SM_CYSCREEN) as f64;
        let mut work_area = RECT::default();

        let ok = SystemParametersInfoW(
            SPI_GETWORKAREA,
            0,
            Some(&mut work_area as *mut _ as *mut _),
            SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        );

        if ok.is_ok() {
            let taskbar_h = screen_h - (work_area.bottom - work_area.top) as f64;
            (
                screen_w,
                screen_h,
                (work_area.right - work_area.left) as f64,
                (work_area.bottom - work_area.top) as f64,
                taskbar_h.max(0.0),
            )
        } else {
            (screen_w, screen_h, screen_w, screen_h - 48.0, 48.0)
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn detect_windows_work_area() -> (f64, f64, f64, f64, f64) {
    (1920.0, 1080.0, 1920.0, 1032.0, 48.0)
}

#[tauri::command]
pub fn get_screen_info(window: WebviewWindow) -> Result<ScreenInfo, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found".to_string())?;

    let size = monitor.size();
    let scale_factor = monitor.scale_factor();
    let width = size.width as f64 / scale_factor;
    let height = size.height as f64 / scale_factor;

    #[cfg(target_os = "macos")]
    {
        let (has_notch, notch_height) = detect_macos_notch();
        Ok(ScreenInfo {
            width,
            height,
            scale_factor,
            has_notch,
            notch_height,
            taskbar_height: 0.0,
            platform: "macos".to_string(),
        })
    }

    #[cfg(target_os = "windows")]
    {
        let (_, _, _, _, taskbar_h) = detect_windows_work_area();
        Ok(ScreenInfo {
            width,
            height,
            scale_factor,
            has_notch: false,
            notch_height: 0.0,
            taskbar_height: taskbar_h,
            platform: "windows".to_string(),
        })
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Ok(ScreenInfo {
            width,
            height,
            scale_factor,
            has_notch: false,
            notch_height: 0.0,
            taskbar_height: 0.0,
            platform: "linux".to_string(),
        })
    }
}

#[tauri::command]
pub fn position_overlay(window: WebviewWindow, config: PositionConfig) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found".to_string())?;

    let scale_factor = monitor.scale_factor();
    let screen_size = monitor.size();
    let screen_w = screen_size.width as f64 / scale_factor;
    let screen_h = screen_size.height as f64 / scale_factor;

    let (win_w, win_h) = if config.preset != "custom" {
        get_preset_dimensions(&config.preset)
    } else {
        (config.width, config.height)
    };

    let mut target_x: f64;
    let mut target_y: f64;

    match config.anchor.as_str() {
        "notch" => {
            // macOS Notch: centered horizontally at top
            target_x = (screen_w - win_w) / 2.0 + config.offset_x;
            target_y = 0.0 + config.offset_y;
        }
        "tray" => {
            // Windows Taskbar / System Tray: bottom right
            #[cfg(target_os = "windows")]
            {
                let (_, _, _, work_h, _) = detect_windows_work_area();
                target_x = (screen_w - win_w - 12.0) + config.offset_x;
                target_y = (work_h - win_h - 12.0) + config.offset_y;
            }
            #[cfg(not(target_os = "windows"))]
            {
                target_x = (screen_w - win_w - 16.0) + config.offset_x;
                target_y = (screen_h - win_h - 48.0) + config.offset_y;
            }
        }
        "top_center" => {
            target_x = (screen_w - win_w) / 2.0 + config.offset_x;
            target_y = 12.0 + config.offset_y;
        }
        "custom" => {
            target_x = config.offset_x;
            target_y = config.offset_y;
        }
        _ => {
            target_x = (screen_w - win_w) / 2.0;
            target_y = 0.0;
        }
    }

    // Convert to physical pixels for window positioning
    let phys_pos = PhysicalPosition::new(
        (target_x * scale_factor).round() as i32,
        (target_y * scale_factor).round() as i32,
    );
    let phys_size = PhysicalSize::new(
        (win_w * scale_factor).round() as u32,
        (win_h * scale_factor).round() as u32,
    );

    window.set_size(phys_size).map_err(|e| e.to_string())?;
    window.set_position(phys_pos).map_err(|e| e.to_string())?;

    // Apply macOS specific window behaviors
    #[cfg(target_os = "macos")]
    apply_macos_overlay_level(&window);

    Ok(())
}

#[cfg(target_os = "macos")]
pub fn apply_macos_overlay_level(window: &WebviewWindow) {
    use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
    use cocoa::base::id;
    use objc::{msg_send, sel, sel_impl};

    if let Ok(ns_window_ptr) = window.ns_window() {
        let ns_window = ns_window_ptr as id;
        unsafe {
            // NSFloatingWindowLevel = 3 or NSScreenSaverWindowLevel = 1000
            let _: () = msg_send![ns_window, setLevel: 3];

            // Join all spaces so overlay stays present across all desktop virtual workspaces
            let behavior = NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle;
            ns_window.setCollectionBehavior_(behavior);
        }
    }
}
