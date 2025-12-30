//! PTY (pseudo-terminal) management for Claude Code sessions.
//!
//! This module handles spawning Claude Code in a PTY, reading output,
//! writing input, and managing the terminal session lifecycle.

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, State};

/// Global PTY session state
pub struct PtyState {
    session: Mutex<Option<PtySession>>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            session: Mutex::new(None),
        }
    }
}

/// Active PTY session
struct PtySession {
    #[allow(dead_code)]
    child: Box<dyn Child + Send + Sync>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
}

/// Spawn Claude Code in the specified directory
#[tauri::command]
#[specta::specta]
pub async fn spawn_claude(
    app: AppHandle,
    state: State<'_, PtyState>,
    cwd: String,
) -> Result<(), String> {
    log::info!("Spawning Claude Code in: {cwd}");

    // Kill any existing session
    {
        let mut session_guard = state.session.lock().map_err(|e| e.to_string())?;
        if session_guard.is_some() {
            log::info!("Killing existing PTY session");
            *session_guard = None;
        }
    }

    let pty_system = native_pty_system();

    // Create PTY pair
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    // Build command
    let mut cmd = CommandBuilder::new("claude");
    cmd.cwd(&cwd);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    // Spawn the process
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn claude: {e}"))?;

    log::info!("Claude Code spawned successfully");

    // Get writer for input
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {e}"))?;

    let writer = Arc::new(Mutex::new(writer));
    let master: Arc<Mutex<Box<dyn MasterPty + Send>>> = Arc::new(Mutex::new(pair.master));

    // Store the session
    {
        let mut session_guard = state.session.lock().map_err(|e| e.to_string())?;
        *session_guard = Some(PtySession {
            child,
            writer: Arc::clone(&writer),
            master: Arc::clone(&master),
        });
    }

    // Spawn reader thread to emit output events
    let app_handle = app.clone();
    let master_for_reader = Arc::clone(&master);

    thread::spawn(move || {
        let mut reader = {
            let master_guard = master_for_reader.lock().unwrap();
            match master_guard.try_clone_reader() {
                Ok(r) => r,
                Err(e) => {
                    log::error!("Failed to get PTY reader: {e}");
                    return;
                }
            }
        };

        let mut buffer = [0u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    log::info!("PTY closed (EOF)");
                    let _ = app_handle.emit("claude-exit", ());
                    break;
                }
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                    let _ = app_handle.emit("claude-output", &data);
                }
                Err(e) => {
                    log::error!("PTY read error: {e}");
                    let _ = app_handle.emit("claude-exit", ());
                    break;
                }
            }
        }
    });

    Ok(())
}

/// Send input to the Claude Code session
#[tauri::command]
#[specta::specta]
pub fn send_input(state: State<'_, PtyState>, input: String) -> Result<(), String> {
    let session_guard = state.session.lock().map_err(|e| e.to_string())?;

    if let Some(session) = session_guard.as_ref() {
        let mut writer = session.writer.lock().map_err(|e| e.to_string())?;
        writer
            .write_all(input.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {e}"))?;
        writer.flush().map_err(|e| format!("Failed to flush PTY: {e}"))?;
        Ok(())
    } else {
        Err("No active PTY session".to_string())
    }
}

/// Resize the terminal
#[tauri::command]
#[specta::specta]
pub fn resize_terminal(state: State<'_, PtyState>, rows: u16, cols: u16) -> Result<(), String> {
    let session_guard = state.session.lock().map_err(|e| e.to_string())?;

    if let Some(session) = session_guard.as_ref() {
        let master = session.master.lock().map_err(|e| e.to_string())?;
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {e}"))?;
        log::debug!("Terminal resized to {rows}x{cols}");
        Ok(())
    } else {
        Err("No active PTY session".to_string())
    }
}

/// Kill the current PTY session
#[tauri::command]
#[specta::specta]
pub fn kill_session(state: State<'_, PtyState>) -> Result<(), String> {
    let mut session_guard = state.session.lock().map_err(|e| e.to_string())?;

    if session_guard.is_some() {
        log::info!("Killing PTY session");
        *session_guard = None;
        Ok(())
    } else {
        Err("No active PTY session".to_string())
    }
}

/// Check if there's an active PTY session
#[tauri::command]
#[specta::specta]
pub fn has_active_session(state: State<'_, PtyState>) -> bool {
    state
        .session
        .lock()
        .map(|s| s.is_some())
        .unwrap_or(false)
}
