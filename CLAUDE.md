# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

myclod is a native macOS desktop app that wraps Claude Code CLI in a user-friendly interface. Built with Tauri v2 (React frontend + Rust backend) using xterm.js for terminal rendering.

## Commands

```bash
# Install dependencies
npm install

# Development with hot reload
npm run tauri:dev

# Build for distribution (creates .dmg)
npm run tauri:build

# Run all quality checks
npm run check:all

# Generate TypeScript bindings from Rust
npm run rust:bindings
```

## Architecture

See `docs/plans/2025-12-29-claude-ui-migration-design.md` for the full design document.

**Frontend (React + TypeScript)** in `src/`:
- Setup flow components handle dependency checking (Node.js, Claude Code) and authentication
- Terminal component wraps xterm.js for rendering Claude Code output
- ActionBar provides Accept/Reject buttons and folder picker

**Backend (Rust)** in `src-tauri/src/`:
- `commands/deps.rs` - Checks for Node.js and Claude Code CLI availability
- `commands/pty.rs` - Manages PTY sessions using `portable-pty` crate
- `commands/auth.rs` - Authentication status checking

**Communication pattern:**
- Frontend → Backend: Tauri commands via tauri-specta (type-safe)
- Backend → Frontend: Tauri events (`claude-output`, `install-progress`)

## Key Patterns

Read `AGENTS.md` for detailed architecture patterns including:
- Three-layer state management (useState → Zustand → TanStack Query)
- Zustand selector pattern (avoid destructuring)
- tauri-specta for type-safe Rust-TypeScript bridge

## Project Status

Under active development. Current phase: Phase 1 setup complete, starting Phase 2 (Rust backend).
