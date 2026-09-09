//! Taskbar Styling Module
//! Uses native Win32 SetWindowCompositionAttribute API to style Windows 10 & 11 taskbars
//! Supports: Default, Clear (Transparent), Acrylic (Frosted Glass), and Blur.
//! Seamlessly yields control to TranslucentTB when detected to prevent XAML brush conflicts.

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

/// Automatically starts TranslucentTB in the background if installed and not currently running
#[cfg(windows)]
pub fn ensure_translucenttb_running() -> bool {
    if is_translucenttb_running() {
        return true;
    }

    let local_app_data = match std::env::var("LOCALAPPDATA") {
        Ok(v) => v,
        Err(_) => return false,
    };
    let packages_dir = std::path::PathBuf::from(local_app_data).join("Packages");
    if let Ok(entries) = std::fs::read_dir(packages_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.contains("TranslucentTB") {
                let app_launch_target = format!("shell:AppsFolder\\{}!TranslucentTB", name);
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

                std::thread::sleep(std::time::Duration::from_millis(350));
                return is_translucenttb_running();
            }
        }
    }
    false
}

#[cfg(not(windows))]
pub fn ensure_translucenttb_running() -> bool {
    false
}

#[cfg(windows)]
fn update_translucenttb_config(style: &str, show_border: bool) -> bool {
    let local_app_data = match std::env::var("LOCALAPPDATA") {
        Ok(v) => v,
        Err(_) => return false,
    };
    let packages_dir = std::path::PathBuf::from(local_app_data).join("Packages");
    if let Ok(entries) = std::fs::read_dir(packages_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.contains("TranslucentTB") {
                let settings_file = entry.path().join("RoamingState").join("settings.json");
                if settings_file.exists() {
                    if let Ok(content) = std::fs::read_to_string(&settings_file) {
                        if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&content) {
                            let accent = match style.to_lowercase().as_str() {
                                "clear" | "transparent" => "clear",
                                "acrylic" => "acrylic",
                                "blur" => "blur",
                                _ => "normal",
                            };

                            let current_accent = json.get("desktop_appearance")
                                .and_then(|d| d.get("accent"))
                                .and_then(|a| a.as_str());
                            let current_show_line = json.get("desktop_appearance")
                                .and_then(|d| d.get("show_line"))
                                .and_then(|s| s.as_bool());

                            if current_accent == Some(accent) && current_show_line == Some(show_border) {
                                return true;
                            }

                            let update_entry = |obj: &mut serde_json::Value, enabled: bool| {
                                obj["accent"] = serde_json::Value::String(accent.to_string());
                                obj["color"] = serde_json::Value::String("#00000000".to_string());
                                obj["show_line"] = serde_json::Value::Bool(show_border);
                                obj["show_peek"] = serde_json::Value::Bool(false);
                                if enabled {
                                    obj["enabled"] = serde_json::Value::Bool(true);
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
                                update_entry(start, false);
                            }
                            if let Some(search) = json.get_mut("search_opened_appearance") {
                                update_entry(search, false);
                            }
                            if let Some(taskview) = json.get_mut("task_view_opened_appearance") {
                                update_entry(taskview, false);
                            }
                            if let Some(battery) = json.get_mut("battery_saver_appearance") {
                                update_entry(battery, false);
                            }

                            if let Ok(serialized) = serde_json::to_string_pretty(&json) {
                                let _ = std::fs::write(&settings_file, serialized);
                            }

                            restart_translucenttb_appx(&name);
                            return true;
                        }
                    }
                }
            }
        }
    }
    false
}

#[cfg(windows)]
fn restart_translucenttb_appx(package_folder_name: &str) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/IM", "TranslucentTB.exe"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    let app_launch_target = format!("shell:AppsFolder\\{}!TranslucentTB", package_folder_name);
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

#[cfg(windows)]
fn get_all_taskbar_hwnds() -> Vec<HWND> {
    let mut hwnds = Vec::new();
    unsafe {
        // Primary Taskbar (Shell_TrayWnd)
        let primary_class: Vec<u16> = "Shell_TrayWnd\0".encode_utf16().collect();
        let primary = FindWindowW(primary_class.as_ptr(), std::ptr::null());
        if !primary.is_null() {
            hwnds.push(primary);

            // Windows 11 XAML taskbar content bridge
            let bridge_class: Vec<u16> = "Windows.UI.Composition.DesktopWindowContentBridge\0".encode_utf16().collect();
            let mut bridge = std::ptr::null_mut();
            loop {
                bridge = FindWindowExW(primary, bridge, bridge_class.as_ptr(), std::ptr::null());
                if bridge.is_null() {
                    break;
                }
                hwnds.push(bridge);
            }
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

            let bridge_class: Vec<u16> = "Windows.UI.Composition.DesktopWindowContentBridge\0".encode_utf16().collect();
            let mut bridge = std::ptr::null_mut();
            loop {
                bridge = FindWindowExW(sec, bridge, bridge_class.as_ptr(), std::ptr::null());
                if bridge.is_null() {
                    break;
                }
                hwnds.push(bridge);
            }
        }
    }
    hwnds
}

fn apply_taskbar_style_internal(style: &str, show_border: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        // Auto-launch TranslucentTB if installed but not running
        let _ = ensure_translucenttb_running();

        // When TranslucentTB is running, control it directly via its config and avoid conflicting WCA calls
        if is_translucenttb_running() {
            if update_translucenttb_config(style, show_border) {
                return Ok(());
            }
        }

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
                // Force DWM frame update so the new accent policy takes effect immediately
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
    // Record requested style without holding the lock across execution
    {
        if let Ok(mut lock) = CURRENT_TASKBAR_STYLE.lock() {
            *lock = Some((style.to_string(), show_border));
        }
    }

    apply_taskbar_style_internal(style, show_border)
}

pub fn maintain_taskbar_style() {
    #[cfg(windows)]
    if is_translucenttb_running() {
        return;
    }

    // Clone style tuple and drop lock immediately to prevent deadlocks
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

pub fn restore_taskbar() {
    let _ = apply_taskbar_style("default", false);
}
