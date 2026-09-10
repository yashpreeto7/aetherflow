//! Taskbar Styling Module
//! Uses native Win32 SetWindowCompositionAttribute API to style Windows 10 & 11 taskbars
//! Supports: Default, Clear (Transparent), Acrylic (Frosted Glass), and Blur.
//! Seamlessly integrates with TranslucentTB on Windows 11 to prevent XAML brush conflicts.

use std::ffi::c_void;
use std::sync::Mutex;

#[cfg(windows)]
use windows_sys::Win32::Foundation::HWND;
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    FindWindowW, FindWindowExW, SetWindowPos,
    SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SWP_NOACTIVATE, SWP_FRAMECHANGED,
};
#[cfg(windows)]
use windows_sys::Win32::System::LibraryLoader::{GetModuleHandleA, GetProcAddress};

#[repr(C)]
#[derive(Clone, Copy)]
struct AccentPolicy {
    accent_state: u32,
    accent_flags: u32,
    gradient_color: u32,
    animation_id: u32,
}

#[repr(C)]
struct WindowCompositionAttributeData {
    attribute: u32, // WCA_ACCENT_POLICY = 19
    data: *mut c_void,
    size: usize,
}

#[cfg(windows)]
type SetWindowCompositionAttributeFn = unsafe extern "system" fn(HWND, *mut WindowCompositionAttributeData) -> i32;

const ACCENT_DISABLED: u32 = 0;
const ACCENT_ENABLE_TRANSPARENTGRADIENT: u32 = 2;
const ACCENT_ENABLE_BLURBEHIND: u32 = 3;
const ACCENT_ENABLE_ACRYLICBLURBEHIND: u32 = 4;

static CURRENT_TASKBAR_STYLE: Mutex<Option<(String, bool)>> = Mutex::new(None);

/// Strips single-line (//) and multi-line (/* */) comments as well as any UTF-8 BOM from JSON text
/// while preserving quoted string literals and URLs.
pub fn strip_json_comments(input: &str) -> String {
    let clean_input: String = input.chars().filter(|&c| c != '\u{FEFF}').collect();
    let mut out = String::with_capacity(clean_input.len());
    let mut chars = clean_input.chars().peekable();
    let mut in_string = false;
    let mut escape = false;

    while let Some(c) = chars.next() {
        if in_string {
            out.push(c);
            if escape {
                escape = false;
            } else if c == '\\' {
                escape = true;
            } else if c == '"' {
                in_string = false;
            }
        } else {
            if c == '"' {
                in_string = true;
                out.push(c);
            } else if c == '/' && chars.peek() == Some(&'/') {
                chars.next();
                for next_c in chars.by_ref() {
                    if next_c == '\n' {
                        out.push('\n');
                        break;
                    }
                }
            } else if c == '/' && chars.peek() == Some(&'*') {
                chars.next();
                while let Some(next_c) = chars.next() {
                    if next_c == '*' && chars.peek() == Some(&'/') {
                        chars.next();
                        break;
                    }
                }
            } else {
                out.push(c);
            }
        }
    }
    out
}

/// Checks if TranslucentTB is active in background to avoid overriding its XAML hooks
#[cfg(windows)]
pub fn is_translucenttb_running() -> bool {
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE;

    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap == INVALID_HANDLE_VALUE || snap.is_null() {
            return false;
        }

        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        let mut found = false;
        if Process32FirstW(snap, &mut entry) != 0 {
            loop {
                let name = String::from_utf16_lossy(
                    &entry.szExeFile[..entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len())]
                );
                if name.to_lowercase().contains("translucenttb") {
                    found = true;
                    break;
                }
                if Process32NextW(snap, &mut entry) == 0 {
                    break;
                }
            }
        }
        windows_sys::Win32::Foundation::CloseHandle(snap);
        found
    }
}

#[cfg(not(windows))]
pub fn is_translucenttb_running() -> bool {
    false
}

/// Finds the TranslucentTB settings file path and shell launch target
pub fn find_translucenttb_info() -> Option<(std::path::PathBuf, String)> {
    let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
    let packages_dir = std::path::PathBuf::from(local_app_data).join("Packages");
    if let Ok(entries) = std::fs::read_dir(packages_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.contains("TranslucentTB") {
                let settings_file = entry.path().join("RoamingState").join("settings.json");
                let app_launch_target = format!("shell:AppsFolder\\{}!TranslucentTB", name);
                return Some((settings_file, app_launch_target));
            }
        }
    }
    None
}

/// Gracefully restarts TranslucentTB in the background so it immediately applies settings.json
#[cfg(windows)]
pub fn restart_translucenttb(app_launch_target: &str) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // Gracefully terminate existing TranslucentTB if running
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/IM", "TranslucentTB.exe"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    std::thread::sleep(std::time::Duration::from_millis(150));

    // Relaunch TranslucentTB silently
    let _ = std::process::Command::new("powershell")
        .args([
            "-WindowStyle",
            "Hidden",
            "-Command",
            &format!("Start-Process '{}'", app_launch_target),
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();

    std::thread::sleep(std::time::Duration::from_millis(350));
}

#[cfg(not(windows))]
pub fn restart_translucenttb(_app_launch_target: &str) {}

/// Updates TranslucentTB configuration file live; TranslucentTB's folder watcher detects
/// changes via ReadDirectoryChangesW and reloads live in memory with zero process kills.
#[cfg(windows)]
fn update_translucenttb_config(style: &str, show_border: bool) -> Result<(), String> {
    let (settings_file, app_launch_target) = match find_translucenttb_info() {
        Some(info) => info,
        None => return Err("TranslucentTB package not found".into()),
    };

    if !settings_file.exists() {
        return Err("TranslucentTB settings.json not found".into());
    }

    let content = std::fs::read_to_string(&settings_file)
        .map_err(|e| format!("Failed to read TranslucentTB settings.json: {}", e))?;

    let clean = strip_json_comments(&content);
    let mut json = serde_json::from_str::<serde_json::Value>(&clean)
        .map_err(|e| format!("Failed to parse TranslucentTB settings.json: {}", e))?;

    let (accent, color, blur_radius, is_default) = match style.to_lowercase().as_str() {
        "clear" | "transparent" => ("clear", "#00000000", 9.0, false),
        "acrylic" => ("acrylic", "#202020B0", 9.0, false),
        "blur" => ("blur", "#20202080", 15.0, false),
        _ => ("normal", "#00000000", 9.0, true),
    };

    let update_entry = |obj: &mut serde_json::Value, can_enable: bool| {
        obj["accent"] = serde_json::Value::String(accent.to_string());
        obj["color"] = serde_json::Value::String(color.to_string());
        obj["show_line"] = serde_json::Value::Bool(if is_default { false } else { show_border });
        obj["show_peek"] = serde_json::Value::Bool(false);
        obj["blur_radius"] = serde_json::json!(blur_radius);
        if can_enable {
            obj["enabled"] = serde_json::Value::Bool(!is_default);
        }
    };

    if let Some(desktop) = json.get_mut("desktop_appearance") {
        update_entry(desktop, false);
    }
    if let Some(visible) = json.get_mut("visible_window_appearance") {
        update_entry(visible, true);
    }
    if let Some(maximized) = json.get_mut("maximized_window_appearance") {
        update_entry(maximized, true);
    }
    if let Some(start) = json.get_mut("start_opened_appearance") {
        update_entry(start, true);
    }
    if let Some(search) = json.get_mut("search_opened_appearance") {
        update_entry(search, true);
    }
    if let Some(taskview) = json.get_mut("task_view_opened_appearance") {
        update_entry(taskview, true);
    }
    if let Some(battery) = json.get_mut("battery_saver_appearance") {
        update_entry(battery, true);
    }

    let serialized = serde_json::to_string_pretty(&json)
        .map_err(|e| format!("Failed to serialize TranslucentTB settings: {}", e))?;

    std::fs::write(&settings_file, serialized)
        .map_err(|e| format!("Failed to write TranslucentTB settings.json: {}", e))?;

    // If TranslucentTB is installed but not running yet, auto-start it
    if !is_translucenttb_running() {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = std::process::Command::new("powershell")
            .args([
                "-WindowStyle",
                "Hidden",
                "-Command",
                &format!("Start-Process '{}'", app_launch_target),
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }

    Ok(())
}

#[cfg(not(windows))]
fn update_translucenttb_config(_style: &str, _show_border: bool) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
fn disable_windows_accent_tint_on_taskbar() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let _ = std::process::Command::new("reg")
        .args([
            "add",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
            "/v",
            "ColorPrevalence",
            "/t",
            "REG_DWORD",
            "/d",
            "0",
            "/f",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .status();
}

#[cfg(windows)]
fn is_windows_11_or_newer() -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    if let Ok(out) = std::process::Command::new("reg")
        .args(["query", r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion", "/v", "CurrentBuild"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            if line.contains("CurrentBuild") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(build_str) = parts.last() {
                    if let Ok(build) = build_str.parse::<u32>() {
                        return build >= 22000;
                    }
                }
            }
        }
    }
    true
}

/// Discovers the primary and secondary taskbar HWNDs.
/// CRITICAL: NEVER includes DesktopWindowContentBridge as calling SetWindowCompositionAttribute
/// on the XAML bridge ruins composition and paints it opaque grey/black!
#[cfg(windows)]
fn get_all_taskbar_hwnds() -> Vec<HWND> {
    let mut hwnds = Vec::new();
    unsafe {
        // Primary Taskbar (Shell_TrayWnd)
        let primary_class: Vec<u16> = "Shell_TrayWnd\0".encode_utf16().collect();
        let primary = FindWindowW(primary_class.as_ptr(), std::ptr::null());
        if !primary.is_null() {
            hwnds.push(primary);
        }

        // Secondary Taskbars on Multi-Monitor Setups (Shell_SecondaryTrayWnd)
        let sec_class: Vec<u16> = "Shell_SecondaryTrayWnd\0".encode_utf16().collect();
        let mut sec = std::ptr::null_mut();
        loop {
            sec = FindWindowExW(std::ptr::null_mut(), sec, sec_class.as_ptr(), std::ptr::null());
            if sec.is_null() {
                break;
            }
            hwnds.push(sec);
        }
    }
    hwnds
}

fn apply_taskbar_style_internal(style: &str, show_border: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        // 1. If TranslucentTB is installed, control it exclusively to avoid WCA conflicts
        if find_translucenttb_info().is_some() {
            disable_windows_accent_tint_on_taskbar();
            return update_translucenttb_config(style, show_border);
        }

        // 2. If TranslucentTB is NOT installed on Windows 11:
        // Win11 XAML taskbars do not support direct WCA (it renders grey or black).
        if is_windows_11_or_newer() {
            return Err("Windows 11 requires TranslucentTB for taskbar styling. Please install TranslucentTB from the Microsoft Store.".into());
        }

        // 3. Fallback for Windows 10 only:
        let (state, gradient, base_flags) = match style.to_lowercase().as_str() {
            "clear" | "transparent" => (ACCENT_ENABLE_TRANSPARENTGRADIENT, 0x00000000, 0),
            "acrylic" => (ACCENT_ENABLE_ACRYLICBLURBEHIND, 0x66101010, 2),
            "blur" => (ACCENT_ENABLE_BLURBEHIND, 0x00000000, 0),
            _ => (ACCENT_DISABLED, 0x00000000, 0),
        };

        let flags = if show_border { base_flags | 2 } else { 0 };

        unsafe {
            let user32 = GetModuleHandleA(b"user32.dll\0".as_ptr());
            if user32.is_null() {
                return Err("user32.dll not found".into());
            }
            let func_ptr = GetProcAddress(user32, b"SetWindowCompositionAttribute\0".as_ptr());
            if func_ptr.is_none() {
                return Err("SetWindowCompositionAttribute not found".into());
            }
            let set_wca: SetWindowCompositionAttributeFn = std::mem::transmute(func_ptr);

            let mut policy = AccentPolicy {
                accent_state: state,
                accent_flags: flags,
                gradient_color: gradient,
                animation_id: 0,
            };

            let mut data = WindowCompositionAttributeData {
                attribute: 19, // WCA_ACCENT_POLICY
                data: &mut policy as *mut _ as *mut c_void,
                size: std::mem::size_of::<AccentPolicy>(),
            };

            let hwnds = get_all_taskbar_hwnds();
            for hwnd in hwnds {
                set_wca(hwnd, &mut data);
                SetWindowPos(
                    hwnd,
                    std::ptr::null_mut(),
                    0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
                );
            }
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (style, show_border);
        Ok(())
    }
}

pub fn apply_taskbar_style(style: &str, show_border: bool) -> Result<(), String> {
    {
        if let Ok(mut lock) = CURRENT_TASKBAR_STYLE.lock() {
            *lock = Some((style.to_string(), show_border));
        }
    }

    apply_taskbar_style_internal(style, show_border)
}

/// Returns the currently active taskbar style and whether TranslucentTB is installed & running.
/// If no style was set in-memory yet, reads TranslucentTB's settings.json so initial state is 100% accurate.
pub fn get_current_taskbar_state() -> (String, bool, bool, bool) {
    let ttb_installed = find_translucenttb_info().is_some();
    let ttb_running = is_translucenttb_running();

    // If TranslucentTB is installed, read its settings.json to get actual current state
    if let Some((settings_file, _)) = find_translucenttb_info() {
        if let Ok(content) = std::fs::read_to_string(&settings_file) {
            let clean = strip_json_comments(&content);
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&clean) {
                let accent = json.get("desktop_appearance")
                    .and_then(|d| d.get("accent"))
                    .and_then(|a| a.as_str())
                    .unwrap_or("normal");
                let show_border = json.get("desktop_appearance")
                    .and_then(|d| d.get("show_line"))
                    .and_then(|s| s.as_bool())
                    .unwrap_or(false);

                let style = match accent {
                    "clear" => "clear",
                    "acrylic" => "acrylic",
                    "blur" => "blur",
                    _ => "default",
                };
                return (style.to_string(), show_border, ttb_installed, ttb_running);
            }
        }
    }

    if let Ok(lock) = CURRENT_TASKBAR_STYLE.lock() {
        if let Some(ref s) = *lock {
            return (s.0.clone(), s.1, ttb_installed, ttb_running);
        }
    }

    ("default".to_string(), false, ttb_installed, ttb_running)
}

/// Restarts Explorer and TranslucentTB in proper order to cleanly recover from any corrupted XAML state
pub fn restart_explorer_and_taskbar() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // 1. Gracefully terminate existing TranslucentTB first so it unhooks cleanly
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "TranslucentTB.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();

        std::thread::sleep(std::time::Duration::from_millis(200));

        // 2. Kill Explorer to completely reset any stuck XAML Diagnostics or WCA hooks
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "explorer.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();

        std::thread::sleep(std::time::Duration::from_millis(600));

        // 3. Restart Explorer
        let _ = std::process::Command::new("explorer.exe")
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();

        // 4. Wait for Explorer to recreate Shell_TrayWnd before starting TranslucentTB
        for _ in 0..25 {
            std::thread::sleep(std::time::Duration::from_millis(200));
            let primary_class: Vec<u16> = "Shell_TrayWnd\0".encode_utf16().collect();
            let primary = unsafe { FindWindowW(primary_class.as_ptr(), std::ptr::null()) };
            if !primary.is_null() {
                // Allow Explorer extra time for XAML DesktopWindowContentBridge to settle
                std::thread::sleep(std::time::Duration::from_millis(600));
                break;
            }
        }

        // 5. Re-launch TranslucentTB if installed
        if let Some((_, launch_target)) = find_translucenttb_info() {
            let _ = std::process::Command::new("powershell")
                .args([
                    "-WindowStyle",
                    "Hidden",
                    "-Command",
                    &format!("Start-Process '{}'", launch_target),
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }

        Ok(())
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

pub fn maintain_taskbar_style() {
    #[cfg(windows)]
    if find_translucenttb_info().is_some() {
        // When TranslucentTB is installed, it maintains taskbar styling natively
        return;
    }

    #[cfg(windows)]
    {
        if is_windows_11_or_newer() {
            return;
        }

        let style_opt = {
            if let Ok(lock) = CURRENT_TASKBAR_STYLE.lock() {
                lock.clone()
            } else {
                None
            }
        };

        if let Some((style, border)) = style_opt {
            if style != "default" && !style.is_empty() {
                let _ = apply_taskbar_style_internal(&style, border);
            }
        }
    }
}

pub fn restore_taskbar() {
    let _ = apply_taskbar_style("default", false);
}
