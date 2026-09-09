//! Taskbar Styling Module
//! Uses native Win32 SetWindowCompositionAttribute API to style Windows 10 & 11 taskbars
//! Supports: Default, Clear (Transparent), Acrylic (Frosted Glass), and Blur.

use std::ffi::c_void;
use std::sync::Mutex;

#[cfg(windows)]
use windows_sys::Win32::Foundation::{HWND, LPARAM};
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{FindWindowW, EnumWindows, GetClassNameW};
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
        let primary_class: Vec<u16> = "Shell_TrayWnd\0".encode_utf16().collect();
        let primary = FindWindowW(primary_class.as_ptr(), std::ptr::null());
        if !primary.is_null() {
            hwnds.push(primary);
        }

        struct EnumData {
            hwnds: *mut Vec<HWND>,
        }

        unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> i32 {
            let data = &mut *(lparam as *mut EnumData);
            let mut buf = [0u16; 64];
            let len = GetClassNameW(hwnd, buf.as_mut_ptr(), 64);
            let class_name = String::from_utf16_lossy(&buf[..len as usize]);
            if class_name == "Shell_SecondaryTrayWnd" {
                (&mut *data.hwnds).push(hwnd);
            }
            1
        }

        let mut data = EnumData { hwnds: &mut hwnds };
        EnumWindows(Some(enum_proc), &mut data as *mut _ as LPARAM);
    }
    hwnds
}

pub fn apply_taskbar_style(style: &str) -> Result<(), String> {
    if let Ok(mut lock) = CURRENT_TASKBAR_STYLE.lock() {
        *lock = Some(style.to_string());
    }

    #[cfg(windows)]
    {
        let (state, gradient, flags) = match style.to_lowercase().as_str() {
            "clear" | "transparent" => (ACCENT_ENABLE_TRANSPARENTGRADIENT, 0x00000000, 2),
            "acrylic" => (ACCENT_ENABLE_ACRYLICBLURBEHIND, 0x01000000, 2),
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

pub fn maintain_taskbar_style() {
    if let Ok(lock) = CURRENT_TASKBAR_STYLE.lock() {
        if let Some(ref style) = *lock {
            if style != "default" && !style.is_empty() {
                let _ = apply_taskbar_style(style);
            }
        }
    }
}

pub fn restore_taskbar() {
    let _ = apply_taskbar_style("default");
}
