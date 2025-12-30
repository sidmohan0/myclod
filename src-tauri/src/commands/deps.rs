//! Dependency detection for Node.js and Claude Code CLI.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::process::Command;
use tauri::{Emitter, Window};

/// Status of required dependencies
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DependencyStatus {
    /// Node.js version if installed (e.g., "v20.10.0"), None if not found
    pub node: Option<String>,
    /// Claude Code version if installed, None if not found
    pub claude: Option<String>,
    /// Whether the user is authenticated with Anthropic
    pub authenticated: bool,
}

/// Check if Node.js is installed and return its version
fn check_node() -> Option<String> {
    Command::new("node")
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

/// Check if Claude Code CLI is installed and return its version
fn check_claude() -> Option<String> {
    Command::new("claude")
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

/// Check if the user is authenticated with Anthropic
/// This checks if claude can run without prompting for auth
fn check_auth() -> bool {
    // Try running claude with a simple command that would fail if not authenticated
    // The --version flag works without auth, so we check for config file instead
    if let Some(home) = dirs::home_dir() {
        let config_path = home.join(".claude").join("config.json");
        if config_path.exists() {
            // Config exists, likely authenticated
            // A more robust check would parse the config and verify tokens
            return true;
        }
    }
    false
}

/// Check all dependencies and return their status
#[tauri::command]
#[specta::specta]
pub fn check_dependencies() -> DependencyStatus {
    log::info!("Checking dependencies...");

    let node = check_node();
    let claude = check_claude();
    let authenticated = check_auth();

    log::info!(
        "Dependencies: node={:?}, claude={:?}, auth={}",
        node,
        claude,
        authenticated
    );

    DependencyStatus {
        node,
        claude,
        authenticated,
    }
}

/// Install Claude Code via npm
/// Emits 'install-progress' events with output lines
#[tauri::command]
#[specta::specta]
pub async fn install_claude_code(window: Window) -> Result<(), String> {
    log::info!("Installing Claude Code via npm...");

    let output = Command::new("npm")
        .args(["install", "-g", "@anthropic-ai/claude-code"])
        .output()
        .map_err(|e| format!("Failed to run npm: {e}"))?;

    // Emit stdout
    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let _ = window.emit("install-progress", line);
    }

    // Emit stderr
    let stderr = String::from_utf8_lossy(&output.stderr);
    for line in stderr.lines() {
        let _ = window.emit("install-progress", line);
    }

    if output.status.success() {
        log::info!("Claude Code installed successfully");
        Ok(())
    } else {
        let error = format!("npm install failed with exit code: {:?}", output.status.code());
        log::error!("{error}");
        Err(error)
    }
}
