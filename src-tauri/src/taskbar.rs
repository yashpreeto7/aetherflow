//! Taskbar Styling Module
//! Uses native Win32 SetWindowCompositionAttribute API to style Windows 10 & 11 taskbars
//! Supports: Default, Clear (Transparent), Acrylic (Frosted Glass), and Blur.

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

static CURRENT_TASKBAR_STYLE: Mutex<Option<String>> = Mutex::new(None);

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

            // Secondary XAML content bridge
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

fn apply_taskbar_style_internal(style: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        let (state, gradient, flags) = match style.to_lowercase().as_str() {
            "clear" | "transparent" => (ACCENT_ENABLE_TRANSPARENTGRADIENT, 0x00000000, 0),
            "acrylic" => (ACCENT_ENABLE_ACRYLICBLURBEHIND, 0x66101010, 2),
            "blur" => (ACCENT_ENABLE_BLURBEHIND, 0x00000000, 0),
            _ => (ACCENT_DISABLED, 0x00000000, 0),
        };

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
        let _ = style;
        Ok(())
    }
}

pub fn apply_taskbar_style(style: &str) -> Result<(), String> {
    // Record requested style without holding the lock across execution
    {
        if let Ok(mut lock) = CURRENT_TASKBAR_STYLE.lock() {
            *lock = Some(style.to_string());
        }
    }

    apply_taskbar_style_internal(style)
}

pub fn maintain_taskbar_style() {
    // Clone style string and drop lock immediately to prevent deadlocks
    let style_opt = {
        if let Ok(lock) = CURRENT_TASKBAR_STYLE.lock() {
            lock.clone()
        } else {
            None
        }
    };

    if let Some(style) = style_opt {
        if style != "default" && !style.is_empty() {
            let _ = apply_taskbar_style_internal(&style);
        }
    }
}

pub fn restore_taskbar() {
    let _ = apply_taskbar_style("default");
}
