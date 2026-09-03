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
}

impl MpvProcess {
    pub fn send_ipc_command(&self, command: serde_json::Value) -> Result<(), String> {
        #[cfg(windows)]
        {
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
        std::thread::sleep(std::time::Duration::from_millis(80));
        let _ = self.child.kill();
        let _ = self.child.wait();
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
                exe_dir.join("bin").join("mpv").join("mpv.exe"),
                exe_dir.join("bin").join("mpv.exe"),
                exe_dir.join("mpv.exe"),
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
        PathBuf::from("src-tauri/bin/mpv/mpv.exe"),
        PathBuf::from("bin/mpv/mpv.exe"),
        PathBuf::from(r"C:\Users\Yashpreet_o7\Desktop\AURAOS\src-tauri\bin\mpv\mpv.exe"),
    ];
    for p in &dev_paths {
        if p.exists() {
            return Ok(p.canonicalize().unwrap_or_else(|_| p.clone()));
        }
    }

    // 3. Fall back to system PATH
    Ok(PathBuf::from("mpv.exe"))
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

/// Launch an MPV instance embedded into a native window handle
pub fn spawn_mpv_wallpaper(
    video_path: &str,
    #[cfg(windows)] host_hwnd: HWND,
    monitor_label: &str,
    volume: Option<f64>,
    muted: Option<bool>,
) -> Result<MpvProcess, String> {
    let mpv_exe = find_mpv_binary()?;
    let safe_label = monitor_label.replace("\\", "").replace(".", "_").replace(" ", "_");
    let pipe_name = format!(r"\\.\pipe\auraos-mpv-{}", safe_label);

    let mut cmd = Command::new(&mpv_exe);

    #[cfg(windows)]
    {
        // Embed directly into the desktop host HWND
        cmd.arg(format!("--wid={}", host_hwnd as usize));
    }

    // Core wallpaper parameters
    cmd.arg("--loop-file=inf")
        .arg("--no-osc")
        .arg("--no-osd-bar")
        .arg("--no-input-default-bindings")
        .arg("--hwdec=auto")
        .arg("--idle=yes")
        .arg("--force-window=yes")
        .arg("--keep-open=yes")
        .arg("--panscan=1.0") // Fill exact monitor window without black letterboxing
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

    println!("[MPV] Launching MPV instance: {:?} with file '{}' on monitor '{}'", mpv_exe, video_path, monitor_label);

    let child = cmd.spawn().map_err(|e| format!("Failed to spawn MPV process {:?}: {}", mpv_exe, e))?;

    // Brief sleep to let MPV establish the named pipe
    std::thread::sleep(std::time::Duration::from_millis(200));

    Ok(MpvProcess {
        child,
        pipe_name,
        monitor_label: monitor_label.to_string(),
        video_path: video_path.to_string(),
    })
}
