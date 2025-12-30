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

/// Get the user's full PATH by sourcing their shell profile.
/// GUI apps on macOS don't inherit the shell's PATH, so we need to get it explicitly.
pub fn get_shell_path() -> String {
    // Try to get PATH from user's shell
    if let Ok(output) = Command::new("/bin/zsh")
        .args(["-l", "-c", "echo $PATH"])
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return path;
            }
        }
    }

    // Fallback: common macOS paths where Node might be installed
    let common_paths = [
        "/opt/homebrew/bin",           // Apple Silicon Homebrew
        "/usr/local/bin",              // Intel Homebrew / manual installs
        "/usr/bin",                    // System
        "/bin",                        // System
        "/usr/sbin",                   // System
        "/sbin",                       // System
        "/opt/homebrew/opt/node/bin",  // Homebrew node
        "/usr/local/opt/node/bin",     // Intel Homebrew node
    ];

    // Also check for nvm
    if let Some(home) = dirs::home_dir() {
        let nvm_path = home.join(".nvm/versions/node");
        if nvm_path.exists() {
            // Find the latest node version in nvm
            if let Ok(entries) = std::fs::read_dir(&nvm_path) {
                let mut versions: Vec<_> = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().is_dir())
                    .collect();
                versions.sort_by(|a, b| b.path().cmp(&a.path()));
                if let Some(latest) = versions.first() {
                    let bin_path = latest.path().join("bin");
                    if bin_path.exists() {
                        let mut paths = vec![bin_path.to_string_lossy().to_string()];
                        paths.extend(common_paths.iter().map(|s| s.to_string()));
                        return paths.join(":");
                    }
                }
            }
        }
    }

    common_paths.join(":")
}

/// Check if Node.js is installed and return its version
fn check_node() -> Option<String> {
    let path = get_shell_path();

    Command::new("node")
        .arg("--version")
        .env("PATH", &path)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

/// Check if Claude Code CLI is installed and return its version
fn check_claude() -> Option<String> {
    let path = get_shell_path();

    Command::new("claude")
        .arg("--version")
        .env("PATH", &path)
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

    let path = get_shell_path();

    let output = Command::new("npm")
        .args(["install", "-g", "@anthropic-ai/claude-code"])
        .env("PATH", &path)
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
