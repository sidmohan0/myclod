# myclod

A desktop app for Claude Code. No terminal required.

## What is this?

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) is Anthropic's AI coding assistant that runs in your terminal. It's powerful, but terminals can be intimidating.

myclod wraps Claude Code in a clean, native Mac app. Same capabilities, friendlier interface.

## Features

- **One-click install** — no Homebrew, no npm, no PATH configuration
- **Folder picker** — choose your project visually
- **Accept/Reject buttons** — no typing `y` or `n`
- **Native macOS app** — lightweight, feels right at home

## Requirements

- macOS 12.0 or later
- That's it — the app handles everything else

## First Launch

On first launch, myclod will:

1. Check for Node.js (required by Claude Code)
2. Check for Claude Code CLI
3. Guide you through installing anything missing
4. Help you authenticate with Anthropic

After initial setup, just pick a folder and start chatting with Claude about your code.

## How It Works

myclod is a thin wrapper around the official Claude Code CLI. Your conversations go directly to Anthropic's API — we don't run any servers or touch your code.

```
┌─────────────────────────────────────┐
│  myclod (this app)                  │
│  - Native Mac interface             │
│  - Folder picker                    │
│  - Accept/Reject buttons            │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  Claude Code CLI                    │
│  - Anthropic's official tool        │
│  - All the AI magic                 │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  Anthropic API                      │
│  - Your code stays between you      │
│    and Anthropic                    │
└─────────────────────────────────────┘
```

## Development

```bash
# Prerequisites: Node.js 20+, Rust (latest stable)

# Install dependencies
npm install

# Run in development
npm run tauri:dev

# Build for distribution
npm run tauri:build

# Run all checks
npm run check:all
```

## Tech Stack

- [Tauri v2](https://tauri.app/) — lightweight native app framework
- [xterm.js](https://xtermjs.org/) — terminal rendering
- [React 19](https://react.dev/) — UI components
- [shadcn/ui](https://ui.shadcn.com/) — component library
- Rust — PTY management and system integration

## Project Status

This project is under active development. See [docs/plans/](docs/plans/) for the implementation roadmap.

## License

MIT
