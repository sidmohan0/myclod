//! Authentication status checking for Claude Code.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::fs;
use std::path::PathBuf;

/// Authentication status
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AuthStatus {
    /// Whether the user appears to be authenticated
    pub authenticated: bool,
    /// Path to the Claude config directory
    pub config_path: Option<String>,
}

/// Get the Claude config directory path
fn get_claude_config_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude"))
}

/// Check authentication status by looking for Claude config files
#[tauri::command]
#[specta::specta]
pub fn check_auth_status() -> AuthStatus {
    log::info!("Checking Claude authentication status...");

    let config_dir = get_claude_config_dir();

    let authenticated = config_dir
        .as_ref()
        .map(|dir| {
            // Check for various config files that indicate authentication
            let config_json = dir.join("config.json");
            let credentials = dir.join("credentials.json");

            config_json.exists() || credentials.exists()
        })
        .unwrap_or(false);

    let config_path = config_dir.map(|p| p.to_string_lossy().to_string());

    log::info!("Auth status: authenticated={authenticated}, config_path={config_path:?}");

    AuthStatus {
        authenticated,
        config_path,
    }
}

/// Get the Claude config directory contents (for debugging)
#[tauri::command]
#[specta::specta]
pub fn get_claude_config_info() -> Result<Vec<String>, String> {
    let config_dir =
        get_claude_config_dir().ok_or_else(|| "Could not find home directory".to_string())?;

    if !config_dir.exists() {
        return Ok(vec!["Config directory does not exist".to_string()]);
    }

    let entries: Vec<String> = fs::read_dir(&config_dir)
        .map_err(|e| format!("Failed to read config directory: {e}"))?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.file_name().to_string_lossy().to_string())
        .collect();

    Ok(entries)
}
