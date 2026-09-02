// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    AppHandle, Emitter, Manager, WebviewWindowBuilder, WebviewUrl,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

#[cfg(windows)]
use windows_sys::Win32::Foundation::{HWND, LPARAM, RECT, POINT};
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, FindWindowW, FindWindowExW, SendMessageTimeoutW, SetParent, SMTO_NORMAL, GetShellWindow,
    SetWindowPos, HWND_BOTTOM, SWP_SHOWWINDOW,
    GetWindowLongW, SetWindowLongW, GWL_STYLE, GWL_EXSTYLE, WS_CHILD, WS_POPUP,
    WS_VISIBLE, WS_THICKFRAME, WS_CAPTION, WS_BORDER,
    SWP_NOACTIVATE, SWP_NOZORDER, SWP_FRAMECHANGED,
    GetClassNameW,
    WS_EX_LAYERED, SetLayeredWindowAttributes, LWA_ALPHA,
    GetSystemMetrics, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
    GetWindowRect, GetClientRect,
};
#[cfg(windows)]
use windows_sys::Win32::Graphics::Gdi::{
    MonitorFromWindow, GetMonitorInfoW, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    MapWindowPoints,
};
#[cfg(windows)]
use windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute;

// ─── PROGMAN / WorkerW trick ─────────────────────────────────────────────────

struct DesktopWindows {
    shell: HWND,
    workerw: HWND,
}

#[cfg(windows)]
unsafe extern "system" fn enum_window(window: HWND, lparam: LPARAM) -> i32 {
    let state = &mut *(lparam as *mut DesktopWindows);
    let shell_class: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
    let worker_class: Vec<u16> = "WorkerW\0".encode_utf16().collect();
    
    let mut cls_buf = [0u16; 256];
    let cls_len = GetClassNameW(window, cls_buf.as_mut_ptr(), 256);
    let cls = String::from_utf16_lossy(&cls_buf[..cls_len as usize]);
    
    if cls == "WorkerW" {
        log_msg(&format!("[AuraOS Enum] Found WorkerW: 0x{:X}", window as usize));
    }

    let shell = FindWindowExW(window, std::ptr::null_mut(), shell_class.as_ptr(), std::ptr::null());
    if !shell.is_null() {
        log_msg(&format!("[AuraOS Enum] Found SHELLDLL_DefView inside 0x{:X}", window as usize));
        state.shell = shell; // Found the shell view (the icons)
        let worker = FindWindowExW(std::ptr::null_mut(), window, worker_class.as_ptr(), std::ptr::null());
        if !worker.is_null() {
            log_msg(&format!("[AuraOS Enum] Found sibling WorkerW: 0x{:X}", worker as usize));
            state.workerw = worker;
        }
    }
    1 // TRUE — keep enumerating
}

fn log_msg(msg: &str) {
    use std::io::Write;
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("desktop_debug.log") {
        let _ = writeln!(file, "{}", msg);
    }
}

/// Pin a native window handle into the WorkerW layer so it renders
/// behind desktop icons but above the bare wallpaper bitmap.
///
/// Does NOT accept x/y/w/h — it queries MonitorFromWindow + GetMonitorInfoW for
/// the exact screen rect, then uses MapWindowPoints to convert to parent-client
/// coordinates after SetParent.  This avoids every coordinate-system assumption
/// (virtual-desktop origin, DPI scaling, primary-monitor bias) that caused the
/// left-gap / second-monitor spill in earlier attempts.
#[cfg(windows)]
fn pin_hwnd_as_wallpaper(hwnd: HWND) {
    unsafe {
        log_msg(&format!("\n--- [AuraOS WP] pin_hwnd_as_wallpaper called: hwnd=0x{:X} ---",
            hwnd as usize));

        // ── Step 1: exact monitor bounds from Win32 (screen coordinates) ─────────
        // MonitorFromWindow gives the physical monitor that currently contains the HWND.
        // GetMonitorInfoW gives rcMonitor (screen coords) — use rcMonitor, NOT rcWork.
        let monitor_handle = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut minfo: MONITORINFO = std::mem::zeroed();
        minfo.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        GetMonitorInfoW(monitor_handle, &mut minfo);

        let rc = minfo.rcMonitor;
        let mon_screen_x = rc.left;
        let mon_screen_y = rc.top;
        let mon_w         = rc.right  - rc.left;
        let mon_h         = rc.bottom - rc.top;

        let vscreen_x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let vscreen_y = GetSystemMetrics(SM_YVIRTUALSCREEN);

        log_msg(&format!(
            "[AuraOS WP] Monitor rcMonitor: left={} top={} right={} bottom={} ({}x{})",
            rc.left, rc.top, rc.right, rc.bottom, mon_w, mon_h
        ));
        log_msg(&format!("[AuraOS WP] Virtual desktop origin: ({},{})", vscreen_x, vscreen_y));

        // Log HWND rect before any reparenting
        let mut hwnd_rect: RECT = std::mem::zeroed();
        GetWindowRect(hwnd, &mut hwnd_rect);
        log_msg(&format!(
            "[AuraOS WP] HWND rect BEFORE SetParent: ({},{}) ({},{})",
            hwnd_rect.left, hwnd_rect.top, hwnd_rect.right, hwnd_rect.bottom
        ));

        // ── Step 2: find Progman and spawn WorkerW ────────────────────────────────
        let mut state = DesktopWindows {
            shell: std::ptr::null_mut(),
            workerw: std::ptr::null_mut(),
        };

        let progman_class: Vec<u16> = "Progman\0".encode_utf16().collect();
        let progman_title: Vec<u16> = "Program Manager\0".encode_utf16().collect();
        let progman = FindWindowW(progman_class.as_ptr(), progman_title.as_ptr());
        log_msg(&format!("[AuraOS WP] FindWindowW('Progman','Program Manager') = 0x{:X}", progman as usize));
        
        let progman_notitle = FindWindowW(progman_class.as_ptr(), std::ptr::null());
        log_msg(&format!("[AuraOS WP] FindWindowW('Progman', NULL) = 0x{:X}", progman_notitle as usize));
        
        let shell_window = GetShellWindow();
        log_msg(&format!("[AuraOS WP] GetShellWindow() = 0x{:X}", shell_window as usize));
        
        let progman = if !progman.is_null() { 
            progman 
        } else if !progman_notitle.is_null() { 
            progman_notitle
        } else if !shell_window.is_null() {
            log_msg("[AuraOS WP] Using GetShellWindow as Progman fallback");
            shell_window
        } else {
            log_msg("[AuraOS WP] CRITICAL: Cannot find Progman or ShellWindow!");
            
            unsafe extern "system" fn dump_cb(h: HWND, _: LPARAM) -> i32 {
                let mut cls_buf = [0u16; 256];
                let cls_len = GetClassNameW(h, cls_buf.as_mut_ptr(), 256);
                let cls = String::from_utf16_lossy(&cls_buf[..cls_len as usize]);
                if cls == "Progman" || cls == "WorkerW" || cls.contains("Shell") || cls.contains("Desktop") {
                    log_msg(&format!("[AuraOS WP]   Found Desktop Class HWND 0x{:X}: class='{}'", h as usize, cls));
                }
                1
            }
            EnumWindows(Some(dump_cb), 0);
            
            // HWND_BOTTOM fallback — use exact monitor screen coords directly
            // (no SetParent, so screen coordinates apply as-is).
            log_msg(&format!("[AuraOS WP] HWND_BOTTOM fallback: pos=({},{}) size={}x{}",
                mon_screen_x, mon_screen_y, mon_w, mon_h));
            let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
            let new_style = (style | WS_VISIBLE) & !(WS_CAPTION | WS_THICKFRAME | WS_BORDER);
            SetWindowLongW(hwnd, GWL_STYLE, new_style as i32);
            SetWindowPos(hwnd, HWND_BOTTOM, mon_screen_x, mon_screen_y, mon_w, mon_h,
                SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED);
            return;
        };
        
        log_msg(&format!("[AuraOS WP] Using progman HWND = 0x{:X}", progman as usize));

        let shell_class: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
        let progman_shell = FindWindowExW(progman, std::ptr::null_mut(), shell_class.as_ptr(), std::ptr::null());
        log_msg(&format!("[AuraOS WP] SHELLDLL_DefView under Progman = 0x{:X}", progman_shell as usize));
        if !progman_shell.is_null() {
            state.shell = progman_shell;
        }

        // wParam=0x0D, lParam=0x1 is what Windows 11 shellcore.dll expects to spawn the
        // background WorkerW. Using 0,0 (the Windows 10 values) causes WorkerW creation to
        // silently fail on Windows 11, leaving state.workerw null and falling back to
        // HWND_BOTTOM overlay mode instead of true desktop-layer embedding.
        log_msg("[AuraOS WP] Sending 0x052C to progman (wParam=0x0D lParam=0x1 for Win11)...");
        SendMessageTimeoutW(progman, 0x052C, 0x0D, 0x1, SMTO_NORMAL, 1000, std::ptr::null_mut());

        // Windows 11 creates the background WorkerW asynchronously after the message.
        // EnumWindows called immediately will always miss it — wait first, then retry.
        std::thread::sleep(std::time::Duration::from_millis(150));

        for attempt in 0..5usize {
            EnumWindows(Some(enum_window), &mut state as *mut DesktopWindows as LPARAM);
            if !state.workerw.is_null() {
                log_msg(&format!("[AuraOS WP] WorkerW found on attempt {}", attempt + 1));
                break;
            }
            if attempt < 4 {
                log_msg(&format!("[AuraOS WP] WorkerW not found yet (attempt {}), retrying...", attempt + 1));
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
        }

        log_msg(&format!("[AuraOS WP] After enum: workerw=0x{:X} shell=0x{:X}",
            state.workerw as usize, state.shell as usize));

        let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
        let new_style = (style | WS_CHILD | WS_VISIBLE) & !(WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_BORDER);
        SetWindowLongW(hwnd, GWL_STYLE, new_style as i32);
        
        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        // Strip 3D non-client borders and frames (WS_EX_WINDOWEDGE, WS_EX_CLIENTEDGE, etc.)
        let new_ex_style = (ex_style | WS_EX_LAYERED) & !(0x00000100 | 0x00000200 | 0x00000001 | 0x00020000);
        SetWindowLongW(hwnd, GWL_EXSTYLE, new_ex_style as i32);
        SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA);

        // ── DWM non-client and corner removal ────────────────────────────────
        // Disables the invisible 9px DWM drop-shadow frame that causes the left gap and right spill
        let ncr_disabled: u32 = 1; // DWMNCRP_DISABLED
        DwmSetWindowAttribute(
            hwnd,
            2, // DWMWA_NCRENDERING_POLICY
            &ncr_disabled as *const u32 as *const _,
            std::mem::size_of::<u32>() as u32,
        );
        // Disable Windows 11 rounded window corners
        let do_not_round: u32 = 1; // DWMWCP_DONOTROUND
        DwmSetWindowAttribute(
            hwnd,
            33, // DWMWA_WINDOW_CORNER_PREFERENCE
            &do_not_round as *const u32 as *const _,
            std::mem::size_of::<u32>() as u32,
        );
        
        log_msg(&format!("[AuraOS WP] Set GWL_STYLE: 0x{:08X} -> 0x{:08X}, added WS_EX_LAYERED, DWM frame disabled", style, new_style));

        let parent_hwnd = if !state.workerw.is_null() && progman_shell.is_null() {
            log_msg(&format!("[AuraOS WP] MODE: Standard Desktop — parent = WorkerW 0x{:X}", state.workerw as usize));
            state.workerw
        } else {
            log_msg(&format!("[AuraOS WP] MODE: Raised Desktop — parent = Progman 0x{:X}", progman as usize));
            progman
        };

        // Log the parent's client rect before SetParent
        let mut parent_client: RECT = std::mem::zeroed();
        GetClientRect(parent_hwnd, &mut parent_client);
        log_msg(&format!(
            "[AuraOS WP] Parent client rect: ({},{}) ({},{})",
            parent_client.left, parent_client.top,
            parent_client.right, parent_client.bottom
        ));

        SetParent(hwnd, parent_hwnd);

        let mut hwnd_rect_after: RECT = std::mem::zeroed();
        GetWindowRect(hwnd, &mut hwnd_rect_after);
        log_msg(&format!(
            "[AuraOS WP] HWND rect AFTER SetParent: ({},{}) ({},{})",
            hwnd_rect_after.left, hwnd_rect_after.top, hwnd_rect_after.right, hwnd_rect_after.bottom
        ));

        // Convert monitor screen top-left to parent client coordinates.
        // MapWindowPoints(NULL=HWND_DESKTOP, parent, pts, 1) is the authoritative
        // way to convert screen coords → parent-client coords on any DPI/layout.
        let mut pts = [POINT { x: mon_screen_x, y: mon_screen_y }];
        MapWindowPoints(std::ptr::null_mut(), parent_hwnd, pts.as_mut_ptr(), 1);
        let client_x = pts[0].x;
        let client_y = pts[0].y;

        log_msg(&format!(
            "[AuraOS WP] Monitor screen ({},{}) → parent client ({},{})",
            mon_screen_x, mon_screen_y, client_x, client_y
        ));

        // Compensate for DWM's 9px invisible non-client margin on left and right,
        // and 10px on bottom.
        // Outer window starts at client_x - 9 and has width mon_w + 18.
        // When DWM subtracts 9px, the internal client viewport starts at
        // EXACTLY client_x (0px) with width mon_w (1920px).
        // This eliminates BOTH the left gap (0..9px) and the right leak (1920..1929px).
        let adj_x = client_x - 9;
        let adj_y = client_y;
        let adj_w = mon_w + 18;
        let adj_h = mon_h + 10;

        SetWindowPos(
            hwnd,
            std::ptr::null_mut(),
            adj_x, adj_y,
            adj_w, adj_h,
            SWP_NOACTIVATE | SWP_NOZORDER | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
        );

        // Verification log
        let mut final_wr: RECT = std::mem::zeroed();
        let mut final_cr: RECT = std::mem::zeroed();
        GetWindowRect(hwnd, &mut final_wr);
        GetClientRect(hwnd, &mut final_cr);
        log_msg(&format!(
            "[AuraOS WP] FINAL HWND WinRect: ({},{})-({},{}) [{}x{}], ClientRect: ({},{})-({},{}) [{}x{}]",
            final_wr.left, final_wr.top, final_wr.right, final_wr.bottom,
            final_wr.right - final_wr.left, final_wr.bottom - final_wr.top,
            final_cr.left, final_cr.top, final_cr.right, final_cr.bottom,
            final_cr.right - final_cr.left, final_cr.bottom - final_cr.top
        ));

        log_msg(&format!(
            "[AuraOS WP] SetWindowPos done: pos=({},{}), size={}x{}",
            adj_x, adj_y, adj_w, adj_h
        ));
        log_msg("[AuraOS WP] pin_hwnd_as_wallpaper complete.");
    }
}

// ─── Helper: open or create the wallpaper window ─────────────────────────────

fn get_monitor_label(name: &str) -> String {
    format!("wallpaper_{}", name.replace("\\", "").replace(".", "_").replace(" ", "_"))
}

fn ensure_wallpaper_windows(app: &AppHandle) {
    let monitors = app.available_monitors().unwrap_or_default();
    for monitor in monitors {
        if let Some(name) = monitor.name() {
            let label = get_monitor_label(name);
            if app.get_webview_window(&label).is_some() {
                continue;
            }

            let size = monitor.size();
            let pos = monitor.position();
            let scale = monitor.scale_factor();
            
            // inner_size() takes LOGICAL pixels; monitor.size() returns PHYSICAL pixels.
            // At 125% DPI scale=1.25, so divide to get logical dimensions.
            // Without this the window is too narrow and the original wallpaper bleeds through.
            let logical_w = size.width as f64 / scale;
            let logical_h = size.height as f64 / scale;
            // Create the window at the EXACT screen position of this monitor.
            // This ensures WebView2 initializes its controller bounds to the full
            // monitor size. After SetParent the window is automatically at the
            // correct WorkerW-relative position — no resize needed afterwards.
            let logical_x = pos.x as f64 / scale;
            let logical_y = pos.y as f64 / scale;

            let win = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("wallpaper.html".into()))
                .title(&format!("AuraOS Wallpaper - {}", name))
                .decorations(false)
                .transparent(true)
                .visible(true)
                .skip_taskbar(true)
                .resizable(false)
                .inner_size(logical_w, logical_h)
                .position(logical_x, logical_y)
                .build()
                .expect("Failed to create wallpaper window");

            #[cfg(windows)]
            if let Ok(hwnd) = win.hwnd() {
                let raw_hwnd = hwnd.0 as isize;
                std::thread::spawn(move || {
                    // 800 ms: let WebView2 finish initialising its internal HWND tree
                    // before we call SetParent on it (500 ms was occasionally too short).
                    std::thread::sleep(std::time::Duration::from_millis(800));
                    // Coordinates / size are determined inside pin_hwnd_as_wallpaper
                    // via MonitorFromWindow + GetMonitorInfoW + MapWindowPoints,
                    // so there is nothing to pre-compute here.
                    pin_hwnd_as_wallpaper(raw_hwnd as *mut std::ffi::c_void);
                });
            }
        }
    }
}

// ─── Commands (callable from JS via invoke()) ─────────────────────────────────

#[tauri::command]
fn get_monitors(app: AppHandle) -> serde_json::Value {
    let monitors = app.available_monitors().unwrap_or_default();
    let mut out = Vec::new();
    for m in monitors {
        if let Some(name) = m.name() {
            let label = get_monitor_label(name);
            out.push(serde_json::json!({
                "name": name,
                "label": label,
                "width": m.size().width,
                "height": m.size().height,
                "x": m.position().x,
                "y": m.position().y,
                "isPrimary": m.position().x == 0 && m.position().y == 0 // simple heuristic for primary
            }));
        }
    }
    serde_json::json!(out)
}

/// Apply a wallpaper engine: shows & pins the wallpaper window, then emits
/// 'aura:set-engine' to the wallpaper WebView so it boots the canvas engine.
#[tauri::command]
fn apply_wallpaper(
    app: AppHandle,
    engine_id: String,
    config: serde_json::Value,
    opacity: f64,
    brightness: f64,
    monitor_label: Option<String>,
) {
    ensure_wallpaper_windows(&app);

    let target = monitor_label.unwrap_or_else(|| "*".to_string());
    
    let windows = app.webview_windows();
    for (label, win) in windows {
        if label.starts_with("wallpaper_") {
            if target == "*" || target == label {
                let _ = win.set_ignore_cursor_events(true);
                // win.show() removed to prevent z-order changes that cover desktop icons
                let payload = serde_json::json!({
                    "engineId": engine_id.clone(),
                    "config": config.clone(),
                });
                let _ = win.emit_to(label.clone(), "aura:set-engine", payload.clone());
                let _ = win.emit("aura:set-engine", payload.clone());
                let _ = app.emit("aura:set-engine", payload);

                let b_payload = serde_json::json!({ "brightness": brightness });
                let _ = win.emit_to(label.clone(), "aura:set-brightness", b_payload.clone());
                let _ = win.emit("aura:set-brightness", b_payload.clone());
                let _ = app.emit("aura:set-brightness", b_payload);

                let o_payload = serde_json::json!({ "opacity": opacity });
                let _ = win.emit_to(label.clone(), "aura:set-opacity", o_payload.clone());
                let _ = win.emit("aura:set-opacity", o_payload.clone());
                let _ = app.emit("aura:set-opacity", o_payload);
            }
        }
    }
}

/// Stop the active wallpaper and hide the wallpaper window.
#[tauri::command]
fn stop_wallpaper(app: AppHandle) {
    let windows = app.webview_windows();
    for (label, win) in windows {
        if label.starts_with("wallpaper_") {
            let _ = win.emit_to(label.clone(), "aura:stop", serde_json::json!({}));
            let _ = win.emit("aura:stop", serde_json::json!({}));
            let _ = app.emit("aura:stop", serde_json::json!({}));
        }
    }
}

/// Hot-update the active engine config without restarting it.
#[tauri::command]
fn update_wallpaper_config(app: AppHandle, config: serde_json::Value, monitor_label: Option<String>) {
    let target = monitor_label.unwrap_or_else(|| "*".to_string());
    let windows = app.webview_windows();
    for (label, win) in windows {
        if label.starts_with("wallpaper_") && (target == "*" || target == label) {
            let _ = win.emit_to(label.clone(), "aura:update-config", config.clone());
        }
    }
}

/// Update brightness on the live wallpaper (no engine restart needed).
#[tauri::command]
fn set_wallpaper_brightness(app: AppHandle, brightness: f64) {
    let windows = app.webview_windows();
    for (label, win) in windows {
        if label.starts_with("wallpaper_") {
            let _ = win.emit_to(label.clone(), "aura:set-brightness", serde_json::json!({ "brightness": brightness }));
        }
    }
}

/// Update opacity on the live wallpaper (no engine restart needed).
#[tauri::command]
fn set_wallpaper_opacity(app: AppHandle, opacity: f64) {
    let windows = app.webview_windows();
    for (label, win) in windows {
        if label.starts_with("wallpaper_") {
            let _ = win.emit_to(label.clone(), "aura:set-opacity", serde_json::json!({ "opacity": opacity }));
        }
    }
}

/// Show or hide the main control panel window.
#[tauri::command]
fn toggle_control_panel(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

/// Legacy command — kept for compat. Use apply_wallpaper instead.
#[tauri::command]
fn set_wallpaper_mode(app: AppHandle, active: bool) {
    if active {
        // no-op — use apply_wallpaper
    } else {
        stop_wallpaper(app);
    }
}

#[tauri::command]
fn get_system_info() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
}

#[tauri::command]
async fn read_local_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

// ─── Main ─────────────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Second instance: show existing control panel
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            apply_wallpaper,
            stop_wallpaper,
            update_wallpaper_config,
            set_wallpaper_brightness,
            set_wallpaper_opacity,
            toggle_control_panel,
            set_wallpaper_mode,
            get_system_info,
            read_local_file,
            get_monitors,
        ])
        .setup(|app| {
            // Show the main window
            println!("AuraOS: Creating main window manually in setup...");
            let win = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into())
            )
            .title("AuraOS")
            .inner_size(1200.0, 780.0)
            .min_inner_size(900.0, 600.0)
            .center()
            .visible(true)
            .focused(true)
            .build();
            
            match win {
                Ok(w) => {
                    println!("AuraOS: Main window created successfully.");
                    let hwnd = w.hwnd();
                    println!("AuraOS: Main window HWND: {:?}", hwnd);
                    
                    let w_clone = w.clone();
                    w.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            let _ = w_clone.hide();
                            api.prevent_close();
                        }
                    });

                    let _ = w.show();
                    let _ = w.set_focus();
                }
                Err(e) => {
                    println!("AuraOS: ERROR creating main window - {}", e);
                }
            }

            // ... tray code remains below ...

            // Pre-create the wallpaper window (hidden) so first Apply is instant
            ensure_wallpaper_windows(app.handle());

            // ── System tray ───────────────────────────────────────────────────
            let open_item  = MenuItem::with_id(app, "open",  "Open AuraOS",      true, None::<&str>)?;
            let pause_item = MenuItem::with_id(app, "pause", "Pause Wallpaper",   true, None::<&str>)?;
            let resume_item = MenuItem::with_id(app, "resume", "Resume Wallpaper",  true, None::<&str>)?;
            let stop_item  = MenuItem::with_id(app, "stop",  "Stop Wallpaper",    true, None::<&str>)?;
            let sep        = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_item  = MenuItem::with_id(app, "quit",  "Quit AuraOS",       true, None::<&str>)?;

            let menu = Menu::with_items(app, &[
                &open_item,
                &pause_item,
                &resume_item,
                &stop_item,
                &sep,
                &quit_item,
            ])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("AuraOS — Live Wallpaper Engine")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "open" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "pause" => {
                            let windows = app.webview_windows();
                            for (label, win) in windows {
                                if label.starts_with("wallpaper_") {
                                    let _ = win.emit_to(label.clone(), "aura:pause", serde_json::json!({}));
                                }
                            }
                        }
                        "resume" => {
                            let windows = app.webview_windows();
                            for (label, win) in windows {
                                if label.starts_with("wallpaper_") {
                                    let _ = win.emit_to(label.clone(), "aura:resume", serde_json::json!({}));
                                }
                            }
                        }
                        "stop" => {
                            stop_wallpaper(app.clone());
                        }
                        "quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Double-click tray icon → show control panel
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running AuraOS")
}
