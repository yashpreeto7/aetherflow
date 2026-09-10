// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    AppHandle, Emitter, Manager, WebviewWindowBuilder, WebviewUrl,
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
};

#[cfg(windows)]
use windows_sys::Win32::Foundation::{HWND, LPARAM, RECT, POINT};
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, FindWindowW, FindWindowExW, SendMessageTimeoutW, SetParent, SMTO_NORMAL, GetShellWindow,
    SetWindowPos, HWND_BOTTOM, SWP_SHOWWINDOW, ShowWindow, DestroyWindow, IsWindow, IsWindowVisible, GetParent,
    GetWindowLongW, SetWindowLongW, GWL_STYLE, GWL_EXSTYLE, WS_CHILD, WS_POPUP,
    WS_VISIBLE, WS_THICKFRAME, WS_CAPTION, WS_BORDER,
    SWP_NOACTIVATE, SWP_FRAMECHANGED, SWP_NOMOVE, SWP_NOSIZE,
    GetClassNameW,
    WS_EX_LAYERED, SetLayeredWindowAttributes, LWA_ALPHA,
    GetSystemMetrics, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
    GetWindowRect, GetClientRect,
    WS_EX_TOOLWINDOW, WS_EX_NOACTIVATE,
    SystemParametersInfoW, SPI_SETDESKWALLPAPER, SPIF_UPDATEINIFILE, SPIF_SENDCHANGE,
    GetForegroundWindow, SetForegroundWindow, IsIconic,
};
#[cfg(windows)]
use windows_sys::Win32::Graphics::Gdi::{
    MonitorFromWindow, GetMonitorInfoW, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    MapWindowPoints, InvalidateRect, UpdateWindow, RedrawWindow,
    RDW_INVALIDATE, RDW_UPDATENOW, RDW_ERASE, RDW_ALLCHILDREN,
    CreateRectRgn, SetWindowRgn,
};
#[cfg(windows)]
use windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[repr(C)]
#[derive(Debug, Copy, Clone)]
struct SystemPowerStatus {
    ac_line_status: u8,
    battery_flag: u8,
    battery_life_percent: u8,
    system_status_flag: u8,
    battery_life_time: u32,
    battery_full_life_time: u32,
}

#[cfg(windows)]
extern "system" {
    fn GetSystemPowerStatus(lpSystemPowerStatus: *mut SystemPowerStatus) -> i32;
}

use std::sync::Mutex;
use std::collections::HashMap;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PerformanceSettings {
    pub pause_on_battery: bool,
    pub pause_on_fullscreen: bool,
}

static PERFORMANCE_SETTINGS: Mutex<PerformanceSettings> = Mutex::new(PerformanceSettings {
    pause_on_battery: true,
    pause_on_fullscreen: true,
});

static IS_SYSTEM_PAUSED: Mutex<bool> = Mutex::new(false);

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct ActiveWallpaperState {
    pub engine_id: String,
    pub config: serde_json::Value,
    pub opacity: f64,
    pub brightness: f64,
}

static ACTIVE_WALLPAPERS: Mutex<Option<HashMap<String, ActiveWallpaperState>>> = Mutex::new(None);

pub mod mpv;
pub mod taskbar;
static MPV_PLAYERS: Mutex<Option<HashMap<String, mpv::MpvProcess>>> = Mutex::new(None);

// ─── Main AuraOS Window Protection & HWND Identity ───────────────────────────
static MAIN_HWND: Mutex<Option<usize>> = Mutex::new(None);
static TRAY_HOLDER: Mutex<Option<tauri::tray::TrayIcon>> = Mutex::new(None);

#[cfg(windows)]
pub fn set_main_hwnd(hwnd: HWND) {
    if let Ok(mut guard) = MAIN_HWND.lock() {
        *guard = Some(hwnd as usize);
        let msg = format!("[DIAG 1] Main AuraOS HWND registered: 0x{:X}", hwnd as usize);
        log_msg(&msg);
        println!("{}", msg);
    }
}

#[cfg(windows)]
pub fn get_main_hwnd() -> Option<HWND> {
    if let Ok(guard) = MAIN_HWND.lock() {
        guard.map(|h| h as HWND)
    } else {
        None
    }
}


#[cfg(windows)]
pub fn is_main_hwnd(hwnd: HWND) -> bool {
    if let Some(main_h) = get_main_hwnd() {
        main_h == hwnd
    } else {
        false
    }
}

#[cfg(windows)]
pub fn set_hwnd_opacity(hwnd: HWND, opacity: f64) {
    unsafe {
        if hwnd.is_null() || IsWindow(hwnd) == 0 {
            return;
        }
        let ex = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        if (ex & WS_EX_LAYERED) == 0 {
            SetWindowLongW(hwnd, GWL_EXSTYLE, (ex | WS_EX_LAYERED) as i32);
        }
        let alpha = (opacity.max(0.05).min(1.0) * 255.0).round() as u8;
        SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA);
    }
}

#[cfg(windows)]
pub fn is_running_on_battery() -> bool {
    let mut sps = SystemPowerStatus {
        ac_line_status: 255,
        battery_flag: 255,
        battery_life_percent: 255,
        system_status_flag: 0,
        battery_life_time: 0,
        battery_full_life_time: 0,
    };
    let ret = unsafe { GetSystemPowerStatus(&mut sps) };
    if ret != 0 {
        // ac_line_status: 0 = Offline (battery power), 1 = Online (AC), 255 = Unknown
        sps.ac_line_status == 0
    } else {
        false
    }
}

#[cfg(not(windows))]
pub fn is_running_on_battery() -> bool {
    false
}

#[cfg(windows)]
pub fn is_foreground_window_fullscreen() -> bool {
    unsafe {
        let fg_hwnd = GetForegroundWindow();
        if fg_hwnd.is_null() {
            return false;
        }

        // Filter out desktop shell window
        let shell_hwnd = GetShellWindow();
        if fg_hwnd == shell_hwnd {
            return false;
        }

        // Filter out our own main control panel window
        if is_main_hwnd(fg_hwnd) {
            return false;
        }

        // Filter out Desktop and Taskbar classes
        let mut class_buf = [0u16; 256];
        let len = GetClassNameW(fg_hwnd, class_buf.as_mut_ptr(), 256);
        if len > 0 {
            let class_name = String::from_utf16_lossy(&class_buf[..len as usize]);
            if class_name == "WorkerW"
                || class_name == "Progman"
                || class_name == "Shell_TrayWnd"
                || class_name == "Shell_SecondaryTrayWnd"
            {
                return false;
            }
        }

        if IsWindowVisible(fg_hwnd) == 0 {
            return false;
        }
        if IsIconic(fg_hwnd) != 0 {
            return false;
        }

        // Standard desktop applications have WS_CAPTION (title bar), even when maximized.
        // True fullscreen games, media players (F11/exclusive fullscreen) have no WS_CAPTION.
        let style = GetWindowLongW(fg_hwnd, GWL_STYLE) as u32;
        if (style & WS_CAPTION) == WS_CAPTION {
            return false;
        }

        let monitor = MonitorFromWindow(fg_hwnd, MONITOR_DEFAULTTONEAREST);
        if monitor.is_null() {
            return false;
        }

        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(monitor, &mut mi) == 0 {
            return false;
        }

        let mut wr: RECT = std::mem::zeroed();
        if GetWindowRect(fg_hwnd, &mut wr) == 0 {
            return false;
        }

        // Window fully covers the active monitor resolution
        wr.left <= mi.rcMonitor.left
            && wr.top <= mi.rcMonitor.top
            && wr.right >= mi.rcMonitor.right
            && wr.bottom >= mi.rcMonitor.bottom
    }
}

#[cfg(not(windows))]
pub fn is_foreground_window_fullscreen() -> bool {
    false
}

pub fn start_system_state_monitor(app: AppHandle) {
    std::thread::spawn(move || {
        // Wait for startup to settle
        std::thread::sleep(std::time::Duration::from_millis(2500));
        let mut was_paused = false;

        let mut taskbar_tick = 0u32;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(750));

            // Periodically maintain taskbar style against Explorer resets (every ~3s)
            taskbar_tick = taskbar_tick.wrapping_add(1);
            if taskbar_tick % 4 == 0 {
                taskbar::maintain_taskbar_style();
            }

            let (pause_on_battery, pause_on_fullscreen) = {
                if let Ok(guard) = PERFORMANCE_SETTINGS.lock() {
                    (guard.pause_on_battery, guard.pause_on_fullscreen)
                } else {
                    (true, true)
                }
            };

            let on_battery = pause_on_battery && is_running_on_battery();
            let on_fullscreen = pause_on_fullscreen && is_foreground_window_fullscreen();

            let should_pause = on_battery || on_fullscreen;

            if should_pause != was_paused {
                was_paused = should_pause;
                if let Ok(mut p_guard) = IS_SYSTEM_PAUSED.lock() {
                    *p_guard = should_pause;
                }

                let reason = if on_battery && on_fullscreen {
                    "battery & fullscreen"
                } else if on_battery {
                    "battery power"
                } else if on_fullscreen {
                    "fullscreen application"
                } else {
                    "resumed (AC power & normal window focus)"
                };

                let log = format!("[SYSTEM MONITOR] State transition -> paused: {} (reason: {})", should_pause, reason);
                log_msg(&log);
                println!("{}", log);

                // 1. Pause or resume all MPV players
                set_mpv_pause(None, should_pause);

                // 2. Emit pause/resume to Webview wallpaper windows
                let event_name = if should_pause { "aura:pause" } else { "aura:resume" };
                let windows = app.webview_windows();
                for (label, win) in windows {
                    if label.starts_with("wallpaper_") {
                        let _ = win.emit_to(label.as_str(), event_name, serde_json::json!({ "target": "*" }));
                    }
                }
                let _ = app.emit(event_name, serde_json::json!({ "target": "*" }));
            }
        }
    });
}

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
fn pin_hwnd_as_wallpaper(hwnd: HWND, target_bounds: Option<(i32, i32, i32, i32)>) {
    if is_main_hwnd(hwnd) {
        let err = format!("[DIAG 10 CRITICAL REJECT] pin_hwnd_as_wallpaper was called with MAIN_HWND 0x{:X}! Aborting!", hwnd as usize);
        log_msg(&err);
        eprintln!("{}", err);
        return;
    }

    unsafe {
        log_msg(&format!("\n--- [AuraOS WP] pin_hwnd_as_wallpaper called: hwnd=0x{:X} ---",
            hwnd as usize));

        // ── Step 1: exact monitor bounds from target_bounds or Win32 ─────────
        let (mon_screen_x, mon_screen_y, mon_w, mon_h) = if let Some(bounds) = target_bounds {
            log_msg(&format!(
                "[AuraOS WP] Using target monitor bounds: ({},{}) {}x{}",
                bounds.0, bounds.1, bounds.2, bounds.3
            ));
            bounds
        } else {
            let monitor_handle = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
            let mut minfo: MONITORINFO = std::mem::zeroed();
            minfo.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
            GetMonitorInfoW(monitor_handle, &mut minfo);

            let rc = minfo.rcMonitor;
            let x = rc.left;
            let y = rc.top;
            let w = rc.right  - rc.left;
            let h = rc.bottom - rc.top;
            log_msg(&format!(
                "[AuraOS WP] Monitor rcMonitor: left={} top={} right={} bottom={} ({}x{})",
                x, y, rc.right, rc.bottom, w, h
            ));
            (x, y, w, h)
        };

        let vscreen_x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let vscreen_y = GetSystemMetrics(SM_YVIRTUALSCREEN);

        log_msg(&format!(
            "[AuraOS WP] Monitor screen bounds: ({},{}) {}x{}",
            mon_screen_x, mon_screen_y, mon_w, mon_h
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
        let mut progman = FindWindowW(progman_class.as_ptr(), progman_title.as_ptr());
        if progman.is_null() {
            progman = FindWindowW(progman_class.as_ptr(), std::ptr::null());
        }
        if progman.is_null() {
            progman = GetShellWindow();
        }

        if progman.is_null() {
            log_msg("[AuraOS WP] Progman not ready on first attempt (cold boot / reboot). Waiting for Explorer...");
            for attempt in 0..30 {
                std::thread::sleep(std::time::Duration::from_millis(200));
                progman = FindWindowW(progman_class.as_ptr(), progman_title.as_ptr());
                if progman.is_null() {
                    progman = FindWindowW(progman_class.as_ptr(), std::ptr::null());
                }
                if progman.is_null() {
                    progman = GetShellWindow();
                }
                if !progman.is_null() {
                    log_msg(&format!("[AuraOS WP] Found Progman on cold boot retry #{} ({}ms): 0x{:X}", attempt + 1, (attempt + 1) * 200, progman as usize));
                    break;
                }
            }
        }

        let progman = if !progman.is_null() {
            progman
        } else {
            log_msg("[AuraOS WP] CRITICAL: Cannot find Progman or ShellWindow after retry timeout!");
            
            // HWND_BOTTOM fallback — use exact monitor screen coords directly
            // (no SetParent, so screen coordinates apply as-is).
            log_msg(&format!("[AuraOS WP] HWND_BOTTOM fallback: pos=({},{}) size={}x{}",
                mon_screen_x, mon_screen_y, mon_w, mon_h));
            let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
            let new_style = (style | WS_VISIBLE) & !(WS_CAPTION | WS_THICKFRAME | WS_BORDER);
            SetWindowLongW(hwnd, GWL_STYLE, new_style as i32);
            SetWindowPos(hwnd, 1 as HWND, mon_screen_x, mon_screen_y, mon_w, mon_h,
                SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED);
            return;
        };
        
        log_msg(&format!("[AuraOS WP] Using progman HWND = 0x{:X}", progman as usize));

        let shell_class: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
        let worker_class: Vec<u16> = "WorkerW\0".encode_utf16().collect();

        // Check if Progman has WS_EX_NOREDIRECTIONBITMAP (Windows 11 raised desktop mode)
        let prog_ex = GetWindowLongW(progman, GWL_EXSTYLE) as u32;
        let is_raised_desktop = (prog_ex & 0x00200000) != 0;
        log_msg(&format!("[AuraOS WP] Progman exStyle=0x{:08X}, is_raised_desktop={}", prog_ex, is_raised_desktop));

        // Always send 0x052C to progman on Windows so Explorer splits the desktop layer on cold boot
        log_msg("[AuraOS WP] Sending 0x052C to progman (wParam=0x0D lParam=0x1)...");
        SendMessageTimeoutW(progman, 0x052C, 0x0D, 0x1, SMTO_NORMAL, 1000, std::ptr::null_mut());
        std::thread::sleep(std::time::Duration::from_millis(100));

        let progman_shell = FindWindowExW(progman, std::ptr::null_mut(), shell_class.as_ptr(), std::ptr::null());
        log_msg(&format!("[AuraOS WP] SHELLDLL_DefView under Progman = 0x{:X}", progman_shell as usize));
        if !progman_shell.is_null() {
            state.shell = progman_shell;
        } else {
            for attempt in 0..5usize {
                EnumWindows(Some(enum_window), &mut state as *mut DesktopWindows as LPARAM);
                if !state.shell.is_null() {
                    log_msg(&format!("[AuraOS WP] SHELLDLL_DefView found on attempt {}", attempt + 1));
                    break;
                }
                if attempt < 4 {
                    std::thread::sleep(std::time::Duration::from_millis(80));
                }
            }
        }

        // In Windows 11 raised desktop, WorkerW is created as a child of Progman
        let child_workerw = FindWindowExW(progman, std::ptr::null_mut(), worker_class.as_ptr(), std::ptr::null());
        if !child_workerw.is_null() {
            state.workerw = child_workerw;
            log_msg(&format!("[AuraOS WP] Found child WorkerW under Progman: 0x{:X}", child_workerw as usize));
            // Move child WorkerW to HWND_BOTTOM so Explorer's static wallpaper never draws over our live wallpaper
            SetWindowPos(child_workerw, 1 as HWND, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
        }

        log_msg(&format!("[AuraOS WP] After enum: workerw=0x{:X} shell=0x{:X}",
            state.workerw as usize, state.shell as usize));

        let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
        let new_style = (style | WS_CHILD | WS_VISIBLE) & !(WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_BORDER);
        SetWindowLongW(hwnd, GWL_STYLE, new_style as i32);
        
        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        // Strip 3D non-client borders and frames (WS_EX_WINDOWEDGE, WS_EX_CLIENTEDGE, etc.)
        let new_ex_style = (ex_style | WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE) & !(0x00000100 | 0x00000200 | 0x00000001 | 0x00020000);
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

        let parent_hwnd = if is_raised_desktop || !progman_shell.is_null() {
            log_msg(&format!("[AuraOS WP] MODE: Raised Desktop — parent = Progman 0x{:X}", progman as usize));
            progman
        } else if !state.workerw.is_null() {
            log_msg(&format!("[AuraOS WP] MODE: Standard Desktop — parent = WorkerW 0x{:X}", state.workerw as usize));
            state.workerw
        } else {
            log_msg(&format!("[AuraOS WP] MODE: Fallback — parent = Progman 0x{:X}", progman as usize));
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

        // ── Measure the non-client frame insets dynamically ─────────────────
        // We map the client area's (0,0) to screen coordinates and compare with
        // the outer window rect to determine the exact top, left, right, bottom padding.
        let mut pre_wr: RECT = std::mem::zeroed();
        let mut pre_cr: RECT = std::mem::zeroed();
        GetWindowRect(hwnd, &mut pre_wr);
        GetClientRect(hwnd, &mut pre_cr);

        let mut client_origin = [POINT { x: 0, y: 0 }];
        MapWindowPoints(hwnd, std::ptr::null_mut(), client_origin.as_mut_ptr(), 1);

        let left_frame = client_origin[0].x - pre_wr.left;
        let top_frame = client_origin[0].y - pre_wr.top;
        let right_frame = pre_wr.right - (client_origin[0].x + pre_cr.right);
        let bottom_frame = pre_wr.bottom - (client_origin[0].y + pre_cr.bottom);

        log_msg(&format!(
            "[AuraOS WP] Measured frame insets: left={}, top={}, right={}, bottom={}",
            left_frame, top_frame, right_frame, bottom_frame
        ));
        log_msg(&format!(
            "[AuraOS WP] Pre-positioning: WinRect=({},{})-({},{}) [{}x{}], ClientScreen=({},{})",
            pre_wr.left, pre_wr.top, pre_wr.right, pre_wr.bottom,
            pre_wr.right - pre_wr.left, pre_wr.bottom - pre_wr.top,
            client_origin[0].x, client_origin[0].y
        ));

        // Use measured insets if plausible (0..50px), otherwise 0
        let pad_left = if (0..50).contains(&left_frame) { left_frame } else { 0 };
        let pad_top = if (0..50).contains(&top_frame) { top_frame } else { 0 };
        let pad_right = if (0..50).contains(&right_frame) { right_frame } else { 0 };
        let pad_bottom = if (0..50).contains(&bottom_frame) { bottom_frame } else { 0 };

        let adj_x = client_x - pad_left;
        let adj_y = client_y - pad_top;
        let adj_w = mon_w + pad_left + pad_right;
        let adj_h = mon_h + pad_top + pad_bottom;

        log_msg(&format!(
            "[AuraOS WP] Target client pos=({},{}) size={}x{} -> HWND pos=({},{}) size={}x{}",
            client_x, client_y, mon_w, mon_h,
            adj_x, adj_y, adj_w, adj_h
        ));

        // ── Z-Order Management ───────────────────────────────────────────────
        // The wallpaper must be BEHIND desktop icons (SHELLDLL_DefView) but
        // ABOVE the bare desktop wallpaper background.
        // If parent is Progman and state.shell is SHELLDLL_DefView, placing our
        // window behind state.shell (hWndInsertAfter = state.shell) guarantees
        // icons remain in front of the live wallpaper.
        let insert_after = if !state.shell.is_null() && parent_hwnd == progman {
            log_msg(&format!("[AuraOS WP] Z-order: placing directly behind SHELLDLL_DefView 0x{:X}", state.shell as usize));
            state.shell
        } else {
            log_msg("[AuraOS WP] Z-order: using HWND_BOTTOM");
            HWND_BOTTOM
        };

        SetWindowPos(
            hwnd,
            insert_after,
            adj_x, adj_y,
            adj_w, adj_h,
            SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
        );

        // Clip the window region strictly to the monitor client rectangle so non-client frame padding
        // never spills across monitor boundaries onto adjacent screens
        if pad_left > 0 || pad_right > 0 || pad_top > 0 || pad_bottom > 0 {
            let rgn = CreateRectRgn(
                pad_left,
                pad_top,
                pad_left + mon_w,
                pad_top + mon_h,
            );
            SetWindowRgn(hwnd, rgn, 1);
            log_msg(&format!(
                "[AuraOS WP] SetWindowRgn: clipped non-client frame to ({},{})-({},{})",
                pad_left, pad_top, pad_left + mon_w, pad_top + mon_h
            ));
        } else {
            SetWindowRgn(hwnd, std::ptr::null_mut(), 1);
        }

        // Ensure child WorkerW (if present under Progman) stays at HWND_BOTTOM
        // so Explorer's static wallpaper bitmap never draws over our live wallpaper!
        if !state.workerw.is_null() && parent_hwnd == progman {
            SetWindowPos(
                state.workerw,
                1 as HWND, // HWND_BOTTOM
                0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );
        }

        // Force immediate DWM composition update and desktop client area invalidation
        InvalidateRect(hwnd, std::ptr::null(), 1);
        UpdateWindow(hwnd);
        RedrawWindow(
            hwnd,
            std::ptr::null(),
            std::ptr::null_mut(),
            RDW_INVALIDATE | RDW_UPDATENOW | RDW_ERASE | RDW_ALLCHILDREN,
        );

        // Verification log: measure resulting client screen coordinates
        let mut final_wr: RECT = std::mem::zeroed();
        let mut final_cr: RECT = std::mem::zeroed();
        GetWindowRect(hwnd, &mut final_wr);
        GetClientRect(hwnd, &mut final_cr);
        let mut final_client_screen = [POINT { x: 0, y: 0 }];
        MapWindowPoints(hwnd, std::ptr::null_mut(), final_client_screen.as_mut_ptr(), 1);

        log_msg(&format!(
            "[AuraOS WP] POST-POSITION HWND WinRect: ({},{})-({},{}) [{}x{}]",
            final_wr.left, final_wr.top, final_wr.right, final_wr.bottom,
            final_wr.right - final_wr.left, final_wr.bottom - final_wr.top
        ));
        log_msg(&format!(
            "[AuraOS WP] POST-POSITION ClientRect: [{}x{}], ScreenOrigin: ({},{}) vs MonitorOrigin: ({},{})",
            final_cr.right, final_cr.bottom,
            final_client_screen[0].x, final_client_screen[0].y,
            mon_screen_x, mon_screen_y
        ));
        log_msg("[AuraOS WP] pin_hwnd_as_wallpaper complete.");
        let host_summary = format!(
            "[WALLPAPER HOST]\nparent HWND: 0x{:X}\nWebView controller created: true\nattached to WorkerW: 0x{:X}\nSetWindowPos: ({}, {}) [{} x {}]\nshown: true",
            parent_hwnd as usize,
            parent_hwnd as usize,
            adj_x, adj_y, adj_w, adj_h
        );
        log_msg(&host_summary);
        println!("{}", host_summary);

        // Reassert main window visibility so it is never obscured by the desktop wallpaper
        if let Some(main_h) = get_main_hwnd() {
            if IsWindow(main_h) != 0 && IsWindowVisible(main_h) != 0 {
                SetWindowPos(main_h, 0 as HWND, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
            }
        }
    }
}

// ─── Helper: open or create the wallpaper window ─────────────────────────────

fn get_monitor_label(name: &str) -> String {
    format!("wallpaper_{}", name.replace("\\", "").replace(".", "_").replace(" ", "_"))
}

#[derive(Clone, PartialEq, Eq, Debug)]
struct MonSnapshot {
    name: String,
    x: i32,
    y: i32,
    w: u32,
    h: u32,
}

fn get_monitors_snapshot(app: &AppHandle) -> Vec<MonSnapshot> {
    app.available_monitors()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|m| {
            m.name().map(|name| MonSnapshot {
                name: name.to_string(),
                x: m.position().x,
                y: m.position().y,
                w: m.size().width,
                h: m.size().height,
            })
        })
        .collect()
}

fn log_wallpaper_state(app: &AppHandle, monitor_count: usize) {
    let mut wallpaper_windows = Vec::new();
    for (label, win) in app.webview_windows() {
        if label.starts_with("wallpaper_") {
            wallpaper_windows.push((label, win));
        }
    }
    let host_count = wallpaper_windows.len();

    let mut state_log = format!(
        "\n[WALLPAPER STATE]\nmonitor count = {}\nwallpaper host count = {}",
        monitor_count, host_count
    );

    #[cfg(windows)]
    for (label, win) in &wallpaper_windows {
        if let Ok(hwnd) = win.hwnd() {
            let raw_hwnd = hwnd.0 as HWND;
            unsafe {
                let mut wr: RECT = std::mem::zeroed();
                GetWindowRect(raw_hwnd, &mut wr);
                let parent = GetParent(raw_hwnd);
                let is_vis = IsWindowVisible(raw_hwnd) != 0;

                state_log.push_str(&format!(
                    "\nHWND = 0x{:X}\nmonitor ID = {}\nGetWindowRect = left={} top={} right={} bottom={} ({}x{})\nparent HWND = 0x{:X}\nvisible = {}",
                    raw_hwnd as usize,
                    label,
                    wr.left, wr.top, wr.right, wr.bottom,
                    wr.right - wr.left, wr.bottom - wr.top,
                    parent as usize,
                    is_vis
                ));
            }
        }
    }

    log_msg(&state_log);
    println!("{}", state_log);

    if monitor_count != host_count {
        let warn_msg = format!(
            "[WALLPAPER STATE WARNING] Invariant violated: monitor count ({}) != wallpaper host count ({})",
            monitor_count, host_count
        );
        log_msg(&warn_msg);
        eprintln!("{}", warn_msg);
    } else {
        log_msg("[WALLPAPER STATE] Invariant verified: wallpaper host count == monitor count.");
        println!("[WALLPAPER STATE] Invariant verified: wallpaper host count == monitor count.");
    }
}

fn reconcile_wallpaper_windows(app: &AppHandle) {
    let monitors = app.available_monitors().unwrap_or_default();
    let current_count = monitors.len();

    // 1. Build set of valid labels for currently connected monitors
    let mut valid_labels = std::collections::HashSet::new();
    for m in &monitors {
        if let Some(name) = m.name() {
            valid_labels.insert(get_monitor_label(name));
        }
    }

    // 2. Destroy wallpaper windows ONLY for monitors that no longer exist
    let active_windows = app.webview_windows();
    for (label, win) in active_windows {
        if label.starts_with("wallpaper_") && !valid_labels.contains(&label) {
            log_msg(&format!("[RECONCILIATION] Destroying wallpaper host for disconnected monitor: {}", label));
            println!("[RECONCILIATION] Destroying wallpaper host for disconnected monitor: {}", label);

            #[cfg(windows)]
            if let Ok(hwnd) = win.hwnd() {
                let raw_hwnd = hwnd.0 as HWND;
                unsafe {
                    if IsWindow(raw_hwnd) != 0 {
                        ShowWindow(raw_hwnd, 0); // SW_HIDE
                        SetParent(raw_hwnd, std::ptr::null_mut());
                        DestroyWindow(raw_hwnd);
                    }
                }
            }
            let _ = win.destroy();

            if let Ok(mut guard) = ACTIVE_WALLPAPERS.lock() {
                if let Some(ref mut map) = *guard {
                    map.remove(&label);
                }
            }

            if let Ok(mut mpv_guard) = MPV_PLAYERS.lock() {
                if let Some(ref mut map) = *mpv_guard {
                    if let Some(mut player) = map.remove(&label) {
                        player.terminate();
                    }
                }
            }
        }
    }

    // 3. Reconcile existing valid hosts or create new ones
    for monitor in &monitors {
        if let Some(name) = monitor.name() {
            let label = get_monitor_label(name);

            let size = monitor.size();
            let pos = monitor.position();
            let scale = monitor.scale_factor();
            let logical_w = size.width as f64 / scale;
            let logical_h = size.height as f64 / scale;
            let logical_x = pos.x as f64 / scale;
            let logical_y = pos.y as f64 / scale;

            if let Some(win) = app.get_webview_window(&label) {
                // EXISTING MONITOR: Recalculate using current rcMonitor, re-pin, update z-order & repaint
                log_msg(&format!(
                    "[RECONCILIATION] Re-aligning existing wallpaper host for {}: pos=({},{}) size={}x{}",
                    name, pos.x, pos.y, size.width, size.height
                ));
                println!(
                    "[RECONCILIATION] Re-aligning existing wallpaper host for {}: pos=({},{}) size={}x{}",
                    name, pos.x, pos.y, size.width, size.height
                );

                let _ = win.set_size(tauri::LogicalSize::new(logical_w, logical_h));
                let _ = win.set_position(tauri::LogicalPosition::new(logical_x, logical_y));

                #[cfg(windows)]
                {
                    let mut raw_hwnd_opt = None;
                    for _ in 0..20 {
                        if let Ok(hwnd) = win.hwnd() {
                            raw_hwnd_opt = Some(hwnd.0 as HWND);
                            break;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(40));
                    }
                    if let Some(raw_hwnd) = raw_hwnd_opt {
                        pin_hwnd_as_wallpaper(raw_hwnd, Some((pos.x, pos.y, size.width as i32, size.height as i32)));
                    }
                }
            } else {
                // NEW MONITOR: Create host using the exact working startup path
                let new_mon_log = format!(
                    "\n[NEW MONITOR]\nstable ID: {}\nrcMonitor: left={} top={} right={} bottom={} ({}x{})",
                    name, pos.x, pos.y, pos.x + size.width as i32, pos.y + size.height as i32, size.width, size.height
                );
                log_msg(&new_mon_log);
                println!("{}", new_mon_log);

                let yt_css_hide_script = r#"
(function() {
    function hideElements() {
        try {
            var host = window.location.hostname || '';
            if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
                var styleId = 'aetherflow-yt-hide-ui';
                if (!document.getElementById(styleId)) {
                    var s = document.createElement('style');
                    s.id = styleId;
                    s.textContent = `
                        .ytp-bezel,
                        .ytp-bezel-icon,
                        .ytp-bezel-text,
                        .ytp-large-play-button,
                        .ytp-pause-overlay,
                        .ytp-endscreen-content,
                        .ytp-ce-element,
                        .ytp-chrome-top,
                        .ytp-chrome-bottom,
                        .ytp-gradient-top,
                        .ytp-gradient-bottom,
                        .ytp-spinner {
                            display: none !important;
                            opacity: 0 !important;
                            visibility: hidden !important;
                            pointer-events: none !important;
                        }
                    `;
                    (document.head || document.documentElement).appendChild(s);
                }
            }
        } catch (e) {}
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideElements);
    } else {
        hideElements();
    }
    setInterval(hideElements, 1000);
})();
"#;

                let win_res = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("wallpaper.html".into()))
                    .title(&format!("AetherFlow Wallpaper - {}", name))
                    .decorations(false)
                    .transparent(true)
                    .visible(false)
                    .skip_taskbar(true)
                    .resizable(false)
                    .inner_size(logical_w, logical_h)
                    .position(logical_x, logical_y)
                    .initialization_script(yt_css_hide_script)
                    .build();

                match win_res {
                    Ok(win) => {
                        #[cfg(windows)]
                        {
                            let mut raw_hwnd_opt = None;
                            for _ in 0..25 {
                                if let Ok(hwnd) = win.hwnd() {
                                    raw_hwnd_opt = Some(hwnd.0 as HWND);
                                    break;
                                }
                                std::thread::sleep(std::time::Duration::from_millis(40));
                            }
                            if let Some(raw_hwnd) = raw_hwnd_opt {
                                let host_log = format!(
                                    "\n[WALLPAPER HOST]\nHWND created: 0x{:X}\nWebView2 created: true",
                                    raw_hwnd as usize
                                );
                                log_msg(&host_log);
                                println!("{}", host_log);

                                pin_hwnd_as_wallpaper(raw_hwnd, Some((pos.x, pos.y, size.width as i32, size.height as i32)));
                                let _ = win.show();
                            }
                        }
                    }
                    Err(err) => {
                        let err_log = format!("\n[WALLPAPER HOST] ERROR creating window for {}: {}", name, err);
                        log_msg(&err_log);
                        eprintln!("{}", err_log);
                    }
                }
            }
        }
    }

    // 4. Log verified wallpaper state
    log_wallpaper_state(app, current_count);
}

#[cfg(windows)]
fn trim_process_working_set() {
    unsafe {
        windows_sys::Win32::System::ProcessStatus::EmptyWorkingSet(
            windows_sys::Win32::System::Threading::GetCurrentProcess()
        );
    }
}

#[cfg(not(windows))]
fn trim_process_working_set() {}

fn ensure_wallpaper_windows(app: &AppHandle) {
    reconcile_wallpaper_windows(app);
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
/// 'aura:set-engine' to the wallpaper WebView so it boots the canvas engine,
/// or launches MPV for video wallpapers.
#[tauri::command]
async fn apply_wallpaper(
    app: AppHandle,
    engine_id: String,
    config: serde_json::Value,
    opacity: f64,
    brightness: f64,
    monitor_label: Option<String>,
) {
    let target = monitor_label.unwrap_or_else(|| "*".to_string());

    let resolved_engine_id = if engine_id == "video-player" || engine_id == "image-player" {
        engine_id.clone()
    } else if config.get("videoPath").and_then(|v| v.as_str()).is_some() {
        "video-player".to_string()
    } else if config.get("imagePath").and_then(|v| v.as_str()).is_some() {
        "image-player".to_string()
    } else {
        engine_id.clone()
    };

    // Record desired state per monitor for immediate recovery upon window mount
    if let Ok(mut guard) = ACTIVE_WALLPAPERS.lock() {
        let map = guard.get_or_insert_with(HashMap::new);
        map.insert(target.clone(), ActiveWallpaperState {
            engine_id: resolved_engine_id.clone(),
            config: config.clone(),
            opacity,
            brightness,
        });
    }

    #[cfg(windows)]
    let (main_h_usize, main_parent_before) = if let Some(main_h) = get_main_hwnd() {
        unsafe { (main_h as usize, GetParent(main_h) as usize) }
    } else {
        (0, 0)
    };
    #[cfg(windows)]
    {
        let msg = format!("[DIAG 1 & 4] Main AuraOS HWND: 0x{:X}, Parent before apply: 0x{:X}", main_h_usize, main_parent_before);
        log_msg(&msg);
        println!("{}", msg);
    }

    let video_path_opt = config.get("videoPath").and_then(|v| v.as_str()).map(|s| s.to_string());
    let wants_video = mpv::is_video_wallpaper(&resolved_engine_id, video_path_opt.as_deref());
    let is_video = wants_video && mpv::find_mpv_binary().is_ok();

    let monitors = app.available_monitors().unwrap_or_default();
    let global_muted = config.get("muted").and_then(|v| v.as_bool()).unwrap_or(false);
    let global_volume = config.get("volume").and_then(|v| v.as_f64()).unwrap_or(50.0);

    if is_video {
        let vpath = match video_path_opt {
            Some(p) => p,
            None => {
                eprintln!("[MPV ERROR] Video wallpaper requested but videoPath is missing in config");
                return;
            }
        };

        let speed_val = config.get("speedMultiplier").and_then(|v| v.as_f64()).or_else(|| config.get("speed").and_then(|v| v.as_f64())).unwrap_or(1.0);
        let _fps_val = config.get("fps").and_then(|v| v.as_f64()).unwrap_or(60.0);
        let is_duplicated = target == "*";
        let mut audio_assigned = false;

        for (idx, mon) in monitors.iter().enumerate() {
            if let Some(name) = mon.name() {
                let label = get_monitor_label(name);
                if !is_duplicated && target != label {
                    continue;
                }

                // In duplicated mode, ONLY the primary screen (or first screen) plays audio.
                // Secondary screens MUST be muted to prevent echo / out-of-sync audio!
                let is_primary = mon.position().x == 0 && mon.position().y == 0;
                let screen_muted = if global_muted {
                    true
                } else if is_duplicated {
                    if (is_primary || idx == 0) && !audio_assigned {
                        audio_assigned = true;
                        false
                    } else {
                        true // Secondary duplicate screen -> Mute audio!
                    }
                } else {
                    false
                };
                let screen_volume = if screen_muted { 0.0 } else { global_volume };

                // 1. Hide the canvas WebviewWindow for this monitor to release decoding & GPU
                if let Some(win) = app.get_webview_window(&label) {
                    let _ = win.emit_to(label.as_str(), "aura:stop", serde_json::json!({ "target": label.clone() }));
                    let _ = win.hide();
                }
                trim_process_working_set();

                // 2. Terminate existing MPV on this monitor
                if let Ok(mut mpv_guard) = MPV_PLAYERS.lock() {
                    if let Some(ref mut map) = *mpv_guard {
                        if let Some(mut existing) = map.remove(&label) {
                            existing.terminate();
                        }
                    }
                }

                let pos = mon.position();
                let size = mon.size();

                #[cfg(windows)]
                {
                    let label_clone = label.clone();
                    let vpath_clone = vpath.clone();
                    let mon_x = pos.x;
                    let mon_y = pos.y;
                    let mon_w = size.width as i32;
                    let mon_h = size.height as i32;
                    let brightness_val = brightness;
                    let opacity_val = opacity;

                    tauri::async_runtime::spawn_blocking(move || {
                        match mpv::spawn_mpv_wallpaper(
                            &vpath_clone,
                            &label_clone,
                            mon_x,
                            mon_y,
                            mon_w,
                            mon_h,
                            Some(screen_volume),
                            Some(screen_muted),
                            Some(speed_val),
                            Some(brightness_val),
                            Some(opacity_val),
                        ) {
                            Ok(proc) => {
                                let hwnd = proc.hwnd as HWND;
                                if !hwnd.is_null() {
                                    pin_hwnd_as_wallpaper(hwnd, Some((mon_x, mon_y, mon_w, mon_h)));
                                }
                                let msg = format!("[MPV] Successfully assigned MPV video wallpaper to {} (HWND=0x{:X}, vol={}, muted={}, speed={}, br={}, op={})", 
                                    label_clone, proc.hwnd, screen_volume, screen_muted, speed_val, brightness_val, opacity_val);
                                log_msg(&msg);
                                println!("{}", msg);
                                if let Ok(mut mpv_guard) = MPV_PLAYERS.lock() {
                                    let map = mpv_guard.get_or_insert_with(HashMap::new);
                                    map.insert(label_clone, proc);
                                }
                            }
                            Err(err) => {
                                let err_msg = format!("[MPV ERROR] Failed to spawn MPV on {}: {}", label_clone, err);
                                log_msg(&err_msg);
                                eprintln!("{}", err_msg);
                            }
                        }
                    });
                }
            }
        }
    } else {
        ensure_wallpaper_windows(&app);
        // Canvas engine -> Route to WebView2 window
        // 1. Terminate any MPV instances
        if let Ok(mut mpv_guard) = MPV_PLAYERS.lock() {
            if let Some(ref mut map) = *mpv_guard {
                if target == "*" {
                    for (_, mut proc) in map.drain() {
                        proc.terminate();
                    }
                } else if let Some(mut proc) = map.remove(&target) {
                    proc.terminate();
                }
            }
        }
        if target == "*" {
            mpv::kill_all_mpv_processes();
        }

        let fps_val = config.get("fps").and_then(|v| v.as_f64()).unwrap_or(60.0);

        // 2. Show canvas webview windows and send engine events
        let windows = app.webview_windows();
        let mut audio_assigned = false;
        for (label, win) in windows {
            if label.starts_with("wallpaper_") && (target == "*" || target == label) {
                let _ = win.set_ignore_cursor_events(true);
                let _ = win.show();

                #[cfg(windows)]
                if let Ok(raw_hwnd) = win.hwnd() {
                    let hwnd = raw_hwnd.0 as HWND;
                    let mon_bounds = monitors.iter().find_map(|m| {
                        if let Some(name) = m.name() {
                            if get_monitor_label(name) == label {
                                let pos = m.position();
                                let size = m.size();
                                return Some((pos.x, pos.y, size.width as i32, size.height as i32));
                            }
                        }
                        None
                    });
                    log_msg(&format!(
                        "[AuraOS WP] Re-pinning and clipping wallpaper window {} (HWND=0x{:X}) after unhide: {:?}",
                        label, hwnd as usize, mon_bounds
                    ));
                    pin_hwnd_as_wallpaper(hwnd, mon_bounds);
                }

                // In duplicated / all screens mode, ONLY the primary screen (or first screen) plays audio.
                // Secondary screens MUST be muted to prevent echo / out-of-sync audio, exactly like MPV!
                let is_primary = monitors.iter().find(|m| {
                    if let Some(name) = m.name() {
                        get_monitor_label(name) == label && m.position().x == 0 && m.position().y == 0
                    } else {
                        false
                    }
                }).is_some();

                let screen_muted = if global_muted {
                    true
                } else if target == "*" {
                    if (is_primary || label == "wallpaper_0") && !audio_assigned {
                        audio_assigned = true;
                        false
                    } else {
                        true // Secondary duplicate screen -> Mute audio!
                    }
                } else {
                    global_muted
                };
                let screen_volume = if screen_muted { 0.0 } else { global_volume };

                let mut win_config = config.clone();
                if let Some(obj) = win_config.as_object_mut() {
                    obj.insert("muted".to_string(), serde_json::json!(screen_muted));
                    obj.insert("volume".to_string(), serde_json::json!(screen_volume));
                    obj.insert("isSecondary".to_string(), serde_json::json!(screen_muted));
                }

                let payload = serde_json::json!({
                    "engineId": resolved_engine_id.clone(),
                    "config": win_config,
                    "target": target.clone(),
                });
                let _ = win.emit("aura:set-engine", payload.clone());
                let _ = win.emit_to(label.as_str(), "aura:set-engine", payload.clone());
                let _ = app.emit("aura:set-engine", payload.clone());
                let _ = win.emit("aura:set-brightness", serde_json::json!({ "brightness": brightness, "target": target.clone() }));
                let _ = win.emit_to(label.as_str(), "aura:set-brightness", serde_json::json!({ "brightness": brightness, "target": target.clone() }));
                let _ = win.emit("aura:set-opacity", serde_json::json!({ "opacity": opacity, "target": target.clone() }));
                let _ = win.emit_to(label.as_str(), "aura:set-opacity", serde_json::json!({ "opacity": opacity, "target": target.clone() }));
                let _ = win.emit("aura:set-fps", serde_json::json!({ "fps": fps_val, "target": target.clone() }));
                let _ = win.emit_to(label.as_str(), "aura:set-fps", serde_json::json!({ "fps": fps_val, "target": target.clone() }));
            }
        }
    }

    // [DIAG 5] Check Main HWND parent after apply
    #[cfg(windows)]
    if let Some(main_h) = get_main_hwnd() {
        unsafe {
            let parent_after = GetParent(main_h);
            let msg = format!("[DIAG 5] Main AuraOS HWND: 0x{:X}, Parent AFTER apply: 0x{:X} (Expected 0x0)", main_h as usize, parent_after as usize);
            log_msg(&msg);
            println!("{}", msg);
            if parent_after != std::ptr::null_mut() {
                let err = format!("[DIAG 5 CRITICAL ERROR] Main HWND was reparented to 0x{:X}! Restoring to desktop root!", parent_after as usize);
                log_msg(&err);
                eprintln!("{}", err);
                SetParent(main_h, std::ptr::null_mut());
            }
            ShowWindow(main_h, 9); // SW_RESTORE
            SetForegroundWindow(main_h);
        }
    }

    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.unminimize();
        let _ = main_win.show();
        let _ = main_win.set_focus();
    }

    // Immediately schedule a delayed working set compaction after switching wallpapers
    #[cfg(windows)]
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_millis(600));
        trim_all_process_memory();
    });
}

/// Stop the active wallpaper and clear active state.
#[tauri::command]
fn stop_wallpaper(app: AppHandle, monitor_label: Option<String>) {
    let target = monitor_label.unwrap_or_else(|| "*".to_string());
    if let Ok(mut guard) = ACTIVE_WALLPAPERS.lock() {
        if let Some(ref mut map) = *guard {
            if target == "*" {
                map.clear();
            } else {
                map.remove(&target);
            }
        }
    }

    // Terminate any MPV instances for target monitor(s)
    if let Ok(mut mpv_guard) = MPV_PLAYERS.lock() {
        if let Some(ref mut map) = *mpv_guard {
            if target == "*" {
                for (_, mut proc) in map.drain() {
                    proc.terminate();
                }
            } else if let Some(mut proc) = map.remove(&target) {
                proc.terminate();
            }
        }
    }
    if target == "*" {
        mpv::kill_all_mpv_processes();
    }

    let windows = app.webview_windows();
    for (label, win) in windows {
        if label.starts_with("wallpaper_") && (target == "*" || target == label) {
            let payload = serde_json::json!({ "target": target.clone() });
            let _ = win.emit_to(label.as_str(), "aura:stop", payload);
            let _ = win.hide();
        }
    }

    #[cfg(windows)]
    if let Some(main_h) = get_main_hwnd() {
        unsafe {
            let parent_after = GetParent(main_h);
            log_msg(&format!("[DIAG 5] Main AuraOS HWND: 0x{:X}, Parent AFTER stop: 0x{:X}", main_h as usize, parent_after as usize));
        }
    }

    #[cfg(windows)]
    trim_all_process_memory();
}

#[tauri::command]
fn set_mpv_pause(monitor_label: Option<String>, paused: bool) {
    let target = monitor_label.unwrap_or_else(|| "*".to_string());
    if let Ok(mpv_guard) = MPV_PLAYERS.lock() {
        if let Some(ref map) = *mpv_guard {
            for (label, proc) in map {
                if target == "*" || target == *label {
                    let _ = proc.set_pause(paused);
                }
            }
        }
    }
}

#[tauri::command]
fn set_mpv_volume(monitor_label: Option<String>, volume: f64) {
    let target = monitor_label.unwrap_or_else(|| "*".to_string());
    if let Ok(mpv_guard) = MPV_PLAYERS.lock() {
        if let Some(ref map) = *mpv_guard {
            for (label, proc) in map {
                if target == "*" || target == *label {
                    let _ = proc.set_volume(volume);
                }
            }
        }
    }
}

#[tauri::command]
fn set_mpv_mute(monitor_label: Option<String>, muted: bool) {
    let target = monitor_label.unwrap_or_else(|| "*".to_string());
    if let Ok(mpv_guard) = MPV_PLAYERS.lock() {
        if let Some(ref map) = *mpv_guard {
            let mut first = true;
            for (label, proc) in map {
                if target == "*" {
                    if muted {
                        let _ = proc.set_mute(true);
                    } else {
                        // In duplicated mode, only unmute the first/primary monitor to avoid audio echo
                        if first {
                            let _ = proc.set_mute(false);
                            first = false;
                        } else {
                            let _ = proc.set_mute(true);
                        }
                    }
                } else if target == *label {
                    let _ = proc.set_mute(muted);
                }
            }
        }
    }
}

fn get_custom_wallpapers_file(app: &AppHandle) -> std::path::PathBuf {
    let base = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let _ = std::fs::create_dir_all(&base);
    let primary = base.join("custom_wallpapers.json");
    if primary.exists() {
        return primary;
    }

    // AppData fallback check for existing installations
    if let Ok(appdata) = std::env::var("APPDATA") {
        let appdata_path = std::path::PathBuf::from(appdata);
        let fallbacks = [
            appdata_path.join("com.aetherflow.app").join("custom_wallpapers.json"),
            appdata_path.join("com.aetherflow.dev").join("custom_wallpapers.json"),
            appdata_path.join("aetherflow").join("custom_wallpapers.json"),
            appdata_path.join("com.auraos.dev").join("custom_wallpapers.json"),
            appdata_path.join("com.auraos.app").join("custom_wallpapers.json"),
            appdata_path.join("auraos").join("custom_wallpapers.json"),
        ];
        for fb in fallbacks {
            if fb.exists() {
                return fb;
            }
        }
    }
    primary
}

#[tauri::command]
fn save_custom_wallpapers(app: AppHandle, wallpapers: Vec<serde_json::Value>) -> Result<(), String> {
    let path = get_custom_wallpapers_file(&app);
    let mut merged_map: std::collections::BTreeMap<String, serde_json::Value> = std::collections::BTreeMap::new();

    // Preserve existing wallpapers on disk so partial writes never wipe user's catalog
    if path.exists() {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(existing) = serde_json::from_str::<Vec<serde_json::Value>>(&data) {
                for item in existing {
                    if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
                        merged_map.insert(id.to_string(), item);
                    }
                }
            }
        }
    }

    // Merge or update incoming wallpapers
    for item in wallpapers {
        if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
            merged_map.insert(id.to_string(), item);
        }
    }

    let merged_list: Vec<serde_json::Value> = merged_map.into_values().collect();
    let data = serde_json::to_string_pretty(&merged_list).map_err(|e| e.to_string())?;
    std::fs::write(path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_custom_wallpaper(app: AppHandle, id: String) -> Result<(), String> {
    let path = get_custom_wallpapers_file(&app);
    if path.exists() {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(existing) = serde_json::from_str::<Vec<serde_json::Value>>(&data) {
                let filtered: Vec<serde_json::Value> = existing
                    .into_iter()
                    .filter(|item| item.get("id").and_then(|v| v.as_str()) != Some(&id))
                    .collect();
                let new_data = serde_json::to_string_pretty(&filtered).map_err(|e| e.to_string())?;
                let _ = std::fs::write(path, new_data);
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn load_custom_wallpapers(app: AppHandle) -> Vec<serde_json::Value> {
    let path = get_custom_wallpapers_file(&app);
    if path.exists() {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(items) = serde_json::from_str::<Vec<serde_json::Value>>(&data) {
                if !items.is_empty() {
                    return items;
                }
            }
        }
    }

    // Auto-recovery: If no custom wallpapers exist yet in this storage, restore user's downloaded wallpapers
    let known_candidates = [
        ("C:\\Users\\Yashpreet_o7\\Downloads\\Sabrina Carpenter Kissing Screen Wallpaper 4K HD - Estawky (1080p, h264).mp4", "Sabrina Carpenter"),
        ("C:\\Users\\Yashpreet_o7\\Downloads\\elden-ring-throne-of-ashes-live-wallpaper-wallsflow-com.mp4", "Elden Ring - Throne of Ashes"),
        ("C:\\Users\\Yashpreet_o7\\Downloads\\goku-ultra-instinct_2.3840x2160.mp4", "Goku Ultra Instinct"),
        ("C:\\Users\\Yashpreet_o7\\Downloads\\kid-goku-on-kintoun.1920x1080.mp4", "Kid Goku on Kintoun"),
        ("C:\\Users\\Yashpreet_o7\\Downloads\\the-batman-monochrome-moewalls-com.mp4", "The Batman Monochrome"),
        ("C:\\Users\\Yashpreet_o7\\Downloads\\vegeta-ultra-ego.3840x2160.mp4", "Vegeta Ultra Ego"),
        ("C:\\Users\\Yashpreet_o7\\Downloads\\itachi-shillouette-in-front-of-the-red-moon.3840x2160.mp4", "Itachi Silhouette Red Moon"),
        ("C:\\Users\\Yashpreet_o7\\Downloads\\Furina - Coook Pardon!  Atoms 1M Funk  Viral Funk Dance Edit  Pc Wallpaper  Montagem S.mp4", "Furina - Viral Funk Dance"),
        ("C:\\Users\\Yashpreet_o7\\Downloads\\YTDown_YouTube_Animated-Wallpaper-Elden-Ring-Age-of-Sta_Media_yTZSTHmmO6w_002_720p.mp4", "Elden Ring - Age of Stars"),
    ];

    let mut recovered = Vec::new();
    for (idx, (vpath, vname)) in known_candidates.iter().enumerate() {
        if std::path::Path::new(vpath).exists() {
            recovered.push(serde_json::json!({
                "id": format!("local-{}", 1788800000000u64 + (idx as u64 * 1000)),
                "type": "wallpaper",
                "name": vname,
                "engine": "video-player",
                "config": {
                    "videoPath": vpath,
                    "speedMultiplier": 1
                },
                "tags": ["custom", "video"],
                "installedAt": "2026-09-08T00:00:00.000Z",
                "isCustom": true
            }));
        }
    }

    if !recovered.is_empty() {
        let _ = save_custom_wallpapers(app, recovered.clone());
    }

    recovered
}

/// Query active wallpaper state for a specific monitor window upon mounting
#[tauri::command]
fn get_monitor_active_wallpaper(label: String) -> Option<serde_json::Value> {
    if let Ok(guard) = ACTIVE_WALLPAPERS.lock() {
        if let Some(ref map) = *guard {
            let entry = map.get(&label).or_else(|| map.get("*"));
            if let Some(state) = entry {
                return Some(serde_json::json!({
                    "engineId": state.engine_id,
                    "config": state.config,
                    "opacity": state.opacity,
                    "brightness": state.brightness,
                }));
            }
        }
    }
    None
}

/// Hot-update the active engine config without restarting it.
#[tauri::command]
fn update_wallpaper_config(app: AppHandle, config: serde_json::Value, monitor_label: Option<String>) {
    let target = monitor_label.clone().unwrap_or_else(|| "*".to_string());
    if let Some(new_vpath) = config.get("videoPath").and_then(|v| v.as_str()) {
        if let Ok(mut mpv_guard) = MPV_PLAYERS.lock() {
            if let Some(ref mut map) = *mpv_guard {
                for (label, proc) in map.iter_mut() {
                    if target == "*" || target == *label {
                        let _ = proc.load_file(new_vpath);
                    }
                }
            }
        }
    }
    if let Some(spd) = config.get("speedMultiplier").and_then(|v| v.as_f64()).or_else(|| config.get("speed").and_then(|v| v.as_f64())) {
        if let Ok(mpv_guard) = MPV_PLAYERS.lock() {
            if let Some(ref map) = *mpv_guard {
                for (label, proc) in map {
                    if target == "*" || target == *label {
                        let _ = proc.set_speed(spd);
                    }
                }
            }
        }
    }
    if let Some(br) = config.get("brightness").and_then(|v| v.as_f64()) {
        if let Ok(mpv_guard) = MPV_PLAYERS.lock() {
            if let Some(ref map) = *mpv_guard {
                for (label, proc) in map {
                    if target == "*" || target == *label {
                        let _ = proc.set_brightness(br);
                    }
                }
            }
        }
    }
    #[cfg(windows)]
    if let Some(op) = config.get("opacity").and_then(|v| v.as_f64()) {
        if let Ok(mpv_guard) = MPV_PLAYERS.lock() {
            if let Some(ref map) = *mpv_guard {
                for (label, proc) in map {
                    if (target == "*" || target == *label) && proc.hwnd != 0 {
                        set_hwnd_opacity(proc.hwnd as HWND, op);
                    }
                }
            }
        }
    }
    if let Some(vol) = config.get("volume").and_then(|v| v.as_f64()) {
        set_mpv_volume(monitor_label.clone(), vol);
    }
    if let Some(muted) = config.get("muted").and_then(|v| v.as_bool()) {
        set_mpv_mute(monitor_label.clone(), muted);
    }
    let monitors = app.available_monitors().unwrap_or_default();
    let mut audio_assigned = false;
    let windows = app.webview_windows();
    for (label, win) in &windows {
        if label.starts_with("wallpaper_") && (target == "*" || target == *label) {
            let mut win_config = config.clone();
            if target == "*" {
                let is_primary = monitors.iter().find(|m| {
                    if let Some(name) = m.name() {
                        get_monitor_label(name) == *label && m.position().x == 0 && m.position().y == 0
                    } else {
                        false
                    }
                }).is_some();
                if (is_primary || *label == "wallpaper_0") && !audio_assigned {
                    audio_assigned = true;
                } else {
                    // Secondary monitor -> Force mute!
                    if let Some(obj) = win_config.as_object_mut() {
                        obj.insert("muted".to_string(), serde_json::json!(true));
                        obj.insert("volume".to_string(), serde_json::json!(0.0));
                        obj.insert("isSecondary".to_string(), serde_json::json!(true));
                    }
                }
            }
            let payload = serde_json::json!({ "config": win_config, "target": target.clone() });
            let _ = win.emit("aura:update-config", payload.clone());
            let _ = win.emit_to(label.as_str(), "aura:update-config", payload.clone());
            let _ = app.emit("aura:update-config", payload.clone());
            if let Some(fps_val) = config.get("fps").and_then(|v| v.as_f64()) {
                let _ = win.emit("aura:set-fps", serde_json::json!({ "fps": fps_val, "target": target.clone() }));
                let _ = win.emit_to(label.as_str(), "aura:set-fps", serde_json::json!({ "fps": fps_val, "target": target.clone() }));
            }
        }
    }
}

/// Update brightness on the live wallpaper (no engine restart needed).
#[tauri::command]
fn set_wallpaper_brightness(app: AppHandle, brightness: f64) {
    if let Ok(mpv_guard) = MPV_PLAYERS.lock() {
        if let Some(ref map) = *mpv_guard {
            for (_, proc) in map {
                let _ = proc.set_brightness(brightness);
            }
        }
    }
    let windows = app.webview_windows();
    for (label, win) in windows {
        if label.starts_with("wallpaper_") {
            let _ = win.emit_to(label.as_str(), "aura:set-brightness", serde_json::json!({ "brightness": brightness }));
        }
    }
}

/// Update opacity on the live wallpaper (no engine restart needed).
#[tauri::command]
fn set_wallpaper_opacity(app: AppHandle, opacity: f64) {
    #[cfg(windows)]
    if let Ok(mpv_guard) = MPV_PLAYERS.lock() {
        if let Some(ref map) = *mpv_guard {
            for (_, proc) in map {
                if proc.hwnd != 0 {
                    set_hwnd_opacity(proc.hwnd as HWND, opacity);
                }
            }
        }
    }
    let windows = app.webview_windows();
    for (label, win) in windows {
        if label.starts_with("wallpaper_") {
            let _ = win.emit_to(label.as_str(), "aura:set-opacity", serde_json::json!({ "opacity": opacity }));
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
        stop_wallpaper(app, None);
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
fn sync_performance_settings(pause_on_battery: bool, pause_on_fullscreen: bool) {
    if let Ok(mut guard) = PERFORMANCE_SETTINGS.lock() {
        guard.pause_on_battery = pause_on_battery;
        guard.pause_on_fullscreen = pause_on_fullscreen;
    }
}

#[tauri::command]
fn set_autostart(enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        if enabled {
            let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let exe_str = current_exe.to_string_lossy().to_string();
            let reg_val = format!("\"{}\" --autostart --minimized", exe_str);
            let status = std::process::Command::new("reg")
                .args(&[
                    "add",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "AetherFlow",
                    "/t",
                    "REG_SZ",
                    "/d",
                    &reg_val,
                    "/f",
                ])
                .creation_flags(0x08000000)
                .status()
                .map_err(|e| e.to_string())?;
            if status.success() {
                log_msg(&format!("[AUTOSTART] Registry Run key created: {}", reg_val));
                println!("[AUTOSTART] Registry Run key created: {}", reg_val);
                Ok(())
            } else {
                Err("Failed to set autostart registry key".to_string())
            }
        } else {
            let _ = std::process::Command::new("reg")
                .args(&[
                    "delete",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "AetherFlow",
                    "/f",
                ])
                .creation_flags(0x08000000)
                .status();
            log_msg("[AUTOSTART] Registry Run key deleted");
            println!("[AUTOSTART] Registry Run key deleted");
            Ok(())
        }
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

#[tauri::command]
fn is_autostart_enabled() -> bool {
    #[cfg(windows)]
    {
        let output = std::process::Command::new("reg")
            .args(&[
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "AetherFlow",
            ])
            .creation_flags(0x08000000)
            .output();
        if let Ok(out) = output {
            out.status.success()
        } else {
            false
        }
    }
    #[cfg(not(windows))]
    {
        false
    }
}

#[tauri::command]
fn is_minimized_boot() -> bool {
    std::env::args().any(|arg| arg == "--minimized" || arg == "--autostart")
}

#[tauri::command]
async fn read_local_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

/// Sets the native Windows desktop wallpaper via Win32 SystemParametersInfoW
#[tauri::command]
fn set_system_wallpaper(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        let wide: Vec<u16> = OsStr::new(&path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        unsafe {
            let res = SystemParametersInfoW(
                SPI_SETDESKWALLPAPER,
                0,
                wide.as_ptr() as *mut std::ffi::c_void,
                SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
            );
            if res == 0 {
                return Err("Failed to set system wallpaper".to_string());
            }
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Err("Only supported on Windows".to_string())
    }
}

/// Sets the Windows taskbar appearance style (default, clear, acrylic, blur) and border visibility
#[tauri::command]
fn set_taskbar_style(style: String, show_border: Option<bool>) -> Result<(), String> {
    let border = show_border.unwrap_or(false);
    taskbar::apply_taskbar_style(&style, border)
}

/// Returns the current Windows taskbar styling and TranslucentTB integration status
#[tauri::command]
fn get_taskbar_style() -> serde_json::Value {
    let (style, show_border, installed, running) = taskbar::get_current_taskbar_state();
    serde_json::json!({
        "style": style,
        "showBorder": show_border,
        "translucentTbInstalled": installed,
        "translucentTbRunning": running,
    })
}

/// Restarts Windows Explorer and TranslucentTB to cleanly recover from any corrupted taskbar state
#[tauri::command]
fn restart_taskbar_explorer() -> Result<(), String> {
    taskbar::restart_explorer_and_taskbar()
}

/// Safely opens external URLs or Windows protocol links in the default application
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = url;
        Ok(())
    }
}

/// Opens an OAuth popup window and intercepts the callback URL
#[tauri::command]
async fn open_oauth_window(app: AppHandle, url: String) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("oauth_popup") {
        let _ = existing.close();
    }

    let parsed_url: tauri::Url = url.parse().map_err(|e: <tauri::Url as std::str::FromStr>::Err| e.to_string())?;
    let app_clone = app.clone();

    let builder = tauri::WebviewWindowBuilder::new(
        &app,
        "oauth_popup",
        tauri::WebviewUrl::External(parsed_url)
    )
    .title("Sign In - AetherFlow")
    .inner_size(480.0, 680.0)
    .center()
    .resizable(false)
    .always_on_top(true)
    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
    .on_navigation(move |nav_url| {
        let url_str = nav_url.as_str();
        if url_str.contains("access_token=") 
            || url_str.contains("code=") 
            || url_str.starts_with("http://localhost:1420") 
            || url_str.starts_with("http://127.0.0.1:1420") 
            || url_str.starts_with("tauri://localhost") 
        {
            println!("[AetherFlow] Intercepted OAuth navigation: {}", url_str);
            let _ = app_clone.emit("aura:oauth-callback", url_str.to_string());
            let app_inner = app_clone.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(400));
                if let Some(w) = app_inner.get_webview_window("oauth_popup") {
                    let _ = w.close();
                }
            });
            return false;
        }
        true
    });

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(windows)]
fn trim_all_process_memory() {
    use std::collections::HashSet;
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, GetCurrentProcessId, OpenProcess, PROCESS_SET_QUOTA, PROCESS_QUERY_INFORMATION
    };
    use windows_sys::Win32::System::ProcessStatus::EmptyWorkingSet;
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32, TH32CS_SNAPPROCESS
    };
    use windows_sys::Win32::Foundation::CloseHandle;

    unsafe {
        // 1. Trim host process working set
        EmptyWorkingSet(GetCurrentProcess());

        // 2. Enumerate and recursively trim all descendant processes (children, grandchildren: GPU process, renderers, utilities, mpv)
        let current_pid = GetCurrentProcessId();
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot != windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
            let mut entry: PROCESSENTRY32 = std::mem::zeroed();
            entry.dwSize = std::mem::size_of::<PROCESSENTRY32>() as u32;

            let mut proc_list: Vec<(u32, u32)> = Vec::new(); // (pid, parent_pid)
            if Process32First(snapshot, &mut entry) != 0 {
                loop {
                    proc_list.push((entry.th32ProcessID, entry.th32ParentProcessID));
                    if Process32Next(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);

            // Recursively collect all descendant PIDs starting from current_pid
            let mut target_pids = HashSet::new();
            let mut frontier = vec![current_pid];

            while let Some(parent) = frontier.pop() {
                for &(pid, parent_id) in &proc_list {
                    if parent_id == parent && target_pids.insert(pid) {
                        frontier.push(pid);
                    }
                }
            }

            // Trim working set of every descendant process (WebView2 broker, GPU process, renderers, mpv)
            for pid in target_pids {
                let child_h = OpenProcess(PROCESS_SET_QUOTA | PROCESS_QUERY_INFORMATION, 0, pid);
                if !child_h.is_null() {
                    EmptyWorkingSet(child_h);
                    CloseHandle(child_h);
                }
            }
        }
    }
}

#[tauri::command]
fn trim_memory() {
    #[cfg(windows)]
    trim_all_process_memory();
}

#[tauri::command]
fn get_detailed_memory_usage() -> serde_json::Value {
    #[cfg(windows)]
    {
        use std::collections::HashSet;
        use windows_sys::Win32::System::Threading::{
            GetCurrentProcess, GetCurrentProcessId, OpenProcess, PROCESS_QUERY_INFORMATION
        };
        use windows_sys::Win32::System::ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
        use windows_sys::Win32::System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32, TH32CS_SNAPPROCESS
        };
        use windows_sys::Win32::Foundation::CloseHandle;

        unsafe {
            let mut host_bytes = 0usize;
            let mut webview_bytes = 0usize;
            let mut mpv_bytes = 0usize;

            // 1. Host process
            let mut pmc: PROCESS_MEMORY_COUNTERS = std::mem::zeroed();
            pmc.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
            if K32GetProcessMemoryInfo(GetCurrentProcess(), &mut pmc, pmc.cb) != 0 {
                host_bytes = pmc.WorkingSetSize;
            }

            // 2. Discover all descendant processes
            let current_pid = GetCurrentProcessId();
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snapshot != windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
                let mut entry: PROCESSENTRY32 = std::mem::zeroed();
                entry.dwSize = std::mem::size_of::<PROCESSENTRY32>() as u32;

                let mut proc_list: Vec<(u32, u32, String)> = Vec::new();
                if Process32First(snapshot, &mut entry) != 0 {
                    loop {
                        let name_len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
                        let name_str: String = entry.szExeFile[..name_len].iter().map(|&c| c as u8 as char).collect();
                        proc_list.push((entry.th32ProcessID, entry.th32ParentProcessID, name_str.to_lowercase()));
                        if Process32Next(snapshot, &mut entry) == 0 {
                            break;
                        }
                    }
                }
                CloseHandle(snapshot);

                let mut target_pids = HashSet::new();
                let mut frontier = vec![current_pid];

                while let Some(parent) = frontier.pop() {
                    for &(pid, parent_id, _) in &proc_list {
                        if parent_id == parent && target_pids.insert(pid) {
                            frontier.push(pid);
                        }
                    }
                }

                for &(pid, _, ref name) in &proc_list {
                    if target_pids.contains(&pid) {
                        let child_h = OpenProcess(PROCESS_QUERY_INFORMATION, 0, pid);
                        if !child_h.is_null() {
                            let mut c_pmc: PROCESS_MEMORY_COUNTERS = std::mem::zeroed();
                            c_pmc.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
                            if K32GetProcessMemoryInfo(child_h, &mut c_pmc, c_pmc.cb) != 0 {
                                if name.contains("mpv") {
                                    mpv_bytes += c_pmc.WorkingSetSize;
                                } else {
                                    webview_bytes += c_pmc.WorkingSetSize;
                                }
                            }
                            CloseHandle(child_h);
                        }
                    }
                }
            }

            let total_bytes = host_bytes + webview_bytes + mpv_bytes;
            serde_json::json!({
                "host_mb": (host_bytes as f64 / 1_048_576.0 * 10.0).round() / 10.0,
                "webview_mb": (webview_bytes as f64 / 1_048_576.0 * 10.0).round() / 10.0,
                "mpv_mb": (mpv_bytes as f64 / 1_048_576.0 * 10.0).round() / 10.0,
                "total_mb": (total_bytes as f64 / 1_048_576.0 * 10.0).round() / 10.0,
            })
        }
    }
    #[cfg(not(windows))]
    {
        serde_json::json!({
            "host_mb": 0.0,
            "webview_mb": 0.0,
            "mpv_mb": 0.0,
            "total_mb": 0.0,
        })
    }
}

#[tauri::command]
fn frontend_heartbeat(page: String, visibility: String, timestamp: f64, mounted: bool) -> serde_json::Value {
    let msg = format!("[FRONTEND HEARTBEAT] page={}, visibility={}, mounted={}, ts={:.0}", page, visibility, mounted, timestamp);
    static LAST_LOG: Mutex<Option<std::time::Instant>> = Mutex::new(None);
    let mut should_log = false;
    if let Ok(mut guard) = LAST_LOG.lock() {
        if guard.is_none() || guard.unwrap().elapsed() >= std::time::Duration::from_secs(10) {
            *guard = Some(std::time::Instant::now());
            should_log = true;
        }
    }
    if should_log {
        log_msg(&msg);
        println!("{}", msg);
    }
    serde_json::json!({ "ok": true, "ack": timestamp })
}

#[tauri::command]
fn report_frontend_error(error: String, info: Option<String>, source: Option<String>) {
    let msg = format!("[FRONTEND ERROR] source={:?}, error={}, info={:?}", source, error, info);
    log_msg(&msg);
    eprintln!("{}", msg);
}

#[tauri::command]
fn get_diagnostics(app: AppHandle) -> serde_json::Value {
    #[cfg(windows)]
    let (main_h_str, main_parent_str, main_vis, main_is_win) = if let Some(h) = get_main_hwnd() {
        unsafe {
            (
                format!("0x{:X}", h as usize),
                format!("0x{:X}", GetParent(h) as usize),
                IsWindowVisible(h) != 0,
                IsWindow(h) != 0,
            )
        }
    } else if let Some(win) = app.get_webview_window("main") {
        let (h_str, p_str, is_win) = if let Ok(h) = win.hwnd() {
            let raw_h = h.0 as HWND;
            unsafe {
                (format!("0x{:X}", raw_h as usize), format!("0x{:X}", GetParent(raw_h) as usize), IsWindow(raw_h) != 0)
            }
        } else {
            let title_wide: Vec<u16> = "AetherFlow\0".encode_utf16().collect();
            let found = unsafe { FindWindowW(std::ptr::null(), title_wide.as_ptr()) };
            if !found.is_null() {
                unsafe {
                    (format!("0x{:X}", found as usize), format!("0x{:X}", GetParent(found) as usize), IsWindow(found) != 0)
                }
            } else {
                ("unknown".to_string(), "0x0".to_string(), false)
            }
        };
        (h_str, p_str, win.is_visible().unwrap_or(false), is_win)
    } else {
        ("0x0".to_string(), "0x0".to_string(), false, false)
    };

    #[cfg(not(windows))]
    let (main_h_str, main_parent_str, main_vis, main_is_win) = ("0x0".to_string(), "0x0".to_string(), false, false);

    let mut native_hosts = serde_json::Map::new();
    #[cfg(windows)]
    if let Ok(guard) = MPV_PLAYERS.lock() {
        if let Some(ref map) = *guard {
            for (label, proc) in map {
                let hwnd = proc.hwnd as HWND;
                let (parent, vis) = unsafe { (format!("0x{:X}", GetParent(hwnd) as usize), IsWindowVisible(hwnd) != 0) };
                native_hosts.insert(label.clone(), serde_json::json!({
                    "hwnd": format!("0x{:X}", proc.hwnd),
                    "parent": parent,
                    "visible": vis,
                }));
            }
        }
    }

    let mut webview_hosts = serde_json::Map::new();
    for (label, win) in app.webview_windows() {
        if label.starts_with("wallpaper_") {
            #[cfg(windows)]
            let (raw_h_str, parent_str) = if let Ok(hwnd) = win.hwnd() {
                let raw_h = hwnd.0 as HWND;
                unsafe {
                    (format!("0x{:X}", raw_h as usize), format!("0x{:X}", GetParent(raw_h) as usize))
                }
            } else {
                ("unknown".to_string(), "unknown".to_string())
            };
            #[cfg(not(windows))]
            let (raw_h_str, parent_str) = ("n/a".to_string(), "n/a".to_string());

            webview_hosts.insert(label.clone(), serde_json::json!({
                "hwnd": raw_h_str,
                "parent": parent_str,
                "visible": win.is_visible().unwrap_or(false),
            }));
        }
    }

    let mut mpv_status = serde_json::Map::new();
    if let Ok(guard) = MPV_PLAYERS.lock() {
        if let Some(ref map) = *guard {
            for (label, proc) in map {
                mpv_status.insert(label.clone(), serde_json::json!({
                    "pid": proc.child.id(),
                    "pipe": proc.pipe_name,
                    "video": proc.video_path,
                }));
            }
        }
    }

    serde_json::json!({
        "main_hwnd": main_h_str,
        "main_parent_hwnd": main_parent_str,
        "main_is_window": main_is_win,
        "main_is_visible": main_vis,
        "native_wallpaper_windows": native_hosts,
        "webview_wallpaper_windows": webview_hosts,
        "mpv_players": mpv_status,
    })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

fn main() {
    #[cfg(windows)]
    {
        // Link all child processes (WebView2, MPV) into a Windows Job Object so they form a single managed unit
        unsafe {
            use windows_sys::Win32::System::JobObjects::{
                CreateJobObjectW, SetInformationJobObject, AssignProcessToJobObject,
                JobObjectExtendedLimitInformation, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            };
            use windows_sys::Win32::System::Threading::GetCurrentProcess;

            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if !job.is_null() {
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                // 0x00001000 = JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK, required for Chromium/WebView2 sandboxes
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | 0x00001000;
                SetInformationJobObject(
                    job,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const std::ffi::c_void,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                );
                AssignProcessToJobObject(job, GetCurrentProcess());
            }
        }

        // Disable non-essential background Chromium telemetry/sync services
        // DO NOT use --process-per-site or --renderer-process-limit which share renderers between main UI and wallpapers!
        // DO NOT choke the V8 heap with --max-old-space-size=64!
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--disable-features=AudioServiceOutOfProcess,MediaFoundationD3D11VideoCapture,Translate,OptimizationHints,MediaRouter \
             --enable-features=TrimOnMemoryPressure \
             --disk-cache-size=16777216 \
             --media-cache-size=16777216 \
             --disable-gpu-memory-buffer-video-frames \
             --disable-background-networking \
             --disable-component-update \
             --disable-domain-reliability \
             --disable-sync \
             --disable-extensions"
        );
    }

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
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            log_msg("[SINGLE INSTANCE] Second instance signal received, restoring main window");
            // Second instance: show existing control panel
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
            #[cfg(windows)]
            if let Some(main_h) = get_main_hwnd() {
                unsafe {
                    ShowWindow(main_h, 9); // SW_RESTORE
                    SetForegroundWindow(main_h);
                }
            }

            if let Some(pos) = argv.iter().position(|arg| arg == "--apply-video") {
                if let Some(path) = argv.get(pos + 1) {
                    let msg = format!("[CLI IPC] Received --apply-video with path: {}", path);
                    log_msg(&msg);
                    println!("{}", msg);
                    let app_h = app.clone();
                    let path_clone = path.clone();
                    tauri::async_runtime::spawn(async move {
                        apply_wallpaper(
                            app_h,
                            "video-player".to_string(),
                            serde_json::json!({
                                "videoPath": path_clone,
                                "speedMultiplier": 1.0,
                                "volume": 0.0,
                                "muted": true,
                            }),
                            1.0,
                            0.85,
                            None,
                        ).await;
                    });
                }
            } else if argv.iter().any(|arg| arg == "--stop-wallpaper") {
                log_msg("[CLI IPC] Received --stop-wallpaper");
                println!("[CLI IPC] Received --stop-wallpaper");
                stop_wallpaper(app.clone(), None);
            } else if argv.iter().any(|arg| arg == "--diagnostics") {
                let diag = get_diagnostics(app.clone());
                let diag_str = serde_json::to_string_pretty(&diag).unwrap_or_default();
                log_msg(&format!("[CLI IPC] Diagnostics:\n{}", diag_str));
                println!("[CLI IPC] Diagnostics:\n{}", diag_str);
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
            get_monitor_active_wallpaper,
            trim_memory,
            set_mpv_pause,
            set_mpv_volume,
            set_mpv_mute,
            sync_performance_settings,
            set_autostart,
            is_autostart_enabled,
            is_minimized_boot,
            frontend_heartbeat,
            report_frontend_error,
            get_diagnostics,
            save_custom_wallpapers,
            delete_custom_wallpaper,
            load_custom_wallpapers,
            set_system_wallpaper,
            set_taskbar_style,
            get_taskbar_style,
            restart_taskbar_explorer,
            open_url,
            open_oauth_window,
            get_detailed_memory_usage,
        ])
        .setup(|app| {
            let is_minimized = is_minimized_boot();
            let start_log = format!("AuraOS: Creating main window (minimized/autostart={})...", is_minimized);
            log_msg(&start_log);
            println!("{}", start_log);
            let win = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into())
            )
            .title("AetherFlow")
            .inner_size(1200.0, 780.0)
            .min_inner_size(900.0, 600.0)
            .center()
            .devtools(true)
            .visible(!is_minimized)
            .focused(!is_minimized)
            .build();
            
            match win {
                Ok(w) => {
                    log_msg("AuraOS: Main window created successfully.");
                    println!("AuraOS: Main window created successfully.");
                    
                    #[cfg(windows)]
                    if let Ok(raw_h) = w.hwnd() {
                        let raw_hwnd = raw_h.0 as HWND;
                        set_main_hwnd(raw_hwnd);
                        unsafe {
                            let parent = GetParent(raw_hwnd);
                            let msg = format!("[DIAG 1 & 4] Initial Main AuraOS HWND: 0x{:X}, parent: 0x{:X}", raw_hwnd as usize, parent as usize);
                            log_msg(&msg);
                            println!("{}", msg);
                        }
                    }
                    
                    let w_clone = w.clone();
                    w.on_window_event(move |event| {
                        match event {
                            tauri::WindowEvent::CloseRequested { api, .. } => {
                                log_msg("[MAIN WIN EVENT] CloseRequested -> hiding window to tray");
                                let _ = w_clone.hide();
                                api.prevent_close();

                                // Trim process memory working set of host and all child WebView2 processes
                                #[cfg(windows)]
                                trim_all_process_memory();
                            }
                            tauri::WindowEvent::Moved(pos) => {
                                log_msg(&format!("[MAIN WIN EVENT] Moved to ({}, {})", pos.x, pos.y));
                            }
                            tauri::WindowEvent::Resized(size) => {
                                log_msg(&format!("[MAIN WIN EVENT] Resized to {}x{}", size.width, size.height));
                            }
                            tauri::WindowEvent::Focused(focused) => {
                                log_msg(&format!("[MAIN WIN EVENT] Focused: {}", focused));
                            }
                            _ => {}
                        }
                    });

                    if !is_minimized {
                        let _ = w.unminimize();
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                Err(e) => {
                    let err = format!("AuraOS: ERROR creating main window - {}", e);
                    log_msg(&err);
                    eprintln!("{}", err);
                }
            }

            // Start the system state monitor thread (battery & fullscreen pausing)
            start_system_state_monitor(app.handle().clone());

            // Periodic background memory trimmer: reclaims unused V8 / WebView2 working set
            // Runs an initial trim at 2.5s to collapse startup Chromium allocation, then every 45s
            std::thread::spawn(|| {
                std::thread::sleep(std::time::Duration::from_millis(2500));
                #[cfg(windows)]
                trim_all_process_memory();

                loop {
                    std::thread::sleep(std::time::Duration::from_secs(45));
                    #[cfg(windows)]
                    trim_all_process_memory();
                }
            });

            // Pre-create and pin the wallpaper windows directly on the main thread
            ensure_wallpaper_windows(app.handle());

            // Check if --apply-video was supplied on initial cold launch
            let args: Vec<String> = std::env::args().collect();
            if let Some(pos) = args.iter().position(|arg| arg == "--apply-video") {
                if let Some(path) = args.get(pos + 1) {
                    let app_h = app.handle().clone();
                    let path_clone = path.clone();
                    tauri::async_runtime::spawn(async move {
                        std::thread::sleep(std::time::Duration::from_millis(1200));
                        let msg = format!("[COLD LAUNCH CLI] Applying video wallpaper from CLI: {}", path_clone);
                        log_msg(&msg);
                        println!("{}", msg);
                        apply_wallpaper(
                            app_h,
                            "video-player".to_string(),
                            serde_json::json!({
                                "videoPath": path_clone,
                                "speedMultiplier": 1.0,
                                "volume": 0.0,
                                "muted": true,
                            }),
                            1.0,
                            0.85,
                            None,
                        ).await;
                    });
                }
            }

            // ── Background Display Change & Hot-Plug Watcher with Debouncing ───
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                // Wait for initial startup to settle
                std::thread::sleep(std::time::Duration::from_millis(1500));

                let mut last_stable_monitors = get_monitors_snapshot(&app_handle);

                loop {
                    std::thread::sleep(std::time::Duration::from_millis(400));

                    let current_sample = get_monitors_snapshot(&app_handle);

                    if current_sample != last_stable_monitors {
                        // Display topology change in progress! Coalesce/debounce until stable.
                        let mut stable_candidate = current_sample;
                        loop {
                            std::thread::sleep(std::time::Duration::from_millis(300));
                            let next_sample = get_monitors_snapshot(&app_handle);
                            if next_sample == stable_candidate {
                                break;
                            }
                            stable_candidate = next_sample;
                        }

                        let change_log = format!(
                            "\n[DISPLAY CHANGE]\nmonitor count before: {}\nmonitor count after: {}",
                            last_stable_monitors.len(), stable_candidate.len()
                        );
                        log_msg(&change_log);
                        println!("{}", change_log);

                        // Run the controlled reconciliation on the stabilized configuration
                        reconcile_wallpaper_windows(&app_handle);

                        let _ = app_handle.emit("aura:monitors-changed", serde_json::json!({
                            "count": stable_candidate.len(),
                            "monitors": stable_candidate.iter().map(|m| m.name.clone()).collect::<Vec<_>>(),
                        }));

                        last_stable_monitors = stable_candidate;
                    }
                }
            });

            // ── System tray ───────────────────────────────────────────────────
            let open_item  = MenuItem::with_id(app, "open",  "Open AetherFlow",      true, None::<&str>)?;
            let pause_item = MenuItem::with_id(app, "pause", "Pause Wallpaper",   true, None::<&str>)?;
            let resume_item = MenuItem::with_id(app, "resume", "Resume Wallpaper",  true, None::<&str>)?;
            let stop_item  = MenuItem::with_id(app, "stop",  "Stop Wallpaper",    true, None::<&str>)?;
            let sep        = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_item  = MenuItem::with_id(app, "quit",  "Quit AetherFlow",       true, None::<&str>)?;

            let menu = Menu::with_items(app, &[
                &open_item,
                &pause_item,
                &resume_item,
                &stop_item,
                &sep,
                &quit_item,
            ])?;

            let tray_built = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("AetherFlow — Live Wallpaper Engine")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "open" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.unminimize();
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                            #[cfg(windows)]
                            if let Some(main_h) = get_main_hwnd() {
                                unsafe {
                                    ShowWindow(main_h, 9);
                                    SetForegroundWindow(main_h);
                                }
                            }
                        }
                        "pause" => {
                            set_mpv_pause(None, true);
                            let windows = app.webview_windows();
                            for (label, win) in windows {
                                if label.starts_with("wallpaper_") {
                                    let _ = win.emit_to(label.clone(), "aura:pause", serde_json::json!({}));
                                }
                            }
                        }
                        "resume" => {
                            set_mpv_pause(None, false);
                            let windows = app.webview_windows();
                            for (label, win) in windows {
                                if label.starts_with("wallpaper_") {
                                    let _ = win.emit_to(label.clone(), "aura:resume", serde_json::json!({}));
                                }
                            }
                        }
                        "stop" => {
                            stop_wallpaper(app.clone(), None);
                        }
                        "quit" => {
                            taskbar::restore_taskbar();
                            if let Ok(mut mpv_guard) = MPV_PLAYERS.lock() {
                                if let Some(ref mut map) = *mpv_guard {
                                    for (_, mut proc) in map.drain() {
                                        proc.terminate();
                                    }
                                }
                            }
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Single-click or Double-click tray icon → restore and focus control panel
                    match event {
                        TrayIconEvent::Click { button: MouseButton::Left, .. }
                        | TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } => {
                            let app = tray.app_handle();
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.unminimize();
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                            #[cfg(windows)]
                            if let Some(main_h) = get_main_hwnd() {
                                unsafe {
                                    ShowWindow(main_h, 9);
                                    SetForegroundWindow(main_h);
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            if let Ok(mut guard) = TRAY_HOLDER.lock() {
                *guard = Some(tray_built);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running AetherFlow")
}
