use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::io::Write;

#[cfg(windows)]
use windows_sys::Win32::Foundation::HWND;

pub struct MpvProcess {
    pub child: Child,
    pub pipe_name: String,
    pub monitor_label: String,
    pub video_path: String,
    pub hwnd: usize,
}

impl MpvProcess {
    pub fn send_ipc_command(&self, command: serde_json::Value) -> Result<(), String> {
        #[cfg(windows)]
        {
            use windows_sys::Win32::System::Pipes::WaitNamedPipeW;

            let pipe_wide: Vec<u16> = self.pipe_name.encode_utf16().chain(std::iter::once(0)).collect();
            // Non-blocking check: wait max 50ms so this never freezes the app or tray
            let ready = unsafe { WaitNamedPipeW(pipe_wide.as_ptr(), 50) };
            if ready == 0 {
                return Err(format!("MPV IPC pipe {} is not ready", self.pipe_name));
            }

            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .open(&self.pipe_name)
                .map_err(|e| format!("Failed to open MPV IPC pipe {}: {}", self.pipe_name, e))?;

            let mut msg = command.to_string();
            msg.push('\n');
            file.write_all(msg.as_bytes())
                .map_err(|e| format!("Failed to write to MPV IPC pipe: {}", e))?;
            Ok(())
        }
        #[cfg(not(windows))]
        {
            let _ = command;
            Ok(())
        }
    }

    pub fn set_pause(&self, paused: bool) -> Result<(), String> {
        self.send_ipc_command(serde_json::json!({
            "command": ["set_property", "pause", paused]
        }))
    }

    pub fn set_volume(&self, volume: f64) -> Result<(), String> {
        let vol_clamped = volume.max(0.0).min(100.0);
        self.send_ipc_command(serde_json::json!({
            "command": ["set_property", "volume", vol_clamped]
        }))
    }

    pub fn set_mute(&self, muted: bool) -> Result<(), String> {
        self.send_ipc_command(serde_json::json!({
            "command": ["set_property", "mute", muted]
        }))
    }

    pub fn load_file(&mut self, new_video_path: &str) -> Result<(), String> {
        self.video_path = new_video_path.to_string();
        self.send_ipc_command(serde_json::json!({
            "command": ["loadfile", new_video_path]
        }))
    }

    pub fn terminate(&mut self) {
        println!("[MPV] Terminating MPV process for monitor {}", self.monitor_label);
        let _ = self.send_ipc_command(serde_json::json!({ "command": ["quit"] }));
        let _ = self.child.kill();
        let _ = self.child.wait();

        #[cfg(windows)]
        if self.hwnd != 0 {
            use windows_sys::Win32::UI::WindowsAndMessaging::{DestroyWindow, IsWindow, ShowWindow, SW_HIDE};
            unsafe {
                let h = self.hwnd as HWND;
                if IsWindow(h) != 0 {
                    ShowWindow(h, SW_HIDE);
                    DestroyWindow(h);
                }
            }
            self.hwnd = 0;
        }
    }
}

impl Drop for MpvProcess {
    fn drop(&mut self) {
        self.terminate();
    }
}

/// Find the mpv executable path
pub fn find_mpv_binary() -> Result<PathBuf, String> {
    // 1. Try bundled relative to the running executable
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            let candidates = [
                exe_dir.join("bin").join("mpv").join("AetherFlow-VideoEngine.exe"),
                exe_dir.join("src-tauri").join("bin").join("mpv").join("AetherFlow-VideoEngine.exe"),
                exe_dir.join("bin").join("mpv").join("mpv.exe"),
                exe_dir.join("src-tauri").join("bin").join("mpv").join("mpv.exe"),
                exe_dir.join("bin").join("AetherFlow-VideoEngine.exe"),
                exe_dir.join("bin").join("mpv.exe"),
                exe_dir.join("AetherFlow-VideoEngine.exe"),
                exe_dir.join("mpv.exe"),
                exe_dir.join("..").join("..").join("src-tauri").join("bin").join("mpv").join("AetherFlow-VideoEngine.exe"),
                exe_dir.join("..").join("..").join("src-tauri").join("bin").join("mpv").join("mpv.exe"),
            ];
            for candidate in &candidates {
                if candidate.exists() {
                    return Ok(candidate.canonicalize().unwrap_or_else(|_| candidate.clone()));
                }
            }
        }
    }

    // 2. Try development path in project root
    let dev_paths = [
        PathBuf::from("src-tauri/bin/mpv/AetherFlow-VideoEngine.exe"),
        PathBuf::from("src-tauri/bin/mpv/mpv.exe"),
        PathBuf::from("bin/mpv/AetherFlow-VideoEngine.exe"),
        PathBuf::from("bin/mpv/mpv.exe"),
        PathBuf::from(r"C:\Users\Yashpreet_o7\Desktop\AetherFlow\src-tauri\bin\mpv\AetherFlow-VideoEngine.exe"),
        PathBuf::from(r"C:\Users\Yashpreet_o7\Desktop\AetherFlow\src-tauri\bin\mpv\mpv.exe"),
    ];
    for p in &dev_paths {
        if p.exists() {
            return Ok(p.canonicalize().unwrap_or_else(|_| p.clone()));
        }
    }

    // 3. Fall back to system PATH
    Ok(PathBuf::from("AetherFlow-VideoEngine.exe"))
}

/// Check if a given wallpaper configuration represents a video wallpaper
pub fn is_video_wallpaper(engine_id: &str, video_path: Option<&str>) -> bool {
    if engine_id == "video-player" {
        return true;
    }
    if let Some(path) = video_path {
        let p = path.to_lowercase();
        return p.ends_with(".mp4")
            || p.ends_with(".webm")
            || p.ends_with(".mkv")
            || p.ends_with(".avi")
            || p.ends_with(".mov")
            || p.ends_with(".wmv")
            || p.ends_with(".flv");
    }
    false
}

#[cfg(windows)]
fn find_mpv_hwnd(pid: u32) -> Option<HWND> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{EnumWindows, GetWindowThreadProcessId, GetClassNameW};
    use windows_sys::Win32::Foundation::LPARAM;

    struct SearchData {
        pid: u32,
        hwnd: Option<HWND>,
    }

    unsafe extern "system" fn enum_cb(hwnd: HWND, lparam: LPARAM) -> i32 {
        let data = &mut *(lparam as *mut SearchData);
        let mut proc_id = 0u32;
        GetWindowThreadProcessId(hwnd, &mut proc_id);
        if proc_id == data.pid {
            let mut buf = [0u16; 256];
            let len = GetClassNameW(hwnd, buf.as_mut_ptr(), 256);
            let class_name = String::from_utf16_lossy(&buf[..len as usize]);
            if class_name == "mpv" {
                data.hwnd = Some(hwnd);
                return 0; // stop enum
            }
        }
        1
    }

    // Poll for up to 2.5 seconds (50 iterations x 50ms)
    for _ in 0..50 {
        let mut data = SearchData { pid, hwnd: None };
        unsafe {
            EnumWindows(Some(enum_cb), &mut data as *mut _ as LPARAM);
        }
        if let Some(h) = data.hwnd {
            return Some(h);
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    None
}

/// Launch an MPV instance positioned for a specific monitor
pub fn spawn_mpv_wallpaper(
    video_path: &str,
    monitor_label: &str,
    mon_x: i32,
    mon_y: i32,
    mon_w: i32,
    mon_h: i32,
    volume: Option<f64>,
    muted: Option<bool>,
) -> Result<MpvProcess, String> {
    let mpv_exe = find_mpv_binary()?;
    let safe_label = monitor_label.replace("\\", "").replace(".", "_").replace(" ", "_");
    let pipe_name = format!(r"\\.\pipe\aetherflow-mpv-{}", safe_label);

    let mut cmd = Command::new(&mpv_exe);

    // Lively-style standalone borderless window flags:
    // MPV initializes its own Direct3D 11 swapchain without cross-process --wid restrictions.
    cmd.arg("--no-border")
        .arg("--no-osc")
        .arg("--no-osd-bar")
        .arg("--loop-file=inf")
        .arg("--keep-open=yes")
        .arg("--media-controls=no")
        .arg("--cursor-autohide=no")
        .arg("--input-default-bindings=no")
        .arg("--input-cursor=no")
        .arg("--hwdec=auto-safe")
        .arg("--panscan=1.0")
        .arg(format!("--geometry={:+}{:+}", mon_x, mon_y))
        .arg(format!("--autofit={}x{}", mon_w, mon_h))
        .arg("--background-color=#000000")
        .arg("--cache=no")
        .arg("--demuxer-max-bytes=16M")
        .arg("--demuxer-max-back-bytes=4M")
        .arg(format!("--input-ipc-server={}", pipe_name));

    // Audio handling
    if muted.unwrap_or(false) {
        cmd.arg("--mute=yes");
    } else {
        cmd.arg("--mute=no");
    }

    if let Some(vol) = volume {
        let vol_clamped = vol.max(0.0).min(100.0);
        cmd.arg(format!("--volume={}", vol_clamped));
    }

    // Video path to play
    cmd.arg(video_path);

    // Suppress console window
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    println!("[MPV] Launching standalone MPV instance: {:?} with file '{}' on monitor '{}' bounds=({},{}) {}x{}", 
        mpv_exe, video_path, monitor_label, mon_x, mon_y, mon_w, mon_h);
    log_mpv_msg(&format!("[MPV] Spawning standalone MPV: label='{}', bounds=({},{}) {}x{}, video='{}'", 
        monitor_label, mon_x, mon_y, mon_w, mon_h, video_path));

    let child = cmd.spawn().map_err(|e| format!("Failed to spawn MPV process {:?}: {}", mpv_exe, e))?;
    let mpv_pid = child.id();

    #[cfg(windows)]
    let mpv_hwnd = match find_mpv_hwnd(mpv_pid) {
        Some(h) => {
            log_mpv_msg(&format!("[MPV] Located native MPV HWND: 0x{:X} for PID={}", h as usize, mpv_pid));
            h
        }
        None => {
            log_mpv_msg(&format!("[MPV WARN] Could not find HWND for MPV PID={}, falling back to 0", mpv_pid));
            std::ptr::null_mut()
        }
    };

    #[cfg(not(windows))]
    let mpv_hwnd = 0usize;

    Ok(MpvProcess {
        child,
        pipe_name,
        monitor_label: monitor_label.to_string(),
        video_path: video_path.to_string(),
        #[cfg(windows)]
        hwnd: mpv_hwnd as usize,
        #[cfg(not(windows))]
        hwnd: 0,
    })
}

fn log_mpv_msg(msg: &str) {
    use std::io::Write;
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("desktop_debug.log") {
        let _ = writeln!(file, "{}", msg);
    }
}
