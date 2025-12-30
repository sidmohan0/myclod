# Claude UI Migration Design

**Date:** 2025-12-29
**Status:** Approved
**Summary:** Migrate Claude UI (desktop wrapper for Claude Code CLI) to the dannysmith/tauri-template foundation.

---

## Overview

Claude UI is a native macOS desktop app that wraps Claude Code CLI in a user-friendly interface. The current codebase contains only documentation (ARCHITECTURE.md, README.md) with no implementation.

The [dannysmith/tauri-template](https://github.com/dannysmith/tauri-template) provides ~80% of required infrastructure:
- React 19 + TypeScript + Vite 7
- Tauri v2 with Rust backend
- shadcn/ui + Tailwind CSS v4
- Zustand + TanStack Query state management
- Command palette, preferences, keyboard shortcuts
- Theme system, i18n, auto-updates

We will clone the template and add Claude UI-specific features on top.

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│  App Launch                                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
                ┌───────────────────┐
                │ Check Dependencies │
                │ (Node, Claude CLI) │
                └─────────┬─────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
      ┌──────────────┐        ┌──────────────┐
      │ Missing      │        │ All Present  │
      │ → SetupFlow  │        │ → MainWindow │
      └──────────────┘        └──────────────┘
                                     │
                                     ▼
                          ┌───────────────────┐
                          │ Folder Picker     │
                          └─────────┬─────────┘
                                    │
                                    ▼
                          ┌───────────────────┐
                          │ Spawn Claude PTY  │
                          │ in selected dir   │
                          └─────────┬─────────┘
                                    │
                                    ▼
                          ┌───────────────────┐
                          │ Terminal + ActionBar│
                          │ - xterm.js output  │
                          │ - Accept/Reject    │
                          └───────────────────┘
```

### Component Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React + TypeScript)                                │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ SetupFlow    │  │ Terminal     │  │ ActionBar        │   │
│  │              │  │              │  │                  │   │
│  │ - NodeCheck  │  │ - xterm.js   │  │ - Accept/Reject  │   │
│  │ - ClaudeCheck│  │ - Resize     │  │ - Folder picker  │   │
│  │ - AuthCheck  │  │ - Theme sync │  │ - Cmd+Enter/Esc  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Tauri Commands & Events
                              │
┌─────────────────────────────────────────────────────────────┐
│ Backend (Rust)                                               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ deps.rs      │  │ pty.rs       │  │ auth.rs          │   │
│  │              │  │              │  │                  │   │
│  │ - check_node │  │ - spawn      │  │ - check_status   │   │
│  │ - check_cli  │  │ - send_input │  │                  │   │
│  │ - install    │  │ - resize     │  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Rust Backend Additions

### New Modules

**`src-tauri/src/commands/deps.rs`**
```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DependencyStatus {
    pub node: Option<String>,      // Version or None
    pub claude: Option<String>,    // Version or None
    pub authenticated: bool,
}

#[tauri::command]
#[specta::specta]
pub fn check_dependencies() -> DependencyStatus {
    DependencyStatus {
        node: check_node(),
        claude: check_claude(),
        authenticated: check_auth(),
    }
}

fn check_node() -> Option<String> {
    Command::new("node")
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

fn check_claude() -> Option<String> {
    Command::new("claude")
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn install_claude_code(window: Window) -> Result<(), String> {
    // npm install -g @anthropic-ai/claude-code
    // Emits 'install-progress' events
}
```

**`src-tauri/src/commands/pty.rs`**
```rust
use portable_pty::{native_pty_system, CommandBuilder, PtySize, MasterPty, Child};

pub struct PtySession {
    master: Box<dyn MasterPty>,
    child: Box<dyn Child>,
    writer: Box<dyn Write + Send>,
}

#[tauri::command]
#[specta::specta]
pub fn spawn_claude(window: Window, cwd: String) -> Result<(), String> {
    let pty_system = native_pty_system();

    let pair = pty_system.openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    let mut cmd = CommandBuilder::new("claude");
    cmd.cwd(cwd);
    cmd.env("TERM", "xterm-256color");

    let child = pair.slave.spawn_command(cmd)?;

    // Store session, start reader thread
    // Emit 'claude-output' events to frontend
}

#[tauri::command]
#[specta::specta]
pub fn send_input(input: String) -> Result<(), String>

#[tauri::command]
#[specta::specta]
pub fn resize_terminal(rows: u16, cols: u16) -> Result<(), String>

#[tauri::command]
#[specta::specta]
pub fn kill_session() -> Result<(), String>
```

### Cargo.toml Addition
```toml
[dependencies]
portable-pty = "0.8"
```

---

## React Frontend Components

### New Components

**Setup Flow (`src/components/setup/`)**
- `SetupFlow.tsx` - State machine orchestrator
- `NodeCheck.tsx` - Node.js install guidance (download link, brew command)
- `ClaudeCheck.tsx` - One-click npm install with progress
- `AuthCheck.tsx` - Embedded terminal for OAuth flow

**Terminal (`src/components/terminal/`)**
- `Terminal.tsx` - xterm.js wrapper with resize handling
- `ActionBar.tsx` - Accept/Reject buttons, folder display
- `CommandsMenu.tsx` - Dropdown for slash commands

**Folder Picker (`src/components/folder-picker/`)**
- `FolderPicker.tsx` - Tauri dialog with recent folders list

### State Management

**Zustand Store (`src/store/claude-store.ts`)**
```typescript
interface ClaudeState {
  sessionActive: boolean
  currentFolder: string | null
  pendingAction: 'pending' | null

  setSessionActive: (active: boolean) => void
  setCurrentFolder: (folder: string | null) => void
  setPendingAction: (action: 'pending' | null) => void
}
```

**TanStack Query (`src/services/`)**
- `dependencies.ts` - `useDependencyStatus()` hook
- `claude-session.ts` - `useSpawnClaude()` mutation

### Command System

**New Commands (`src/lib/commands/claude-commands.ts`)**
```typescript
export const claudeCommands: AppCommand[] = [
  {
    id: 'accept-action',
    labelKey: 'commands.accept.label',
    shortcut: 'Cmd+Enter',
    execute: () => {
      commands.sendInput('y\n')
      useClaudeStore.getState().setPendingAction(null)
    },
    isAvailable: () => !!useClaudeStore.getState().pendingAction,
  },
  {
    id: 'reject-action',
    labelKey: 'commands.reject.label',
    shortcut: 'Escape',
    execute: () => {
      commands.sendInput('n\n')
      useClaudeStore.getState().setPendingAction(null)
    },
    isAvailable: () => !!useClaudeStore.getState().pendingAction,
  },
]
```

---

## File Structure

```
claude-ui/
├── src/
│   ├── components/
│   │   ├── setup/                    # [NEW]
│   │   │   ├── SetupFlow.tsx
│   │   │   ├── NodeCheck.tsx
│   │   │   ├── ClaudeCheck.tsx
│   │   │   └── AuthCheck.tsx
│   │   ├── terminal/                 # [NEW]
│   │   │   ├── Terminal.tsx
│   │   │   ├── ActionBar.tsx
│   │   │   └── CommandsMenu.tsx
│   │   ├── folder-picker/            # [NEW]
│   │   │   └── FolderPicker.tsx
│   │   ├── command-palette/          # [KEEP]
│   │   ├── preferences/              # [KEEP]
│   │   ├── titlebar/                 # [KEEP]
│   │   └── ui/                       # [KEEP]
│   ├── hooks/
│   │   ├── use-terminal.ts           # [NEW]
│   │   └── (template hooks)          # [KEEP]
│   ├── store/
│   │   ├── claude-store.ts           # [NEW]
│   │   └── ui-store.ts               # [KEEP]
│   ├── services/
│   │   ├── dependencies.ts           # [NEW]
│   │   ├── claude-session.ts         # [NEW]
│   │   └── preferences.ts            # [KEEP]
│   ├── lib/
│   │   ├── commands/
│   │   │   ├── claude-commands.ts    # [NEW]
│   │   │   └── (template commands)   # [MODIFY]
│   │   └── (template libs)           # [KEEP]
│   └── App.tsx                       # [MODIFY]
│
├── src-tauri/src/
│   ├── commands/
│   │   ├── deps.rs                   # [NEW]
│   │   ├── pty.rs                    # [NEW]
│   │   ├── auth.rs                   # [NEW]
│   │   └── (template commands)       # [KEEP]
│   ├── lib.rs                        # [MODIFY]
│   ├── bindings.rs                   # [MODIFY]
│   └── types.rs                      # [MODIFY]
│
└── package.json                      # [MODIFY] Add xterm deps
```

**Delete from template:**
- `src/components/layout/` (sidebars, panels)
- `src/components/quick-pane/`
- `quick-pane.html`, `quick-pane-main.tsx`

---

## Implementation Steps

### Phase 1: Project Setup
1. Clone dannysmith/tauri-template
2. Rename to `claude-ui`, update `tauri.conf.json`
3. Add dependencies: xterm.js (npm), portable-pty (cargo)
4. Verify template runs with `npm run tauri dev`
5. Delete unused template components

### Phase 2: Rust Backend
1. Create `deps.rs` - dependency detection
2. Create `pty.rs` - PTY session management
3. Create `auth.rs` - auth status
4. Update `types.rs`, `bindings.rs`, `lib.rs`
5. Generate TypeScript bindings

### Phase 3: Setup Flow
1. Create TanStack Query hooks for dependencies
2. Create SetupFlow state machine
3. Create NodeCheck, ClaudeCheck, AuthCheck components
4. Update App.tsx entry point

### Phase 4: Terminal Integration
1. Create Terminal.tsx with xterm.js
2. Create claude-store.ts
3. Wire up Tauri events
4. Test PTY communication

### Phase 5: ActionBar & Commands
1. Create ActionBar with Accept/Reject
2. Add keyboard shortcuts (Cmd+Enter, Escape)
3. Add permission prompt detection
4. Create FolderPicker

### Phase 6: Polish
1. Update native menu
2. Add Claude preferences
3. Theme sync
4. Update documentation

### Phase 7: Release
1. Create app icons
2. Configure auto-updater
3. Build and test .dmg
4. Set up CI/CD

---

## Estimates

- **New Rust code:** ~400 lines
- **New React code:** ~600 lines
- **Modified code:** ~200 lines
- **Total:** ~1,200 lines on top of template

---

## Open Questions

None - design approved for implementation.
