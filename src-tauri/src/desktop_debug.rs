/// Desktop hierarchy diagnostic v4 — uses EnumChildWindows on desktop HWND  
/// and also tries to find windows owned by explorer.exe PID

use windows_sys::Win32::Foundation::{HWND, LPARAM};
use windows_sys::Win32::UI::WindowsAndMessaging::*;

fn class_name(hwnd: HWND) -> String {
    let mut buf = [0u16; 256];
    let len = unsafe { GetClassNameW(hwnd, buf.as_mut_ptr(), 256) };
    String::from_utf16_lossy(&buf[..len as usize])
}

fn window_text(hwnd: HWND) -> String {
    let mut buf = [0u16; 256];
    let len = unsafe { GetWindowTextW(hwnd, buf.as_mut_ptr(), 256) };
    String::from_utf16_lossy(&buf[..len as usize])
}

fn main() {
    unsafe {
        println!("=== DESKTOP HIERARCHY v4 ===\n");
        
        // Count ALL top-level windows via EnumWindows
        static mut TOTAL_COUNT: i32 = 0;
        static mut FOUND_CLASSES: Vec<String> = Vec::new();
        
        unsafe extern "system" fn count_all(hwnd: HWND, _: LPARAM) -> i32 {
            TOTAL_COUNT += 1;
            let cn = class_name(hwnd);
            if cn == "Progman" || cn == "WorkerW" || cn.contains("Shell") || cn.contains("Desktop") {
                FOUND_CLASSES.push(format!("0x{:X} class='{}' text='{}'", 
                    hwnd as usize, cn, window_text(hwnd)));
            }
            1
        }
        
        EnumWindows(Some(count_all), 0);
        println!("EnumWindows total: {}", TOTAL_COUNT);
        println!("Desktop-related: {}", FOUND_CLASSES.len());
        for s in &FOUND_CLASSES {
            println!("  {}", s);
        }
        
        // Try EnumChildWindows on desktop
        let desktop = GetDesktopWindow();
        println!("\nDesktop HWND: 0x{:X}", desktop as usize);
        
        static mut CHILD_COUNT: i32 = 0;
        static mut CHILD_CLASSES: Vec<String> = Vec::new();
        
        unsafe extern "system" fn count_children(hwnd: HWND, _: LPARAM) -> i32 {
            CHILD_COUNT += 1;
            let cn = class_name(hwnd);
            if cn == "Progman" || cn == "WorkerW" || cn.contains("Shell") || cn.contains("Desktop") {
                CHILD_CLASSES.push(format!("0x{:X} class='{}' text='{}'", 
                    hwnd as usize, cn, window_text(hwnd)));
            }
            if CHILD_COUNT <= 5 {
                // print first 5 children to see what they are
                println!("  child #{}: 0x{:X} class='{}'", CHILD_COUNT, hwnd as usize, cn);
            }
            1
        }
        
        EnumChildWindows(desktop, Some(count_children), 0);
        println!("EnumChildWindows total: {}", CHILD_COUNT);
        println!("Desktop-related children: {}", CHILD_CLASSES.len());
        for s in &CHILD_CLASSES {
            println!("  {}", s);
        }
        
        // Direct HWND probe: Try common known handles
        // On most systems Progman is one of the first windows
        println!("\n--- Brute-force HWND search (low range) ---");
        for candidate in (0x10000..0x200000u64).step_by(2) {
            let h = candidate as HWND;
            let cn = class_name(h);
            if cn == "Progman" || cn == "WorkerW" {
                let wt = window_text(h);
                let vis = IsWindowVisible(h) != 0;
                let ex = GetWindowLongW(h, GWL_EXSTYLE) as u32;
                let st = GetWindowLongW(h, GWL_STYLE) as u32;
                println!("  FOUND 0x{:X}: class='{}' text='{}' style=0x{:08X} ex=0x{:08X} vis={}", 
                    candidate, cn, wt, st, ex, vis);
            }
        }
        
        println!("\n=== DONE ===");
    }
}
